import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generarEjemplos } from '../../js/nucleo/ejemplos.js';

const FORMAS = [{ id: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP' }, { id: 'pago-movil', nombre: 'Pago móvil', moneda: 'BS' }];
const TASAS = { copPorUsd: 4000, bsPorUsd: 100 };

test('ejemplos: todo marcado demo, ventas de hoy y de días anteriores, apartados en sus estados', () => {
  const ahora = new Date('2026-11-12T15:00:00-04:00');
  const l = generarEjemplos({ formas: FORMAS, tasas: TASAS, ahora });
  for (const k of ['productos', 'costos', 'clientes', 'ventas', 'apartados']) {
    assert.ok(l[k].length > 0, k);
    assert.ok(l[k].every(x => x.demo === true), `${k} con demo:true`);
  }
  const hoy = l.ventas.filter(v => v.fecha.slice(0, 10) === ahora.toISOString().slice(0, 10));
  assert.ok(hoy.length >= 4, 'ventas de hoy');
  assert.ok(l.ventas.length >= 30);
  for (const v of l.ventas) {
    assert.equal(v.total, v.subtotal - (v.descuento?.monto || 0));
    assert.equal(v.pagos.reduce((s, p) => s + p.equivalenteCop, 0), v.total);
  }
  assert.deepEqual([...new Set(l.apartados.map(a => a.estado))].sort(), ['cancelado', 'completado', 'pendiente']);
  assert.ok(l.apartados.every(a => a.saldo >= 0 && a.saldo <= a.total));
});

test('ejemplos: usa los productos reales si hay suficientes', () => {
  const productos = Object.fromEntries(['A', 'B', 'C', 'D'].map(g => [`${g}-1`, { sku: `${g}-1`, producto: g, grupo: g, talla: '1', precios: [10000], activo: true }]));
  const l = generarEjemplos({ productos, formas: FORMAS, tasas: TASAS });
  assert.equal(l.productos.length, 0);
  assert.ok(l.ventas.every(v => v.lineas.every(x => productos[x.sku])));
});
