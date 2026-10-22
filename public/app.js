// Flujo de tres pasos: instrucción -> revisión -> factura.
// Todo el texto que viene del servidor o de la IA se pinta con textContent,
// nunca con innerHTML, para no inyectar HTML.

const $ = (selector) => document.querySelector(selector);

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const fechaLarga = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const ESTADOS = {
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

const estado = { texto: '', numero: null, factura: null, cliente: '' };

function formatearFecha(iso) {
  return iso ? fechaLarga.format(new Date(`${iso}T00:00:00Z`)) : null;
}

function irA(paso) {
  for (const n of [1, 2, 3]) {
    $(`#vista-${n}`).hidden = n !== paso;
    const li = $(`.paso[data-paso="${n}"]`);
    li.classList.toggle('activo', n === paso);
    li.classList.toggle('hecho', n < paso);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function api(metodo, ruta, cuerpo) {
  const res = await fetch(ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(datos.error || 'No se pudo completar la acción.');
    error.errores = datos.errores;
    throw error;
  }
  return datos;
}

function ocupado(boton, texto) {
  boton.dataset.original ??= boton.textContent;
  boton.disabled = Boolean(texto);
  boton.textContent = texto || boton.dataset.original;
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
    error.textContent = 'Escribe qué quieres cobrar.';
    error.hidden = false;
    return;
  }

  const boton = $('#boton-interpretar');
  ocupado(boton, 'Interpretando…');
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

  $('#texto-original').textContent = `«${estado.texto}»`;

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
  return {
    cliente_nombre: valor('cliente_nombre'),
    cliente_email: valor('cliente_email'),
    concepto: valor('concepto'),
    monto: valor('monto'),
    anticipo_pct: valor('anticipo_pct'),
    fecha_vencimiento: valor('fecha_vencimiento'),
    nota_cliente: valor('nota_cliente'),
  };
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
    resumen.textContent = 'Completa el cliente y el monto para ver el resumen.';
    return;
  }

  const fuerte = (texto) => Object.assign(document.createElement('strong'), { textContent: texto });
  const partes = ['Se creará la factura ', fuerte(estado.numero), ' por ', fuerte(usd.format(monto)), ' a nombre de ', fuerte(c.cliente_nombre), '.'];

  const pct = Number(c.anticipo_pct);
  if (pct > 0 && pct < 100) {
    partes.push(' Podrá pagar un anticipo mínimo de ', fuerte(`${usd.format(Math.round(monto * pct) / 100)} (${pct}%)`), '.');
  }
  partes.push(c.fecha_vencimiento ? ` Vence el ${formatearFecha(c.fecha_vencimiento)}.` : ' Se paga al recibirla.');
  partes.push(c.cliente_email ? ` PayPal la enviará a ${c.cliente_email}.` : ' No se enviará por correo: compartirás tú el enlace.');

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
  ocupado(boton, 'Creando en PayPal…');
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
  const pagada = ['PAID', 'MARKED_AS_PAID'].includes(f.estado);
  etiqueta.className = `estado ${pagada ? 'estado--pagada' : 'estado--pendiente'}`;
  etiqueta.textContent = ESTADOS[f.estado] ?? f.estado;
  $('#r-estado').replaceChildren(etiqueta);

  $('#r-total').textContent = f.total ? usd.format(Number(f.total)) : '—';
  $('#r-pendiente').textContent = f.pendiente ? usd.format(Number(f.pendiente)) : usd.format(0);
  $('#r-vence').textContent = formatearFecha(f.vence) ?? 'Al recibirla';

  const enlace = $('#r-enlace');
  enlace.hidden = !f.enlace;
  if (f.enlace) enlace.href = f.enlace;
  $('#boton-copiar').hidden = !f.enlace;
}

$('#boton-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(estado.factura.enlace);
    $('#aviso-3').textContent = 'Enlace copiado.';
  } catch {
    $('#aviso-3').textContent = estado.factura.enlace;
  }
});

$('#boton-estado').addEventListener('click', async () => {
  const boton = $('#boton-estado');
  ocupado(boton, 'Consultando…');
  try {
    const factura = await api('GET', `/api/cobros/${encodeURIComponent(estado.factura.id)}`);
    estado.factura = factura;
    pintarFactura(factura);
    $('#aviso-3').textContent = `Estado consultado a PayPal · ${new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    $('#aviso-3').textContent = err.message;
  } finally {
    ocupado(boton, null);
  }
});

$('#boton-nuevo').addEventListener('click', () => {
  $('#texto').value = '';
  $('#aviso-3').textContent = '';
  irA(1);
  $('#texto').focus();
});

/* Inicio */

$('#fecha-hoy').textContent = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
irA(1);
