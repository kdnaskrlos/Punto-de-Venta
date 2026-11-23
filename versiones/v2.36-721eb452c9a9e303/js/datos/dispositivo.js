// v2.27 · Identidad del aparato para el registro de actividad: un id propio (se crea una vez y queda guardado)
// y un nombre legible («Teléfono Android», «PC Windows»…) que el administrador puede cambiar desde Actividad.
const CLAVE = 'pos-dispositivo';

function nombreAutomatico() {
  const ua = navigator.userAgent || '';
  const tel = /Android|iPhone|iPad|Mobile/i.test(ua);
  const so = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  return `${tel ? 'Teléfono' : 'PC'}${so ? ' ' + so : ''}`;
}

const nuevoIdLocal = () => (crypto.randomUUID ? crypto.randomUUID() : 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

export function dispositivo() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (d?.id) return d;
    const nuevo = { id: nuevoIdLocal(), nombre: nombreAutomatico() };
    localStorage.setItem(CLAVE, JSON.stringify(nuevo));
    return nuevo;
  } catch { return { id: 'sin-almacenamiento', nombre: nombreAutomatico() }; }
}

export function nombrarDispositivo(nombre) {
  const d = dispositivo();
  const n = String(nombre || '').trim().slice(0, 40);
  if (!n) return d;
  const nuevo = { ...d, nombre: n };
  try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* sin almacenamiento */ }
  return nuevo;
}
