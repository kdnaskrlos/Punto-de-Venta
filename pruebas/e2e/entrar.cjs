// Tarea 9: entrada con usuario y PIN, roles en la navegación y cerrar sesión.
const { casos, entrarComo } = require('./_servidor.cjs');

casos('entrar', [
  ['Sin sesión se ve la pantalla de entrada', async (env, a) => {
    const p = await env.pagina({ usuario: null, query: '?demo&entrar' });
    a.ok(await p.$('#entrar-usuario'));
    a.strictEqual(await p.getAttribute('#entrar-pin', 'inputmode'), 'numeric');
    a.strictEqual(await p.getAttribute('#entrar-pin', 'maxlength'), '4');
    a.strictEqual(await p.$('.side .nav'), null);
  }],
  ['PIN incorrecto muestra el error bajo el campo', async (env, a) => {
    const p = await env.pagina({ usuario: null, query: '?demo&entrar' });
    await p.fill('#entrar-usuario', 'vendedora'); await p.fill('#entrar-pin', '9999'); await p.click('#entrar-btn');
    await p.waitForSelector('.campo .error:text("PIN incorrecto")');
  }],
  ['Usuario que no existe y PIN corto', async (env, a) => {
    const p = await env.pagina({ usuario: null, query: '?demo&entrar' });
    await p.fill('#entrar-usuario', 'nadie'); await p.fill('#entrar-pin', '1234'); await p.click('#entrar-btn');
    await p.waitForSelector('.campo .error:text("Ese usuario no existe")');
    await p.fill('#entrar-usuario', 'vendedora'); await p.fill('#entrar-pin', '12'); await p.click('#entrar-btn');
    await p.waitForSelector('.campo .error:text("El PIN debe tener 4 números")');
  }],
  ['La vendedora no ve Ajustes; el administrador sí', async (env, a) => {
    const v = await env.pagina({ usuario: 'vendedora' });
    a.strictEqual(await v.$('.side .nav[aria-label="Ajustes"]'), null);
    const ad = await env.pagina({ usuario: 'admin' });
    a.ok(await ad.$('.side .nav[aria-label="Ajustes"]'));
  }],
  ['Teléfono: Más → Cerrar sesión vuelve a la entrada', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: 'encargada', query: '?demo&entrar' });
    await p.click('.side .nav[aria-label="Más"]');
    await p.click('.lista-mas .fila-btn:has-text("Mi cuenta")');
    await p.click('text=Cerrar sesión');
    await p.waitForSelector('#entrar-usuario');
  }],
  ['PC: Mi cuenta → Cerrar sesión', async (env, a) => {
    const p = await env.pagina({ usuario: 'vendedora', query: '?demo&entrar' });
    await p.click('.side [aria-label="Mi cuenta"]');
    await p.click('text=Cerrar sesión');
    await p.waitForSelector('#entrar-usuario');
    await entrarComo(p, 'admin');
    a.ok(await p.$('.side .nav[aria-label="Ajustes"]'));
  }],
  ['Demostración: entra directo como administrador, sin pedir datos', async (env, a) => {
    const p = await env.pagina({ usuario: null });
    await p.waitForSelector('.side .nav[aria-label="Ajustes"]');
    a.strictEqual(await p.$('#entrar-usuario'), null);
  }],
  ['Demostración: "Probar como" cambia de rol sin PIN, lo recuerda al recargar y no ofrece cerrar sesión', async (env, a) => {
    const p = await env.pagina({ ancho: 360, alto: 780, usuario: null });
    await p.waitForSelector('.side .nav');
    await p.click('.side .nav[aria-label="Más"]');
    await p.click('.lista-mas .fila-btn:has-text("Usuarios")');
    a.strictEqual(await p.$('text=Cerrar sesión'), null);
    await p.click('#probar-vendedora');
    await p.waitForFunction(() => window.__pos.ctx.sesion?.rol === 'vendedora');
    await p.reload();
    await p.waitForFunction(() => window.__pos.ctx.sesion?.rol === 'vendedora', null, { timeout: 5000 });
    a.strictEqual(await p.$('#entrar-usuario'), null);
  }],
]);
