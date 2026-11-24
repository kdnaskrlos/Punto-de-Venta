// Prototipo de procesamiento para el emulador, invocado como servicio de confianza por la prueba.
const { createHash } = require('node:crypto');
const { doc, runTransaction, serverTimestamp } = require('firebase/firestore');

const CONFIRMADA = 'confirmada_servidor';
const RECHAZADA = 'rechazada_conflicto';
const ROLES = ['vendedora', 'encargada', 'admin'];
const CAMPOS = ['id', 'cajaId', 'fecha', 'cliente', 'lineas', 'subtotal', 'descuento', 'total', 'pagos', 'vuelto', 'tasas'];

const idValido = v => typeof v === 'string' && v.length > 0 && v.length <= 512 && !v.includes('/') && !['.', '..'].includes(v);
const clave = (...partes) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');

function cantidadesDe(v, id) {
  if (v.id !== id || !idValido(v.cajaId) || !Array.isArray(v.lineas) || !v.lineas.length || !Array.isArray(v.pagos)
    || !Number.isFinite(v.total) || v.total < 0 || !Object.keys(v).every(k => CAMPOS.includes(k))) return null;
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

async function procesarVenta(db, uid, id) {
  if (!/^127\.0\.0\.1:[1-9]\d{0,4}$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')
    || db.app.options.projectId !== 'demo-pos-bloque1') throw new Error('Solo el emulador local del POS');
  const ref = (...ruta) => doc(db, ...ruta);
  const solicitud = ref('usuarios', uid, 'solicitudesVentaQA', id);
  const marca = ref('usuarios', uid, 'operacionesCobro', 'venta:' + id);
  const venta = ref('ventas', id);

  return runTransaction(db, async tx => {
    const [pedidoSnap, perfilSnap, marcaSnap, guardadaSnap] = await Promise.all([
      tx.get(solicitud), tx.get(ref('usuarios', uid)), tx.get(marca), tx.get(venta),
    ]);
    if (marcaSnap.exists()) return { estadoSync: marcaSnap.data().estadoSync };
    if (!pedidoSnap.exists()) return null;
    const pedido = pedidoSnap.data(), v = pedido.venta;
    const perfil = perfilSnap.data(), usuario = perfil?.usuario ?? null;
    const datosMarca = { que: 'venta', refId: id, apartadoId: null, orden: pedido.orden,
      dispositivo: pedido.dispositivo, fecha: v.fecha };

    const rechazar = (motivo, faltantes = []) => {
      const conflictoId = 'qa-venta-' + clave(uid, id);
      tx.set(ref('conflictos', conflictoId), { id: conflictoId, tipo: 'rechazada', estado: 'pendiente',
        que: 'venta', refId: id, uid, usuario, motivo, faltantes, datos: v, detectado: serverTimestamp() });
      tx.set(marca, { ...datosMarca, estadoSync: RECHAZADA, conflictoId });
      return { estadoSync: RECHAZADA, motivo, faltantes };
    };
    // Una venta histórica con el mismo ID nunca vuelve a descontar inventario.
    if (guardadaSnap.exists()) {
      if (guardadaSnap.data().uid !== uid) return rechazar('id-ocupado');
      tx.set(marca, { ...datosMarca, estadoSync: CONFIRMADA });
      return { estadoSync: CONFIRMADA };
    }
    if (perfil?.activo !== true || !usuario || !ROLES.includes(perfil.rol)) return rechazar('perfil');

    const cantidades = cantidadesDe(v, id);
    if (!cantidades) return rechazar('datos');
    const caja = (await tx.get(ref('cajas', v.cajaId))).data();
    // La caja de origen pudo cerrar mientras el dispositivo estuvo sin conexión.
    if (caja?.usuario !== usuario || (caja.uid != null && caja.uid !== uid)) return rechazar('caja');

    const stock = await Promise.all([...cantidades].map(async ([sku, cantidad]) => {
      const producto = ref('productos', sku);
      return { sku, cantidad, producto, antes: (await tx.get(producto)).data()?.existencia };
    }));
    const faltantes = stock.filter(x => !Number.isSafeInteger(x.antes) || x.antes < x.cantidad).map(x => x.sku);
    if (faltantes.length) return rechazar('existencia', faltantes);

    for (const { sku, cantidad, producto, antes } of stock) {
      const mov = clave(id, sku);
      tx.update(producto, { existencia: antes - cantidad, ultimoMov: mov });
      tx.set(ref('movimientos', mov), { id: mov, sku, cantidad: -cantidad, motivo: 'venta', ref: id, usuario, fecha: v.fecha });
    }
    const evento = clave(id);
    tx.set(ref('eventos', evento), { id: evento, tipo: 'venta.creada', ref: { col: 'ventas', id },
      uid, usuario, rol: perfil.rol, dispositivo: pedido.dispositivo, en: serverTimestamp(), fecha: v.fecha });
    tx.set(venta, { ...v, uid, usuario, estado: 'ok', numero: null, creada: pedido.recibida.toDate().toISOString() });
    tx.set(marca, { ...datosMarca, estadoSync: CONFIRMADA });
    return { estadoSync: CONFIRMADA };
  });
}

module.exports = { procesarVenta };
