// Validación y normalización de un cobro.
// La IA propone, pero el servidor decide: todo lo que llega de la IA o del
// navegador pasa por aquí antes de tocar PayPal.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMERO_RE = /^COB-[A-Z0-9-]{4,21}$/;
const MONTO_MAX = 50000;

// Fecha de hoy en Ecuador (YYYY-MM-DD), para no depender de la zona del servidor.
export function hoyEcuador() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

// Número de factura propio y único: si el navegador reenvía la misma
// confirmación, PayPal rechaza el número repetido y no se crea un duplicado.
export function generarNumero() {
  const fecha = hoyEcuador().slice(2).replaceAll('-', '');
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `COB-${fecha}-${azar}`;
}

function texto(valor, max) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim().replace(/\s+/g, ' ');
  return limpio ? limpio.slice(0, max) : null;
}

function numero(valor) {
  const n = typeof valor === 'string' ? Number(valor.replace(',', '.')) : valor;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// Devuelve { cobro, errores }. `errores` es una lista de mensajes para el usuario;
// si está vacía, el cobro se puede crear.
export function normalizarCobro(entrada = {}) {
  const errores = [];

  const nombre = texto(entrada.cliente_nombre, 120);
  if (!nombre) errores.push('Falta el nombre del cliente.');

  let email = texto(entrada.cliente_email, 254);
  if (email && !EMAIL_RE.test(email)) {
    errores.push('El correo del cliente no parece válido.');
  }
  email = email ? email.toLowerCase() : null;

  const concepto = texto(entrada.concepto, 200);
  if (!concepto) errores.push('Falta el concepto (qué estás cobrando).');

  let monto = numero(entrada.monto);
  if (monto === null || monto <= 0) {
    errores.push('Falta el monto o no es mayor que cero.');
    monto = null;
  } else if (monto > MONTO_MAX) {
    errores.push(`El monto supera el máximo permitido de $${MONTO_MAX.toLocaleString('en-US')}.`);
  } else {
    monto = Math.round(monto * 100) / 100;
  }

  // 0 o 100 equivalen a "sin anticipo": se paga el total de una vez.
  let anticipo = numero(entrada.anticipo_pct);
  if (anticipo !== null && (anticipo < 0 || anticipo > 100)) {
    errores.push('El anticipo debe estar entre 0% y 100%.');
  }
  if (anticipo === null || anticipo <= 0 || anticipo >= 100) anticipo = null;
  else anticipo = Math.round(anticipo);

  let vence = texto(entrada.fecha_vencimiento, 10);
  if (vence && (!FECHA_RE.test(vence) || Number.isNaN(Date.parse(vence)))) {
    errores.push('La fecha de vencimiento no es válida.');
    vence = null;
  } else if (vence && vence < hoyEcuador()) {
    errores.push('La fecha de vencimiento ya pasó.');
  }

  const nota = texto(entrada.nota_cliente, 500);

  const cobro = {
    cliente_nombre: nombre,
    cliente_email: email,
    concepto,
    monto,
    moneda: 'USD',
    anticipo_pct: anticipo,
    anticipo_monto: anticipo && monto ? Math.round(monto * anticipo) / 100 : null,
    fecha_vencimiento: vence,
    nota_cliente: nota,
  };

  return { cobro, errores };
}

export function numeroValido(valor) {
  return typeof valor === 'string' && NUMERO_RE.test(valor);
}
