// Elige el almacén: Firebase si config.js tiene apiKey y la URL no pide ?demo; si no, demostración.
import { firebaseConfig } from '../../config.js';
import { crearMemoria } from './memoria.js';
import { semilla } from './semilla.js';
import { generarEjemplos } from '../nucleo/ejemplos.js';
import { tasasVigentes } from '../nucleo/tasas.js';
import { nuevoId } from './contrato.js';

export const MODO_DEMO = new URLSearchParams(location.search).has('demo') || !firebaseConfig?.apiKey;
// En la demostración se entra directo (sin pantalla de entrada), salvo que la URL pida ?entrar.
export const DEMO_DIRECTO = MODO_DEMO && !new URLSearchParams(location.search).has('entrar');
const CLAVE_DEMO = 'pos-demo-usuario';
export function usuarioDemo() { try { return localStorage.getItem(CLAVE_DEMO) || 'admin'; } catch { return 'admin'; } }
export function recordarUsuarioDemo(u) { try { localStorage.setItem(CLAVE_DEMO, u); } catch { /* sin almacenamiento */ } }

export async function crearAlmacen(opciones) {
  if (MODO_DEMO) return crearMemoria(semilla(), { guardarEn: 'pos-demo-datos' });
  const { crearFirebase } = await import('./firebase.js');
  return crearFirebase(firebaseConfig, opciones);
}

export function cuentaDePrueba(uid) {
  const proyecto = MODO_DEMO ? 'demo' : firebaseConfig.projectId;
  return 'pos-modo-prueba:' + encodeURIComponent(JSON.stringify([proyecto, uid]));
}

export async function crearAlmacenPrueba(uid) {
  const cuenta = cuentaDePrueba(uid);
  const claveGeneracion = cuenta + ':generacion';
  let generacion = null;
  try { generacion = localStorage.getItem(claveGeneracion); } catch { /* práctica sin persistencia */ }
  // El almacén que retira los ejemplos adopta la nueva clave. Las demás pestañas conservan la anterior.
  const ambitoActual = () => generacion === null ? cuenta : cuenta + ':datos:' + generacion;
  const ambitoPrueba = ambitoActual();
  const vigente = () => localStorage.getItem(claveGeneracion) === generacion;
  const retirar = () => {
    const anterior = ambitoActual();
    const nueva = nuevoId();
    try {
      if (!vigente()) return null;
      localStorage.setItem(claveGeneracion, nueva);
    } catch { return null; }
    generacion = nueva;
    try {
      for (const sufijo of ['', ':carrito', ':pendientes', ':dispositivo', ':recibo-alto']) localStorage.removeItem(anterior + sufijo);
    } catch { /* el ámbito anterior ya no está activo */ }
    return ambitoActual();
  };
  const usuario = 'prueba-admin';
  const ajustes = semilla().ajustes;
  const almacen = crearMemoria({ usuarios: [{ usuario, nombre: 'Administración de prueba', rol: 'admin', pin: '' }], ajustes },
    { guardarEn: ambitoPrueba, prueba: true, vigente, retirar });
  const entrada = await almacen.entrar(usuario, '');
  if (!entrada.ok) return null;
  // Una generación creada por «Quitar ejemplos» puede contener datos nuevos sin la vendedora de ejemplo.
  if (generacion === null && !await almacen.obtener('usuarios', 'prueba-vendedora')) {
    const tasas = tasasVigentes(ajustes.tasas);
    await almacen.cargarEjemplos(generarEjemplos({ formas: ajustes.general.formasPago, tasas, yo: usuario, prefijo: 'prueba' }));
  }
  return { almacen, ambitoPrueba };
}
