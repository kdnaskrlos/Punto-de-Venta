// Formas de pago por defecto (§9.1). Los ids son fijos: las ventas y la caja los guardan.
export const FORMAS_PAGO_DEFECTO = [
  { id: 'efectivo-cop', nombre: 'Efectivo pesos', moneda: 'COP', efectivo: true, activa: true },
  { id: 'transferencia-cop', nombre: 'Transferencia / Nequi / Bancolombia', moneda: 'COP', efectivo: false, activa: true },
  { id: 'efectivo-usd', nombre: 'Efectivo dólares', moneda: 'USD', efectivo: true, activa: true },
  { id: 'zelle', nombre: 'Zelle', moneda: 'USD', efectivo: false, activa: true },
  { id: 'usdt', nombre: 'USDT (Binance)', moneda: 'USD', efectivo: false, activa: true },
  { id: 'efectivo-bs', nombre: 'Efectivo Bs', moneda: 'BS', efectivo: true, activa: true },
  { id: 'pago-movil', nombre: 'Pago móvil', moneda: 'BS', efectivo: false, activa: true },
  { id: 'punto', nombre: 'Punto de venta', moneda: 'BS', efectivo: false, activa: true },
];

export const NOMBRE_MONEDA = { COP: 'COP', USD: 'USD', BS: 'Bs' };

export function formaEfectivo(formas, moneda) {
  return formas.find(f => f.efectivo && f.moneda === moneda)?.id || null;
}

// Ícono de cada forma de pago (se puede elegir otro al crearla o editarla).
export const ICONOS_FORMA = ['billete', 'banco', 'movil', 'tarjeta', 'cripto', 'envio'];
const ICONO_POR_ID = { 'transferencia-cop': 'banco', zelle: 'envio', usdt: 'cripto', 'pago-movil': 'movil', punto: 'tarjeta' };
export function iconoForma(f) {
  return f.icono || ICONO_POR_ID[f.id] || (f.efectivo ? 'billete' : 'banco');
}
