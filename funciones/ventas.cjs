const { createHash } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');

const CONFIRMADA = 'confirmada_servidor';
const RECHAZADA = 'rechazada_conflicto';
const ROLES = ['vendedora', 'encargada', 'admin'];
const CAMPOS = ['id', 'cajaId', 'fecha', 'creada', 'offline', 'cliente', 'lineas', 'subtotal', 'descuento', 'total', 'pagos', 'vuelto', 'tasas'];
// Presupuesto conservador de este protocolo: dos escrituras por SKU y tres compartidas.
const MAX_SKUS = Math.floor((500 - 3) / 2);
const clave = (...partes) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');
const idValido = v => typeof v === 'string' && v.length > 0 && Buffer.byteLength(v) <= 1500
  && !v.includes('/') && !['.', '..'].includes(v) && !/^__.*__$/.test(v);
const fechaValida = v => typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
const montoValido = v => Number.isFinite(v) && v >= 0;

function cantidadesDe(v, id) {
  if (v?.id !== id || !idValido(v.cajaId) || !fechaValida(v.fecha) || !fechaValida(v.creada)
    || typeof v.offline !== 'boolean' || !montoValido(v.total)
    || !Array.isArray(v.pagos) || !v.pagos.every(p => p && typeof p.forma === 'string' && montoValido(p.monto))
    || !Array.isArray(v.lineas) || !v.lineas.length || !Object.keys(v).every(k => CAMPOS.includes(k))) return null;
  const cantidades = new Map();
  for (const linea of v.lineas) {
    const { sku, cantidad } = linea || {};
    if (!idValido(sku) || !Number.isSafeInteger(cantidad) || cantidad <= 0) return null;
    const total = (cantidades.get(sku) || 0) + cantidad;
    if (!Number.isSafeInteger(total)) return null;
    cantidades.set(sku, total);
  }
  return cantidades;
}

async function procesarVenta(db, uid, id, leerTasa) {
  const { verificarFinanzas } = await import('./finanzas.mjs');
  const operador = db.collection('usuarios').doc(uid);
  const solicitud = operador.collection('solicitudesVenta').doc(id);
  const marca = operador.collection('operacionesCobro').doc('venta:' + id);
  const venta = db.collection('ventas').doc(id);
  return db.runTransaction(async tx => {
    const [pedidoSnap, perfilSnap, marcaSnap, guardadaSnap] = await tx.getAll(solicitud, operador, marca, venta);
    if (!pedidoSnap.exists) return null;
    if (marcaSnap.exists) return marcaSnap.data().estadoSync;
    const { venta: v, orden, dispositivo, version } = pedidoSnap.data();
    const perfil = perfilSnap.data(), usuario = perfil?.usuario ?? null;
    const cabeComprobante = Buffer.byteLength(JSON.stringify(v)) <= 512 * 1024;
    const fecha = fechaValida(v?.fecha) ? v.fecha : pedidoSnap.createTime.toDate().toISOString();
    const datosMarca = { que: 'venta', refId: id, apartadoId: null, orden, dispositivo, fecha };
    const anotar = (tipo, col, refId, extra) => {
      const evento = clave(uid, id, tipo);
      tx.create(db.collection('eventos').doc(evento), { id: evento, tipo, uid, usuario,
        rol: perfil?.rol ?? null, dispositivo, version, en: FieldValue.serverTimestamp(),
        fecha, ref: { col, id: refId }, ...extra });
    };
    const rechazar = (motivo, faltantes = []) => {
      const conflictoId = 'venta-' + clave(uid, id);
      tx.create(db.collection('conflictos').doc(conflictoId), { id: conflictoId, tipo: 'rechazada', estado: 'pendiente',
        que: 'venta', refId: id, uid, usuario, fecha, motivo, faltantes, orden, dispositivo,
        resumen: { total: v?.total ?? null, prendas: (v?.lineas || []).length }, datos: cabeComprobante ? v : null, detectado: fecha });
      anotar('conflicto.registrado', 'conflictos', conflictoId, { resumen: 'Venta rechazada', motivo });
      tx.create(marca, { ...datosMarca, estadoSync: RECHAZADA, conflictoId });
      return RECHAZADA;
    };
    if (guardadaSnap.exists) {
      if (guardadaSnap.data().uid !== uid) return rechazar('id-ocupado');
      tx.create(marca, { ...datosMarca, estadoSync: CONFIRMADA });
      return CONFIRMADA;
    }
    if (perfil?.activo !== true || !usuario || !ROLES.includes(perfil.rol)) return rechazar('perfil');
    // La solicitud queda disponible incluso si copiarla haría demasiado grande el conflicto.
    if (!cabeComprobante) return rechazar('tamano');
    const cantidades = cantidadesDe(v, id);
    if (!cantidades) return rechazar('datos');
    if (cantidades.size > MAX_SKUS) return rechazar('limite-sku');

    const caja = (await tx.get(db.collection('cajas').doc(v.cajaId))).data();
    // Una caja propia puede haberse cerrado mientras el comprobante esperaba sin red.
    if (caja?.usuario !== usuario || (caja.uid != null && caja.uid !== uid)) return rechazar('caja');
    const productos = await tx.getAll(...[...cantidades.keys()].map(sku => db.collection('productos').doc(sku)));
    const faltantes = productos.filter(p => {
      const stock = p.data()?.existencia;
      return !Number.isSafeInteger(stock) || stock < cantidades.get(p.id);
    }).map(p => p.id);
    if (faltantes.length) return rechazar('existencia', faltantes);

    const [general, tasas] = await tx.getAll(db.doc('ajustes/general'), db.doc('ajustes/tasas'));
    const ajustesTasas = tasas.data() || {};
    const conBs = v.pagos.some(p => p.moneda === 'BS') || (Array.isArray(v.vuelto?.partes)
      && v.vuelto.partes.some(p => p?.moneda === 'BS'));
    const tasaRemota = conBs && ajustesTasas.bsModo !== 'manual' ? await leerTasa() : null;
    const idAutorizacion = v.descuento?.autorizacionId;
    const autorizacion = idValido(idAutorizacion) ? (await tx.get(db.doc('autorizaciones/' + idAutorizacion))).data() : null;
    const resultado = verificarFinanzas(v, Object.fromEntries(productos.map(p => [p.id, p.data()])),
      general.data() || {}, ajustesTasas, tasaRemota, { ...perfil, uid }, autorizacion);
    if (resultado) return rechazar('finanzas-' + resultado);

    for (const p of productos) {
      const sku = p.id, cantidad = cantidades.get(sku), mov = clave(id, sku);
      tx.update(p.ref, { existencia: p.data().existencia - cantidad, ultimoMov: mov });
      tx.create(db.collection('movimientos').doc(mov), { id: mov, sku, cantidad: -cantidad, motivo: 'venta',
        ref: id, nota: '', usuario, fecha });
    }
    tx.create(venta, { ...v, uid, usuario, numero: null, estado: 'ok' });
    tx.create(marca, { ...datosMarca, estadoSync: CONFIRMADA });
    anotar('venta.creada', 'ventas', id, { resumen: `${v.total.toLocaleString('es-CO')} COP · ${v.lineas.reduce((n, l) => n + l.cantidad, 0)} prendas` });
    return CONFIRMADA;
  });
}

// Como en los clientes anteriores, la numeración es separada del cobro y reintentable.
async function numerarVenta(db, uid, id) {
  const venta = db.collection('ventas').doc(id);
  const contador = db.collection('contadores').doc('ventas');
  await db.runTransaction(async tx => {
    const actual = (await tx.get(venta)).data();
    if (!actual || actual.uid !== uid || actual.numero) return;
    const anterior = (await tx.get(contador)).data();
    const n = (anterior?.n || 0) + 1;
    const numero = 'V-' + String(n).padStart(4, '0');
    tx.set(contador, { n, numero, ventaId: id });
    tx.update(venta, { numero });
  });
}

async function atenderVenta(db, { uid, id }) {
  let tasa;
  const leerTasa = () => tasa ||= fetch('https://kdnaskrlos.github.io/Calculadora-de-Tasas/tasa.json', {
    signal: AbortSignal.timeout(4000), redirect: 'error',
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  const estado = await procesarVenta(db, uid, id, leerTasa);
  if (estado === CONFIRMADA) await numerarVenta(db, uid, id);
  return estado;
}

module.exports = { atenderVenta };
