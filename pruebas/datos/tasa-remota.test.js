import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerTasaRemota } from '../../js/datos/tasa-remota.js';

const REAL = JSON.parse(readFileSync(new URL('../nucleo/ejemplos/tasa.json', import.meta.url)));
const responde = cuerpo => async () => ({ ok: true, json: async () => cuerpo });

test('lee el tasa.json real de la calculadora', async () => {
  const t = await leerTasaRemota(responde(REAL), 'x');
  assert.equal(t.rate, REAL.rate);
  assert.equal(t.bcv.rate, REAL.bcv.rate);
});

test('falla de red, respuesta no ok o JSON sin rate numérico → null', async () => {
  assert.equal(await leerTasaRemota(async () => { throw new Error('red'); }, 'x'), null);
  assert.equal(await leerTasaRemota(async () => ({ ok: false, json: async () => REAL }), 'x'), null);
  assert.equal(await leerTasaRemota(responde({ rate: 'x' }), 'x'), null);
  assert.equal(await leerTasaRemota(responde(null), 'x'), null);
});

test('si tarda más del tope, null', async () => {
  const lento = () => new Promise(r => setTimeout(() => r({ ok: true, json: async () => REAL }), 200));
  assert.equal(await leerTasaRemota(lento, 'x', 50), null);
});
