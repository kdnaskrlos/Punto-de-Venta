import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { generarEjemplos } from '../../js/nucleo/ejemplos.js';

test('el generador retirado no devuelve un lote vacío que un almacén anterior pueda aplicar', () => {
  assert.throws(() => generarEjemplos().productos, /Modo prueba retirado/);
});

test('la compatibilidad de Firebase rechaza ambas operaciones incluso con una sesión de administración', async t => {
  const perfil = { uid: 'uid-sintetico', usuario: 'admin', nombre: 'Admin sintético', rol: 'admin', activo: true };
  const llamadasFueraDelArranque = [];
  const metodos = {
    initializeApp: () => ({}), initializeFirestore: () => ({}), getAuth: () => ({}),
    persistentLocalCache: () => ({}), persistentMultipleTabManager: () => ({}),
    onAuthStateChanged: (_auth, cb) => cb({ uid: perfil.uid }),
    doc: (_db, col, id) => ({ col, id }), collection: (_db, col) => ({ col }),
    where: () => null, query: ref => ref,
    onSnapshot(ref, opciones, cb) {
      if (ref.col === 'usuarios') cb({ exists: () => true, data: () => perfil, metadata: { fromCache: false } });
      return () => {};
    },
  };
  const globals = {
    addEventListener: () => {},
    navigator: { onLine: false },
    __sdkPosPruebas(nombre, args) {
      if (metodos[nombre]) return metodos[nombre](...args);
      llamadasFueraDelArranque.push(nombre);
      throw new Error('El SDK simulado no permite ' + nombre);
    },
  };
  for (const [propiedad, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, propiedad);
    Object.defineProperty(globalThis, propiedad, { value, configurable: true });
    t.after(() => original ? Object.defineProperty(globalThis, propiedad, original) : delete globalThis[propiedad]);
  }
  const archivo = new URL('../../js/datos/firebase.js', import.meta.url);
  const fuente = readFileSync(archivo, 'utf8');
  const urls = new Map();
  for (const [, nombres, url] of fuente.matchAll(/import \{ ([^}]+) \} from '(https:\/\/www\.gstatic\.com\/firebasejs\/[^']+)'/g)) {
    const codigo = nombres.split(', ').map(n => `export function ${n}(...args) { return globalThis.__sdkPosPruebas('${n}', args); }`).join('\n');
    urls.set(url, 'data:text/javascript,' + encodeURIComponent(codigo));
  }
  assert.equal(urls.size, 3);
  const hooks = registerHooks({
    resolve(specifier, contexto, siguiente) {
      if (urls.has(specifier)) return { url: urls.get(specifier), shortCircuit: true };
      return siguiente(specifier, contexto);
    },
  });
  t.after(() => hooks.deregister());
  const { crearFirebase } = await import(archivo);
  const almacen = crearFirebase({ projectId: 'demo-pos' });
  assert.equal(await new Promise(resolve => almacen.alCambiarSesion(resolve)).then(s => s.rol), 'admin');
  assert.deepEqual(await almacen.cargarEjemplos(generarEjemplos()), { ok: false, error: 'retirado' });
  assert.deepEqual(await almacen.quitarEjemplos(), { ok: false, error: 'retirado' });
  assert.deepEqual(llamadasFueraDelArranque, []);
});
