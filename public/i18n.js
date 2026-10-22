// Idiomas de la interfaz: inglés por defecto, español como alternativa.
// Los textos fijos del HTML se marcan con data-i18n (o data-i18n-placeholder,
// data-i18n-aria-label, data-i18n-title); los dinámicos usan t('clave').

const plural = (n, uno, varios) => (n === 1 ? uno : varios);

const TEXTOS = {
  en: {
    'nav.secciones': 'Sections',
    'nav.nuevo': 'New invoice',
    'nav.cobros': 'Invoices',
    'idioma.grupo': 'Language',

    'pasos.grupo': 'Steps',
    'pasos.1': 'Instruction',
    'pasos.2': 'Review',
    'pasos.3': 'Invoice',

    'v1.titular': 'What do you need to bill?',
    'v1.entradilla': 'Write it the way you would tell an assistant. Nothing is created in PayPal until you review it.',
    'v1.etiqueta': 'Billing instruction',
    'v1.placeholder': 'Bill Juan $300 for the website, 50% upfront, due in 15 days',
    'v1.boton': 'Interpret',
    'v1.ocupado': 'Interpreting…',
    'v1.ejemplos': 'Examples:',
    'v1.ejemplo1': 'Bill Juan $300 for the website, 50% upfront, due in 15 days',
    'v1.ejemplo2': 'Invoice Estudio Ruiz (ana@estudioruiz.ec) $1,200 for the brand redesign, due November 30',
    'v1.ejemplo3': 'Cóbrale $450 a María por el logo, mitad ahora',
    'v1.ejemplo3.nota': 'in Spanish',
    'v1.vacio': 'Write what you want to bill.',

    'v2.titular': 'Review before creating',
    'v2.cliente': 'Client',
    'v2.correo': 'Email',
    'v2.opcional': 'optional',
    'v2.correo.placeholder': 'No email: you share the link yourself',
    'v2.concepto': 'Item',
    'v2.monto': 'Amount',
    'v2.anticipo': 'Deposit',
    'v2.anticipo.placeholder': 'No deposit',
    'v2.vence': 'Due',
    'v2.nota': 'Note to client',
    'v2.notas_ia': 'Notes from the AI',
    'v2.crear': 'Create invoice in PayPal',
    'v2.creando': 'Creating in PayPal…',
    'v2.volver': 'Rewrite',
    'v2.incompleto': 'Fill in the client and amount to see the summary.',
    'v2.resumen': ({ numero, monto, cliente }) => ['Invoice ', numero, ' for ', monto, ' will be created for ', cliente, '.'],
    'v2.resumen.anticipo': ({ minimo }) => [' They can pay a minimum deposit of ', minimo, '.'],
    'v2.resumen.vence': ({ fecha }) => ` Due ${fecha}.`,
    'v2.resumen.al_recibir': ' Due on receipt.',
    'v2.resumen.correo': ({ email }) => ` PayPal will email it to ${email}.`,
    'v2.resumen.sin_correo': ' It won’t be emailed: you’ll share the link yourself.',

    'v3.antetitulo': 'Invoice issued',
    'v3.estado': 'Status',
    'v3.total': 'Total',
    'v3.pendiente': 'Outstanding',
    'v3.abrir': 'Open payment page',
    'v3.copiar': 'Copy link',
    'v3.copiado': 'Link copied.',
    'v3.consultar': 'Check status',
    'v3.consultando': 'Checking…',
    'v3.consultado': ({ hora }) => `Status checked with PayPal · ${hora}`,
    'v3.ver_todos': 'See all invoices',
    'v3.nuevo': 'New invoice',
    'v3.al_recibir': 'On receipt',

    'panel.titular': 'Invoices',
    'panel.actualizar': 'Refresh',
    'panel.consultando': 'Checking PayPal…',
    'panel.actualizado': ({ hora }) => `Updated from PayPal · ${hora}`,
    'panel.error_lista': 'Could not load the list.',
    'panel.pregunta.etiqueta': 'Ask about your invoices',
    'panel.pregunta.placeholder': 'Ask anything: who owes me?',
    'panel.preguntar': 'Ask',
    'panel.pensando': 'Thinking…',
    'panel.prueba': 'Try',
    'panel.ejemplo1': 'Who owes me?',
    'panel.ejemplo2': 'How much came in this week?',
    'panel.ejemplo3': 'Which invoices are overdue?',
    'panel.ejemplo4': '¿Quién me debe?',
    'panel.mostrar_todas': 'Show all invoices',
    'panel.error_pregunta': 'I couldn’t answer that question.',
    'panel.entendi': ({ partes }) => `Understood: ${partes}`,
    'panel.todas_fechas': 'all dates',
    'panel.cliente': ({ cliente }) => `client: ${cliente}`,
    'metrica.pendiente': 'what you’re owed',
    'metrica.cobrado': 'payments received',
    'metrica.facturado': 'amount invoiced',
    'metrica.cantidad': 'number of invoices',
    'filtro_estado.abiertas': 'outstanding invoices',
    'filtro_estado.vencidas': 'overdue invoices',
    'filtro_estado.pagadas': 'paid invoices',
    'cifras.por_cobrar': 'Outstanding',
    'cifras.vencido': 'Overdue',
    'cifras.cobrado': 'Collected',
    'filtros.grupo': 'Filter by status',
    'filtros.todas': 'All',
    'filtros.abiertas': 'Outstanding',
    'filtros.vencidas': 'Overdue',
    'filtros.pagadas': 'Paid',
    'panel.buscar': 'Search',
    'panel.buscar.placeholder': 'Search client or item',
    'panel.pista': 'Click an invoice to see its details or draft a reminder.',

    'col.numero': 'Invoice',
    'col.cliente': 'Client & item',
    'col.emitida': 'Issued',
    'col.vence': 'Due',
    'col.estado': 'Status',
    'col.total': 'Total',
    'col.cobrado': 'Collected',
    'col.pendiente': 'Outstanding',
    'tabla.total': 'Total',
    'tabla.al_recibir': 'On receipt',
    'tabla.pago': 'Pay ↗',
    'tabla.pago.titulo': 'Open the PayPal payment page',
    'tabla.vacia': 'No invoices to show.',
    'tabla.sin_coincidencias': 'No invoices match the filter.',
    'tabla.cargando': 'Loading…',
    'tabla.recordado': ({ cuando }) => `Reminded ${cuando}`,
    'tabla.abierta_por_cliente': 'Opened by client',
    'tabla.sin_abrir': 'Not opened',

    facturas: ({ n }) => plural(n, '1 invoice', `${n} invoices`),
    vencida_hace: ({ n }) => plural(n, 'Overdue by 1 day', `Overdue by ${n} days`),
    hoy: 'today',

    'estado.DRAFT': 'Draft',
    'estado.SCHEDULED': 'Scheduled',
    'estado.SENT': 'Sent, awaiting payment',
    'estado.UNPAID': 'Awaiting payment',
    'estado.PARTIALLY_PAID': 'Deposit received',
    'estado.PAYMENT_PENDING': 'Payment pending',
    'estado.PAID': 'Paid',
    'estado.MARKED_AS_PAID': 'Paid (marked manually)',
    'estado.CANCELLED': 'Cancelled',
    'estado.AUTO_CANCELLED': 'Cancelled',
    'estado.REFUNDED': 'Refunded',
    'estado.PARTIALLY_REFUNDED': 'Partially refunded',
    'estado.MARKED_AS_REFUNDED': 'Refunded',

    'detalle.factura': 'Invoice',
    'detalle.cerrar': 'Close',
    'detalle.cobrado': 'Collected',
    'detalle.correo': 'Email',
    'detalle.sin_correo': 'No email',
    'detalle.original': 'How you asked for it',
    'detalle.sin_saldo': 'This invoice has no outstanding balance.',
    'detalle.recordatorio': 'Reminder',
    'detalle.tonos': 'Reminder tone',
    'tono.amable': 'Friendly',
    'tono.firme': 'Firm',
    'tono.final': 'Final notice',
    'detalle.sugerido': 'suggested',
    'detalle.idioma_mensaje': 'Message in',
    'detalle.redactar': 'Draft with AI',
    'detalle.redactando': 'Drafting…',
    'detalle.redactar_otra': 'Draft again',
    'detalle.asunto': 'Subject',
    'detalle.mensaje': 'Message',
    'detalle.editable': 'you can edit it',
    'detalle.copiar': 'Copy message',
    'detalle.whatsapp': 'Open in WhatsApp',
    'detalle.enviar_correo': 'Send by email',
    'detalle.copiado': 'Message copied. Paste it wherever you talk to your client.',
    'detalle.no_copiado': 'Couldn’t copy. Select the text and copy it manually.',
    'detalle.no_historial': 'The reminder wasn’t saved to the history.',
    'detalle.error_redactar': 'Couldn’t draft the reminder.',
    'detalle.historial': 'Reminders sent',
    'canal.copiar': 'copied',
    'canal.whatsapp': 'WhatsApp',
    'canal.correo': 'email',

    'error.generico': 'The action could not be completed.',
  },

  es: {
    'nav.secciones': 'Secciones',
    'nav.nuevo': 'Nuevo cobro',
    'nav.cobros': 'Cobros',
    'idioma.grupo': 'Idioma',

    'pasos.grupo': 'Pasos',
    'pasos.1': 'Instrucción',
    'pasos.2': 'Revisión',
    'pasos.3': 'Factura',

    'v1.titular': '¿Qué hay que cobrar?',
    'v1.entradilla': 'Escríbelo como se lo dirías a un asistente. Nada se crea en PayPal hasta que lo revises.',
    'v1.etiqueta': 'Instrucción de cobro',
    'v1.placeholder': 'Cóbrale $300 a Juan por el sitio web, 50% de anticipo, que pague en 15 días',
    'v1.boton': 'Interpretar',
    'v1.ocupado': 'Interpretando…',
    'v1.ejemplos': 'Ejemplos:',
    'v1.ejemplo1': 'Cóbrale $300 a Juan por el sitio web, 50% de anticipo, que pague en 15 días',
    'v1.ejemplo2': 'Factura de $1.200 a Estudio Ruiz (ana@estudioruiz.ec) por el rediseño de marca, vence el 30 de noviembre',
    'v1.ejemplo3': 'Bill Maria $450 for the logo, half upfront',
    'v1.ejemplo3.nota': 'en inglés',
    'v1.vacio': 'Escribe qué quieres cobrar.',

    'v2.titular': 'Revisa antes de crear',
    'v2.cliente': 'Cliente',
    'v2.correo': 'Correo',
    'v2.opcional': 'opcional',
    'v2.correo.placeholder': 'Sin correo, compartes tú el enlace',
    'v2.concepto': 'Concepto',
    'v2.monto': 'Monto',
    'v2.anticipo': 'Anticipo',
    'v2.anticipo.placeholder': 'Sin anticipo',
    'v2.vence': 'Vence',
    'v2.nota': 'Nota al cliente',
    'v2.notas_ia': 'Notas de la IA',
    'v2.crear': 'Crear factura en PayPal',
    'v2.creando': 'Creando en PayPal…',
    'v2.volver': 'Volver a escribir',
    'v2.incompleto': 'Completa el cliente y el monto para ver el resumen.',
    'v2.resumen': ({ numero, monto, cliente }) => ['Se creará la factura ', numero, ' por ', monto, ' a nombre de ', cliente, '.'],
    'v2.resumen.anticipo': ({ minimo }) => [' Podrá pagar un anticipo mínimo de ', minimo, '.'],
    'v2.resumen.vence': ({ fecha }) => ` Vence el ${fecha}.`,
    'v2.resumen.al_recibir': ' Se paga al recibirla.',
    'v2.resumen.correo': ({ email }) => ` PayPal la enviará a ${email}.`,
    'v2.resumen.sin_correo': ' No se enviará por correo: compartirás tú el enlace.',

    'v3.antetitulo': 'Factura emitida',
    'v3.estado': 'Estado',
    'v3.total': 'Total',
    'v3.pendiente': 'Pendiente',
    'v3.abrir': 'Abrir página de pago',
    'v3.copiar': 'Copiar enlace',
    'v3.copiado': 'Enlace copiado.',
    'v3.consultar': 'Consultar estado',
    'v3.consultando': 'Consultando…',
    'v3.consultado': ({ hora }) => `Estado consultado a PayPal · ${hora}`,
    'v3.ver_todos': 'Ver todos los cobros',
    'v3.nuevo': 'Nuevo cobro',
    'v3.al_recibir': 'Al recibirla',

    'panel.titular': 'Cobros',
    'panel.actualizar': 'Actualizar',
    'panel.consultando': 'Consultando PayPal…',
    'panel.actualizado': ({ hora }) => `Actualizado desde PayPal · ${hora}`,
    'panel.error_lista': 'No se pudo cargar la lista.',
    'panel.pregunta.etiqueta': 'Pregunta sobre tus cobros',
    'panel.pregunta.placeholder': 'Pregunta lo que quieras: ¿quién me debe?',
    'panel.preguntar': 'Preguntar',
    'panel.pensando': 'Pensando…',
    'panel.prueba': 'Prueba con',
    'panel.ejemplo1': '¿Quién me debe?',
    'panel.ejemplo2': '¿Cuánto entró esta semana?',
    'panel.ejemplo3': '¿Qué facturas están vencidas?',
    'panel.ejemplo4': 'Who owes me?',
    'panel.mostrar_todas': 'Mostrar todas las facturas',
    'panel.error_pregunta': 'No pude responder esa pregunta.',
    'panel.entendi': ({ partes }) => `Entendí: ${partes}`,
    'panel.todas_fechas': 'todas las fechas',
    'panel.cliente': ({ cliente }) => `cliente: ${cliente}`,
    'metrica.pendiente': 'lo que te deben',
    'metrica.cobrado': 'pagos recibidos',
    'metrica.facturado': 'monto facturado',
    'metrica.cantidad': 'número de facturas',
    'filtro_estado.abiertas': 'facturas por cobrar',
    'filtro_estado.vencidas': 'facturas vencidas',
    'filtro_estado.pagadas': 'facturas pagadas',
    'cifras.por_cobrar': 'Por cobrar',
    'cifras.vencido': 'Vencido',
    'cifras.cobrado': 'Cobrado',
    'filtros.grupo': 'Filtrar por estado',
    'filtros.todas': 'Todas',
    'filtros.abiertas': 'Por cobrar',
    'filtros.vencidas': 'Vencidas',
    'filtros.pagadas': 'Pagadas',
    'panel.buscar': 'Buscar',
    'panel.buscar.placeholder': 'Buscar cliente o concepto',
    'panel.pista': 'Pulsa una factura para ver el detalle o redactar un recordatorio.',

    'col.numero': 'Factura',
    'col.cliente': 'Cliente y concepto',
    'col.emitida': 'Emitida',
    'col.vence': 'Vence',
    'col.estado': 'Estado',
    'col.total': 'Total',
    'col.cobrado': 'Cobrado',
    'col.pendiente': 'Pendiente',
    'tabla.total': 'Total',
    'tabla.al_recibir': 'Al recibir',
    'tabla.pago': 'Pago ↗',
    'tabla.pago.titulo': 'Abrir la página de pago de PayPal',
    'tabla.vacia': 'No hay cobros que mostrar.',
    'tabla.sin_coincidencias': 'Ningún cobro coincide con el filtro.',
    'tabla.cargando': 'Cargando…',
    'tabla.recordado': ({ cuando }) => `Recordado ${cuando}`,
    'tabla.abierta_por_cliente': 'El cliente la abrió',
    'tabla.sin_abrir': 'Sin abrir',

    facturas: ({ n }) => plural(n, '1 factura', `${n} facturas`),
    vencida_hace: ({ n }) => plural(n, 'Vencida hace 1 día', `Vencida hace ${n} días`),
    hoy: 'hoy',

    'estado.DRAFT': 'Borrador',
    'estado.SCHEDULED': 'Programada',
    'estado.SENT': 'Enviada, por cobrar',
    'estado.UNPAID': 'Por cobrar',
    'estado.PARTIALLY_PAID': 'Anticipo recibido',
    'estado.PAYMENT_PENDING': 'Pago en proceso',
    'estado.PAID': 'Pagada',
    'estado.MARKED_AS_PAID': 'Pagada (registrada a mano)',
    'estado.CANCELLED': 'Cancelada',
    'estado.AUTO_CANCELLED': 'Cancelada',
    'estado.REFUNDED': 'Reembolsada',
    'estado.PARTIALLY_REFUNDED': 'Reembolso parcial',
    'estado.MARKED_AS_REFUNDED': 'Reembolsada',

    'detalle.factura': 'Factura',
    'detalle.cerrar': 'Cerrar',
    'detalle.cobrado': 'Cobrado',
    'detalle.correo': 'Correo',
    'detalle.sin_correo': 'Sin correo',
    'detalle.original': 'Lo pediste así',
    'detalle.sin_saldo': 'Esta factura no tiene saldo pendiente.',
    'detalle.recordatorio': 'Recordatorio',
    'detalle.tonos': 'Tono del recordatorio',
    'tono.amable': 'Amable',
    'tono.firme': 'Firme',
    'tono.final': 'Último aviso',
    'detalle.sugerido': 'sugerido',
    'detalle.idioma_mensaje': 'Mensaje en',
    'detalle.redactar': 'Redactar con IA',
    'detalle.redactando': 'Redactando…',
    'detalle.redactar_otra': 'Redactar otra vez',
    'detalle.asunto': 'Asunto',
    'detalle.mensaje': 'Mensaje',
    'detalle.editable': 'puedes editarlo',
    'detalle.copiar': 'Copiar mensaje',
    'detalle.whatsapp': 'Abrir en WhatsApp',
    'detalle.enviar_correo': 'Enviar por correo',
    'detalle.copiado': 'Mensaje copiado. Pégalo donde hables con tu cliente.',
    'detalle.no_copiado': 'No se pudo copiar. Selecciona el texto y cópialo a mano.',
    'detalle.no_historial': 'El recordatorio no quedó en el historial.',
    'detalle.error_redactar': 'No se pudo redactar el recordatorio.',
    'detalle.historial': 'Recordatorios enviados',
    'canal.copiar': 'copiado',
    'canal.whatsapp': 'WhatsApp',
    'canal.correo': 'correo',

    'error.generico': 'No se pudo completar la acción.',
  },
};

export const IDIOMAS = ['en', 'es'];
const CLAVE_GUARDADA = 'settled.idioma';

function leerGuardado() {
  try {
    const valor = localStorage.getItem(CLAVE_GUARDADA);
    return IDIOMAS.includes(valor) ? valor : null;
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

let idioma = leerGuardado() ?? 'en';
const oyentes = [];

export const idiomaActual = () => idioma;
export const locale = () => (idioma === 'es' ? 'es-EC' : 'en-US');

// t('clave', { variables }). Si la entrada es una función, recibe las variables
// (sirve para plurales y para frases que mezclan texto y nodos).
export function t(clave, variables = {}) {
  const entrada = TEXTOS[idioma][clave] ?? TEXTOS.en[clave];
  if (entrada === undefined) return clave;
  return typeof entrada === 'function' ? entrada(variables) : entrada;
}

export function traducirDocumento(raiz = document) {
  for (const nodo of raiz.querySelectorAll('[data-i18n]')) nodo.textContent = t(nodo.dataset.i18n);
  for (const nodo of raiz.querySelectorAll('[data-i18n-placeholder]')) nodo.placeholder = t(nodo.dataset.i18nPlaceholder);
  for (const nodo of raiz.querySelectorAll('[data-i18n-aria-label]')) nodo.setAttribute('aria-label', t(nodo.dataset.i18nAriaLabel));
  for (const nodo of raiz.querySelectorAll('[data-i18n-title]')) nodo.title = t(nodo.dataset.i18nTitle);
  document.documentElement.lang = idioma;
  for (const boton of document.querySelectorAll('[data-idioma]')) {
    boton.setAttribute('aria-pressed', String(boton.dataset.idioma === idioma));
  }
}

export function alCambiarIdioma(fn) {
  oyentes.push(fn);
}

export function cambiarIdioma(nuevo) {
  if (!IDIOMAS.includes(nuevo) || nuevo === idioma) return;
  idioma = nuevo;
  try {
    localStorage.setItem(CLAVE_GUARDADA, nuevo);
  } catch {
    // sin almacenamiento: el idioma vale solo para esta visita
  }
  traducirDocumento();
  for (const fn of oyentes) fn(idioma);
}
