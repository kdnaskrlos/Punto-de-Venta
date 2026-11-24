// Almacén Firebase (Firestore con caché persistente + Authentication con usuario y PIN, como Pedidos).
// Cumple el contrato de contrato.js. Las reglas de firestore.rules repiten estos permisos en el servidor.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, where, onSnapshot, getDoc, getDocFromCache, getDocFromServer, getDocs, waitForPendingWrites, serverTimestamp, setDoc, updateDoc, writeBatch, runTransaction, increment, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { puede } from '../nucleo/permisos.js';
import { diaLocal, finDia } from '../nucleo/fechas.js';
import { telefonoInternacional } from '../nucleo/recibo.js';
import { nuevoId } from './contrato.js';
import { subirFotoGitHub, CLAVE_TOKEN } from './github-fotos.js';
import { describir, diferencias } from './eventos.js';
import { claveOperacion, guardarCobro, leerCobro, leerPendientes, resolverCobro,
  LOCAL_PENDIENTE, CONFIRMADA_SERVIDOR, RECHAZADA_CONFLICTO } from './pendientes.js';
import { dispositivo } from './dispositivo.js';
import { APP_VERSION } from '../version.js';

const ahora = () => new Date().toISOString();
const NO = (error, extra = {}) => ({ ok: false, error, ...extra });
const SI = (extra = {}) => ({ ok: true, ...extra });
const confirmado = () => SI({ offline: false, estadoSync: CONFIRMADA_SERVIDOR });
const pendienteLocal = () => SI({ offline: true, estadoSync: LOCAL_PENDIENTE });
const rechazado = error => NO(error, { estadoSync: RECHAZADA_CONFLICTO });
const errorFirestore = e => e?.code === 'permission-denied' ? 'permiso' : 'error';
const demora = Symbol('demora');
async function conTope(p, ms) {
  let reloj;
  try { return await Promise.race([p, new Promise(r => { reloj = setTimeout(() => r(demora), ms); })]); }
  finally { clearTimeout(reloj); }
}
const pinPass = pin => 'cs-' + pin;
const correo = u => `${u}.${Math.random().toString(36).slice(2, 6)}@comicshop-pos.app`;
const limpiarUsuario = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
const RESTRINGIDAS = ['costos', 'costosVenta', 'comisiones', 'movimientos'];
const SOLO_GESTION = ['eventos'];
const PROPIAS = ['ventas', 'cajas', 'autorizaciones', 'conflictos'];

function cumpleFiltro(d, f) {
  if (!f) return true;
  if (typeof f === 'function') return f(d);
  if (f.desde && (d.fecha || d.abierta || '') < f.desde) return false;
  if (f.hasta && (d.fecha || d.abierta || '') > f.hasta) return false;
  for (const k of ['usuario', 'cajaId', 'sku', 'estado']) if (f[k] != null && d[k] !== f[k]) return false;
  return true;
}

export function crearFirebase(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  let sesion = null, miCaja = null, pendientes = 0, pendientesVentas = 0, errorSync = null;
  const enCurso = new Set(), cobrosEnCurso = new Map();
  // La caja abierta se conoce con el primer dato de su escucha; vender espera ese momento (máx. 4 s).
  let cajaConocida = Promise.resolve(), avisarCajaConocida = () => {};
  const esperarCaja = () => Promise.race([cajaConocida, new Promise(r => setTimeout(r, 4000))]);
  let quitarPendientes = null;
  const oyentesSesion = new Set(), oyentesSync = new Set();
  let quitarPerfil = null, quitarCaja = null;

  const estadoActual = () => ({ enLinea: navigator.onLine,
    pendientes: pendientes + Math.max(pendientesVentas, sesion ? leerPendientes(sesion.usuario).length : 0), error: errorSync });
  const avisarSync = () => { for (const cb of oyentesSync) cb(estadoActual()); };
  addEventListener('offline', avisarSync);
  addEventListener('online', () => { avisarSync(); if (sesion && puede(sesion.rol, 'verReportesTodos')) completarNumeros().catch(() => {}); });

  function observarEscritura(p, alTerminar = () => {}, contar = true) {
    if (contar) pendientes++;
    avisarSync();
    return p.then(v => { errorSync = null; return v; }, e => {
      console.warn('sincronización', e); errorSync = e?.code || 'error'; throw e;
    }).finally(() => { if (contar) pendientes--; alTerminar(); avisarSync(); });
  }
  // Para las demás escrituras se conserva el aviso optimista del SDK.
  async function sinEsperar(p, alTerminar) {
    try { return SI({ offline: await conTope(observarEscritura(p, alTerminar), 1200) === demora }); }
    catch (e) { return NO(errorFirestore(e)); }
  }
  // Firestore no acepta campos «undefined»: se quitan (en cualquier nivel) antes de guardar.
  const limpiarIndefinidos = v => Array.isArray(v) ? v.map(limpiarIndefinidos) : v && typeof v === 'object' && v.constructor === Object ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, limpiarIndefinidos(x)])) : v;
  const exigir = accion => (!sesion ? 'sesion' : !puede(sesion.rol, accion) ? 'permiso' : null);
  const ref = (n, id) => doc(db, n, id);
  const nombreDeSku = sku => sku; // el nombre legible se arma en la pantalla de Actividad
  const porSku = lineas => { const m = {}; for (const l of lineas) m[l.sku] = (m[l.sku] || 0) + l.cantidad; return m; };
  const movimiento = (sku, cantidad, motivo, refId, nota) => {
    const id = nuevoId();
    return [ref('movimientos', id), { id, sku, cantidad, motivo, ref: refId || null, nota: nota || '', usuario: sesion.usuario, fecha: ahora() }];
  };
  // v2.27 · Cambio de existencia SIEMPRE con su movimiento (las reglas lo exigen: ultimoMov apunta al movimiento
  // creado en la misma escritura y su cantidad debe ser igual a la diferencia).
  const mover = (b, sku, n, motivo, refId, nota) => {
    const [mr, md] = movimiento(sku, n, motivo, refId, nota);
    b.update(ref('productos', sku), { existencia: increment(n), ultimoMov: md.id });
    b.set(mr, md);
  };
  // v2.27 · Registro de actividad: [ref, datos] del evento, para ir en la misma escritura que la acción.
  const evento = ev => {
    const id = nuevoId(), d = dispositivo();
    return [ref('eventos', id), limpiarIndefinidos({ id, tipo: ev.tipo, en: serverTimestamp(), enLocal: ahora(), fecha: ahora(), uid: sesion.uid, usuario: sesion.usuario, rol: sesion.rol,
      dispositivo: d.id, nombreDispositivo: d.nombre, version: APP_VERSION, ref: ev.ref || null, resumen: ev.resumen || '', motivo: ev.motivo || '',
      antes: ev.antes ?? null, despues: ev.despues ?? null })];
  };
  const anotar = (b, metodo, args, x) => { const ev = describir(metodo, args, x); if (ev && sesion) b.set(...evento(ev)); };
  // Acción de una sola escritura + su evento, juntos.
  const conEvento = (escribir, metodo, args, x) => { const b = writeBatch(db); escribir(b); anotar(b, metodo, args, x); return sinEsperar(b.commit()); };

  // ---- sesión ----
  let errorPerfil = null; // por qué no se pudo cargar el perfil (se muestra en la entrada)
  function publicarSesion(s) { sesion = s; for (const cb of oyentesSesion) cb(s ? { ...s } : null); }
  onAuthStateChanged(auth, user => {
    quitarPerfil && quitarPerfil();
    // Si «entrar» ya abrió la sesión de este mismo usuario, no se desarma lo que dejó listo (caja, pendientes).
    if (!user || sesion?.uid !== user.uid) { quitarCaja && quitarCaja(); quitarPendientes && quitarPendientes(); quitarCaja = quitarPendientes = null; miCaja = null; pendientesVentas = 0; }
    if (!user) { publicarSesion(null); return; }
    quitarPerfil = onSnapshot(ref('usuarios', user.uid), { includeMetadataChanges: true }, snap => {
      // La copia del teléfono puede venir vacía justo después de cerrar sesión: solo se decide con la respuesta
      // del servidor. Antes se cerraba la sesión en silencio con esa copia vacía y no se podía volver a entrar.
      if (!snap.exists() && snap.metadata.fromCache) return;
      const u = snap.data();
      if (!u || !u.activo) { errorPerfil = !u ? 'perfil-no-encontrado' : 'perfil-inactivo'; signOut(auth); return; }
      aplicarPerfil(user, u);
    }, e => { console.warn('perfil', e); errorPerfil = e.code || e.message || 'perfil-error'; publicarSesion(null); });
  });
  // Abre (o actualiza) la sesión con el perfil leído: lo usan el aviso de Firestore y también «entrar»,
  // que ya leyó el perfil del servidor y no tiene por qué esperar otro aviso para abrir la app.
  function aplicarPerfil(user, u) {
      errorPerfil = null;
      const nueva = { uid: user.uid, usuario: u.usuario, nombre: u.nombre, rol: u.rol, foto: u.foto || null }; // v2.16: con la foto de perfil
      const cambio = !sesion || sesion.rol !== nueva.rol || sesion.uid !== nueva.uid;
      if (cambio) {
        quitarCaja && quitarCaja();
        cajaConocida = new Promise(r => { avisarCajaConocida = r; });
        quitarCaja = onSnapshot(query(collection(db, 'cajas'), where('usuario', '==', u.usuario), where('estado', '==', 'abierta')), s => {
          miCaja = s.docs[0] ? s.docs[0].data() : null;
          avisarCajaConocida();
        });
        // Ventas propias aún sin número: las que tienen escrituras pendientes cuentan como "por subir", también tras recargar.
        quitarPendientes && quitarPendientes();
        quitarPendientes = onSnapshot(query(collection(db, 'ventas'), where('usuario', '==', u.usuario), where('numero', '==', null)), { includeMetadataChanges: true }, s => {
          pendientesVentas = s.docs.filter(d => d.metadata.hasPendingWrites).length;
          avisarSync();
        }, () => {});
        if (puede(u.rol, 'verReportesTodos') && navigator.onLine) completarNumeros().catch(() => {});
      }
      publicarSesion(nueva);
  }

  async function numerarVenta(id) {
    await runTransaction(db, async tx => {
      const actual = await tx.get(ref('ventas', id));
      if (!actual.exists() || actual.data().numero) return;
      const c = await tx.get(ref('contadores', 'ventas'));
      const n = (c.data()?.n || 0) + 1;
      const numero = 'V-' + String(n).padStart(4, '0');
      tx.set(ref('contadores', 'ventas'), { n, numero, ventaId: id });
      tx.update(ref('ventas', id), { numero });
    });
  }

  async function completarNumeros() {
    const q = await getDocs(query(collection(db, 'ventas'), where('numero', '==', null)));
    const lista = q.docs.map(d => d.data()).sort((a, b) => a.creada.localeCompare(b.creada));
    for (const v of lista) await numerarVenta(v.id);
  }

  async function crearCuenta(usuario, pin) {
    const email = correo(usuario);
    const sec = initializeApp(config, 'sec-' + Date.now());
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(sec), email, pinPass(pin));
      await signOut(getAuth(sec));
      return { uid: cred.user.uid, email };
    } finally { deleteApp(sec).catch(() => {}); }
  }

  const marcaCobro = (uid, p) => doc(db, 'usuarios', uid, 'operacionesCobro', claveOperacion(p));
  const resultadoMarca = snap => snap.data()?.estadoSync === RECHAZADA_CONFLICTO ? rechazado('conflicto')
    : snap.metadata.hasPendingWrites ? pendienteLocal() : confirmado();
  const listo = resultado => ({ resultado, entrada: Promise.resolve() });
  const avisarCobros = () => globalThis.dispatchEvent?.(new Event('pos:cobros-sync'));

  // Un solo lote por cobro. Firestore lo conserva y lo envía en orden en este dispositivo.
  // La marca inmutable y las reglas forman parte del mismo commit que stock, caja y comprobante.
  function enviarCobro(p, preparar) {
    const actor = sesion;
    const clave = actor.uid + ':' + claveOperacion(p);
    if (cobrosEnCurso.has(clave)) return cobrosEnCurso.get(clave);
    const enviar = async () => {
      const marca = marcaCobro(actor.uid, p);
      try {
        const previa = await getDocFromCache(marca);
        if (previa.exists()) return listo(resultadoMarca(previa));
      } catch { /* una ausencia en caché no decide el resultado del servidor */ }
      if (sesion?.uid !== actor.uid) return listo(NO('sesion'));
      const previo = leerCobro(actor.usuario, p);
      if (previo) return listo(previo.estadoSync === RECHAZADA_CONFLICTO ? rechazado('conflicto') : pendienteLocal());

      const b = writeBatch(db);
      const error = preparar(b);
      if (error) return listo(error);
      let recibo;
      try { recibo = guardarCobro(actor.usuario, { ...p, dispositivo: dispositivo().id }); }
      catch { return listo(NO('sin-almacenamiento')); }
      b.set(marca, { que: p.que, refId: p.id, orden: recibo.orden, dispositivo: recibo.dispositivo,
        fecha: p.datos.fecha, apartadoId: p.apartadoId || null, estadoSync: CONFIRMADA_SERVIDOR });
      return seguirCobro({ b, marca, p, actor });
    };
    // Compartir el inicio y la respuesta incluso si los dos toques llegaron antes de leer la caché.
    const iniciar = navigator.locks
      ? () => new Promise((resolve, reject) => {
          navigator.locks.request('pos-cobros-' + actor.uid, async () => {
            const accion = await enviar();
            resolve(accion.resultado);
            await accion.entrada;
          }).catch(reject);
        })
      : async () => (await enviar()).resultado;
    const resultado = iniciar().catch(e => NO(errorFirestore(e)));
    cobrosEnCurso.set(clave, resultado);
    resultado.then(() => { if (cobrosEnCurso.get(clave) === resultado) cobrosEnCurso.delete(clave); });
    return resultado;
  }

  function seguirCobro({ b, marca, p, actor }) {
    let encolado;
    const entrada = new Promise(r => { encolado = r; });
    let quitar = () => {}, entregadoLocal = false, reloj;
    const liberar = () => { clearTimeout(reloj); quitar(); encolado(); };
    quitar = onSnapshot(marca, { includeMetadataChanges: true }, s => { if (s.exists()) liberar(); }, liberar);
    reloj = setTimeout(liberar, 4000);
    let envio;
    try { envio = b.commit(); } catch (e) { envio = Promise.reject(e); }
    const servidor = observarEscritura(envio, liberar, false).then(() => {
      resolverCobro(actor.usuario, p, CONFIRMADA_SERVIDOR);
      if (sesion?.uid === actor.uid && (p.que === 'venta' || p.que === 'completar')) numerarVenta(p.id).catch(() => {});
      return confirmado();
    }, async e => {
      // Si el commit chocó con un ID existente, su marca decide. La ausencia se comprueba en servidor.
      try {
        const estado = await conTope(comprobarCobro(p, actor), 4000);
        if (estado === CONFIRMADA_SERVIDOR || estado === RECHAZADA_CONFLICTO) {
          resolverCobro(actor.usuario, p, estado);
          return estado === CONFIRMADA_SERVIDOR ? confirmado() : rechazado('conflicto');
        }
      } catch { /* la conciliación reintenta la lectura */ }
      if (entregadoLocal) {
        resolverCobro(actor.usuario, p, RECHAZADA_CONFLICTO);
        return rechazado(errorFirestore(e));
      }
      if (e?.code === 'permission-denied' && (p.que === 'venta' || p.que === 'apartado')) {
        const faltantes = await consultarFaltantes(p.datos.lineas);
        if (!entregadoLocal && faltantes.length) {
          resolverCobro(actor.usuario, p, CONFIRMADA_SERVIDOR);
          return { ok: false, faltantes };
        }
      }
      resolverCobro(actor.usuario, p, entregadoLocal ? RECHAZADA_CONFLICTO : CONFIRMADA_SERVIDOR);
      return entregadoLocal ? rechazado(errorFirestore(e)) : NO(errorFirestore(e));
    });
    const resultado = conTope(servidor, 4000).then(r => {
      if (r !== demora) return r;
      entregadoLocal = true;
      return pendienteLocal();
    });
    const terminado = () => {
      avisarSync();
      if (entregadoLocal) avisarCobros();
    };
    servidor.then(terminado, terminado);
    return { resultado, entrada };
  }

  async function comprobarCobro(p, actor) {
    const comprobar = async r => {
      const s = await getDocFromServer(r);
      if (s.metadata.hasPendingWrites) throw new Error('Cobro aún sin respuesta del servidor');
      return s.data();
    };
    const marca = await comprobar(marcaCobro(actor.uid, p));
    if (marca) return marca.estadoSync;
    // Un intento anterior de v2.42 puede haber confirmado el documento sin escribir una marca.
    const apartado = p.que === 'abono' || p.que === 'apartado';
    const docu = await comprobar(ref(apartado ? 'apartados' : 'ventas', p.apartadoId && p.que === 'abono' ? p.apartadoId : p.id));
    if (!docu) return null;
    if (p.que === 'abono') {
      return docu.abonos?.some(a => a.id === p.id && a.usuario === actor.usuario) ? CONFIRMADA_SERVIDOR : null;
    }
    return docu.uid === actor.uid && (p.que !== 'completar' || docu.desdeApartado === p.apartadoId) ? CONFIRMADA_SERVIDOR : null;
  }

  async function consultarFaltantes(lineas) {
    const cantidades = porSku(lineas);
    try {
      const datos = await conTope(Promise.all(Object.keys(cantidades).map(sku => getDocFromServer(ref('productos', sku)))), 1500);
      if (datos !== demora) return datos.filter(p => !p.metadata.hasPendingWrites && (p.data()?.existencia ?? 0) < cantidades[p.id]).map(p => p.id);
    } catch { /* el error del lote sigue siendo la respuesta disponible */ }
    return [];
  }

  function guardarConExistencia({ que, col, docu, lineas, motivo, ev }) {
    return enviarCobro({ que, id: docu.id, datos: docu }, b => {
      for (const [sku, n] of Object.entries(porSku(lineas))) mover(b, sku, -n, motivo, docu.id);
      b.set(ref(col, docu.id), limpiarIndefinidos(docu));
      if (ev) b.set(...evento(ev));
    });
  }

  const api = {
    nuevoId,

    // ---- sesión y usuarios ----
    async sistemaIniciado() {
      try { return (await getDoc(ref('sistema', 'estado'))).exists(); } catch { return true; }
    },
    async crearAdministrador({ nombre, usuario, pin }) {
      usuario = limpiarUsuario(usuario);
      if (!/^[a-z0-9._-]{3,20}$/.test(usuario) || !/^\d{4}$/.test(String(pin)) || String(nombre || '').trim().length < 2) return NO('datos');
      let creada = null;
      try {
        const email = correo(usuario);
        const cred = await createUserWithEmailAndPassword(auth, email, pinPass(pin));
        creada = cred.user;
        const b = writeBatch(db);
        b.set(ref('usuarios', cred.user.uid), { uid: cred.user.uid, usuario, nombre: nombre.trim(), rol: 'admin', activo: true, creado: ahora() });
        b.set(ref('logins', usuario), { email, uid: cred.user.uid });
        b.set(ref('sistema', 'estado'), { iniciado: true, creado: ahora() });
        // Se espera la respuesta del servidor (hasta 15 s): si las reglas lo rechazan o no hay base de datos,
        // se dice por qué y se borra la cuenta recién creada para no dejarla a medias.
        await Promise.race([b.commit(), new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('sin respuesta'), { code: 'sin-respuesta-de-firestore' })), 15000))]);
        return SI();
      } catch (e) {
        console.warn(e);
        if (creada) { await creada.delete().catch(() => {}); await signOut(auth).catch(() => {}); }
        return NO(e.code === 'auth/network-request-failed' ? 'red' : 'error', { detalle: e.code || e.message });
      }
    },
    // pasos(texto): la pantalla de entrada muestra en qué va («Buscando usuario…», etc.) para saber dónde se traba.
    async entrar(usuario, pin, pasos = () => {}) {
      const u = limpiarUsuario(usuario);
      const aTiempo = (prom, que) => Promise.race([prom, new Promise((_, no) => setTimeout(() => no(Object.assign(new Error(que), { code: 'sin-respuesta: ' + que })), 15000))]);
      try {
        pasos('Buscando usuario…'); console.info('[entrar] buscando usuario', u);
        const l = await aTiempo(getDoc(ref('logins', u)), 'buscar usuario');
        if (!l.exists()) return NO('no-existe');
        pasos('Verificando PIN…'); console.info('[entrar] verificando PIN');
        const cred = await aTiempo(signInWithEmailAndPassword(auth, l.data().email, pinPass(pin)), 'verificar PIN');
        pasos('Cargando tu perfil…'); console.info('[entrar] cargando perfil', cred.user.uid);
        const perfil = await aTiempo(getDoc(ref('usuarios', cred.user.uid)), 'cargar perfil');
        if (!perfil.exists() || !perfil.data().activo) { await signOut(auth); return NO('inactivo'); }
        // Con el perfil del servidor en la mano se abre la sesión de una vez.
        if (!sesion || sesion.uid !== cred.user.uid) aplicarPerfil(cred.user, perfil.data());
        console.info('[entrar] listo', !!sesion);
        if (sesion) conEvento(() => {}, 'entrar', []);
        return sesion ? SI() : NO('perfil', { detalle: errorPerfil || 'sin sesión' });
      } catch (e) {
        if (auth.currentUser && !sesion) signOut(auth).catch(() => {});
        const c = e.code || '';
        console.warn('[entrar]', c, e);
        if (c === 'auth/wrong-password' || c === 'auth/invalid-credential') return NO('pin');
        if (c === 'auth/too-many-requests') return NO('intentos');
        if (c === 'auth/network-request-failed' || c === 'unavailable') return NO('red');
        return NO('error', { detalle: c || e.message });
      }
    },
    async salir() {
      errorPerfil = null;
      if (sesion) { const b = writeBatch(db); anotar(b, 'salir', []); await Promise.race([b.commit().catch(() => {}), new Promise(r => setTimeout(r, 1500))]); }
      await signOut(auth); return SI();
    },
    // Por qué se cerró la sesión sola (perfil no encontrado, inactivo o sin permiso); la entrada lo muestra.
    motivoSalida() { const m = errorPerfil; errorPerfil = null; return m; },
    alCambiarSesion(cb) { oyentesSesion.add(cb); cb(sesion ? { ...sesion } : null); return () => oyentesSesion.delete(cb); },
    async crearUsuario({ usuario, nombre, rol, pin }) {
      const e = exigir('ajustes'); if (e) return NO(e);
      usuario = limpiarUsuario(usuario);
      if (!/^[a-z0-9._-]{3,20}$/.test(usuario) || !/^\d{4}$/.test(String(pin)) || !['admin', 'encargada', 'vendedora'].includes(rol)) return NO('datos');
      if ((await getDoc(ref('logins', usuario))).exists()) return NO('existe');
      try {
        const { uid, email } = await crearCuenta(usuario, pin);
        const b = writeBatch(db);
        b.set(ref('usuarios', uid), { uid, usuario, nombre: nombre || usuario, rol, activo: true, creado: ahora() });
        b.set(ref('logins', usuario), { email, uid });
        anotar(b, 'crearUsuario', [{ usuario, rol }], { uid });
        await b.commit();
        return SI({ uid });
      } catch (err) { console.warn(err); return NO(err.code === 'auth/network-request-failed' ? 'red' : 'error'); }
    },
    // Propio: pide el PIN actual. De otra persona (admin): cuenta nueva con el PIN nuevo, como en Pedidos.
    async cambiarPin(uid, pinNuevo, pinActual) {
      if (!sesion) return NO('sesion');
      // Solo el administrador cambia PIN (el suyo o el de otros); la vendedora y la encargada no.
      if (sesion.rol !== 'admin') return NO('permiso');
      if (!/^\d{4}$/.test(String(pinNuevo))) return NO('datos');
      try {
        if (uid === sesion.uid) {
          const user = auth.currentUser;
          await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pinPass(pinActual)));
          await updatePassword(user, pinPass(pinNuevo));
          conEvento(() => {}, 'cambiarPin', [uid], { u: sesion });
          return SI({ uid });
        }
        if (sesion.rol !== 'admin') return NO('permiso');
        const viejo = (await getDoc(ref('usuarios', uid))).data();
        if (!viejo) return NO('no-existe');
        const { uid: nuevo, email } = await crearCuenta(viejo.usuario, pinNuevo);
        const b = writeBatch(db);
        b.set(ref('usuarios', nuevo), { ...viejo, uid: nuevo, pinCambiado: ahora() });
        b.update(ref('usuarios', uid), { activo: false, reemplazadoPor: nuevo });
        b.set(ref('logins', viejo.usuario), { email, uid: nuevo });
        anotar(b, 'cambiarPin', [uid], { u: viejo });
        await b.commit();
        return SI({ uid: nuevo });
      } catch (e) {
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') return NO('pin');
        console.warn(e); return NO(e.code === 'auth/network-request-failed' ? 'red' : 'error');
      }
    },
    async marcarComision(uid, gana) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const u = (await api.obtener('usuarios', uid)) || null;
      return conEvento(b => b.update(ref('usuarios', uid), { ganaComision: !!gana }), 'marcarComision', [uid, gana], { u });
    },
    // v2.16: nombre y foto (dataURL pequeño) del usuario.
    async editarPerfil(uid, { nombre, foto }) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const u = (await api.obtener('usuarios', uid)) || null;
      return conEvento(b => b.update(ref('usuarios', uid), { nombre: String(nombre).trim(), foto: foto || null }), 'editarPerfil', [uid, { nombre, foto: !!foto }], { u });
    },
    // Eliminar: el perfil queda (las ventas viejas lo nombran) pero se apaga y se marca eliminado, y se borra
    // su entrada de «logins» para que nadie pueda entrar con ese usuario y se pueda volver a usar el nombre.
    async eliminarUsuario(uid) {
      const e = exigir('ajustes'); if (e) return NO(e);
      if (uid === sesion.uid) return NO('propio');
      const u = (await getDoc(ref('usuarios', uid))).data();
      if (!u) return NO('no-existe');
      const b = writeBatch(db);
      b.update(ref('usuarios', uid), { activo: false, eliminado: true, eliminadoEl: ahora() });
      const l = await getDoc(ref('logins', u.usuario));
      if (l.exists() && l.data().uid === uid) b.delete(ref('logins', u.usuario));
      anotar(b, 'eliminarUsuario', [uid], { u });
      return sinEsperar(b.commit());
    },
    async activarUsuario(uid, activo) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const u = (await api.obtener('usuarios', uid)) || null;
      return conEvento(b => b.update(ref('usuarios', uid), { activo: !!activo }), 'activarUsuario', [uid, activo], { u });
    },

    // ---- lectura ----
    escuchar(nombre, cb, filtro) {
      if (!sesion) { cb([]); return () => {}; }
      if (RESTRINGIDAS.includes(nombre) && !puede(sesion.rol, 'verCostos')) { cb([]); return () => {}; }
      if (SOLO_GESTION.includes(nombre) && !puede(sesion.rol, 'verReportesTodos')) { cb([]); return () => {}; }
      let q = collection(db, nombre);
      const todos = puede(sesion.rol, 'verReportesTodos') || (nombre === 'autorizaciones' && sesion.rol === 'admin');
      const conds = [];
      const obj = filtro && typeof filtro === 'object' ? filtro : null;
      if (PROPIAS.includes(nombre) && !todos) conds.push(where('usuario', '==', sesion.usuario));
      if (nombre === 'ventas' && obj?.cajaId) conds.push(where('cajaId', '==', obj.cajaId));
      else if (nombre === 'movimientos' && obj?.sku) conds.push(where('sku', '==', obj.sku));
      else if (!conds.length && ['ventas', 'movimientos', 'autorizaciones', 'eventos'].includes(nombre) && obj?.desde) conds.push(where('fecha', '>=', obj.desde));
      if (conds.length) q = query(q, ...conds);
      if (nombre === 'usuarios' && sesion.rol !== 'admin') q = query(q, where('activo', '==', true));
      return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => cumpleFiltro(d, filtro))),
        e => { console.warn('escuchar', nombre, e); cb([]); });
    },
    async obtener(nombre, id) {
      try { const s = await getDoc(ref(nombre, id)); return s.exists() ? { id: s.id, ...s.data() } : null; } catch { return null; }
    },
    // v2.26 · Conflictos de sincronización: lectura directa del servidor (lanza si no hay conexión),
    // espera a que suba lo pendiente, y registro / revisión de conflictos.
    async verificarServidor(nombre, id) {
      const s = await getDocFromServer(ref(nombre, id));
      if (s.metadata.hasPendingWrites) throw new Error('Escritura aún sin respuesta del servidor');
      return s.exists() ? { id: s.id, ...s.data() } : null;
    },
    async estadoCobro(que, id) {
      if (!sesion || !id) return null;
      const p = { que, id };
      const previo = leerCobro(sesion.usuario, p);
      if (previo) return previo.estadoSync;
      try {
        const s = await getDocFromCache(marcaCobro(sesion.uid, p));
        return s.exists() ? resultadoMarca(s).estadoSync : null;
      } catch { return null; }
    },
    notificarCobros: avisarSync,
    verificarCobro(p) {
      return comprobarCobro(p, sesion);
    },
    async esperarSubidas(topeMs = 15000) {
      return await conTope(waitForPendingWrites(db), topeMs) !== demora;
    },
    async registrarConflicto(c) {
      if (!sesion) return NO('sesion');
      try {
        const b = writeBatch(db);
        b.set(ref('conflictos', c.id), limpiarIndefinidos({ ...c, usuario: sesion.usuario, uid: sesion.uid, estado: 'pendiente', detectado: ahora() }));
        anotar(b, 'registrarConflicto', [c]);
        if (c.orden != null) b.set(marcaCobro(sesion.uid, { que: c.que, id: c.refId }), {
          que: c.que, refId: c.refId, orden: c.orden, dispositivo: c.dispositivo,
          fecha: c.fecha, conflictoId: c.id, estadoSync: RECHAZADA_CONFLICTO,
        });
        if (await conTope(b.commit(), 4000) === demora) return NO('red');
        return SI();
      } catch (e) {
        // Ya registrado (la regla no deja reescribirlo): cuenta como hecho.
        try { if ((await getDocFromServer(ref('conflictos', c.id))).exists()) return SI(); } catch { /* sin conexión */ }
        return NO(e.code === 'permission-denied' ? 'permiso' : 'error');
      }
    },
    async revisarConflicto(id, nota) {
      const e = exigir('verReportesTodos'); if (e) return NO(e);
      return conEvento(b => b.update(ref('conflictos', id), { estado: 'revisado', revision: { por: sesion.usuario, fecha: ahora(), nota: String(nota || '').trim() } }), 'revisarConflicto', [id, nota]);
    },

    // ---- ventas ----
    async guardarVenta(venta) {
      const e = exigir('vender'); if (e) return NO(e);
      const uid = sesion.uid;
      await esperarCaja();
      if (sesion?.uid !== uid) return NO('sesion');
      if (!miCaja) return NO('sin-caja');
      const docu = { ...venta, numero: null, offline: !navigator.onLine, uid: sesion.uid, usuario: sesion.usuario, cajaId: miCaja.id, estado: 'ok', creada: ahora() };
      return guardarConExistencia({ que: 'venta', col: 'ventas', docu, lineas: venta.lineas, motivo: 'venta', ev: describir('guardarVenta', [venta]) });
    },
    async anularVenta(id, motivo) {
      const e = exigir('anularVenta'); if (e) return NO(e);
      if (!String(motivo || '').trim()) return NO('datos');
      const clave = 'anular:' + id;
      if (enCurso.has(clave)) return NO('ya-anulada');
      enCurso.add(clave);
      const fallo = err => { enCurso.delete(clave); return NO(err); };
      const v = await api.obtener('ventas', id); if (!v) return fallo('no-existe');
      if (v.estado === 'anulada') return fallo('ya-anulada');
      const original = v.cajaId ? await api.obtener('cajas', v.cajaId) : null;
      const caja = original?.estado === 'abierta' ? original : miCaja;
      if (!caja) return fallo('sin-caja');
      const neto = {};
      for (const p of v.pagos || []) neto[p.forma] = (neto[p.forma] || 0) + p.monto;
      if (v.vuelto?.partes) {
        for (const p of v.vuelto.partes) neto[p.forma] = (neto[p.forma] || 0) - p.monto;
      } else if (v.vuelto?.monto) neto[v.vuelto.forma] = (neto[v.vuelto.forma] || 0) - v.vuelto.monto;
      const movs = Object.entries(neto).map(([forma, m]) => [forma, Math.round(m * 100) / 100]).filter(([, m]) => m)
        .map(([forma, m]) => ({ tipo: m > 0 ? 'salida' : 'entrada', forma, monto: Math.abs(m), motivo: `anulación ${v.numero || ''}`.trim(), usuario: sesion.usuario, fecha: ahora() }));
      const b = writeBatch(db);
      for (const [sku, n] of Object.entries(porSku(v.lineas))) mover(b, sku, n, 'anulación', id, motivo);
      if (movs.length) b.update(ref('cajas', caja.id), { movimientos: arrayUnion(...movs) });
      b.update(ref('ventas', id), { estado: 'anulada', anulacion: { por: sesion.usuario, motivo, fecha: ahora() } });
      anotar(b, 'anularVenta', [id, motivo], { venta: v });
      return sinEsperar(b.commit(), () => enCurso.delete(clave));
    },

    // ---- apartados ----
    async guardarApartado(ap) {
      const e = exigir('vender'); if (e) return NO(e);
      const uid = sesion.uid;
      await esperarCaja();
      if (sesion?.uid !== uid) return NO('sesion');
      if (!miCaja) return NO('sin-caja');
      const abonos = (ap.abonos || []).map(a => ({ ...a, cajaId: miCaja.id, usuario: sesion.usuario, fecha: ap.fecha }));
      const abonado = abonos.reduce((s, a) => s + (a.equivalenteCop || 0), 0);
      const docu = { ...ap, abonos, saldo: Math.max(0, ap.total - abonado), uid, usuario: sesion.usuario, estado: 'pendiente', creada: ahora() };
      return guardarConExistencia({ que: 'apartado', col: 'apartados', docu, lineas: ap.lineas, motivo: 'apartado', ev: describir('guardarApartado', [ap]) });
    },
    async abonarApartado(id, pago) {
      const e = exigir('vender'); if (e) return NO(e);
      const uid = sesion.uid;
      await esperarCaja();
      if (sesion?.uid !== uid) return NO('sesion');
      if (!miCaja) return NO('sin-caja');
      const snap = await getDocFromCache(ref('apartados', id)).catch(() => null);
      const consulta = snap?.exists() ? snap : await conTope(getDoc(ref('apartados', id)), 4000).catch(() => null);
      if (sesion?.uid !== uid) return NO('sesion');
      if (!consulta || consulta === demora) return NO('red');
      const ap = consulta.data();
      if (!ap) return NO('no-existe');
      const abono = { ...pago, id: pago.id || nuevoId(), cajaId: miCaja.id, usuario: sesion.usuario, fecha: pago.fecha || ahora() };
      const p = { que: 'abono', id: abono.id, apartadoId: id, datos: { ...abono, cliente: ap.cliente } };
      if (ap.abonos?.some(a => a.id === abono.id) && !consulta.metadata.hasPendingWrites && !leerCobro(sesion.usuario, p)) return confirmado();
      return enviarCobro(p, b => {
        if (ap.estado !== 'pendiente') return NO('estado');
        if ((pago.equivalenteCop || 0) > ap.saldo + 50) return NO('excede');
        b.update(ref('apartados', id), { abonos: arrayUnion(abono), saldo: increment(-(pago.equivalenteCop || 0)), ultimoAbono: claveOperacion(p) });
        anotar(b, 'abonarApartado', [id, pago], { ap });
      });
    },
    async completarApartado(id, venta) {
      const e = exigir('vender'); if (e) return NO(e);
      const uid = sesion.uid;
      await esperarCaja();
      if (sesion?.uid !== uid) return NO('sesion');
      if (!miCaja) return NO('sin-caja');
      const snap = await getDocFromCache(ref('apartados', id)).catch(() => null);
      const consulta = snap?.exists() ? snap : await conTope(getDoc(ref('apartados', id)), 4000).catch(() => null);
      if (sesion?.uid !== uid) return NO('sesion');
      if (!consulta || consulta === demora) return NO('red');
      const ap = consulta.data();
      if (!ap) return NO('no-existe');
      const docu = { ...venta, desdeApartado: id, uid, usuario: sesion.usuario, cajaId: miCaja.id, numero: null,
        offline: !navigator.onLine, estado: 'ok', creada: ahora() };
      const p = { que: 'completar', id: venta.id, apartadoId: id, datos: docu };
      if (ap.estado === 'completado' && ap.ventaId === venta.id && !consulta.metadata.hasPendingWrites && !leerCobro(sesion.usuario, p)) return confirmado();
      return enviarCobro(p, b => {
        if (ap.estado !== 'pendiente') return NO('estado');
        if (venta.abonosPrevios !== ap.total - ap.saldo) return NO('saldo-cambio');
        b.set(ref('ventas', venta.id), limpiarIndefinidos(docu));
        b.update(ref('apartados', id), { estado: 'completado', ventaId: venta.id, saldo: 0 });
        anotar(b, 'completarApartado', [id, venta]);
      });
    },
    async cancelarApartado(id, motivo) {
      const e = exigir('cancelarApartado'); if (e) return NO(e);
      const ap = await api.obtener('apartados', id); if (!ap) return NO('no-existe');
      if (ap.estado !== 'pendiente') return NO('estado');
      const b = writeBatch(db);
      for (const [sku, n] of Object.entries(porSku(ap.lineas))) mover(b, sku, n, 'cancelación', id, motivo);
      b.update(ref('apartados', id), { estado: 'cancelado', cancelacion: { por: sesion.usuario, motivo, fecha: ahora() } });
      anotar(b, 'cancelarApartado', [id, motivo], { ap });
      return sinEsperar(b.commit());
    },

    // ---- caja ----
    async abrirCaja(fondo, { tipo = 'tienda' } = {}) {
      const e = exigir(tipo === 'personal' ? 'cajaPersonal' : 'abrirCaja'); if (e) return NO(e);
      await esperarCaja();
      if (miCaja) return NO('ya-abierta');
      const id = nuevoId();
      miCaja = { id, uid: sesion.uid, usuario: sesion.usuario, tipo, abierta: ahora(), fondo: { COP: 0, USD: 0, BS: 0, ...(tipo === 'personal' ? {} : fondo) }, movimientos: [], estado: 'abierta' };
      // El puntero cajaAbierta/{usuario} solo se puede crear si no existe: las reglas impiden dos cajas abiertas.
      const b = writeBatch(db);
      b.set(ref('cajas', id), miCaja);
      b.set(ref('cajaAbierta', sesion.usuario), { cajaId: id, desde: miCaja.abierta });
      anotar(b, 'abrirCaja', [fondo, { tipo }], { id });
      const r = await sinEsperar(b.commit());
      if (!r.ok) miCaja = null;
      return r.ok ? SI({ id, offline: r.offline }) : r;
    },
    async movimientoCaja(cajaId, mov) {
      if (!sesion) return NO('sesion');
      if (!miCaja || miCaja.id !== cajaId) return NO('cerrada');
      if (!(mov.monto > 0) || !['entrada', 'salida'].includes(mov.tipo)) return NO('datos');
      return conEvento(b => b.update(ref('cajas', cajaId), { movimientos: arrayUnion({ ...mov, usuario: sesion.usuario, fecha: ahora() }) }), 'movimientoCaja', [cajaId, mov], { moneda: mov.moneda });
    },
    async cerrarCaja(cajaId, cierre) {
      if (!sesion) return NO('sesion');
      if (!miCaja || miCaja.id !== cajaId) return NO('cerrada');
      const b = writeBatch(db);
      b.update(ref('cajas', cajaId), { estado: 'cerrada', cierre: { ...cierre, fecha: ahora() } });
      b.delete(ref('cajaAbierta', sesion.usuario));
      anotar(b, 'cerrarCaja', [cajaId, cierre]);
      const r = await sinEsperar(b.commit());
      if (r.ok) miCaja = null;
      return r;
    },
    // Cierra las cajas abiertas en un día anterior, a las 11:59 pm de su día (la primera app que se abra lo hace).
    async cerrarCajasVencidas(hoy) {
      if (!sesion) return NO('sesion');
      const todas = puede(sesion.rol, 'verReportesTodos');
      const conds = [where('estado', '==', 'abierta')];
      if (!todas) conds.push(where('usuario', '==', sesion.usuario));
      let docs;
      try { docs = (await getDocs(query(collection(db, 'cajas'), ...conds))).docs.map(d => ({ id: d.id, ...d.data() })); }
      catch { return NO('red'); }
      const vencidas = docs.filter(c => diaLocal(c.abierta) < hoy);
      if (!vencidas.length) return SI({ cerradas: 0 });
      const b = writeBatch(db);
      for (const c of vencidas) {
        b.update(ref('cajas', c.id), { estado: 'cerrada', cierre: { automatico: true, fecha: finDia(diaLocal(c.abierta)), porArquear: c.tipo !== 'personal', por: sesion.usuario } });
        b.delete(ref('cajaAbierta', c.usuario));
        anotar(b, 'cierreAutomatico', [c]);
      }
      const r = await sinEsperar(b.commit());
      if (r.ok && vencidas.some(c => c.id === miCaja?.id)) miCaja = null;
      return r.ok ? SI({ cerradas: vencidas.length }) : r;
    },
    async arquearCaja(cajaId, arqueo) {
      if (!sesion) return NO('sesion');
      const c = await api.obtener('cajas', cajaId); if (!c) return NO('no-existe');
      if (c.usuario !== sesion.usuario && !puede(sesion.rol, 'verReportesTodos')) return NO('permiso');
      if (c.estado !== 'cerrada' || !c.cierre?.porArquear) return NO('arqueada');
      return conEvento(b => b.update(ref('cajas', cajaId), { cierre: { ...c.cierre, ...arqueo, porArquear: false, arqueo: { por: sesion.usuario, fecha: ahora() } } }), 'arquearCaja', [cajaId, arqueo]);
    },
    async reabrirCaja(cajaId) {
      const e = exigir('reabrirCaja'); if (e) return NO(e);
      const c = await api.obtener('cajas', cajaId); if (!c) return NO('no-existe');
      if (c.estado === 'abierta') return SI();
      if (await api.obtener('cajaAbierta', c.usuario)) return NO('ya-abierta');
      const b = writeBatch(db);
      b.update(ref('cajas', cajaId), { estado: 'abierta', reaperturas: arrayUnion({ por: sesion.usuario, fecha: ahora() }) });
      b.set(ref('cajaAbierta', c.usuario), { cajaId, desde: ahora() });
      anotar(b, 'reabrirCaja', [cajaId], { caja: c });
      return sinEsperar(b.commit());
    },

    // ---- inventario ----
    async ajustarExistencia(sku, cantidad, motivo, nota) {
      const e = exigir('ajustarInventario'); if (e) return NO(e);
      if (!Number.isInteger(cantidad) || !cantidad || !String(motivo || '').trim()) return NO('datos');
      const b = writeBatch(db);
      mover(b, sku, cantidad, 'ajuste', null, `${motivo}${nota ? ': ' + nota : ''}`);
      anotar(b, 'ajustarExistencia', [sku, cantidad, motivo, nota], { nombre: nombreDeSku(sku) });
      return sinEsperar(b.commit());
    },
    // Lotes de hasta 450 escrituras. Si se corta, repetir la importación es seguro: lo ya creado sale como "sin cambios".
    // { existencias: true } aplica también la existencia del archivo a los que ya existen (con su movimiento).
    async aplicarImportacion(plan, { existencias = false } = {}) {
      const e = exigir('importar'); if (e) return NO(e);
      const fecha = ahora();
      const ops = [];
      for (const p of plan.nuevos || []) {
        const { costo, existencia, ...resto } = p;
        ops.push(b => b.set(ref('productos', p.sku), { ...resto, existencia: existencia || 0, activo: true }));
        if (existencia) ops.push(b => b.set(...movimiento(p.sku, existencia, 'importación', null)));
        if (costo != null) ops.push(b => b.set(ref('costos', p.sku), { sku: p.sku, costo, historial: [{ costo, desde: fecha }] }));
      }
      for (const { sku, campos } of plan.cambios || []) {
        const { costo, existencia, ...resto } = campos;
        if (Object.keys(resto).length) ops.push(b => b.update(ref('productos', sku), resto));
        if (costo != null) ops.push(b => b.set(ref('costos', sku), { sku, costo, historial: arrayUnion({ costo, desde: fecha }) }, { merge: true }));
      }
      if (existencias) for (const { sku, antes, despues } of plan.existencias || []) {
        ops.push(b => b.update(ref('productos', sku), { existencia: despues }));
        ops.push(b => b.set(...movimiento(sku, despues - antes, 'sincronización', null, 'Existencia de la Carga Masiva')));
      }
      try {
        for (let i = 0; i < ops.length; i += 450) {
          const b = writeBatch(db);
          ops.slice(i, i + 450).forEach(op => op(b));
          await b.commit();
        }
        conEvento(() => {}, 'aplicarImportacion', [plan, { existencias }]);
        return SI();
      } catch (err) { console.warn(err); return NO(err.code === 'permission-denied' ? 'permiso' : 'error'); }
    },
    async guardarOferta(grupo, oferta) {
      const e = exigir('ofertas'); if (e) return NO(e);
      const pct = Math.min(Math.max(Number(oferta?.pct) || 0, 0), 100);
      const q = await getDocs(query(collection(db, 'productos'), where('grupo', '==', grupo)));
      const b = writeBatch(db);
      q.docs.forEach(d => b.update(d.ref, { oferta: { pct, activa: !!oferta?.activa && pct > 0 } }));
      const d0 = q.docs[0]?.data();
      anotar(b, 'guardarOferta', [grupo, { pct, activa: !!oferta?.activa }], { nombre: d0 ? [d0.tipo, d0.marca, d0.genero, d0.color].filter(Boolean).join(' ') : grupo });
      return sinEsperar(b.commit());
    },
    // Foto de un código de imagen (img-0001): un solo archivo fotos/img-0001.webp para todas las variantes
    // con ese id_imagen; el registro va en ajustes/imagenes (todos lo leen, solo el admin lo cambia).
    async guardarImagen(codigo, blob) {
      const e = exigir('fotosMasivas'); if (e) return NO(e);
      codigo = String(codigo || '').trim().toLowerCase();
      if (!codigo) return NO('datos');
      let token = null; try { token = localStorage.getItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
      const subida = await subirFotoGitHub({ token, ruta: `fotos/${codigo.replace(/[^a-z0-9_-]/g, '')}.webp`, blob });
      if (!subida.ok) return NO(subida.error);
      const ruta = `${subida.ruta}?v=${Date.now()}`;
      const r = await conEvento(b => b.set(ref('ajustes', 'imagenes'), { fotos: { [codigo]: ruta } }, { merge: true }), 'guardarImagen', [codigo]);
      return r.ok ? SI({ ruta }) : r;
    },


    // ---- otros ----
    async guardarAjustes(nombreDoc, datos) {
      const e = exigir(nombreDoc === 'tasas' ? 'cambiarTasas' : 'ajustes'); if (e) return NO(e);
      // Los ajustes se cambian poco y casi siempre con conexión: se espera la respuesta del servidor (hasta 8 s)
      // para avisar si las reglas lo rechazan, en vez de dar por guardado algo que luego se deshace.
      let antes = {};
      try { antes = (await getDocFromCache(ref('ajustes', nombreDoc))).data() || {}; } catch { /* sin caché */ }
      const limpio = limpiarIndefinidos(datos);
      const cambios = diferencias(antes, limpio);
      const b = writeBatch(db);
      b.set(ref('ajustes', nombreDoc), limpio, { merge: true });
      if (cambios) anotar(b, 'guardarAjustes', [nombreDoc, datos], { cambios });
      const p = b.commit();
      sinEsperar(p);
      try {
        const r = await Promise.race([p.then(() => 'servidor'), new Promise(ok => setTimeout(() => ok('local'), 8000))]);
        return SI({ offline: r === 'local' });
      } catch (e) { console.warn('ajustes', e); return NO(e.code === 'permission-denied' ? 'permiso' : 'error'); }
    },
    async guardarCliente({ telefono, nombre }) {
      if (!sesion) return NO('sesion');
      const tel = telefonoInternacional(telefono);
      if (!tel || !String(nombre || '').trim()) return NO('datos');
      const n = String(nombre).trim();
      let previo = null;
      try { previo = (await getDocFromCache(ref('clientes', tel))).data() || null; } catch { /* no está en caché */ }
      if (previo?.nombre === n) return SI({ telefono: tel }); // sin cambios: no se escribe ni se anota
      // v2.27: cada alta o cambio de cliente va con su evento (las reglas exigen ultimoEvento).
      const b = writeBatch(db);
      const ev = describir('guardarCliente', [{ telefono: tel, nombre: n }], { telefono: tel, antes: previo?.nombre || null });
      const [er, ed] = evento(ev);
      b.set(ref('clientes', tel), { telefono: tel, nombre: n, ultimoEvento: ed.id });
      b.set(er, ed);
      const r = await sinEsperar(b.commit());
      return r.ok ? SI({ telefono: tel }) : r;
    },
    async solicitarAutorizacion(a, id = nuevoId()) {
      if (!sesion) return NO('sesion');
      if (!navigator.onLine) return NO('red');
      const r = await conEvento(b => b.set(ref('autorizaciones', id), { ...a, id, uid: sesion.uid, usuario: sesion.usuario, solicita: sesion.usuario, estado: 'pendiente', fecha: ahora() }), 'solicitarAutorizacion', [a], { id });
      return r.ok ? SI({ id }) : r;
    },
    async responderAutorizacion(id, aprobada) {
      const e = exigir('aprobarDescuento'); if (e) return NO(e);
      const a = await api.obtener('autorizaciones', id);
      return conEvento(b => b.update(ref('autorizaciones', id), { estado: aprobada ? 'aprobada' : 'rechazada', aprueba: sesion.usuario, respondida: ahora() }), 'responderAutorizacion', [id, aprobada], { a });
    },
    async pagarComisiones(reg) {
      const e = exigir('pagarComisiones'); if (e) return NO(e);
      const id = nuevoId();
      const r = await conEvento(b => b.set(ref('comisiones', id), { ...reg, id, por: sesion.usuario, fecha: ahora() }), 'pagarComisiones', [reg], { id });
      return r.ok ? SI({ id }) : r;
    },
    // Una vista de v2.35 en caché aún puede llamar a estas operaciones retiradas.
    async cargarEjemplos() { return NO('retirado'); },
    async quitarEjemplos() { return NO('retirado'); },
    async congelarCostoVenta(ventaId, costo) {
      const e = exigir('verCostos'); if (e) return NO(e);
      if (await api.obtener('costosVenta', ventaId)) return SI();
      return sinEsperar(setDoc(ref('costosVenta', ventaId), { id: ventaId, ...costo }));
    },
    estadoSync(cb) { oyentesSync.add(cb); cb(estadoActual()); return () => oyentesSync.delete(cb); },
  };
  return api;
}
