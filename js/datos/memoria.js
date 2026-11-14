// Almacén en memoria: modo demostración y pruebas. Cumple el mismo contrato que firebase.js
// y aplica los mismos permisos, para que las pantallas se comporten igual en ambos.
import { puede } from '../nucleo/permisos.js';
import { diaLocal, finDia } from '../nucleo/fechas.js';
import { claveFoto } from '../nucleo/fotos.js';
import { telefonoInternacional } from '../nucleo/recibo.js';
import { NOMBRES, nuevoId } from './contrato.js';

const ahora = () => new Date().toISOString();
const copia = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
const NO = error => ({ ok: false, error });
const SI = (extra = {}) => ({ ok: true, ...extra });

export function crearMemoria(datos, { guardarEn = null } = {}) {
  const col = Object.fromEntries(NOMBRES.map(n => [n, new Map()]));
  const pins = new Map();
  let sesion = null, offline = false, pendientes = 0, contadorVentas = 0;
  const oyentes = [], oyentesSesion = new Set(), oyentesSync = new Set();

  for (const u of datos.usuarios || []) {
    const uid = 'u-' + u.usuario;
    col.usuarios.set(uid, { uid, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: true });
    pins.set(uid, u.pin);
  }
  for (const p of datos.productos || []) {
    col.productos.set(p.sku, copia(p));
    if (p.existencia) col.movimientos.set('ini-' + p.sku, { id: 'ini-' + p.sku, sku: p.sku, cantidad: p.existencia, motivo: 'inicial', ref: null, nota: '', usuario: 'admin', fecha: new Date(Date.now() - 864e5).toISOString() });
  }
  for (const c of datos.costos || []) col.costos.set(c.sku, copia(c));
  for (const c of datos.clientes || []) col.clientes.set(c.telefono, copia(c));
  for (const [k, v] of Object.entries(datos.ajustes || {})) col.ajustes.set(k, copia({ id: k, ...v }));

  // Demostración: lo guardado se guarda en el teléfono (localStorage): sobrevive a recargas, a cerrar la app y a las actualizaciones.
  let reloj = null;
  const persistir = () => {
    if (!guardarEn || reloj) return;
    reloj = setTimeout(() => {
      reloj = null;
      try { localStorage.setItem(guardarEn, JSON.stringify({ col: Object.fromEntries(Object.entries(col).map(([k, m]) => [k, [...m]])), pins: [...pins], contadorVentas })); } catch { /* sin almacenamiento */ }
    }, 50);
  };
  if (guardarEn) {
    try {
      // Primera vez tras la v1.55: se rescata lo que hubiera en la pestaña (sessionStorage).
      const g = JSON.parse(localStorage.getItem(guardarEn) || sessionStorage.getItem(guardarEn) || 'null');
      if (g) {
        for (const [k, filas] of Object.entries(g.col)) if (col[k]) { col[k].clear(); for (const [id, d] of filas) col[k].set(id, d); }
        pins.clear(); for (const [k, v] of g.pins) pins.set(k, v);
        contadorVentas = g.contadorVentas || 0;
      }
    } catch { /* datos dañados: se empieza de cero */ }
  }

  // ---- utilidades internas ----
  const rol = () => sesion?.rol;
  const visible = (nombre, doc) => {
    if (!sesion) return false;
    const r = rol();
    if (['costos', 'costosVenta', 'comisiones', 'movimientos'].includes(nombre)) return puede(r, 'verCostos');
    if (['ventas', 'cajas'].includes(nombre)) return puede(r, 'verReportesTodos') || doc.usuario === sesion.usuario;
    if (nombre === 'autorizaciones') return r === 'admin' || doc.usuario === sesion.usuario;
    return true;
  };
  const cumple = (d, f) => {
    if (!f) return true;
    if (typeof f === 'function') return f(d);
    const fecha = d.fecha || d.abierta || '';
    if (f.desde && fecha < f.desde) return false;
    if (f.hasta && fecha > f.hasta) return false;
    for (const k of ['usuario', 'cajaId', 'sku', 'estado']) if (f[k] != null && d[k] !== f[k]) return false;
    return true;
  };
  const leer = (nombre, filtro) => [...col[nombre].values()].filter(d => visible(nombre, d) && cumple(d, filtro)).map(copia);
  const avisar = (...nombres) => { persistir(); for (const o of [...oyentes]) if (nombres.includes(o.nombre)) o.cb(leer(o.nombre, o.filtro)); };
  const avisarSync = () => { for (const cb of oyentesSync) cb({ enLinea: !offline, pendientes, error: null }); };
  const escribio = () => { if (offline) { pendientes++; avisarSync(); } };
  const cajaAbierta = uid => [...col.cajas.values()].find(c => c.usuario === col.usuarios.get(uid)?.usuario && c.estado === 'abierta');
  const mover = (sku, cantidad, motivo, ref, nota) => {
    const p = col.productos.get(sku);
    if (p) p.existencia += cantidad;
    const id = nuevoId();
    col.movimientos.set(id, { id, sku, cantidad, motivo, ref, nota: nota || '', usuario: sesion?.usuario, fecha: ahora() });
  };
  const porSku = lineas => { const m = {}; for (const l of lineas) m[l.sku] = (m[l.sku] || 0) + l.cantidad; return m; };
  const faltantes = lineas => Object.entries(porSku(lineas)).filter(([sku, n]) => (col.productos.get(sku)?.existencia ?? 0) < n).map(([sku]) => sku);
  const numerar = () => 'V-' + String(++contadorVentas).padStart(4, '0');
  const exigir = accion => (!sesion ? 'sesion' : !puede(rol(), accion) ? 'permiso' : null);

  const api = {
    nuevoId,
    _estado: nombre => col[nombre],

    // ---- sesión y usuarios ----
    async entrar(usuario, pin) {
      if (offline) return NO('red');
      const u = [...col.usuarios.values()].find(x => x.usuario === String(usuario).trim().toLowerCase());
      if (!u) return NO('no-existe');
      if (pins.get(u.uid) !== String(pin)) return NO('pin');
      if (!u.activo) return NO('inactivo');
      sesion = { uid: u.uid, usuario: u.usuario, nombre: u.nombre, rol: u.rol };
      for (const cb of oyentesSesion) cb(copia(sesion));
      return SI();
    },
    async salir() { sesion = null; for (const cb of oyentesSesion) cb(null); return SI(); },
    alCambiarSesion(cb) { oyentesSesion.add(cb); cb(copia(sesion)); return () => oyentesSesion.delete(cb); },
    async crearUsuario({ usuario, nombre, rol: r, pin }) {
      const e = exigir('ajustes'); if (e) return NO(e);
      usuario = String(usuario || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{2,}$/.test(usuario) || !/^\d{4}$/.test(String(pin)) || !['admin', 'encargada', 'vendedora'].includes(r)) return NO('datos');
      if ([...col.usuarios.values()].some(x => x.usuario === usuario)) return NO('existe');
      const uid = 'u-' + usuario;
      col.usuarios.set(uid, { uid, usuario, nombre: nombre || usuario, rol: r, activo: true });
      pins.set(uid, String(pin));
      avisar('usuarios'); return SI({ uid });
    },
    async sistemaIniciado() { return col.usuarios.size > 0; },
    async crearAdministrador({ nombre, usuario, pin }) {
      if (col.usuarios.size) return NO('permiso');
      const uid = 'u-' + String(usuario).toLowerCase();
      col.usuarios.set(uid, { uid, usuario: String(usuario).toLowerCase(), nombre, rol: 'admin', activo: true });
      pins.set(uid, String(pin));
      return SI();
    },
    async cambiarPin(uid, pinNuevo, pinActual) {
      if (!sesion) return NO('sesion');
      if (!/^\d{4}$/.test(String(pinNuevo))) return NO('datos');
      if (sesion.uid === uid) { if (pins.get(uid) !== String(pinActual)) return NO('pin'); }
      else if (rol() !== 'admin') return NO('permiso');
      pins.set(uid, String(pinNuevo)); return SI({ uid });
    },
    async marcarComision(uid, gana) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const u = col.usuarios.get(uid); if (!u) return NO('no-existe');
      u.ganaComision = !!gana; avisar('usuarios'); return SI();
    },
    // Eliminar: el perfil queda (las ventas viejas lo nombran) pero se apaga, se marca eliminado y su usuario
    // queda libre para crear otro con el mismo nombre. No se puede eliminar a uno mismo.
    async eliminarUsuario(uid) {
      const e = exigir('ajustes'); if (e) return NO(e);
      if (sesion?.uid === uid) return NO('propio');
      const u = col.usuarios.get(uid); if (!u) return NO('no-existe');
      u.activo = false; u.eliminado = true; u.usuario = `${u.usuario}~${uid}`; avisar('usuarios'); return SI();
    },
    async activarUsuario(uid, activo) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const u = col.usuarios.get(uid); if (!u) return NO('no-existe');
      u.activo = !!activo; avisar('usuarios');
      if (!activo && sesion?.uid === uid) await api.salir();
      return SI();
    },

    // ---- lectura ----
    escuchar(nombre, cb, filtro) {
      const o = { nombre, cb, filtro };
      oyentes.push(o);
      cb(leer(nombre, filtro));
      return () => { const i = oyentes.indexOf(o); if (i >= 0) oyentes.splice(i, 1); };
    },
    async obtener(nombre, id) { const d = col[nombre].get(id); return d && visible(nombre, d) ? copia(d) : null; },

    // ---- ventas ----
    async guardarVenta(venta) {
      const e = exigir('vender'); if (e) return NO(e);
      const previa = col.ventas.get(venta.id);
      if (previa) return SI({ offline: !!previa.offline });
      const caja = cajaAbierta(sesion.uid); if (!caja) return NO('sin-caja');
      if (!offline) { const f = faltantes(venta.lineas); if (f.length) return { ok: false, faltantes: f }; }
      for (const [sku, n] of Object.entries(porSku(venta.lineas))) mover(sku, -n, 'venta', venta.id);
      col.ventas.set(venta.id, { ...copia(venta), uid: sesion.uid, usuario: sesion.usuario, cajaId: caja.id, numero: offline ? null : numerar(), offline, estado: 'ok', creada: ahora() });
      escribio(); avisar('ventas', 'productos', 'movimientos');
      return SI({ offline });
    },
    async anularVenta(id, motivo) {
      const e = exigir('anularVenta'); if (e) return NO(e);
      const v = col.ventas.get(id); if (!v) return NO('no-existe');
      if (v.estado === 'anulada') return NO('ya-anulada');
      if (!String(motivo || '').trim()) return NO('datos');
      const original = col.cajas.get(v.cajaId);
      const caja = original?.estado === 'abierta' ? original : cajaAbierta(sesion.uid);
      if (!caja) return NO('sin-caja');
      const neto = {};
      for (const p of v.pagos || []) neto[p.forma] = (neto[p.forma] || 0) + p.monto;
      if (v.vuelto?.monto) neto[v.vuelto.forma] = (neto[v.vuelto.forma] || 0) - v.vuelto.monto;
      for (const [forma, monto] of Object.entries(neto)) {
        const m = Math.round(monto * 100) / 100;
        if (m) caja.movimientos.push({ tipo: m > 0 ? 'salida' : 'entrada', forma, monto: Math.abs(m), motivo: `anulación ${v.numero || ''}`.trim(), usuario: sesion.usuario, fecha: ahora() });
      }
      for (const [sku, n] of Object.entries(porSku(v.lineas))) mover(sku, n, 'anulación', id, motivo);
      v.estado = 'anulada';
      v.anulacion = { por: sesion.usuario, motivo, fecha: ahora() };
      escribio(); avisar('ventas', 'productos', 'cajas', 'movimientos');
      return SI();
    },

    // ---- apartados ----
    async guardarApartado(ap) {
      const e = exigir('vender'); if (e) return NO(e);
      if (col.apartados.has(ap.id)) return SI({ offline });
      const caja = cajaAbierta(sesion.uid); if (!caja) return NO('sin-caja');
      if (!offline) { const f = faltantes(ap.lineas); if (f.length) return { ok: false, faltantes: f }; }
      for (const [sku, n] of Object.entries(porSku(ap.lineas))) mover(sku, -n, 'apartado', ap.id);
      const abonos = (ap.abonos || []).map(a => ({ ...a, cajaId: caja.id, usuario: sesion.usuario, fecha: ahora() }));
      const abonado = abonos.reduce((s, a) => s + (a.equivalenteCop || 0), 0);
      col.apartados.set(ap.id, { ...copia(ap), abonos, saldo: Math.max(0, ap.total - abonado), uid: sesion.uid, usuario: sesion.usuario, estado: 'pendiente', offline, creada: ahora() });
      escribio(); avisar('apartados', 'productos', 'movimientos');
      return SI({ offline });
    },
    async abonarApartado(id, pago) {
      const e = exigir('vender'); if (e) return NO(e);
      const ap = col.apartados.get(id); if (!ap) return NO('no-existe');
      if (ap.estado !== 'pendiente') return NO('estado');
      const caja = cajaAbierta(sesion.uid); if (!caja) return NO('sin-caja');
      if (pago.id && ap.abonos.some(x => x.id === pago.id)) return SI();
      if ((pago.equivalenteCop || 0) > ap.saldo + 50) return NO('excede');
      ap.abonos.push({ ...pago, cajaId: caja.id, usuario: sesion.usuario, fecha: ahora() });
      ap.saldo = Math.max(0, ap.total - ap.abonos.reduce((s, a) => s + (a.equivalenteCop || 0), 0));
      escribio(); avisar('apartados');
      return SI();
    },
    async completarApartado(id, venta) {
      const e = exigir('vender'); if (e) return NO(e);
      const ap = col.apartados.get(id); if (!ap) return NO('no-existe');
      if (ap.estado === 'completado' && ap.ventaId === venta.id) return SI({ offline });
      if (ap.estado !== 'pendiente') return NO('estado');
      const caja = cajaAbierta(sesion.uid); if (!caja) return NO('sin-caja');
      col.ventas.set(venta.id, { ...copia(venta), desdeApartado: id, uid: sesion.uid, usuario: sesion.usuario, cajaId: caja.id, numero: offline ? null : numerar(), offline, estado: 'ok', creada: ahora() });
      ap.estado = 'completado'; ap.ventaId = venta.id; ap.saldo = 0;
      escribio(); avisar('apartados', 'ventas');
      return SI({ offline });
    },
    async cancelarApartado(id, motivo) {
      const e = exigir('cancelarApartado'); if (e) return NO(e);
      const ap = col.apartados.get(id); if (!ap) return NO('no-existe');
      if (ap.estado !== 'pendiente') return NO('estado');
      for (const [sku, n] of Object.entries(porSku(ap.lineas))) mover(sku, n, 'cancelación', id, motivo);
      ap.estado = 'cancelado'; ap.cancelacion = { por: sesion.usuario, motivo, fecha: ahora() };
      escribio(); avisar('apartados', 'productos', 'movimientos');
      return SI();
    },

    // ---- caja ----
    async abrirCaja(fondo, { tipo = 'tienda' } = {}) {
      const e = exigir(tipo === 'personal' ? 'cajaPersonal' : 'abrirCaja'); if (e) return NO(e);
      if (cajaAbierta(sesion.uid)) return NO('ya-abierta');
      const id = nuevoId();
      col.cajas.set(id, { id, uid: sesion.uid, usuario: sesion.usuario, tipo, abierta: ahora(), fondo: { COP: 0, USD: 0, BS: 0, ...(tipo === 'personal' ? {} : fondo) }, movimientos: [], estado: 'abierta' });
      escribio(); avisar('cajas');
      return SI({ id });
    },
    async movimientoCaja(cajaId, mov) {
      if (!sesion) return NO('sesion');
      const c = col.cajas.get(cajaId); if (!c) return NO('no-existe');
      if (c.uid !== sesion.uid) return NO('permiso');
      if (c.estado !== 'abierta') return NO('cerrada');
      if (!(mov.monto > 0) || !['entrada', 'salida'].includes(mov.tipo)) return NO('datos');
      c.movimientos.push({ ...mov, usuario: sesion.usuario, fecha: ahora() });
      escribio(); avisar('cajas');
      return SI();
    },
    async cerrarCaja(cajaId, cierre) {
      if (!sesion) return NO('sesion');
      const c = col.cajas.get(cajaId); if (!c) return NO('no-existe');
      if (c.uid !== sesion.uid) return NO('permiso');
      if (c.estado !== 'abierta') return NO('cerrada');
      c.estado = 'cerrada'; c.cierre = { ...copia(cierre), fecha: ahora() };
      escribio(); avisar('cajas');
      return SI();
    },
    // Cierra las cajas abiertas en un día anterior: a las 11:59 pm de su día. Las de tienda quedan por arquear.
    async cerrarCajasVencidas(hoy) {
      if (!sesion) return NO('sesion');
      const todas = puede(rol(), 'verReportesTodos');
      let cerradas = 0;
      for (const c of col.cajas.values()) {
        if (c.estado !== 'abierta' || (!todas && c.usuario !== sesion.usuario)) continue;
        const dia = diaLocal(c.abierta);
        if (dia >= hoy) continue;
        c.estado = 'cerrada';
        c.cierre = { automatico: true, fecha: finDia(dia), porArquear: c.tipo !== 'personal', por: sesion.usuario };
        cerradas++;
      }
      if (cerradas) { escribio(); avisar('cajas'); }
      return SI({ cerradas });
    },
    // Arqueo de una caja que se cerró sola: lo contado, las diferencias y quién lo hizo.
    async arquearCaja(cajaId, arqueo) {
      if (!sesion) return NO('sesion');
      const c = col.cajas.get(cajaId); if (!c) return NO('no-existe');
      if (c.usuario !== sesion.usuario && !puede(rol(), 'verReportesTodos')) return NO('permiso');
      if (c.estado !== 'cerrada' || !c.cierre?.porArquear) return NO('arqueada');
      c.cierre = { ...c.cierre, ...copia(arqueo), porArquear: false, arqueo: { por: sesion.usuario, fecha: ahora() } };
      escribio(); avisar('cajas');
      return SI();
    },
    async reabrirCaja(cajaId) {
      const e = exigir('reabrirCaja'); if (e) return NO(e);
      const c = col.cajas.get(cajaId); if (!c) return NO('no-existe');
      if (c.estado === 'abierta') return SI();
      if (cajaAbierta(c.uid)) return NO('ya-abierta');
      c.estado = 'abierta';
      (c.reaperturas ||= []).push({ por: sesion.usuario, fecha: ahora() });
      escribio(); avisar('cajas');
      return SI();
    },

    // ---- inventario ----
    async ajustarExistencia(sku, cantidad, motivo, nota) {
      const e = exigir('ajustarInventario'); if (e) return NO(e);
      if (!col.productos.has(sku)) return NO('no-existe');
      if (!Number.isInteger(cantidad) || !cantidad || !String(motivo || '').trim()) return NO('datos');
      mover(sku, cantidad, 'ajuste', null, `${motivo}${nota ? ': ' + nota : ''}`);
      escribio(); avisar('productos', 'movimientos');
      return SI();
    },
    // { existencias: true } aplica también la existencia del archivo a los que ya existen (con su movimiento).
    async aplicarImportacion(plan, { existencias = false } = {}) {
      const e = exigir('importar'); if (e) return NO(e);
      const fecha = ahora();
      const ponerCosto = (sku, costo) => {
        if (costo == null) return;
        const c = col.costos.get(sku);
        if (!c) col.costos.set(sku, { sku, costo, historial: [{ costo, desde: fecha }] });
        else if (c.costo !== costo) { c.costo = costo; c.historial.push({ costo, desde: fecha }); }
      };
      for (const p of plan.nuevos || []) {
        const { costo, existencia, ...resto } = copia(p);
        col.productos.set(p.sku, { ...resto, existencia: 0, activo: true });
        if (existencia) mover(p.sku, existencia, 'importación', null);
        ponerCosto(p.sku, costo);
      }
      for (const { sku, campos } of plan.cambios || []) {
        const { costo, existencia, ...resto } = copia(campos);
        const p = col.productos.get(sku); if (!p) continue;
        Object.assign(p, resto);
        ponerCosto(sku, costo);
      }
      if (existencias) for (const { sku, despues } of plan.existencias || []) {
        const p = col.productos.get(sku); if (!p) continue;
        const delta = despues - (p.existencia ?? 0);
        if (delta) mover(sku, delta, 'sincronización', null, 'Existencia de la Carga Masiva');
      }
      escribio(); avisar('productos', 'costos', 'movimientos');
      return SI();
    },
    async guardarOferta(grupo, oferta) {
      const e = exigir('ofertas'); if (e) return NO(e);
      const pct = Math.min(Math.max(Number(oferta?.pct) || 0, 0), 100);
      for (const p of col.productos.values()) if (p.grupo === grupo) p.oferta = { pct, activa: !!oferta?.activa && pct > 0 };
      escribio(); avisar('productos');
      return SI();
    },
    async guardarImagen(codigo, blob) {
      const e = exigir('fotosMasivas'); if (e) return NO(e);
      codigo = String(codigo || '').trim().toLowerCase();
      if (!codigo) return NO('datos');
      const ruta = (blob && globalThis.URL?.createObjectURL) ? URL.createObjectURL(blob) : `fotos/${codigo}.webp`;
      const doc = col.ajustes.get('imagenes') || { id: 'imagenes', fotos: {} };
      doc.fotos = { ...(doc.fotos || {}), [codigo]: ruta };
      col.ajustes.set('imagenes', doc);
      escribio(); avisar('ajustes');
      return SI({ ruta });
    },
    async guardarFoto(sku, blob) {
      const e = exigir('fotosMasivas'); if (e) return NO(e);
      const ruta = (blob && globalThis.URL?.createObjectURL) ? URL.createObjectURL(blob) : `fotos/${claveFoto(sku)}.webp`;
      const p = col.productos.get(sku); if (!p) return NO('no-existe');
      p.foto = ruta;
      avisar('productos');
      return SI({ ruta });
    },

    // ---- otros ----
    async guardarAjustes(doc, datos) {
      const e = exigir(doc === 'tasas' ? 'cambiarTasas' : 'ajustes'); if (e) return NO(e);
      col.ajustes.set(doc, { ...(col.ajustes.get(doc) || { id: doc }), ...copia(datos) });
      escribio(); avisar('ajustes');
      return SI();
    },
    async guardarCliente({ telefono, nombre }) {
      if (!sesion) return NO('sesion');
      const tel = telefonoInternacional(telefono);
      if (!tel || !String(nombre || '').trim()) return NO('datos');
      col.clientes.set(tel, { telefono: tel, nombre: String(nombre).trim() });
      avisar('clientes');
      return SI({ telefono: tel });
    },
    async solicitarAutorizacion(a) {
      if (!sesion) return NO('sesion');
      if (offline) return NO('red');
      const id = nuevoId();
      col.autorizaciones.set(id, { ...copia(a), id, uid: sesion.uid, usuario: sesion.usuario, solicita: sesion.usuario, estado: 'pendiente', fecha: ahora() });
      avisar('autorizaciones');
      return SI({ id });
    },
    async responderAutorizacion(id, aprobada) {
      const e = exigir('aprobarDescuento'); if (e) return NO(e);
      const a = col.autorizaciones.get(id); if (!a) return NO('no-existe');
      if (a.estado !== 'pendiente') return NO('estado');
      a.estado = aprobada ? 'aprobada' : 'rechazada'; a.aprueba = sesion.usuario; a.respondida = ahora();
      avisar('autorizaciones');
      return SI();
    },
    async pagarComisiones(reg) {
      const e = exigir('pagarComisiones'); if (e) return NO(e);
      const id = nuevoId();
      col.comisiones.set(id, { ...copia(reg), id, por: sesion.usuario, fecha: ahora() });
      escribio(); avisar('comisiones');
      return SI({ id });
    },
    async cargarEjemplos(lote) {
      const e = exigir('ajustes'); if (e) return NO(e);
      const CLAVE = { productos: 'sku', costos: 'sku', clientes: 'telefono', ventas: 'id', apartados: 'id' };
      for (const [n, k] of Object.entries(CLAVE)) for (const d of lote[n] || []) col[n].set(d[k], { ...copia(d), demo: true });
      escribio(); avisar(...Object.keys(CLAVE));
      return SI();
    },
    async quitarEjemplos() {
      const e = exigir('ajustes'); if (e) return NO(e);
      let n = 0;
      for (const nombre of ['productos', 'costos', 'clientes', 'ventas', 'apartados']) for (const [id, d] of col[nombre]) if (d.demo) { col[nombre].delete(id); n++; }
      for (const id of [...col.costosVenta.keys()]) if (String(id).startsWith('demo-')) col.costosVenta.delete(id);
      escribio(); avisar('productos', 'costos', 'clientes', 'ventas', 'apartados', 'costosVenta');
      return SI({ quitados: n });
    },
    async congelarCostoVenta(ventaId, costo) {
      const e = exigir('verCostos'); if (e) return NO(e);
      if (!col.costosVenta.has(ventaId)) { col.costosVenta.set(ventaId, { id: ventaId, ...copia(costo) }); avisar('costosVenta'); }
      return SI();
    },
    estadoSync(cb) { oyentesSync.add(cb); cb({ enLinea: !offline, pendientes, error: null }); return () => oyentesSync.delete(cb); },
    simularSinConexion(valor) {
      offline = !!valor;
      if (!offline) {
        pendientes = 0;
        const sinNumero = [...col.ventas.values()].filter(v => !v.numero).sort((a, b) => a.creada.localeCompare(b.creada));
        for (const v of sinNumero) v.numero = numerar();
        avisar('ventas');
      }
      avisarSync();
    },
  };
  return api;
}
