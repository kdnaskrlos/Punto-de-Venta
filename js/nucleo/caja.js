// Caja de cada usuario: cuánto debería haber por forma de pago y diferencias al cerrar (§11).
import { aCop } from './tasas.js';
import { formaEfectivo } from './formas.js';

export function esperadoCaja(caja, ventas, abonos, formasPago) {
  const esp = Object.fromEntries(formasPago.map(f => [f.id, 0]));
  const sumar = (forma, monto) => { if (forma in esp) esp[forma] = Math.round((esp[forma] + monto) * 100) / 100; };
  for (const [moneda, monto] of Object.entries(caja.fondo || {})) sumar(formaEfectivo(formasPago, moneda), monto || 0);
  for (const v of ventas) {
    if (v.estado === 'anulada') continue;
    for (const p of v.pagos || []) sumar(p.forma, p.monto);
    if (v.vuelto && v.vuelto.monto) sumar(v.vuelto.forma || formaEfectivo(formasPago, v.vuelto.moneda), -v.vuelto.monto);
  }
  for (const a of abonos || []) sumar(a.forma, a.monto);
  for (const m of caja.movimientos || []) sumar(m.forma, m.tipo === 'salida' ? -m.monto : m.monto);
  return esp;
}

export function diferenciasCierre(esperado, contado, formasPago, tasas) {
  const filas = [];
  let totalEsperadoCop = 0, totalContadoCop = 0, totalCop = 0;
  for (const f of formasPago) {
    if (!(f.id in esperado) && !(f.id in contado)) continue;
    const e = esperado[f.id] || 0, c = contado[f.id] || 0;
    const diferencia = Math.round((c - e) * 100) / 100;
    const difCop = Math.abs(aCop(diferencia, f.moneda, tasas) ?? 0);
    const espCop = Math.abs(aCop(e, f.moneda, tasas) ?? 0);
    const nivel = Math.abs(diferencia) < 0.005 ? 'ok' : difCop <= Math.max(espCop * 0.01, 2000) ? 'leve' : 'grave';
    filas.push({ forma: f.id, moneda: f.moneda, esperado: e, contado: c, diferencia, nivel });
    totalEsperadoCop += aCop(e, f.moneda, tasas) ?? 0;
    totalContadoCop += aCop(c, f.moneda, tasas) ?? 0;
    totalCop += aCop(diferencia, f.moneda, tasas) ?? 0;
  }
  return { filas, totalEsperadoCop, totalContadoCop, totalCop };
}
