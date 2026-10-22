// Panel lateral de una factura: detalle y recordatorio redactado por la IA.
// El freelancer revisa y edita el texto, y lo envía por su propio canal.

import { ESTADOS, el, fechaRelativa, formatearFecha, usd } from './formato.js';

const $ = (selector) => document.querySelector(selector);

const NOMBRES_TONO = { amable: 'Amable', firme: 'Firme', final: 'Último aviso' };
const NOMBRES_CANAL = { copiar: 'copiado', whatsapp: 'WhatsApp', correo: 'correo' };

let fila = null;
let tono = 'amable';
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
  for (const boton of document.querySelectorAll('.tono')) {
    const valor = boton.dataset.tono;
    boton.setAttribute('aria-checked', String(valor === tono));
    boton.querySelector('.tono__sugerido').hidden = valor !== sugerido;
  }
}

function pintarHistorial() {
  const lista = $('#d-historial');
  const items = [...fila.recordatorios].reverse().map((r) =>
    el('li', null, `${NOMBRES_TONO[r.tono]} · ${NOMBRES_CANAL[r.canal]} · ${fechaRelativa(r.fecha)}`));
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

function pintar() {
  $('#d-numero').textContent = fila.numero;
  $('#d-cliente').textContent = fila.cliente;
  $('#d-concepto').textContent = fila.concepto ?? '';

  let estado = ESTADOS[fila.estado] ?? fila.estado;
  if (fila.vencida) estado = `Vencida hace ${fila.dias_atraso === 1 ? '1 día' : `${fila.dias_atraso} días`}`;
  $('#d-estado').textContent = estado;
  $('#d-estado').className = fila.vencida ? 'texto-vencido' : '';
  $('#d-total').textContent = usd.format(fila.total);
  $('#d-cobrado').textContent = usd.format(fila.cobrado);
  $('#d-pendiente').textContent = usd.format(fila.pendiente);
  $('#d-vence').textContent = formatearFecha(fila.vence) ?? 'Al recibirla';
  $('#d-email').textContent = fila.email ?? 'Sin correo';

  $('#d-original').hidden = !fila.texto_original;
  $('#d-original-texto').textContent = fila.texto_original ? `«${fila.texto_original}»` : '';

  const conSaldo = fila.pendiente > 0;
  $('#d-recordatorio').hidden = !conSaldo;
  $('#d-sin-saldo').hidden = conSaldo;

  $('#d-borrador').hidden = true;
  $('#d-redactar').textContent = 'Redactar con IA';
  aviso('');
  tono = tonoSugerido(fila);
  pintarTonos(tono);
  pintarHistorial();
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

function cerrar() {
  $('#detalle').hidden = true;
  $('#velo').hidden = true;
  document.body.classList.remove('con-detalle');
  origenFoco?.focus?.();
}

async function redactar() {
  const boton = $('#d-redactar');
  boton.disabled = true;
  boton.textContent = 'Redactando…';
  aviso('');
  try {
    const res = await fetch(`/api/cobros/${encodeURIComponent(fila.id)}/recordatorio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tono }),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error || 'No se pudo redactar el recordatorio.');
    $('#d-asunto').value = datos.asunto;
    $('#d-mensaje').value = datos.mensaje;
    pintarTonos(datos.sugerido);
    pintarEnlacesEnvio();
    $('#d-borrador').hidden = false;
    boton.textContent = 'Redactar otra vez';
  } catch (err) {
    aviso(err.message);
    boton.textContent = 'Redactar con IA';
  } finally {
    boton.disabled = false;
  }
}

// Se registra cuando el freelancer usa un canal; el envío lo hace él.
async function registrar(canal) {
  try {
    const res = await fetch(`/api/cobros/${encodeURIComponent(fila.id)}/recordatorios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tono, canal }),
    });
    const datos = await res.json();
    if (!res.ok) throw new Error(datos.error);
    fila = { ...fila, recordatorios: datos.recordatorios };
    pintarHistorial();
    alCambiar(fila);
  } catch {
    aviso('El recordatorio no quedó en el historial.');
  }
}

export function iniciarDetalle() {
  $('#d-cerrar').addEventListener('click', cerrar);
  $('#velo').addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#detalle').hidden) cerrar();
  });

  for (const boton of document.querySelectorAll('.tono')) {
    boton.addEventListener('click', () => {
      tono = boton.dataset.tono;
      for (const otro of document.querySelectorAll('.tono')) otro.setAttribute('aria-checked', String(otro === boton));
    });
  }

  $('#d-redactar').addEventListener('click', redactar);
  $('#d-asunto').addEventListener('input', pintarEnlacesEnvio);
  $('#d-mensaje').addEventListener('input', pintarEnlacesEnvio);

  $('#d-copiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#d-mensaje').value);
      aviso('Mensaje copiado. Pégalo donde hables con tu cliente.');
      registrar('copiar');
    } catch {
      aviso('No se pudo copiar. Selecciona el texto y cópialo a mano.');
    }
  });
  $('#d-whatsapp').addEventListener('click', () => registrar('whatsapp'));
  $('#d-correo').addEventListener('click', () => registrar('correo'));
}
