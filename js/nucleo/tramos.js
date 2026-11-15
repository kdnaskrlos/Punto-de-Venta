// Precio por cantidad (tramos del Tarifario) con la regla del mix.
import { redondear } from './dinero.js';

// Tramos del Tarifario: precio1 = 1-5, precio2 = 6-11, precio3 = 12-23, precio4 = 24-47, precio5 = 48 o más.
export const LIMITES_DEFECTO = [1, 6, 12, 24, 48];
// Hasta la v1.71 el último tramo empezaba en 49: si quedó guardado así en Ajustes, se corrige a 48.
export const normalizarTramos = t => (Array.isArray(t) && t.join(',') === '1,6,12,24,49' ? [...LIMITES_DEFECTO] : t);

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
  // v2.09 · «separado» (columna de la Carga Masiva): esas prendas no suman al mix ni reciben su tramo; van por su
  // propia cantidad, contando juntas las tallas y colores del mismo producto. Tampoco llevan descuento (ver
  // subtotalDescontable). Las demás prendas cuentan juntas para el tramo (mix).
  const esSep = l => !!productosPorSku[l.sku].separado;
  const claveProducto = p => [p.tipo, p.marca, p.genero, p.modelo].map(x => String(x || '').toLowerCase()).join('|');
  const cantidadMix = validas.reduce((s, l) => s + (esSep(l) ? 0 : l.cantidad), 0);
  const porProducto = new Map();
  for (const l of validas) if (esSep(l)) { const k = claveProducto(productosPorSku[l.sku]); porProducto.set(k, (porProducto.get(k) || 0) + l.cantidad); }
  const resultado = validas.map(l => {
    const p = productosPorSku[l.sku];
    const separado = esSep(l);
    const tramo = tramoDe(separado ? porProducto.get(claveProducto(p)) : cantidadMix, limites);
    let precioUnit = precioDeTramo(p.precios, tramo);
    const oferta = !!(p.oferta && p.oferta.activa && p.oferta.pct > 0);
    if (oferta) precioUnit = redondear(precioUnit * (1 - Math.min(p.oferta.pct, 100) / 100), redondeo);
    return { sku: l.sku, cantidad: l.cantidad, tramo, precioUnit, subtotal: precioUnit * l.cantidad, oferta, separado };
  });
  const subtotal = resultado.reduce((s, l) => s + l.subtotal, 0);
  const subtotalDescontable = resultado.reduce((s, l) => s + (l.separado ? 0 : l.subtotal), 0);
  let aviso = null;
  if (cantidadMix > 0) {
    const t = tramoDe(cantidadMix, limites);
    const sig = limites[t + 1];
    if (sig != null && sig - cantidadMix <= 3) aviso = { faltan: sig - cantidadMix, etiqueta: etiquetaTramo(t + 1, limites) };
  }
  // v2.10: cada producto «separado» tiene su propio aviso de «con N más pasan a precio …».
  const avisosSeparado = [];
  for (const [k, n] of porProducto) {
    const t = tramoDe(n, limites), sig = limites[t + 1];
    if (sig == null || sig - n > 3) continue;
    const p = productosPorSku[validas.find(l => esSep(l) && claveProducto(productosPorSku[l.sku]) === k).sku];
    avisosSeparado.push({ faltan: sig - n, etiqueta: etiquetaTramo(t + 1, limites), nombre: [p.tipo, p.marca].filter(Boolean).join(' ') });
  }
  return { lineas: resultado, cantidadMix, subtotal, subtotalDescontable, aviso, avisosSeparado, invalidas };
}
