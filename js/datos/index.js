// Elige el almacén: Firebase si config.js tiene apiKey y la URL no pide ?demo; si no, demostración.
import { firebaseConfig } from '../../config.js';
import { crearMemoria } from './memoria.js';
import { semilla } from './semilla.js';

export const MODO_DEMO = new URLSearchParams(location.search).has('demo') || !firebaseConfig?.apiKey;

export async function crearAlmacen() {
  if (MODO_DEMO) return crearMemoria(semilla());
  const { crearFirebase } = await import('./firebase.js');
  return crearFirebase(firebaseConfig);
}
