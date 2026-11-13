// Precio por cantidad (tramos del Tarifario) con la regla del mix.
import { redondear } from './dinero.js';

export const LIMITES_DEFECTO = [1, 6, 12, 24, 49];

export function tramoDe(cantidad, limites = LIMITES_DEFECTO) {
  let t = 0;
  limites.forEach((min, i) => { if (cantidad >= min) t = i; });
  return t;
}

export function etiquetaTramo(i, limites = LIMITES_DEFECTO) {
  const a = limites[i], sig = limites[i + 1];
  if (sig == null) return `${a}+`;
  return sig - 1 === a ? `${a}` : `${a}–${sig - 1}`;
}

// Precio del tramo; si no tiene valor válido, el del tramo inferior más cercano con valor.
export function precioDeTramo(precios, t) {
  for (let i = t; i >= 0; i--) {
    const p = precios?.[i];
    if (typeof p === 'number' && Number.isFinite(p) && p > 0) return p;
  }
  return null;
}

export function calcularCarrito(lineas, productosPorSku, { limites = LIMITES_DEFECTO, redondeo = 100 } = {}) {
  const validas = [], invalidas = [];
  for (const l0 of lineas || []) {
    const l = { ...l0, cantidad: Number(l0.cantidad) };
    const p = productosPorSku[l.sku];
    if (!p) invalidas.push({ sku: l.sku, motivo: 'producto' });
    else if (!Number.isInteger(l.cantidad) || l.cantidad < 0) invalidas.push({ sku: l.sku, motivo: 'cantidad' });
    else if (precioDeTramo(p.precios, 0) == null) invalidas.push({ sku: l.sku, motivo: 'precio' });
    else if (l.cantidad > 0) validas.push(l);
  }
  // Todas las prendas cuentan juntas para el tramo (mix). «separado» se guarda desde el Tarifario pero todavía
  // no tiene uso: Carlos definirá su regla más adelante.
  const cantidadMix = validas.reduce((s, l) => s + l.cantidad, 0);
  const resultado = validas.map(l => {
    const p = productosPorSku[l.sku];
    const tramo = tramoDe(cantidadMix, limites);
    let precioUnit = precioDeTramo(p.precios, tramo);
    const oferta = !!(p.oferta && p.oferta.activa && p.oferta.pct > 0);
    if (oferta) precioUnit = redondear(precioUnit * (1 - Math.min(p.oferta.pct, 100) / 100), redondeo);
    return { sku: l.sku, cantidad: l.cantidad, tramo, precioUnit, subtotal: precioUnit * l.cantidad, oferta };
  });
  const subtotal = resultado.reduce((s, l) => s + l.subtotal, 0);
  let aviso = null;
  if (cantidadMix > 0) {
    const t = tramoDe(cantidadMix, limites);
    const sig = limites[t + 1];
    if (sig != null && sig - cantidadMix <= 3) aviso = { faltan: sig - cantidadMix, etiqueta: etiquetaTramo(t + 1, limites) };
  }
  return { lineas: resultado, cantidadMix, subtotal, aviso, invalidas };
}
