// Ayuda para poner precio, dentro de la revisión del cobro.
// La IA desglosa el trabajo en tareas y horas; el freelancer pone su tarifa y
// ajusta las horas; el total (horas × tarifa) lo calcula este código.

import { api, dinero, el, fechaBreve } from './formato.js';
import { alCambiarIdioma, t } from './i18n.js';

const $ = (selector) => document.querySelector(selector);
const CLAVE_TARIFA = 'settled.tarifa';

let estimacion = null; // { tareas, supuestos, historial }
let obtenerDatos = () => ({});
let alUsar = () => {};

const numero = (valor) => {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function leerTarifa() {
  try {
    return localStorage.getItem(CLAVE_TARIFA) ?? '';
  } catch {
    return '';
  }
}

function guardarTarifa(valor) {
  try {
    localStorage.setItem(CLAVE_TARIFA, valor);
  } catch {
    // sin almacenamiento: la tarifa vale solo para esta visita
  }
}

// Horas que el usuario dejó en cada fila (puede haberlas corregido).
function horasActuales() {
  return [...document.querySelectorAll('.precio__horas')].map((input) => numero(input.value));
}

function total() {
  const horas = horasActuales().reduce((a, b) => a + b, 0);
  const tarifa = numero($('#precio-tarifa').value);
  return { horas, tarifa, monto: Math.round(horas * tarifa * 100) / 100 };
}

function pintarTotal() {
  const { horas, tarifa, monto } = total();
  $('#precio-total-horas').textContent = t('precio.h', { n: horas });
  const destino = $('#precio-total');
  if (!tarifa) {
    destino.textContent = t('precio.falta_tarifa');
  } else {
    const fuerte = el('strong', null, dinero(monto));
    destino.replaceChildren(`${t('precio.h', { n: horas })} × ${dinero(tarifa)} = `, fuerte);
  }
  const usar = $('#precio-usar');
  usar.disabled = !(monto > 0);
  usar.textContent = monto > 0 ? t('precio.usar', { monto: dinero(monto) }) : t('precio.usar_sin_monto');
}

function pintarHistorial() {
  const h = estimacion?.historial;
  $('#precio-historial').hidden = !h;
  if (!h) return;
  $('#precio-historial-lista').replaceChildren(...h.facturas.map((f) => {
    const li = el('li');
    li.append(
      el('span', 'precio__lista-concepto', `${f.cliente} · ${f.concepto}`),
      el('span', 'precio__lista-dato cifra', `${dinero(f.total)} · ${fechaBreve(f.emitida) ?? ''}`),
    );
    return li;
  }));
  const rango = h.minimo === h.maximo ? dinero(h.promedio) : t('precio.rango', { min: dinero(h.minimo), max: dinero(h.maximo) });
  $('#precio-promedio').textContent = t('precio.promedio', { n: h.facturas.length, rango });
  $('#precio-usar-historial').textContent = t('precio.usar', { monto: dinero(h.promedio) });
}

function pintarEstimacion() {
  const filas = estimacion.tareas.map((tarea, i) => {
    const tr = el('tr');
    const nombre = el('td', null, tarea.tarea);
    const celda = el('td', 'cifra');
    const input = el('input', 'precio__horas cifra');
    Object.assign(input, { type: 'number', min: '0', step: '0.5', value: String(tarea.horas), inputMode: 'decimal' });
    input.setAttribute('aria-label', t('precio.horas_de', { tarea: tarea.tarea }));
    input.addEventListener('input', pintarTotal);
    input.dataset.indice = i;
    celda.append(input);
    tr.append(nombre, celda);
    return tr;
  });
  $('#precio-tareas').replaceChildren(...filas);
  $('#precio-supuestos').replaceChildren(...estimacion.supuestos.map((s) => el('li', null, s)));
  pintarHistorial();
  pintarTotal();
  $('#precio-resultado').hidden = false;
}

async function estimar() {
  const aviso = $('#precio-aviso');
  const rehacer = $('#precio-rehacer');
  aviso.textContent = t('precio.estimando');
  $('#precio-resultado').hidden = true;
  rehacer.disabled = true;
  try {
    estimacion = await api('POST', '/api/cobros/estimar', obtenerDatos());
    aviso.textContent = '';
    pintarEstimacion();
  } catch (err) {
    aviso.textContent = err.message;
  } finally {
    rehacer.disabled = false;
  }
}

function pintarBotonAbrir(sinMonto) {
  const boton = $('#precio-abrir');
  const abierto = !$('#precio-cuerpo').hidden;
  boton.textContent = t(abierto ? 'precio.cerrar' : (sinMonto ? 'precio.abrir_sin_monto' : 'precio.abrir'));
  boton.setAttribute('aria-expanded', String(abierto));
}

// Se llama cada vez que se rellena la revisión con una propuesta nueva.
export function reiniciarPrecio({ sinMonto }) {
  estimacion = null;
  $('#precio-cuerpo').hidden = true;
  $('#precio-resultado').hidden = true;
  $('#precio-aviso').textContent = '';
  $('#precio').dataset.sinMonto = sinMonto ? '1' : '';
  pintarBotonAbrir(sinMonto);
}

export function iniciarPrecio({ datos, usar }) {
  obtenerDatos = datos;
  alUsar = usar;

  $('#precio-tarifa').value = leerTarifa();
  $('#precio-tarifa').addEventListener('input', (e) => {
    guardarTarifa(e.target.value.trim());
    pintarTotal();
  });

  $('#precio-abrir').addEventListener('click', () => {
    const cuerpo = $('#precio-cuerpo');
    cuerpo.hidden = !cuerpo.hidden;
    pintarBotonAbrir(Boolean($('#precio').dataset.sinMonto));
    if (!cuerpo.hidden && !estimacion) estimar();
  });
  $('#precio-rehacer').addEventListener('click', estimar);
  $('#precio-usar').addEventListener('click', () => {
    const { monto } = total();
    if (monto > 0) alUsar(monto);
  });
  $('#precio-usar-historial').addEventListener('click', () => {
    if (estimacion?.historial) alUsar(estimacion.historial.promedio);
  });

  alCambiarIdioma(() => {
    pintarBotonAbrir(Boolean($('#precio').dataset.sinMonto));
    if (estimacion) {
      pintarHistorial();
      pintarTotal();
    }
  });
}
