// Cliente mínimo de la Invoicing API v2 de PayPal.
// Usamos fetch directo en lugar del SDK: son pocas llamadas y así se ve
// exactamente qué se envía a PayPal.

const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

// Error con los datos útiles de PayPal: `issue` para decidir qué decir al
// usuario y `debugId` para buscar el caso en los registros.
export class PayPalError extends Error {
  constructor(status, cuerpo) {
    const detalle = cuerpo?.details?.[0] ?? {};
    super(cuerpo?.message || `PayPal respondió ${status}`);
    this.name = 'PayPalError';
    this.status = status;
    this.issue = detalle.issue || cuerpo?.name || cuerpo?.error || null;
    this.descripcion = detalle.description || cuerpo?.error_description || null;
    this.debugId = cuerpo?.debug_id || null;
  }
}

let token = null; // { valor, expira }

// Si PayPal no contesta en este tiempo, se corta: mejor un error claro que un
// botón esperando para siempre.
const LIMITE_MS = 15000;

// fetch con límite de tiempo. Un corte o un fallo de red se convierte en un
// PayPalError con status 0, que el usuario ve como "no pudimos hablar con PayPal".
async function llamar(url, opciones) {
  try {
    return await fetch(url, { ...opciones, signal: AbortSignal.timeout(LIMITE_MS) });
  } catch (causa) {
    console.error(`[paypal] sin respuesta de ${url}: ${causa.name}`);
    throw new PayPalError(0, { name: 'SIN_CONEXION' });
  }
}

// PayPal a veces responde con HTML (errores 5xx de su borde): no es JSON.
async function leerJson(res) {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return {};
  }
}

async function obtenerToken() {
  if (token && Date.now() < token.expira) return token.valor;

  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secreto } = process.env;
  if (!id || !secreto) throw new PayPalError(401, { name: 'invalid_client' });

  const res = await llamar(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secreto}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const cuerpo = await leerJson(res);
  if (!res.ok) throw new PayPalError(res.status, cuerpo);

  // Renovamos un minuto antes de que caduque.
  token = { valor: cuerpo.access_token, expira: Date.now() + (cuerpo.expires_in - 60) * 1000 };
  return token.valor;
}

async function pedir(metodo, ruta, cuerpo, cabeceras = {}, reintento = false) {
  const res = await llamar(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await obtenerToken()}`,
      'Content-Type': 'application/json',
      ...cabeceras,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

  // Token revocado o caducado antes de tiempo: se pide uno nuevo una sola vez.
  if (res.status === 401 && !reintento) {
    token = null;
    return pedir(metodo, ruta, cuerpo, cabeceras, true);
  }

  const datos = await leerJson(res);
  if (!res.ok) {
    const error = new PayPalError(res.status, datos);
    console.error(`[paypal] ${metodo} ${ruta} -> ${res.status} ${error.issue ?? ''} debug_id=${error.debugId ?? '-'}`);
    throw error;
  }
  return datos;
}

const dinero = (valor) => ({ currency_code: 'USD', value: valor.toFixed(2) });

// Traduce un cobro validado (ver cobro.js) al formato de factura de PayPal.
function aFactura(cobro, numeroFactura) {
  const factura = {
    detail: {
      currency_code: 'USD',
      invoice_number: numeroFactura,
      payment_term: cobro.fecha_vencimiento
        ? { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: cobro.fecha_vencimiento }
        : { term_type: 'DUE_ON_RECEIPT' },
      ...(cobro.nota_cliente && { note: cobro.nota_cliente }),
    },
    primary_recipients: [
      {
        billing_info: {
          name: { given_name: cobro.cliente_nombre },
          ...(cobro.cliente_email && { email_address: cobro.cliente_email }),
        },
      },
    ],
    items: [{ name: cobro.concepto, quantity: '1', unit_amount: dinero(cobro.monto) }],
  };

  // "50% de anticipo" = la factura acepta pagos parciales con un mínimo.
  if (cobro.anticipo_monto) {
    factura.configuration = {
      partial_payment: { allow_partial_payment: true, minimum_amount_due: dinero(cobro.anticipo_monto) },
    };
  }
  return factura;
}

// Resumen de una factura de PayPal con lo que necesita la interfaz.
export function resumir(factura) {
  return {
    id: factura.id,
    numero: factura.detail?.invoice_number,
    estado: factura.status,
    total: factura.amount?.value ?? null,
    pendiente: factura.due_amount?.value ?? null,
    vence: factura.detail?.payment_term?.due_date ?? null,
    enlace: factura.detail?.metadata?.recipient_view_url ?? null,
  };
}

export async function obtenerFactura(id) {
  return pedir('GET', `/v2/invoicing/invoices/${encodeURIComponent(id)}`);
}

// El listado de PayPal trae estado y montos, pero no el concepto, el correo
// ni el enlace de pago. Esos datos no cambian nunca, así que se piden una vez
// por factura y se guardan en memoria; el estado siempre se lee fresco.
const fijos = new Map(); // id -> { concepto, email, enlace }

function datosFijos(factura) {
  return {
    concepto: factura.items?.map((item) => item.name).join(' · ') || null,
    email: factura.primary_recipients?.[0]?.billing_info?.email_address ?? null,
    enlace: factura.detail?.metadata?.recipient_view_url ?? null,
  };
}

// El listado trae cuánto se ha pagado, pero no cuándo. Las fechas de cada pago
// están en el detalle; se guardan junto con el monto pagado que tenían y solo
// se vuelven a pedir si ese monto cambia (entró un pago nuevo).
const pagos = new Map(); // id -> { pagado, transacciones: [{ fecha, monto }] }

const montoPagado = (factura) => factura.payments?.paid_amount?.value ?? '0.00';

function datosPagos(factura) {
  return {
    pagado: montoPagado(factura),
    // `payment_date` (solo fecha) coincide con el día local; `payment_date_time`
    // viene desfasado en sandbox, así que no se usa.
    transacciones: (factura.payments?.transactions ?? []).map((t) => ({
      fecha: t.payment_date ?? null,
      monto: Number(t.amount?.value ?? 0),
    })),
  };
}

function recordarDetalle(factura) {
  fijos.set(factura.id, datosFijos(factura));
  pagos.set(factura.id, datosPagos(factura));
}

function necesitaDetalle(factura) {
  if (!fijos.has(factura.id)) return true;
  const pagado = montoPagado(factura);
  return pagado !== '0.00' && pagos.get(factura.id)?.pagado !== pagado;
}

async function completarDetalles(facturas) {
  const faltan = facturas.filter(necesitaDetalle).map((f) => f.id);
  // De 5 en 5 para no saturar la API con decenas de peticiones a la vez.
  for (let i = 0; i < faltan.length; i += 5) {
    await Promise.all(faltan.slice(i, i + 5).map(async (id) => recordarDetalle(await obtenerFactura(id))));
  }
}

const adjuntar = (factura) => ({
  ...factura,
  fijos: fijos.get(factura.id),
  transacciones: pagos.get(factura.id)?.transacciones ?? [],
});

export function recordarFijos(factura) {
  recordarDetalle(factura);
}

// Una factura leída con GET ya trae todo el detalle: se guarda y se adjunta
// con la misma forma que usa listarFacturas.
export function conFijos(factura) {
  recordarDetalle(factura);
  return adjuntar(factura);
}

// Todas las facturas de la cuenta (hasta 500), más recientes primero.
export async function listarFacturas() {
  const facturas = [];
  for (let pagina = 1; pagina <= 5; pagina++) {
    const datos = await pedir('GET', `/v2/invoicing/invoices?page=${pagina}&page_size=100&total_required=true`);
    facturas.push(...(datos.items ?? []));
    if (pagina >= (datos.total_pages ?? 1)) break;
  }
  await completarDetalles(facturas);
  return facturas.map(adjuntar);
}

// Crea el borrador, lo envía (así PayPal genera el enlace de pago) y devuelve
// la factura actualizada.
export async function crearYEnviar(cobro, numeroFactura) {
  const creada = await pedir('POST', '/v2/invoicing/invoices', aFactura(cobro, numeroFactura), {
    Prefer: 'return=representation',
  });
  // Con Prefer la respuesta trae la factura; sin él, solo un enlace a ella.
  const id = creada.id ?? creada.href?.split('/').pop();
  if (!id) throw new Error('PayPal no devolvió el id de la factura.');

  try {
    await pedir('POST', `/v2/invoicing/invoices/${encodeURIComponent(id)}/send`, {
      // Sin correo del cliente no hay a quién enviarla: se comparte el enlace.
      send_to_recipient: Boolean(cobro.cliente_email),
      send_to_invoicer: false,
    });
  } catch (error) {
    // Si el envío falla, el borrador quedaría huérfano y al reintentar PayPal
    // rechazaría el número como duplicado. Se borra para que el reintento funcione.
    await pedir('DELETE', `/v2/invoicing/invoices/${encodeURIComponent(id)}`).catch((e) =>
      console.error(`[paypal] no se pudo borrar el borrador ${id}: ${e.issue ?? e.message}`));
    throw error;
  }

  const factura = await obtenerFactura(id);
  recordarFijos(factura);
  return factura;
}

// Mensaje propio para el usuario: nunca mostramos el `message` crudo de PayPal.
// Devuelve una clave de src/i18n.js.
export function claveDeError(error) {
  switch (error.issue) {
    case 'DUPLICATE_INVOICE_NUMBER':
    case 'DUPLICATE_INVOICE_ID':
      return 'paypal.duplicada';
    case 'invalid_client':
      return 'paypal.credenciales';
    default:
      if (error.status === 401 || error.status === 403) return 'paypal.acceso';
      if (error.status === 404) return 'paypal.no_encontrada';
      if (error.status === 400 || error.status === 422) return 'paypal.datos';
      return 'paypal.conexion';
  }
}
