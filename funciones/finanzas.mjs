import { calcularCarrito, normalizarTramos } from './nucleo/tramos.mjs';
import { comisionesVenta } from './nucleo/comisiones.mjs';
import { aplicarDescuento, repartirDescuento } from './nucleo/descuento.mjs';
import { estadoCobro, vueltoEn, vueltoMixto } from './nucleo/cobro.mjs';
import { formaEfectivo, FORMAS_PAGO_DEFECTO, normalizarFormas } from './nucleo/formas.mjs';
import { aCop, tasasVigentes } from './nucleo/tasas.mjs';

function vueltoValido(v, sobrante, tasas, formas, ajustes) {
  if (!sobrante) return v == null;
  if (!v || !Array.isArray(v.partes)) return false;
  const redondeo = ajustes.redondeo || 100;
  const candidatos = [];
  for (const moneda of ['COP', 'USD', 'BS']) {
    const forma = formaEfectivo(formas, moneda);
    if (!forma) continue;
    const monto = vueltoEn(sobrante, moneda, tasas, redondeo);
    if (monto == null) continue;
    const equivalenteCop = aCop(monto, moneda, tasas);
    candidatos.push({ partes: monto > 0 ? [{ moneda, forma, monto }] : [], equivalenteCop });
  }
  const usd = formaEfectivo(formas, 'USD'), cop = formaEfectivo(formas, 'COP');
  const mixto = usd && cop && vueltoMixto(sobrante, tasas, {
    redondeoCop: redondeo, billeteMinimoUsd: ajustes.billeteMinimoUsd || 1,
  });
  if (mixto) candidatos.push({ equivalenteCop: mixto.equivalenteCop, partes: [
    ...(mixto.usd ? [{ moneda: 'USD', forma: usd, monto: mixto.usd }] : []),
    ...(mixto.cop ? [{ moneda: 'COP', forma: cop, monto: mixto.cop }] : []),
  ] });
  return candidatos.some(({ partes, equivalenteCop }) => partes.length === v.partes.length
    && partes.every((p, i) => p.moneda === v.partes[i]?.moneda && p.forma === v.partes[i]?.forma && p.monto === v.partes[i]?.monto)
    && v.equivalenteCop === equivalenteCop && v.remanenteCop === Math.max(0, sobrante - equivalenteCop)
    && v.moneda === (partes[0]?.moneda || 'COP') && v.monto === (partes[0]?.monto || 0)
    && v.forma === (partes[0]?.forma || cop || null));
}

export function verificarLineas(v, productos, general, perfil, autorizacion) {
  const limites = normalizarTramos(general.tramos);
  const calculo = calcularCarrito(v.lineas.map(({ sku, cantidad }) => ({ sku, cantidad })), productos, {
    limites, redondeo: general.redondeo ?? 100,
  });
  if (calculo.invalidas.length || calculo.subtotal !== v.subtotal) return 'precios';
  const d = v.descuento;
  if (d && (!['pct', 'monto'].includes(d.tipo) || !Number.isFinite(d.valor) || d.valor <= 0)) return 'descuento';
  const { descuento } = aplicarDescuento(calculo.subtotalDescontable, d);
  const total = calculo.subtotal - descuento;
  if (!Number.isSafeInteger(total) || total <= 0 || total !== v.total
    || (d && (!descuento || descuento >= calculo.subtotalDescontable || d.monto !== descuento))) return 'total';
  if (d && (perfil.rol === 'vendedora' || d.autorizacionId)) {
    const prendas = JSON.stringify([v.id, calculo.lineas.map(l => [l.sku, l.cantidad])]);
    const firma = JSON.stringify([prendas, calculo.lineas.map(l => [l.sku, l.cantidad, l.precioUnit, l.separado])]);
    const a = autorizacion;
    if (!a || a.estado !== 'aprobada' || a.ventaId !== v.id || a.uid !== perfil.uid
      || a.usuario !== perfil.usuario || a.firmaCarrito !== firma || a.subtotal !== calculo.subtotalDescontable
      || a.tipo !== d.tipo || a.valor !== d.valor || !a.aprueba || a.aprueba !== d.autorizadoPor) return 'autorizacion';
  } else if (d?.autorizadoPor) return 'autorizacion';

  const partes = repartirDescuento(calculo.lineas.map(l => ({ subtotal: l.separado ? 0 : l.subtotal })), descuento);
  const comisiones = comisionesVenta(calculo.lineas, productos, general.comisiones, descuento > 0, limites, general.redondeo ?? 100);
  if (!calculo.lineas.every((c, i) => {
    const l = v.lineas[i];
    return l.tramo === c.tramo && l.precioUnit === c.precioUnit && l.subtotal === c.subtotal
      && l.oferta === c.oferta && l.descuento === partes[i]
      && l.comision === comisiones[i].comision && l.reducida === comisiones[i].reducida;
  })) return 'lineas';

  return null;
}

// Un abono aplica al saldo sin vuelto. La liquidación aplica al saldo pendiente
// y conserva los importes originales del apartado, aunque el catálogo haya cambiado.
export function verificarPagos(v, total, general, ajustesTasas, tasaRemota, parcial = false) {
  if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(v.pagos)) return 'pagos';
  const tasas = tasasVigentes(ajustesTasas, tasaRemota);
  const formas = (normalizarFormas(general.formasPago) || FORMAS_PAGO_DEFECTO).filter(f => f.activa !== false);
  const usadas = new Set();
  for (const p of v.pagos) {
    const f = formas.find(f => f.id === p?.forma);
    if (!f) return 'pagos';
    const centavos = Math.round(p.monto * 100);
    if (f.moneda !== p.moneda || f.nombre !== p.nombre || usadas.has(p.forma)
      || p.monto <= 0 || !Number.isSafeInteger(centavos) || centavos / 100 !== p.monto
      || (p.moneda === 'COP' && !Number.isSafeInteger(p.monto))) return 'pagos';
    usadas.add(p.forma);
  }
  const e = estadoCobro({ total, pagos: v.pagos, tasas });
  if ((!parcial && !e.cuadra) || !Number.isSafeInteger(e.pagadoCop)
    || !e.pagos.every((p, i) => Number.isSafeInteger(p.equivalenteCop) && (!parcial || p.equivalenteCop > 0)
      && p.equivalenteCop === v.pagos[i].equivalenteCop)) return 'pagos';
  if (parcial ? e.vueltoCop > 0 || v.vuelto != null : !vueltoValido(v.vuelto, e.vueltoCop, tasas, formas, general)) return 'vuelto';
  if ((v.pagos.some(p => p.moneda !== 'COP') || v.vuelto?.partes?.some(p => p.moneda !== 'COP'))
    && v.tasas?.copPorUsd !== tasas.copPorUsd) return 'tasas';
  if ((v.pagos.some(p => p.moneda === 'BS') || v.vuelto?.partes?.some(p => p.moneda === 'BS'))
    && (v.tasas?.bsPorUsd !== tasas.bsPorUsd || v.tasas?.fuenteBs !== tasas.fuenteBs)) return 'tasas';
  return { pagadoCop: e.pagadoCop };
}

export function verificarFinanzas(v, productos, general, ajustesTasas, tasaRemota, perfil, autorizacion) {
  const lineas = verificarLineas(v, productos, general, perfil, autorizacion);
  if (lineas) return lineas;
  const pagos = verificarPagos(v, v.total, general, ajustesTasas, tasaRemota);
  return typeof pagos === 'string' ? pagos : null;
}
