import { Router } from 'express';
import { interpretarConsulta } from '../ai.js';
import { hoyEcuador } from '../cobro.js';
import { ejecutarConsulta, normalizarConsulta, redactarRespuesta } from '../consultas.js';
import { cargarFilas } from '../filas.js';
import { idiomaDe, m } from '../i18n.js';
import { limiteIA } from '../limites.js';

const router = Router();

// Pregunta en español -> la IA elige los filtros -> el código calcula y responde.
// La IA no escribe la respuesta: una cifra mal dicha en un producto de cobros
// cuesta más confianza que lo que aporta una frase más natural.
router.post('/', limiteIA, async (req, res) => {
  const idioma = idiomaDe(req);
  const pregunta = typeof req.body?.pregunta === 'string' ? req.body.pregunta.trim() : '';
  if (!pregunta) return res.status(400).json({ error: m(idioma, 'consulta.vacia') });
  if (pregunta.length > 300) return res.status(400).json({ error: m(idioma, 'consulta.larga') });

  const hoy = hoyEcuador();
  const [propuesta, { filas }] = await Promise.all([interpretarConsulta(pregunta, hoy), cargarFilas()]);
  const consulta = normalizarConsulta(propuesta);

  if (!consulta.sobre_cobros) {
    return res.json({
      consulta,
      respuesta: m(idioma, 'consulta.fuera_de_tema'),
      ids: [],
    });
  }

  const resultado = ejecutarConsulta(consulta, filas, hoy, idioma);
  res.json({
    consulta,
    periodo: resultado.rango,
    respuesta: redactarRespuesta(consulta, resultado, idioma),
    total: resultado.total,
    cantidad: resultado.cantidad,
    por_cliente: resultado.porCliente,
    ids: resultado.ids,
  });
});

export default router;
