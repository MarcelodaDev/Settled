import express from 'express';
import { IAError } from './src/ai.js';
import { mensajeParaUsuario, PayPalError } from './src/paypal.js';
import cobros from './src/routes/cobros.js';
import consultas from './src/routes/consultas.js';

const app = express();

app.use(express.json({ limit: '20kb' }));
app.use(express.static('public'));
// AG Grid se sirve desde node_modules: versión fija en package-lock y sin depender de un CDN en la demo.
app.use('/vendor', express.static('node_modules/ag-grid-community/dist', { index: false }));
app.use('/api/cobros', cobros);
app.use('/api/consultas', consultas);

// Express 5 pasa aquí los errores de las rutas async sin try/catch en cada una.
app.use((error, req, res, next) => {
  if (error instanceof PayPalError) {
    return res.status(502).json({ error: mensajeParaUsuario(error), debug_id: error.debugId });
  }
  if (error instanceof IAError) {
    return res.status(502).json({ error: error.message });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'La petición no es JSON válido.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Algo salió mal en el servidor.' });
});

const puerto = process.env.PORT || 3000;
app.listen(puerto, () => console.log(`Cobrador con IA en http://localhost:${puerto}`));
