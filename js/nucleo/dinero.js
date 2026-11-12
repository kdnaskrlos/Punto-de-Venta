// Formato, lectura y redondeo de montos. COP es entero; USD y Bs llevan 2 decimales.

export function redondear(n, paso = 1) {
  if (!Number.isFinite(n)) return n;
  const r = Math.round(n / paso + Number.EPSILON * Math.sign(n)) * paso;
  const dec = paso < 1 ? Math.max(0, Math.ceil(-Math.log10(paso))) : 0;
  return Number(r.toFixed(dec));
}

const NF_COP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const NF_DEC = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtCop(n) { return NF_COP.format(Math.round(n)); }
export function fmtDec(n) { return NF_DEC.format(redondear(n, 0.01)); }
export function fmtMonto(n, moneda) { return moneda === 'COP' ? fmtCop(n) : fmtDec(n); }

// Lee lo que escribe la persona (nunca negativos). En COP los puntos siempre son miles.
// En USD/Bs: si hay punto y coma, el que va último es el decimal (sirve para 1.234,56 y 1,234.56);
// solo comas: decimal, salvo en USD con exactamente 3 dígitos detrás (1,234 = mil doscientos);
// solo puntos: decimal si le siguen 1–2 dígitos, miles si le siguen 3.
export function parseMonto(texto, moneda) {
  if (texto == null) return null;
  let s = String(texto).trim().replace(/\s|\$|bs\.?|cop|usd/gi, '');
  if (!s || !/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  let valor;
  if (moneda === 'COP') {
    const coma = s.match(/,(\d{1,2})$/);
    if (coma) s = s.slice(0, -coma[0].length);
    valor = Number(s.replace(/[.,]/g, ''));
  } else if (s.includes(',') && s.includes('.')) {
    const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const mil = dec === ',' ? /\./g : /,/g;
    valor = Number(s.replace(mil, '').replace(dec, '.'));
  } else if (s.includes(',')) {
    if (moneda === 'USD' && /^\d{1,3}(,\d{3})+$/.test(s)) valor = Number(s.replace(/,/g, ''));
    else valor = Number(s.replace(',', '.').replace(/,/g, ''));
  } else {
    const ult = s.lastIndexOf('.');
    if (ult >= 0 && s.length - ult - 1 <= 2) valor = Number(s.slice(0, ult).replace(/\./g, '') + '.' + s.slice(ult + 1));
    else valor = Number(s.replace(/\./g, ''));
  }
  return Number.isFinite(valor) ? valor : null;
}
