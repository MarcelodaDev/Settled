# Contexto del proyecto: Cobrador con IA para freelancers

> Pásale este archivo a Claude Code (cópialo como `CLAUDE.md` en la raíz del repo) para que arranque con todo el contexto.

## 1. Quién soy y cómo trabajo

- Marcelo, desarrollador web freelance en Ecuador, estudiante de Software (ESPOCH). Voy **solo** en esta hackatón.
- Domino HTML/CSS/JavaScript a mano (sin WordPress ni constructores). Frontend sólido, backend básico.
- Responde siempre en **español**. Explica el porqué de las decisiones técnicas, no solo el código.
- Quiero criterio propio: si algo del plan es mala idea o está en riesgo, dilo y propón alternativa.

## 2. La hackatón

- **Nombre:** Build What's Next with PayPal and AI (Devpost).
- **Cierre:** 12 de noviembre de 2026, 3:00 pm (hora de Ecuador, GMT-5). Meta interna: entregar el **11 de noviembre**, con margen.
- **Requisito central:** usar de forma significativa **PayPal (sandbox gratuito)** y **una IA**. Si se quita cualquiera de las dos, el proyecto debe dejar de tener sentido.
- **Entregables obligatorios:**
  1. Repo público (GitHub/GitLab/Bitbucket) con todo el código, assets e instrucciones, y **archivo de licencia open source visible** (sección About).
  2. Demo funcional: URL hospedada **o** instrucciones claras para correrlo. Un mockup o prototipo estático NO cuenta.
  3. Descripción de funciones y funcionalidad.
  4. Herramientas/modelos de IA usados y cómo se usaron.
  5. Video de **menos de 3 minutos**, en YouTube público, mostrando el proyecto funcionando; sin marcas de terceros ni música con copyright.
- Verificar las Official Rules en Devpost para detalles (por ejemplo, si un proyecto puede optar a varios premios).

## 3. Premios a los que apuntamos

Objetivo principal, sin dispersarnos:

- **Best Use of PayPal + AI** ($5,000)
- **Best Demo Delivery** ($5,000): premia presentación; es donde más puedo competir yendo solo.
- **Best Use of AG Grid** ($5,000 / $2,000 / 3x $1,000): el panel de cobros se construye con AG Grid.
- **Best Use of Render** (créditos $1,000 / $750 / $500): la demo se hospeda en Render.
- Aspiración general: 1.º-3.er lugar ($12,000 / $8,000 / $5,000).

No forzar Bryntum, Channel3, APIMatic ni Agentic Commerce salvo que encajen de forma natural.

## 4. Decisión de proyecto

**Cobrador con IA para freelancers.** El freelancer escribe en lenguaje natural algo como:
"Cóbrale $300 a Juan por el sitio web, 50% de anticipo", y la IA:

1. Interpreta la instrucción (cliente, monto, concepto, condiciones de pago).
2. Crea la factura/orden en **PayPal sandbox** con enlace de pago.
3. Hace seguimiento del estado (enviada, pagada, vencida).
4. Redacta recordatorios de pago en tono amable (y más firme según el atraso).
5. Responde preguntas en español sobre sus cobros ("¿quién me debe?", "¿cuánto entró esta semana?").

**Por qué esta idea:** vivo el problema como freelancer, el flujo es demostrable en 3 minutos y el riesgo técnico es bajo. Lo que nos diferencia es el **cuidado del producto**: interfaz pulida y un caso real, no un chat genérico sobre la API de PayPal.

### Alcance del MVP (todo lo demás es opcional)

- [ ] Entrada en lenguaje natural -> datos estructurados validados (la IA propone, el usuario confirma antes de crear nada).
- [ ] Creación de factura en PayPal sandbox y enlace de pago.
- [ ] Sincronización del estado de pago (webhook de sandbox o consulta periódica).
- [ ] Panel de cobros con **AG Grid** (filtros, orden, estados, totales).
- [ ] Recordatorios redactados por IA (mostrar el texto; el envío real puede simularse o ir por correo).
- [ ] Consultas en español sobre los cobros.
- [ ] Despliegue en **Render** y README con instrucciones para correrlo localmente.

Fuera de alcance: cuentas de usuario complejas, pagos reales, multi-moneda, app móvil.

## 5. Decisiones

Confirmadas (21 oct 2026):

- **Stack backend:** Node + Express mínimo (sin TypeScript ni frameworks). Frontend en HTML/CSS/JS servido por el mismo Express, con AG Grid.
- **IA:** **OpenRouter** (API compatible con OpenAI), con tool calling para extraer los datos del cobro. El modelo se elige con la variable `OPENROUTER_MODEL`, que debe ser un modelo con buen soporte de tool calling.
- **Persistencia:** **PayPal es la fuente de verdad.** Las facturas y su estado se leen de la Invoicing API. Un JSON local guarda solo los extras (texto original, recordatorios); si se borra (disco efímero de Render), no se pierde nada crítico.

Pendiente de verificar:

- **API de PayPal:** Invoicing API v2 en sandbox (el pago parcial con monto mínimo encaja con "50% de anticipo"). Verificar en la documentación oficial antes de programar el flujo. El estado se obtiene por consulta periódica; los webhooks son una mejora para después.
- **Experiencia previa con AG Grid y Render:** por definir; asume que son nuevos para mí y explícame lo básico.

## 6. Plan por semanas

| Fechas | Objetivo |
|---|---|
| 19-25 oct | Cuenta developer de PayPal, repo con licencia, estructura base. Flujo mínimo: texto -> IA -> factura en sandbox. |
| 26 oct-1 nov | Panel con AG Grid, estados de pago, consultas en español. |
| 2-8 nov | Recordatorios con IA, despliegue en Render, pulido de interfaz, manejo de errores. |
| 9-11 nov | Congelar funciones. README final, video (guion y grabación), descripción en Devpost, envío. |
| 12 nov | Solo margen de emergencia. No depender de este día. |

## 7. Reglas para Claude Code

- **Nunca** subir claves ni credenciales al repo. Usar `.env` (en `.gitignore`) y dejar un `.env.example`.
- Solo sandbox de PayPal. Nada de dinero real.
- Licencia MIT (o similar) desde el primer commit.
- Commits pequeños y frecuentes. README actualizado a medida que avanzamos, no al final.
- Priorizar un flujo completo que funcione antes que funciones extra.
- Toda acción que cree dinero/facturas debe pasar por confirmación explícita del usuario (también es un buen punto para el video).

## 8. Diseño de la interfaz

El diseño es parte de lo que se evalúa (Best Demo Delivery). Mis preferencias:

- Estilo **editorial**: cantos rectos, filetes finos, jerarquía por tipografía y espacio en blanco.
- **Evitar** recuadros redondeados, tarjetas tipo glass y píldoras: "se ve que fue creado con IA".
- Si tomas una referencia, dime qué diagnóstico de diseño haces (qué falla y por qué), no solo ejecutes.
- Personalizar AG Grid para que no se vea con el tema por defecto.

## 9. Primer paso sugerido para Claude Code

1. Leer este archivo y confirmar entendimiento en pocas líneas.
2. Hacerme las preguntas de la sección 5 que bloqueen el arranque.
3. Proponer la estructura del repo y el flujo mínimo (texto -> IA -> factura sandbox) antes de escribir código.

## 10. Cómo se usa el sandbox de PayPal (referencia)

El sandbox es un entorno de pruebas que replica PayPal real: dinero y cuentas falsas, mismas funciones de API. Si algo funciona aquí, funciona igual en producción cambiando solo las credenciales.

### Dos sitios que no son intercambiables

| Sitio | Para qué | Login |
|---|---|---|
| `developer.paypal.com` | Cuentas sandbox, apps y credenciales de API | Mi login real de PayPal |
| `www.sandbox.paypal.com` | Aprobar y revisar pagos de prueba | Cuenta sandbox generada |

Mi código llama a una tercera URL: la base de la API, `https://api-m.sandbox.paypal.com` (en producción sería `https://api-m.paypal.com`). Mi login real no funciona en sandbox.paypal.com ni al revés.

### Cuentas de prueba

- **Business** = el vendedor (yo, el freelancer que cobra). **Personal** = el comprador (el cliente que paga).
- Se crean por defecto al entrar al Developer Dashboard. Están en *Testing Tools > Sandbox Accounts*. Emails tipo `sb-xxxx@business.example.com`.
- Cada cuenta tiene su propio saldo y se puede recargar o editar desde *View/Edit Account*. La cuenta Personal necesita saldo para pagar.
- Para el video: mostrar al cliente aprobando el pago en sandbox.paypal.com y luego el pago apareciendo en la actividad de la cuenta Business.

### Credenciales

- En *Apps & Credentials > pestaña Sandbox*: usar la **Default Application** o crear una app, y copiar **Client ID** y **Secret**.
- El Secret va **solo en el servidor**, en `.env` (fuera de git). Sandbox y producción tienen claves distintas, así que usar archivos de entorno separados.
- Token OAuth2 a mano:

```bash
curl -X POST https://api-m.sandbox.paypal.com/v1/oauth2/token \
  -u "CLIENT_ID:CLIENT_SECRET" \
  -d "grant_type=client_credentials"
```

- Alternativa recomendada: el SDK de servidor de Node, `@paypal/paypal-server-sdk`, que maneja OAuth2 y la renovación del token.

### Probar errores a propósito (negative testing)

- **Por API:** agregar el header `PayPal-Mock-Response` con `{"mock_application_codes": "<CODIGO>"}` a cualquier petición al sandbox. Solo funciona en `api-m.sandbox.paypal.com`.
  - `INSTRUMENT_DECLINED`: tarjeta rechazada.
  - `DUPLICATE_INVOICE_ID`: `invoice_id` repetido (devuelve 422). Útil para probar que el agente no crea cobros duplicados.
- Cada API acepta su propio conjunto de códigos. Consultar las referencias de errores de Orders v2 y Payments v2.
- **Por cuenta:** en *View/Edit Account > Settings* de una cuenta Business, `Negative Testing = On` hace que todas las transacciones fallen. **Apagarlo al terminar**: si el flujo "se rompe de golpe", revisar esto primero.
- Formato de error de PayPal: `name`, `message`, `details[0].issue`, `debug_id`. Manejar el error según `details[0].issue`, registrar el `debug_id` y mostrar al usuario un mensaje propio, no el `message` crudo.
- Tarjetas de prueba: ver la lista de tarjetas sandbox de PayPal. Cualquier fecha de vencimiento futura sirve; CVV de 4 dígitos para American Express y 3 para las demás.

### Punto abierto: facturas vs. órdenes

La guía anterior cubre **Orders / Checkout**, no facturas. Nuestro plan asume **Invoicing**. Claude Code debe **verificar en la documentación oficial** que Invoicing funciona en sandbox y cómo se consulta el estado de pago (webhooks o consulta periódica). Si no encaja, plan B: crear una orden y generar el enlace de pago, manteniendo el mismo flujo de cara al usuario.
