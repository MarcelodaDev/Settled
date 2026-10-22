import { Router } from 'express';
import { interpretarCobro, redactarRecordatorio } from '../ai.js';
import { generarNumero, hoyEcuador, normalizarCobro, numeroValido } from '../cobro.js';
import { cargarFilas, filaFresca } from '../filas.js';
import { crearYEnviar, obtenerFactura, resumir } from '../paypal.js';
import { describirPlazo, formatearMonto, insertarEnlace, TONOS, tonoSugerido } from '../recordatorio.js';
import { idiomaDe, idiomaValido, m } from '../i18n.js';
import { limiteFacturas, limiteIA } from '../limites.js';
import * as store from '../store.js';

const router = Router();

const CANALES = new Set(['copiar', 'whatsapp', 'correo']);

// El modelo a veces pide el apellido del cliente aunque el prompt lo prohíba.
// Un nombre de pila basta para facturar, así que esas notas se descartan aquí.
const PIDE_APELLIDO = /apellido|nombre completo|last name|surname|full name/i;

function limpiarAdvertencias(advertencias) {
  if (!Array.isArray(advertencias)) return [];
  return advertencias.filter((a) => typeof a === 'string' && !PIDE_APELLIDO.test(a)).slice(0, 6);
}

// Panel de cobros: la lista sale siempre de PayPal (fuente de verdad).
router.get('/', async (req, res) => {
  const { hoy, filas } = await cargarFilas();
  res.json({ hoy, cobros: filas });
});

// Paso 1: la IA propone. Esta ruta nunca crea nada en PayPal.
router.post('/interpretar', limiteIA, async (req, res) => {
  const idioma = idiomaDe(req);
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) return res.status(400).json({ error: m(idioma, 'cobro.texto_vacio') });
  if (texto.length > 1000) return res.status(400).json({ error: m(idioma, 'cobro.texto_largo') });

  const propuesta = await interpretarCobro(texto, hoyEcuador(), idioma);
  const { cobro, errores } = normalizarCobro(propuesta, idioma);

  res.json({
    cobro,
    numero: generarNumero(),
    advertencias: limpiarAdvertencias(propuesta.advertencias),
    errores,
  });
});

// Paso 2: el usuario confirmó (y quizá corrigió) la propuesta. Se valida de
// nuevo aquí, porque lo que llega del navegador no es de fiar.
router.post('/', limiteFacturas, async (req, res) => {
  const idioma = idiomaDe(req);
  const { cobro, errores } = normalizarCobro(req.body?.cobro, idioma);
  if (errores.length) return res.status(400).json({ error: errores[0], errores });

  const numero = req.body?.numero;
  if (!numeroValido(numero)) return res.status(400).json({ error: m(idioma, 'cobro.numero_invalido') });

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
router.post('/:id/recordatorio', limiteIA, async (req, res) => {
  const idioma = idiomaDe(req);
  // El mensaje lo lee el cliente: puede ir en un idioma distinto al de la interfaz.
  const idiomaMensaje = idiomaValido(req.body?.idioma_mensaje ?? idioma);
  const fila = await filaFresca(req.params.id);
  if (fila.pendiente <= 0) {
    return res.status(409).json({ error: m(idioma, 'recordatorio.sin_saldo') });
  }

  const sugerido = tonoSugerido(fila.dias_atraso);
  const tono = Object.hasOwn(TONOS, req.body?.tono) ? req.body.tono : sugerido;

  const borrador = await redactarRecordatorio(
    {
      ...fila,
      total: formatearMonto(fila.total, idiomaMensaje),
      cobrado: fila.cobrado > 0 ? formatearMonto(fila.cobrado, idiomaMensaje) : (idiomaMensaje === 'es' ? 'nada' : 'nothing'),
      pendiente: formatearMonto(fila.pendiente, idiomaMensaje),
      situacion: describirPlazo(fila, hoyEcuador(), idiomaMensaje),
      recordatorios_previos: fila.recordatorios.length,
      firma: process.env.FREELANCER_NOMBRE || null,
    },
    tono,
    TONOS[tono],
    idiomaMensaje,
  );
  const asunto = typeof borrador.asunto === 'string' ? borrador.asunto.trim().slice(0, 150) : '';
  const mensaje = typeof borrador.mensaje === 'string' ? borrador.mensaje.trim().slice(0, 1500) : '';
  if (!mensaje) return res.status(502).json({ error: m(idioma, 'recordatorio.sin_mensaje') });

  res.json({ tono, sugerido, asunto, mensaje: insertarEnlace(mensaje, fila.enlace), email: fila.email });
});

// El freelancer envió el recordatorio por su canal: queda en el historial local
// (PayPal no guarda este dato).
router.post('/:id/recordatorios', async (req, res) => {
  const { tono, canal } = req.body ?? {};
  if (!Object.hasOwn(TONOS, tono) || !CANALES.has(canal)) {
    return res.status(400).json({ error: m(idiomaDe(req), 'recordatorio.datos_invalidos') });
  }
  const fila = await filaFresca(req.params.id); // confirma que la factura existe
  const recordatorios = [...fila.recordatorios, { fecha: new Date().toISOString(), tono, canal }].slice(-50);
  await store.guardar(fila.id, { recordatorios });
  res.status(201).json({ recordatorios });
});

export default router;
