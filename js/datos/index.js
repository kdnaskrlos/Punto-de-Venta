// Elige el almacén: Firebase si config.js tiene apiKey y la URL no pide ?demo; si no, demostración.
import { firebaseConfig } from '../../config.js';
import { crearMemoria } from './memoria.js';
import { semilla } from './semilla.js';

export const MODO_DEMO = new URLSearchParams(location.search).has('demo') || !firebaseConfig?.apiKey;
// En la demostración se entra directo (sin pantalla de entrada), salvo que la URL pida ?entrar.
export const DEMO_DIRECTO = MODO_DEMO && !new URLSearchParams(location.search).has('entrar');
const CLAVE_DEMO = 'pos-demo-usuario';
export function usuarioDemo() { try { return localStorage.getItem(CLAVE_DEMO) || 'admin'; } catch { return 'admin'; } }
export function recordarUsuarioDemo(u) { try { localStorage.setItem(CLAVE_DEMO, u); } catch { /* sin almacenamiento */ } }

export async function crearAlmacen() {
  if (MODO_DEMO) return crearMemoria(semilla());
  const { crearFirebase } = await import('./firebase.js');
  return crearFirebase(firebaseConfig);
}
