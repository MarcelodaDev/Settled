import { Router } from 'express';
import { interpretarCobro, redactarRecordatorio } from '../ai.js';
import { generarNumero, hoyEcuador, normalizarCobro, numeroValido } from '../cobro.js';
import { cargarFilas, filaFresca } from '../filas.js';
import { crearYEnviar, obtenerFactura, resumir } from '../paypal.js';
import { describirPlazo, formatearMonto, insertarEnlace, TONOS, tonoSugerido } from '../recordatorio.js';
import * as store from '../store.js';

const router = Router();

const CANALES = new Set(['copiar', 'whatsapp', 'correo']);

// Panel de cobros: la lista sale siempre de PayPal (fuente de verdad).
router.get('/', async (req, res) => {
  const { hoy, filas } = await cargarFilas();
  res.json({ hoy, cobros: filas });
});

// Paso 1: la IA propone. Esta ruta nunca crea nada en PayPal.
router.post('/interpretar', async (req, res) => {
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) return res.status(400).json({ error: 'Escribe qué quieres cobrar.' });
  if (texto.length > 1000) return res.status(400).json({ error: 'La instrucción es demasiado larga (máximo 1000 caracteres).' });

  const propuesta = await interpretarCobro(texto, hoyEcuador());
  const { cobro, errores } = normalizarCobro(propuesta);

  res.json({
    cobro,
    numero: generarNumero(),
    advertencias: Array.isArray(propuesta.advertencias) ? propuesta.advertencias.slice(0, 6) : [],
    errores,
  });
});

// Paso 2: el usuario confirmó (y quizá corrigió) la propuesta. Se valida de
// nuevo aquí, porque lo que llega del navegador no es de fiar.
router.post('/', async (req, res) => {
  const { cobro, errores } = normalizarCobro(req.body?.cobro);
  if (errores.length) return res.status(400).json({ error: errores[0], errores });

  const numero = req.body?.numero;
  if (!numeroValido(numero)) return res.status(400).json({ error: 'Número de factura no válido.' });

  const factura = await crearYEnviar(cobro, numero);
  const resumen = resumir(factura);

  await store.guardar(resumen.id, {
    numero,
    texto_original: typeof req.body?.texto_original === 'string' ? req.body.texto_original.slice(0, 1000) : null,
    creado: new Date().toISOString(),
  });

  res.status(201).json(resumen);
});

// Estado actual de una factura, leído siempre de PayPal.
router.get('/:id', async (req, res) => {
  res.json(resumir(await obtenerFactura(req.params.id)));
});

// La IA redacta un recordatorio. Los datos se leen de PayPal en este momento:
// así nunca se recuerda una factura ya pagada ni un monto desactualizado.
router.post('/:id/recordatorio', async (req, res) => {
  const fila = await filaFresca(req.params.id);
  if (fila.pendiente <= 0) {
    return res.status(409).json({ error: 'Esta factura no tiene saldo pendiente; no hace falta recordatorio.' });
  }

  const sugerido = tonoSugerido(fila.dias_atraso);
  const tono = Object.hasOwn(TONOS, req.body?.tono) ? req.body.tono : sugerido;

  const borrador = await redactarRecordatorio(
    {
      ...fila,
      total: formatearMonto(fila.total),
      cobrado: fila.cobrado > 0 ? formatearMonto(fila.cobrado) : 'nada',
      pendiente: formatearMonto(fila.pendiente),
      situacion: describirPlazo(fila, hoyEcuador()),
      recordatorios_previos: fila.recordatorios.length,
      firma: process.env.FREELANCER_NOMBRE || null,
    },
    tono,
    TONOS[tono],
  );
  const asunto = typeof borrador.asunto === 'string' ? borrador.asunto.trim().slice(0, 150) : '';
  const mensaje = typeof borrador.mensaje === 'string' ? borrador.mensaje.trim().slice(0, 1500) : '';
  if (!mensaje) return res.status(502).json({ error: 'La IA no devolvió un mensaje. Inténtalo de nuevo.' });

  res.json({ tono, sugerido, asunto, mensaje: insertarEnlace(mensaje, fila.enlace), email: fila.email });
});

// El freelancer envió el recordatorio por su canal: queda en el historial local
// (PayPal no guarda este dato).
router.post('/:id/recordatorios', async (req, res) => {
  const { tono, canal } = req.body ?? {};
  if (!Object.hasOwn(TONOS, tono) || !CANALES.has(canal)) {
    return res.status(400).json({ error: 'Datos del recordatorio no válidos.' });
  }
  const fila = await filaFresca(req.params.id); // confirma que la factura existe
  const recordatorios = [...fila.recordatorios, { fecha: new Date().toISOString(), tono, canal }].slice(-50);
  await store.guardar(fila.id, { recordatorios });
  res.status(201).json({ recordatorios });
});

export default router;
