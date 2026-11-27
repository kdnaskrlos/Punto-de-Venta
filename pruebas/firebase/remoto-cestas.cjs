// Prueba exclusivamente contra Firebase remoto de QA. No imprime credenciales.
'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { setTimeout: esperar } = require('node:timers/promises');

const firma = (...partes) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');

function configuracion(env) {
  const projectId = env.POS_QA_PROJECT_ID || '';
  const proyectoQA = /^pos-qa-[a-z0-9-]{4,}$/.test(projectId);
  const proyectoExistenteAutorizado = projectId === 'punto-de-venta-comic-shop'
    && env.POS_QA_ALLOW_EXISTING_PROJECT === projectId
    && env.POS_QA_CONFIRM_NONOPERATIVE === 'SI_POS_NO_OPERATIVO';
  assert.ok(proyectoQA || proyectoExistenteAutorizado, 'Proyecto no autorizado para pruebas remotas.');
  assert.ok(env.POS_QA_API_KEY, 'Falta POS_QA_API_KEY.');
  assert.ok(!env.FIRESTORE_EMULATOR_HOST && !env.FIREBASE_AUTH_EMULATOR_HOST, 'Se requieren Firestore y Auth remotos.');
  assert.ok([undefined, '0', '1'].includes(env.POS_QA_SOLO_PRECHECK), 'POS_QA_SOLO_PRECHECK debe ser 0 o 1.');
  const soloPrecheck = env.POS_QA_SOLO_PRECHECK === '1';
  if (!soloPrecheck) {
    assert.equal(env.POS_QA_CONFIRM_WRITES === 'SI_DATOS_SINTETICOS', true, 'Falta confirmar las escrituras sintéticas.');
    assert.ok(/^[01]$/.test(env.POS_QA_VENTAS_PROCESADAS || ''), 'Indica la ruta con POS_QA_VENTAS_PROCESADAS=0 o 1.');
    assert.ok(/^[a-z0-9][a-z0-9-]{7,39}$/.test(env.POS_QA_RUN_ID || ''), 'Falta un POS_QA_RUN_ID válido para identificar la ejecución.');
  }
  const credencialesPos = Boolean(env.POS_QA_USUARIO || env.POS_QA_PIN);
  const credencialesFirebase = Boolean(env.POS_QA_EMAIL || env.POS_QA_PASSWORD);
  assert.ok(credencialesPos !== credencialesFirebase, 'Usa un solo método de acceso, con las dos variables correspondientes.');
  assert.ok(credencialesPos ? env.POS_QA_USUARIO && /^\d{4}$/.test(env.POS_QA_PIN || '')
    : env.POS_QA_EMAIL && env.POS_QA_PASSWORD, 'Faltan credenciales válidas para el método elegido.');
  return { projectId, soloPrecheck, credencialesPos };
}

async function confirmar(marca, getDocFromServer) {
  const tope = Date.now() + 45000;
  while (Date.now() < tope) {
    const s = await getDocFromServer(marca);
    if (s.exists()) return s.data();
    await esperar(500);
  }
  throw new Error('Estado indeterminado. El procesador no escribió una marca a tiempo para ' + marca.id);
}

async function cesta({ db, sdk, uid, usuario, idCaja, base, fecha, procesadas, n, falta }) {
  const { doc, writeBatch, getDocFromServer, setDoc, increment, serverTimestamp, runTransaction } = sdk;
  const ventaId = base + '-v-' + n + (falta ? '-faltante' : '');
  const skus = Array.from({ length: n }, (_, i) => ventaId + '-s-' + i);
  const refsProductos = skus.map(sku => doc(db, 'productos', sku));
  const marca = doc(db, 'usuarios', uid, 'operacionesCobro', 'venta:' + ventaId);
  const solicitud = doc(db, 'usuarios', uid, 'solicitudesVenta', ventaId);
  const refVenta = doc(db, 'ventas', ventaId);
  const eventoId = procesadas ? firma(uid, ventaId, 'venta.creada') : ventaId + '-evento';
  const movimientos = skus.map((sku, i) => procesadas ? firma(ventaId, sku) : ventaId + '-mov-' + i);
  const refEvento = doc(db, 'eventos', eventoId);
  const refsMovimientos = movimientos.map(id => doc(db, 'movimientos', id));
  await runTransaction(db, async tx => {
    const previos = await Promise.all([refVenta, marca, solicitud, refEvento, ...refsProductos].map(ref => tx.get(ref)));
    assert.ok(previos.every(s => !s.exists()), 'Ya hay documentos para la cesta ' + ventaId);
    for (const [i, ref] of refsProductos.entries()) {
      tx.set(ref, { sku: ref.id, existencia: falta && i === n - 1 ? 0 : 1, activo: true,
        nombre: 'QA prueba de capacidad', precios: [10000, 10000, 10000, 10000, 10000] });
    }
  });

  const { calcularCarrito } = await import('../../js/nucleo/tramos.js');
  const { comisionesVenta } = await import('../../js/nucleo/comisiones.js');
  const catalogo = Object.fromEntries(skus.map(sku => [sku, { precios: [10000, 10000, 10000, 10000, 10000] }]));
  const calculo = calcularCarrito(skus.map(sku => ({ sku, cantidad: 1 })), catalogo);
  const comisiones = comisionesVenta(calculo.lineas, catalogo);
  const venta = { id: ventaId, cajaId: idCaja, fecha, creada: fecha, offline: false,
    subtotal: 10000 * n, total: 10000 * n,
    lineas: calculo.lineas.map((l, i) => ({ ...l, descuento: 0, comision: comisiones[i].comision, reducida: false })),
    pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 10000 * n, equivalenteCop: 10000 * n }] };
  let aceptada = true, error = null;
  if (procesadas) {
    await setDoc(solicitud,
      { venta, dispositivo: 'qa-remoto', orden: n, version: 'v2.43', recibida: serverTimestamp() });
    const res = await confirmar(marca, getDocFromServer);
    aceptada = res.estadoSync === 'confirmada_servidor';
    if (!aceptada) {
      assert.equal(res.estadoSync, 'rechazada_conflicto');
      const conflicto = (await getDocFromServer(doc(db, 'conflictos', res.conflictoId))).data();
      error = conflicto?.motivo;
      if (falta) assert.deepEqual([error, conflicto.faltantes, conflicto.datos.pagos], ['existencia', [skus.at(-1)], venta.pagos]);
    }
  } else {
    const lote = writeBatch(db);
    lote.set(refVenta, { ...venta, usuario, uid, estado: 'ok', numero: null });
    lote.set(marca, { que: 'venta', refId: ventaId, fecha, dispositivo: 'qa-remoto', orden: n,
      apartadoId: null, estadoSync: 'confirmada_servidor' });
    lote.set(refEvento, { id: eventoId, uid, usuario, rol: 'admin', dispositivo: 'qa-remoto',
      en: serverTimestamp(), fecha, tipo: 'venta.creada', ref: { col: 'ventas', id: ventaId } });
    for (const [i, sku] of skus.entries()) {
      const movId = movimientos[i];
      lote.update(refsProductos[i], { existencia: increment(-1), ultimoMov: movId });
      lote.set(refsMovimientos[i], { id: movId, sku, cantidad: -1, motivo: 'venta', ref: ventaId, nota: '', usuario, fecha });
    }
    try { await lote.commit(); } catch (e) {
      if (e.code !== 'permission-denied') throw e;
      aceptada = false;
      error = e.code;
    }
  }
  const [productos, guardada, resultado, evento, movs] = await Promise.all([
    Promise.all(refsProductos.map(getDocFromServer)),
    getDocFromServer(refVenta), getDocFromServer(marca), getDocFromServer(refEvento),
    Promise.all(refsMovimientos.map(getDocFromServer)),
  ]);
  assert.equal(guardada.exists(), aceptada);
  assert.equal(evento.exists(), aceptada);
  assert.equal(resultado.exists(), procesadas || aceptada);
  if (resultado.exists()) {
    const { refId, estadoSync } = resultado.data();
    assert.deepEqual([refId, estadoSync], [ventaId, aceptada ? 'confirmada_servidor' : 'rechazada_conflicto']);
  }
  for (const [i, p] of productos.entries()) {
    assert.equal(p.data()?.existencia, aceptada || (falta && i === n - 1) ? 0 : 1);
    if (aceptada) {
      const mov = movs[i].data();
      assert.deepEqual([mov?.ref, mov?.sku, mov?.cantidad, p.data().ultimoMov], [ventaId, skus[i], -1, movs[i].id]);
    } else assert.equal(movs[i].exists(), false);
  }
  if (aceptada) {
    const { cajaId, id, pagos, total } = guardada.data();
    assert.deepEqual([id, cajaId, total, pagos], [ventaId, idCaja, venta.total, venta.pagos]);
    assert.deepEqual(evento.data().ref, { col: 'ventas', id: ventaId });
  }
  return { sku: n, falta, aceptada, error };
}

async function entrarAdmin({ env, credencialesPos, projectId, auth, db, sdk, signInWithEmailAndPassword }) {
  const { doc, getDocFromServer } = sdk;
  let correo, clave;
  let usuarioLimpio, uidEsperado;
  if (credencialesPos) {
    usuarioLimpio = env.POS_QA_USUARIO.trim().toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '');
    assert.ok(usuarioLimpio, 'POS_QA_USUARIO inválido.');
    const acceso = (await getDocFromServer(doc(db, 'logins', usuarioLimpio))).data();
    assert.ok(typeof acceso?.email === 'string' && acceso.email, 'El usuario del POS no tiene un registro de acceso válido.');
    correo = acceso.email;
    uidEsperado = acceso.uid;
    clave = 'cs-' + env.POS_QA_PIN;
  } else {
    correo = env.POS_QA_EMAIL;
    clave = env.POS_QA_PASSWORD;
  }
  const { user } = await signInWithEmailAndPassword(auth, correo, clave);
  const { uid } = user;
  assert.ok((await user.getIdTokenResult()).claims.aud === projectId, 'La sesión de Auth pertenece a otro proyecto.');
  assert.ok(!uidEsperado || uidEsperado === uid, 'El registro de acceso apunta a otra cuenta.');
  const perfil = (await getDocFromServer(doc(db, 'usuarios', uid))).data();
  assert.ok(perfil?.activo === true && perfil.rol === 'admin' && typeof perfil.usuario === 'string' && perfil.usuario,
    'Se requiere una cuenta admin existente con perfil activo.');
  assert.ok(!credencialesPos || perfil.usuario === usuarioLimpio, 'El perfil no coincide con el usuario del POS.');
  return { uid, usuario: perfil.usuario };
}

async function precheck({ projectId, db, sdk, puntero }) {
  const { doc, getDocFromServer } = sdk;
  const previo = await getDocFromServer(puntero);
  let cajaAnterior;
  if (previo.exists()) {
    const { cajaId } = previo.data();
    assert.ok(typeof cajaId === 'string' && cajaId && !cajaId.includes('/'), 'Puntero de caja inválido.');
    cajaAnterior = (await getDocFromServer(doc(db, 'cajas', cajaId))).data();
    assert.ok(cajaAnterior?.estado === 'abierta', 'El puntero no corresponde a una caja abierta. Requiere revisión.');
  }
  return {
    modo: 'solo-lectura', proyecto: projectId, adminActivo: true,
    cajaPersonalExistente: cajaAnterior?.tipo === 'personal',
    cajaFisicaExistente: !!cajaAnterior && cajaAnterior.tipo !== 'personal',
    ventasEjecutadas: 0, sinPunteroDeCaja: !previo.exists(),
  };
}

async function matriz({ projectId, db, sdk, puntero, uid, usuario, base, procesadas }) {
  const { doc, runTransaction } = sdk;
  const fecha = new Date().toISOString();
  const idCaja = base + '-caja';
  const caja = doc(db, 'cajas', idCaja);
  console.log('Proyecto QA y prefijo sintético', projectId, base);
  await runTransaction(db, async tx => {
    const [actual, anterior] = await Promise.all([tx.get(puntero), tx.get(caja)]);
    assert.ok(!anterior.exists(), 'El identificador de ejecución ya se usó: ' + base);
    assert.ok(!actual.exists(), 'El administrador ya tiene un puntero de caja. Revisa su estado antes de ejecutar la matriz.');
    tx.set(puntero, { cajaId: idCaja, desde: fecha });
    tx.set(caja, { id: idCaja, uid, usuario, estado: 'abierta', tipo: 'personal', abierta: fecha,
      fondo: { COP: 0, USD: 0, BS: 0 }, movimientos: [] });
  });
  try {
    const cantidades = [1, 8, 10, 12, 15, 16, 17, 18, 19, 20, 21, 24, 30, 32, 48, 64];
    if (procesadas) cantidades.push(128, 248);
    const resultados = [];
    for (const n of cantidades) {
      const resultado = await cesta({ db, sdk, uid, usuario, idCaja, base, fecha, procesadas, n, falta: false });
      resultados.push(resultado);
      console.log(JSON.stringify(resultado));
      if (n === 1) assert.equal(resultado.aceptada, true, 'Ni siquiera 1 SKU se confirmó');
      if (procesadas) assert.equal(resultado.aceptada, true, 'La ruta procesada rechazó ' + n + ' SKU');
    }
    if (procesadas) {
      const faltante = await cesta({ db, sdk, uid, usuario, idCaja, base, fecha, procesadas, n: 64, falta: true });
      console.log(JSON.stringify(faltante));
      assert.equal(faltante.aceptada, false);
    }
    return resultados.some(r => !r.aceptada) ? 2 : 0;
  } finally {
    await runTransaction(db, async tx => {
      const [p, c] = await Promise.all([tx.get(puntero), tx.get(caja)]);
      const actual = p.data(), origen = c.data();
      const propia = origen?.uid === uid && origen.usuario === usuario && origen.tipo === 'personal' && origen.abierta === fecha;
      if (propia && origen.estado === 'cerrada' && actual?.cajaId !== idCaja) return;
      assert.ok(propia && origen.estado === 'abierta' && actual?.cajaId === idCaja && actual.desde === fecha
        && Array.isArray(origen.movimientos) && origen.movimientos.length === 0,
      'Cambió la caja de la prueba. Revisa la caja sintética ' + idCaja);
      tx.delete(puntero);
      tx.update(caja, { estado: 'cerrada', cierre: { fecha: new Date().toISOString(), porArquear: false } });
    });
  }
}

async function ejecutar(env = process.env, cargar = require) {
  const { projectId, soloPrecheck, credencialesPos } = configuracion(env);
  const { initializeApp, deleteApp } = cargar('firebase/app');
  const { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } = cargar('firebase/auth');
  const sdk = cargar('firebase/firestore');
  const app = initializeApp({ projectId, apiKey: env.POS_QA_API_KEY, authDomain: projectId + '.firebaseapp.com' });
  try {
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    try {
      const db = sdk.getFirestore(app);
      const { uid, usuario } = await entrarAdmin({ env, credencialesPos, projectId, auth, db, sdk, signInWithEmailAndPassword });
      const puntero = sdk.doc(db, 'cajaAbierta', usuario);
      if (soloPrecheck) return await precheck({ projectId, db, sdk, puntero });
      return await matriz({ projectId, db, sdk, puntero, uid, usuario,
        base: 'qa-' + env.POS_QA_RUN_ID, procesadas: env.POS_QA_VENTAS_PROCESADAS === '1' });
    } finally {
      await signOut(auth);
    }
  } finally {
    await deleteApp(app);
  }
}

module.exports = { ejecutar };
if (require.main === module) {
  ejecutar().then(resultado => {
    if (typeof resultado === 'number') process.exitCode = resultado;
    else console.log(JSON.stringify(resultado));
  }).catch(e => {
    process.exitCode = 1;
    console.error('BLOQUEADO/FALLO', e.code === 'ERR_ASSERTION' ? e.message : e.code || e.message);
  });
}
