// Datos de demostración: los productos de los bocetos y tres usuarios con PIN 1234.
import { FORMAS_PAGO_DEFECTO } from '../nucleo/formas.js';
import { COMISIONES_DEFECTO } from '../nucleo/comisiones.js';
import { LIMITES_DEFECTO } from '../nucleo/tramos.js';

const cm = (valor, reducida) => ({ tipo: 'Fijo', valor, reducida });
const COMS = [cm(4000, 2000), cm(2000, 1000), cm(1000, 500), cm(1000, 500), null];
let consecutivo = 0;

function variantes({ producto, color, abrev, tallas, precios, costo, categoria, marca, existencia, minimo = 2, separado = false }) {
  return tallas.map((talla, i) => ({
    sku: `${abrev}-${talla}`, nombre: `${producto} ${talla} ${color}`, producto, color, talla, grupo: `${producto} ${color}`,
    categoria, marca, codigo: String(770000000000 + (++consecutivo) * 37), precios, separado,
    comisiones: COMS, existencia: Array.isArray(existencia) ? existencia[i] : existencia, minimo, foto: null, oferta: null, activo: true,
    _costo: costo,
  }));
}

export function semilla() {
  consecutivo = 0;
  const productos = [
    ...variantes({ producto: 'Franela AS Niño', color: 'Blanco', abrev: 'F-B', tallas: ['4', '6', '8', '10'], precios: [25000, 24000, 22500, 20000, null], costo: 9000, categoria: 'Niño', marca: 'AS', existencia: 12, minimo: 5 }),
    ...variantes({ producto: 'Franela AS Niño', color: 'Negro', abrev: 'F-N', tallas: ['4', '6', '8', '10'], precios: [25000, 24000, 22500, 20000, null], costo: 9000, categoria: 'Niño', marca: 'AS', existencia: 12, minimo: 5 }),
    ...variantes({ producto: 'Buzo Etanol', color: 'Gris', abrev: 'B', tallas: ['S', 'M', 'L'], precios: [48000, 45000, 42000, 40000, 38000], costo: 20000, categoria: 'Caballero', marca: 'Etanol', existencia: [3, 2, 1] }),
    ...variantes({ producto: 'Body Bebé Serfe', color: 'Rosa', abrev: 'Y', tallas: ['3m', '6m', '9m'], precios: [18000, 17000, 16000, 15000, 14000], costo: 7000, categoria: 'Bebé', marca: 'Serfe', existencia: 6, separado: true }),
    ...variantes({ producto: 'Jogger Texcol', color: 'Negro', abrev: 'J', tallas: ['S', 'M', 'L', 'XL', 'XXL'], precios: [42000, 40000, 38000, 36000, 34000], costo: 17000, categoria: 'Caballero', marca: 'Texcol', existencia: 5 }),
    ...variantes({ producto: 'Franela Rockdreams', color: 'Gris', abrev: 'R', tallas: ['M', 'L'], precios: [30000, 28000, 26000, 24000, null], costo: 12000, categoria: 'Dama', marca: 'Rockdreams', existencia: 0 }),
  ];
  const desde = '2026-11-01T00:00:00.000Z';
  return {
    usuarios: [
      { usuario: 'admin', nombre: 'Carlos', rol: 'admin', pin: '1234' },
      { usuario: 'encargada', nombre: 'Encargada', rol: 'encargada', pin: '1234' },
      { usuario: 'vendedora', nombre: 'Vendedora', rol: 'vendedora', pin: '1234' },
    ],
    productos: productos.map(({ _costo, ...p }) => p),
    costos: productos.map(p => ({ sku: p.sku, costo: p._costo, historial: [{ costo: p._costo, desde }] })),
    clientes: [{ telefono: '584121234567', nombre: 'Ana Pérez' }],
    ajustes: {
      general: {
        tienda: { nombre: 'Comic Shop', telefono: '' },
        formasPago: FORMAS_PAGO_DEFECTO,
        tramos: LIMITES_DEFECTO,
        comisiones: COMISIONES_DEFECTO,
        redondeo: 100,
        descuentoMaxVendedora: 5,
      },
      tasas: { copPorUsd: 3900, copActualizada: '2026-11-12T12:00:00.000Z', bsModo: 'manual', bsRecargo: 15, bsManual: 1075, bsManualActualizada: '2026-11-12T12:00:00.000Z' },
    },
  };
}
