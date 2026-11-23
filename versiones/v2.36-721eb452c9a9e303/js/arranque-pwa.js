// También se carga directamente desde el HTML, aunque falle el grafo del POS.
let registro, buscando;
const compatible = location.protocol === 'https:' && 'serviceWorker' in navigator;

function disponible() {
  return registro?.waiting && navigator.serviceWorker.controller;
}

function avisar() {
  if (disponible()) window.dispatchEvent(new Event('pos:version-lista'));
}

async function consultar() {
  const workers = navigator.serviceWorker;
  const url = new URL('sw.js', document.baseURI);
  const existente = await workers.getRegistration(url);
  // Una primera instalación rechazada puede perder el registro por completo.
  const actual = existente || await workers.register(url, { updateViaCache: 'none' });
  if (actual !== registro) {
    registro = actual;
    actual.addEventListener('updatefound', () => actual.installing?.addEventListener('statechange', avisar));
  }
  avisar();
  if (existente && !actual.installing) await actual.update();
}

function buscar() {
  if (!navigator.onLine || buscando) return;
  buscando = consultar().catch(() => {}).finally(() => { buscando = null; });
}

if (compatible) {
  window.addEventListener('online', buscar);
  window.addEventListener('pos:consultar-version', avisar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
  setInterval(buscar, 10 * 60 * 1000);
  buscar();
}
