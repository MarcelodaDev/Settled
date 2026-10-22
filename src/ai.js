// Llamadas a la IA vía OpenRouter (API compatible con OpenAI).
// Usamos tool calling forzado: el modelo no responde con texto libre, sino
// rellenando los argumentos de una función con un esquema fijo.

const URL = 'https://openrouter.ai/api/v1/chat/completions';

export class IAError extends Error {
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = 'IAError';
    this.causa = causa;
  }
}

async function llamarHerramienta({ sistema, usuario, herramienta }) {
  const { OPENROUTER_API_KEY: clave, OPENROUTER_MODEL: modelo } = process.env;
  if (!clave || !modelo) throw new IAError('Faltan OPENROUTER_API_KEY u OPENROUTER_MODEL en el entorno.');

  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      'X-Title': 'Cobrador con IA',
    },
    body: JSON.stringify({
      model: modelo,
      temperature: 0,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      tools: [{ type: 'function', function: herramienta }],
      tool_choice: { type: 'function', function: { name: herramienta.name } },
    }),
  });

  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[ia] ${res.status}`, datos?.error?.message ?? '');
    throw new IAError('La IA no está disponible en este momento.', datos?.error);
  }

  const llamada = datos.choices?.[0]?.message?.tool_calls?.[0];
  try {
    return JSON.parse(llamada.function.arguments);
  } catch {
    throw new IAError('La IA no devolvió una propuesta legible. Prueba a reformular el cobro.');
  }
}

const HERRAMIENTA_COBRO = {
  name: 'proponer_cobro',
  description: 'Registra los datos de un cobro extraídos de la instrucción del freelancer.',
  parameters: {
    type: 'object',
    properties: {
      cliente_nombre: { type: ['string', 'null'], description: 'Nombre del cliente o empresa a quien se cobra.' },
      cliente_email: { type: ['string', 'null'], description: 'Correo del cliente, solo si aparece en el texto.' },
      concepto: {
        type: ['string', 'null'],
        description: 'Qué se cobra, redactado como línea de factura breve y profesional, en español. Ej.: "Diseño y desarrollo de sitio web".',
      },
      monto: { type: ['number', 'null'], description: 'Monto total en dólares (USD).' },
      anticipo_pct: {
        type: ['number', 'null'],
        description: 'Porcentaje del total que se pide como anticipo o pago mínimo inicial (0-100). null si no se menciona.',
      },
      fecha_vencimiento: {
        type: ['string', 'null'],
        description: 'Fecha límite de pago en formato YYYY-MM-DD, calculada a partir de la fecha de hoy. null si no se menciona.',
      },
      nota_cliente: {
        type: ['string', 'null'],
        description: 'Nota breve y cordial para el cliente en la factura, en español. Solo puede repetir condiciones que el texto dice (p. ej. el anticipo); nunca añadas condiciones nuevas. null si no hay nada que comunicar.',
      },
      advertencias: {
        type: 'array',
        items: { type: 'string' },
        description: 'Datos que faltan, son ambiguos o no se pueden cumplir, explicados al freelancer en una frase cada uno.',
      },
    },
    required: [
      'cliente_nombre', 'cliente_email', 'concepto', 'monto',
      'anticipo_pct', 'fecha_vencimiento', 'nota_cliente', 'advertencias',
    ],
  },
};

export async function interpretarCobro(instruccion, hoy) {
  const sistema = [
    'Eres el asistente de cobros de un freelancer en Ecuador. Conviertes su instrucción en los datos de una factura.',
    `Hoy es ${hoy} (zona horaria America/Guayaquil).`,
    'Reglas:',
    '- Extrae solo lo que dice el texto. Nunca inventes correos, montos ni fechas; si algo falta, usa null y explícalo en advertencias.',
    '- La única moneda admitida es USD. Si se menciona otra moneda, no conviertas: deja el monto en null y avísalo en advertencias.',
    '- "Anticipo", "adelanto", "la mitad ahora" o similares indican anticipo_pct (la mitad = 50).',
    '- Expresiones como "en 15 días" o "para el viernes" se convierten a fecha_vencimiento a partir de hoy.',
    '- El correo es opcional: sin él, el freelancer comparte el enlace de pago por su cuenta. Si falta, menciónalo como opción, no como requisito.',
    '- El nombre puede ser solo el nombre de pila o una empresa; no pidas apellidos.',
    '- Capitaliza el nombre del cliente correctamente.',
    '- Si el texto no es una instrucción de cobro, deja todo en null y explícalo en advertencias.',
  ].join('\n');

  return llamarHerramienta({ sistema, usuario: instruccion, herramienta: HERRAMIENTA_COBRO });
}
