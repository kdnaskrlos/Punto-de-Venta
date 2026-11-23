// Tasas del día y conversión entre COP, USD y Bs.
// copPorUsd: pesos por dólar (manual). bsPorUsd: bolívares por dólar (tasa.json o manual).
import { redondear } from './dinero.js';

const valida = n => (typeof n === 'number' && Number.isFinite(n) && n > 0) ? n : null;

export function tasasVigentes(ajustesTasas = {}, tasaJson = null, cacheBs = null) {
  const copPorUsd = valida(ajustesTasas.copPorUsd);
  const modo = ajustesTasas.bsModo || 'binance';
  let bsPorUsd = null, bsActualizada = null, ultimaConocida = false;
  if (modo === 'manual') {
    bsPorUsd = valida(ajustesTasas.bsManual);
    bsActualizada = ajustesTasas.bsManualActualizada || null;
  } else {
    const fuente = modo === 'bcv' ? tasaJson?.bcv : tasaJson;
    const base = valida(fuente?.rate);
    if (base) {
      bsPorUsd = modo === 'binance' ? redondear(base + (Number(ajustesTasas.bsRecargo) || 0), 0.01) : base;
      bsActualizada = fuente.updated_at || null;
    } else if (cacheBs && valida(cacheBs.bsPorUsd) && cacheBs.fuenteBs === modo) {
      bsPorUsd = cacheBs.bsPorUsd;
      bsActualizada = cacheBs.bsActualizada || null;
      ultimaConocida = true;
    }
  }
  return { copPorUsd, bsPorUsd, fuenteBs: modo, bsActualizada, copActualizada: ajustesTasas.copActualizada || null, ultimaConocida };
}

// Pesos que vale un monto en su moneda (entero).
export function aCop(monto, moneda, tasas) {
  if (!Number.isFinite(monto)) return null;
  if (moneda === 'COP') return Math.round(monto);
  if (!tasas?.copPorUsd) return null;
  if (moneda === 'USD') return Math.round(monto * tasas.copPorUsd);
  if (moneda === 'BS') return tasas.bsPorUsd ? Math.round(monto * tasas.copPorUsd / tasas.bsPorUsd) : null;
  return null;
}

// Cuánto es un monto en pesos en otra moneda (2 decimales; haciaArriba para que alcance a cubrir).
export function desdeCop(cop, moneda, tasas, { haciaArriba = false } = {}) {
  if (!Number.isFinite(cop)) return null;
  if (moneda === 'COP') return Math.round(cop);
  if (!tasas?.copPorUsd) return null;
  let v;
  if (moneda === 'USD') v = cop / tasas.copPorUsd;
  else if (moneda === 'BS') { if (!tasas.bsPorUsd) return null; v = cop * tasas.bsPorUsd / tasas.copPorUsd; }
  else return null;
  if (haciaArriba) return Math.ceil(redondear(v * 100, 1e-6)) / 100;
  return redondear(v, 0.01);
}

export function copPorBs(tasas) {
  return tasas?.copPorUsd && tasas?.bsPorUsd ? tasas.copPorUsd / tasas.bsPorUsd : null;
}
