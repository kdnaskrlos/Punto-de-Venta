# Plan maestro del POS

**Base operativa:** fase 1 cerrada el 27/11/2026. POS v2.43.2 en GitHub Pages. El propietario informó por Cloud Shell que el canal `piloto-v243` fue eliminado ese día. El POS oficial es la única aplicación operativa de referencia. [Estado del proyecto](ESTADO_ACTUAL.md) · [POS oficial](https://kdnaskrlos.github.io/Punto-de-Venta/)

La fase 1 está **completada operativamente** en v2.43.2. La clasificación distingue el alcance probado en esa versión de las extensiones propuestas. Cada escenario tiene un destino principal y puede aportar requisitos acotados a otro bloque. La [clasificación del catálogo](ESCENARIOS_COMERCIALES.md#clasificación-y-seguimiento) reúne dependencias y evidencia. Las [reglas comerciales](REGLAS_COMERCIALES.md) registran los acuerdos aprobados.

| Fase o bloque | Alcance | Dependencia principal |
| --- | --- | --- |
| **1 · Núcleo operativo** | Base v2.43.2 en producción. Conservar evidencia y pruebas de regresión. | [Estado oficial](ESTADO_ACTUAL.md) |
| **2.0 · Consolidación del núcleo** | Corregir brechas financieras, comerciales y de integridad comprobadas en funciones que ya están en uso. | Evidencia de la brecha y flujo operativo afectado |
| **2.1 · Clientes** | Ficha de consulta y selección. Historial paginado según rol, por vínculo local verificable. | Límites de acceso e identidad local |
| **2.2 · Apartados avanzados** | Vencimientos, cambios de reserva, transferencia de titular y entrega. | Identidad local y política de abonos y vencimientos |
| **2.3 · Acuerdos mayoristas** | Cotización, volumen pactado, precios, reposiciones, vigencia e incumplimientos. | Vínculos entre tickets, tramos y reglas aprobadas |
| **2.4 · Cambios, devoluciones y garantías** | Operaciones vinculadas a la venta original con destino de stock y reintegro trazable. | Cantidades por línea, reversos y política de devolución |
| **2.5 · Comisiones avanzadas** | Atribución, ajustes, liquidaciones y saldos históricos. | Devengo aprobado y vínculos con ventas, apartados o devoluciones según el caso |
| **2.6 · Créditos y cuentas por cobrar** | Cupo, vencimientos, cargos, abonos, reversos y estado de cuenta. | Identidad validada, libro de movimientos y política de crédito |
| **2.7 · Proveedores y compras** | Compra, anticipo, recepción, costos atribuibles y cuenta por pagar. | Proveedor y documento identificados, stock y conciliación |
| **2.8 · Caja y gestión financiera avanzada** | Conciliación electrónica, transferencias, gastos y movimientos de varias monedas. | Movimientos enlazados, autorizaciones y tasas históricas |
| **2.9 · Inventario avanzado** | Daños, bajas, consumo, disponibilidad y ubicaciones si se aprueban. | Clasificación de movimientos y política de inventario |
| **2.10 · Reportes avanzados** | Rentabilidad, períodos y cierres a partir de los flujos ya conciliados. | Fuentes verificadas y definición contable de cada indicador |
| **3 · Tienda Online** | Disponibilidad y reservas por canal con inventario compartido. | Política por canal y garantía contra doble reserva |
| **4 · Integración de Pedidos Personalizados** | Cotización y diseño, taller, anticipos, entrega, identidad común y migración. | Permisos, fuentes de datos, conciliación y corte reversible |

Al implementar un bloque, habilita solo aquello cuyas dependencias ya estén aprobadas y disponibles. Por ejemplo, el reintegro por saldo a favor depende de 2.6, la comisión a crédito de un registro conciliable de deuda y los reportes de cada fuente financiera. La ficha de Clientes puede avanzar con ventas y apartados existentes. El ID común entre POS y Pedidos, la migración y las nuevas escrituras financieras quedan en sus bloques.

<a id="bloque-20-consolidacion"></a>

## 2.0 · Consolidación del núcleo

La entrada en 2.0 requiere un riesgo concreto en una función operativa, con evidencia de código, incidencia o prueba dirigida que identifique la brecha y su efecto. Corrige el alcance mínimo y conserva los comprobantes históricos. Usa las auditorías archivadas, la CI y la evidencia de campo antes de abrir una prueba nueva. [Auditoría del núcleo](AUDITORIA-BLOQUE-1.md) · [Evidencia de producción y CI](ESTADO_ACTUAL.md#evidencia-de-validación)

- **Cobro y apartado vigentes.** Los escenarios 007/068, 008, 057 y 069 delimitan efectivo por moneda, abonos y duplicados. El código actual registra cada medio de un abono compuesto por separado y asigna un ID fijo a cada uno. Esto permite reintentar por medio, pero deja abierta la posibilidad de persistencia parcial si un medio posterior falla. La brecha se circunscribe al flujo vigente. Corresponde verificar solo ese límite al abordar ESC-008. [Flujo de abono](../js/vistas/apartados.js) · [ESC-008](ESCENARIOS_COMERCIALES.md#esc-008)
- **Integridad de rutas actuales.** Los escenarios 012/013, 032, 099–102 y 106 cubren conciliación por ID, eventos, importación, fechas y permisos. La evidencia previa de ventas atómicas, movimientos y recuperación se reutiliza con el alcance que cubre. Una brecha confirmada bloquea su flujo afectado. [Auditoría](AUDITORIA-BLOQUE-1.md) · [Pruebas de ventas atómicas](../pruebas/firebase/cestas-atomicas.cjs) · [Clasificación del catálogo](ESCENARIOS_COMERCIALES.md#clasificación-y-seguimiento)

<a id="minimos-entrada-clientes"></a>

## Mínimos para iniciar 2.1

**Dos escenarios bloqueantes de entrada, acotados a la primera entrega de consulta y selección:**

| Escenario | Decisión o validación mínima | Verificación dirigida |
| --- | --- | --- |
| [ESC-107](ESCENARIOS_COMERCIALES.md#esc-107) · Acceso a la ficha | Aprobar quién puede ver contacto, ventas y apartados. Base propuesta: administración y encargada consultan el historial, vendedora busca y selecciona para cobrar. La exportación se reserva para su propia aprobación. | Cotejar la consulta propuesta con las reglas existentes. Al implementar, cubrir positivo y negativo por rol, incluso acceso directo y cambio de sesión. Clientes y apartados permiten lectura a cuentas activas en las reglas actuales; una nueva restricción de servidor necesita aprobación y pruebas. [Reglas actuales](../firestore.rules) |
| [ESC-172](ESCENARIOS_COMERCIALES.md#esc-172) · Identidad local | Aprobar coincidencia por teléfono normalizado y aislar casos ambiguos, compartidos, reasignados o con número cambiado para revisión. La coincidencia de nombre sirve para búsqueda. | Contrastar el contrato actual y probar con datos sintéticos un homónimo y un teléfono ambiguo. Vincular de forma automática solo operaciones cuya correspondencia se pueda comprobar. El ID intersistemas y la migración integral siguen en fase 4. [Captura](../js/vistas/cliente.js) · [Normalización](../js/nucleo/recibo.js) |

El diseño de consultas podrá comenzar al aprobar esos límites. La protección del historial (ESC-098) y la continuidad (ESC-103/104) se reutilizan como garantías con regresiones dirigidas en la implementación. La paginación y la caché parcial (ESC-108) son criterios del propio bloque. Quedaría bloqueado el arranque solo si una revisión dirigida demuestra que estas garantías fallan dentro de la ficha propuesta. El cierre completo de 2.0 queda fuera de la puerta de Clientes.

<a id="bloque-21-clientes"></a>

## Bloque 2.1 · Clientes

**Objetivo propuesto.** Encontrar a un cliente y abrir sus ventas y apartados desde una sola ficha, con los importes y estados históricos guardados. Primera entrega de consulta y selección. El alta y la edición en el flujo de venta siguen su mecanismo vigente.

- **Punto de partida.** `clientes/{telefono}` guarda nombre y teléfono. Ventas y apartados conservan una copia de esos datos. La coincidencia inicial usa el teléfono normalizado exacto, siguiendo la función existente. Buscar por nombre ayuda a encontrar la ficha, y cualquier vínculo por teléfono exacto se limita a registros cuya correspondencia sea comprobable. Las ventas sin coincidencia comprobable conservan sus datos en su historial original. Un cambio de número, un teléfono compartido o reasignado requiere revisión antes de cualquier vínculo. El identificador estable y una eventual migración se diseñarán para el alcance de ESC-172, sin reescribir comprobantes. [Captura](../js/vistas/cliente.js) · [Normalización](../js/nucleo/recibo.js) · [ESC-172](ESCENARIOS_COMERCIALES.md#esc-172)
- **Interfaz.** En PC, «Clientes» en la barra lateral y una lista al lado de la ficha. En móvil, «Más → Clientes» y ficha en pantalla propia con vuelta al listado. Arriba, búsqueda por nombre o teléfono y coincidencias con ambos datos. En la ficha, nombre, contacto y secciones «Ventas» y «Apartados» con fecha, comprobante, importe y estado; las ventas anuladas se distinguen y cada fila abre el detalle existente. Los resultados conservan búsqueda y posición al volver. Reutilizar componentes, tipografía y color del POS. Al seleccionar desde «Vender», conservar el carrito y usar la ficha elegida.
- **Permisos propuestos.** Administración y encargada consultan el historial completo. Vendedora mantiene la búsqueda y selección del cliente para cobrar; el acceso al historial desde la ficha queda sujeto a la decisión de entrada, con el alcance de ventas propias y apartados evaluados por separado. Las reglas actuales permiten a cuentas activas leer clientes y apartados y restringen las ventas de la vendedora a las propias. Verificar cualquier nueva restricción en servidor y en Emulator Suite. [Reglas actuales](../firestore.rules) · [ESC-107](ESCENARIOS_COMERCIALES.md#esc-107)
- **Consultas y continuidad.** Reutilizar el contrato de almacén y paginar el historial por cliente, fecha e ID. Revisar índices y permisos de la consulta, sin descargar todos los cobros para construir la ficha. Sin conexión, indicar si se muestran datos locales parciales y conservar el flujo de venta. Distinguir carga, sin resultados, falta de permisos y caché no disponible. [Contrato del almacén](../js/datos/contrato.js) · [ESC-103](ESCENARIOS_COMERCIALES.md#esc-103) · [ESC-108](ESCENARIOS_COMERCIALES.md#esc-108)
- **Criterios de aceptación propuestos.** Variantes venezolanas y colombianas del mismo teléfono encuentran la misma ficha cuando la normalización actual las reconoce; clientes homónimos permanecen separados; ventas anuladas, apartados cancelados y comprobantes previos conservan sus estados; cambiar de cuenta no muestra el historial del rol anterior; la ficha limitada por caché se distingue de un historial vacío; PC y móvil conservan contexto al regresar; usar o consultar una ficha no crea cobros ni altera importes.
- **Decisión del propietario antes de implementar.** Validar la primera entrega de consulta y selección, la visibilidad de historial y apartados para vendedora y el manejo de teléfonos compartidos o cambiados. Edición general, exportación, fusión de fichas, crédito y cambios o devoluciones se aprueban en su alcance correspondiente. [Reglas comerciales](REGLAS_COMERCIALES.md)
