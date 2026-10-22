// Reglas del recordatorio. El tono lo decide el código según el atraso, para que
// sea predecible; la IA solo redacta dentro del tono que se le indica.

export const TONOS = {
  amable: 'Amable: un recordatorio cordial, sin presión. La factura aún no vence o vence pronto.',
  firme: 'Firme: cortés pero directo. La factura ya venció; pide el pago con una fecha concreta.',
  final: 'Último aviso: serio y profesional, sin amenazas ni lenguaje legal. Pide resolver el pago o responder para acordar una solución.',
};

export const MARCA_ENLACE = '{{enlace}}';

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const fechaLarga = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const DIA = 24 * 60 * 60 * 1000;

const fecha = (iso) => fechaLarga.format(new Date(`${iso}T00:00:00Z`));
const dias = (n) => (n === 1 ? '1 día' : `${n} días`);

// La situación del plazo se redacta aquí, ya calculada, para que la IA no
// tenga que deducir fechas ni atrasos (y no pueda inventarlos).
export function describirPlazo(fila, hoy) {
  if (!fila.vence) return 'La factura no tiene fecha de vencimiento: se paga al recibirla.';
  if (fila.vencida) return `La factura venció el ${fecha(fila.vence)}; lleva ${dias(fila.dias_atraso)} de atraso.`;
  const faltan = Math.round((Date.parse(fila.vence) - Date.parse(hoy)) / DIA);
  if (faltan === 0) return `La factura vence hoy, ${fecha(fila.vence)}.`;
  return `La factura vence el ${fecha(fila.vence)}, dentro de ${dias(faltan)}. Todavía no está vencida.`;
}

export const formatearMonto = (valor) => usd.format(valor);

export function tonoSugerido(diasAtraso) {
  if (diasAtraso <= 0) return 'amable';
  if (diasAtraso <= 14) return 'firme';
  return 'final';
}

// La IA escribe {{enlace}} en lugar de la URL; aquí se pone el enlace real.
// Si la IA no incluyó la marca, el enlace se añade al final.
export function insertarEnlace(mensaje, enlace) {
  if (!enlace) return mensaje.replaceAll(MARCA_ENLACE, '').trim();
  // El enlace va siempre en su propia línea: un punto pegado detrás rompe la
  // URL en algunos clientes de correo y en WhatsApp.
  const conEnlace = mensaje.includes(MARCA_ENLACE)
    ? mensaje.replace(/[ \t]*\{\{enlace\}\}[.,;:]?[ \t]*/g, `\n${enlace}\n`)
    : `${mensaje.trim()}\n\n${enlace}`;
  return conEnlace.replace(/\n{3,}/g, '\n\n').trim();
}
