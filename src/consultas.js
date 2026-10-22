// Motor de consultas sobre los cobros. Aquí no hay IA: la IA solo traduce la
// pregunta a una consulta estructurada, y todo lo que es cálculo (fechas,
// sumas, agrupaciones) lo hace este código, que no se equivoca con la aritmética.

import { esPagada } from './filas.js';
import { locale } from './i18n.js';

export const METRICAS = ['pendiente', 'cobrado', 'facturado', 'cantidad'];
export const ESTADOS = ['todas', 'abiertas', 'vencidas', 'pagadas'];
export const ENFOQUES = ['total', 'cliente_principal', 'factura_principal'];
export const PERIODOS = [
  'hoy', 'ayer', 'esta_semana', 'semana_pasada', 'este_mes', 'mes_pasado',
  'ultimos_7_dias', 'ultimos_30_dias', 'este_anio', 'rango',
];

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 24 * 60 * 60 * 1000;

export const formatear = (monto, idioma = 'en') =>
  new Intl.NumberFormat(locale(idioma), { style: 'currency', currency: 'USD' }).format(monto);

/* Fechas: siempre como texto YYYY-MM-DD en hora de Ecuador */

const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (iso, n) => aIso(new Date(aFecha(iso).getTime() + n * DIA));

// "19 de octubre" / "October 19"
const corta = (iso, idioma) => new Intl.DateTimeFormat(locale(idioma), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(aFecha(iso));

// es: "del 19 al 25 de octubre" · en: "October 19–25"; con meses distintos,
// "del 28 de octubre al 3 de noviembre" · "October 28 – November 3".
function deA(desde, hasta, idioma) {
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  if (idioma === 'es') {
    return mismoMes ? `del ${aFecha(desde).getUTCDate()} al ${corta(hasta, idioma)}` : `del ${corta(desde, idioma)} al ${corta(hasta, idioma)}`;
  }
  return mismoMes ? `${corta(desde, idioma)}–${aFecha(hasta).getUTCDate()}` : `${corta(desde, idioma)} – ${corta(hasta, idioma)}`;
}

function lunesDe(iso) {
  const dia = aFecha(iso).getUTCDay(); // 0 = domingo
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia);
}

function finDeMes(anio, mes) {
  return aIso(new Date(Date.UTC(anio, mes + 1, 0)));
}

const TEXTO_PERIODO = {
  es: {
    hoy: () => 'hoy',
    ayer: () => 'ayer',
    esta_semana: (r) => `esta semana (${r})`,
    semana_pasada: (r) => `la semana pasada (${r})`,
    este_mes: () => 'este mes',
    mes_pasado: () => 'el mes pasado',
    ultimos_7_dias: () => 'en los últimos 7 días',
    ultimos_30_dias: () => 'en los últimos 30 días',
    este_anio: (_, anio) => `en ${anio}`,
    un_dia: (f) => `el ${f}`,
  },
  en: {
    hoy: () => 'today',
    ayer: () => 'yesterday',
    esta_semana: (r) => `this week (${r})`,
    semana_pasada: (r) => `last week (${r})`,
    este_mes: () => 'this month',
    mes_pasado: () => 'last month',
    ultimos_7_dias: () => 'in the last 7 days',
    ultimos_30_dias: () => 'in the last 30 days',
    este_anio: (_, anio) => `in ${anio}`,
    un_dia: (f) => `on ${f}`,
  },
};

// Devuelve { desde, hasta, texto } (ambos extremos incluidos).
export function rangoDe(periodo, hoy, desde, hasta, idioma = 'en') {
  const [anio, mes] = hoy.split('-').map(Number);
  const textos = TEXTO_PERIODO[idioma] ?? TEXTO_PERIODO.en;
  const con = (d, h, texto) => ({ desde: d, hasta: h, texto });
  switch (periodo) {
    case 'hoy': return con(hoy, hoy, textos.hoy());
    case 'ayer': { const d = sumarDias(hoy, -1); return con(d, d, textos.ayer()); }
    case 'esta_semana': {
      const l = lunesDe(hoy);
      return con(l, sumarDias(l, 6), textos.esta_semana(deA(l, sumarDias(l, 6), idioma)));
    }
    case 'semana_pasada': {
      const l = sumarDias(lunesDe(hoy), -7);
      return con(l, sumarDias(l, 6), textos.semana_pasada(deA(l, sumarDias(l, 6), idioma)));
    }
    case 'este_mes': return con(`${hoy.slice(0, 7)}-01`, finDeMes(anio, mes - 1), textos.este_mes());
    case 'mes_pasado': return con(aIso(new Date(Date.UTC(anio, mes - 2, 1))), finDeMes(anio, mes - 2), textos.mes_pasado());
    case 'ultimos_7_dias': return con(sumarDias(hoy, -6), hoy, textos.ultimos_7_dias());
    case 'ultimos_30_dias': return con(sumarDias(hoy, -29), hoy, textos.ultimos_30_dias());
    case 'este_anio': return con(`${anio}-01-01`, `${anio}-12-31`, textos.este_anio(null, anio));
    case 'rango':
      if (desde === hasta) return con(desde, hasta, textos.un_dia(corta(desde, idioma)));
      if (idioma === 'es') return con(desde, hasta, deA(desde, hasta, idioma));
      // "from September 1 to 30" o "from September 15 to October 10"
      return con(desde, hasta, `from ${corta(desde, idioma)} to ${desde.slice(0, 7) === hasta.slice(0, 7) ? aFecha(hasta).getUTCDate() : corta(hasta, idioma)}`);
    default: return null;
  }
}

/* Validación de lo que propone la IA */

const sinAcentos = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function normalizarConsulta(entrada = {}) {
  const consulta = {
    sobre_cobros: entrada.sobre_cobros !== false,
    metrica: METRICAS.includes(entrada.metrica) ? entrada.metrica : 'pendiente',
    estado: ESTADOS.includes(entrada.estado) ? entrada.estado : 'todas',
    cliente: typeof entrada.cliente === 'string' && entrada.cliente.trim() ? entrada.cliente.trim().slice(0, 80) : null,
    periodo: PERIODOS.includes(entrada.periodo) ? entrada.periodo : null,
    desde: null,
    hasta: null,
    enfoque: ENFOQUES.includes(entrada.enfoque) ? entrada.enfoque : 'total',
  };

  // "La factura más grande" no tiene sentido cuando se cuentan facturas.
  if (consulta.metrica === 'cantidad' && consulta.enfoque === 'factura_principal') consulta.enfoque = 'total';

  // Combinaciones que no tienen sentido aunque cada filtro sea válido:
  // lo cobrado incluye anticipos de facturas aún abiertas, y lo pendiente
  // nunca está en facturas pagadas.
  if ((consulta.metrica === 'cobrado' || consulta.metrica === 'pendiente') && consulta.estado === 'pagadas') {
    consulta.estado = 'todas';
  }

  if (consulta.periodo === 'rango') {
    const valida = (f) => typeof f === 'string' && FECHA_RE.test(f) && !Number.isNaN(Date.parse(f));
    if (valida(entrada.desde) && valida(entrada.hasta)) {
      [consulta.desde, consulta.hasta] = [entrada.desde, entrada.hasta].sort();
    } else {
      consulta.periodo = null; // rango incompleto: se ignora antes que inventarlo
    }
  }
  return consulta;
}

/* Ejecución */

const FILTRO_ESTADO = {
  todas: () => true,
  abiertas: (f) => f.pendiente > 0,
  vencidas: (f) => f.vencida,
  pagadas: (f) => esPagada(f),
};

// Cuánto aporta cada factura a la métrica (0 = no entra en la respuesta).
function montoDe(fila, consulta, enRango) {
  switch (consulta.metrica) {
    case 'pendiente':
      // Con periodo, se entiende como "lo que vence en ese periodo".
      return enRango(fila.vence) ? fila.pendiente : 0;
    case 'cobrado': {
      // Se suman los pagos por su fecha: un anticipo de la semana pasada
      // cuenta la semana pasada aunque el saldo se pague hoy.
      const enPeriodo = fila.pagos.filter((p) => enRango(p.fecha)).reduce((t, p) => t + p.monto, 0);
      return fila.pagos.length ? enPeriodo : (enRango(null) ? fila.cobrado : 0);
    }
    case 'facturado':
    case 'cantidad':
      return enRango(fila.emitida) ? fila.total : 0;
    default:
      return 0;
  }
}

export function ejecutarConsulta(consulta, filas, hoy, idioma = 'en') {
  const rango = consulta.periodo ? rangoDe(consulta.periodo, hoy, consulta.desde, consulta.hasta, idioma) : null;
  // Sin periodo, todo entra; con periodo, la fecha debe existir y caer dentro.
  const enRango = (fecha) => !rango || (fecha !== null && fecha >= rango.desde && fecha <= rango.hasta);
  const cliente = consulta.cliente ? sinAcentos(consulta.cliente) : null;

  const coincidencias = [];
  for (const fila of filas) {
    if (!FILTRO_ESTADO[consulta.estado](fila)) continue;
    if (cliente && !sinAcentos(fila.cliente).includes(cliente)) continue;
    const monto = Math.round(montoDe(fila, consulta, enRango) * 100) / 100;
    const entra = consulta.metrica === 'cantidad' ? enRango(fila.emitida) : monto > 0;
    if (entra) coincidencias.push({ id: fila.id, numero: fila.numero, cliente: fila.cliente, concepto: fila.concepto, monto });
  }

  const total = Math.round(coincidencias.reduce((t, c) => t + c.monto, 0) * 100) / 100;

  const grupos = new Map();
  for (const c of coincidencias) {
    const g = grupos.get(c.cliente) ?? { cliente: c.cliente, monto: 0, facturas: 0 };
    g.monto = Math.round((g.monto + c.monto) * 100) / 100;
    g.facturas += 1;
    grupos.set(c.cliente, g);
  }
  const porCliente = [...grupos.values()].sort((a, b) => b.monto - a.monto);

  const principal = buscarPrincipal(consulta, coincidencias, porCliente);
  // La tabla muestra lo que sostiene la respuesta: con un "mayor", solo eso.
  const ids = (principal ? principal.ids : coincidencias.map((c) => c.id));

  return { rango, coincidencias, total, cantidad: coincidencias.length, porCliente, principal, ids };
}

// "¿Quién me debe más?" / "¿mi factura más grande?": el mayor lo elige el
// código, no la IA. Si hay empate, entran todos los empatados.
function buscarPrincipal(consulta, coincidencias, porCliente) {
  if (consulta.enfoque === 'total' || !coincidencias.length) return null;

  if (consulta.enfoque === 'cliente_principal') {
    // Al contar facturas, "el que más" es quien tiene más facturas.
    const valor = (g) => (consulta.metrica === 'cantidad' ? g.facturas : g.monto);
    const maximo = Math.max(...porCliente.map(valor));
    const lideres = porCliente.filter((g) => valor(g) === maximo);
    const nombres = new Set(lideres.map((g) => g.cliente));
    return { tipo: 'cliente', lideres, unico: porCliente.length === 1, ids: coincidencias.filter((c) => nombres.has(c.cliente)).map((c) => c.id) };
  }

  const maximo = Math.max(...coincidencias.map((c) => c.monto));
  const lideres = coincidencias.filter((c) => c.monto === maximo);
  return { tipo: 'factura', lideres, unico: coincidencias.length === 1, ids: lideres.map((c) => c.id) };
}

/* Respuesta: la escribe el código con las cifras calculadas */

function listaClientes(porCliente, idioma) {
  const partes = porCliente.slice(0, 5).map((g) => `${g.cliente} (${formatear(g.monto, idioma)})`);
  if (porCliente.length > 5) partes.push(idioma === 'es' ? `y ${porCliente.length - 5} más` : `and ${porCliente.length - 5} more`);
  return partes.join(', ');
}

const juntar = (nombres, y) => (nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} ${y} ${nombres.at(-1)}`);

function principalEs(consulta, { rango, total, principal }) {
  const periodo = rango ? ` ${rango.texto}` : '';
  const de = principal.unico ? '' : ` (de ${formatear(total, 'es')} en total)`;
  if (principal.tipo === 'cliente') {
    const nombres = juntar(principal.lideres.map((g) => g.cliente), 'y');
    const varios = principal.lideres.length > 1;
    const g = principal.lideres[0];
    const monto = formatear(g.monto, 'es') + (varios ? ' cada uno' : '');
    switch (consulta.metrica) {
      case 'pendiente': return principal.unico ? `${nombres} es el único que te debe: ${monto}.` : `${nombres} ${varios ? 'son quienes más te deben' : 'es quien más te debe'}: ${monto}${de}.`;
      case 'cobrado': return `${nombres} ${varios ? 'son quienes más te pagaron' : 'es quien más te pagó'}${periodo}: ${monto}${de}.`;
      case 'facturado': return `${varios ? `A ${nombres} es a quienes` : `A ${nombres} es a quien`} más le facturaste${periodo}: ${monto}${de}.`;
      default: return `${nombres} ${varios ? 'son los clientes' : 'es el cliente'} con más facturas${periodo}: ${g.facturas}.`;
    }
  }
  const f = principal.lideres[0];
  const mas = principal.lideres.length > 1 ? ` (y ${principal.lideres.length - 1} más con el mismo monto)` : '';
  const monto = formatear(f.monto, 'es');
  switch (consulta.metrica) {
    case 'pendiente': return `La factura con más saldo pendiente${periodo} es ${f.numero}, de ${f.cliente}: ${monto} por cobrar${mas}.`;
    case 'cobrado': return `El pago más grande${periodo} fue de ${f.cliente}, en la factura ${f.numero}: ${monto}${mas}.`;
    default: return `Tu factura más grande${periodo} es ${f.numero}, a ${f.cliente}: ${monto}${mas}.`;
  }
}

function principalEn(consulta, { rango, total, principal }) {
  const periodo = rango ? ` ${rango.texto}` : '';
  const de = principal.unico ? '' : ` (out of ${formatear(total, 'en')} in total)`;
  if (principal.tipo === 'cliente') {
    const nombres = juntar(principal.lideres.map((g) => g.cliente), 'and');
    const varios = principal.lideres.length > 1;
    const g = principal.lideres[0];
    const monto = formatear(g.monto, 'en') + (varios ? ' each' : '');
    switch (consulta.metrica) {
      case 'pendiente': return principal.unico ? `${nombres} is the only one who owes you: ${monto}.` : `${nombres} ${varios ? 'owe' : 'owes'} you the most: ${monto}${de}.`;
      case 'cobrado': return `${nombres} paid you the most${periodo}: ${monto}${de}.`;
      case 'facturado': return `You invoiced ${nombres} the most${periodo}: ${monto}${de}.`;
      default: return `${nombres} ${varios ? 'have' : 'has'} the most invoices${periodo}: ${g.facturas}.`;
    }
  }
  const f = principal.lideres[0];
  const mas = principal.lideres.length > 1 ? ` (and ${principal.lideres.length - 1} more with the same amount)` : '';
  const monto = formatear(f.monto, 'en');
  switch (consulta.metrica) {
    case 'pendiente': return `The invoice with the largest balance${periodo} is ${f.numero}, from ${f.cliente}: ${monto} outstanding${mas}.`;
    case 'cobrado': return `The largest payment${periodo} came from ${f.cliente}, on invoice ${f.numero}: ${monto}${mas}.`;
    default: return `Your largest invoice${periodo} is ${f.numero}, to ${f.cliente}: ${monto}${mas}.`;
  }
}

function respuestaEs(consulta, { rango, total, cantidad, porCliente }) {
  const periodo = rango ? ` ${rango.texto}` : '';
  const monto = formatear(total, 'es');
  const lista = listaClientes(porCliente, 'es');
  const facturas = cantidad === 1 ? '1 factura' : `${cantidad} facturas`;

  switch (consulta.metrica) {
    case 'pendiente':
      if (!cantidad) {
        if (consulta.estado === 'vencidas') return `No tienes facturas vencidas${consulta.cliente ? ` de ${consulta.cliente}` : ''}.`;
        if (rango) return `No tienes saldos pendientes que venzan${periodo}.`;
        return consulta.cliente ? `${consulta.cliente} no te debe nada.` : 'Nadie te debe nada: no hay saldos pendientes.';
      }
      if (consulta.estado === 'vencidas') return `Tienes ${monto} vencidos en ${facturas}: ${lista}.`;
      return `Te deben ${monto} en ${facturas}${rango ? ` que vencen${periodo}` : ''}: ${lista}.`;
    case 'cobrado':
      if (!cantidad) return `No entró ningún pago${periodo}.`;
      return `Entraron ${monto}${periodo}, de ${facturas}: ${lista}.`;
    case 'facturado':
      if (!cantidad) return `No emitiste facturas${periodo}.`;
      return `Facturaste ${monto}${periodo} en ${facturas}.`;
    default: {
      const uno = cantidad === 1;
      const estado = { todas: '', abiertas: ' por cobrar', vencidas: uno ? ' vencida' : ' vencidas', pagadas: uno ? ' pagada' : ' pagadas' }[consulta.estado];
      return `Tienes ${facturas}${estado}${periodo ? `, ${uno ? 'emitida' : 'emitidas'}${periodo}` : ''}.`;
    }
  }
}

function respuestaEn(consulta, { rango, total, cantidad, porCliente }) {
  const periodo = rango ? ` ${rango.texto}` : '';
  const monto = formatear(total, 'en');
  const lista = listaClientes(porCliente, 'en');
  const sustantivo = cantidad === 1 ? 'invoice' : 'invoices';

  switch (consulta.metrica) {
    case 'pendiente':
      if (!cantidad) {
        if (consulta.estado === 'vencidas') return `You have no overdue invoices${consulta.cliente ? ` from ${consulta.cliente}` : ''}.`;
        if (rango) return `You have no outstanding balances due${periodo}.`;
        return consulta.cliente ? `${consulta.cliente} doesn’t owe you anything.` : 'Nobody owes you anything: there are no outstanding balances.';
      }
      if (consulta.estado === 'vencidas') return `You have ${monto} overdue across ${cantidad} ${sustantivo}: ${lista}.`;
      return `You’re owed ${monto} across ${cantidad} ${sustantivo}${rango ? ` due${periodo}` : ''}: ${lista}.`;
    case 'cobrado':
      if (!cantidad) return `No payments came in${periodo}.`;
      return `${monto} came in${periodo}, from ${cantidad} ${sustantivo}: ${lista}.`;
    case 'facturado':
      if (!cantidad) return `You didn’t issue any invoices${periodo}.`;
      return `You invoiced ${monto}${periodo} across ${cantidad} ${sustantivo}.`;
    default: {
      const adjetivo = { todas: '', abiertas: 'outstanding ', vencidas: 'overdue ', pagadas: 'paid ' }[consulta.estado];
      return `You have ${cantidad} ${adjetivo}${sustantivo}${periodo ? `, issued${periodo}` : ''}.`;
    }
  }
}

export function redactarRespuesta(consulta, resultado, idioma = 'en') {
  // Sin datos, la respuesta "vacía" de siempre ("nadie te debe nada") ya es correcta.
  if (resultado.principal) return idioma === 'es' ? principalEs(consulta, resultado) : principalEn(consulta, resultado);
  return idioma === 'es' ? respuestaEs(consulta, resultado) : respuestaEn(consulta, resultado);
}
