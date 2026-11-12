// Punto de entrada: registra el service worker y arranca la app.
import { arrancar } from './app.js';
import { h, toast } from './ui.js';

arrancar();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo && nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarVersionNueva(nuevo);
      });
    });
  }).catch(() => {});
}

function avisarVersionNueva(sw) {
  const barra = h('div', { class: 'toast', role: 'status' }, 'Hay una versión nueva',
    h('button', { onclick: () => { sw.postMessage('activar'); location.reload(); } }, 'Actualizar'));
  document.body.append(barra);
}
export { toast };
