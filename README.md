# Cobrador con IA para freelancers

Escribe en español lo que quieres cobrar, por ejemplo *"Cóbrale $300 a Juan por el sitio web, 50% de anticipo"*, y la app:

1. Interpreta la instrucción con IA (cliente, monto, concepto, condiciones de pago).
2. Te muestra la propuesta para que la confirmes. **Nada se crea sin tu confirmación.**
3. Crea la factura en PayPal (sandbox) con su enlace de pago.
4. Sigue el estado (enviada, pagada, vencida) en un panel de cobros.
5. Redacta recordatorios de pago y responde preguntas como "¿quién me debe?".

Proyecto para la hackatón *Build What's Next with PayPal and AI*. **Solo usa el sandbox de PayPal: no mueve dinero real.**

> Estado: en desarrollo. Este README se actualiza a medida que avanza el proyecto.

## Tecnologías

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS y JavaScript, con [AG Grid](https://www.ag-grid.com/) para el panel de cobros
- **Pagos:** PayPal Invoicing API (sandbox)
- **IA:** modelos vía [OpenRouter](https://openrouter.ai/) con tool calling
- **Hosting:** Render

## Cómo funciona

1. **Instrucción.** El texto va a `POST /api/cobros/interpretar`. La IA no responde con texto libre: rellena una función `proponer_cobro` con un esquema fijo (tool calling forzado). Tiene prohibido inventar correos, montos o fechas, y lo que falta lo devuelve como advertencias.
2. **Revisión.** El servidor vuelve a validar la propuesta en código y la interfaz la muestra como formulario editable, con un resumen en una frase de lo que va a pasar. Esta ruta **nunca** toca PayPal.
3. **Factura.** Al confirmar, `POST /api/cobros` valida otra vez, crea el borrador en la Invoicing API v2, lo envía y devuelve el enlace de pago (`detail.metadata.recipient_view_url`).
   - El anticipo se implementa como pago parcial con monto mínimo (`configuration.partial_payment`).
   - Cada propuesta lleva su propio número de factura. Si la confirmación se envía dos veces, PayPal rechaza el número repetido (`DUPLICATE_INVOICE_NUMBER`) y no se crea un duplicado.
4. **Estado.** `GET /api/cobros/:id` consulta el estado directamente a PayPal, que es la fuente de verdad. `data/cobros.json` solo guarda extras, como el texto original.
5. **Panel de cobros.** `GET /api/cobros` lista las facturas de la cuenta desde PayPal.
   - El listado de PayPal no incluye el concepto ni el enlace de pago. Esos datos no cambian, así que se piden una vez por factura y quedan en memoria; el estado y los montos se leen frescos en cada carga.
   - "Vencida" no es un estado de PayPal: el servidor la calcula como factura abierta con la fecha límite pasada (hora de Ecuador).

6. **Recordatorios.** Al pulsar una factura del panel se abre su detalle, y ahí la IA redacta un recordatorio (`POST /api/cobros/:id/recordatorio`).
   - El **tono lo decide el código** según el atraso: amable antes de vencer, firme hasta 14 días de atraso y último aviso a partir de ahí. El freelancer puede cambiarlo.
   - La factura se lee **fresca de PayPal** al redactar: nunca se recuerda una factura pagada ni un monto desactualizado.
   - La situación del plazo ("vence en 15 días", "lleva 20 días de atraso") la calcula el servidor y se le da redactada a la IA, para que no pueda inventar atrasos.
   - La IA escribe `{{enlace}}` en lugar de la URL y el servidor pone el enlace real de PayPal en su propia línea: un modelo puede alterar una URL larga.
   - El freelancer edita el texto y lo envía por su canal: copiar, WhatsApp o correo. Cada envío queda en el historial (`POST /api/cobros/:id/recordatorios`), un dato que PayPal no guarda.

7. **Preguntas en español.** En el panel puedes preguntar "¿quién me debe?", "¿cuánto entró esta semana?" o "¿qué facturas están vencidas?" (`POST /api/consultas`).
   - **La IA no hace cuentas.** Solo traduce la pregunta a una consulta estructurada (`consultar_cobros`): qué medir, qué facturas, qué cliente, qué periodo.
   - **El código calcula todo**: periodos en hora de Ecuador (semanas de lunes a domingo), sumas y agrupación por cliente. Lo cobrado se suma por la fecha de cada pago, así que un anticipo cuenta en la semana en que entró.
   - **La respuesta también la escribe el código** con las cifras calculadas. Probamos que la IA la redactara y en tres pruebas cambió el sentido de los datos; en un producto de cobros, una cifra mal dicha no compensa una frase más natural.
   - **La tabla se filtra a las facturas que sostienen la respuesta**, y debajo se muestra cómo se entendió la pregunta ("Entendí: pagos recibidos · esta semana").

## Panel con AG Grid

El panel usa [AG Grid Community](https://www.ag-grid.com/) 36.2.0, servido desde `node_modules` (versión fija, sin CDN).

- **Tema propio** sobre Quartz (`themeQuartz.withParams`): mismo papel, tinta y filetes que el resto de la interfaz, sin bordes redondeados ni bordes de columna.
- **Celdas personalizadas** con nodos DOM: cliente y concepto en dos líneas, estado con tono según urgencia ("Vencida hace N días", "El cliente la abrió").
- **Orden por urgencia** con un comparador propio: primero lo más atrasado.
- **Filtro rápido** para la búsqueda y **filtro externo** por estado (Todas, Por cobrar, Vencidas, Pagadas) y por las facturas de la última pregunta. No se usan los menús de filtro por columna, que AG Grid muestra en inglés.
- **Fila de totales fija** abajo, que suma solo lo que pasa los filtros.
- **Columnas adaptables**: según el ancho real de la tabla se ocultan columnas secundarias en orden de prioridad, en lugar de forzar scroll horizontal.

## Uso de IA

- **Modelo:** `anthropic/claude-haiku-5.5` vía OpenRouter (se puede cambiar en `OPENROUTER_MODEL`).
- **Para qué:**
  - Convertir instrucciones en español a datos de factura estructurados, normalizar el concepto como línea de factura y señalar datos faltantes o ambiguos (por ejemplo, monedas distintas de USD).
  - Redactar recordatorios de pago en el tono que corresponde al atraso, con los datos reales de la factura en PayPal.
  - Entender preguntas en español sobre los cobros y convertirlas en una consulta que el servidor ejecuta.
- **Cómo:** siempre con tool calling forzado (`proponer_cobro`, `redactar_recordatorio`, `consultar_cobros`), así que la respuesta tiene un esquema fijo que el servidor valida. La IA nunca calcula montos ni fechas: eso lo hace el código.

## Cómo correrlo localmente

Requisitos:

- Node.js 22.9 o superior
- Una cuenta developer de PayPal, con las credenciales de sandbox en *Apps & Credentials*
- Una API key de [OpenRouter](https://openrouter.ai/keys)

```bash
cp .env.example .env   # luego rellena las claves
npm install
npm start              # http://localhost:3000  (npm run dev recarga al guardar)
```

Para probar un pago, abre el enlace de la factura **en un navegador normal (Chrome, Firefox…)** e inicia sesión con tu cuenta **Personal** de sandbox (*Testing Tools > Sandbox Accounts* en developer.paypal.com). PayPal abre una ventana emergente para confirmar el pago: si el navegador la bloquea, al pulsar "Pagar" no pasa nada.

## Licencia

[MIT](LICENSE)
