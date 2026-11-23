// Cobro con pagos en varias monedas: cuánto falta, cuánto sobra y cuánto sugerir.
import { aCop, desdeCop } from './tasas.js';
import { redondear } from './dinero.js';

export function estadoCobro({ total, pagos = [], tasas, redondeo = 100 }) {
  const conEq = pagos.map(p => ({ ...p, equivalenteCop: aCop(p.monto, p.moneda, tasas) }));
  const invalido = conEq.some(p => p.equivalenteCop == null);
  const pagadoCop = conEq.reduce((s, p) => s + (p.equivalenteCop || 0), 0);
  const faltaCop = Math.max(0, total - pagadoCop);
  const vueltoCop = Math.max(0, pagadoCop - total);
  return { pagos: conEq, pagadoCop, faltaCop, vueltoCop, cuadra: !invalido && faltaCop === 0 };
}

export function montoSugerido(faltaCop, moneda, tasas) {
  return desdeCop(faltaCop, moneda, tasas, { haciaArriba: true });
}

// redondeoUsd (v2.06): paso del vuelto en dólares (0,01 = sin redondear; 1 = dólares enteros).
export function vueltoEn(vueltoCop, moneda, tasas, redondeo = 100, redondeoUsd = 0.01) {
  if (moneda === 'COP') return redondear(vueltoCop, redondeo);
  const v = desdeCop(vueltoCop, moneda, tasas);
  return moneda === 'USD' && v != null && redondeoUsd > 0.01 ? redondear(v, redondeoUsd) : v;
}

/**
 * Vuelto físico mixto. Se entregan primero billetes USD enteros/múltiplos del
 * mínimo configurado, y después COP en múltiplos del paso indicado.
 * El remanente es explícito: jamás se presenta como dinero efectivamente devuelto.
 * No se debe usar para Zelle ni USDT, que conservan centavos.
 */
export function vueltoMixto(vueltoCop, tasas, { billeteMinimoUsd = 1, redondeoCop = 100, todoEnPesos = false } = {}) {
  if (!Number.isSafeInteger(vueltoCop) || vueltoCop < 0) return null;
  if (!Number.isSafeInteger(redondeoCop) || redondeoCop <= 0) return null;
  if (!Number.isFinite(billeteMinimoUsd) || billeteMinimoUsd < 1 || !Number.isInteger(billeteMinimoUsd)) return null;
  const tasa = tasas?.copPorUsd;
  if (!todoEnPesos && (!Number.isFinite(tasa) || tasa <= 0)) return null;
  const unidades = todoEnPesos ? 0 : Math.floor((vueltoCop / tasa + 1e-10) / billeteMinimoUsd);
  const usd = unidades * billeteMinimoUsd;
  const usadoUsdCop = Math.round(usd * (tasa || 0));
  if (usadoUsdCop > vueltoCop) return null;
  const restoCop = vueltoCop - usadoUsdCop;
  const cop = Math.floor(restoCop / redondeoCop) * redondeoCop;
  return { usd, cop, remanenteCop: restoCop - cop, equivalenteCop: usadoUsdCop + cop };
}
