// Datos que la app mantiene al día mientras hay sesión: productos, ajustes, tasas y la caja propia abierta.
// Cada cambio emite el evento 'pos:datos' para que la pantalla visible se repinte.
import { tasasVigentes } from '../nucleo/tasas.js';
import { FORMAS_PAGO_DEFECTO } from '../nucleo/formas.js';
import { LIMITES_DEFECTO } from '../nucleo/tramos.js';
import { COMISIONES_DEFECTO } from '../nucleo/comisiones.js';
import { leerTasaRemota } from './tasa-remota.js';
import { puede } from '../nucleo/permisos.js';
import { hoy } from '../nucleo/fechas.js';

export const AJUSTES_DEFECTO = {
  tienda: { nombre: 'Comic Shop', telefono: '' },
  formasPago: FORMAS_PAGO_DEFECTO,
  tramos: LIMITES_DEFECTO,
  comisiones: COMISIONES_DEFECTO,
  redondeo: 100,
  descuentoMaxVendedora: 5,
  recibo: {},
};

const CLAVE_TASA = 'pos.tasaBs';
function leerCache() { try { return JSON.parse(localStorage.getItem(CLAVE_TASA)); } catch { return null; } }
function guardarCache(t) { try { if (t.bsPorUsd && !t.ultimaConocida && t.fuenteBs !== 'manual') localStorage.setItem(CLAVE_TASA, JSON.stringify({ bsPorUsd: t.bsPorUsd, fuenteBs: t.fuenteBs, bsActualizada: t.bsActualizada })); } catch { /* sin almacenamiento */ } }

export function iniciarDatos(ctx) {
  const emitir = que => window.dispatchEvent(new CustomEvent('pos:datos', { detail: { que } }));
  ctx.productos = {};
  ctx.ajustes = { ...AJUSTES_DEFECTO };
  ctx.ajustesTasas = {};
  ctx.miCaja = null;
  ctx.porArquear = []; // cajas que se cerraron solas a medianoche y falta contar
  ctx.tasaRemota = ctx.tasaRemota || null;
  ctx.recalcularTasas = () => {
    ctx.tasas = tasasVigentes(ctx.ajustesTasas, ctx.tasaRemota, leerCache());
    guardarCache(ctx.tasas);
    emitir('tasas');
  };
  const quitar = [
    ctx.almacen.escuchar('productos', lista => { ctx.productos = Object.fromEntries(lista.map(p => [p.sku, p])); emitir('productos'); }),
    ctx.almacen.escuchar('ajustes', lista => {
      const por = Object.fromEntries(lista.map(d => [d.id, d]));
      ctx.ajustes = { ...AJUSTES_DEFECTO, ...(por.general || {}) };
      ctx.ajustesTasas = por.tasas || {};
      ctx.recalcularTasas();
      emitir('ajustes');
    }),
    ctx.almacen.escuchar('cajas', lista => { ctx.miCaja = lista[0] || null; emitir('caja'); }, { usuario: ctx.sesion.usuario, estado: 'abierta' }),
    ctx.almacen.estadoSync(e => { ctx.conexion = e; emitir('conexion'); }),
    // Gestión ve las de toda la tienda; la vendedora, solo las suyas.
    ctx.almacen.escuchar('cajas', lista => { ctx.porArquear = lista.filter(c => c.cierre?.porArquear); emitir('caja'); },
      puede(ctx.sesion.rol, 'verReportesTodos') ? { estado: 'cerrada' } : { usuario: ctx.sesion.usuario, estado: 'cerrada' }),
  ];
  // Cierre automático de medianoche: al entrar y cada minuto se cierran las cajas abiertas en un día anterior.
  ctx.revisarCajas = () => ctx.almacen.cerrarCajasVencidas(hoy());
  ctx.revisarCajas();
  const relojCajas = setInterval(ctx.revisarCajas, 60 * 1000);
  ctx.recalcularTasas();
  // tasa.json de la Calculadora de Tasas: al entrar y cada 10 minutos.
  const leer = async () => { const t = await leerTasaRemota(fetch.bind(window)); if (t) { ctx.tasaRemota = t; ctx.recalcularTasas(); } };
  leer();
  const reloj = setInterval(leer, 10 * 60 * 1000);
  return () => { clearInterval(reloj); clearInterval(relojCajas); quitar.forEach(q => q && q()); };
}
