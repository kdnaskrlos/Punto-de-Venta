import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telefonoInternacional, textoRecibo, enlaceWhatsApp } from '../../js/nucleo/recibo.js';
import { fechaHora } from '../../js/nucleo/fechas.js';

test('teléfonos venezolanos y colombianos reales (Review Focus 5)', () => {
  assert.equal(telefonoInternacional('0412-123.45.67'), '584121234567');
  assert.equal(telefonoInternacional('+58 412 1234567'), '584121234567');
  assert.equal(telefonoInternacional('412 1234567'), '584121234567');
  assert.equal(telefonoInternacional('300 123 4567'), '573001234567');
  assert.equal(telefonoInternacional('57 3001234567'), '573001234567');
  assert.equal(telefonoInternacional('+57 (300) 123-4567'), '573001234567');
  assert.equal(telefonoInternacional('+58 0414-1234567'), '584141234567');
  assert.equal(telefonoInternacional('0058 414 1234567'), '584141234567');
  assert.equal(telefonoInternacional('+57 0300 1234567'), '573001234567');
  assert.equal(telefonoInternacional('607 5712345'), '576075712345');          // fijo colombiano (revisión final)
  assert.equal(telefonoInternacional('+1 305 555 1234'), '13055551234');        // turista
  assert.equal(telefonoInternacional('+51 987 654 321'), '51987654321');
  assert.equal(telefonoInternacional('0300 123 4567'), '573001234567');         // celular colombiano con 0
  assert.equal(telefonoInternacional('0276-3561234'), '582763561234');          // fijo venezolano
  assert.equal(telefonoInternacional('123'), null);
  assert.equal(telefonoInternacional(''), null);
  assert.equal(telefonoInternacional('1234567890123'), null);
});

const VENTA = {
  numero: 'V-0001', fecha: '2026-11-12T19:05:00Z',
  cliente: { nombre: 'Ana Pérez', telefono: '0412-123.45.67' },
  lineas: [{ nombre: 'Franela AS Niño Negro', talla: '6', cantidad: 2, precioUnit: 24000, subtotal: 48000 }],
  subtotal: 48000, descuento: { monto: 2000 }, total: 46000,
  pagos: [{ forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 20000 }, { forma: 'pago-movil', nombre: 'Pago móvil', moneda: 'BS', monto: 7166.67 }],
  vuelto: null,
};

test('fecha y hora de la tienda en 12 h', () => {
  assert.equal(fechaHora('2026-11-12T19:05:00Z'), 'Jueves 12 nov · 3:05 pm');
  assert.equal(fechaHora('2026-11-12T13:30:00Z'), 'Jueves 12 nov · 9:30 am');
});

const V2 = { ...VENTA, tasas: { copPorUsd: 4000, bsPorUsd: 100 } };

test('recibo por plantilla: reemplaza las variables con los datos de la venta', () => {
  const t = textoRecibo(V2, { nombre: 'Comic Shop' }, { plantilla: 'Hola, {cliente}\nGracias por comprar en {tienda}\nTicket: {ticket}\nTotal COP: {totalCOP}\nTotal USD: {totalUSD}\nTotal Bs: {totalBs}\n{prendas}\n{pagos}' });
  assert.equal(t, ['Hola, Ana Pérez', 'Gracias por comprar en Comic Shop', 'Ticket: V-0001', 'Total COP: 46.000', 'Total USD: 11,50', 'Total Bs: 1.150,00',
    '2 × Franela AS Niño Negro · Talla 6 — 48.000', 'Efectivo pesos: 20.000 COP', 'Pago móvil: 7.166,67 Bs'].join('\n'));
});

test('recibo por plantilla: la línea con una variable vacía desaparece', () => {
  const t = textoRecibo(V2, { nombre: 'Comic Shop' }, { plantilla: 'Total: {totalCOP}\n{vuelto}\nChao' });
  assert.equal(t, 'Total: 46.000\nChao');
  const conVuelto = textoRecibo({ ...V2, vuelto: { monto: 2000, moneda: 'COP' } }, { nombre: 'X' }, { plantilla: '{vuelto}' });
  assert.equal(conVuelto, 'Vuelto: 2.000 COP');
});

test('recibo sin plantilla usa el mensaje por defecto (saludo, resumen y tip)', () => {
  const t = textoRecibo(V2, { nombre: 'Comic Shop' });
  for (const parte of ['Hola, Ana Pérez', 'Comic Shop', '*Resumen de tu compra:*', 'Ticket: V-0001', 'Total COP: 46.000', 'Total USD: 11,50'])
    assert.ok(t.includes(parte), `falta «${parte}» en:\n${t}`);
  assert.ok(!t.includes('{'), 'no quedan variables sin reemplazar');
});

test('enlace de WhatsApp al teléfono del cliente con el texto', () => {
  const url = enlaceWhatsApp(V2, { nombre: 'Comic Shop' }, { plantilla: 'Hola {cliente}' });
  assert.equal(url, 'https://wa.me/584121234567?text=' + encodeURIComponent('Hola Ana Pérez'));
});
