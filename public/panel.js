// Panel de cobros con AG Grid. Los datos vienen de GET /api/cobros, que los lee
// de PayPal en cada carga.

import { abrirDetalle, iniciarDetalle, retraducirDetalle } from './detalle.js';
import { PAGADAS, api as llamar, dinero, el, fechaBreve, fechaRelativa, hora, nombreEstado } from './formato.js';
import { alCambiarIdioma, t } from './i18n.js';

const { createGrid, themeQuartz } = window.agGrid;

const $ = (selector) => document.querySelector(selector);

// Tema propio sobre Quartz: mismo papel, tinta y filetes que el resto de la app.
const tema = themeQuartz.withParams({
  fontFamily: "'Instrument Sans', system-ui, sans-serif",
  fontSize: 14,
  backgroundColor: '#f5f2ea',
  foregroundColor: '#16140f',
  chromeBackgroundColor: '#f5f2ea',
  headerBackgroundColor: '#f5f2ea',
  headerTextColor: '#6b665c',
  headerFontSize: 11,
  headerFontWeight: 500,
  headerHeight: 44,
  rowHeight: 60,
  borderColor: '#d6cfbf',
  borderRadius: 0,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
  columnBorder: false,
  headerColumnBorder: false,
  headerRowBorder: { width: 1, style: 'solid', color: '#16140f' },
  rowBorder: { width: 1, style: 'solid', color: '#d6cfbf' },
  oddRowBackgroundColor: '#f5f2ea',
  rowHoverColor: '#ede8dc',
  selectedRowBackgroundColor: '#e6dfcf',
  accentColor: '#16140f',
  cellHorizontalPadding: 14,
});

// Flechas de orden propias: trazo fino del mismo grosor que los filetes, en
// lugar del icono por defecto de AG Grid, que delata el tema estándar.
const flecha = (abajo) => `<svg class="icono-orden" width="9" height="11" viewBox="0 0 9 11" aria-hidden="true">`
  + `<path d="M4.5 ${abajo ? '1v8.5M1.5 6.5l3 3 3-3' : '10V1.5M1.5 4.5l3-3 3 3'}" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="square"/></svg>`;

const ICONOS = { sortAscending: flecha(false), sortDescending: flecha(true) };

let api = null;
let filtro = 'todas';
let idsRespuesta = null; // facturas de la última pregunta, o null si no hay pregunta activa
let filas = [];
let cargado = false; // hasta la primera respuesta de PayPal, las cifras muestran "—"

const FILTROS = {
  todas: () => true,
  abiertas: (f) => f.pendiente > 0,
  vencidas: (f) => f.vencida,
  pagadas: (f) => PAGADAS.has(f.estado),
};

/* Celdas: siempre con nodos DOM y textContent, nunca HTML. */

const esTotales = (p) => Boolean(p.node.rowPinned);

function celdaCliente(p) {
  // En la fila fija, AG Grid no siempre pasa valueFormatted en el primer pintado.
  if (esTotales(p)) return t('facturas', { n: p.data.cuenta });
  const caja = el('div', 'celda-doble');
  caja.append(el('span', 'celda-doble__principal', p.data.cliente), el('span', 'celda-doble__secundaria', p.data.concepto ?? '—'));
  return caja;
}

function celdaEstado(p) {
  if (esTotales(p)) return null;
  const f = p.data;
  const caja = el('div', 'celda-doble');
  let texto = nombreEstado(f.estado);
  let tono = 'abierta';
  if (f.vencida) {
    texto = t('vencida_hace', { n: f.dias_atraso });
    tono = 'vencida';
  } else if (PAGADAS.has(f.estado)) {
    tono = 'pagada';
  } else if (f.pendiente === 0) {
    tono = 'cerrada';
  }
  const ultimo = f.recordatorios?.at(-1);
  let secundaria = '';
  if (f.pendiente > 0) {
    if (ultimo) secundaria = t('tabla.recordado', { cuando: fechaRelativa(ultimo.fecha) });
    else secundaria = t(f.vista ? 'tabla.abierta_por_cliente' : 'tabla.sin_abrir');
  }
  caja.append(el('span', `estado estado--${tono}`, texto), el('span', 'celda-doble__secundaria', secundaria));
  return caja;
}

function celdaVence(p) {
  if (esTotales(p)) return null;
  return el('span', p.data.vencida ? 'texto-vencido' : '', fechaBreve(p.data.vence) ?? t('tabla.al_recibir'));
}

function celdaEnlace(p) {
  if (esTotales(p) || !p.data.enlace || p.data.pendiente === 0) return null;
  const a = el('a', 'enlace', t('tabla.pago'));
  a.href = p.data.enlace;
  a.target = '_blank';
  a.rel = 'noopener';
  a.title = t('tabla.pago.titulo');
  return a;
}

const monto = (p) => (p.value === null || p.value === undefined ? '' : dinero(p.value));

// `width` es el ancho preferido; el ajuste reparte el espacio real sin bajar de
// `minWidth`. Es una función porque los encabezados dependen del idioma.
const construirColumnas = () => [
  {
    field: 'numero',
    headerName: t('col.numero'),
    width: 160,
    minWidth: 156,
    cellClass: 'celda-cifra',
    valueFormatter: (p) => (esTotales(p) ? t('tabla.total') : p.value),
  },
  {
    field: 'cliente',
    headerName: t('col.cliente'),
    width: 280,
    minWidth: 115,
    cellRenderer: celdaCliente,
    valueFormatter: (p) => (esTotales(p) ? t('facturas', { n: p.data.cuenta }) : p.value),
    getQuickFilterText: (p) => [p.data.cliente, p.data.concepto, p.data.email, p.data.numero].filter(Boolean).join(' '),
  },
  { field: 'emitida', headerName: t('col.emitida'), width: 92, minWidth: 84, valueFormatter: (p) => fechaBreve(p.value) ?? '' },
  { field: 'vence', headerName: t('col.vence'), width: 92, minWidth: 84, cellRenderer: celdaVence },
  {
    field: 'estado',
    headerName: t('col.estado'),
    width: 180,
    minWidth: 140,
    cellRenderer: celdaEstado,
    // Ordenar por estado = primero lo más urgente.
    comparator: (_a, _b, nodoA, nodoB) => urgencia(nodoA.data) - urgencia(nodoB.data),
  },
  { field: 'total', headerName: t('col.total'), width: 110, minWidth: 96, type: 'rightAligned', cellClass: 'celda-cifra', valueFormatter: monto },
  { field: 'cobrado', headerName: t('col.cobrado'), width: 110, minWidth: 96, type: 'rightAligned', cellClass: 'celda-cifra', valueFormatter: monto },
  { field: 'pendiente', headerName: t('col.pendiente'), width: 110, minWidth: 88, type: 'rightAligned', cellClass: 'celda-cifra celda-pendiente', valueFormatter: monto },
  { colId: 'enlace', headerName: '', width: 76, minWidth: 70, sortable: false, cellRenderer: celdaEnlace },
];

let columnas = construirColumnas();

function urgencia(f) {
  if (!f) return 99;
  if (f.vencida) return -f.dias_atraso; // más atraso, más arriba
  if (f.pendiente > 0) return 1;
  if (PAGADAS.has(f.estado)) return 2;
  return 3;
}

/* Totales */

// La fila fija de abajo suma solo lo que se ve (filtro y búsqueda aplicados).
function actualizarTotales() {
  const suma = { id: 'totales', cuenta: 0, total: 0, cobrado: 0, pendiente: 0 };
  api.forEachNodeAfterFilter((nodo) => {
    suma.cuenta += 1;
    suma.total += nodo.data.total;
    suma.cobrado += nodo.data.cobrado;
    suma.pendiente += nodo.data.pendiente;
  });
  api.setGridOption('pinnedBottomRowData', suma.cuenta ? [suma] : []);
}

// Las cifras de cabecera resumen toda la cuenta, sin filtros.
function pintarCifras() {
  const suma = (lista, campo) => lista.reduce((t, f) => t + f[campo], 0);
  const abiertas = filas.filter(FILTROS.abiertas);
  const vencidas = filas.filter(FILTROS.vencidas);
  const pagadas = filas.filter((f) => f.cobrado > 0);

  const cifras = [
    [t('cifras.por_cobrar'), suma(abiertas, 'pendiente'), abiertas.length, ''],
    [t('cifras.vencido'), suma(vencidas, 'pendiente'), vencidas.length, vencidas.length ? 'cifra--alerta' : ''],
    [t('cifras.cobrado'), suma(pagadas, 'cobrado'), pagadas.length, ''],
  ];

  $('#cifras').replaceChildren(...cifras.map(([etiqueta, valor, cuenta, clase]) => {
    const bloque = el('div', `cifra-bloque ${clase} ${cargado ? '' : 'cifra-bloque--cargando'}`);
    bloque.append(
      el('span', 'cifra-bloque__etiqueta', etiqueta),
      el('span', 'cifra-bloque__valor', cargado ? dinero(valor) : '—'),
      el('span', 'cifra-bloque__cuenta', cargado ? t('facturas', { n: cuenta }) : ' '),
    );
    return bloque;
  }));

  for (const boton of document.querySelectorAll('.filtro')) {
    const n = filas.filter(FILTROS[boton.dataset.filtro]).length;
    boton.querySelector('.filtro__cuenta').textContent = n;
  }
}

/* Carga */

async function cargar() {
  const boton = $('#boton-actualizar');
  const aviso = $('#aviso-panel');
  boton.disabled = true;
  aviso.textContent = t('panel.consultando');
  // Sin datos todavía, la tabla muestra "cargando" en vez de "no hay cobros".
  if (!filas.length) api.setGridOption('loading', true);
  try {
    const datos = await llamar('GET', '/api/cobros');
    filas = datos.cobros;
    cargado = true;
    api.setGridOption('rowData', filas);
    pintarCifras();
    $('#error-panel').hidden = true;
    aviso.textContent = t('panel.actualizado', { hora: hora() });
  } catch (err) {
    // Un fallo no es lo mismo que "no hay facturas": se dice claramente y se
    // conservan las filas que ya se veían.
    $('#error-panel-texto').textContent = t('panel.error_carga', { motivo: err.message });
    $('#error-panel').hidden = false;
    aviso.textContent = '';
  } finally {
    api.setGridOption('loading', false);
    boton.disabled = false;
  }
}

// Si la tabla no cabe, se ocultan columnas secundarias (en este orden) en lugar
// de forzar scroll horizontal. Se decide con el ancho real de la tabla, no con
// media queries, para que funcione igual en cualquier contenedor.
const PRIORIDAD_OCULTAR = ['emitida', 'cobrado', 'total', 'numero', 'vence', 'enlace'];
const idColumna = (c) => c.colId ?? c.field;
let ocultasActuales = '';

function columnasOcultas(ancho) {
  let necesario = columnas.reduce((t, c) => t + c.minWidth, 0);
  const ocultas = new Set();
  for (const id of PRIORIDAD_OCULTAR) {
    if (necesario <= ancho) break;
    ocultas.add(id);
    necesario -= columnas.find((c) => idColumna(c) === id).minWidth;
  }
  return ocultas;
}

function ajustarColumnas(ancho) {
  if (ancho <= 0) return; // pantalla oculta: se ajustará al mostrarse
  const ocultas = columnasOcultas(ancho);
  const clave = [...ocultas].join();
  if (clave !== ocultasActuales) {
    ocultasActuales = clave;
    // applyOrder mantiene el orden original al volver a mostrar columnas.
    api.applyColumnState({ state: columnas.map((c) => ({ colId: idColumna(c), hide: ocultas.has(idColumna(c)) })), applyOrder: true });
  }
  api.sizeColumnsToFit();
}

/* Preguntas en lenguaje natural */

// Lo que entendió la IA, en palabras: así se ve que la respuesta no es una caja negra.
function describirConsulta(datos) {
  const c = datos.consulta;
  const partes = [t(`metrica.${c.metrica}`)];
  if (c.estado !== 'todas') partes.push(t(`filtro_estado.${c.estado}`));
  if (c.cliente) partes.push(t('panel.cliente', { cliente: c.cliente }));
  partes.push(datos.periodo?.texto ?? t('panel.todas_fechas'));
  return t('panel.entendi', { partes: partes.join(' · ') });
}

function marcarFiltro(valor) {
  filtro = valor;
  for (const boton of document.querySelectorAll('.filtro')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.filtro === valor));
  }
}

function quitarRespuesta({ refrescar = true } = {}) {
  idsRespuesta = null;
  $('#respuesta').hidden = true;
  if (refrescar) api.onFilterChanged();
}

async function preguntar(texto) {
  const pregunta = texto.trim();
  if (!pregunta) return;
  const boton = $('#boton-preguntar');
  const caja = $('#respuesta');
  boton.disabled = true;
  boton.textContent = t('panel.pensando');
  caja.classList.remove('respuesta--error');
  try {
    const datos = await llamar('POST', '/api/consultas', { pregunta });

    $('#respuesta-texto').textContent = datos.respuesta;
    const sobreCobros = datos.consulta?.sobre_cobros !== false;
    $('#respuesta-entendi').textContent = sobreCobros ? describirConsulta(datos) : '';
    $('#quitar-respuesta').hidden = !sobreCobros;
    caja.hidden = false;

    if (sobreCobros) {
      // La tabla muestra exactamente las facturas que sostienen la respuesta.
      marcarFiltro('todas');
      idsRespuesta = new Set(datos.ids);
      api.onFilterChanged();
    }
  } catch (err) {
    $('#respuesta-texto').textContent = err.message;
    $('#respuesta-entendi').textContent = '';
    $('#quitar-respuesta').hidden = true;
    caja.classList.add('respuesta--error');
    caja.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = t('panel.preguntar');
  }
}

// Encabezados, celdas, totales y cifras dependen del idioma: se rehacen.
// La respuesta a la última pregunta se descarta porque venía en el otro idioma.
function retraducirPanel() {
  columnas = construirColumnas();
  api.setGridOption('columnDefs', columnas);
  ocultasActuales = '';
  ajustarColumnas($('#tabla-cobros').clientWidth);
  api.refreshCells({ force: true });
  actualizarTotales();
  pintarCifras();
  if (!$('#respuesta').hidden) quitarRespuesta();
  retraducirDetalle();
}

// Tras registrar un recordatorio, la fila se actualiza sin recargar desde PayPal.
function actualizarFila(fila) {
  filas = filas.map((f) => (f.id === fila.id ? fila : f));
  api.applyTransaction({ update: [fila] });
  // La celda de estado depende del historial, no de su valor: hay que forzarla.
  const nodo = api.getRowNode(fila.id);
  if (nodo) api.refreshCells({ rowNodes: [nodo], columns: ['estado'], force: true });
}

export function iniciarPanel() {
  iniciarDetalle();
  api = createGrid($('#tabla-cobros'), {
    theme: tema,
    icons: ICONOS,
    columnDefs: columnas,
    defaultColDef: { sortable: true, resizable: false, suppressMovable: true },
    rowData: [],
    getRowId: (p) => String(p.data.id ?? 'totales'),
    domLayout: 'autoHeight',
    // La tabla nace oculta (ancho 0); se ajusta cuando la pantalla se muestra.
    onGridSizeChanged: (e) => ajustarColumnas(e.clientWidth),
    animateRows: true,
    suppressCellFocus: true,
    isExternalFilterPresent: () => filtro !== 'todas' || idsRespuesta !== null,
    doesExternalFilterPass: (nodo) => (idsRespuesta === null || idsRespuesta.has(nodo.data.id)) && FILTROS[filtro](nodo.data),
    onModelUpdated: actualizarTotales,
    rowClass: 'fila-pulsable',
    onRowClicked: (e) => {
      if (e.node.rowPinned) return;
      // El enlace "Pago ↗" de la fila abre PayPal, no el detalle.
      if (e.event?.target?.closest?.('a')) return;
      abrirDetalle(e.data, { onCambio: actualizarFila });
    },
    initialState: { sort: { sortModel: [{ colId: 'estado', sort: 'asc' }] } },
    // Se consulta cada vez que AG Grid muestra un texto propio: sigue al idioma.
    getLocaleText: ({ key, defaultValue }) => ({
      loadingOoo: t('tabla.cargando'),
      noRowsToShow: t('tabla.vacia'),
      noMatchingRows: t('tabla.sin_coincidencias'),
    })[key] ?? defaultValue,
  });

  for (const boton of document.querySelectorAll('.filtro')) {
    boton.addEventListener('click', () => {
      // Elegir un estado a mano sustituye al filtro de la pregunta.
      quitarRespuesta({ refrescar: false });
      marcarFiltro(boton.dataset.filtro);
      api.onFilterChanged();
    });
  }

  $('#buscar').addEventListener('input', (e) => api.setGridOption('quickFilterText', e.target.value));
  $('#boton-actualizar').addEventListener('click', cargar);
  $('#boton-reintentar').addEventListener('click', cargar);

  $('#form-pregunta').addEventListener('submit', (e) => {
    e.preventDefault();
    preguntar($('#pregunta').value);
  });
  for (const ejemplo of document.querySelectorAll('.pregunta-ejemplo')) {
    ejemplo.addEventListener('click', () => {
      $('#pregunta').value = ejemplo.textContent.trim();
      preguntar($('#pregunta').value);
    });
  }
  $('#quitar-respuesta').addEventListener('click', () => quitarRespuesta());

  alCambiarIdioma(retraducirPanel);
  pintarCifras();

  return { cargar };
}
