// Límites de uso para la demo pública. Cualquiera con la URL puede crear
// facturas en el sandbox y gastar créditos de la IA: sin límites, un bot o un
// curioso podría agotar el saldo de OpenRouter antes de que el jurado la vea.
// Se guardan en memoria: basta para una sola instancia en Render.

const MINUTO = 60 * 1000;

function contador(ventanaMs, maximo) {
  const marcas = new Map(); // clave -> [instantes]
  return function superado(clave) {
    const ahora = Date.now();
    const recientes = (marcas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (recientes.length >= maximo) {
      marcas.set(clave, recientes);
      return true;
    }
    recientes.push(ahora);
    marcas.set(clave, recientes);
    // Limpieza perezosa para que el mapa no crezca sin fin.
    if (marcas.size > 5000) {
      for (const [k, v] of marcas) if (!v.some((t) => ahora - t < ventanaMs)) marcas.delete(k);
    }
    return false;
  };
}

// `porVisitante` frena a una persona; `global` protege el saldo aunque lleguen
// peticiones desde muchas IP distintas.
export function limitar({ porVisitante, global, mensaje }) {
  const visitante = contador(porVisitante.ventanaMs, porVisitante.maximo);
  const total = contador(global.ventanaMs, global.maximo);
  return (req, res, next) => {
    if (visitante(req.ip) || total('todos')) {
      return res.status(429).json({ error: mensaje });
    }
    next();
  };
}

export const limiteIA = limitar({
  porVisitante: { ventanaMs: 10 * MINUTO, maximo: 30 },
  global: { ventanaMs: 24 * 60 * MINUTO, maximo: 600 },
  mensaje: 'Has hecho muchas consultas seguidas. Espera unos minutos e inténtalo de nuevo.',
});

export const limiteFacturas = limitar({
  porVisitante: { ventanaMs: 60 * MINUTO, maximo: 10 },
  global: { ventanaMs: 24 * 60 * MINUTO, maximo: 150 },
  mensaje: 'Se alcanzó el límite de facturas de prueba por ahora. Inténtalo más tarde.',
});
