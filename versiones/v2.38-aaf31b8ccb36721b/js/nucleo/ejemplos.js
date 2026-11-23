// Importaciones históricas de v2.35. Una carga antigua debe detenerse antes
// de que su almacén interprete un lote vacío como permiso para quitar ejemplos.
export const VENDEDORA_PRUEBA = null;

const loteRetirado = Object.freeze({
  get productos() { throw new Error('Modo prueba retirado'); },
});

export function generarEjemplos() { return loteRetirado; }
