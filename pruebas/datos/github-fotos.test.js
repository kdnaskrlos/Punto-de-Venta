import { test } from 'node:test';
import assert from 'node:assert/strict';
import { subirFotoGitHub } from '../../js/datos/github-fotos.js';

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });

function falsoFetch(respuestas) {
  const llamadas = [];
  const f = async (url, op = {}) => { llamadas.push({ url, ...op }); const r = respuestas.shift(); return { ok: r.status < 300, status: r.status, json: async () => r.cuerpo || {} }; };
  f.llamadas = llamadas;
  return f;
}

test('archivo nuevo: PUT sin sha, contenido en base64', async () => {
  const f = falsoFetch([{ status: 404 }, { status: 201 }]);
  const r = await subirFotoGitHub({ token: 't', repo: 'kdnaskrlos/Punto-de-Venta', ruta: 'fotos/x.webp', blob, fetchFn: f });
  assert.deepEqual(r, { ok: true, ruta: 'fotos/x.webp' });
  const put = f.llamadas[1];
  assert.equal(put.method, 'PUT');
  assert.match(put.url, /repos\/kdnaskrlos\/Punto-de-Venta\/contents\/fotos\/x\.webp$/);
  const cuerpo = JSON.parse(put.body);
  assert.equal(cuerpo.content, 'AQID');
  assert.ok(!('sha' in cuerpo));
  assert.equal(put.headers.Authorization, 'Bearer t');
});

test('archivo existente: usa su sha para no repetir el error 422', async () => {
  const f = falsoFetch([{ status: 200, cuerpo: { sha: 'abc' } }, { status: 200 }]);
  await subirFotoGitHub({ token: 't', repo: 'o/r', ruta: 'fotos/x.webp', blob, fetchFn: f });
  assert.equal(JSON.parse(f.llamadas[1].body).sha, 'abc');
});

test('token inválido o error: ok false con el motivo', async () => {
  assert.deepEqual(await subirFotoGitHub({ token: 't', repo: 'o/r', ruta: 'a', blob, fetchFn: falsoFetch([{ status: 401 }]) }), { ok: false, error: 'token' });
  assert.deepEqual(await subirFotoGitHub({ token: 't', repo: 'o/r', ruta: 'a', blob, fetchFn: falsoFetch([{ status: 404 }, { status: 409 }]) }), { ok: false, error: 'github-409' });
  assert.deepEqual(await subirFotoGitHub({ token: '', repo: 'o/r', ruta: 'a', blob, fetchFn: falsoFetch([]) }), { ok: false, error: 'token' });
});
