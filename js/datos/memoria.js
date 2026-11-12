// Almacén en memoria: modo demostración y pruebas. Cumple el mismo contrato que firebase.js
// y aplica los mismos permisos, para que las pantallas se comporten igual en ambos.
import { puede } from '../nucleo/permisos.js';
import { claveFoto } from '../nucleo/fotos.js';
import { telefonoInternacional } from '../nucleo/recibo.js';
import { NOMBRES, nuevoId } from './contrato.js';

const ahora = () => new Date().toISOString();
const copia = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
const NO = error => ({ ok: false, error });
const SI = (extra = {}) => ({ ok: true, ...extra });

export function crearMemoria(datos) {
  const col = Object.fromEntries(NOMBRES.map(n => [n, new Map()]));
  const pins = new Map();
  let sesion = null, offline = false, pendientes = 0, contadorVentas = 0;
  const oyentes = [], oyentesSesion = new Set(), oyentesSync = new Set();

  for (const u of datos.usuarios || []) {
    const uid = 'u-' + u.usuario;
    col.usuarios.set(uid, { uid, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: true });
    pins.set(uid, u.pin);
  }
  for (const p of datos.productos || []) col.productos.set(p.sku, copia(p));
  for (const c of datos.costos || []) col.costos.set(c.sku, copia(c));
  for (const c of datos.clientes || []) col.clientes.set(c.telefono, copia(c));
  for (const [k, v] of Object.entries(datos.ajustes || {})) col.ajustes.set(k, copia({ id: k, ...v }));

  // ---- utilidades internas ----
  const rol = () => sesion?.rol;
  const visible = (nombre, doc) => {
    if (!sesion) return false;
    const r = rol();
    if (['costos', 'costosVenta', 'comisiones', 'movimientos'].includes(nombre)) return puede(r, 'verCostos');
    if (['ventas', 'cajas'].includes(nombre)) return puede(r, 'verReportesTodos') || doc.uid === sesion.uid;
    if (nombre === 'autorizaciones') return r === 'admin' || doc.uid === sesion.uid;
    return true;
  };
  const leer = (nombre, filtro) => [...col[nombre].values()].filter(d => visible(nombre, d) && (!filtro || filtro(d))).map(copia);
  const avisar = (...nombres) => { for (const o of [...oyentes]) if (nombres.includes(o.nombre)) o.cb(leer(o.nombre, o.filtro)); };
  const avisarSync = () => { for (const cb of oyentesSync) cb({ enLinea: !offline, pendientes, error: null }); };
  const escribio = () => { if (offline) { pendientes++; avisarSync(); } };
  const cajaAbierta = uid => [...col.cajas.values()].find(c => c.uid === uid && c.estado === 'abierta');
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
    async cambiarPin(uid, pin) {
      if (!sesion) return NO('sesion');
      if (sesion.uid !== uid && rol() !== 'admin') return NO('permiso');
      if (!/^\d{4}$/.test(String(pin))) return NO('datos');
      pins.set(uid, String(pin)); return SI();
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
    async abrirCaja(fondo) {
      const e = exigir('abrirCaja'); if (e) return NO(e);
      if (cajaAbierta(sesion.uid)) return NO('ya-abierta');
      const id = nuevoId();
      col.cajas.set(id, { id, uid: sesion.uid, usuario: sesion.usuario, abierta: ahora(), fondo: { COP: 0, USD: 0, BS: 0, ...fondo }, movimientos: [], estado: 'abierta' });
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
    async aplicarImportacion(plan) {
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
    async guardarFoto(grupo, blob) {
      const e = exigir('fotosMasivas'); if (e) return NO(e);
      const ruta = (blob && globalThis.URL?.createObjectURL) ? URL.createObjectURL(blob) : `fotos/${claveFoto(grupo)}.webp`;
      for (const p of col.productos.values()) if (p.grupo === grupo) p.foto = ruta;
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
      col.autorizaciones.set(id, { ...copia(a), id, uid: sesion.uid, solicita: sesion.usuario, estado: 'pendiente', fecha: ahora() });
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
