// Incidencia #7: el modo automático usa el efectivo recibido y respeta la elección manual.
const { casos } = require('./_servidor.cjs');

const modo = m => `.vuelto-moneda [data-moneda="${m}"]`;
const forma = f => `.forma[data-forma="${f}"]`;
const monto = f => `.pago[data-forma="${f}"] input`;

async function preparar(env, usuario = 'vendedora') {
  const p = await env.pagina({ usuario, caja: true, ruta: '/vender' });
  await p.evaluate(() => {
    window.__pos.ctx.carrito = {
      lineas: [{ sku: 'B-S', cantidad: 1 }],
      cliente: { nombre: 'Cliente sintético', telefono: '584121234567' },
    };
    dispatchEvent(new CustomEvent('pos:carrito'));
  });
  await p.click('[data-cobro] .cobrar');
  await p.waitForSelector('#cobrar-final:has-text("48.000")');
  return p;
}

async function pagar(p, f, cantidad) {
  await p.click(forma(f));
  await p.fill(monto(f), cantidad);
}

async function seleccionado(p, m) {
  await p.waitForSelector(`${modo(m)}[aria-pressed="true"]:enabled`);
}

casos('vuelto', [
  ['Un cobro solo en efectivo COP selecciona Todo en pesos', async (env, a) => {
    const p = await preparar(env);
    await pagar(p, 'efectivo-cop', '60.025');
    await seleccionado(p, 'COP');
    a.strictEqual(await p.textContent(modo('COP')), 'Todo en pesos');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '12.000 COP');
    a.match(await p.textContent('.barra-falta'), /Ajuste por redondeo: 25 COP/);
  }],
  ['Solo efectivo USD selecciona USD + COP y conserva el billete mínimo', async (env, a) => {
    const p = await preparar(env);
    await pagar(p, 'efectivo-usd', '20');
    await seleccionado(p, 'MIXTO');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '7,00 USD + 2.700 COP');
  }],
  ['El efectivo mixto recalcula al agregar, borrar el importe o quitar dólares', async (env, a) => {
    const p = await preparar(env);
    await pagar(p, 'efectivo-cop', '60.000');
    await seleccionado(p, 'COP');
    await p.click(forma('efectivo-usd'));
    await seleccionado(p, 'COP');
    await p.fill(monto('efectivo-usd'), '5');
    await seleccionado(p, 'MIXTO');
    await p.fill(monto('efectivo-usd'), '');
    await seleccionado(p, 'COP');
    await p.fill(monto('efectivo-usd'), '5');
    await seleccionado(p, 'MIXTO');
    await p.click(forma('efectivo-usd'));
    await p.locator(monto('efectivo-usd')).waitFor({ state:'detached' });
    await seleccionado(p, 'COP');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '12.000 COP');
  }],
  ['Nequi, Zelle y USDT cuentan como electrónicos y dejan el vuelto en COP', async (env, a) => {
    const p = await preparar(env);
    for (const [f, n] of [['transferencia-cop', '60.000'], ['zelle', '20'], ['usdt', '20']]) {
      await pagar(p, f, n);
      await seleccionado(p, 'COP');
      await p.click(forma(f));
      await p.locator(monto(f)).waitFor({ state:'detached' });
    }
    await pagar(p, 'efectivo-cop', '20.000');
    await pagar(p, 'zelle', '10');
    await seleccionado(p, 'COP');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '11.000 COP');
  }],
  ['La elección manual se conserva al editar importes y al volver a tener vuelto', async (env, a) => {
    const p = await preparar(env);
    await pagar(p, 'efectivo-usd', '20');
    await seleccionado(p, 'MIXTO');
    await p.click(modo('COP'));
    await seleccionado(p, 'COP');
    await p.fill(monto('efectivo-usd'), '25');
    await seleccionado(p, 'COP');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '49.500 COP');
    await p.fill(monto('efectivo-usd'), '10');
    await p.locator('.vuelto-moneda').waitFor({ state:'detached' });
    await p.fill(monto('efectivo-usd'), '20');
    await seleccionado(p, 'COP');
    a.strictEqual(await p.textContent('.barra-falta .monto'), '30.000 COP');
  }],
  ['Perder la tasa descarta una elección USD e impide que reaparezca al restablecerla', async (env, a) => {
    const p = await preparar(env);
    await pagar(p, 'efectivo-cop', '60.000');
    await p.click(modo('USD'));
    await seleccionado(p, 'USD');
    for (const tasa of [null, -1, 3900]) {
      await p.evaluate(copPorUsd => {
        const { ctx } = window.__pos;
        ctx.tasas = { ...ctx.tasas, copPorUsd };
        dispatchEvent(new CustomEvent('pos:datos', { detail:{ que:'tasas' } }));
      }, tasa);
      await seleccionado(p, 'COP');
      a.strictEqual(await p.locator(modo('USD')).isDisabled(), tasa !== 3900);
      a.strictEqual(await p.locator(modo('MIXTO')).isDisabled(), tasa !== 3900);
      a.strictEqual(await p.locator(forma('zelle')).isDisabled(), tasa !== 3900);
    }
    await pagar(p, 'efectivo-usd', '5');
    await seleccionado(p, 'MIXTO');
  }],
  ['Completar apartado aplica el mismo modo automático y Abonar mantiene el exceso bloqueado', async (env, a) => {
    const p = await preparar(env);
    await p.click('#cobro-apartar');
    await p.waitForSelector('text=Apartado creado');
    await p.click('.side .nav[aria-label="Apartados"]');
    await p.click('.apartado');
    await p.click('#ap-abonar');
    await pagar(p, 'efectivo-cop', '60.000');
    a.strictEqual(await p.locator('#abono-final').isDisabled(), true);
    a.strictEqual(await p.locator('.vuelto-moneda').count(), 0);
    await p.keyboard.press('Escape');
    await p.locator('#abono-final').waitFor({ state:'detached' });
    await p.click('.apartado');
    await p.click('#ap-completar');
    await pagar(p, 'efectivo-cop', '60.000');
    await seleccionado(p, 'COP');
    await p.click('#completar-final');
    await p.waitForSelector('text=Venta guardada');
    const venta = await p.evaluate(() => [...window.__pos.ctx.almacen._estado('ventas').values()][0]);
    a.strictEqual(venta.total, 48000);
    a.deepStrictEqual(venta.vuelto.partes, [{ moneda:'COP', monto:12000, forma:'efectivo-cop' }]);
  }],
  ['Caja, recibo y anulación conservan el desglose y el ajuste del vuelto', async (env, a) => {
    const p = await preparar(env, 'admin');
    await p.evaluate(() => window.__pos.ctx.almacen.guardarAjustes('general', { recibo: { plantilla: '{vuelto}' } }));
    await p.waitForFunction(() => window.__pos.ctx.ajustes.recibo?.plantilla === '{vuelto}');
    await pagar(p, 'efectivo-usd', '20');
    await seleccionado(p, 'MIXTO');
    await p.fill(monto('efectivo-usd'), '20,01');
    await seleccionado(p, 'MIXTO');
    await p.click('#cobrar-final');
    await p.waitForSelector('text=Venta exitosa');
    const enlace = await p.locator('a.recibo').getAttribute('href');
    const recibo = new URL(enlace).searchParams.get('text');
    a.match(recibo, /Vuelto: 7,00 USD \+ 2\.700 COP/);
    a.match(recibo, /Ajuste de redondeo: 39 COP/);
    const datos = await p.evaluate(async () => {
      const { esperadoCaja } = await import('/js/nucleo/caja.js');
      const { almacen, ajustes } = window.__pos.ctx;
      const [venta] = [...almacen._estado('ventas').values()];
      const caja = almacen._estado('cajas').get(venta.cajaId);
      const esperado = () => esperadoCaja(caja, [venta], [], ajustes.formasPago);
      const antes = esperado();
      const anulacion = await almacen.anularVenta(venta.id, 'Validación sintética');
      return { vuelto: venta.vuelto, antes, anulacion, despues: esperado(),
        movimientos: caja.movimientos.map(m => [m.tipo, m.forma, m.monto]) };
    });
    a.deepStrictEqual(datos.vuelto.partes, [{ moneda:'USD', monto:7, forma:'efectivo-usd' }, { moneda:'COP', monto:2700, forma:'efectivo-cop' }]);
    a.strictEqual(datos.vuelto.equivalenteCop, 30000);
    a.strictEqual(datos.vuelto.remanenteCop, 39);
    a.strictEqual(datos.antes['efectivo-usd'], 33.01);
    a.strictEqual(datos.antes['efectivo-cop'], 47300);
    a.strictEqual(datos.anulacion.ok, true);
    a.deepStrictEqual(datos.movimientos, [['salida','efectivo-usd',13.01], ['entrada','efectivo-cop',2700]]);
    a.strictEqual(datos.despues['efectivo-usd'], 20);
    a.strictEqual(datos.despues['efectivo-cop'], 50000);
  }],
]);
