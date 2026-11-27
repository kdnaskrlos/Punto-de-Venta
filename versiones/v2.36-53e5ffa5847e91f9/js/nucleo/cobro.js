// Cobro con pagos en varias monedas: cuánto falta, cuánto sobra y cuánto sugerir.
import { aCop, desdeCop } from './tasas.js';
import { redondear } from './dinero.js';

export function estadoCobro({ total, pagos = [], tasas, redondeo = 100 }) {
  const conEq = pagos.map(p => ({ ...p, equivalenteCop: aCop(p.monto, p.moneda, tasas) }));
  const invalido = conEq.some(p => p.equivalenteCop == null);
  const pagadoCop = conEq.reduce((s, p) => s + (p.equivalenteCop || 0), 0);
  const faltaCop = Math.max(0, total - pagadoCop);
  const vueltoCop = Math.max(0, pagadoCop - total);
  return { pagos: conEq, pagadoCop, faltaCop, vueltoCop, cuadra: !invalido && faltaCop < redondeo / 2 };
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
