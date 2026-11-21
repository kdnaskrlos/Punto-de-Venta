// Elige el almacén: Firebase si config.js tiene apiKey y la URL no pide ?demo; si no, demostración.
import { firebaseConfig } from '../../config.js';
import { crearMemoria } from './memoria.js';
import { semilla } from './semilla.js';
import { generarEjemplos } from '../nucleo/ejemplos.js';
import { tasasVigentes } from '../nucleo/tasas.js';

export const MODO_DEMO = new URLSearchParams(location.search).has('demo') || !firebaseConfig?.apiKey;
// En la demostración se entra directo (sin pantalla de entrada), salvo que la URL pida ?entrar.
export const DEMO_DIRECTO = MODO_DEMO && !new URLSearchParams(location.search).has('entrar');
const CLAVE_DEMO = 'pos-demo-usuario';
export function usuarioDemo() { try { return localStorage.getItem(CLAVE_DEMO) || 'admin'; } catch { return 'admin'; } }
export function recordarUsuarioDemo(u) { try { localStorage.setItem(CLAVE_DEMO, u); } catch { /* sin almacenamiento */ } }

export async function crearAlmacen() {
  if (MODO_DEMO) return crearMemoria(semilla(), { guardarEn: 'pos-demo-datos' });
  const { crearFirebase } = await import('./firebase.js');
  return crearFirebase(firebaseConfig);
}

export async function crearAlmacenPrueba(uid) {
  const proyecto = MODO_DEMO ? 'demo' : firebaseConfig.projectId;
  const ambitoPrueba = 'pos-modo-prueba:' + encodeURIComponent(JSON.stringify([proyecto, uid]));
  const usuario = 'prueba-admin';
  const ajustes = semilla().ajustes;
  const almacen = crearMemoria({ usuarios: [{ usuario, nombre: 'Administración de prueba', rol: 'admin', pin: '' }], ajustes },
    { guardarEn: ambitoPrueba, prueba: true });
  const entrada = await almacen.entrar(usuario, '');
  if (!entrada.ok) return null;
  if (!await almacen.obtener('usuarios', 'prueba-vendedora')) {
    const tasas = tasasVigentes(ajustes.tasas);
    await almacen.cargarEjemplos(generarEjemplos({ formas: ajustes.general.formasPago, tasas, yo: usuario, prefijo: 'prueba' }));
  }
  return { almacen, ambitoPrueba };
}
