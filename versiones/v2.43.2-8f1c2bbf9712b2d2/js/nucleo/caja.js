// Caja de cada usuario: cuánto debería haber por forma de pago y diferencias al cerrar (§11).
import { aCop } from './tasas.js';
import { formaEfectivo } from './formas.js';

export function esperadoCaja(caja, ventas, abonos, formasPago) {
  const esp = Object.fromEntries(formasPago.map(f => [f.id, 0]));
  const sumar = (forma, monto) => { if (forma) esp[forma] = Math.round(((esp[forma] || 0) + monto) * 100) / 100; };
  for (const [moneda, monto] of Object.entries(caja.fondo || {})) sumar(formaEfectivo(formasPago, moneda), monto || 0);
  // Las anuladas cuentan su cobro: la devolución es una salida que registra quien anula.
  for (const v of ventas) {
    for (const p of v.pagos || []) sumar(p.forma, p.monto);
    if (v.vuelto?.partes) {
      for (const p of v.vuelto.partes) sumar(p.forma || formaEfectivo(formasPago, p.moneda), -p.monto);
    } else if (v.vuelto && v.vuelto.monto) sumar(v.vuelto.forma || formaEfectivo(formasPago, v.vuelto.moneda), -v.vuelto.monto);
  }
  for (const a of abonos || []) sumar(a.forma, a.monto);
  for (const m of caja.movimientos || []) sumar(m.forma, m.tipo === 'salida' ? -m.monto : m.monto);
  return esp;
}

export function diferenciasCierre(esperado, contado, formasPago, tasas) {
  const filas = [];
  let totalEsperadoCop = 0, totalContadoCop = 0, totalCop = 0, totalIncompleto = false;
  for (const f of formasPago) {
    if (!(f.id in esperado) && !(f.id in contado)) continue;
    const e = esperado[f.id] || 0, c = contado[f.id] || 0;
    const diferencia = Math.round((c - e) * 100) / 100;
    const difCop = aCop(Math.abs(diferencia), f.moneda, tasas);
    const espCop = aCop(Math.abs(e), f.moneda, tasas);
    const sinTasa = difCop == null || espCop == null;
    if (sinTasa) totalIncompleto = true;
    const nivel = Math.abs(diferencia) < 0.005 ? 'ok' : !sinTasa && difCop <= Math.max(espCop * 0.01, 2000) ? 'leve' : 'grave';
    filas.push({ forma: f.id, moneda: f.moneda, esperado: e, contado: c, diferencia, nivel });
    totalEsperadoCop += aCop(e, f.moneda, tasas) ?? 0;
    totalContadoCop += aCop(c, f.moneda, tasas) ?? 0;
    totalCop += aCop(diferencia, f.moneda, tasas) ?? 0;
  }
  return { filas, totalEsperadoCop, totalContadoCop, totalCop, totalIncompleto };
}


export function devolucionNeta(venta, apartado) {
  const neto = new Map();
  const sumar = (p, signo) => neto.set(p.forma, (neto.get(p.forma) || 0) + signo * p.monto);
  for (const p of [...(apartado?.abonos || []), ...(venta.pagos || [])]) sumar(p, 1);
  for (const p of venta.vuelto?.partes || (venta.vuelto?.monto ? [venta.vuelto] : [])) sumar(p, -1);
  return [...neto].map(([forma, monto]) => [forma, Math.round(monto * 100) / 100]).filter(([, monto]) => monto);
}

// El contado es histórico. El esperado se reconstruye con los cobros ya sincronizados.
export function conciliarCierre(caja, ventas, abonos, formas, tasas) {
  const cierre = caja.cierre || {};
  if (cierre.porArquear || !cierre.contado) return cierre;
  const configuradas = cierre.formasArqueo || formas;
  const esperado = esperadoCaja(caja, ventas, abonos, configuradas);
  const visibles = configuradas.filter(f => f.efectivo || f.id in cierre.contado || esperado[f.id]);
  return { ...cierre, ...diferenciasCierre(esperado, cierre.contado, visibles, cierre.tasasArqueo || tasas) };
}
