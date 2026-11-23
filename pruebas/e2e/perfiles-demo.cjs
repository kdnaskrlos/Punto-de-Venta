// Incidencia #12: las dos entradas al cambio de perfil muestran el mismo estado.
const { casos, cambiarA, entrarComo, URL_BASE } = require('./_servidor.cjs');

async function aviso(p, rol) {
  const banner = p.locator('#aviso-demo');
  await banner.getByText(`Modo demo · ${rol}`, { exact: true }).waitFor();
  await banner.getByRole('button', { name: 'Volver a Administrador', exact: true }).waitFor();
  await p.waitForSelector('.vista[data-ruta="/inicio"]');
  return banner;
}

async function ir(p, ruta) {
  await p.evaluate(r => { location.hash = r; }, ruta);
  await p.waitForSelector(`.vista[data-ruta="${ruta}"]`);
}

casos('perfiles-demo', [
  ['Mi cuenta y Modo demo muestran el mismo rol, su banner y el regreso a Administrador', async (env, a) => {
    const p = await env.pagina({ ruta: '/ajustes' });
    a.ok(await p.locator('#aviso-demo').isHidden());
    await cambiarA(p, 'vendedora');
    const banner = await aviso(p, 'Vendedora');
    const desdeCuenta = await banner.textContent();
    a.strictEqual(await p.locator('.side [data-ruta="/ajustes"]').count(), 0);
    await banner.getByRole('button', { name: 'Volver a Administrador', exact: true }).click();
    await p.waitForFunction(() => window.__pos.ctx.sesion.usuario === 'admin');
    await banner.waitFor({ state: 'hidden' });

    await ir(p, '/ajustes');
    await p.click('#modo-demo');
    await p.click('.demo-roles [data-rol="vendedora"]');
    await aviso(p, 'Vendedora');
    a.strictEqual(await banner.textContent(), desdeCuenta);
    await cambiarA(p, 'encargada');
    await aviso(p, 'Encargada');
    await p.reload();
    await aviso(p, 'Encargada');
    await cambiarA(p, 'admin');
    await banner.waitFor({ state: 'hidden' });
    await p.waitForSelector('.side [data-ruta="/ajustes"]');
    a.deepStrictEqual(p.errores, []);
  }],
  ['En móvil, la tarjeta propia mantiene Probar como y el banner permite volver', async (env, a) => {
    const p = await env.pagina({ movil: true, ruta: '/mas' });
    await p.click('.lista-mas .fila-btn:has-text("Usuarios")');
    await p.click('.usuario[data-usuario="admin"] .u-cab');
    a.strictEqual(await p.getAttribute('#probar-admin', 'aria-pressed'), 'true');
    await p.click('#probar-encargada');
    const banner = await aviso(p, 'Encargada');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.rol()), 'encargada');
    await banner.getByRole('button', { name: 'Volver a Administrador' }).click();
    await banner.waitFor({ state: 'hidden' });
    await p.waitForFunction(() => window.__pos.ctx.sesion.usuario === 'admin');
    await ir(p, '/mas');
    await p.click('#modo-demo');
    await p.click('.demo-roles [data-rol="encargada"]');
    await aviso(p, 'Encargada');
  }],
  ['Un cambio de perfil fallido conserva la sesión, el aviso y la selección guardada', async (env, a) => {
    const p = await env.pagina({ ruta: '/ajustes' });
    await cambiarA(p, 'vendedora');
    const banner = await aviso(p, 'Vendedora');
    await p.evaluate(() => window.__pos.ctx.almacen.simularSinConexion(true));
    await p.click('.side [aria-label="Mi cuenta"]');
    await p.click('#probar-encargada');
    await p.getByText('No se pudo cambiar de perfil', { exact: true }).waitFor();
    await aviso(p, 'Vendedora');
    a.strictEqual(await p.evaluate(() => localStorage.getItem('pos-demo-usuario')), 'vendedora');
    a.strictEqual(await p.evaluate(() => window.__pos.ctx.sesion.usuario), 'vendedora');
    a.ok(await banner.isVisible());
  }],
  ['Una sesión con PIN conserva sus controles y la simulación de Admin usa una copia aislada', async (env, a) => {
    const context = await env.nav.newContext({ serviceWorkers: 'block', viewport: { width: 1530, height: 900 } });
    try {
      const p = await context.newPage();
      p.setDefaultTimeout(6000);
      // Fuerza la selección de producción sin cargar el SDK ni contactar Firebase.
      const modulo = body => ({ contentType: 'text/javascript', body });
      await p.route(URL_BASE + 'config.js', r => r.fulfill(modulo("export const firebaseConfig = { apiKey: 'prueba-local' };")));
      await p.route(URL_BASE + 'js/datos/firebase.js', r => r.fulfill(modulo(
        "import { crearMemoria } from './memoria.js'; import { semilla } from './semilla.js';" +
        "export function crearFirebase() { return crearMemoria(semilla()); }")));
      await p.goto(URL_BASE);
      await entrarComo(p, 'vendedora');
      await p.click('.side [aria-label="Mi cuenta"]');
      a.strictEqual(await p.locator('.probar, #mi-pin, #modo-demo').count(), 0);
      a.ok(await p.locator('#aviso-demo').isHidden());
      await p.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await entrarComo(p, 'admin');
      await p.click('.side [aria-label="Mi cuenta"]');
      a.strictEqual(await p.locator('.probar').count(), 0);
      a.ok(await p.locator('#mi-pin').isVisible());
      await p.keyboard.press('Escape');
      await p.locator('.hoja[aria-label="Mi cuenta"]').waitFor({ state: 'detached' });

      await ir(p, '/ajustes');
      await p.click('#modo-demo');
      await p.click('.demo-roles [data-rol="vendedora"]');
      const banner = p.locator('#aviso-demo');
      await banner.getByText('Modo demo · Vendedora', { exact: true }).waitFor();
      a.strictEqual(await banner.getByRole('button', { name: 'Volver a Administrador' }).count(), 0);
      a.ok(await p.evaluate(() => window.__pos.ctx.almacen !== window.__pos.ctx.almacenReal && window.__pos.ctx.sesion.usuario === 'demo'));
      await p.evaluate(() => window.__pos.ctx.almacen.guardarCliente({ telefono: '04140000999', nombre: 'Cliente de la simulación' }));
      await banner.getByRole('button', { name: 'Salir', exact: true }).click();
      await banner.waitFor({ state: 'hidden' });
      const restaurado = await p.evaluate(() => {
        const { sesion, almacen, almacenReal } = window.__pos.ctx;
        return [sesion.usuario, Boolean(almacenReal), almacen._estado('clientes').has('04140000999'), localStorage.getItem('pos-demo-usuario')];
      });
      a.deepStrictEqual(restaurado, ['admin', false, false, null]);
    } finally {
      await context.close();
    }
  }],
]);
