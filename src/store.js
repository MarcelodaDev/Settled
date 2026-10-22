// Almacén local de "extras": lo que PayPal no guarda (el texto original del
// freelancer y, más adelante, los recordatorios). PayPal sigue siendo la fuente
// de verdad; si este archivo se borra (disco efímero de Render), no se pierde
// ninguna factura.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ARCHIVO = path.resolve('data', 'cobros.json');

let cola = Promise.resolve(); // serializa escrituras para no pisar cambios

async function leerTodo() {
  try {
    return JSON.parse(await readFile(ARCHIVO, 'utf8'));
  } catch {
    return {};
  }
}

export function leer(id) {
  return leerTodo().then((todo) => todo[id] ?? null);
}

export function guardar(id, datos) {
  cola = cola.then(async () => {
    const todo = await leerTodo();
    todo[id] = { ...todo[id], ...datos };
    await mkdir(path.dirname(ARCHIVO), { recursive: true });
    await writeFile(ARCHIVO, JSON.stringify(todo, null, 2));
  });
  return cola;
}
