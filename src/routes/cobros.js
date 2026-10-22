import { Router } from 'express';
import { interpretarCobro, redactarRecordatorio } from '../ai.js';
import { generarNumero, hoyEcuador, normalizarCobro, numeroValido } from '../cobro.js';
import { conFijos, crearYEnviar, listarFacturas, obtenerFactura, resumir } from '../paypal.js';
import { describirPlazo, formatearMonto, insertarEnlace, TONOS, tonoSugerido } from '../recordatorio.js';
import * as store from '../store.js';

const router = Router();

// Estados en los que todavía se espera dinero del cliente.
const ABIERTAS = new Set(['SENT', 'UNPAID', 'PARTIALLY_PAID', 'SCHEDULED', 'PAYMENT_PENDING']);
const PAGADAS = new Set(['PAID', 'MARKED_AS_PAID']);
const DIA = 24 * 60 * 60 * 1000;

// Una fila del panel: lo que PayPal sabe, más el texto original guardado aquí.
function aFila(factura, extras, hoy) {
  const total = Number(factura.amount?.value ?? 0);
  const abierta = ABIERTAS.has(factura.status);
  const pendiente = abierta ? Number(factura.due_amount?.value ?? total) : 0;
  const cobrado = PAGADAS.has(factura.status) ? total : abierta ? total - pendiente : 0;
  const vence = factura.detail?.payment_term?.due_date ?? null;
  // "Vencida" no es un estado de PayPal: es una factura abierta con la fecha pasada.
  const vencida = abierta && vence !== null && vence < hoy;
  const nombre = factura.primary_recipients?.[0]?.billing_info?.name;
  const recordatorios = extras?.recordatorios ?? [];

  return {
    id: factura.id,
    numero: factura.detail?.invoice_number ?? null,
    cliente: nombre?.full_name || nombre?.given_name || factura.primary_recipients?.[0]?.billing_info?.business_name || '—',
    email: factura.fijos?.email ?? null,
    concepto: factura.fijos?.concepto ?? null,
    emitida: factura.detail?.invoice_date ?? null,
    vence,
    estado: factura.status,
    vencida,
    dias_atraso: vencida ? Math.round((Date.parse(hoy) - Date.parse(vence)) / DIA) : 0,
    vista: Boolean(factura.detail?.viewed_by_recipient),
    total,
    cobrado: Math.round(cobrado * 100) / 100,
    pendiente,
    enlace: factura.fijos?.enlace ?? null,
    texto_original: extras?.texto_original ?? null,
    recordatorios,
  };
}

const CANALES = new Set(['copiar', 'whatsapp', 'correo']);

async function filaFresca(id) {
  const [factura, extras] = await Promise.all([obtenerFactura(id), store.leer(id)]);
  return aFila(conFijos(factura), extras, hoyEcuador());
}

// Panel de cobros: la lista sale siempre de PayPal (fuente de verdad).
router.get('/', async (req, res) => {
  const [facturas, extras] = await Promise.all([listarFacturas(), store.leerTodos()]);
  const hoy = hoyEcuador();
  res.json({ hoy, cobros: facturas.map((f) => aFila(f, extras[f.id], hoy)) });
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
