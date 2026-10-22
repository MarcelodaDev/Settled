import { Router } from 'express';
import { interpretarConsulta } from '../ai.js';
import { hoyEcuador } from '../cobro.js';
import { ejecutarConsulta, normalizarConsulta, redactarRespuesta } from '../consultas.js';
import { cargarFilas } from '../filas.js';
import { limiteIA } from '../limites.js';

const router = Router();

// Pregunta en español -> la IA elige los filtros -> el código calcula y responde.
// La IA no escribe la respuesta: una cifra mal dicha en un producto de cobros
// cuesta más confianza que lo que aporta una frase más natural.
router.post('/', limiteIA, async (req, res) => {
  const pregunta = typeof req.body?.pregunta === 'string' ? req.body.pregunta.trim() : '';
  if (!pregunta) return res.status(400).json({ error: 'Escribe una pregunta sobre tus cobros.' });
  if (pregunta.length > 300) return res.status(400).json({ error: 'La pregunta es demasiado larga (máximo 300 caracteres).' });

  const hoy = hoyEcuador();
  const [propuesta, { filas }] = await Promise.all([interpretarConsulta(pregunta, hoy), cargarFilas()]);
  const consulta = normalizarConsulta(propuesta);

  if (!consulta.sobre_cobros) {
    return res.json({
      consulta,
      respuesta: 'Solo puedo responder preguntas sobre tus cobros: quién te debe, qué entró, qué está vencido o cuánto facturaste.',
      ids: [],
    });
  }

  const resultado = ejecutarConsulta(consulta, filas, hoy);
  res.json({
    consulta,
    periodo: resultado.rango,
    respuesta: redactarRespuesta(consulta, resultado),
    total: resultado.total,
    cantidad: resultado.cantidad,
    por_cliente: resultado.porCliente,
    ids: resultado.coincidencias.map((c) => c.id),
  });
});

export default router;
