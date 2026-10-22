// Panel lateral de una factura: detalle y recordatorio redactado por la IA.
// El freelancer revisa y edita el texto, y lo envía por su propio canal.

import { api, dinero, el, fechaRelativa, formatearFecha, nombreEstado } from './formato.js';
import { idiomaActual, t } from './i18n.js';

const $ = (selector) => document.querySelector(selector);

let fila = null;
let tono = 'amable';
// El recordatorio lo lee el cliente: su idioma se elige aparte del de la interfaz.
let idiomaMensaje = idiomaActual();
let alCambiar = () => {};
let origenFoco = null;

// Misma regla que el servidor; aquí solo sirve para marcar la sugerencia.
function tonoSugerido(f) {
  if (f.dias_atraso <= 0) return 'amable';
  if (f.dias_atraso <= 14) return 'firme';
  return 'final';
}

function aviso(texto) {
  $('#d-aviso').textContent = texto;
}

function pintarTonos(sugerido) {
  for (const boton of document.querySelectorAll('.tono[data-tono]')) {
    const valor = boton.dataset.tono;
    boton.setAttribute('aria-checked', String(valor === tono));
    boton.querySelector('.tono__sugerido').hidden = valor !== sugerido;
  }
}

function pintarIdiomaMensaje() {
  for (const boton of document.querySelectorAll('[data-idioma-mensaje]')) {
    boton.setAttribute('aria-checked', String(boton.dataset.idiomaMensaje === idiomaMensaje));
  }
}

function pintarHistorial() {
  const lista = $('#d-historial');
  const items = [...fila.recordatorios].reverse().map((r) =>
    el('li', null, `${t(`tono.${r.tono}`)} · ${t(`canal.${r.canal}`)} · ${fechaRelativa(r.fecha)}`));
  lista.replaceChildren(...items);
  $('#d-historial-bloque').hidden = items.length === 0;
}

function pintarEnlacesEnvio() {
  const asunto = $('#d-asunto').value;
  const mensaje = $('#d-mensaje').value;
  $('#d-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  const correo = $('#d-correo');
  correo.hidden = !fila.email;
  if (fila.email) {
    correo.href = `mailto:${encodeURIComponent(fila.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
  }
}

// Datos de la factura: se pueden volver a pintar sin tocar el borrador.
function pintarDatos() {
  $('#d-numero').textContent = fila.numero;
  $('#d-cliente').textContent = fila.cliente;
  $('#d-concepto').textContent = fila.concepto ?? '';

  $('#d-estado').textContent = fila.vencida ? t('vencida_hace', { n: fila.dias_atraso }) : nombreEstado(fila.estado);
  $('#d-estado').className = fila.vencida ? 'texto-vencido' : '';
  $('#d-total').textContent = dinero(fila.total);
  $('#d-cobrado').textContent = dinero(fila.cobrado);
  $('#d-pendiente').textContent = dinero(fila.pendiente);
  $('#d-vence').textContent = formatearFecha(fila.vence) ?? t('v3.al_recibir');
  $('#d-email').textContent = fila.email ?? t('detalle.sin_correo');

  $('#d-original').hidden = !fila.texto_original;
  $('#d-original-texto').textContent = fila.texto_original ? `“${fila.texto_original}”` : '';

  const conSaldo = fila.pendiente > 0;
  $('#d-recordatorio').hidden = !conSaldo;
  $('#d-sin-saldo').hidden = conSaldo;
  pintarHistorial();
}

function pintar() {
  pintarDatos();
  $('#d-borrador').hidden = true;
  $('#d-redactar').textContent = t('detalle.redactar');
  aviso('');
  tono = tonoSugerido(fila);
  idiomaMensaje = idiomaActual();
  pintarTonos(tono);
  pintarIdiomaMensaje();
}

export function abrirDetalle(datos, { onCambio } = {}) {
  fila = datos;
  alCambiar = onCambio ?? (() => {});
  origenFoco = document.activeElement;
  pintar();
  $('#detalle').hidden = false;
  $('#velo').hidden = false;
  document.body.classList.add('con-detalle');
  $('#d-cerrar').focus();
}

// Al cambiar el idioma de la interfaz con el panel abierto: se traducen los
// datos y botones, pero el borrador (ya escrito) se respeta.
export function retraducirDetalle() {
  if (!fila || $('#detalle').hidden) return;
  pintarDatos();
  $('#d-redactar').textContent = t($('#d-borrador').hidden ? 'detalle.redactar' : 'detalle.redactar_otra');
}

function cerrar() {
  $('#detalle').hidden = true;
  $('#velo').hidden = true;
  document.body.classList.remove('con-detalle');
  origenFoco?.focus?.();
}

async function redactar() {
  const boton = $('#d-redactar');
  boton.disabled = true;
  boton.textContent = t('detalle.redactando');
  aviso('');
  try {
    const datos = await api('POST', `/api/cobros/${encodeURIComponent(fila.id)}/recordatorio`, { tono, idioma_mensaje: idiomaMensaje });
    $('#d-asunto').value = datos.asunto;
    $('#d-mensaje').value = datos.mensaje;
    pintarTonos(datos.sugerido);
    pintarEnlacesEnvio();
    $('#d-borrador').hidden = false;
    boton.textContent = t('detalle.redactar_otra');
  } catch (err) {
    aviso(err.message || t('detalle.error_redactar'));
    boton.textContent = t('detalle.redactar');
  } finally {
    boton.disabled = false;
  }
}

// Se registra cuando el freelancer usa un canal; el envío lo hace él.
async function registrar(canal) {
  try {
    const datos = await api('POST', `/api/cobros/${encodeURIComponent(fila.id)}/recordatorios`, { tono, canal });
    fila = { ...fila, recordatorios: datos.recordatorios };
    pintarHistorial();
    alCambiar(fila);
  } catch {
    aviso(t('detalle.no_historial'));
  }
}

export function iniciarDetalle() {
  $('#d-cerrar').addEventListener('click', cerrar);
  $('#velo').addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#detalle').hidden) cerrar();
  });

  for (const boton of document.querySelectorAll('.tono[data-tono]')) {
    boton.addEventListener('click', () => {
      tono = boton.dataset.tono;
      for (const otro of document.querySelectorAll('.tono[data-tono]')) otro.setAttribute('aria-checked', String(otro === boton));
    });
  }
  for (const boton of document.querySelectorAll('[data-idioma-mensaje]')) {
    boton.addEventListener('click', () => {
      idiomaMensaje = boton.dataset.idiomaMensaje;
      pintarIdiomaMensaje();
    });
  }

  $('#d-redactar').addEventListener('click', redactar);
  $('#d-asunto').addEventListener('input', pintarEnlacesEnvio);
  $('#d-mensaje').addEventListener('input', pintarEnlacesEnvio);

  $('#d-copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#d-mensaje').value);
      aviso(t('detalle.copiado'));
      registrar('copiar');
    } catch {
      aviso(t('detalle.no_copiado'));
    }
  });
  $('#d-whatsapp').addEventListener('click', () => registrar('whatsapp'));
  $('#d-correo').addEventListener('click', () => registrar('correo'));
}
