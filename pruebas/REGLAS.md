# Comprobación de las reglas de seguridad (proyecto real)

Las reglas (`firestore.rules`) no se pudieron probar con el emulador de Firebase en el entorno de construcción. Esta lista se ejecuta **una vez**, con el proyecto real ya configurado (GUIA.md, pasos 1–6), antes de usar el punto de venta en la tienda.

**Cómo:** abre la app en Chrome en la PC, entra con el usuario indicado, abre la consola (F12 → Consola) y pega el bloque. Cada línea debe mostrar el resultado esperado.

```js
// Ayudante: intenta una operación y muestra si pasó o fue rechazada.
const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
const db = fs.getFirestore();
const prueba = async (nombre, fn, esperado) => { try { await fn(); console.log(esperado === 'ok' ? '✅' : '❌', nombre, '→ pasó'); } catch (e) { console.log(esperado === 'rechazo' ? '✅' : '❌', nombre, '→', e.code); } };
```

## Como **vendedora**

| # | Bloque | Esperado |
|---|---|---|
| 1 | `await prueba('leer costos', () => fs.getDocs(fs.collection(db, 'costos')), 'rechazo')` | rechazo |
| 2 | `await prueba('leer costosVenta', () => fs.getDocs(fs.collection(db, 'costosVenta')), 'rechazo')` | rechazo |
| 3 | `await prueba('cambiar precio', () => fs.updateDoc(fs.doc(db, 'productos', '<SKU>'), { precios: [1,1,1,1,1] }), 'rechazo')` | rechazo |
| 4 | `await prueba('cambiar existencia', () => fs.updateDoc(fs.doc(db, 'productos', '<SKU>'), { existencia: fs.increment(0) }), 'ok')` | pasó |
| 5 | `await prueba('ver ventas de otros', () => fs.getDocs(fs.collection(db, 'ventas')), 'rechazo')` | rechazo (sin filtrar por su usuario) |
| 6 | `await prueba('escribir ajustes', () => fs.setDoc(fs.doc(db, 'ajustes', 'tasas'), { copPorUsd: 1 }, { merge: true }), 'rechazo')` | rechazo |
| 7 | `await prueba('aprobar autorización', () => fs.updateDoc(fs.doc(db, 'autorizaciones', '<ID>'), { estado: 'aprobada' }), 'rechazo')` | rechazo |
| 8 | `await prueba('abrir segunda caja', () => fs.setDoc(fs.doc(db, 'cajaAbierta', '<su usuario>'), { cajaId: 'x' }), 'rechazo')` | rechazo, con una caja ya abierta |

## Como **encargada**

| # | Bloque | Esperado |
|---|---|---|
| 9 | `await prueba('leer costos', () => fs.getDocs(fs.collection(db, 'costos')), 'ok')` | pasó |
| 10 | `await prueba('escribir ajustes', () => fs.setDoc(fs.doc(db, 'ajustes', 'general'), { redondeo: 100 }, { merge: true }), 'rechazo')` | rechazo |
| 11 | `await prueba('cambiar oferta', () => fs.updateDoc(fs.doc(db, 'productos', '<SKU>'), { oferta: { pct: 10, activa: true } }), 'rechazo')` | rechazo |
| 12 | `await prueba('responder autorización', () => fs.updateDoc(fs.doc(db, 'autorizaciones', '<ID>'), { estado: 'aprobada' }), 'rechazo')` | rechazo |
| 13 | `await prueba('reescribir una venta', () => fs.setDoc(fs.doc(db, 'ventas', '<ID venta>'), { total: 1 }), 'rechazo')` | rechazo |
| 14 | `await prueba('anular dos veces', () => fs.updateDoc(fs.doc(db, 'ventas', '<ID venta ya anulada>'), { estado: 'anulada', anulacion: {} }), 'rechazo')` | rechazo |

## Como **administrador**

| # | Bloque | Esperado |
|---|---|---|
| 15 | `await prueba('reabrir caja', …)`: desde la app, Caja → Reabrir en una caja cerrada | funciona |
| 16 | Desactivar a un usuario en Ajustes y que esa persona intente entrar | "Usuario desactivado" |

## Flujo (como vendedora, en el teléfono)

1. **Con internet:** vender 1 prenda. La venta aparece con número V-…, y la existencia baja 1.
2. **Sin internet** (modo avión): vender otra. Arriba aparece "Sin conexión · 1 por subir". Al volver la conexión, sube sola y recibe su número cuando la encargada o tú abran la app.
3. **Doble toque:** tocar dos veces muy rápido "Cobrar". Debe quedar **una** venta.
4. **Faltante:** con la última unidad, vender desde dos teléfonos con internet al mismo tiempo. Uno cobra y el otro ve "Ya no hay existencia de …".

## Caja: cierre automático y caja personal (v1.20)
- [ ] Vendedora: `abrirCaja({}, { tipo: 'personal' })` → rechazado.
- [ ] Encargada/admin: `abrirCaja({}, { tipo: 'personal' })` → permitido.
- [ ] Encargada: `cerrarCajasVencidas(hoy)` con una caja de la vendedora abierta ayer → la cierra (estado cerrada, cierre.automatico, porArquear) y borra su `cajaAbierta`.
- [ ] Encargada: intentar cerrar SIN `cierre.automatico` la caja de la vendedora → rechazado.
- [ ] Vendedora: `arquearCaja(id, …)` sobre su caja por arquear → permitido; repetirlo → rechazado (ya no está por arquear).
- [ ] Vendedora: `arquearCaja` sobre la caja de otra persona → rechazado.

## Modo prueba (v1.32)
- [ ] Admin: "Modo prueba" crea productos, costos, clientes, ventas y apartados con demo:true.
- [ ] Admin: "Quitar ejemplos" borra solo lo que tiene demo:true (y costosVenta "demo-…"); una venta real no se puede borrar.
- [ ] Encargada o vendedora: no pueden crear ni borrar documentos con demo:true.
