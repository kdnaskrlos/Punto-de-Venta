import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puede } from '../../js/nucleo/permisos.js';

test('encargada: ve costos y anula, pero no aprueba descuentos ni importa ni hace ofertas (§4)', () => {
  assert.ok(puede('encargada', 'verCostos'));
  assert.ok(puede('encargada', 'anularVenta'));
  assert.ok(puede('encargada', 'descuentoSinLimite'));
  assert.ok(puede('encargada', 'cancelarApartado'));
  assert.ok(puede('encargada', 'pagarComisiones'));
  assert.ok(puede('encargada', 'verReportesTodos'));
  for (const a of ['aprobarDescuento', 'importar', 'fotosMasivas', 'ajustarInventario', 'ofertas', 'cambiarTasas', 'reabrirCaja', 'ajustes'])
    assert.ok(!puede('encargada', a), a);
});

test('vendedora: vende y abre caja, nada de gestión', () => {
  assert.ok(puede('vendedora', 'vender'));
  assert.ok(puede('vendedora', 'abrirCaja'));
  assert.ok(puede('vendedora', 'descuentoHastaMax'));
  for (const a of ['verCostos', 'descuentoSinLimite', 'anularVenta', 'verReportesTodos', 'pagarComisiones'])
    assert.ok(!puede('vendedora', a), a);
});

test('admin puede todo', () => {
  for (const a of ['reabrirCaja', 'ajustes', 'importar', 'aprobarDescuento', 'cambiarTasas', 'ofertas'])
    assert.ok(puede('admin', a), a);
});

test('rol desconocido o acción desconocida: no', () => {
  assert.ok(!puede('desconocido', 'vender'));
  assert.ok(!puede('admin', 'accionInventada'));
  assert.ok(!puede(undefined, 'vender'));
});
