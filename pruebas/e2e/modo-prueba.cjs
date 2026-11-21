// El navegador usa el adaptador Firebase real con un SDK doble que registra y rechaza escrituras.
const { casos, URL_BASE } = require('./_servidor.cjs');

const modulos = {
  app: `export const initializeApp = () => ({}), deleteApp = () => Promise.resolve();`,
  auth: `
    export const getAuth = () => ({}), EmailAuthProvider = {};
    export function onAuthStateChanged(auth, cb) {
      window.cambiarSesionDoble = cb;
      queueMicrotask(() => cb({ uid: 'uid-real' }));
    }
    export const signOut = () => window.escrituraDoble('signOut');
    export const signInWithEmailAndPassword = signOut, createUserWithEmailAndPassword = signOut,
      updatePassword = signOut, reauthenticateWithCredential = signOut;
  `,
  firestore: `
    const perfil = { uid: 'uid-real', usuario: 'real', nombre: 'Administración real', rol: 'admin', activo: true };
    const datos = {
      productos: [{ id: 'prueba-XO-N-S', sku: 'prueba-XO-N-S', nombre: 'Prenda operativa', existencia: 17 }],
      clientes: [{ id: '584125550100', telefono: '584125550100', nombre: 'Cliente operativo' }],
      apartados: [{ id: 'apartado-historico', demo: true, estado: 'pendiente' }],
      ventas: [{ id: 'venta-real', numero: 'V-0001', fecha: new Date().toISOString(), usuario: 'real', estado: 'ok', total: 35000, lineas: [] }],
    };
    const snap = (id, d) => ({ id, data: () => d, exists: () => !!d, metadata: { fromCache: false, hasPendingWrites: false } });
    const leer = ref => snap(ref.id, ref.n === 'usuarios' ? perfil : ref.n === 'sistema' ? { iniciado: true } : datos[ref.n]?.find(d => d.id === ref.id));
    const listar = ref => ({ docs: (datos[ref.n] || [])
      .filter(d => (ref.filtros || []).every(([campo, op, valor]) => op === '==' ? d[campo] === valor : d[campo] >= valor))
      .map(d => snap(d.id, d)) });
    export const initializeFirestore = () => ({}), persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({});
    export const doc = (db, n, id) => ({ n, id }), collection = (db, n) => ({ n }),
      query = (ref, ...filtros) => ({ ...ref, filtros: [...(ref.filtros || []), ...filtros] }), where = (...filtro) => filtro;
    export function onSnapshot(ref, opciones, cb = opciones) {
      if (typeof opciones === 'function') cb = opciones;
      let activo = true;
      queueMicrotask(() => { if (activo) cb(ref.id ? leer(ref) : listar(ref)); });
      return () => { activo = false; };
    }
    export const getDoc = async ref => leer(ref), getDocFromCache = getDoc, getDocFromServer = getDoc, getDocs = async ref => listar(ref);
    export const waitForPendingWrites = () => new Promise(() => {}), serverTimestamp = () => null,
      increment = n => n, arrayUnion = (...x) => x, documentId = () => '__name__';
    export const writeBatch = () => window.escrituraDoble('writeBatch'), runTransaction = () => window.escrituraDoble('runTransaction');
    export const setDoc = () => window.escrituraDoble('setDoc'), updateDoc = () => window.escrituraDoble('updateDoc');
  `,
};

async function abrirConDoble(env, ruta = '/ajustes') {
  const contexto = await env.nav.newContext({ serviceWorkers: 'block' });
  await contexto.addInitScript(() => {
    window.escriturasDobles = [];
    window.escrituraDoble = metodo => { window.escriturasDobles.push(metodo); throw new Error(metodo); };
  });
  await contexto.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.origin === new URL(URL_BASE).origin) {
      if (u.pathname === '/config.js') return r.fulfill({ contentType: 'text/javascript', body: `export const firebaseConfig = { apiKey: 'doble', projectId: 'doble-pos' };` });
      return r.continue();
    }
    const modulo = /^\/firebasejs\/[^/]+\/firebase-(app|auth|firestore)\.js$/.exec(u.pathname)?.[1];
    if (u.hostname === 'www.gstatic.com' && modulo) {
      return r.fulfill({ contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: modulos[modulo] });
    }
    return r.abort();
  });
  const p = await contexto.newPage();
  await p.goto(URL_BASE + '#' + ruta);
  await p.waitForFunction(() => window.__pos?.ctx.sesion?.uid === 'uid-real');
  await p.waitForSelector('#modo-prueba');
  return p;
}

casos('modo-prueba', [
  ['Aísla las operaciones, rechaza administrar ejemplos desde Firebase y restaura el contexto real', async (env, a) => {
    const p = await abrirConDoble(env);
    const originales = await p.evaluate(async () => {
      const c = window.__pos.ctx;
      window.contextoReal = c;
      c.carrito = { lineas: [{ sku: 'prueba-XO-N-S', cantidad: 2 }], pagos: [{ monto: 12345 }], ventaId: 'venta-real' };
      const borrador = JSON.stringify({ c: c.carrito, en: Date.now() });
      const pendientes = JSON.stringify([{ id: 'pendiente-real', que: 'venta' }]);
      localStorage.setItem('pos-venta-real', borrador);
      localStorage.setItem('pos-pendientes-real', pendientes);
      return { borrador, pendientes, guardas: [await c.almacen.cargarEjemplos({}), await c.almacen.quitarEjemplos()] };
    });
    a.deepStrictEqual(originales.guardas, [{ ok: false, error: 'modo-prueba' }, { ok: false, error: 'modo-prueba' }]);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    a.strictEqual(await p.$('#aviso-demo:not([hidden])'), null);
    const local = await p.evaluate(async () => {
      const c = window.__pos.ctx, s = c.almacen;
      window.contextoPrueba = c;
      const cliente = { telefono: '584125550100', nombre: 'Cliente de práctica' };
      const sku = 'prueba-XO-N-S';
      c.carrito = { lineas: [{ sku, cantidad: 1 }], cliente, descuento: null };
      window.dispatchEvent(new CustomEvent('pos:carrito'));
      const { anotarPendiente } = await import('/js/datos/pendientes.js');
      anotarPendiente(c, { id: 'pendiente-prueba', que: 'venta' });
      const { id: caja } = await s.abrirCaja({ COP: 1000 });
      const venta = { id: s.nuevoId(), fecha: new Date().toISOString(), cliente, lineas: [{ sku, cantidad: 1 }], total: 35000 };
      const vendida = await s.guardarVenta(venta);
      const anulada = await s.anularVenta(venta.id, 'Ensayo');
      const apartado = await s.guardarApartado({ ...venta, id: s.nuevoId(), abonos: [] });
      const guardado = await s.guardarCliente(cliente);
      const cerrada = await s.cerrarCaja(caja, { totalCop: 0 });
      return { separados: c.almacen !== window.contextoReal.almacen, cajera: (await s.obtener('usuarios', 'prueba-vendedora')).nombre,
        comisiones: s._estado('comisiones').size, claves: [...s._estado('clientes').keys()], ids: [caja, venta.id],
        numero: (await s.obtener('ventas', venta.id)).numero,
        operaciones: [vendida, anulada, apartado, guardado, cerrada].map(r => r.ok), borradorLocal: localStorage.getItem(c.ambitoPrueba + ':carrito'),
        pendientesLocales: localStorage.getItem(c.ambitoPrueba + ':pendientes'),
        borrador: localStorage.getItem('pos-venta-real'), pendientes: localStorage.getItem('pos-pendientes-real') };
    });
    a.ok(local.separados);
    a.strictEqual(local.cajera, 'Vendedora prueba');
    a.ok(local.comisiones > 0);
    a.ok(local.claves.includes('prueba-584125550100') && !local.claves.includes('584125550100'));
    a.ok(local.ids.every(id => id.startsWith('prueba-')));
    a.match(local.numero, /^P-/);
    a.ok(local.operaciones.every(Boolean));
    a.ok(local.borradorLocal);
    a.strictEqual(JSON.parse(local.pendientesLocales)[0].id, 'pendiente-prueba');
    a.strictEqual(local.borrador, originales.borrador);
    a.strictEqual(local.pendientes, originales.pendientes);
    await p.click('.side [data-ruta="/reportes"]');
    await p.waitForSelector('.vista[data-ruta="/reportes"]');
    await p.click('#salir-prueba');
    await p.waitForSelector('.vista[data-ruta="/ajustes"]');
    const restaurado = await p.evaluate(async () => {
      const c = window.__pos.ctx;
      const tardia = await window.contextoPrueba.almacen.guardarCliente({ telefono: '584125550100', nombre: 'Escritura tardía' });
      return { mismaSesion: c === window.contextoReal && c.sesion.uid === 'uid-real', carrito: c.carrito, tardia,
        cliente: (await c.almacen.obtener('clientes', '584125550100')).nombre,
        stock: (await c.almacen.obtener('productos', 'prueba-XO-N-S')).existencia,
        historico: !!await c.almacen.obtener('apartados', 'apartado-historico'),
        pendientes: localStorage.getItem('pos-pendientes-real'), escrituras: window.escriturasDobles };
    });
    a.ok(restaurado.mismaSesion && restaurado.historico);
    a.deepStrictEqual(restaurado.carrito, JSON.parse(originales.borrador).c);
    a.deepStrictEqual(restaurado.tardia, { ok: false, error: 'sesion' });
    a.strictEqual(restaurado.cliente, 'Cliente operativo');
    a.strictEqual(restaurado.stock, 17);
    a.strictEqual(restaurado.pendientes, originales.pendientes);
    a.deepStrictEqual(restaurado.escrituras, []);
  }],
  ['Persiste ventas de práctica al recargar y retira solo el conjunto local', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    const id = await p.evaluate(async () => {
      const s = window.__pos.ctx.almacen;
      await s.abrirCaja({}, { tipo: 'personal' });
      const id = s.nuevoId();
      const r = await s.guardarVenta({ id, fecha: new Date().toISOString(), cliente: { nombre: 'Ensayo' }, lineas: [{ sku: 'prueba-XO-N-S', cantidad: 1 }], total: 35000 });
      if (!r.ok) throw new Error('No se guardó la venta de prueba');
      return id;
    });
    await p.reload();
    await p.waitForFunction(() => window.__pos.ctx.sesion?.uid === 'uid-real');
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    a.ok(await p.evaluate(id => window.__pos.ctx.almacen.obtener('ventas', id), id));
    await p.click('#modo-prueba');
    await p.click('#quitar-ejemplos');
    await p.waitForSelector('#modo-prueba:not(.on)');
    a.ok(await p.evaluate(() => window.__pos.ctx.almacen.obtener('apartados', 'apartado-historico')));
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    a.strictEqual(await p.evaluate(id => window.__pos.ctx.almacen.obtener('ventas', id), id), null);
    a.ok(await p.evaluate(() => window.__pos.ctx.almacen.obtener('usuarios', 'prueba-vendedora')));
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
  }],
  ['Termina la práctica cuando se pierde la sesión operativa', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.evaluate(() => {
      window.almacenPruebaCerrado = window.__pos.ctx.almacen;
      window.cambiarSesionDoble(null);
    });
    await p.waitForSelector('#entrar-usuario');
    a.ok(await p.evaluate(() => !window.__pos.ctx.ambitoPrueba && !window.__pos.ctx.sesion));
    a.deepStrictEqual(await p.evaluate(() => window.almacenPruebaCerrado.quitarEjemplos()), { ok: false, error: 'sesion' });
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
  }],
]);
