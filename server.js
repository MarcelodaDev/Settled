import express from 'express';
import { IAError } from './src/ai.js';
import { idiomaDe, m } from './src/i18n.js';
import { claveDeError, PayPalError } from './src/paypal.js';
import cobros from './src/routes/cobros.js';
import consultas from './src/routes/consultas.js';

// Regla del proyecto: solo sandbox. Si alguien apunta a la API real de PayPal,
// el servidor no arranca en lugar de arriesgar dinero real.
const BASE_PAYPAL = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
if (!new URL(BASE_PAYPAL).hostname.endsWith('sandbox.paypal.com')) {
  console.error(`PAYPAL_API_BASE debe ser el sandbox de PayPal (recibido: ${BASE_PAYPAL}).`);
  process.exit(1);
}

const app = express();

// En Render la app va detrás de un proxy: así req.ip es la IP real del
// visitante y los límites de uso funcionan por persona.
app.set('trust proxy', 1);

// Render consulta esta ruta para saber si la app arrancó. Dice qué falta
// configurar, nunca los valores.
app.get('/api/salud', (req, res) => {
  res.json({
    ok: true,
    paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    ia: Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_MODEL),
    entorno: 'sandbox',
  });
});

app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));
// AG Grid se sirve desde node_modules: versión fija en package-lock y sin depender de un CDN en la demo.
app.use('/vendor', express.static('node_modules/ag-grid-community/dist', { index: false }));
app.use('/api/cobros', cobros);
app.use('/api/consultas', consultas);

// Express 5 pasa aquí los errores de las rutas async sin try/catch en cada una.
// Los errores se traducen al idioma de quien hizo la petición.
app.use((error, req, res, next) => {
  const idioma = idiomaDe(req);
  if (error instanceof PayPalError) {
    return res.status(502).json({ error: m(idioma, claveDeError(error)), debug_id: error.debugId });
  }
  if (error instanceof IAError) {
    return res.status(502).json({ error: m(idioma, error.clave) });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: m(idioma, 'servidor.json') });
  }
  console.error(error);
  res.status(500).json({ error: m(idioma, 'servidor.error') });
});

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`Settled en http://localhost:${puerto}`));
