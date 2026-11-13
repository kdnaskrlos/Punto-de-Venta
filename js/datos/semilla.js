// Datos de demostración: los productos de los bocetos y tres usuarios con PIN 1234.
import { FORMAS_PAGO_DEFECTO } from '../nucleo/formas.js';
import { COMISIONES_DEFECTO } from '../nucleo/comisiones.js';
import { claveGrupo, tituloProducto } from '../nucleo/importar.js';
import { LIMITES_DEFECTO } from '../nucleo/tramos.js';

let consecutivo = 0;

// Código EAN-13 de ejemplo (12 dígitos + dígito verificador), como los que calcula la Carga Masiva.
function ean13(n) {
  const d = String(n).padStart(12, '0');
  const suma = [...d].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return d + ((10 - (suma % 10)) % 10);
}

// Mismos campos que el inventario.json de la Carga Masiva.
function variantes({ tipo, tela = '', marca, genero, modelo = '', color, abrev, tallas, precios, costo, existencia, minimo = 2, separado = false }) {
  return tallas.map((talla, i) => {
    const p = {
      sku: `${abrev}-${talla}`, nombre: [tipo, marca, genero, talla, color, tela].filter(Boolean).join(' '),
      tipo, tela, color, talla, genero, marca, modelo, codigo: ean13(770000000000 + (++consecutivo) * 37), precios, separado,
      existencia: Array.isArray(existencia) ? existencia[i] : existencia, minimo, foto: null, oferta: null, activo: true,
      _costo: costo,
    };
    return { ...p, grupo: claveGrupo(p), titulo: tituloProducto(p) };
  });
}

export function semilla() {
  consecutivo = 0;
  const productos = [
    ...variantes({ tipo: 'Franela', tela: 'Algodon', marca: 'AS', genero: 'Niño', modelo: 'Manga Corta', color: 'Blanco', abrev: 'F-B', tallas: ['4', '6', '8', '10'], precios: [25000, 24000, 22500, 20000, null], costo: 9000, existencia: 12, minimo: 5 }),
    ...variantes({ tipo: 'Franela', tela: 'Algodon', marca: 'AS', genero: 'Niño', modelo: 'Manga Corta', color: 'Negro', abrev: 'F-N', tallas: ['4', '6', '8', '10'], precios: [25000, 24000, 22500, 20000, null], costo: 9000, existencia: 12, minimo: 5 }),
    ...variantes({ tipo: 'Buzo', marca: 'Etanol', genero: 'Caballero', color: 'Gris', abrev: 'B', tallas: ['S', 'M', 'L'], precios: [48000, 45000, 42000, 40000, 38000], costo: 20000, existencia: [3, 2, 1] }),
    ...variantes({ tipo: 'Body', marca: 'Serfe', genero: 'Unisex', modelo: 'Bebé', color: 'Rosa', abrev: 'Y', tallas: ['3m', '6m', '9m'], precios: [18000, 17000, 16000, 15000, 14000], costo: 7000, existencia: 6, separado: true }),
    ...variantes({ tipo: 'Jogger', marca: 'Texcol', genero: 'Caballero', color: 'Negro', abrev: 'J', tallas: ['S', 'M', 'L', 'XL', 'XXL'], precios: [42000, 40000, 38000, 36000, 34000], costo: 17000, existencia: 5 }),
    ...variantes({ tipo: 'Franela', tela: 'PoliAlg.', marca: 'Rockdreams', genero: 'Dama', color: 'Gris', abrev: 'R', tallas: ['M', 'L'], precios: [30000, 28000, 26000, 24000, null], costo: 12000, existencia: 0 }),
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
