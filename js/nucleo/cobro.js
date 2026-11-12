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

export function vueltoEn(vueltoCop, moneda, tasas, redondeo = 100) {
  if (moneda === 'COP') return redondear(vueltoCop, redondeo);
  return desdeCop(vueltoCop, moneda, tasas);
}
