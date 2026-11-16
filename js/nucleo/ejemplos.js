import { claveGrupo, tituloProducto } from './importar.js';
import { nombreVenta } from './producto.js';
import { tramoDe, precioDeTramo, LIMITES_DEFECTO } from './tramos.js';
import { comisionLinea } from './comisiones.js';
import { esperadoCaja, diferenciasCierre } from './caja.js';

// v2.31 · Vendedora simulada: el Modo prueba la llena como si llevara días trabajando (ventas, cajas con
// arqueo, apartados con abonos y una semana de comisión pagada). No puede entrar a la app: solo existe como ejemplo.
export const VENDEDORA_PRUEBA = { uid: 'demo-vendedora', usuario: 'prueba', nombre: 'Vendedora prueba', rol: 'vendedora', activo: true, ganaComision: true };
// Modo prueba (como en Pedidos): datos de ejemplo marcados con demo:true para ver la app llena.
// Se pueden quitar sin tocar los datos reales.
const NOMBRES = ['María González', 'José Rodríguez', 'Luisa Fernández', 'Pedro Ramírez', 'Carmen Díaz', 'Andrés Mora', 'Valentina Rojas', 'Diego Herrera', 'Gabriela Suárez', 'Ricardo Peña'];

// Generador con semilla: siempre los mismos ejemplos.
function azar(semilla) { let x = semilla >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// [tipo, modelo, color, abreviatura, tallas, precios, costo, género]
const PRODUCTOS_EJEMPLO = [
  ['Franela', 'Oversize', 'Negro', 'XO-N', ['S', 'M', 'L', 'XL'], [35000, 33000, 31000, 29000, 27000], 14000, 'Caballero'],
  ['Franela', 'Oversize', 'Blanco', 'XO-B', ['S', 'M', 'L', 'XL'], [35000, 33000, 31000, 29000, 27000], 14000, 'Dama'],
  ['Buzo', 'Capucha', 'Gris', 'XB-G', ['S', 'M', 'L', 'XL'], [65000, 62000, 59000, 56000, 53000], 30000, 'Caballero'],
  ['Short', 'Deportivo', 'Azul', 'XS-A', ['M', 'L', 'XL'], [28000, 26000, 24000, 22000, 20000], 11000, 'Caballero'],
  ['Body', 'Bebé', 'Celeste', 'XY-C', ['3m', '6m', '9m'], [19000, 18000, 17000, 16000, 15000], 7500, 'Unisex'],
  ['Franela', 'Manga Corta', 'Rojo', 'XN-R', ['4', '6', '8', '10'], [24000, 23000, 21500, 20000, 18500], 9000, 'Niño'],
];

export function generarEjemplos({ productos = {}, formas = [], tasas = {}, ahora = new Date(), yo = 'admin', limites = LIMITES_DEFECTO } = {}) {
  const r = azar(20261112);
  const elegir = l => l[Math.floor(r() * l.length)];
  const demo = { demo: true };
  const lote = { productos: [], costos: [], clientes: [], ventas: [], apartados: [], usuarios: [], cajas: [], comisiones: [] };

  // Productos: los reales si hay suficientes; si no, se agregan de ejemplo.
  let vars = Object.values(productos).filter(p => p.activo !== false && p.precios?.[0]);
  if (new Set(vars.map(p => p.grupo)).size < 4) {
    for (const [tipo, modelo, color, abrev, tallas, precios, costo, genero] of PRODUCTOS_EJEMPLO) {
      for (const talla of tallas) {
        const sku = `${abrev}-${talla}`;
        const base = { sku, nombre: `${tipo} Ejemplo ${genero} ${talla} ${color}`, tipo, tela: '', color, talla, genero, marca: 'Ejemplo', modelo, codigo: '',
          precios, separado: false, existencia: Math.floor(r() * 12) + 1, minimo: 2, foto: null, oferta: null, activo: true, ...demo };
        const p = { ...base, grupo: claveGrupo(base), titulo: tituloProducto(base) };
        lote.productos.push(p);
        lote.costos.push({ sku, costo, historial: [{ costo, desde: '2026-01-01T00:00:00.000Z' }], ...demo });
      }
    }
    vars = [...vars, ...lote.productos];
  }

  lote.clientes = NOMBRES.map((nombre, i) => ({ telefono: `58412${String(5550100 + i * 37).padStart(7, '0')}`, nombre, ...demo }));
  // Sin efectivo en dólares: en efectivo no hay centavos (v2.31); se paga con pesos, transferencias, USDT o Bs.
  const activas = formas.filter(f => f.activa !== false && !(f.moneda === 'USD' && /efectivo/i.test(f.id + f.nombre)) && (f.moneda !== 'BS' || tasas.bsPorUsd) && (f.moneda === 'COP' || tasas.copPorUsd));
  const pago = total => {
    const f = activas.length ? elegir(activas) : { id: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP' };
    const usd = tasas.copPorUsd ? total / tasas.copPorUsd : 0;
    const monto = f.moneda === 'COP' ? total : f.moneda === 'USD' ? Math.round(usd * 100) / 100 : Math.round(usd * tasas.bsPorUsd * 100) / 100;
    return { forma: f.id, nombre: f.nombre, moneda: f.moneda, monto, equivalenteCop: total };
  };
  // Precio y comisión por tramo, con la cantidad total del pedido (regla del mix).
  const lineas = () => {
    const n = 1 + Math.floor(r() * 3);
    const usadas = new Map();
    for (let i = 0; i < n; i++) { const p = elegir(vars); usadas.set(p.sku, (usadas.get(p.sku) || 0) + 1 + (r() < 0.25 ? 1 + Math.floor(r() * 4) : 0)); }
    const total = [...usadas.values()].reduce((a, b) => a + b, 0), tramo = tramoDe(total, limites);
    return [...usadas].map(([sku, cantidad]) => {
      const p = vars.find(x => x.sku === sku), precioUnit = precioDeTramo(p.precios, tramo) || p.precios[0], subtotal = precioUnit * cantidad;
      return { sku, nombre: nombreVenta(p), talla: p.talla || '', cantidad, tramo, precioUnit, subtotal, oferta: null, descuento: 0, comision: comisionLinea({ tramo, cantidad, subtotal }, p), reducida: false };
    });
  };
  const hace = (dias, hora, min) => { const d = new Date(ahora); d.setDate(d.getDate() - dias); d.setHours(hora, min ?? Math.floor(r() * 60), 0, 0); return d.toISOString(); };
  const V = VENDEDORA_PRUEBA;
  lote.usuarios.push({ ...V, creado: hace(40, 9, 0), ...demo });

  // Una caja por día trabajado (últimos 14 días, sin domingos); la de hoy queda abierta.
  const dias = [];
  for (let d = 13; d >= 0; d--) { const f = new Date(ahora); f.setDate(f.getDate() - d); if (f.getDay() !== 0 || d === 0) dias.push(d); }
  let nVenta = 0;
  const efectivo = monedas => formas.find(f => f.moneda === monedas && /efectivo/i.test(f.id + f.nombre)) || formas.find(f => f.moneda === monedas);
  for (const d of dias) {
    const cajaId = `demo-c${String(d).padStart(2, '0')}`;
    const caja = { id: cajaId, uid: V.uid, usuario: V.usuario, tipo: 'tienda', abierta: hace(d, 8, 30), fondo: { COP: 50000, USD: 10, BS: 0 }, movimientos: [], estado: d === 0 ? 'abierta' : 'cerrada', ...demo };
    if (r() < 0.35 && efectivo('COP')) caja.movimientos.push({ tipo: 'salida', forma: efectivo('COP').id, moneda: 'COP', monto: [5000, 8000, 15000][Math.floor(r() * 3)], motivo: elegir(['Almuerzo', 'Bolsas', 'Pago de luz', 'Transporte']), usuario: V.usuario, fecha: hace(d, 13) });
    // Ventas del día: casi todas de la vendedora; alguna tuya (sin caja de tienda).
    const nDia = d === 0 ? 4 : 2 + Math.floor(r() * 4);
    const ventasCaja = [];
    for (let k = 0; k < nDia; k++) {
      nVenta++;
      const mia = r() < 0.12;
      const ls = lineas();
      const subtotal = ls.reduce((s2, l) => s2 + l.subtotal, 0);
      const conDesc = !mia && r() < 0.1;
      const desc = conDesc ? Math.round(subtotal * 0.05 / 100) * 100 : 0;
      if (conDesc) for (const l of ls) if (l.tramo === 0) { l.comision = comisionLinea(l, vars.find(x => x.sku === l.sku), undefined, true); l.reducida = true; }
      const total = subtotal - desc;
      const cli = elegir(lote.clientes);
      const fecha = hace(d, 9 + Math.floor((k + 1) * 9 / (nDia + 1)));
      const v = { id: `demo-v${String(nVenta).padStart(3, '0')}`, numero: `D-${String(nVenta).padStart(4, '0')}`, fecha, creada: fecha,
        cliente: { nombre: cli.nombre, telefono: cli.telefono }, lineas: ls, subtotal,
        descuento: conDesc ? { tipo: 'monto', valor: desc, monto: desc, autorizadoPor: yo } : null,
        total, pagos: [pago(total)], vuelto: null, tasas: { copPorUsd: tasas.copPorUsd || null, bsPorUsd: tasas.bsPorUsd || null, fuenteBs: tasas.fuenteBs || null },
        usuario: mia ? yo : V.usuario, uid: mia ? 'demo' : V.uid, cajaId: mia ? 'demo' : cajaId, estado: 'ok', offline: false, ...demo };
      if (nVenta === 7) Object.assign(v, { estado: 'anulada', anulacion: { por: yo, motivo: 'Ejemplo de venta anulada', fecha } });
      lote.ventas.push(v);
      if (!mia) ventasCaja.push(v);
    }
    caja._ventas = ventasCaja; caja._d = d;
    lote.cajas.push(caja);
  }

  // Apartados de la vendedora: pendientes con abonos en días distintos, uno de más de 15 días, uno completado y uno cancelado.
  const estados = [['pendiente', 2, [0.3]], ['pendiente', 6, [0.2, 0.2]], ['pendiente', 9, []], ['pendiente', 18, [0.25, 0.15]], ['completado', 12, [0.5, 0.5]], ['cancelado', 25, [0.2]]];
  const cajaDe = d => lote.cajas.find(c => c.id === `demo-c${String(Math.min(d, 13)).padStart(2, '0')}`)?.id || 'demo';
  estados.forEach(([estado, d0, partes], i) => {
    const ls = lineas();
    const total = ls.reduce((s2, l) => s2 + l.subtotal, 0);
    const cli = lote.clientes[(i + 3) % lote.clientes.length];
    const fecha = hace(d0, 11);
    const abonos = partes.map((parte, k) => { const d = Math.max(0, d0 - k * 3), monto = Math.round(total * parte / 1000) * 1000;
      return { ...pago(monto), id: `demo-a${i + 1}-${k + 1}`, cajaId: cajaDe(d), usuario: V.usuario, fecha: hace(d, 12 + k) }; }).filter(a => a.monto > 0);
    const abonado = abonos.reduce((s2, a) => s2 + a.equivalenteCop, 0);
    lote.apartados.push({ id: `demo-a${i + 1}`, fecha, creada: fecha, cliente: { nombre: cli.nombre, telefono: cli.telefono }, lineas: ls, subtotal: total, descuento: null, total,
      abonos, saldo: estado === 'completado' ? 0 : Math.max(0, total - abonado), usuario: V.usuario, uid: V.uid, estado, offline: false, ...demo,
      ...(estado === 'cancelado' ? { cancelacion: { por: yo, motivo: 'El cliente no volvió', fecha: hace(d0 - 10, 10) } } : {}) });
  });

  // Cierres (después de los apartados, para contar también sus abonos): casi siempre cuadra; a veces sobra o falta un poco.
  for (const caja of lote.cajas) {
    const d = caja._d, ventasCaja = caja._ventas; delete caja._d; delete caja._ventas;
    const abonosCaja = lote.apartados.flatMap(a => a.abonos.filter(x => x.cajaId === caja.id));
    if (d > 0) {
      const esp = esperadoCaja(caja, ventasCaja, abonosCaja, formas);
      const usadas = Object.fromEntries(Object.entries(esp).filter(([, n]) => n));
      const contado = { ...usadas };
      const efe = efectivo('COP')?.id, azarCierre = r();
      let nota = '';
      if (efe && azarCierre < 0.15) { contado[efe] = (contado[efe] || 0) - 2000; nota = 'Faltaron 2.000, vuelto mal dado'; }
      else if (efe && azarCierre < 0.27) { contado[efe] = (contado[efe] || 0) + 1000; nota = 'Sobraron 1.000'; }
      const calc = diferenciasCierre(usadas, contado, formas, tasas);
      caja.cierre = { contado, filas: calc.filas, totalEsperadoCop: calc.totalEsperadoCop, totalContadoCop: calc.totalContadoCop, totalCop: calc.totalCop, nota, fecha: hace(d, 19, 10) };
    }
  }

  // Comisión de la semana pasada ya pagada (las ventas de 7 a 13 días atrás).
  const desdeDia = d => hace(d, 0, 0).slice(0, 10);
  const pagadas = lote.ventas.filter(v => v.usuario === V.usuario && v.estado === 'ok' && v.fecha >= hace(13, 0, 0) && v.fecha < hace(6, 0, 0));
  if (pagadas.length) lote.comisiones.push({ id: 'demo-com1', vendedor: V.usuario, desde: desdeDia(13), hasta: desdeDia(7), monto: pagadas.reduce((s2, v) => s2 + v.lineas.reduce((t, l) => t + (l.comision || 0), 0), 0),
    ventas: pagadas.map(v => v.id), por: yo, fecha: hace(6, 18, 0), ...demo });
  return lote;
}
