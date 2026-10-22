// Motor de consultas sobre los cobros. Aquí no hay IA: la IA solo traduce la
// pregunta a una consulta estructurada, y todo lo que es cálculo (fechas,
// sumas, agrupaciones) lo hace este código, que no se equivoca con la aritmética.

import { esPagada } from './filas.js';

export const METRICAS = ['pendiente', 'cobrado', 'facturado', 'cantidad'];
export const ESTADOS = ['todas', 'abiertas', 'vencidas', 'pagadas'];
export const PERIODOS = [
  'hoy', 'ayer', 'esta_semana', 'semana_pasada', 'este_mes', 'mes_pasado',
  'ultimos_7_dias', 'ultimos_30_dias', 'este_anio', 'rango',
];

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 24 * 60 * 60 * 1000;

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
const fechaCorta = new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export const formatear = (monto) => usd.format(monto);

/* Fechas: siempre como texto YYYY-MM-DD en hora de Ecuador */

const aFecha = (iso) => new Date(`${iso}T00:00:00Z`);
const aIso = (fecha) => fecha.toISOString().slice(0, 10);
const sumarDias = (iso, n) => aIso(new Date(aFecha(iso).getTime() + n * DIA));
const corta = (iso) => fechaCorta.format(aFecha(iso));

// "del 19 al 25 de octubre" (mismo mes) o "del 28 de octubre al 3 de noviembre".
function deA(desde, hasta) {
  return desde.slice(0, 7) === hasta.slice(0, 7)
    ? `del ${aFecha(desde).getUTCDate()} al ${corta(hasta)}`
    : `del ${corta(desde)} al ${corta(hasta)}`;
}

function lunesDe(iso) {
  const dia = aFecha(iso).getUTCDay(); // 0 = domingo
  return sumarDias(iso, dia === 0 ? -6 : 1 - dia);
}

function finDeMes(anio, mes) {
  return aIso(new Date(Date.UTC(anio, mes + 1, 0)));
}

// Devuelve { desde, hasta, texto } (ambos extremos incluidos).
export function rangoDe(periodo, hoy, desde, hasta) {
  const [anio, mes] = hoy.split('-').map(Number);
  switch (periodo) {
    case 'hoy': return { desde: hoy, hasta: hoy, texto: 'hoy' };
    case 'ayer': { const d = sumarDias(hoy, -1); return { desde: d, hasta: d, texto: 'ayer' }; }
    case 'esta_semana': {
      const l = lunesDe(hoy);
      return { desde: l, hasta: sumarDias(l, 6), texto: `esta semana (${deA(l, sumarDias(l, 6))})` };
    }
    case 'semana_pasada': {
      const l = sumarDias(lunesDe(hoy), -7);
      return { desde: l, hasta: sumarDias(l, 6), texto: `la semana pasada (${deA(l, sumarDias(l, 6))})` };
    }
    case 'este_mes': {
      const d = `${hoy.slice(0, 7)}-01`;
      return { desde: d, hasta: finDeMes(anio, mes - 1), texto: 'este mes' };
    }
    case 'mes_pasado': {
      const d = aIso(new Date(Date.UTC(anio, mes - 2, 1)));
      return { desde: d, hasta: finDeMes(anio, mes - 2), texto: 'el mes pasado' };
    }
    case 'ultimos_7_dias': return { desde: sumarDias(hoy, -6), hasta: hoy, texto: 'en los últimos 7 días' };
    case 'ultimos_30_dias': return { desde: sumarDias(hoy, -29), hasta: hoy, texto: 'en los últimos 30 días' };
    case 'este_anio': return { desde: `${anio}-01-01`, hasta: `${anio}-12-31`, texto: `en ${anio}` };
    case 'rango': return { desde, hasta, texto: desde === hasta ? `el ${corta(desde)}` : deA(desde, hasta) };
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
  };

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

export function ejecutarConsulta(consulta, filas, hoy) {
  const rango = consulta.periodo ? rangoDe(consulta.periodo, hoy, consulta.desde, consulta.hasta) : null;
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

  return { rango, coincidencias, total, cantidad: coincidencias.length, porCliente };
}

/* Respuesta: la escribe el código con las cifras calculadas */

const facturas = (n) => (n === 1 ? '1 factura' : `${n} facturas`);

function listaClientes(porCliente) {
  const partes = porCliente.slice(0, 5).map((g) => `${g.cliente} (${formatear(g.monto)})`);
  if (porCliente.length > 5) partes.push(`y ${porCliente.length - 5} más`);
  return partes.join(', ');
}

export function redactarRespuesta(consulta, resultado) {
  const periodo = resultado.rango ? ` ${resultado.rango.texto}` : '';
  const { total, cantidad, porCliente } = resultado;

  switch (consulta.metrica) {
    case 'pendiente':
      if (!cantidad) {
        if (consulta.estado === 'vencidas') return `No tienes facturas vencidas${consulta.cliente ? ` de ${consulta.cliente}` : ''}.`;
        if (resultado.rango) return `No tienes saldos pendientes que venzan${periodo}.`;
        return consulta.cliente ? `${consulta.cliente} no te debe nada.` : 'Nadie te debe nada: no hay saldos pendientes.';
      }
      if (consulta.estado === 'vencidas') {
        return `Tienes ${formatear(total)} vencidos en ${facturas(cantidad)}: ${listaClientes(porCliente)}.`;
      }
      return `Te deben ${formatear(total)} en ${facturas(cantidad)}${resultado.rango ? ` que vencen${periodo}` : ''}: ${listaClientes(porCliente)}.`;
    case 'cobrado':
      if (!cantidad) return `No entró ningún pago${periodo}.`;
      return `Entraron ${formatear(total)}${periodo}, de ${facturas(cantidad)}: ${listaClientes(porCliente)}.`;
    case 'facturado':
      if (!cantidad) return `No emitiste facturas${periodo}.`;
      return `Facturaste ${formatear(total)}${periodo} en ${facturas(cantidad)}.`;
    default: {
      const uno = cantidad === 1;
      const estado = {
        todas: '',
        abiertas: ' por cobrar',
        vencidas: uno ? ' vencida' : ' vencidas',
        pagadas: uno ? ' pagada' : ' pagadas',
      }[consulta.estado];
      return `Tienes ${facturas(cantidad)}${estado}${periodo ? `, ${uno ? 'emitida' : 'emitidas'}${periodo}` : ''}.`;
    }
  }
}
