// Flujo de tres pasos: instrucción -> revisión -> factura.
// Todo el texto que viene del servidor o de la IA se pinta con textContent,
// nunca con innerHTML, para no inyectar HTML.

import { PAGADAS, api, dinero, fechaDeHoy, formatearFecha, hora, nombreEstado } from './formato.js';
import { alCambiarIdioma, cambiarIdioma, t, traducirDocumento } from './i18n.js';
import { iniciarPanel } from './panel.js';

const $ = (selector) => document.querySelector(selector);

const estado = { texto: '', numero: null, factura: null, cliente: '' };

traducirDocumento();

/* Navegación entre pantallas (#nuevo, #cobros) */

const panel = iniciarPanel();

function mostrarPantalla() {
  const pantalla = location.hash === '#cobros' ? 'cobros' : 'nuevo';
  $('#pantalla-nuevo').hidden = pantalla !== 'nuevo';
  $('#pantalla-cobros').hidden = pantalla !== 'cobros';
  for (const a of document.querySelectorAll('.navegacion a')) {
    if (a.dataset.pantalla === pantalla) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (pantalla === 'cobros') panel.cargar();
}

window.addEventListener('hashchange', mostrarPantalla);

function irA(paso) {
  for (const n of [1, 2, 3]) {
    $(`#vista-${n}`).hidden = n !== paso;
    const li = $(`.paso[data-paso="${n}"]`);
    li.classList.toggle('activo', n === paso);
    li.classList.toggle('hecho', n < paso);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Muestra un texto de espera en el botón; con null vuelve a su texto (en el
// idioma actual, por si cambió mientras tanto).
function ocupado(boton, texto) {
  boton.disabled = Boolean(texto);
  boton.textContent = texto || t(boton.dataset.i18n);
}

function mostrarErrores(destino, mensajes) {
  destino.replaceChildren(...mensajes.map((m) => Object.assign(document.createElement('li'), { textContent: m })));
  destino.hidden = mensajes.length === 0;
}

/* 01 · Instrucción */

for (const ejemplo of document.querySelectorAll('.ejemplo')) {
  ejemplo.addEventListener('click', () => {
    $('#texto').value = ejemplo.textContent.trim();
    $('#texto').focus();
  });
}

$('#texto').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#form-instruccion').requestSubmit();
});

$('#form-instruccion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = $('#texto').value.trim();
  const error = $('#error-1');
  error.hidden = true;
  if (!texto) {
    error.textContent = t('v1.vacio');
    error.hidden = false;
    return;
  }

  const boton = $('#boton-interpretar');
  ocupado(boton, t('v1.ocupado'));
  try {
    const datos = await api('POST', '/api/cobros/interpretar', { texto });
    estado.texto = texto;
    estado.numero = datos.numero;
    rellenarRevision(datos);
    irA(2);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    ocupado(boton, null);
  }
});

/* 02 · Revisión */

const CAMPOS = ['cliente_nombre', 'cliente_email', 'concepto', 'monto', 'anticipo_pct', 'fecha_vencimiento', 'nota_cliente'];

function rellenarRevision({ cobro, advertencias, errores }) {
  const form = $('#form-cobro');
  for (const campo of CAMPOS) form.elements[campo].value = cobro[campo] ?? '';

  $('#texto-original').textContent = `“${estado.texto}”`;

  const notas = $('#lista-notas');
  notas.replaceChildren(...advertencias.map((a) => Object.assign(document.createElement('li'), { textContent: a })));
  $('#notas-ia').hidden = advertencias.length === 0;

  mostrarErrores($('#errores-2'), errores);
  marcarInvalidos();
  actualizarResumen();
}

function leerFormulario() {
  const form = $('#form-cobro');
  const valor = (campo) => form.elements[campo].value.trim() || null;
  return Object.fromEntries(CAMPOS.map((campo) => [campo, valor(campo)]));
}

function marcarInvalidos() {
  const c = leerFormulario();
  const monto = Number(String(c.monto ?? '').replace(',', '.'));
  $('#f-nombre').setAttribute('aria-invalid', String(!c.cliente_nombre));
  $('#f-concepto').setAttribute('aria-invalid', String(!c.concepto));
  $('#f-monto').setAttribute('aria-invalid', String(!(monto > 0)));
}

// Frase que resume lo que va a pasar, para confirmar leyendo, no revisando campos.
// Es solo una vista previa: el servidor vuelve a calcular y validar todo.
function actualizarResumen() {
  const c = leerFormulario();
  const monto = Number(String(c.monto ?? '').replace(',', '.'));
  const resumen = $('#resumen');

  if (!c.cliente_nombre || !(monto > 0)) {
    resumen.textContent = t('v2.incompleto');
    return;
  }

  const fuerte = (texto) => Object.assign(document.createElement('strong'), { textContent: texto });
  const partes = t('v2.resumen', { numero: fuerte(estado.numero), monto: fuerte(dinero(monto)), cliente: fuerte(c.cliente_nombre) });

  const pct = Number(c.anticipo_pct);
  if (pct > 0 && pct < 100) {
    partes.push(...t('v2.resumen.anticipo', { minimo: fuerte(`${dinero(Math.round(monto * pct) / 100)} (${pct}%)`) }));
  }
  partes.push(c.fecha_vencimiento ? t('v2.resumen.vence', { fecha: formatearFecha(c.fecha_vencimiento) }) : t('v2.resumen.al_recibir'));
  partes.push(c.cliente_email ? t('v2.resumen.correo', { email: c.cliente_email }) : t('v2.resumen.sin_correo'));

  resumen.replaceChildren(...partes);
}

$('#form-cobro').addEventListener('input', () => {
  marcarInvalidos();
  actualizarResumen();
});

$('#boton-volver').addEventListener('click', () => {
  irA(1);
  $('#texto').focus();
});

$('#boton-crear').addEventListener('click', async () => {
  const boton = $('#boton-crear');
  mostrarErrores($('#errores-2'), []);
  ocupado(boton, t('v2.creando'));
  try {
    const cobro = leerFormulario();
    const factura = await api('POST', '/api/cobros', { cobro, numero: estado.numero, texto_original: estado.texto });
    estado.factura = factura;
    estado.cliente = cobro.cliente_nombre;
    pintarFactura(factura);
    irA(3);
  } catch (err) {
    mostrarErrores($('#errores-2'), err.errores?.length ? err.errores : [err.message]);
  } finally {
    ocupado(boton, null);
  }
});

/* 03 · Factura */

function pintarFactura(f) {
  $('#r-numero').textContent = f.numero;
  $('#r-cliente').textContent = estado.cliente;

  const etiqueta = document.createElement('span');
  etiqueta.className = `estado ${PAGADAS.has(f.estado) ? 'estado--pagada' : 'estado--pendiente'}`;
  etiqueta.textContent = nombreEstado(f.estado);
  $('#r-estado').replaceChildren(etiqueta);

  $('#r-total').textContent = f.total ? dinero(Number(f.total)) : '—';
  $('#r-pendiente').textContent = dinero(f.pendiente ? Number(f.pendiente) : 0);
  $('#r-vence').textContent = formatearFecha(f.vence) ?? t('v3.al_recibir');

  const enlace = $('#r-enlace');
  enlace.hidden = !f.enlace;
  if (f.enlace) enlace.href = f.enlace;
  $('#boton-copiar').hidden = !f.enlace;
}

$('#boton-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(estado.factura.enlace);
    $('#aviso-3').textContent = t('v3.copiado');
  } catch {
    $('#aviso-3').textContent = estado.factura.enlace;
  }
});

$('#boton-estado').addEventListener('click', async () => {
  const boton = $('#boton-estado');
  ocupado(boton, t('v3.consultando'));
  try {
    const factura = await api('GET', `/api/cobros/${encodeURIComponent(estado.factura.id)}`);
    estado.factura = factura;
    pintarFactura(factura);
    $('#aviso-3').textContent = t('v3.consultado', { hora: hora() });
  } catch (err) {
    $('#aviso-3').textContent = err.message;
  } finally {
    ocupado(boton, null);
  }
});

function reiniciarFlujo() {
  $('#texto').value = '';
  $('#aviso-3').textContent = '';
  irA(1);
  $('#texto').focus();
}

$('#boton-nuevo').addEventListener('click', reiniciarFlujo);

// "Nuevo cobro" en la cabecera también vuelve al paso 1 si ya se emitió una factura.
$('.navegacion a[data-pantalla="nuevo"]').addEventListener('click', () => {
  if (!$('#vista-3').hidden) setTimeout(reiniciarFlujo);
});

/* Idioma */

for (const boton of document.querySelectorAll('[data-idioma]')) {
  boton.addEventListener('click', () => cambiarIdioma(boton.dataset.idioma));
}

// Lo ya pintado con textos dinámicos se vuelve a pintar en el idioma nuevo.
alCambiarIdioma(() => {
  $('#fecha-hoy').textContent = fechaDeHoy();
  if (!$('#vista-2').hidden) actualizarResumen();
  if (!$('#vista-3').hidden && estado.factura) pintarFactura(estado.factura);
});

/* Inicio */

$('#fecha-hoy').textContent = fechaDeHoy();
irA(1);
mostrarPantalla();
