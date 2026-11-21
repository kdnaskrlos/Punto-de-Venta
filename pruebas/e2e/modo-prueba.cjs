// El navegador usa el adaptador Firebase real con un SDK doble que registra y rechaza escrituras.
const { casos, URL_BASE } = require('./_servidor.cjs');

const modulos = {
  app: `export const initializeApp = () => ({}), deleteApp = () => Promise.resolve();`,
  auth: `
    export const getAuth = () => ({}), EmailAuthProvider = {};
    export function onAuthStateChanged(auth, cb) {
      window.cambiarSesionDoble = user => { auth.currentUser = user; cb(user); };
      queueMicrotask(() => window.cambiarSesionDoble({ uid: 'uid-real' }));
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
    const filas = nombre => window.datosDobles[nombre] ??
      (nombre === 'ventas' && window.ventaSinNumeroDoble ? [...datos.ventas, window.ventaSinNumeroDoble] : datos[nombre] ?? []);
    const leer = ref => ({ ...snap(ref.id, ref.n === 'usuarios'
      ? (ref.id === perfil.uid ? perfil : window.perfilesDobles[ref.id])
      : ref.n === 'sistema' ? { iniciado: true } : filas(ref.n).find(d => d.id === ref.id)), ref });
    const campoDe = (d, campo) => campo.split('.').reduce((obj, key) => obj?.[key], d);
    const listar = ref => ({ docs: filas(ref.n)
      .filter(d => (ref.filtros || []).every(([campo, op, valor]) => op === '==' ? campoDe(d, campo) === valor : campoDe(d, campo) >= valor))
      .map(d => snap(d.id, d)) });
    export const initializeFirestore = () => ({}), persistentLocalCache = () => ({}), persistentMultipleTabManager = () => ({});
    export const doc = (db, n, id) => ({ n, id }), collection = (db, n) => ({ n }),
      query = (ref, ...filtros) => ({ ...ref, filtros: [...(ref.filtros || []), ...filtros] }), where = (...filtro) => filtro;
    const observadores = new Set();
    window.publicarDoble = nombre => { for (const observar of observadores) observar(nombre); };
    export function onSnapshot(ref, opciones, cb = opciones) {
      if (typeof opciones === 'function') cb = opciones;
      const observar = nombre => {
        if (nombre && nombre !== ref.n) return;
        if (ref.n === 'usuarios' && ref.id === window.diferirPerfil) return;
        cb(ref.id ? leer(ref) : { ...listar(ref), metadata: { fromCache: window.coleccionesEnCache.has(ref.n), hasPendingWrites: false } });
      };
      observadores.add(observar);
      queueMicrotask(() => { if (observadores.has(observar)) observar(); });
      return () => observadores.delete(observar);
    }
    export async function getDoc(ref) {
      if (window.diferirLectura === ref.n) {
        await new Promise((resolve, reject) => { window.liberarLectura = { resolve, reject }; });
        window.lecturaLiberada = ref.n;
      }
      return leer(ref);
    }
    export const getDocFromCache = getDoc, getDocFromServer = getDoc, getDocs = async ref => listar(ref);
    export async function getDocsFromServer(ref) {
      window.lecturasServidorDobles.push(ref.n);
      if (ref.n === 'cajas' && window.diferirCajas) await new Promise(resolve => { window.liberarCajas = resolve; });
      return listar(ref);
    }
    export const waitForPendingWrites = () => new Promise((resolve, reject) => {
      if (window.diferirSubidas) window.liberarSubidas = { resolve, reject };
      if (window.subidasListas) resolve();
    }), serverTimestamp = () => null,
      increment = n => n, arrayUnion = (...x) => x, documentId = () => '__name__';
    export function writeBatch() {
      if (!window.cerrarCajaDoble && !window.diferirLote) return window.escrituraDoble('writeBatch');
      const cambios = [];
      return {
        update: (ref, campos) => cambios.push({ ref, campos }),
        delete: () => {},
        set: (ref, campos) => cambios.push({ ref, campos }),
        async commit() {
          if (window.diferirLote) {
            window.lotesEnviados.push(cambios);
            await new Promise((resolve, reject) => { window.liberarLote = { resolve, reject }; });
            return;
          }
          for (const { ref, campos } of cambios) {
            if (ref.n === 'eventos') continue;
            if (ref.n !== 'cajas' || campos.estado !== 'cerrada') window.escrituraDoble('writeBatch inesperado');
            Object.assign(filas('cajas').find(d => d.id === ref.id), campos);
            window.cajasCerradasDobles.push(ref.id);
          }
          window.publicarDoble('cajas');
        }
      };
    }
    export async function runTransaction(db, operacion) {
      if (!window.transaccionDoble) return window.escrituraDoble('runTransaction');
      const cambios = [];
      const r = await operacion({
        get: getDoc,
        set: (ref, campos) => cambios.push({ ref, campos }),
        update: (ref, campos) => cambios.push({ ref, campos }),
      });
      if (cambios.length) {
        window.transaccionesEnviadas.push(cambios);
        await new Promise((resolve, reject) => { window.liberarTransaccion = { resolve, reject }; });
      }
      return r;
    }
    export const setDoc = async (ref, campos) => {
      if (!window.aceptarCostos || ref.n !== 'costosVenta') return window.escrituraDoble('setDoc');
      window.costosEnviados.push(campos);
    };
    export const updateDoc = () => window.escrituraDoble('updateDoc');
  `,
};

async function abrirConDoble(env, ruta = '/ajustes') {
  const contexto = await env.nav.newContext({ serviceWorkers: 'block' });
  await contexto.addInitScript(() => {
    window.escriturasDobles = [];
    window.datosDobles = {};
    window.lecturasServidorDobles = [];
    window.cajasCerradasDobles = [];
    window.costosEnviados = [];
    window.lotesEnviados = [];
    window.transaccionesEnviadas = [];
    window.perfilesDobles = { 'uid-otra': { uid: 'uid-otra', usuario: 'otra', nombre: 'Otra administración', rol: 'admin', activo: true } };
    window.coleccionesEnCache = new Set();
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
  p.setDefaultTimeout(6000);
  await p.goto(URL_BASE + '#' + ruta);
  await p.waitForFunction(() => window.__pos?.ctx.sesion?.uid === 'uid-real');
  await p.waitForSelector('#modo-prueba');
  return p;
}

async function entrarEnPractica(p) {
  await p.click('#modo-prueba');
  await p.waitForSelector('#aviso-prueba:not([hidden])');
}

async function prepararCobroReal(p) {
  await p.evaluate(() => {
    const c = window.__pos.ctx;
    const sku = 'prueba-XO-N-S';
    window.datosDobles.productos = [{ ...c.productos[sku], precios: [35000, 35000, 35000, 35000, 35000] }];
    window.datosDobles.cajas = [{ id: 'caja-real', usuario: 'real', tipo: 'personal', estado: 'abierta', abierta: new Date().toISOString() }];
    window.publicarDoble('productos');
    window.publicarDoble('cajas');
    c.carrito = { lineas: [{ sku, cantidad: 1 }], cliente: { telefono: '584125550100', nombre: 'Cliente operativo' }, ventaId: 'borrador-real' };
    window.dispatchEvent(new CustomEvent('pos:carrito'));
  });
}

async function prepararApartadoReal(p) {
  await p.evaluate(() => {
    window.datosDobles.apartados = [{
      id: 'apartado-real', usuario: 'real', estado: 'pendiente', fecha: new Date().toISOString(),
      cliente: { nombre: 'Cliente operativo' }, lineas: [], abonos: [], total: 35000, saldo: 35000,
    }];
    window.publicarDoble('apartados');
  });
}

async function abrirCobroReal(p) {
  await p.click('.side [data-ruta="/vender"]');
  await p.click('[data-cobro] .cobrar');
  await p.click('[data-forma-card="efectivo-cop"]');
}

casos('modo-prueba', [
  ['Reportes no congela costos operativos cuando termina una lectura iniciada antes de entrar en práctica', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(() => { window.diferirLectura = 'costosVenta'; });
    await p.click('.side [data-ruta="/reportes"]');
    await p.waitForFunction(() => !!window.liberarLectura);
    await p.click('.side [data-ruta="/ajustes"]');
    await entrarEnPractica(p);
    await p.evaluate(async () => {
      window.diferirLectura = null;
      window.liberarLectura.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
    await p.evaluate(() => { window.aceptarCostos = true; });
    await p.click('#salir-prueba');
    await p.waitForFunction(() => window.costosEnviados.length === 1);
    a.strictEqual(await p.evaluate(() => window.costosEnviados[0].id), 'venta-real');
  }],
  ['Una lectura de Reportes rechazada no se interpreta como un costo inexistente', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(() => { window.diferirLectura = 'costosVenta'; window.aceptarCostos = true; });
    await p.click('.side [data-ruta="/reportes"]');
    await p.waitForFunction(() => !!window.liberarLectura);
    await p.evaluate(async () => {
      window.diferirLectura = null;
      window.liberarLectura.reject(new Error('Lectura rechazada por el doble de Firebase'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    a.deepStrictEqual(await p.evaluate(() => window.costosEnviados), []);
  }],
  ['La conciliación suspendida conserva el pendiente y no registra conflictos durante la práctica', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(async () => {
      const { revisarPendientes } = await import('/js/datos/pendientes.js');
      localStorage.setItem('pos-pendientes-real', JSON.stringify([{ id: 'venta-pendiente', que: 'venta' }]));
      window.diferirSubidas = true;
      window.conciliacion = revisarPendientes(window.__pos.ctx);
    });
    await p.waitForFunction(() => !!window.liberarSubidas);
    await entrarEnPractica(p);
    await p.evaluate(async () => {
      window.liberarSubidas.resolve();
      await window.conciliacion;
    });
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
    a.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('pos-pendientes-real'))[0].id), 'venta-pendiente');
    await p.evaluate(() => {
      window.datosDobles.ventas = [{ id: 'venta-pendiente', numero: 'V-0002' }];
      window.subidasListas = true;
    });
    await p.click('#salir-prueba');
    await p.waitForFunction(() => !localStorage.getItem('pos-pendientes-real'));
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
  }],
  ['Una confirmación tardía de un conflicto no cambia la cola real y la conciliación posterior conserva los nuevos pendientes', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(async () => {
      const { revisarPendientes } = await import('/js/datos/pendientes.js');
      localStorage.setItem('pos-pendientes-real', JSON.stringify([{ id: 'venta-pendiente', que: 'venta' }]));
      window.diferirLote = true;
      window.subidasListas = true;
      window.conciliacion = revisarPendientes(window.__pos.ctx);
    });
    await p.waitForFunction(() => !!window.liberarLote);
    await entrarEnPractica(p);
    await p.evaluate(async () => {
      const conflicto = window.lotesEnviados[0].find(c => c.ref.n === 'conflictos').campos;
      window.datosDobles.conflictos = [{ ...conflicto }];
      window.diferirLote = false;
      window.liberarLote.resolve();
      await window.conciliacion;
    });
    a.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('pos-pendientes-real'))[0].id), 'venta-pendiente');
    await p.evaluate(() => {
      window.diferirLectura = 'ventas';
      window.diferirLote = true;
    });
    await p.click('#salir-prueba');
    await p.waitForFunction(() => !!window.liberarLectura);
    await p.evaluate(async () => {
      const { anotarPendiente } = await import('/js/datos/pendientes.js');
      anotarPendiente(window.__pos.ctx, { id: 'venta-nueva', que: 'venta' });
      window.diferirLectura = null;
      window.liberarLectura.resolve();
    });
    await p.waitForFunction(() => window.lotesEnviados.length === 2);
    await p.evaluate(() => window.liberarLote.reject(Object.assign(new Error('Ya existe'), { code: 'permission-denied' })));
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('pos-pendientes-real')).length === 1);
    a.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('pos-pendientes-real'))[0].id), 'venta-nueva');
  }],
  ['Cobrar espera los Ajustes operativos aun cuando la caja ya está validada', async (env, a) => {
    const p = await abrirConDoble(env);
    await prepararCobroReal(p);
    await prepararApartadoReal(p);
    await entrarEnPractica(p);
    await p.evaluate(() => window.coleccionesEnCache.add('ajustes'));
    await p.click('#salir-prueba');
    await p.waitForFunction(() => !window.__pos.ctx.validandoCaja && !window.__pos.ctx.ajustesListos && !!window.__pos.ctx.miCaja);
    await p.click('.side [data-ruta="/vender"]');
    await p.click('[data-cobro] .cobrar');
    a.strictEqual(await p.locator('#cobrar-final').count(), 0, 'Se abrió Cobrar sin confirmar Ajustes');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.carrito.ventaId), 'borrador-real');
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
    a.deepStrictEqual(await p.evaluate(async () => {
      const s = window.__pos.ctx.almacen;
      return Promise.all([s.guardarVenta({}), s.guardarApartado({}), s.abonarApartado('apartado-real', {}),
        s.completarApartado('apartado-real', {}), s.guardarAjustes('general', {})]);
    }), Array(5).fill({ ok: false, error: 'ajustes-pendientes' }));
    await p.click('.side [data-ruta="/apartados"]');
    for (const [accion, boton] of [['abonar', 'abono'], ['completar', 'completar']]) {
      await p.click('.apartado');
      await p.click('#ap-' + accion);
      await p.waitForSelector('#ap-' + accion, { state: 'hidden' });
      await p.waitForSelector('.toast:has-text("Esperando los ajustes operativos")');
      a.strictEqual(await p.locator('#' + boton + '-final').count(), 0);
    }
    await p.evaluate(() => {
      window.datosDobles.ajustes = [
        { id: 'general', formasPago: [{ id: 'transferencia-cop', nombre: 'Nequi', moneda: 'COP' }], redondeo: 500 },
        { id: 'tasas', copPorUsd: 4750, bsModo: 'manual', bsManual: 720 },
      ];
      window.coleccionesEnCache.delete('ajustes');
      window.publicarDoble('ajustes');
    });
    await p.click('.side [data-ruta="/vender"]');
    await p.click('[data-cobro] .cobrar');
    await p.waitForSelector('#cobrar-final');
    a.strictEqual(await p.locator('[data-forma-card="efectivo-cop"]').count(), 0);
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.tasas.copPorUsd), 4750);
    await p.evaluate(() => { window.transaccionDoble = true; });
    await p.click('[data-forma-card="transferencia-cop"]');
    await p.click('#cobrar-final');
    await p.waitForFunction(() => !!window.liberarTransaccion);
    const venta = await p.evaluate(() => {
      const d = window.transaccionesEnviadas[0].find(c => c.ref.n === 'ventas').campos;
      window.datosDobles.ventas = [d];
      window.liberarTransaccion.resolve();
      return d;
    });
    await p.waitForSelector('.exito:has-text("Venta exitosa")');
    a.strictEqual(venta.id, 'borrador-real');
    a.strictEqual(venta.pagos[0].forma, 'transferencia-cop');
    a.strictEqual(venta.tasas.copPorUsd, 4750);
  }],
  ['Una actualización confirmada de formas, tasas y redondeo invalida un cobro que ya espera a Firebase', async (env, a) => {
    const p = await abrirConDoble(env);
    await prepararCobroReal(p);
    await abrirCobroReal(p);
    await p.evaluate(() => { window.transaccionDoble = true; window.diferirLectura = 'productos'; });
    await p.click('#cobrar-final');
    await p.waitForFunction(() => !!window.liberarLectura);
    await p.evaluate(() => {
      window.datosDobles.ajustes = [
        { id: 'general', formasPago: [{ id: 'transferencia-cop', nombre: 'Nequi', moneda: 'COP' }], redondeo: 500, redondeoUsd: 1 },
        { id: 'tasas', copPorUsd: 4750, bsModo: 'manual', bsManual: 720 },
      ];
      window.publicarDoble('ajustes');
      window.diferirLectura = null;
      window.liberarLectura.resolve();
    });
    await p.waitForSelector('.toast:has-text("Cambió la configuración de pago")');
    a.deepStrictEqual(await p.evaluate(() => window.transaccionesEnviadas), []);
    a.deepStrictEqual(await p.evaluate(() => window.__pos.ctx.carrito.pagos), [{ forma: 'efectivo-cop', monto: 35000 }]);
  }],
  ['Una transacción que ya envió sus escrituras no da éxito ni se duplica si Firebase tarda y se cambia de modo', async (env, a) => {
    const p = await abrirConDoble(env);
    await prepararCobroReal(p);
    await abrirCobroReal(p);
    await p.evaluate(() => { window.transaccionDoble = true; });
    await p.clock.install();
    await p.click('#cobrar-final');
    await p.waitForFunction(() => !!window.liberarTransaccion);
    await p.clock.runFor(4100);
    await p.waitForSelector('.toast:has-text("El envío anterior sigue pendiente de confirmación")');
    await p.evaluate(() => window.__pos.ctx.entrarModoPrueba());
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.click('#salir-prueba');
    await p.waitForFunction(() => window.__pos.ctx.ajustesListos && !window.__pos.ctx.validandoCaja);
    const repetida = await p.evaluate(() => window.__pos.ctx.almacen.guardarVenta({ id: 'borrador-real', lineas: [] }));
    a.deepStrictEqual(repetida, { ok: false, error: 'en-curso' });
    await p.evaluate(async () => {
      window.liberarTransaccion.reject(Object.assign(new Error('Firebase rechazó el envío'), { code: 'permission-denied' }));
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    a.strictEqual(await p.locator('.exito').count(), 0);
    a.strictEqual(await p.evaluate(() => window.transaccionesEnviadas.length), 1);
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
    a.strictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem('pos-venta-real')).c.ventaId), 'borrador-real');
  }],
  ['Un abono enviado conserva la cola de su cuenta si Firebase responde después del cambio de cuenta', async (env, a) => {
    const p = await abrirConDoble(env);
    await prepararCobroReal(p);
    await prepararApartadoReal(p);
    await p.click('.side [data-ruta="/apartados"]');
    await p.click('.apartado');
    await p.click('#ap-abonar');
    await p.click('[data-forma-card="efectivo-cop"]');
    await p.fill('.pago[data-forma="efectivo-cop"] input', '5.000');
    await p.click('[data-forma-card="transferencia-cop"]');
    await p.fill('.pago[data-forma="transferencia-cop"] input', '5.000');
    await p.evaluate(() => { window.diferirLote = true; });
    await p.click('#abono-final');
    await p.waitForFunction(() => !!window.liberarLote);
    await p.evaluate(() => {
      window.diferirPerfil = 'uid-otra';
      window.cambiarSesionDoble({ uid: 'uid-otra' });
    });
    await p.evaluate(async () => {
      window.liberarLote.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
      window.diferirPerfil = null;
      window.publicarDoble('usuarios');
    });
    await p.waitForFunction(() => window.__pos.ctx.sesion?.uid === 'uid-otra');
    a.strictEqual(await p.locator('.toast:has-text("Abono guardado")').count(), 0);
    a.strictEqual(await p.evaluate(() => window.lotesEnviados.length), 1);
    const { real, otra } = await p.evaluate(() => ({
      real: JSON.parse(localStorage.getItem('pos-pendientes-real')), otra: localStorage.getItem('pos-pendientes-otra'),
    }));
    a.strictEqual(real.length, 1);
    a.strictEqual(real[0].que, 'abono');
    a.strictEqual(real[0].datos.monto, 5000);
    a.strictEqual(otra, null);
  }],
  ['Guardar Ajustes no continúa con General ni muestra éxito si Tasas se confirma en otro contexto', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(() => { window.diferirLote = true; });
    await p.fill('#aj-cop', '4600');
    await p.click('#aj-guardar');
    await p.waitForFunction(() => !!window.liberarLote);
    await entrarEnPractica(p);
    await p.click('#salir-prueba');
    await p.waitForFunction(() => window.__pos.ctx.ajustesListos);
    await p.evaluate(async () => {
      window.liberarLote.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const documentos = await p.evaluate(() => window.lotesEnviados.flat().filter(c => c.ref.n === 'ajustes').map(c => c.ref.id));
    a.deepStrictEqual(documentos, ['tasas']);
    a.strictEqual(await p.locator('.toast:has-text("Cambios guardados")').count(), 0);
  }],
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
      const apartadoId = s.nuevoId();
      const apartado = await s.guardarApartado({ ...venta, id: apartadoId, abonos: [] });
      const abono = await s.abonarApartado(apartadoId, { id: s.nuevoId(), forma: 'efectivo-cop', monto: 10000, equivalenteCop: 10000 });
      const saldo = (await s.obtener('apartados', apartadoId)).saldo;
      const ventaFinal = s.nuevoId();
      const completado = await s.completarApartado(apartadoId, { ...venta, id: ventaFinal });
      const comision = await s.pagarComisiones({ vendedor: 'prueba', monto: 1000, ventas: [ventaFinal] });
      const guardado = await s.guardarCliente(cliente);
      const cerrada = await s.cerrarCaja(caja, { totalCop: 0 });
      return { separados: c.almacen !== window.contextoReal.almacen, cajera: (await s.obtener('usuarios', 'prueba-vendedora')).nombre,
        comisiones: s._estado('comisiones').size, claves: [...s._estado('clientes').keys()], ids: [caja, venta.id],
        numero: (await s.obtener('ventas', venta.id)).numero,
        saldo, operaciones: [vendida, anulada, apartado, abono, completado, comision, guardado, cerrada].map(r => r.ok),
        borradorLocal: localStorage.getItem(c.ambitoPrueba + ':carrito'),
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
    a.strictEqual(local.saldo, 25000);
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
  ['Recargar Reportes restaura la práctica sin congelar costos ni numerar ventas operativas', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.click('.side [data-ruta="/reportes"]');
    await p.waitForSelector('.vista[data-ruta="/reportes"]');
    await p.addInitScript(() => {
      const fecha = new Date().toISOString();
      window.ventaSinNumeroDoble = { id: 'venta-sin-numero', fecha, creada: fecha, numero: null, estado: 'ok', usuario: 'real', lineas: [] };
    });
    await p.reload();
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.waitForSelector('.vista[data-ruta="/reportes"]');
    await p.evaluate(() => window.dispatchEvent(new Event('online')));
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
    a.deepStrictEqual(await p.evaluate(() => window.lecturasServidorDobles), []);
  }],
  ['Ajustes espera la configuración confirmada y conserva tasas y recibo personalizados', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.evaluate(() => window.coleccionesEnCache.add('ajustes'));
    await p.click('#salir-prueba');
    await p.waitForSelector('.vista .nota:has-text("Esperando los ajustes operativos")');
    a.strictEqual(await p.$('#aj-guardar'), null);
    await p.evaluate(() => {
      window.datosDobles.ajustes = [
        { id: 'tasas', copPorUsd: 4750, bsModo: 'manual', bsManual: 720 },
        { id: 'general', redondeo: 500, recibo: { plantilla: 'Recibo operativo personalizado' } }
      ];
      window.coleccionesEnCache.delete('ajustes');
      window.publicarDoble('ajustes');
    });
    await p.waitForSelector('#aj-guardar');
    a.strictEqual(await p.inputValue('#aj-cop'), '4.750');
    a.strictEqual(await p.inputValue('#aj-plantilla'), 'Recibo operativo personalizado');
    a.ok(await p.isDisabled('#aj-guardar'));
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
  }],
  ...[true, false].map(vencida => [vencida ? 'Revisa la caja vencida al salir y conserva el arqueo físico' : 'Una caja cerrada durante la práctica queda indisponible al salir', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.evaluate(() => {
      window.datosDobles.cajas = [{ id: 'caja-real', usuario: 'real', tipo: 'tienda', estado: 'abierta', abierta: new Date().toISOString() }];
      window.publicarDoble('cajas');
    });
    await p.waitForFunction(() => window.__pos.ctx.miCaja?.id === 'caja-real');
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.evaluate(vencida => {
      const caja = window.datosDobles.cajas[0];
      if (vencida) caja.abierta = new Date(Date.now() - 86400000).toISOString();
      else caja.estado = 'cerrada';
      window.cerrarCajaDoble = vencida;
      window.diferirCajas = true;
    }, vencida);
    await p.click('#salir-prueba');
    await p.waitForFunction(() => window.__pos.ctx.validandoCaja && !!window.liberarCajas);
    a.deepStrictEqual(await p.evaluate(() => window.__pos.ctx.almacen.guardarVenta({ id: 'no-escribir' })), { ok: false, error: 'validando-caja' });
    await p.evaluate(() => { window.diferirCajas = false; window.liberarCajas(); });
    await p.waitForFunction(() => !window.__pos.ctx.validandoCaja);
    a.deepStrictEqual(await p.evaluate(() => window.__pos.ctx.almacen.guardarVenta({ id: 'sin-caja' })), { ok: false, error: 'sin-caja' });
    const estado = await p.evaluate(() => ({ caja: window.__pos.ctx.miCaja, cierres: window.cajasCerradasDobles, lecturas: window.lecturasServidorDobles,
      porArquear: window.__pos.ctx.porArquear.some(c => c.id === 'caja-real'), escrituras: window.escriturasDobles }));
    a.strictEqual(estado.caja, null);
    a.ok(estado.lecturas.includes('cajas'));
    a.deepStrictEqual(estado.cierres, vencida ? ['caja-real'] : []);
    a.strictEqual(estado.porArquear, vencida);
    a.deepStrictEqual(estado.escrituras, []);
  }]),
  ['Retirar ejemplos invalida las copias que quedaron abiertas en otra pestaña', async (env, a) => {
    const p = await abrirConDoble(env);
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    await p.evaluate(() => window.__pos.ctx.almacen.guardarCliente({ telefono: '584125550100', nombre: 'Ejemplo retirado' }));
    const otra = await p.context().newPage();
    await otra.goto(URL_BASE + '#/ajustes');
    await otra.click('#modo-prueba');
    await otra.waitForSelector('#aviso-prueba:not([hidden])');
    a.strictEqual(await otra.evaluate(async () => (await window.__pos.ctx.almacen.obtener('clientes', '584125550100')).nombre), 'Ejemplo retirado');
    await p.click('#modo-prueba');
    await p.click('#quitar-ejemplos');
    await p.waitForSelector('#modo-prueba:not(.on)');
    await otra.click('#salir-prueba');
    await otra.waitForSelector('#modo-prueba:not(.on)');
    await p.click('#modo-prueba');
    await p.waitForSelector('#aviso-prueba:not([hidden])');
    a.notStrictEqual(await p.evaluate(async () => (await window.__pos.ctx.almacen.obtener('clientes', '584125550100')).nombre), 'Ejemplo retirado');
    a.deepStrictEqual(await p.evaluate(() => window.escriturasDobles), []);
  }],
]);
