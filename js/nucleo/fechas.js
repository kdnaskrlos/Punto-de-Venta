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
