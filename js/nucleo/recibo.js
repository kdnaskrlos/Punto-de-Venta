// Recibo por WhatsApp (§9.4).
import { fmtCop, fmtMonto } from './dinero.js';
import { fechaHora } from './fechas.js';
import { NOMBRE_MONEDA } from './formas.js';

// Número internacional sin "+". Venezuela 58 (04xx… o 4xx…) y Colombia 57 (3xx…).
export function telefonoInternacional(texto) {
  let d = String(texto || '').replace(/\D/g, '');
  const internacional = /^\s*(\+|00)/.test(String(texto || ''));
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('580') || d.startsWith('570')) d = d.slice(0, 2) + d.slice(3);
  if (d.length === 11 && d.startsWith('03')) return '57' + d.slice(1);               // celular colombiano escrito con 0
  if (d.length === 11 && d.startsWith('0')) return '58' + d.slice(1);                // Venezuela 04xx / 02xx
  if (d.length === 10 && (d.startsWith('3') || d.startsWith('60'))) return '57' + d; // Colombia celular o fijo
  if (d.length === 10 && (d.startsWith('4') || d.startsWith('2'))) return '58' + d;
  if (d.length === 12 && (d.startsWith('58') || d.startsWith('57'))) return d;
  if (internacional && d.length >= 8 && d.length <= 15) return d;                    // otros países con +
  return null;
}

// Recibo editable en Ajustes: un mensaje con variables entre llaves.
export const PLANTILLA_DEFECTO = [
  'Hola, {cliente} 👋', '',
  '¡Muchas gracias por tu compra en {tienda}! Agradecemos tu preferencia.', '',
  '*Resumen de tu compra:*', 'Ticket: {ticket}', '{prendas}', 'Total COP: {totalCOP}', 'Total USD: {totalUSD}', '',
  'Esperamos que disfrutes tu producto. ¡Te esperamos de vuelta pronto!', '',
  '✅ Tip: Agréganos a tus contactos si aún no lo has hecho. Estamos siempre a la orden 😊👍',
].join('\n');

export const VARIABLES_RECIBO = [
  ['cliente', 'Cliente'], ['tienda', 'Tienda'], ['ticket', 'Ticket'], ['fecha', 'Fecha'],
  ['prendas', 'Prendas'], ['totalCOP', 'Total COP'], ['totalUSD', 'Total USD'], ['totalBs', 'Total Bs'],
  ['pagos', 'Pagos'], ['vuelto', 'Vuelto'],
];

function valoresRecibo(venta, tienda) {
  const usd = venta.tasas?.copPorUsd ? venta.total / venta.tasas.copPorUsd : null;
  const bs = usd != null && venta.tasas?.bsPorUsd ? usd * venta.tasas.bsPorUsd : null;
  return {
    cliente: venta.cliente?.nombre || '', tienda: tienda.nombre || '', ticket: venta.numero || '', fecha: venta.fecha ? fechaHora(venta.fecha) : '',
    prendas: venta.lineas.map(l => `${l.cantidad} × ${l.nombre}${l.talla ? ` · Talla ${l.talla}` : ''} — ${fmtCop(l.subtotal ?? l.precioUnit * l.cantidad)}`).join('\n'),
    totalCOP: fmtCop(venta.total), totalUSD: usd == null ? '' : fmtMonto(usd, 'USD'), totalBs: bs == null ? '' : fmtMonto(bs, 'BS'),
    pagos: (venta.pagos || []).map(p => `${p.nombre || p.forma}: ${fmtMonto(p.monto, p.moneda)} ${NOMBRE_MONEDA[p.moneda]}`).join('\n'),
    vuelto: venta.vuelto?.monto > 0 ? `Vuelto: ${fmtMonto(venta.vuelto.monto, venta.vuelto.moneda)} ${NOMBRE_MONEDA[venta.vuelto.moneda]}` : '',
  };
}

export function textoRecibo(venta, tienda, recibo = {}) {
  const val = valoresRecibo(venta, tienda);
  const plantilla = recibo.plantilla?.trim() ? recibo.plantilla : PLANTILLA_DEFECTO;
  return plantilla.split('\n').flatMap(linea => {
    const vars = linea.match(/\{(\w+)\}/g) || [];
    const lleno = linea.replace(/\{(\w+)\}/g, (m, k) => (k in val ? val[k] : m));
    // Si todas las variables de la línea quedan vacías (sin vuelto, sin tasa…), la línea no se muestra.
    if (vars.length && vars.every(v => val[v.slice(1, -1)] === '')) return [];
    return [lleno];
  }).join('\n');
}

export function enlaceWhatsApp(venta, tienda, recibo) {
  const tel = telefonoInternacional(venta.cliente?.telefono);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(textoRecibo(venta, tienda, recibo)).replace(/\*/g, '%2A')}`;
}
