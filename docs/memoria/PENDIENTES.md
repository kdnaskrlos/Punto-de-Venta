# Pendientes del proyecto y de la memoria

## Bloque 3 de la auditoría

**Aprobado en Claude el 16 de noviembre de 2026 y pendiente de implementación en v2.35.** El usuario aprobó la propuesta de Ajustes y pidió continuar con el bloque. Los mensajes posteriores describen trabajo y pruebas, pero el hilo se interrumpe y la revisión `81f469b` conserva el comportamiento anterior. La memoria original también recoge los acuerdos de comisiones, cobro y vuelto. [Registro de auditoría](../superpowers/decisiones-fase1.md) · [POS Comic Shop, mensajes 340–348](README.md#pos-comic-shop) · [Memoria original del POS](README.md#memoria-original-del-pos)

### Requisitos aprobados

| Requisito | Alcance acordado y estado en v2.35 | Fuente |
| --- | --- | --- |
| Limitar la comisión reducida al detal | Aplicar la reducción por descuento u oferta solo al detal. El cálculo actual puede reducir la comisión en otros tramos. | [Cálculo actual](../../js/nucleo/comisiones.js), [POS Comic Shop, mensajes 260–261](README.md#pos-comic-shop) |
| Establecer un piso por grupo | Al subir de tramo, la comisión del mix o de cada producto «separado» debe conservar como mínimo el máximo del tramo anterior. El cálculo actual resuelve el importe por línea y tramo. | [Registro de auditoría](../superpowers/decisiones-fase1.md), [cálculo actual](../../js/nucleo/comisiones.js), [POS Comic Shop, mensajes 262–263](README.md#pos-comic-shop) |
| Exigir que el pago cubra el total | Retirar la tolerancia ligada al redondeo. El código actual admite un faltante inferior a la mitad del paso de redondeo. La propuesta aprobada menciona un margen inferior a 1 COP para conversiones de Bs. | [Cobro actual](../../js/nucleo/cobro.js), [POS Comic Shop, mensajes 264–265 y 341–342](README.md#pos-comic-shop) |
| Incorporar el vuelto mixto | Usar un billete mínimo configurable, con 1 USD por defecto, y devolver el resto en COP redondeado hacia abajo en pasos de 100 COP por defecto. Prever la opción «Todo en pesos», sugerir dólares enteros para pagos en efectivo y conservar decimales en Zelle y USDT. Cambiar el ajuste previo de redondeo en USD al del billete mínimo. La interfaz actual devuelve en una moneda seleccionada. | [Interfaz de pagos](../../js/vistas/pagos.js), [ajustes actuales](../../js/vistas/ajustes.js), [POS Comic Shop, mensajes 274–277 y 341–342](README.md#pos-comic-shop) |

### Criterios de aceptación por confirmar

- Precisar cómo aplicar el margen inferior a 1 COP en las conversiones desde Bs y cómo convertir los valores ya guardados de `redondeoUsd` al ajuste de billete mínimo. [Cobro](../../js/nucleo/cobro.js) · [Ajustes](../../js/vistas/ajustes.js) · [POS Comic Shop, mensajes 341–342](README.md#pos-comic-shop)
- Precisar cómo repartir y redondear el piso de comisión entre líneas. Confirmar si el objetivo incluye evitar que dos ventas partidas sumen más comisión que una venta única, además de evitar una caída de comisión al subir de tramo. [Registro de auditoría](../superpowers/decisiones-fase1.md) · [POS Comic Shop, mensajes 262–263](README.md#pos-comic-shop)

### Alcance adicional pendiente de confirmación

Estos escenarios constan en la auditoría. Verificar su alcance antes de tratarlos como reglas de negocio definitivas. [POS Comic Shop, mensajes 257, 259 y 285–287](README.md#pos-comic-shop)

| Escenario de auditoría | Comportamiento de referencia en v2.35 | Evidencia |
| --- | --- | --- |
| Atribuir la comisión al origen del apartado | La venta se registra con la sesión de quien completa el apartado y el resumen de comisiones usa el usuario de la venta. | [Almacén Firebase](../../js/datos/firebase.js), [comisiones](../../js/nucleo/comisiones.js) |
| Compensar comisiones tras anular una venta y permitir anular pagos de comisión | El resumen excluye las ventas anuladas y la vista permite marcar ventas como pagadas. | [Cálculo](../../js/nucleo/comisiones.js), [vista](../../js/vistas/reportes.js) |
| Mostrar saldos de personas inactivas y períodos anteriores | La vista filtra por personas activas con comisión y calcula el saldo dentro del rango seleccionado. | [Vista de comisiones](../../js/vistas/reportes.js) |
| Numerar ventas propias al reconectar y revisar existencias al entrar a Cobrar | Gestión asigna los números diferidos. La comprobación de existencias en línea se hace en la transacción al guardar. | [Almacén Firebase](../../js/datos/firebase.js), [vista de cobro](../../js/vistas/cobrar.js) |
| Guardar la tasa del día en cada caja y avisar al salir si quedan ventas por subir | El reporte usa las tasas actuales para convertir movimientos, y el botón de cierre de sesión ejecuta la salida directamente. | [Reporte de cierre](../../js/vistas/reporte-cierre.js), [cuenta](../../js/vistas/cuenta.js) |

## Fases futuras documentadas

- **Ficha de clientes con historial, crédito, cambios y devoluciones.** Figuran en la fase 2, junto con compras a proveedores y reportes avanzados. [Especificación de fase 1](../superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md), [POS Comic Shop, mensajes 242–243](README.md#pos-comic-shop)
- **Tienda online conectada al inventario.** Figura en la fase 3. [Especificación de fase 1](../superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md), [POS Comic Shop, mensajes 242–243](README.md#pos-comic-shop)
- **Integrar Pedidos después de cerrar la fase 1.** Está pendiente de implementación en v2.35. Se acordaron roles comunes, abonos y saldos por la caja del POS, y una migración única de datos. La matriz de permisos acordada está en las notas de Pedidos. Queda por confirmar qué catálogos, avisos, imágenes y pantallas formarán parte de la integración. El boceto del resumen de entrega y pagos se conserva como referencia. [Notas de Pedidos](../superpowers/specs/2026-11-14-pedidos-en-pos-notas.md) · [POS Comic Shop, mensajes 53–57 y 242–243](README.md#pos-comic-shop) · [Conversaciones de Pedidos](README.md#conversaciones-de-pedidos-y-taller)

## Referencias y decisiones por confirmar

- **Autorización de descuentos de la vendedora.** El diálogo menciona al administrador o a la encargada, mientras que la matriz, los almacenes y las reglas de Firestore del repositorio reservan la aprobación al administrador. El flujo en v2.35 pide autorización para cualquier descuento manual de la vendedora. El 5 % sin autorización pertenece a la especificación anterior. Queda pendiente de confirmación cuál debe ser el mensaje y si se quiere mantener el rol autorizador actual. [Diálogo](../../js/vistas/vender.js) · [Matriz](../../js/nucleo/permisos.js) · [Firebase](../../js/datos/firebase.js) · [Almacén en memoria](../../js/datos/memoria.js) · [Reglas](../../firestore.rules) · [Historial v1.43](../superpowers/decisiones-fase1.md) · [Memoria original del POS](README.md#memoria-original-del-pos)
- **Espaciado y escala tipográfica.** El historial recoge 12 px entre bloques y al borde en móvil, y 16 px de margen en PC, además de la jerarquía de pesos y medidas de v1.87. Son referencias históricas. Su uso como criterio obligatorio y el tratamiento de las excepciones del CSS quedan pendientes de confirmación. [Historial de fase 1](../superpowers/decisiones-fase1.md) · [Estilos actuales](../../css/material.css) · [Memoria original del POS](README.md#memoria-original-del-pos)

## Documentación por revisar

- Conciliar las instrucciones de sincronización y fotos de la guía con la interfaz actual. [Guía](../../GUIA.md) · [Inventario](../../js/vistas/inventario.js)
- Conciliar el comentario del importador que dice que `separado` sigue sin uso con su aplicación en el cálculo del carrito. [Importador](../../js/nucleo/importar.js) · [Tramos](../../js/nucleo/tramos.js)

## Verificación de Firebase

- Confirmar qué reglas están activas en el proyecto Firebase del POS y su compatibilidad con la versión en uso. El incidente por aplicar reglas al proyecto de Pedidos está documentado. El estado desplegado sigue sin verificar. [Reglas del repositorio](../../firestore.rules) · [Registro v2.35](../superpowers/decisiones-fase1.md) · [POS Comic Shop, mensajes 337–339](README.md#pos-comic-shop)
- **Revisión independiente de ejemplos históricos.** Identificar por procedencia y relaciones los registros que llegaron a Firestore desde versiones anteriores del Modo prueba. La marca `demo: true` por sí sola no acredita que un registro pueda borrarse. Cualquier limpieza requiere una revisión y autorización propias. [Adaptador Firebase](../../js/datos/firebase.js) · [Reglas del repositorio](../../firestore.rules)

## Incorporación de memoria

- Recuperar o descartar por alcance las **cuatro memorias** que siguen solo en `indices/memorias.md` del primer ZIP. El segundo paquete ya aportó `memorias/punto-de-venta.md` y `memorias/preferences.md`. [Memorias revisadas](README.md#fuentes-originales-de-la-segunda-revisión)
- Determinar cuáles de los **doce hilos adicionales** que aún figuran solo en `indices/otras_conversaciones.md` son relevantes para el POS. La segunda revisión incorporó seis de los 18 hilos del índice. [Conversaciones de la segunda revisión](README.md#fuentes-originales-de-la-segunda-revisión)
- Cotejar los artefactos pertinentes entre los **cinco que siguen sin HTML** del primer índice `indices/artefactos.json`. El segundo paquete recuperó un HTML por cada uno de otros tres artefactos. Sus demás versiones históricas quedan por revisar si son relevantes para el POS. [Artefactos revisados](README.md#artefactos-históricos)
- Registrar la procedencia de nuevas fuentes pertinentes si se recuperan. La recuperación histórica parcial queda registrada en el cierre operativo de v2.35. [Estado y criterios de incorporación](README.md)
