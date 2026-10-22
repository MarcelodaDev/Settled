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

## Cómo correrlo localmente

Requisitos: Node.js 20 o superior, una cuenta developer de PayPal y una API key de OpenRouter.

```bash
cp .env.example .env   # luego rellena las claves
npm install
npm start
```

*(Los comandos `npm` estarán disponibles cuando se agregue el servidor.)*

## Licencia

[MIT](LICENSE)
