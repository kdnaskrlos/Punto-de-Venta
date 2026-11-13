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

// Ventas repartidas para la gráfica: por hora si el rango es un solo día, por día si son varios (hora de Venezuela, UTC−4).
const horaLocal = iso => (new Date(iso).getUTCHours() + 20) % 24;
const diaLocalDe = iso => new Date(new Date(iso).getTime() - 4 * 3600e3).toISOString().slice(0, 10);
const etiquetaHora = h => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`);

export function ventasPorPeriodo(ventas, desde, hasta) {
  const vs = validas(ventas);
  if (desde === hasta) {
    const por = {};
    for (const v of vs) { const k = horaLocal(v.fecha); por[k] = (por[k] || 0) + v.total; }
    const horas = Object.keys(por).map(Number);
    const ini = Math.min(8, ...horas), fin = Math.max(19, ...horas);
    const barras = [];
    for (let k = ini; k <= fin; k++) barras.push({ clave: k, etiqueta: etiquetaHora(k), total: por[k] || 0 });
    return { modo: 'hora', barras };
  }
  const por = {};
  for (const v of vs) { const k = diaLocalDe(v.fecha); por[k] = (por[k] || 0) + v.total; }
  const barras = [];
  for (let d = new Date(`${desde}T12:00:00Z`); d.toISOString().slice(0, 10) <= hasta; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    barras.push({ clave: k, etiqueta: String(Number(k.slice(8))), total: por[k] || 0 });
  }
  return { modo: 'dia', barras };
}

// Cobros por forma de pago en su equivalente en pesos, para comparar formas de distinta moneda.
export function cobrosEnPesos(ventas, formas = FORMAS_PAGO_DEFECTO) {
  const r = {};
  const sumar = (f, m) => { if (f) r[f] = Math.round((r[f] || 0) + m); };
  for (const v of validas(ventas)) {
    for (const p of v.pagos || []) sumar(p.forma, p.equivalenteCop ?? (p.moneda === 'COP' || !p.moneda ? p.monto : 0));
    if (v.vuelto && v.vuelto.monto) sumar(v.vuelto.forma || formaEfectivo(formas, v.vuelto.moneda), -(v.vuelto.moneda === 'COP' ? v.vuelto.monto : v.vuelto.equivalenteCop || 0));
  }
  return r;
}
