// Una "fila" es una factura de PayPal en el formato que usan el panel, los
// recordatorios y las consultas: lo que sabe PayPal más los extras locales.

import { hoyEcuador } from './cobro.js';
import { conFijos, listarFacturas, obtenerFactura } from './paypal.js';
import * as store from './store.js';

// Estados en los que todavía se espera dinero del cliente.
const ABIERTAS = new Set(['SENT', 'UNPAID', 'PARTIALLY_PAID', 'SCHEDULED', 'PAYMENT_PENDING']);
const PAGADAS = new Set(['PAID', 'MARKED_AS_PAID']);
const DIA = 24 * 60 * 60 * 1000;

export function aFila(factura, extras, hoy) {
  const total = Number(factura.amount?.value ?? 0);
  const abierta = ABIERTAS.has(factura.status);
  const pendiente = abierta ? Number(factura.due_amount?.value ?? total) : 0;
  const pagadoPayPal = factura.payments?.paid_amount ? Number(factura.payments.paid_amount.value) : null;
  const cobrado = pagadoPayPal ?? (PAGADAS.has(factura.status) ? total : abierta ? total - pendiente : 0);
  const vence = factura.detail?.payment_term?.due_date ?? null;
  // "Vencida" no es un estado de PayPal: es una factura abierta con la fecha pasada.
  const vencida = abierta && vence !== null && vence < hoy;
  const nombre = factura.primary_recipients?.[0]?.billing_info?.name;

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
    pagos: factura.transacciones ?? [],
    enlace: factura.fijos?.enlace ?? null,
    texto_original: extras?.texto_original ?? null,
    recordatorios: extras?.recordatorios ?? [],
  };
}

export async function cargarFilas() {
  const [facturas, extras] = await Promise.all([listarFacturas(), store.leerTodos()]);
  const hoy = hoyEcuador();
  return { hoy, filas: facturas.map((f) => aFila(f, extras[f.id], hoy)) };
}

export async function filaFresca(id) {
  const [factura, extras] = await Promise.all([obtenerFactura(id), store.leer(id)]);
  return aFila(conFijos(factura), extras, hoyEcuador());
}

export const esPagada = (fila) => PAGADAS.has(fila.estado);
