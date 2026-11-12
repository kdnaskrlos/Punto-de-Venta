// Fechas en la hora de la tienda (Caracas), para que una venta de las 9 pm cuente en su día.
export const ZONA = 'America/Caracas';

export function diaLocal(fechaISO) {
  return new Date(fechaISO).toLocaleDateString('en-CA', { timeZone: ZONA });
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "Jueves 12 nov · 3:05 pm" en la hora de la tienda.
export function fechaHora(fechaISO) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    .formatToParts(new Date(fechaISO)).map(p => [p.type, p.value]));
  const d = new Date(`${partes.year}-${partes.month.padStart(2, '0')}-${partes.day.padStart(2, '0')}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${Number(partes.day)} ${MESES[Number(partes.month) - 1]} · ${partes.hour}:${partes.minute} ${partes.dayPeriod.toLowerCase()}`;
}

// Primer instante del día de la tienda, en ISO UTC (Venezuela no cambia de horario).
export function inicioDia(dia) { return new Date(`${dia}T00:00:00-04:00`).toISOString(); }
export function hoy() { return diaLocal(new Date().toISOString()); }
export function sumarDias(dia, n) { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ---- Calendario propio (selector de rango de fechas) ----
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = n => String(n).padStart(2, '0');

// 42 días (6 semanas fijas) del mes, empezando en domingo como el calendario del teléfono.
export function diasCalendario(anio, mes) {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  const inicio = new Date(primero); inicio.setUTCDate(1 - primero.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio); d.setUTCDate(inicio.getUTCDate() + i);
    return { fecha: `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`, dia: d.getUTCDate(), delMes: d.getUTCMonth() === mes - 1 };
  });
}

export function mesCorto(anio, mes) { return `${MESES_LARGOS[mes - 1]} ${anio}`; }

// "12 nov", "9 – 15 nov", "28 oct – 3 nov", "28 dic 2025 – 3 ene"
export function rangoCorto(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number), [a2, m2, d2] = hasta.split('-').map(Number);
  if (desde === hasta) return `${d1} ${MESES_CORTOS[m1 - 1]}`;
  if (a1 === a2 && m1 === m2) return `${d1} – ${d2} ${MESES_CORTOS[m2 - 1]}`;
  return `${d1} ${MESES_CORTOS[m1 - 1]}${a1 !== a2 ? ' ' + a1 : ''} – ${d2} ${MESES_CORTOS[m2 - 1]}`;
}

// Último segundo del día en la tienda (cierre automático de cajas).
export function finDia(dia) { return new Date(`${dia}T23:59:59-04:00`).toISOString(); }
