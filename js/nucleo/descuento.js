// Descuento manual sobre el total de la venta.

export function aplicarDescuento(subtotal, desc) {
  if (!desc || !Number.isFinite(desc.valor) || desc.valor <= 0) return { descuento: 0, total: subtotal };
  let d = desc.tipo === 'pct' ? Math.round(subtotal * desc.valor / 100) : Math.round(desc.valor);
  d = Math.min(Math.max(d, 0), subtotal);
  return { descuento: d, total: subtotal - d };
}

// Reparte el descuento entre las líneas según su monto; la suma es exacta (el residuo va a la línea mayor).
export function repartirDescuento(lineas, descuento) {
  const total = lineas.reduce((s, l) => s + l.subtotal, 0);
  if (!lineas.length || !total) return lineas.map(() => 0);
  const cuotas = lineas.map(l => descuento * l.subtotal / total);
  const partes = cuotas.map(Math.floor);
  const resto = descuento - partes.reduce((s, x) => s + x, 0);
  const orden = cuotas.map((n, i) => ({ i, resto: n - partes[i] }))
    .sort((a, b) => b.resto - a.resto || lineas[b.i].subtotal - lineas[a.i].subtotal || a.i - b.i);
  for (const { i } of orden.slice(0, resto)) partes[i]++;
  return partes;
}

// Solo la vendedora necesita autorización, y solo por encima del máximo permitido.
export function requiereAutorizacion(rol, pct, maxPct) {
  return rol === 'vendedora' && pct > maxPct;
}
