// Comisión de la vendedora por prenda vendida, según el tramo (§14).
import { diaLocal } from './fechas.js';

export const COMISIONES_DEFECTO = [
  { tipo: 'Fijo', valor: 4000, reducida: 2000 },
  { tipo: 'Fijo', valor: 2000, reducida: 1000 },
  { tipo: 'Fijo', valor: 1000, reducida: 500 },
  { tipo: 'Fijo', valor: 1000, reducida: 500 },
  null,
];

const valida = c => c && Number.isFinite(Number(c.valor));
function deTramo(lista, tramo) {
  for (let i = tramo; i >= 0; i--) if (valida(lista?.[i])) return lista[i];
  return null;
}

export function comisionLinea({ tramo, cantidad, subtotal }, producto, defectos = COMISIONES_DEFECTO, reducida = false) {
  const c = deTramo(producto?.comisiones, tramo) || deTramo(defectos, tramo);
  if (!c) return 0;
  const valor = Number(reducida ? (c.reducida ?? c.valor) : c.valor) || 0;
  return Math.round(c.tipo === 'Porcentaje' ? subtotal * valor / 100 : valor * cantidad);
}

export function comisionesVenta(lineasCalculadas, productosPorSku, defectos, hayDescuento) {
  return lineasCalculadas.map(l => {
    const reducida = !!(hayDescuento || l.oferta);
    return { sku: l.sku, comision: comisionLinea(l, productosPorSku[l.sku], defectos, reducida), reducida };
  });
}

export function resumenComisiones(ventas, { vendedor, desde, hasta }, pagosComision = []) {
  // Una venta está pagada si su id está en algún pago registrado (los pagos antiguos sin lista usan su rango de días).
  const r = { ventas: 0, prendas: 0, normal: 0, reducida: 0, total: 0, pagado: 0, pendiente: 0, idsPendientes: [] };
  const pagadas = new Set(pagosComision.filter(p => p.vendedor === vendedor && Array.isArray(p.ventas)).flatMap(p => p.ventas));
  const pagosViejos = pagosComision.filter(p => p.vendedor === vendedor && !Array.isArray(p.ventas));
  for (const v of ventas) {
    if (v.estado === 'anulada' || v.usuario !== vendedor) continue;
    const d = diaLocal(v.fecha);
    if (d < desde || d > hasta) continue;
    r.ventas++;
    let suma = 0;
    for (const l of v.lineas || []) {
      r.prendas += l.cantidad;
      suma += l.comision || 0;
      if (l.reducida) r.reducida += l.comision || 0; else r.normal += l.comision || 0;
    }
    if (pagadas.has(v.id) || pagosViejos.some(p => d >= p.desde && d <= p.hasta)) r.pagado += suma;
    else if (suma) r.idsPendientes.push(v.id);
  }
  r.total = r.normal + r.reducida;
  r.pendiente = r.total - r.pagado;
  return r;
}

// Quién gana comisión: lo marca el administrador en Usuarios; si nunca se marcó, solo la vendedora.
export const ganaComision = u => (u?.ganaComision ?? u?.rol === 'vendedora') === true;
