// Reportes básicos (§15). Se calculan en el dispositivo a partir de las ventas del rango.
import { formaEfectivo, FORMAS_PAGO_DEFECTO } from './formas.js';

const validas = ventas => ventas.filter(v => v.estado !== 'anulada');

export function resumenDia(ventas, costosVenta, formas = FORMAS_PAGO_DEFECTO) {
  const vs = validas(ventas);
  const total = vs.reduce((s, v) => s + v.total, 0);
  const unidades = vs.reduce((s, v) => s + v.lineas.reduce((a, l) => a + l.cantidad, 0), 0);
  const porForma = {};
  const sumar = (f, m) => { if (f) porForma[f] = Math.round(((porForma[f] || 0) + m) * 100) / 100; };
  for (const v of vs) {
    for (const p of v.pagos || []) sumar(p.forma, p.monto);
    if (v.vuelto && v.vuelto.monto) sumar(v.vuelto.forma || formaEfectivo(formas, v.vuelto.moneda), -v.vuelto.monto);
  }
  let ganancia = null, gananciaParcial = false;
  if (costosVenta) {
    ganancia = 0;
    for (const v of vs) {
      const c = costosVenta[v.id];
      if (c) ganancia += v.total - c.total; else gananciaParcial = true;
    }
  }
  return { ventas: vs.length, total, ganancia, unidades, ticketPromedio: vs.length ? Math.round(total / vs.length) : 0, porForma, gananciaParcial };
}

export function masVendidos(ventas, productosPorSku, n = 10) {
  const g = {};
  for (const v of validas(ventas)) for (const l of v.lineas) {
    const p = productosPorSku[l.sku] || {};
    const k = p.grupo || l.sku;
    g[k] ||= { grupo: k, unidades: 0, tallas: {} };
    g[k].unidades += l.cantidad;
    const t = p.talla || '—';
    g[k].tallas[t] = (g[k].tallas[t] || 0) + l.cantidad;
  }
  return Object.values(g).sort((a, b) => b.unidades - a.unidades).slice(0, n);
}

export function inventarioBajo(productos) {
  return productos.filter(p => p.activo !== false && p.existencia <= (p.minimo || 0)).sort((a, b) => a.existencia - b.existencia);
}

export function valorInventario(productos, costosPorSku) {
  let aCosto = 0, aPrecio = 0;
  for (const p of productos) {
    if (p.activo === false) continue;
    const e = Math.max(p.existencia || 0, 0);
    aCosto += e * (costosPorSku[p.sku]?.costo || 0);
    aPrecio += e * (p.precios?.[0] || 0);
  }
  return { aCosto, aPrecio };
}
