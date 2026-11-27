// Comisión de la vendedora por prenda vendida, según el tramo (§14).
import { redondear } from './dinero.js';
import { precioDeTramo } from './tramos.js';
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

// La comisión del grupo (mix o producto «separado») no debe caer cuando
// alcanza un tramo nuevo. El piso es el máximo de los cierres de tramos
// anteriores para la MISMA combinación proporcional de prendas actual.
export function comisionesVenta(lineasCalculadas, productosPorSku, defectos, hayDescuento, limites = [1, 6, 12, 24, 48], redondeo = 100) {
  const reduccion = l => l.tramo === 0 && !!((hayDescuento && !l.separado) || l.oferta);
  const resultado = lineasCalculadas.map(l => {
    const reducida = reduccion(l); // Una promoción mayorista nunca reduce la comisión.
    return { sku: l.sku, comision: comisionLinea(l, productosPorSku[l.sku], defectos, reducida), reducida };
  });
  const grupos = new Map();
  lineasCalculadas.forEach((l, i) => {
    const p = productosPorSku[l.sku] || {};
    const clave = l.separado ? ['separado', p.tipo, p.marca, p.genero, p.modelo].join('|').toLowerCase() : '__mix';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(i);
  });
  for (const indices of grupos.values()) {
    const unidades = indices.reduce((n, i) => n + lineasCalculadas[i].cantidad, 0);
    const tramoActual = lineasCalculadas[indices[0]].tramo;
    if (!unidades || tramoActual < 1) continue;
    let piso = 0;
    for (let t = 0; t < tramoActual; t++) {
      const cierre = (limites[t + 1] || 0) - 1;
      if (cierre < 1) continue;
      let media = 0;
      for (const i of indices) {
        const l = lineasCalculadas[i], p = productosPorSku[l.sku] || {};
        const precioBase = precioDeTramo(p.precios, t) ?? l.precioUnit ?? l.subtotal / l.cantidad;
        const precio = l.oferta && p.oferta?.pct > 0
          ? redondear(precioBase * (1 - Math.min(p.oferta.pct, 100) / 100), redondeo) : precioBase;
        // El descuento manual no alcanza los artículos «separado».
        const reducida = t === 0 && !!((hayDescuento && !l.separado) || l.oferta);
        const unitaria = comisionLinea({ tramo: t, cantidad: 1, subtotal: precio }, p, defectos, reducida);
        media += unitaria * l.cantidad / unidades;
      }
      piso = Math.max(piso, Math.round(media * cierre));
    }
    const totalActual = indices.reduce((n, i) => n + resultado[i].comision, 0);
    const extra = Math.max(0, piso - totalActual);
    if (!extra) continue;
    let distribuido = 0;
    indices.forEach((i, pos) => {
      const adicional = pos === indices.length - 1 ? extra - distribuido
        : Math.floor(extra * lineasCalculadas[i].cantidad / unidades);
      resultado[i].comision += adicional;
      distribuido += adicional;
    });
  }
  return resultado;
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
