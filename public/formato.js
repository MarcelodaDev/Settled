// Formatos y textos compartidos entre el flujo de cobro y el panel.

export const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });

const fechaLarga = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fechaCorta = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function formatearFecha(iso) {
  return iso ? fechaLarga.format(new Date(`${iso}T00:00:00Z`)) : null;
}

export function fechaBreve(iso) {
  return iso ? fechaCorta.format(new Date(`${iso}T00:00:00Z`)).replace('.', '') : null;
}

const relativa = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

// "hoy", "ayer", "hace 3 días"…
export function fechaRelativa(iso) {
  const dias = Math.round((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  return dias < 1 ? 'hoy' : relativa.format(-dias, 'day');
}

export const ESTADOS = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  SENT: 'Enviada, por cobrar',
  UNPAID: 'Por cobrar',
  PARTIALLY_PAID: 'Anticipo recibido',
  PAYMENT_PENDING: 'Pago en proceso',
  PAID: 'Pagada',
  MARKED_AS_PAID: 'Pagada (registrada a mano)',
  CANCELLED: 'Cancelada',
  AUTO_CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  MARKED_AS_REFUNDED: 'Reembolsada',
};

export const PAGADAS = new Set(['PAID', 'MARKED_AS_PAID']);

export function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = texto;
  return nodo;
}
