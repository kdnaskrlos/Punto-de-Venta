const assert = require('node:assert/strict');
const { test } = require('node:test');
const { arrancar, URL_BASE } = require('./_servidor.cjs');
async function agregar(pagina, talla, sku) {
  const grupo='Buzo Etanol Caballero Gris';
  await pagina.fill('#buscar', grupo);
  await pagina.click('.tarjeta-prenda[data-nombre="'+grupo+'"]');
  await pagina.click('.capa .talla-mas[data-talla="'+talla+'"]');
  await pagina.click('#tallas-agregar');
  await pagina.waitForSelector('.linea[data-sku="'+sku+'"]');
}
test('v2.43 recupera el segundo carrito visible tras cerrar su pestaña',async t=>{
  const env=await arrancar();
  t.after(()=>env.cerrar());
  const primera=await env.pagina({usuario:'admin',caja:true,ruta:'/vender'});
  const ctx=primera.context();
  const abrir=async()=>{
    const p=await ctx.newPage();
    await p.goto(URL_BASE+'?demo#/vender');
    await p.waitForSelector('#app[data-listo="1"] .vista[data-ruta="/vender"]');
    return p;
  };
  const segunda=await abrir();
  await segunda.waitForTimeout(900);
  await agregar(primera,'M','B-M');
  await agregar(segunda,'S','B-S');
  const capturar=p=>p.evaluate(()=>window.__pos.ctx.carrito.lineas.map(l=>l.sku));
  const visibles=await Promise.all([capturar(primera),capturar(segunda)]);
  assert.deepEqual(visibles,[['B-M'],['B-S']]);
  await segunda.close();
  const tercera=await abrir();
  await tercera.waitForSelector('#retomar-si');
  await tercera.click('#retomar-si');
  const recuperado=await capturar(tercera);
  console.log('Carritos visibles antes del cierre:',JSON.stringify(visibles),'Carrito ofrecido al reabrir la segunda pestaña:',JSON.stringify(recuperado));
  assert.deepEqual(recuperado,['B-S'],'la segunda venta en curso debe poder retomarse');
});
