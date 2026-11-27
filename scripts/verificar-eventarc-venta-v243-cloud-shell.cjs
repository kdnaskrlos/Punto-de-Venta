const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { setTimeout: esperar } = require('node:timers/promises');
const { initializeApp, deleteApp } = require('firebase/app');
const { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, collection, query, where, getDocFromServer: leer,
  getDocsFromServer: listar, setDoc, serverTimestamp } = require('firebase/firestore');
const proyecto = 'punto-de-venta-comic-shop';
const id = 'qa-v243-eventarc-20261127-31c2a83e';
const firma = (...x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
let etapa = 'precheck';
const paso = nombre => { etapa = nombre; console.log(nombre); };

async function probar() {
  assert.ok(!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Se requiere Firebase real.');
  const { firebaseConfig } = await import('../config.js');
  assert.equal(firebaseConfig.projectId, proyecto, 'El config.js apunta a otro proyecto.');
  const { calcularCarrito, normalizarTramos } = await import('../js/nucleo/tramos.js');
  const { comisionesVenta } = await import('../js/nucleo/comisiones.js');
  const { FORMAS_PAGO_DEFECTO, normalizarFormas } = await import('../js/nucleo/formas.js');
  const { esperadoCaja } = await import('../js/nucleo/caja.js');
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
  assert.ok(token, 'Cloud Shell no devolvió una credencial activa.');
  async function api(url, body) {
    const respuesta = await fetch(url, {
      method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw Error('HTTP ' + respuesta.status + ' ' + (datos.error?.message || url));
    return datos;
  }
  const app = initializeApp(firebaseConfig);
  try {
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    const db = getFirestore(app), ref = (...ruta) => doc(db, ...ruta);
    const usuario = process.env.POS_SMOKE_USUARIO.trim().toLowerCase().normalize('NFD')
      .replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
    assert.ok(usuario, 'Usuario vacío.');
    const login = (await leer(ref('logins', usuario))).data();
    assert.ok(login?.email, 'Usuario sin registro de acceso.');
    const { user } = await signInWithEmailAndPassword(auth, login.email, 'cs-' + process.env.POS_SMOKE_PIN);
    const uid = user.uid;
    assert.ok((await user.getIdTokenResult()).claims.aud === proyecto && (!login.uid || login.uid === uid), 'Cuenta o proyecto inesperados.');
    const sku = id + '-sku', cajaId = id + '-caja';
    const movId = firma(id, sku), eventoId = firma(uid, id, 'venta.creada');
    const refs = {
      sku: ref('productos', sku), caja: ref('cajas', cajaId), venta: ref('ventas', id),
      solicitud: ref('usuarios', uid, 'solicitudesVenta', id),
      marca: ref('usuarios', uid, 'operacionesCobro', 'venta:' + id),
      mov: ref('movimientos', movId), evento: ref('eventos', eventoId),
      conflicto: ref('conflictos', 'venta-' + firma(uid, id)),
    };
    const todos = async () => Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([k, r]) => [k, (await leer(r)).data()])));
    const listarPor = (col, campo, valor) => listar(query(collection(db, col), where(campo, '==', valor)));
    const [perfil, puntero, general = {}] = await Promise.all(
      [ref('usuarios', uid), ref('cajaAbierta', usuario), ref('ajustes', 'general')]
        .map(async referencia => (await leer(referencia)).data()));
    assert.ok(perfil?.activo === true && perfil.rol === 'admin' && perfil.usuario === usuario, 'Se requiere el perfil administrador activo.');
    assert.ok(!puntero && !(await listarPor('cajas', 'usuario', usuario)).docs.some(c => c.data().estado === 'abierta'), 'El administrador tiene caja abierta.');
    assert.ok(Object.values(await todos()).every(x => x === undefined), 'El ID fijo ya tiene registros. Concilia esa venta antes de intentar otra.');

    const formas = (normalizarFormas(general.formasPago) || FORMAS_PAGO_DEFECTO).filter(f => f.activa !== false);
    const forma = formas.find(f => f.moneda === 'COP' && f.efectivo);
    assert.ok(forma, 'Falta una forma activa de efectivo COP.');
    const producto = { sku, existencia: 2, activo: true, nombre: 'QA venta controlada', precios: [10000, 10000, 10000, 10000, 10000] };
    const catalogo = { [sku]: producto }, limites = normalizarTramos(general.tramos), redondeo = general.redondeo ?? 100;
    const calculo = calcularCarrito([{ sku, cantidad: 1 }], catalogo, { limites, redondeo });
    assert.equal(calculo.subtotal, 10000, 'El total sintético debe ser 10.000 COP.');
    const [comision] = comisionesVenta(calculo.lineas, catalogo, general.comisiones, false, limites, redondeo);
    const fecha = new Date().toISOString();
    const caja = { id: cajaId, usuario, uid, estado: 'cerrada', tipo: 'personal', abierta: fecha,
      cierre: { fecha, porArquear: false }, fondo: { COP: 0, USD: 0, BS: 0 }, movimientos: [] };
    const pagos = [{ forma: forma.id, nombre: forma.nombre, moneda: 'COP', monto: 10000, equivalenteCop: 10000 }];
    const venta = { id, cajaId, fecha, creada: fecha, offline: true, subtotal: 10000, total: 10000, pagos,
      lineas: [{ ...calculo.lineas[0], descuento: 0, comision: comision.comision, reducida: comision.reducida }] };
    const payload = { venta, dispositivo: 'qa-cloud-shell', orden: 1, version: 'v2.43' };

    paso('1/3 Crear únicamente el SKU y la caja sintética mediante IAM');
    const raiz = 'projects/' + proyecto + '/databases/(default)/documents';
    const valor = x => typeof x === 'string' ? { stringValue: x } : typeof x === 'number' ? { integerValue: String(x) }
      : typeof x === 'boolean' ? { booleanValue: x } : Array.isArray(x) ? { arrayValue: { values: x.map(valor) } }
        : { mapValue: { fields: campos(x) } };
    const campos = x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, valor(v)]));
    await api('https://firestore.googleapis.com/v1/' + raiz + ':commit', {
      writes: [[refs.sku, producto], [refs.caja, caja]].map(([r, data]) => ({
        update: { name: raiz + '/' + r.path, fields: campos(data) }, currentDocument: { exists: false },
      })),
    });
    paso('2/3 Crear una solicitud autenticada y esperar a Eventarc');
    await setDoc(refs.solicitud, { ...payload, recibida: serverTimestamp() });
    let confirmado = false;
    for (let inicio = Date.now(); Date.now() - inicio < 90000; await esperar(1000)) {
      const marca = (await leer(refs.marca)).data();
      if (marca?.estadoSync === 'rechazada_conflicto') {
        const conflicto = (await leer(refs.conflicto)).data();
        throw Error('Venta rechazada por el procesador: ' + (conflicto?.motivo || marca.conflictoId));
      }
      if (marca?.estadoSync === 'confirmada_servidor' && (await leer(refs.venta)).data()?.numero) {
        confirmado = true;
        break;
      }
    }
    assert.ok(confirmado, 'Sin marca y número oficial dentro de 90 s. Concilia el mismo ID.');
    paso('3/3 Conciliar el resultado automático');
    const despues = await todos();
    const { venta: guardada, sku: stock, mov, evento, marca } = despues;
    const oficial = guardada?.numero;
    assert.match(oficial || '', /^V-[0-9]{4,}$/, 'Falta el número oficial.');
    assert.deepEqual(guardada, { ...venta, uid, usuario, estado: 'ok', numero: oficial }, 'Comprobante, pagos o número oficial inesperados.');
    assert.deepEqual([marca.refId, marca.estadoSync, evento.tipo, evento.ref, evento.uid],
      [id, 'confirmada_servidor', 'venta.creada', { col: 'ventas', id }, uid], 'Marca o evento incongruentes.');
    assert.deepEqual(stock, { ...producto, existencia: 1, ultimoMov: movId }, 'El inventario no descontó exactamente una unidad.');
    assert.deepEqual([mov.ref, mov.sku, mov.cantidad, mov.motivo], [id, sku, -1, 'venta'], 'Movimiento de inventario incorrecto.');
    assert.equal(despues.conflicto, undefined, 'Se creó un conflicto para la venta.');
    const [ventas, movimientos, eventos, numeradas] = await Promise.all([
      listarPor('ventas', 'cajaId', cajaId), listarPor('movimientos', 'ref', id), listarPor('eventos', 'ref.id', id),
      listarPor('ventas', 'numero', oficial),
    ]);
    assert.deepEqual([ventas.docs.map(d => d.id), movimientos.docs.map(d => d.id), eventos.docs.map(d => d.id), numeradas.docs.map(d => d.id)],
      [[id], [movId], [eventoId], [id]], 'Falta un registro relacionado o hay duplicados.');
    assert.deepEqual(despues.caja, caja, 'La caja cambió o recibió un movimiento de entrada separado.');
    assert.equal(esperadoCaja(despues.caja, ventas.docs.map(d => d.data()), [], formas)[forma.id], 10000, 'El saldo esperado de caja no es 10.000 COP.');
    console.log(JSON.stringify({ estado: 'EVENTARC_VENTA_VERIFICADA', proyecto, venta: id, caja: cajaId, sku,
      numero: oficial, stock: [2, 1], cobroCop: 10000, esperadoCajaCop: 10000, ventas: ventas.size,
      movimientosInventario: movimientos.size, eventos: eventos.size, conflicto: null }));
  } finally { await deleteApp(app); }
}
probar().catch(e => { console.error('BLOQUEADO/FALLO |', etapa, '|', e.code || '', e.message, '| venta:', id); process.exitCode = 1; });
