# Estado actual — POS Comic Shop

**Actualizado:** 2026-11-25. **Repositorio:** `kdnaskrlos/Punto-de-Venta`.  
**Publicada:** v2.42. **Candidata:** v2.43, PR #21 (`integracion/pos-auditoria`), sin fusionar.
**Regla de uso:** comprobar con GitHub y código antes de dar cualquier dato de este archivo por vigente.

## Objetivo inmediato
Ejecutar validación **contra Firebase real**, no más simulaciones como sustituto, antes de publicar v2.43. El propietario autorizó pruebas sintéticas en el proyecto actual y el uso de su administrador habitual; no autorizó un despliegue/borrado automático.

## Evidencia y avances verificados
- CI #45657887101 del candidato: aprobó `firestore-emulador`, `navegador-pwa` y `candidato-piloto`. Son verificaciones locales, **no** validación remota.
- Cambios de Codex en PR #21: caja personal de administración, protección de aperturas concurrentes e identificadores de pruebas, script remoto con usuario/PIN, registros y documentación.
- El script `pruebas/firebase/remoto-cestas.cjs` tiene `POS_QA_SOLO_PRECHECK=1`, confirmación de escrituras y `POS_QA_RUN_ID`; no divulgar PIN.
- WIF GitHub–Google Cloud funcionó para consulta de metadatos. Esto no verifica que `procesarVentaPos` ni las reglas candidatas estén activos.
- Riesgo heredado: v2.35 puede perder borradores al cerrar pestañas (casos históricos 04/05); se exige migración supervisada.

## Estado por área
| Área | Situación |
| --- | --- |
| Catálogo, inventario, tramos y mix/separado | Implementado; confirmar en remoto |
| Comisiones con piso por grupo, reducción al detal | Código candidato y pruebas locales |
| Pagos combinados y vuelto mixto USD/COP | Código candidato y pruebas locales |
| Caja personal admin/encargada y física vendedora | Verificado en código y CI |
| Offline, carritos, idempotencia y PWA | Validado localmente, pendientes dispositivos reales |
| Firestore real (reglas/Function, ventas 1–248 SKU) | **No validado** |
| Publicación v2.43 | **Bloqueada** |
| Reinicio total de fábrica | Futuro, issue #26; no ejecutar ahora |

## Decisiones de negocio confirmadas por código
- Tramos: 1–5, 6–11, 12–23, 24–47, 48+; el mix comparte tramo. Productos `separado` calculan por tipo/marca/género/modelo y no reciben descuento general.
- Comisiones: reducción por descuento/oferta solo en tramo de detal, piso por grupo contra cierres anteriores; evita doble pago mediante identificadores en el flujo nuevo.
- Cobros: COP contable, efectivo COP/USD, Nequi, Zelle, USDT y pago móvil Bs; vuelto mixto físico USD y COP con remanente explícito.
- Tasas: COP/USD manual; Bs/USD Binance+recargo, BCV o manual. Preservar tasa efectivamente usada en una operación; nunca sustituir histórico por tasa vigente.
- Apartados: reservan unidades, admiten abonos, completan/cancelan; verificar conciliación.
- Admin y encargada: caja personal automática sin arqueo físico. Vendedora: caja física y arqueo.

## Reglas o funcionalidades por especificar (no afirmar implementadas)
- Tasa paralela del día de pago: definición exacta, qué fecha manda y cómo se conserva.
- Apartados vencidos y «cliente fantasma»: vencimiento, deuda, recuperación de stock y registro.
- Pedidos/lotes mayoristas abiertos por goteo: entrega parcial, precio, stock, abonos y liquidación.
- Ventas fragmentadas y preventas: criterios comerciales de agrupación; no inventar umbrales.
- Comisiones de apartados o liquidaciones parciales: destinatario y reversión.
- Integración de Pedidos (otra app) en el POS: fase posterior, sin tocar su Firebase ahora.

## Firebase / autorizaciones
- Único destino autorizado de QA: `punto-de-venta-comic-shop` (Blaze), no un proyecto nuevo.
- El propietario confirmó que no hay respaldo y acepta usar datos de prueba en POS aún no operativo; **no** borrar indiscriminadamente.
- El propietario quiere usar su admin existente. No pedir su PIN en chat ni guardarlo en GitHub.
- Confirmar reglas y Function efectivamente desplegadas; aprobar cualquier modificación por separado.
- La versión v2.42 publicada y el proyecto Pedidos Personalizados quedan intactos.

## Siguiente paso exacto
**Conectar un acceso autorizado a Firebase real (o ejecutar el precheck seguro local con credenciales introducidas allí), verificar reglas, Function y caja personal sin escribir.** Si faltan reglas/Function, presentar cambio concreto y pedir autorización específica; luego ejecutar pruebas remotas de ventas, stock, pagos y repetición con `POS_QA_RUN_ID` único. Registrar resultados verificables.

## Referencias
- PR #21: candidato v2.43.
- Issue #22: gate de publicación y resultados.
- Issue #26: reinicio total posterior.
- `docs/VALIDACION-FINAL-V243.md`: procedimiento de validación.
- `docs/memoria/`: contexto histórico; confirmar antes de convertir en reglas.
