# Memoria del proyecto

**La migración operativa de Claude a Codex para Punto-de-Venta v2.35 se considera completada. El historial original se recuperó parcialmente.** Esta memoria recoge las instrucciones, decisiones y funcionalidades verificadas en la revisión `81f469b`, y mantiene abiertos los criterios del Bloque 3, la discrepancia sobre descuentos y la verificación de Firebase desplegado. [Versión](../../js/version.js) · [Pendientes](PENDIENTES.md)

La primera revisión cotejó dos transcripciones de `PAQUETE_REVISION_CLAUDE_CODEX.zip`. La segunda incorporó hallazgos de dos memorias, seis conversaciones y tres archivos HTML de `PAQUETE_2_MEMORIA_CLAUDE_CODEX.zip`. El código y la documentación de v2.35 permiten comprobar la implementación. Las referencias a los ZIP identifican las fuentes históricas por su nombre y ruta interna.

## Índice

| Archivo | Contenido |
| --- | --- |
| [Decisiones](DECISIONES.md) | Decisiones vigentes, antecedentes reemplazados y asuntos pendientes de confirmación. |
| [Funcionalidades](FUNCIONALIDADES.md) | Flujos implementados y archivos donde se pueden comprobar. |
| [Pendientes](PENDIENTES.md) | Bloque 3 aprobado y pendiente de implementación, trabajo futuro y fuentes faltantes. |
| [Instrucciones para agentes](../../AGENTS.md) | Instrucciones operativas verificadas para trabajar en el repositorio. |

## Fuentes del proyecto

- [Registro de construcción y decisiones de fase 1](../superpowers/decisiones-fase1.md)
- [Plan de construcción de fase 1](../superpowers/plans/2026-11-12-punto-de-venta-fase1.md)
- [Especificación de diseño de fase 1](../superpowers/specs/2026-11-12-punto-de-venta-fase1-design.md)
- [Notas de una fase futura para Pedidos](../superpowers/specs/2026-11-14-pedidos-en-pos-notas.md)
- [Guía de instalación](../../GUIA.md) y [lista de comprobación de Firestore](../../pruebas/REGLAS.md)

## Conversaciones del POS

Cada referencia remite al encabezado `Mensaje N` de la transcripción original del primer ZIP. Algunas entradas contienen bloques que la exportación omitió.

### Punto de venta para tienda de ropa

`conversaciones/Punto_de_venta_tienda_ropa.md`. Contiene el diseño inicial de la fase 1 y las decisiones sobre clientes, caja, permisos y el contrato con la Carga Masiva.

### POS Comic Shop

`conversaciones/POS_Comic_Shop.md`. Continúa el trabajo de fase 1, documenta la auditoría y recoge los cambios hasta v2.35 y la aprobación para continuar con el Bloque 3.

## Fuentes originales de la segunda revisión

Las rutas siguientes son internas a `PAQUETE_2_MEMORIA_CLAUDE_CODEX.zip`. Para las conversaciones en JSON, los mensajes se identifican con el campo `numero`.

### Memoria original del POS

`memorias/punto-de-venta.md`. Recoge acuerdos sobre el inventario único, formas de pago, tramos, diseño, Pedidos y Bloque 3. Se contrastó con el código y el historial para distinguir decisiones vigentes de apuntes reemplazados, como las fotos por SKU.

### Preferencias originales

`memorias/preferences.md`. Recoge preferencias de interfaz, versionado y revisión de bocetos. Para el POS se aplican los criterios verificados contra sus propios estilos y decisiones. El alcance de las referencias de espaciado y del flujo de aprobación queda por confirmar. [Referencias y decisiones por confirmar](PENDIENTES.md#referencias-y-decisiones-por-confirmar)

### Software carga masiva inventario

`conversaciones/software-carga-masiva-inventario.json`. Los mensajes 133, 147 y 184–202 permiten seguir la evolución del archivo de inventario y su consumo manual por el POS. Los mensajes 206–213 identifican a Stock como referencia visual. Carga Masiva y Stock son herramientas separadas del POS.

### Software de precios por volumen

`conversaciones/software-de-precios-por-volumen.json`. Los mensajes 169–170 y 247–252 describen el tratamiento de productos «separado» en el Tarifario y su relación con Carga Masiva. Las preferencias de edición y guardado del Tarifario pertenecen a esa herramienta.

### Conversaciones de Pedidos y Taller

| Conversación | Archivo y alcance |
| --- | --- |
| Software para pedidos personalizados | `conversaciones/software-para-pedidos-personalizados.json`. Contexto de la aplicación independiente y de sus flujos de pedidos. Mensajes 1, 38 y 477. |
| Comic Shop · Pedidos | `conversaciones/comic-shop-pedidos.json`. El mensaje 4 distingue el artefacto histórico de la aplicación alojada por separado. |
| Pantalla de resumen de pedido | `conversaciones/pantalla-de-resumen-de-pedido.json`. Los mensajes 3–16 describen un boceto de entrega y pagos, como referencia para la futura integración de Pedidos. |
| Software para taller de sublimación | `conversaciones/software-para-taller-de-sublimaci-n.json`. Herramienta independiente de planificación de producción por cliente, talla y pieza. Mensajes 1–4 y 299–305. |

### Artefactos históricos

El índice `INDICE_ARTEFACTOS.json` identifica los tres HTML entregados en `artefactos_referencia/`. Son referencias históricas de sus respectivos proyectos.

- **Stock Comic Shop.** Referencia de búsqueda, escáner y detalle de inventario.
- **Carga Masiva Comic Shop.** Plantilla histórica de 51 columnas y cuatro tramos, anterior al contrato actual con el POS.
- **Comic Shop · Pedidos.** Página de acceso a la aplicación independiente con historial de versiones.

## Incorporación de memoria histórica

Registra cada entrada con su fecha, fuente y estado. Usa **vigente** para decisiones respaldadas por v2.35, **reemplazada** cuando se identifica la decisión posterior, **aprobada y pendiente de implementación** cuando existe una aprobación verificable y **pendiente de confirmación** cuando falta validar el alcance o la vigencia. Si hay una discrepancia, conserva las referencias al mensaje y al archivo que muestran la diferencia.

Limita este directorio a resúmenes del proyecto aptos para publicación. Conserva las exportaciones originales y las preferencias generales en un espacio privado fuera del repositorio. Excluye datos personales y credenciales de los resúmenes.

Quedan por revisar cuatro memorias que solo figuran en el primer índice, los hilos pertinentes entre los doce adicionales que aún carecen de transcripción y los artefactos relevantes entre los cinco que aún carecen de HTML. De los tres artefactos recuperados se recibió una versión de cada uno. [Fuentes pendientes](PENDIENTES.md#incorporación-de-memoria)
