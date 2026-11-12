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

export function textoRecibo(venta, tienda) {
  const L = [`*${tienda.nombre}*`, fechaHora(venta.fecha)];
  if (venta.numero) L.push(`Venta ${venta.numero}`);
  L.push(`Cliente: ${venta.cliente?.nombre || ''}`, '');
  for (const l of venta.lineas) L.push(`${l.cantidad} × ${l.nombre}${l.talla ? ` · Talla ${l.talla}` : ''} — ${fmtCop(l.subtotal ?? l.precioUnit * l.cantidad)}`);
  L.push('');
  const desc = venta.descuento?.monto || 0;
  if (desc > 0) L.push(`Subtotal: ${fmtCop(venta.subtotal)}`, `Descuento: -${fmtCop(desc)}`);
  L.push(`*Total: ${fmtCop(venta.total)} COP*`, '', 'Pagos:');
  for (const p of venta.pagos || []) L.push(`${p.nombre || p.forma}: ${fmtMonto(p.monto, p.moneda)} ${NOMBRE_MONEDA[p.moneda]}`);
  if (venta.vuelto && venta.vuelto.monto > 0) L.push(`Vuelto: ${fmtMonto(venta.vuelto.monto, venta.vuelto.moneda)} ${NOMBRE_MONEDA[venta.vuelto.moneda]}`);
  L.push('', '¡Gracias por tu compra!');
  return L.join('\n');
}

export function enlaceWhatsApp(venta, tienda) {
  const tel = telefonoInternacional(venta.cliente?.telefono);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(textoRecibo(venta, tienda)).replace(/\*/g, '%2A')}`;
}
