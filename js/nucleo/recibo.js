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

// Plantilla del recibo editable en Ajustes. Lo que no se indique usa estos valores.
export const RECIBO_DEFECTO = {
  saludo: '',
  despedida: '¡Gracias por tu compra!',
  pie: '',
  mostrar: { fecha: true, numero: true, cliente: true, prendas: true, pagos: true, vuelto: true },
};

export function textoRecibo(venta, tienda, recibo = {}) {
  const m = { ...RECIBO_DEFECTO.mostrar, ...(recibo.mostrar || {}) };
  const despedida = recibo.despedida ?? RECIBO_DEFECTO.despedida;
  const nombreCli = venta.cliente?.nombre || '';
  const L = [`*${tienda.nombre}*`];
  if (recibo.saludo?.trim()) L.push(recibo.saludo.trim().replace(/\{cliente\}/g, nombreCli));
  if (m.fecha) L.push(fechaHora(venta.fecha));
  if (m.numero && venta.numero) L.push(`Venta ${venta.numero}`);
  if (m.cliente && !recibo.saludo?.includes('{cliente}')) L.push(`Cliente: ${nombreCli}`);
  L.push('');
  if (m.prendas) {
    for (const l of venta.lineas) L.push(`${l.cantidad} × ${l.nombre}${l.talla ? ` · Talla ${l.talla}` : ''} — ${fmtCop(l.subtotal ?? l.precioUnit * l.cantidad)}`);
    L.push('');
  }
  const desc = venta.descuento?.monto || 0;
  if (desc > 0) L.push(`Subtotal: ${fmtCop(venta.subtotal)}`, `Descuento: -${fmtCop(desc)}`);
  L.push(`*Total: ${fmtCop(venta.total)} COP*`);
  if (m.pagos) {
    L.push('', 'Pagos:');
    for (const p of venta.pagos || []) L.push(`${p.nombre || p.forma}: ${fmtMonto(p.monto, p.moneda)} ${NOMBRE_MONEDA[p.moneda]}`);
  }
  if (m.vuelto && venta.vuelto && venta.vuelto.monto > 0) L.push(`Vuelto: ${fmtMonto(venta.vuelto.monto, venta.vuelto.moneda)} ${NOMBRE_MONEDA[venta.vuelto.moneda]}`);
  if (despedida.trim()) L.push('', despedida.trim());
  if (recibo.pie?.trim()) L.push('', recibo.pie.trim());
  return L.join('\n');
}

export function enlaceWhatsApp(venta, tienda, recibo) {
  const tel = telefonoInternacional(venta.cliente?.telefono);
  if (!tel) return null;
  return `https://wa.me/${tel}?text=${encodeURIComponent(textoRecibo(venta, tienda, recibo)).replace(/\*/g, '%2A')}`;
}
