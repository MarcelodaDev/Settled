// Llamadas a la IA vía OpenRouter (API compatible con OpenAI).
// Usamos tool calling forzado: el modelo no responde con texto libre, sino
// rellenando los argumentos de una función con un esquema fijo.

const URL = 'https://openrouter.ai/api/v1/chat/completions';

import { nombreIdioma } from './i18n.js';

// `clave` es un mensaje de src/i18n.js: el manejador de errores lo traduce al
// idioma de quien hizo la petición.
export class IAError extends Error {
  constructor(clave, causa) {
    super(clave);
    this.name = 'IAError';
    this.clave = clave;
    this.causa = causa;
  }
}

async function llamarHerramienta({ sistema, usuario, herramienta }) {
  const { OPENROUTER_API_KEY: clave, OPENROUTER_MODEL: modelo } = process.env;
  if (!clave || !modelo) throw new IAError('ia.config');

  // Un modelo lento o caído no debe dejar el botón en "Pensando…" para siempre.
  const res = await fetch(URL, {
    signal: AbortSignal.timeout(30000),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clave}`,
      'Content-Type': 'application/json',
      'X-Title': 'Settled',
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
  }).catch((causa) => {
    // Corte por tiempo o fallo de red: para el usuario, la IA no está disponible.
    console.error(`[ia] sin respuesta: ${causa.name}`);
    throw new IAError('ia.no_disponible', causa);
  });

  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[ia] ${res.status}`, datos?.error?.message ?? '');
    throw new IAError('ia.no_disponible', datos?.error);
  }

  const llamada = datos.choices?.[0]?.message?.tool_calls?.[0];
  try {
    return JSON.parse(llamada.function.arguments);
  } catch {
    throw new IAError('ia.ilegible');
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
        description: 'Qué se cobra, redactado como línea de factura breve y profesional, en el idioma en que está escrita la instrucción. Ej.: "Diseño y desarrollo de sitio web" o "Website design and development".',
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
        description: 'Nota breve y cordial para el cliente en la factura, en el idioma en que está escrita la instrucción. Solo puede repetir condiciones que el texto dice (p. ej. el anticipo); nunca añadas condiciones nuevas. null si no hay nada que comunicar.',
      },
      advertencias: {
        type: 'array',
        items: { type: 'string' },
        description: 'Datos que faltan, son ambiguos o no se pueden cumplir, explicados al freelancer en una frase cada uno, en el idioma que indica el sistema. Solo para monto, concepto, moneda, correo o fecha: nunca sobre el nombre del cliente (un nombre de pila basta).',
      },
    },
    required: [
      'cliente_nombre', 'cliente_email', 'concepto', 'monto',
      'anticipo_pct', 'fecha_vencimiento', 'nota_cliente', 'advertencias',
    ],
  },
};

const HERRAMIENTA_RECORDATORIO = {
  name: 'redactar_recordatorio',
  description: 'Entrega el recordatorio de pago redactado para el cliente.',
  parameters: {
    type: 'object',
    properties: {
      asunto: { type: 'string', description: 'Asunto breve para correo, en el idioma indicado, sin emojis.' },
      mensaje: {
        type: 'string',
        description: 'Cuerpo del mensaje en el idioma indicado, listo para enviar por correo o WhatsApp. Debe incluir la marca {{enlace}} exactamente una vez donde va el enlace de pago.',
      },
    },
    required: ['asunto', 'mensaje'],
  },
};

// `datos` sale de la factura leída de PayPal en ese momento, no del navegador.
export async function redactarRecordatorio(datos, tono, descripcionTono, idioma = 'en') {
  const sistema = [
    'Redactas recordatorios de pago para un freelancer que escribe a sus clientes.',
    idioma === 'es'
      ? 'Escribe el asunto y el mensaje en español neutro, con tuteo respetuoso.'
      : 'Escribe el asunto y el mensaje en inglés natural y profesional (no traduzcas literalmente del español).',
    `Tono: ${descripcionTono}`,
    'Reglas:',
    '- Usa solo los datos proporcionados. No inventes montos, fechas, penalizaciones, intereses ni consecuencias.',
    '- Describe el plazo exactamente como indica "situacion_del_plazo". Nunca digas que la factura venció si ahí no lo dice.',
    '- Copia montos y fechas tal como vienen escritos.',
    '- Menciona el concepto y el monto pendiente.',
    '- Si el cliente ya pagó una parte (anticipo), agradécelo y menciona solo el saldo pendiente.',
    '- Escribe {{enlace}} exactamente una vez, solo en su propia línea, donde va el enlace de pago; nunca escribas una URL.',
    '- Máximo 90 palabras. Sin emojis, sin markdown, sin firmas inventadas.',
    datos.firma ? `- Firma con: ${datos.firma}` : '- No añadas firma con nombre.',
  ].join('\n');

  const usuario = JSON.stringify({
    tono,
    cliente: datos.cliente,
    concepto: datos.concepto,
    total: datos.total,
    ya_pagado: datos.cobrado,
    pendiente: datos.pendiente,
    situacion_del_plazo: datos.situacion,
    el_cliente_abrio_la_factura: datos.vista,
    recordatorios_enviados_antes: datos.recordatorios_previos,
    numero_factura: datos.numero,
  });

  return llamarHerramienta({ sistema, usuario, herramienta: HERRAMIENTA_RECORDATORIO });
}

const HERRAMIENTA_CONSULTA = {
  name: 'consultar_cobros',
  description: 'Traduce la pregunta del freelancer a una consulta sobre sus facturas.',
  parameters: {
    type: 'object',
    properties: {
      sobre_cobros: { type: 'boolean', description: 'false si la pregunta no trata sobre sus cobros, facturas, pagos o clientes.' },
      metrica: {
        type: 'string',
        enum: ['pendiente', 'cobrado', 'facturado', 'cantidad'],
        description: 'pendiente: lo que le deben ("¿quién me debe?", "¿qué vence esta semana?"). cobrado: pagos recibidos ("¿cuánto entró?", "¿quién me pagó?"). facturado: monto total emitido. cantidad: cuántas facturas.',
      },
      estado: {
        type: 'string',
        enum: ['todas', 'abiertas', 'vencidas', 'pagadas'],
        description: 'Filtro por estado de la factura. Usa vencidas solo si la pregunta habla de atrasos o vencidas. Usa pagadas solo para contar facturas pagadas por completo; para preguntas sobre pagos recibidos usa todas.',
      },
      cliente: { type: ['string', 'null'], description: 'Nombre del cliente si la pregunta se limita a uno; null si no.' },
      periodo: {
        type: ['string', 'null'],
        enum: ['hoy', 'ayer', 'esta_semana', 'semana_pasada', 'este_mes', 'mes_pasado', 'ultimos_7_dias', 'ultimos_30_dias', 'este_anio', 'rango', null],
        description: 'Periodo mencionado. Usa rango solo para fechas explícitas. null si no se menciona periodo.',
      },
      desde: { type: ['string', 'null'], description: 'Solo si periodo es rango: fecha inicial YYYY-MM-DD.' },
      hasta: { type: ['string', 'null'], description: 'Solo si periodo es rango: fecha final YYYY-MM-DD.' },
    },
    required: ['sobre_cobros', 'metrica', 'estado', 'cliente', 'periodo', 'desde', 'hasta'],
  },
};

export async function interpretarConsulta(pregunta, hoy) {
  const sistema = [
    'Traduces preguntas de un freelancer sobre sus cobros, en inglés o en español, a una consulta estructurada.',
    `Hoy es ${hoy} (zona horaria America/Guayaquil).`,
    'No calculas ni respondes nada: solo eliges los filtros. Los cálculos los hace el sistema.',
    'Ejemplos: "¿quién me debe?" / "who owes me?" → pendiente, todas. "¿cuánto entró esta semana?" / "how much came in this week?" → cobrado, esta_semana. "¿qué facturas están atrasadas?" / "which invoices are overdue?" → pendiente, vencidas. "how much did Juan pay me this month?" → cobrado, cliente Juan, este_mes.',
  ].join('\n');
  return llamarHerramienta({ sistema, usuario: pregunta, herramienta: HERRAMIENTA_CONSULTA });
}

const HERRAMIENTA_ESTIMACION = {
  name: 'estimar_trabajo',
  description: 'Desglosa un trabajo freelance en tareas con las horas que llevaría cada una.',
  parameters: {
    type: 'object',
    properties: {
      tareas: {
        type: 'array',
        description: 'Entre 3 y 8 tareas concretas, en el orden en que se harían.',
        items: {
          type: 'object',
          properties: {
            tarea: { type: 'string', description: 'Nombre breve de la tarea.' },
            horas: { type: 'number', description: 'Horas estimadas para esa tarea.' },
          },
          required: ['tarea', 'horas'],
        },
      },
      supuestos: {
        type: 'array',
        items: { type: 'string' },
        description: 'Hasta 3 supuestos clave de la estimación (p. ej. "el cliente entrega los textos"), en una frase corta cada uno (máximo 20 palabras).',
      },
      similares: {
        type: 'array',
        items: { type: 'string' },
        description: 'ids de las facturas anteriores (de la lista dada) cuyo trabajo es del mismo tipo que el nuevo. Máximo 3. Vacío si ninguna se parece de verdad.',
      },
    },
    required: ['tareas', 'supuestos', 'similares'],
  },
};

// Solo tareas y horas: la tarifa la pone el freelancer y el total lo calcula el código.
// `anteriores` son facturas del historial (id y concepto, sin montos): la IA solo
// señala cuáles se parecen; lo que se cobró lo lee el código de PayPal.
export async function estimarTrabajo(descripcion, idioma = 'en', anteriores = []) {
  const sistema = [
    'Ayudas a un freelancer que está empezando a estimar cuánto trabajo lleva un encargo.',
    `Escribe las tareas y los supuestos en ${nombreIdioma(idioma)}.`,
    'Reglas:',
    '- Estima horas realistas para un freelancer con experiencia intermedia, incluyendo comunicación con el cliente y una ronda de revisiones.',
    '- Nunca menciones precios, tarifas ni dinero: solo tareas y horas.',
    '- Si la descripción es vaga, asume el alcance más común para ese tipo de trabajo y dilo en los supuestos.',
    '- Si el texto no describe un trabajo, devuelve tareas vacías y explícalo en los supuestos.',
    '- En similares, marca solo facturas anteriores del mismo tipo de trabajo (un logo no se parece a un sitio web). Ante la duda, no la marques.',
  ].join('\n');
  const usuario = JSON.stringify({ trabajo_nuevo: descripcion, facturas_anteriores: anteriores });
  return llamarHerramienta({ sistema, usuario, herramienta: HERRAMIENTA_ESTIMACION });
}

export async function interpretarCobro(instruccion, hoy, idioma = 'en') {
  const sistema = [
    'Eres el asistente de cobros de un freelancer. Conviertes su instrucción, escrita en inglés o en español, en los datos de una factura.',
    `Hoy es ${hoy} (zona horaria America/Guayaquil).`,
    'Reglas:',
    `- Escribe las advertencias en ${nombreIdioma(idioma)}. El concepto y la nota al cliente van en el idioma de la instrucción, porque los lee el cliente.`,
    '- Extrae solo lo que dice el texto. Nunca inventes correos, montos ni fechas; si algo falta, usa null y explícalo en advertencias.',
    '- La única moneda admitida es USD. Si se menciona otra moneda, no conviertas: deja el monto en null y avísalo en advertencias.',
    '- "Anticipo", "adelanto", "la mitad ahora", "upfront", "deposit", "half now" o similares indican anticipo_pct (la mitad = 50).',
    '- Expresiones como "en 15 días", "para el viernes", "due in 15 days" o "by Friday" se convierten a fecha_vencimiento a partir de hoy.',
    '- El correo es opcional: sin él, el freelancer comparte el enlace de pago por su cuenta. Si falta, menciónalo como opción, no como requisito.',
    '- El concepto lo redactas tú como línea de factura profesional (p. ej. "website" → "Website design and development"); no le pidas al freelancer que lo mejore.',
    '- El nombre puede ser solo el nombre de pila o una empresa: es suficiente. Nunca añadas advertencias sobre apellidos o nombres incompletos.',
    '- Capitaliza el nombre del cliente correctamente.',
    '- Si el texto no es una instrucción de cobro, deja todo en null y explícalo en advertencias.',
  ].join('\n');

  return llamarHerramienta({ sistema, usuario: instruccion, herramienta: HERRAMIENTA_COBRO });
}
