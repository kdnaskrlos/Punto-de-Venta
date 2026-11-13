// Modo prueba (como en Pedidos): datos de ejemplo marcados con demo:true para ver la app llena.
// Se pueden quitar sin tocar los datos reales.
const NOMBRES = ['María González', 'José Rodríguez', 'Luisa Fernández', 'Pedro Ramírez', 'Carmen Díaz', 'Andrés Mora', 'Valentina Rojas', 'Diego Herrera', 'Gabriela Suárez', 'Ricardo Peña'];

// Generador con semilla: siempre los mismos ejemplos.
function azar(semilla) { let x = semilla >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

const PRODUCTOS_EJEMPLO = [
  ['Franela Oversize', 'Negro', 'XO-N', ['S', 'M', 'L', 'XL'], [35000, 33000, 31000, 29000, 27000], 14000, 'Caballero'],
  ['Franela Oversize', 'Blanco', 'XO-B', ['S', 'M', 'L', 'XL'], [35000, 33000, 31000, 29000, 27000], 14000, 'Dama'],
  ['Buzo Capucha', 'Gris', 'XB-G', ['S', 'M', 'L', 'XL'], [65000, 62000, 59000, 56000, 53000], 30000, 'Caballero'],
  ['Short Deportivo', 'Azul', 'XS-A', ['M', 'L', 'XL'], [28000, 26000, 24000, 22000, 20000], 11000, 'Caballero'],
  ['Body Bebé', 'Celeste', 'XY-C', ['3m', '6m', '9m'], [19000, 18000, 17000, 16000, 15000], 7500, 'Bebé'],
  ['Franela Niño', 'Rojo', 'XN-R', ['4', '6', '8', '10'], [24000, 23000, 21500, 20000, 18500], 9000, 'Niño'],
];

export function generarEjemplos({ productos = {}, formas = [], tasas = {}, ahora = new Date() } = {}) {
  const r = azar(20261112);
  const elegir = l => l[Math.floor(r() * l.length)];
  const demo = { demo: true };
  const lote = { productos: [], costos: [], clientes: [], ventas: [], apartados: [] };

  // Productos: los reales si hay suficientes; si no, se agregan de ejemplo.
  let vars = Object.values(productos).filter(p => p.activo !== false && p.precios?.[0]);
  if (new Set(vars.map(p => p.grupo)).size < 4) {
    for (const [producto, color, abrev, tallas, precios, costo, categoria] of PRODUCTOS_EJEMPLO) {
      for (const talla of tallas) {
        const sku = `${abrev}-${talla}`;
        const p = { sku, nombre: `${producto} ${talla} ${color}`, producto, color, talla, grupo: `${producto} ${color}`, categoria, marca: 'Ejemplo', codigo: `99${sku}`,
          precios, separado: false, comisiones: null, existencia: Math.floor(r() * 12) + 1, minimo: 2, foto: null, oferta: null, activo: true, ...demo };
        lote.productos.push(p);
        lote.costos.push({ sku, costo, historial: [{ costo, desde: '2026-01-01T00:00:00.000Z' }], ...demo });
      }
    }
    vars = [...vars, ...lote.productos];
  }

  lote.clientes = NOMBRES.map((nombre, i) => ({ telefono: `58412${String(5550100 + i * 37).padStart(7, '0')}`, nombre, ...demo }));
  const activas = formas.filter(f => f.activa !== false && (f.moneda !== 'BS' || tasas.bsPorUsd) && (f.moneda === 'COP' || tasas.copPorUsd));
  const pago = total => {
    const f = activas.length ? elegir(activas) : { id: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP' };
    const usd = tasas.copPorUsd ? total / tasas.copPorUsd : 0;
    const monto = f.moneda === 'COP' ? total : f.moneda === 'USD' ? Math.round(usd * 100) / 100 : Math.round(usd * tasas.bsPorUsd * 100) / 100;
    return { forma: f.id, nombre: f.nombre, moneda: f.moneda, monto, equivalenteCop: total };
  };
  const lineas = () => {
    const n = 1 + Math.floor(r() * 3);
    const usadas = new Map();
    for (let i = 0; i < n; i++) { const p = elegir(vars); usadas.set(p.sku, (usadas.get(p.sku) || 0) + 1 + (r() < 0.2 ? 1 : 0)); }
    return [...usadas].map(([sku, cantidad]) => {
      const p = vars.find(x => x.sku === sku);
      return { sku, nombre: `${p.producto}${p.color ? ' ' + p.color : ''}`, talla: p.talla || '', cantidad, tramo: 0, precioUnit: p.precios[0], subtotal: p.precios[0] * cantidad, oferta: null, descuento: 0, comision: 2000 * cantidad, reducida: false };
    });
  };
  const hace = (dias, hora) => { const d = new Date(ahora); d.setDate(d.getDate() - dias); d.setHours(hora, Math.floor(r() * 60), 0, 0); return d.toISOString(); };
  const vendedores = ['vendedora', 'vendedora', 'vendedora', 'encargada', 'admin'];

  // 45 ventas en los últimos 30 días (varias hoy), cada una con su cliente y forma de pago.
  for (let i = 0; i < 45; i++) {
    const dias = i < 6 ? 0 : Math.floor(r() * 30);
    if (dias === 0 && i >= 6) continue;
    const ls = lineas();
    const subtotal = ls.reduce((s, l) => s + l.subtotal, 0);
    const conDesc = r() < 0.12;
    const desc = conDesc ? Math.round(subtotal * 0.05 / 100) * 100 : 0;
    const total = subtotal - desc;
    const cli = elegir(lote.clientes);
    const fecha = hace(dias, i < 6 ? 9 + i : 9 + Math.floor(r() * 10));
    lote.ventas.push({ id: `demo-v${String(i + 1).padStart(3, '0')}`, numero: `D-${String(i + 1).padStart(4, '0')}`, fecha, creada: fecha,
      cliente: { nombre: cli.nombre, telefono: cli.telefono }, lineas: ls, subtotal,
      descuento: conDesc ? { tipo: 'monto', valor: desc, monto: desc, autorizadoPor: 'admin' } : null,
      total, pagos: [pago(total)], vuelto: null, tasas: { copPorUsd: tasas.copPorUsd || null, bsPorUsd: tasas.bsPorUsd || null, fuenteBs: tasas.fuenteBs || null },
      usuario: elegir(vendedores), uid: 'demo', cajaId: 'demo', estado: i === 20 ? 'anulada' : 'ok', offline: false, ...demo,
      ...(i === 20 ? { anulacion: { por: 'admin', motivo: 'Ejemplo de venta anulada', fecha } } : {}) });
  }

  // Apartados: pendientes (uno con más de 15 días), un completado y un cancelado.
  const estados = [['pendiente', 2, 0.3], ['pendiente', 5, 0.6], ['pendiente', 9, 0], ['pendiente', 20, 0.4], ['completado', 12, 1], ['cancelado', 25, 0.2]];
  estados.forEach(([estado, dias, parte], i) => {
    const ls = lineas();
    const total = ls.reduce((s, l) => s + l.subtotal, 0);
    const abonado = Math.round(total * parte / 1000) * 1000;
    const cli = lote.clientes[(i + 3) % lote.clientes.length];
    const fecha = hace(dias, 11);
    lote.apartados.push({ id: `demo-a${i + 1}`, fecha, creada: fecha, cliente: { nombre: cli.nombre, telefono: cli.telefono }, lineas: ls, subtotal: total, descuento: null, total,
      abonos: abonado ? [{ ...pago(abonado), id: `demo-a${i + 1}-1`, cajaId: 'demo', usuario: 'vendedora', fecha }] : [],
      saldo: estado === 'completado' ? 0 : total - abonado, usuario: 'vendedora', uid: 'demo', estado, offline: false, ...demo,
      ...(estado === 'cancelado' ? { cancelacion: { por: 'admin', motivo: 'Ejemplo', fecha } } : {}) });
  });
  return lote;
}
