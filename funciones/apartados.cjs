const { createHash } = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { cantidadesDe, idValido, fechaValida, numerarVenta, consultaTasa, MAX_SKUS } = require('./ventas.cjs');

const CONFIRMADA = 'confirmada_servidor';
const RECHAZADA = 'rechazada_conflicto';
const ROLES = ['vendedora', 'encargada', 'admin'];
const TIPOS = ['apartado', 'abono', 'completar'];
const hash = (...partes) => createHash('sha256').update(JSON.stringify(partes)).digest('hex');
const saldoValido = n => Number.isSafeInteger(n) && n >= 0;

function datosBase(d) {
  return { id: d.id, fecha: d.fecha, creada: d.creada, offline: d.offline, cajaId: d.cajaId };
}

function pagoGuardado(p) {
  const { forma, nombre, moneda, monto, equivalenteCop } = p;
  return { forma, nombre, moneda, monto, equivalenteCop };
}

function tasaGuardada({ copPorUsd = null, bsPorUsd = null, fuenteBs = null } = {}) {
  const tasa = n => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
  return { copPorUsd: tasa(copPorUsd), bsPorUsd: tasa(bsPorUsd),
    fuenteBs: ['manual', 'bcv', 'binance'].includes(fuenteBs) ? fuenteBs : null };
}

async function procesarApartado(db, uid, solicitudId, leerTasa) {
  const { verificarLineas, verificarPagos } = await import('./finanzas.mjs');
  const operador = db.collection('usuarios').doc(uid);
  return db.runTransaction(async tx => {
    const [solicitud, perfilSnap, anterior] = await tx.getAll(operador.collection('solicitudesVenta').doc(solicitudId),
      operador, operador.collection('operacionesCobro').doc(solicitudId));
    const pedido = solicitud.data();
    const { que, refId, apartadoId, datos: d } = pedido?.cobro || {};
    if (!TIPOS.includes(que) || !idValido(refId) || !idValido(apartadoId) || solicitudId !== que + ':' + refId) return null;
    const marca = anterior.ref;
    if (anterior.exists) return anterior.data().estadoSync;
    const perfil = perfilSnap.data();
    const usuario = perfil?.usuario ?? null;
    const fecha = fechaValida(d?.fecha) ? d.fecha : solicitud.createTime.toDate().toISOString();
    const datosMarca = { que, refId, apartadoId, fecha, orden: pedido.orden, dispositivo: pedido.dispositivo };
    const anotar = (tipo, ref, resumen = '') => {
      const id = hash(uid, solicitudId, tipo);
      tx.create(db.collection('eventos').doc(id), { id, tipo, uid, usuario, rol: perfil?.rol ?? null,
        dispositivo: pedido.dispositivo, version: pedido.version, en: FieldValue.serverTimestamp(), fecha, ref, resumen });
    };
    const rechazar = motivo => {
      const conflictoId = que + '-' + hash(uid, solicitudId);
      tx.create(db.collection('conflictos').doc(conflictoId), { id: conflictoId, que, refId, apartadoId, uid,
        usuario, fecha, detectado: fecha, orden: pedido.orden, dispositivo: pedido.dispositivo, motivo,
        tipo: 'rechazada', estado: 'pendiente', datos: cabe ? d : null });
      anotar('conflicto.registrado', { col: 'conflictos', id: conflictoId }, 'Operación de apartado rechazada');
      tx.create(marca, { ...datosMarca, estadoSync: RECHAZADA, conflictoId });
      return RECHAZADA;
    };
    const confirmar = () => {
      tx.create(marca, { ...datosMarca, estadoSync: CONFIRMADA });
      return CONFIRMADA;
    };
    const cabe = !!d && Buffer.byteLength(JSON.stringify(d)) <= 512 * 1024;
    const alta = que === 'apartado';
    const completar = que === 'completar';

    if (perfil?.activo !== true || typeof usuario !== 'string' || !usuario || !ROLES.includes(perfil.rol)) return rechazar('perfil');
    if (!cabe || d.id !== refId || !idValido(d.cajaId) || !fechaValida(d.fecha) || !fechaValida(d.creada)
      || typeof d.offline !== 'boolean' || !Array.isArray(d.pagos) || !d.tasas || typeof d.tasas !== 'object' || (alta && apartadoId !== refId)) return rechazar('datos');

    const refs = [db.collection('apartados').doc(apartadoId), db.collection('cajas').doc(d.cajaId),
      db.doc('ajustes/general'), db.doc('ajustes/tasas')];
    if (completar) refs.push(db.collection('ventas').doc(refId));
    const [apartado, cajaSnap, generalSnap, tasasSnap, venta] = await tx.getAll(...refs);
    const ap = apartado.data();
    const caja = cajaSnap.data();

    // Las cajas propias pueden haber cerrado después de capturar el pago offline.
    if (caja?.usuario !== usuario || (caja.uid != null && caja.uid !== uid)) return rechazar('caja');
    if (alta && ap) return ap.uid === uid ? confirmar() : rechazar('id-ocupado');
    if (venta?.exists) return ap?.estado === 'completado' && ap.ventaId === refId &&
      venta.data().desdeApartado === apartadoId && venta.data().uid === uid ? confirmar() : rechazar('id-ocupado');
    const previos = ap?.abonos ?? [];
    if (!alta && (!ap || !saldoValido(ap.total) || !saldoValido(ap.saldo) || ap.saldo > ap.total ||
      !Array.isArray(previos))) return rechazar('saldo');
    if (!alta && ap.estado !== 'pendiente') return rechazar('estado');

    const general = generalSnap.data() || {};
    const ajustesTasas = tasasSnap.data() || {};
    const usaBs = d.pagos.some(p => p?.moneda === 'BS') || (Array.isArray(d.vuelto?.partes) &&
      d.vuelto.partes.some(p => p?.moneda === 'BS'));
    const tasaRemota = usaBs && ajustesTasas.bsModo !== 'manual' ? await leerTasa() : null;

    if (completar && (d.total !== ap.total || d.abonosPrevios !== ap.total - ap.saldo || !ap.lineas?.length)) {
      return rechazar('saldo-cambio');
    }
    const pagos = verificarPagos(d, alta ? d.total : ap.saldo, general, ajustesTasas, tasaRemota, !completar);
    if (typeof pagos === 'string' || (que === 'abono' && !pagos.pagadoCop)) return rechazar('finanzas-' + (typeof pagos === 'string' ? pagos : 'pagos'));
    const tasas = tasaGuardada(d.tasas);

    if (completar) {
      const { cliente, lineas, total, subtotal = total, descuento = null } = ap;
      tx.create(venta.ref, { ...datosBase(d), cliente: cliente ?? null, lineas, total, subtotal, descuento,
        pagos: d.pagos.map(pagoGuardado), vuelto: d.vuelto ?? null, tasas, abonosPrevios: d.abonosPrevios,
        desdeApartado: apartadoId, uid, usuario, estado: 'ok', numero: null });
      tx.update(apartado.ref, { estado: 'completado', saldo: 0, ventaId: refId });
      anotar('apartado.completado', { col: 'apartados', id: apartadoId, venta: refId }, total + ' COP');
      return confirmar();
    }

    const abonos = d.pagos.map((p, i) => ({ ...pagoGuardado(p), id: refId + '-' + i,
      operacionId: solicitudId, cajaId: d.cajaId, usuario, fecha, tasas }));
    if (!alta) {
      if (previos.some(p => abonos.some(a => a.id === p.id))) return rechazar('abono-ya-registrado');
      tx.update(apartado.ref, { abonos: [...previos, ...abonos], saldo: ap.saldo - pagos.pagadoCop, ultimoAbono: solicitudId });
      anotar('apartado.abono', { col: 'apartados', id: apartadoId }, pagos.pagadoCop + ' COP');
      return confirmar();
    }

    const cantidades = cantidadesDe({ ...datosBase(d), cliente: d.cliente, total: d.total,
      lineas: d.lineas, pagos: d.pagos }, refId);
    if (!cantidades || cantidades.size > MAX_SKUS) return rechazar('lineas');
    const productos = await tx.getAll(...[...cantidades.keys()].map(sku => db.collection('productos').doc(sku)));
    if (productos.some(p => !Number.isSafeInteger(p.data()?.existencia) || p.data().existencia < cantidades.get(p.id))) return rechazar('existencia');
    const autorizacionId = d.descuento?.autorizacionId;
    const autorizacionSnap = idValido(autorizacionId) ? await tx.get(db.doc('autorizaciones/' + autorizacionId)) : null;
    const autorizacion = autorizacionSnap?.data();
    if (autorizacion?.usadaEn || (idValido(autorizacion?.ventaId) &&
      (await tx.get(db.collection('ventas').doc(autorizacion.ventaId))).exists)) return rechazar('finanzas-autorizacion');
    // El identificador del apartado es distinto del que el carrito usó al pedir el descuento.
    const error = verificarLineas({ ...d, id: autorizacion?.ventaId ?? d.id },
      Object.fromEntries(productos.map(p => [p.id, p.data()])), general, { ...perfil, uid }, autorizacion);
    if (error) return rechazar('finanzas-' + error);

    if (autorizacion) tx.update(autorizacionSnap.ref, { usadaEn: { col: 'apartados', id: refId } });

    for (const p of productos) {
      const cantidad = cantidades.get(p.id), id = hash('apartado', refId, p.id);
      tx.update(p.ref, { existencia: p.data().existencia - cantidad, ultimoMov: id });
      tx.create(db.collection('movimientos').doc(id), { id, sku: p.id, cantidad: -cantidad,
        motivo: 'apartado', ref: refId, nota: '', usuario, fecha });
    }
    tx.create(apartado.ref, { ...datosBase(d), cliente: d.cliente ?? null, lineas: d.lineas, subtotal: d.subtotal,
      descuento: d.descuento ?? null, total: d.total, saldo: d.total - pagos.pagadoCop, abonos, tasas,
      estado: 'pendiente', procesado: true, uid, usuario });
    anotar('apartado.creado', { col: 'apartados', id: apartadoId }, d.total + ' COP');
    return confirmar();
  });
}

async function atenderApartado(db, { uid, id }, leerTasa = consultaTasa()) {
  const estado = await procesarApartado(db, uid, id, leerTasa);
  if (estado === CONFIRMADA && id.startsWith('completar:')) await numerarVenta(db, uid, id.slice('completar:'.length));
  return estado;
}

module.exports = { atenderApartado };
