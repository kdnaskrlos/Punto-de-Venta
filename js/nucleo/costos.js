// Costo de cada prenda en la fecha de la venta, a partir del historial de costos (§15).
export function costoEn(historial, fechaISO) {
  if (!historial || !historial.length) return null;
  const orden = [...historial].sort((a, b) => a.desde.localeCompare(b.desde));
  let c = orden[0].costo;
  for (const h of orden) if (h.desde <= fechaISO) c = h.costo;
  return c;
}

export function costoVenta(venta, costosPorSku) {
  let total = 0, incompleto = false;
  const lineas = (venta.lineas || []).map(l => {
    const c = costosPorSku[l.sku];
    const costoUnit = c ? (costoEn(c.historial, venta.fecha) ?? c.costo ?? null) : null;
    if (costoUnit == null) incompleto = true; else total += costoUnit * l.cantidad;
    return { sku: l.sku, costoUnit };
  });
  return { lineas, total, incompleto };
}
