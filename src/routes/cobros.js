import { Router } from 'express';
import { interpretarCobro } from '../ai.js';
import { generarNumero, hoyEcuador, normalizarCobro, numeroValido } from '../cobro.js';
import { crearYEnviar, obtenerFactura, resumir } from '../paypal.js';
import * as store from '../store.js';

const router = Router();

// Paso 1: la IA propone. Esta ruta nunca crea nada en PayPal.
router.post('/interpretar', async (req, res) => {
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto) return res.status(400).json({ error: 'Escribe qué quieres cobrar.' });
  if (texto.length > 1000) return res.status(400).json({ error: 'La instrucción es demasiado larga (máximo 1000 caracteres).' });

  const propuesta = await interpretarCobro(texto, hoyEcuador());
  const { cobro, errores } = normalizarCobro(propuesta);

  res.json({
    cobro,
    numero: generarNumero(),
    advertencias: Array.isArray(propuesta.advertencias) ? propuesta.advertencias.slice(0, 6) : [],
    errores,
  });
});

// Paso 2: el usuario confirmó (y quizá corrigió) la propuesta. Se valida de
// nuevo aquí, porque lo que llega del navegador no es de fiar.
router.post('/', async (req, res) => {
  const { cobro, errores } = normalizarCobro(req.body?.cobro);
  if (errores.length) return res.status(400).json({ error: errores[0], errores });

  const numero = req.body?.numero;
  if (!numeroValido(numero)) return res.status(400).json({ error: 'Número de factura no válido.' });

  const factura = await crearYEnviar(cobro, numero);
  const resumen = resumir(factura);

  await store.guardar(resumen.id, {
    numero,
    texto_original: typeof req.body?.texto_original === 'string' ? req.body.texto_original.slice(0, 1000) : null,
    creado: new Date().toISOString(),
  });

  res.status(201).json(resumen);
});

// Estado actual de una factura, leído siempre de PayPal.
router.get('/:id', async (req, res) => {
  res.json(resumir(await obtenerFactura(req.params.id)));
});

export default router;
