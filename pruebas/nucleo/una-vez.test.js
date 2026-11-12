import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unaVez } from '../../js/nucleo/una-vez.js';

test('un segundo toque mientras corre la acción no la repite (revisión final)', async () => {
  let veces = 0;
  const boton = { disabled: false };
  const accion = unaVez(boton, async () => { veces++; await new Promise(r => setTimeout(r, 20)); });
  await Promise.all([accion(), accion(), accion()]);
  assert.equal(veces, 1);
  assert.equal(boton.disabled, false);
  await accion();
  assert.equal(veces, 2);
});

test('si la acción falla, el botón vuelve a quedar habilitado', async () => {
  const boton = { disabled: false };
  const accion = unaVez(boton, async () => { throw new Error('x'); });
  await assert.rejects(accion());
  assert.equal(boton.disabled, false);
});
