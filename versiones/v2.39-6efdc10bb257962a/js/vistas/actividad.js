// v2.27 · Actividad (registro de auditoría): quién hizo qué, cuándo y desde qué aparato.
// Solo administrador y encargada. Se abre desde Reportes con el mismo período elegido allí.
import { h, icono, abrirVentana, toast } from '../ui.js';
import { ETIQUETAS, GRUPOS, IMPORTANTES, CAMPOS_AJUSTES } from '../datos/eventos.js';
import { dispositivo, nombrarDispositivo } from '../datos/dispositivo.js';
import { fechaHora, inicioDia, finDia } from '../nucleo/fechas.js';

const ICONO = { ventas: 'carrito', caja: 'cartera', inventario: 'caja', ajustes: 'ajustes', conflictos: 'alerta', sesion: 'usuario' };
const grupoDe = t => GRUPOS.find(([, , f]) => f(t))?.[0] || 'ajustes';
const cuando = e => (e.en?.toDate ? e.en.toDate().toISOString() : typeof e.en === 'string' ? e.en : e.fecha || e.enLocal);

function leerUnaVez(ctx, coleccion, filtro) {
  return new Promise(res => {
    let listo = false, q = null;
    q = ctx.almacen.escuchar(coleccion, l => { if (listo) return; listo = true; res(l); setTimeout(() => q && q()); }, filtro);
    if (listo) setTimeout(() => q && q());
  });
}

const detalleAjustes = e => {
  if (!e.despues) return null;
  const fmt = v => (v == null ? '—' : Array.isArray(v) ? (v.every(x => typeof x !== 'object') ? v.join(' · ') : `${v.length} elementos`) : typeof v === 'object' ? 'cambió' : typeof v === 'number' ? v.toLocaleString('es-CO') : String(v));
  return h('div', { class: 'act-cambios' }, ...Object.keys(e.despues).map(k => h('div', {}, h('span', {}, CAMPOS_AJUSTES[k] || k), h('s', {}, fmt(e.antes?.[k])), icono('der'), h('b', {}, fmt(e.despues[k])))));
};

export async function abrirActividad(ctx, { desde, hasta }) {
  const lista = h('div', { class: 'act-lista', 'aria-busy': 'true' }, h('span', { class: 'esqueleto', style: 'width:100%;height:56px' }));
  const chips = h('div', { class: 'filtros act-filtros' });
  const personas = h('select', { class: 'inp act-persona', 'aria-label': 'Persona' });
  let grupo = '', persona = '', eventos = [];
  const pintar = () => {
    chips.replaceChildren(...[['', 'Todo'], ...GRUPOS.map(([k, t]) => [k, t])].map(([k, t]) =>
      h('button', { type: 'button', class: 'chip' + (k === grupo ? ' activo' : ''), onclick: () => { grupo = k; pintar(); } }, t)));
    const vis = eventos.filter(e => (!grupo || grupoDe(e.tipo) === grupo) && (!persona || e.usuario === persona));
    if (!vis.length) { lista.replaceChildren(h('p', { class: 'nota act-vacio' }, 'Sin actividad en este período.')); return; }
    const filas = []; let dia = '';
    for (const e of vis) {
      const [d, hr] = fechaHora(cuando(e)).split(' · ');
      if (d !== dia) { dia = d; filas.push(h('h3', { class: 'act-dia' }, d)); }
      const g = grupoDe(e.tipo);
      filas.push(h('div', { class: 'act-fila' + (IMPORTANTES.has(e.tipo) ? ' importante' : '') + (e.tipo === 'conflicto.registrado' ? ' grave' : ''), 'data-tipo': e.tipo },
        h('span', { class: 'act-ic g-' + g }, icono(ICONO[g])),
        h('div', { class: 'act-txt' },
          h('div', { class: 'act-l1' }, h('b', {}, ETIQUETAS[e.tipo] || e.tipo), e.resumen ? h('span', { class: 'num' }, e.resumen) : null),
          e.motivo ? h('div', { class: 'act-motivo' }, `«${e.motivo}»`) : null,
          detalleAjustes(e),
          h('div', { class: 'nota act-quien' }, `@${e.usuario} · ${e.nombreDispositivo || 'aparato sin nombre'}${e.version ? ' · ' + e.version : ''}`)),
        h('span', { class: 'act-hora nota num' }, hr)));
    }
    lista.replaceChildren(...filas);
  };
  personas.onchange = () => { persona = personas.value; pintar(); };
  const yo = dispositivo();
  const nombreAparato = h('b', {}, yo.nombre);
  const pie = h('div', { class: 'act-aparato nota' }, icono('movil'), 'Este aparato: ', nombreAparato,
    h('button', { type: 'button', class: 'enlace', id: 'act-nombrar', onclick: () => {
      const inp = h('input', { class: 'inp', id: 'act-nombre', value: yo.nombre, 'data-no-limpiar': '' });
      const ok = h('button', { class: 'btn primary' }, icono('check'), 'Guardar');
      const v2 = abrirVentana({ titulo: 'Nombre de este aparato', contenido: h('div', { class: 'campo' }, h('label', { for: 'act-nombre' }, 'Nombre'), inp), acciones: h('div', { class: 'acciones' }, ok) });
      ok.onclick = () => { const d = nombrarDispositivo(inp.value); nombreAparato.textContent = d.nombre; v2.cerrar(); toast('Nombre guardado'); };
    } }, 'Cambiar nombre'));
  const v = abrirVentana({ titulo: 'Actividad', clase: 'ventana-actividad', contenido: h('div', { class: 'pila actividad' }, h('div', { class: 'act-barra' }, chips, personas), lista, pie) });
  eventos = (await leerUnaVez(ctx, 'eventos', { desde: inicioDia(desde), hasta: finDia(hasta || desde) })).sort((a, b) => String(cuando(b)).localeCompare(String(cuando(a))));
  const nombres = [...new Set(eventos.map(e => e.usuario))].sort();
  personas.replaceChildren(h('option', { value: '' }, 'Todas las personas'), ...nombres.map(n => h('option', { value: n }, '@' + n)));
  lista.removeAttribute('aria-busy');
  pintar();
  return v;
}
