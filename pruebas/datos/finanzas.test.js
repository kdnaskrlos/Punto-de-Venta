import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarFinanzas } from '../../funciones/finanzas.mjs';

const productos = { s: { precios: [22000] } };
const perfil = { uid: 'vendedora-qa', usuario: 'qa', rol: 'vendedora' };
const pesos = { forma: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', monto: 1000, equivalenteCop: 1000 };
const dolares = { forma: 'efectivo-usd', nombre: 'Efectivo dólares', moneda: 'USD', monto: 5, equivalenteCop: 20000 };
const venta = {
  id: 'con-autorizacion', subtotal: 22000, total: 21000, pagos: [pesos, dolares], vuelto: null,
  tasas: { copPorUsd: 4000 },
  descuento: { tipo: 'monto', monto: 1000, valor: 1000, autorizadoPor: 'admin-qa', autorizacionId: 'aprobada-qa' },
  lineas: [{ sku: 's', cantidad: 1, tramo: 0, precioUnit: 22000, subtotal: 22000, oferta: false, descuento: 1000, comision: 2000, reducida: true }],
};
const aprobacion = { ...perfil, estado: 'aprobada', ventaId: venta.id, aprueba: 'admin-qa', subtotal: 22000, tipo: 'monto', valor: 1000,
  firmaCarrito: JSON.stringify([JSON.stringify([venta.id, [['s', 1]]]), [['s', 1, 22000, false]]]) };

test('el servidor acepta una venta mixta cuando puede acreditar el descuento', () => {
  assert.equal(verificarFinanzas(venta, productos, {}, { copPorUsd: 4000 }, null, perfil, aprobacion), null);
  assert.equal(verificarFinanzas(venta, productos, {}, { copPorUsd: 4000 }, null, perfil, null), 'autorizacion');
});

test('un comprobante legítimo queda pendiente de conciliación si cambiaron precios o tasas antes de sincronizar', () => {
  assert.equal(verificarFinanzas(venta, { s: { precios: [23000] } }, {}, { copPorUsd: 4000 }, null, perfil, aprobacion), 'precios');
  assert.equal(verificarFinanzas(venta, productos, {}, { copPorUsd: 3900 }, null, perfil, aprobacion), 'pagos');
});
