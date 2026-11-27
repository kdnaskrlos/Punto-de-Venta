const { casos } = require('./_servidor.cjs');

async function abrir(env, venta, movil = false, cajas = []) {
  const p = await env.pagina({ movil });
  await p.evaluate(async ({ v, cajas }) => {
    const { listaVentas } = await import('/js/vistas/ventas-rango.js');
    const lista = listaVentas({ puedeVer: () => false, almacen: { escuchar(nombre, cb) {
      if (nombre === 'cajas') cb(cajas);
      return () => {};
    } } }, [{
      id: 'detalle-qa', numero: 'V-1000', fecha: '2026-11-27T12:00:00Z', usuario: 'admin', total: 48000, ...v,
    }]);
    document.body.append(lista);
    lista.querySelector("button").click();
  }, { v: venta, cajas });
  const detalle = p.locator('.detalle-venta');
  return { p, detalle };
}

casos('detalle histórico de ventas', [
  ['PC muestra pagos mixtos, vuelto y neto con la conversión original', async (env, a) => {
    const { detalle } = await abrir(env, {
      pagos: [{ nombre: 'Efectivo dólares', moneda: 'USD', monto: 15, equivalenteCop: 60000 },
        { nombre: 'Nequi', moneda: 'COP', monto: 625 }],
      tasas: { copPorUsd: 4000 },
      vuelto: { partes: [{ moneda: 'USD', monto: 3 }, { moneda: 'COP', monto: 600 }], equivalenteCop: 12600, remanenteCop: 25 },
    });
    const texto = await detalle.innerText();
    for (const r of [/Total de la venta\s+48\.000 COP/, /Efectivo dólares\s+15,00 USD/, /Nequi\s+625 COP/,
      /Vuelto entregado\s+USD\s+−3,00\s+COP\s+−600/, /Equivalente en COP\s+12\.600 COP/,
      /Ajuste por redondeo\s+25 COP/, /Importe neto cobrado\s+48\.025 COP/]) a.match(texto, r);
  }],
  ['Móvil conserva el vuelto histórico y señala una venta anulada', async (env, a) => {
    const { p, detalle } = await abrir(env, {
      estado: 'anulada', anulacion: { motivo: 'Prueba de anulación' },
      pagos: [{ nombre: 'Efectivo dólares', moneda: 'USD', monto: 13 }],
      tasas: { copPorUsd: 4000 }, vuelto: { moneda: 'USD', monto: 1 },
    }, true);
    const texto = await detalle.innerText();
    a.match(texto, /Anulada/);
    a.match(texto, /Motivo: Prueba de anulación/);
    a.match(texto, /Equivalente en COP\s+4\.000 COP/);
    a.match(texto, /Importe neto original\s+48\.000 COP/);
    a.match(texto, /COP por USD\s+4\.000/);
    a.match(texto, /Importe neto final\s+No disponible/);
    a.doesNotMatch(texto, /Ajuste por redondeo/);
    const ancho = await detalle.boundingBox();
    a.ok(ancho.x >= 0 && ancho.x + ancho.width <= p.viewportSize().width);
  }],
  ['Muestra la devolución asociada y el neto final con las tasas originales', async (env, a) => {
    const fecha = '2026-11-27T12:30:00Z';
    const mov = { motivo: 'anulación V-1000', usuario: 'admin', fecha };
    const { detalle } = await abrir(env, {
      estado: 'anulada', anulacion: { motivo: 'Prueba', por: 'admin', fecha },
      pagos: [{ forma: 'zelle', nombre: 'Zelle', moneda: 'USD', monto: 13 },
        { forma: 'nequi', nombre: 'Nequi', moneda: 'COP', monto: 1000 }],
      vuelto: { partes: [{ forma: 'efectivo-cop', moneda: 'COP', monto: 5000 }] },
      tasas: { copPorUsd: 4000 },
    }, false, [{ movimientos: [
      { ...mov, tipo: 'salida', forma: 'zelle', monto: 13 },
      { ...mov, tipo: 'salida', forma: 'nequi', monto: 1000 },
      { ...mov, tipo: 'entrada', forma: 'efectivo-cop', monto: 5000 },
      { ...mov, tipo: 'salida', forma: 'nequi', monto: 11000, usuario: 'otra' },
      { ...mov, tipo: 'salida', forma: 'nequi', monto: 12000, fecha: '2026-11-27T13:00:00Z' },
      { ...mov, tipo: 'salida', forma: 'nequi', monto: 13000, motivo: 'anulación V-1001' },
    ] }]);
    const texto = await detalle.innerText();
    for (const patron of [/Importe neto original\s+48\.000 COP/, /Zelle\s+−13,00 USD/, /Nequi\s+−1\.000 COP/,
      /efectivo-cop · Entrada\s+\+5\.000 COP/, /Devolución neta en COP\s+48\.000 COP/,
      /Importe neto final\s+0 COP/]) a.match(texto, patron);
    a.doesNotMatch(texto, /11\.000|12\.000|13\.000|Sin movimientos/);
  }],
  ['Un redondeo sin efectivo entregado y una tasa histórica ausente se muestran sin inventar un valor', async (env, a) => {
    const { detalle } = await abrir(env, {
      pagos: [{ nombre: 'Efectivo dólares', moneda: 'USD', monto: 15 }],
      vuelto: { partes: [], equivalenteCop: 0, remanenteCop: 20 },
    });
    const texto = await detalle.innerText();
    a.doesNotMatch(texto, /Vuelto entregado/);
    a.match(texto, /Ajuste por redondeo\s+20 COP/);
    a.match(texto, /Importe neto cobrado\s+No disponible/);
  }],
]);
