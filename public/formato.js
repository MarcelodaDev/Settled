// Formatos y utilidades compartidas entre el flujo de cobro y el panel.
// Montos y fechas siguen el idioma elegido: $1,200.00 en inglés, $1.200,00 en español.

import { idiomaActual, locale, t } from './i18n.js';

const formatos = new Map();

// Intl es costoso de crear: un formateador por idioma y tipo, reutilizado.
function formateador(tipo, crear) {
  const clave = `${tipo}:${locale()}`;
  if (!formatos.has(clave)) formatos.set(clave, crear(locale()));
  return formatos.get(clave);
}

export function dinero(monto) {
  return formateador('usd', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD' })).format(monto);
}

const comoFecha = (iso) => new Date(`${iso}T00:00:00Z`);

export function formatearFecha(iso) {
  if (!iso) return null;
  return formateador('larga', (l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })).format(comoFecha(iso));
}

export function fechaBreve(iso) {
  if (!iso) return null;
  return formateador('corta', (l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', timeZone: 'UTC' }))
    .format(comoFecha(iso)).replace('.', '');
}

export function hora() {
  return new Date().toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
}

export function fechaDeHoy() {
  return new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

// "today" / "hoy", "yesterday" / "ayer", "3 days ago" / "hace 3 días"…
export function fechaRelativa(iso) {
  const dias = Math.round((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  if (dias < 1) return t('hoy');
  return formateador('relativa', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'auto' })).format(-dias, 'day');
}

export const nombreEstado = (codigo) => {
  const texto = t(`estado.${codigo}`);
  return texto === `estado.${codigo}` ? codigo : texto;
};

export const PAGADAS = new Set(['PAID', 'MARKED_AS_PAID']);

export function el(etiqueta, clase, texto) {
  const nodo = document.createElement(etiqueta);
  if (clase) nodo.className = clase;
  if (texto !== undefined && texto !== null) nodo.textContent = texto;
  return nodo;
}

// Todas las llamadas al servidor llevan el idioma, para que errores y
// respuestas lleguen en el idioma de la interfaz.
export async function api(metodo, ruta, cuerpo) {
  const cabeceras = { 'X-Idioma': idiomaActual() };
  if (cuerpo) cabeceras['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(ruta, { method: metodo, headers: cabeceras, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch {
    // Sin respuesta del servidor (caído, redesplegando o sin internet): el
    // navegador lanzaría "Failed to fetch", que no le dice nada al usuario.
    throw new Error(t('error.red'));
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Un 502/503 sin JSON es la página de error de Render (despliegue o arranque).
    const sinServidor = !datos.error && res.status >= 502;
    const error = new Error(datos.error || t(sinServidor ? 'error.red' : 'error.generico'));
    error.errores = datos.errores;
    throw error;
  }
  return datos;
}
