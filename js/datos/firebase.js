// Almacén Firebase (Firestore con caché persistente + Authentication con usuario y PIN, como Pedidos).
// Cumple el contrato de contrato.js. Las reglas de firestore.rules repiten estos permisos en el servidor.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, where, onSnapshot, getDoc, getDocFromCache, getDocs, setDoc, updateDoc, writeBatch, runTransaction, increment, arrayUnion, documentId } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { puede } from '../nucleo/permisos.js';
import { diaLocal, finDia } from '../nucleo/fechas.js';
import { telefonoInternacional } from '../nucleo/recibo.js';
import { nuevoId } from './contrato.js';
import { subirFotoGitHub, CLAVE_TOKEN } from './github-fotos.js';

const ahora = () => new Date().toISOString();
const NO = (error, extra = {}) => ({ ok: false, error, ...extra });
const SI = (extra = {}) => ({ ok: true, ...extra });
const pinPass = pin => 'cs-' + pin;
const correo = u => `${u}.${Math.random().toString(36).slice(2, 6)}@comicshop-pos.app`;
const limpiarUsuario = s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
const RESTRINGIDAS = ['costos', 'costosVenta', 'comisiones', 'movimientos'];
const PROPIAS = ['ventas', 'cajas', 'autorizaciones'];

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
  const enCurso = new Set();
  // La caja abierta se conoce con el primer dato de su escucha; vender espera ese momento (máx. 4 s).
  let cajaConocida = Promise.resolve(), avisarCajaConocida = () => {};
  const esperarCaja = () => Promise.race([cajaConocida, new Promise(r => setTimeout(r, 4000))]);
  let quitarPendientes = null;
  const oyentesSesion = new Set(), oyentesSync = new Set();
  let quitarPerfil = null, quitarCaja = null;

  const avisarSync = () => { for (const cb of oyentesSync) cb({ enLinea: navigator.onLine, pendientes: pendientes + pendientesVentas, error: errorSync }); };
  addEventListener('offline', avisarSync);
  addEventListener('online', () => { avisarSync(); if (sesion && puede(sesion.rol, 'verReportesTodos')) completarNumeros().catch(() => {}); });

  // Escritura sin esperar al servidor: queda en el teléfono al instante y sube cuando hay internet.
  function sinEsperar(p) {
    pendientes++; avisarSync();
    let local = false;
    p.then(() => { errorSync = null; }, e => { console.warn('sincronización', e); errorSync = e.code || 'error'; })
      .finally(() => { pendientes = Math.max(0, pendientes - 1); avisarSync(); });
    return Promise.race([p.then(() => 'servidor'), new Promise(r => setTimeout(() => { local = true; r('local'); }, 1200))])
      .then(() => SI({ offline: local }), e => NO(e.code === 'permission-denied' ? 'permiso' : 'error'));
  }
  // Firestore no acepta campos «undefined»: se quitan (en cualquier nivel) antes de guardar.
  const limpiarIndefinidos = v => Array.isArray(v) ? v.map(limpiarIndefinidos) : v && typeof v === 'object' && v.constructor === Object ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, limpiarIndefinidos(x)])) : v;
  const exigir = accion => (!sesion ? 'sesion' : !puede(sesion.rol, accion) ? 'permiso' : null);
  const ref = (n, id) => doc(db, n, id);
  const porSku = lineas => { const m = {}; for (const l of lineas) m[l.sku] = (m[l.sku] || 0) + l.cantidad; return m; };
  const movimiento = (sku, cantidad, motivo, refId, nota) => {
    const id = nuevoId();
    return [ref('movimientos', id), { id, sku, cantidad, motivo, ref: refId || null, nota: nota || '', usuario: sesion.usuario, fecha: ahora() }];
  };

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
      const nueva = { uid: user.uid, usuario: u.usuario, nombre: u.nombre, rol: u.rol };
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

  async function completarNumeros() {
    const q = await getDocs(query(collection(db, 'ventas'), where('numero', '==', null)));
    const lista = q.docs.map(d => d.data()).sort((a, b) => a.creada.localeCompare(b.creada));
    for (const v of lista) {
      await runTransaction(db, async tx => {
        const actual = await tx.get(ref('ventas', v.id));
        if (!actual.exists() || actual.data().numero) return;
        const c = await tx.get(ref('contadores', 'ventas'));
        const n = (c.data()?.n || 0) + 1;
        tx.set(ref('contadores', 'ventas'), { n });
        tx.update(ref('ventas', v.id), { numero: 'V-' + String(n).padStart(4, '0') });
      });
    }
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

  // ---- venta/apartado con existencia ----
  async function guardarConExistencia({ col, docu, lineas, motivo, numerar }) {
    if (enCurso.has(docu.id)) return SI({ offline: false });
    enCurso.add(docu.id);
    try {
      const cant = porSku(lineas);
      if (navigator.onLine) {
        try {
          const tope = new Promise((_, mal) => setTimeout(() => mal({ code: 'unavailable', tope: true }), 4000));
          const r = await Promise.race([tope, runTransaction(db, async tx => {
            const previa = await tx.get(ref(col, docu.id));
            if (previa.exists()) return SI({ offline: false });
            const prods = await Promise.all(Object.keys(cant).map(sku => tx.get(ref('productos', sku))));
            const faltan = prods.filter(p => (p.data()?.existencia ?? 0) < cant[p.id]).map(p => p.id);
            if (faltan.length) return { ok: false, faltantes: faltan };
            let numero = null;
            if (numerar) {
              const c = await tx.get(ref('contadores', 'ventas'));
              const n = (c.data()?.n || 0) + 1;
              numero = 'V-' + String(n).padStart(4, '0');
              tx.set(ref('contadores', 'ventas'), { n });
            }
            for (const p of prods) {
              tx.update(p.ref, { existencia: p.data().existencia - cant[p.id] });
              tx.set(...movimiento(p.id, -cant[p.id], motivo, docu.id));
            }
            tx.set(ref(col, docu.id), { ...docu, ...(numerar ? { numero } : {}), offline: false });
            return SI({ offline: false });
          })]);
          return r;
        } catch (e) {
          if (e.code !== 'unavailable') { enCurso.delete(docu.id); return NO(e.code === 'permission-denied' ? 'permiso' : 'error'); }
        }
      }
      // Si ya quedó guardada (otro intento, o la transacción terminó tarde), no se repite.
      try { if ((await getDocFromCache(ref(col, docu.id))).exists()) return SI({ offline: true }); } catch { /* no está en caché */ }
      // Sin conexión: se guarda en el teléfono y sube después; la existencia puede quedar negativa.
      const b = writeBatch(db);
      for (const [sku, n] of Object.entries(cant)) {
        b.update(ref('productos', sku), { existencia: increment(-n) });
        b.set(...movimiento(sku, -n, motivo, docu.id));
      }
      b.set(ref(col, docu.id), { ...docu, ...(numerar ? { numero: null } : {}), offline: true });
      const r = await sinEsperar(b.commit());
      if (!r.ok) enCurso.delete(docu.id);
      return r.ok ? SI({ offline: true }) : r;
    } catch (e) { enCurso.delete(docu.id); throw e; }
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
    async salir() { errorPerfil = null; await signOut(auth); return SI(); },
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
        await b.commit();
        return SI({ uid: nuevo });
      } catch (e) {
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') return NO('pin');
        console.warn(e); return NO(e.code === 'auth/network-request-failed' ? 'red' : 'error');
      }
    },
    async marcarComision(uid, gana) {
      const e = exigir('ajustes'); if (e) return NO(e);
      return sinEsperar(updateDoc(ref('usuarios', uid), { ganaComision: !!gana }));
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
      return sinEsperar(b.commit());
    },
    async activarUsuario(uid, activo) {
      const e = exigir('ajustes'); if (e) return NO(e);
      return sinEsperar(updateDoc(ref('usuarios', uid), { activo: !!activo }));
    },

    // ---- lectura ----
    escuchar(nombre, cb, filtro) {
      if (!sesion) { cb([]); return () => {}; }
      if (RESTRINGIDAS.includes(nombre) && !puede(sesion.rol, 'verCostos')) { cb([]); return () => {}; }
      let q = collection(db, nombre);
      const todos = puede(sesion.rol, 'verReportesTodos') || (nombre === 'autorizaciones' && sesion.rol === 'admin');
      const conds = [];
      const obj = filtro && typeof filtro === 'object' ? filtro : null;
      if (PROPIAS.includes(nombre) && !todos) conds.push(where('usuario', '==', sesion.usuario));
      if (nombre === 'ventas' && obj?.cajaId) conds.push(where('cajaId', '==', obj.cajaId));
      else if (nombre === 'movimientos' && obj?.sku) conds.push(where('sku', '==', obj.sku));
      else if (!conds.length && ['ventas', 'movimientos', 'autorizaciones'].includes(nombre) && obj?.desde) conds.push(where('fecha', '>=', obj.desde));
      if (conds.length) q = query(q, ...conds);
      if (nombre === 'usuarios' && sesion.rol !== 'admin') q = query(q, where('activo', '==', true));
      return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => cumpleFiltro(d, filtro))),
        e => { console.warn('escuchar', nombre, e); cb([]); });
    },
    async obtener(nombre, id) {
      try { const s = await getDoc(ref(nombre, id)); return s.exists() ? { id: s.id, ...s.data() } : null; } catch { return null; }
    },

    // ---- ventas ----
    async guardarVenta(venta) {
      const e = exigir('vender'); if (e) return NO(e);
      await esperarCaja();
      if (!miCaja) return NO('sin-caja');
      const docu = { ...venta, uid: sesion.uid, usuario: sesion.usuario, cajaId: miCaja.id, estado: 'ok', creada: ahora() };
      return guardarConExistencia({ col: 'ventas', docu, lineas: venta.lineas, motivo: 'venta', numerar: true });
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
      if (v.vuelto?.monto) neto[v.vuelto.forma] = (neto[v.vuelto.forma] || 0) - v.vuelto.monto;
      const movs = Object.entries(neto).map(([forma, m]) => [forma, Math.round(m * 100) / 100]).filter(([, m]) => m)
        .map(([forma, m]) => ({ tipo: m > 0 ? 'salida' : 'entrada', forma, monto: Math.abs(m), motivo: `anulación ${v.numero || ''}`.trim(), usuario: sesion.usuario, fecha: ahora() }));
      const b = writeBatch(db);
      for (const [sku, n] of Object.entries(porSku(v.lineas))) {
        b.update(ref('productos', sku), { existencia: increment(n) });
        b.set(...movimiento(sku, n, 'anulación', id, motivo));
      }
      if (movs.length) b.update(ref('cajas', caja.id), { movimientos: arrayUnion(...movs) });
      b.update(ref('ventas', id), { estado: 'anulada', anulacion: { por: sesion.usuario, motivo, fecha: ahora() } });
      const r = await sinEsperar(b.commit());
      if (!r.ok) enCurso.delete(clave);
      return r;
    },

    // ---- apartados ----
    async guardarApartado(ap) {
      const e = exigir('vender'); if (e) return NO(e);
      await esperarCaja();
      if (!miCaja) return NO('sin-caja');
      const abonos = (ap.abonos || []).map(a => ({ ...a, cajaId: miCaja.id, usuario: sesion.usuario, fecha: ahora() }));
      const abonado = abonos.reduce((s, a) => s + (a.equivalenteCop || 0), 0);
      const docu = { ...ap, abonos, saldo: Math.max(0, ap.total - abonado), uid: sesion.uid, usuario: sesion.usuario, estado: 'pendiente', creada: ahora() };
      return guardarConExistencia({ col: 'apartados', docu, lineas: ap.lineas, motivo: 'apartado', numerar: false });
    },
    async abonarApartado(id, pago) {
      const e = exigir('vender'); if (e) return NO(e);
      await esperarCaja();
      if (!miCaja) return NO('sin-caja');
      const ap = await api.obtener('apartados', id); if (!ap) return NO('no-existe');
      if (ap.estado !== 'pendiente') return NO('estado');
      if (pago.id && (ap.abonos || []).some(x => x.id === pago.id)) return SI();
      if ((pago.equivalenteCop || 0) > ap.saldo + 50) return NO('excede');
      const abono = { ...pago, cajaId: miCaja.id, usuario: sesion.usuario, fecha: ahora() };
      // increment: dos abonos a la vez (dos teléfonos, o uno sin conexión) restan los dos.
      return sinEsperar(updateDoc(ref('apartados', id), { abonos: arrayUnion(abono), saldo: increment(-(pago.equivalenteCop || 0)) }));
    },
    async completarApartado(id, venta) {
      const e = exigir('vender'); if (e) return NO(e);
      await esperarCaja();
      if (!miCaja) return NO('sin-caja');
      const ap = await api.obtener('apartados', id); if (!ap) return NO('no-existe');
      if (ap.estado === 'completado' && ap.ventaId === venta.id) return SI({ offline: false });
      if (ap.estado !== 'pendiente') return NO('estado');
      const b = writeBatch(db);
      b.set(ref('ventas', venta.id), { ...venta, desdeApartado: id, uid: sesion.uid, usuario: sesion.usuario, cajaId: miCaja.id, numero: null, offline: !navigator.onLine, estado: 'ok', creada: ahora() });
      b.update(ref('apartados', id), { estado: 'completado', ventaId: venta.id, saldo: 0 });
      const r = await sinEsperar(b.commit());
      if (r.ok && navigator.onLine && puede(sesion.rol, 'verReportesTodos')) completarNumeros().catch(() => {});
      return r;
    },
    async cancelarApartado(id, motivo) {
      const e = exigir('cancelarApartado'); if (e) return NO(e);
      const ap = await api.obtener('apartados', id); if (!ap) return NO('no-existe');
      if (ap.estado !== 'pendiente') return NO('estado');
      const b = writeBatch(db);
      for (const [sku, n] of Object.entries(porSku(ap.lineas))) {
        b.update(ref('productos', sku), { existencia: increment(n) });
        b.set(...movimiento(sku, n, 'cancelación', id, motivo));
      }
      b.update(ref('apartados', id), { estado: 'cancelado', cancelacion: { por: sesion.usuario, motivo, fecha: ahora() } });
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
      const r = await sinEsperar(b.commit());
      if (!r.ok) miCaja = null;
      return r.ok ? SI({ id, offline: r.offline }) : r;
    },
    async movimientoCaja(cajaId, mov) {
      if (!sesion) return NO('sesion');
      if (!miCaja || miCaja.id !== cajaId) return NO('cerrada');
      if (!(mov.monto > 0) || !['entrada', 'salida'].includes(mov.tipo)) return NO('datos');
      return sinEsperar(updateDoc(ref('cajas', cajaId), { movimientos: arrayUnion({ ...mov, usuario: sesion.usuario, fecha: ahora() }) }));
    },
    async cerrarCaja(cajaId, cierre) {
      if (!sesion) return NO('sesion');
      if (!miCaja || miCaja.id !== cajaId) return NO('cerrada');
      const b = writeBatch(db);
      b.update(ref('cajas', cajaId), { estado: 'cerrada', cierre: { ...cierre, fecha: ahora() } });
      b.delete(ref('cajaAbierta', sesion.usuario));
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
      return sinEsperar(updateDoc(ref('cajas', cajaId), { cierre: { ...c.cierre, ...arqueo, porArquear: false, arqueo: { por: sesion.usuario, fecha: ahora() } } }));
    },
    async reabrirCaja(cajaId) {
      const e = exigir('reabrirCaja'); if (e) return NO(e);
      const c = await api.obtener('cajas', cajaId); if (!c) return NO('no-existe');
      if (c.estado === 'abierta') return SI();
      if (await api.obtener('cajaAbierta', c.usuario)) return NO('ya-abierta');
      const b = writeBatch(db);
      b.update(ref('cajas', cajaId), { estado: 'abierta', reaperturas: arrayUnion({ por: sesion.usuario, fecha: ahora() }) });
      b.set(ref('cajaAbierta', c.usuario), { cajaId, desde: ahora() });
      return sinEsperar(b.commit());
    },

    // ---- inventario ----
    async ajustarExistencia(sku, cantidad, motivo, nota) {
      const e = exigir('ajustarInventario'); if (e) return NO(e);
      if (!Number.isInteger(cantidad) || !cantidad || !String(motivo || '').trim()) return NO('datos');
      const b = writeBatch(db);
      b.update(ref('productos', sku), { existencia: increment(cantidad) });
      b.set(...movimiento(sku, cantidad, 'ajuste', null, `${motivo}${nota ? ': ' + nota : ''}`));
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
        return SI();
      } catch (err) { console.warn(err); return NO(err.code === 'permission-denied' ? 'permiso' : 'error'); }
    },
    async guardarOferta(grupo, oferta) {
      const e = exigir('ofertas'); if (e) return NO(e);
      const pct = Math.min(Math.max(Number(oferta?.pct) || 0, 0), 100);
      const q = await getDocs(query(collection(db, 'productos'), where('grupo', '==', grupo)));
      const b = writeBatch(db);
      q.docs.forEach(d => b.update(d.ref, { oferta: { pct, activa: !!oferta?.activa && pct > 0 } }));
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
      const r = await sinEsperar(setDoc(ref('ajustes', 'imagenes'), { fotos: { [codigo]: ruta } }, { merge: true }));
      return r.ok ? SI({ ruta }) : r;
    },


    // ---- otros ----
    async guardarAjustes(nombreDoc, datos) {
      const e = exigir(nombreDoc === 'tasas' ? 'cambiarTasas' : 'ajustes'); if (e) return NO(e);
      // Los ajustes se cambian poco y casi siempre con conexión: se espera la respuesta del servidor (hasta 8 s)
      // para avisar si las reglas lo rechazan, en vez de dar por guardado algo que luego se deshace.
      const p = setDoc(ref('ajustes', nombreDoc), limpiarIndefinidos(datos), { merge: true });
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
      const r = await sinEsperar(setDoc(ref('clientes', tel), { telefono: tel, nombre: String(nombre).trim() }));
      return r.ok ? SI({ telefono: tel }) : r;
    },
    async solicitarAutorizacion(a) {
      if (!sesion) return NO('sesion');
      if (!navigator.onLine) return NO('red');
      const id = nuevoId();
      const r = await sinEsperar(setDoc(ref('autorizaciones', id), { ...a, id, uid: sesion.uid, usuario: sesion.usuario, solicita: sesion.usuario, estado: 'pendiente', fecha: ahora() }));
      return r.ok ? SI({ id }) : r;
    },
    async responderAutorizacion(id, aprobada) {
      const e = exigir('aprobarDescuento'); if (e) return NO(e);
      return sinEsperar(updateDoc(ref('autorizaciones', id), { estado: aprobada ? 'aprobada' : 'rechazada', aprueba: sesion.usuario, respondida: ahora() }));
    },
    async pagarComisiones(reg) {
      const e = exigir('pagarComisiones'); if (e) return NO(e);
      const id = nuevoId();
      const r = await sinEsperar(setDoc(ref('comisiones', id), { ...reg, id, por: sesion.usuario, fecha: ahora() }));
      return r.ok ? SI({ id }) : r;
    },
    // Modo prueba: ejemplos con demo:true, en lotes de 400 escrituras.
    async cargarEjemplos(lote) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const CLAVE = { productos: 'sku', costos: 'sku', clientes: 'telefono', ventas: 'id', apartados: 'id' };
      const ops = Object.entries(CLAVE).flatMap(([n, k]) => (lote[n] || []).map(d => [ref(n, String(d[k])), { ...d, demo: true }]));
      try {
        for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(([r, d]) => b.set(r, d)); await b.commit(); }
        return SI();
      } catch { return NO('red'); }
    },
    async quitarEjemplos() {
      const e = exigir('ajustes'); if (e) return NO(e);
      try {
        const refs = [];
        for (const n of ['productos', 'costos', 'clientes', 'ventas', 'apartados']) (await getDocs(query(collection(db, n), where('demo', '==', true)))).forEach(d => refs.push(d.ref));
        (await getDocs(query(collection(db, 'costosVenta'), where(documentId(), '>=', 'demo-'), where(documentId(), '<', 'demo.')))).forEach(d => refs.push(d.ref));
        for (let i = 0; i < refs.length; i += 400) { const b = writeBatch(db); refs.slice(i, i + 400).forEach(r => b.delete(r)); await b.commit(); }
        return SI({ quitados: refs.length });
      } catch { return NO('red'); }
    },
    async congelarCostoVenta(ventaId, costo) {
      const e = exigir('verCostos'); if (e) return NO(e);
      if (await api.obtener('costosVenta', ventaId)) return SI();
      return sinEsperar(setDoc(ref('costosVenta', ventaId), { id: ventaId, ...costo }));
    },
    estadoSync(cb) { oyentesSync.add(cb); cb({ enLinea: navigator.onLine, pendientes, error: errorSync }); return () => oyentesSync.delete(cb); },
  };
  return api;
}
