// Ayuda para poner precio. La IA solo estima tareas y horas; la tarifa la
// elige el freelancer y el total lo calcula el código (aquí y en el navegador).
// No se dan "precios de mercado": la IA no tiene datos fiables para eso.

const MAX_TAREAS = 12;
const HORAS_MIN = 0.5;
const HORAS_MAX = 200;

const redondearMedia = (n) => Math.round(n * 2) / 2;

function texto(valor, max) {
  return typeof valor === 'string' && valor.trim() ? valor.trim().replace(/\s+/g, ' ').slice(0, max) : null;
}

// Limpia lo que propone la IA: tareas con nombre, horas razonables en
// múltiplos de media hora, y supuestos breves.
export function normalizarEstimacion(entrada = {}) {
  const tareas = (Array.isArray(entrada.tareas) ? entrada.tareas : [])
    .map((t) => ({ tarea: texto(t?.tarea, 80), horas: Number(t?.horas) }))
    .filter((t) => t.tarea && Number.isFinite(t.horas) && t.horas > 0)
    .slice(0, MAX_TAREAS)
    .map((t) => ({ ...t, horas: Math.min(HORAS_MAX, Math.max(HORAS_MIN, redondearMedia(t.horas))) }));

  const supuestos = (Array.isArray(entrada.supuestos) ? entrada.supuestos : [])
    .map((s) => texto(s, 240))
    .filter(Boolean)
    .slice(0, 4);

  const horas = tareas.reduce((total, t) => total + t.horas, 0);
  return { tareas, supuestos, horas };
}

// Estados que cuentan como trabajo realmente facturado.
const FACTURADAS = new Set(['SENT', 'UNPAID', 'PARTIALLY_PAID', 'PAYMENT_PENDING', 'PAID', 'MARKED_AS_PAID']);

// Lo que la IA ve del historial: id y concepto. Sin montos, para que no pueda
// "sugerir" precios ni repetir cifras: los montos los pone el código.
export function candidatosDelHistorial(filas) {
  return filas
    .filter((f) => FACTURADAS.has(f.estado) && f.concepto)
    .slice(0, 50)
    .map((f) => ({ id: f.id, concepto: f.concepto }));
}

// Con los ids que eligió la IA (solo se aceptan los que existen), el código
// arma la referencia con los montos reales de PayPal.
export function referenciaDelHistorial(ids, filas) {
  const porId = new Map(filas.filter((f) => FACTURADAS.has(f.estado)).map((f) => [f.id, f]));
  const elegidas = [...new Set(Array.isArray(ids) ? ids : [])]
    .filter((id) => porId.has(id))
    .slice(0, 3)
    .map((id) => {
      const f = porId.get(id);
      return { numero: f.numero, cliente: f.cliente, concepto: f.concepto, total: f.total, emitida: f.emitida };
    });
  if (!elegidas.length) return null;

  const totales = elegidas.map((f) => f.total);
  const promedio = Math.round((totales.reduce((a, b) => a + b, 0) / totales.length) * 100) / 100;
  return { facturas: elegidas, promedio, minimo: Math.min(...totales), maximo: Math.max(...totales) };
}
