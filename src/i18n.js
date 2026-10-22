// Mensajes del servidor en inglés y español. El navegador manda el idioma de la
// interfaz en la cabecera X-Idioma; sin ella, se responde en inglés.

const MENSAJES = {
  en: {
    'cobro.falta_nombre': 'The client name is missing.',
    'cobro.email_invalido': 'The client email doesn’t look valid.',
    'cobro.falta_concepto': 'The item (what you’re billing for) is missing.',
    'cobro.falta_monto': 'The amount is missing or not greater than zero.',
    'cobro.monto_maximo': ({ maximo }) => `The amount exceeds the maximum allowed of ${maximo}.`,
    'cobro.anticipo_rango': 'The deposit must be between 0% and 100%.',
    'cobro.fecha_invalida': 'The due date isn’t valid.',
    'cobro.fecha_pasada': 'The due date has already passed.',
    'cobro.texto_vacio': 'Write what you want to bill.',
    'cobro.texto_largo': 'The instruction is too long (1,000 characters max).',
    'cobro.numero_invalido': 'Invalid invoice number.',

    'precio.falta_concepto': 'Describe the item first so the work can be estimated.',
    'precio.sin_tareas': 'I couldn’t break that down into tasks. Describe the work in a bit more detail.',

    'recordatorio.sin_saldo': 'This invoice has no outstanding balance, so no reminder is needed.',
    'recordatorio.sin_mensaje': 'The AI didn’t return a message. Please try again.',
    'recordatorio.datos_invalidos': 'Invalid reminder data.',

    'consulta.vacia': 'Write a question about your invoices.',
    'consulta.larga': 'The question is too long (300 characters max).',
    'consulta.fuera_de_tema': 'I can only answer questions about your invoices: who owes you, what came in, what’s overdue or how much you billed.',

    'ia.config': 'OPENROUTER_API_KEY or OPENROUTER_MODEL is missing from the environment.',
    'ia.no_disponible': 'The AI isn’t available right now.',
    'ia.ilegible': 'The AI returned something unreadable. Try rephrasing.',

    'paypal.duplicada': 'This invoice was already created. Check your invoices before trying again.',
    'paypal.credenciales': 'The PayPal credentials aren’t valid. Check the server configuration.',
    'paypal.acceso': 'PayPal denied access. Check that the app has Invoicing permission.',
    'paypal.datos': 'PayPal didn’t accept the invoice data. Check the email, amount and date.',
    'paypal.conexion': 'We couldn’t reach PayPal. Try again in a few seconds.',
    'paypal.no_encontrada': 'That invoice doesn’t exist in PayPal.',

    'limite.ia': 'You’ve made a lot of requests in a row. Wait a few minutes and try again.',
    'limite.facturas': 'The test invoice limit has been reached for now. Try again later.',

    'servidor.json': 'The request isn’t valid JSON.',
    'servidor.grande': 'The request is too large.',
    'servidor.error': 'Something went wrong on the server.',
  },
  es: {
    'cobro.falta_nombre': 'Falta el nombre del cliente.',
    'cobro.email_invalido': 'El correo del cliente no parece válido.',
    'cobro.falta_concepto': 'Falta el concepto (qué estás cobrando).',
    'cobro.falta_monto': 'Falta el monto o no es mayor que cero.',
    'cobro.monto_maximo': ({ maximo }) => `El monto supera el máximo permitido de ${maximo}.`,
    'cobro.anticipo_rango': 'El anticipo debe estar entre 0% y 100%.',
    'cobro.fecha_invalida': 'La fecha de vencimiento no es válida.',
    'cobro.fecha_pasada': 'La fecha de vencimiento ya pasó.',
    'cobro.texto_vacio': 'Escribe qué quieres cobrar.',
    'cobro.texto_largo': 'La instrucción es demasiado larga (máximo 1000 caracteres).',
    'cobro.numero_invalido': 'Número de factura no válido.',

    'precio.falta_concepto': 'Primero describe el concepto para poder estimar el trabajo.',
    'precio.sin_tareas': 'No pude desglosar eso en tareas. Describe el trabajo con un poco más de detalle.',

    'recordatorio.sin_saldo': 'Esta factura no tiene saldo pendiente; no hace falta recordatorio.',
    'recordatorio.sin_mensaje': 'La IA no devolvió un mensaje. Inténtalo de nuevo.',
    'recordatorio.datos_invalidos': 'Datos del recordatorio no válidos.',

    'consulta.vacia': 'Escribe una pregunta sobre tus cobros.',
    'consulta.larga': 'La pregunta es demasiado larga (máximo 300 caracteres).',
    'consulta.fuera_de_tema': 'Solo puedo responder preguntas sobre tus cobros: quién te debe, qué entró, qué está vencido o cuánto facturaste.',

    'ia.config': 'Faltan OPENROUTER_API_KEY u OPENROUTER_MODEL en el entorno.',
    'ia.no_disponible': 'La IA no está disponible en este momento.',
    'ia.ilegible': 'La IA devolvió algo ilegible. Prueba a reformularlo.',

    'paypal.duplicada': 'Esta factura ya se había creado. Revisa tus cobros antes de intentarlo de nuevo.',
    'paypal.credenciales': 'Las credenciales de PayPal no son válidas. Revisa la configuración del servidor.',
    'paypal.acceso': 'PayPal rechazó el acceso. Revisa que la app tenga permiso de Invoicing.',
    'paypal.datos': 'PayPal no aceptó los datos de la factura. Revisa el correo, el monto y la fecha.',
    'paypal.conexion': 'No pudimos hablar con PayPal. Inténtalo de nuevo en unos segundos.',
    'paypal.no_encontrada': 'Esa factura no existe en PayPal.',

    'limite.ia': 'Has hecho muchas consultas seguidas. Espera unos minutos e inténtalo de nuevo.',
    'limite.facturas': 'Se alcanzó el límite de facturas de prueba por ahora. Inténtalo más tarde.',

    'servidor.json': 'La petición no es JSON válido.',
    'servidor.grande': 'La petición es demasiado grande.',
    'servidor.error': 'Algo salió mal en el servidor.',
  },
};

export const IDIOMAS = ['en', 'es'];

export const idiomaValido = (valor) => (IDIOMAS.includes(valor) ? valor : 'en');

export function idiomaDe(req) {
  return (req.get('x-idioma') || '').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function m(idioma, clave, variables = {}) {
  const entrada = MENSAJES[idiomaValido(idioma)][clave] ?? MENSAJES.en[clave] ?? clave;
  return typeof entrada === 'function' ? entrada(variables) : entrada;
}

// Locale para Intl: $1,200.00 en inglés, $1.200,00 en español de Ecuador.
export const locale = (idioma) => (idioma === 'es' ? 'es-EC' : 'en-US');

// Nombre del idioma para las instrucciones de la IA.
export const nombreIdioma = (idioma) => (idioma === 'es' ? 'español' : 'inglés');
