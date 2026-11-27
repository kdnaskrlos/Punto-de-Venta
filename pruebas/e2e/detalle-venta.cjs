const { casos } = require('./_servidor.cjs');

async function abrir(env, venta, movil = false) {
  const p = await env.pagina({ movil });
  await p.evaluate(async v => {
    const { listaVentas } = await import('/js/vistas/ventas-rango.js');
    const lista = listaVentas({ puedeVer: () => false }, [{
      id: 'detalle-qa', numero: 'V-1000', fecha: '2026-11-27T12:00:00Z', usuario: 'admin', total: 48000, ...v,
    }]);
    document.body.append(lista);
    lista.querySelector("button").click();
  }, venta);
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
    a.match(texto, /Importe neto cobrado\s+48\.000 COP/);
    a.doesNotMatch(texto, /Ajuste por redondeo/);
    const ancho = await detalle.boundingBox();
    a.ok(ancho.x >= 0 && ancho.x + ancho.width <= p.viewportSize().width);
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
