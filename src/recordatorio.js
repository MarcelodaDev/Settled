// Reglas del recordatorio. El tono lo decide el código según el atraso, para que
// sea predecible; la IA solo redacta dentro del tono que se le indica.

import { locale } from './i18n.js';

export const TONOS = {
  amable: 'Amable: un recordatorio cordial, sin presión. La factura aún no vence o vence pronto.',
  firme: 'Firme: cortés pero directo. La factura ya venció; pide el pago con una fecha concreta.',
  final: 'Último aviso: serio y profesional, sin amenazas ni lenguaje legal. Pide resolver el pago o responder para acordar una solución.',
};

export const MARCA_ENLACE = '{{enlace}}';

const DIA = 24 * 60 * 60 * 1000;

const fecha = (iso, idioma) => new Intl.DateTimeFormat(locale(idioma), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${iso}T00:00:00Z`));

// La situación del plazo se redacta aquí, ya calculada, para que la IA no
// tenga que deducir fechas ni atrasos (y no pueda inventarlos). Va en el
// idioma del mensaje para que la IA la copie tal cual, sin traducir fechas.
const PLAZOS = {
  es: {
    dias: (n) => (n === 1 ? '1 día' : `${n} días`),
    sinFecha: () => 'La factura no tiene fecha de vencimiento: se paga al recibirla.',
    vencida: (f, n) => `La factura venció el ${f}; lleva ${PLAZOS.es.dias(n)} de atraso.`,
    hoy: (f) => `La factura vence hoy, ${f}.`,
    faltan: (f, n) => `La factura vence el ${f}, dentro de ${PLAZOS.es.dias(n)}. Todavía no está vencida.`,
  },
  en: {
    dias: (n) => (n === 1 ? '1 day' : `${n} days`),
    sinFecha: () => 'The invoice has no due date: it is payable on receipt.',
    vencida: (f, n) => `The invoice was due on ${f}; it is ${PLAZOS.en.dias(n)} overdue.`,
    hoy: (f) => `The invoice is due today, ${f}.`,
    faltan: (f, n) => `The invoice is due on ${f}, in ${PLAZOS.en.dias(n)}. It is not overdue yet.`,
  },
};

export function describirPlazo(fila, hoy, idioma = 'en') {
  const textos = PLAZOS[idioma] ?? PLAZOS.en;
  if (!fila.vence) return textos.sinFecha();
  const f = fecha(fila.vence, idioma);
  if (fila.vencida) return textos.vencida(f, fila.dias_atraso);
  const faltan = Math.round((Date.parse(fila.vence) - Date.parse(hoy)) / DIA);
  return faltan === 0 ? textos.hoy(f) : textos.faltan(f, faltan);
}

export const formatearMonto = (valor, idioma = 'en') =>
  new Intl.NumberFormat(locale(idioma), { style: 'currency', currency: 'USD' }).format(valor);

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
