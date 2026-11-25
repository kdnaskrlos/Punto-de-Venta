---
name: pos-contexto
description: Recupera y mantiene el contexto permanente del proyecto Punto-de-Venta Comic Shop. Úsala al comenzar o continuar tareas del POS, revisar cambios de Codex, preparar prompts, cerrar una iteración o retomar trabajo en otro chat. Lee AGENTS.md, docs/ESTADO_ACTUAL.md y docs/BITACORA.md sin pedir que se adjunten.
---

# POS — contexto operativo persistente

## Inicio de cualquier tarea en este repositorio
1. Verifica repositorio y rama actuales. No asumas que estás en `main` ni que un trabajo de Codex Web ya se publicó.
2. Lee `AGENTS.md` **íntegro**. Es el contrato de trabajo, pero si contradice código o evidencia reciente, informa de la discrepancia.
3. Lee `docs/ESTADO_ACTUAL.md` **íntegro** para identificar alcance, versión publicada, PR, riesgos, bloqueo y siguiente paso.
4. Lee las últimas entradas de `docs/BITACORA.md` (máximo 20–30 líneas recientes); consulta entradas anteriores solo si son relevantes.
5. Comprueba mediante Git el estado real de cambios, PR y CI. El resumen de memoria no demuestra por sí solo que una prueba se ejecutó.
6. Para decisiones de negocio ambiguas, consulta `docs/memoria/` y documentos especializados, sin inventar parámetros.

Si falta algún archivo, **no inventes su contenido**. Créalo a partir del estado comprobado y señala lo que requiera confirmación. Mantén `AGENTS.md` existente; jamás lo sobrescribas con un resumen genérico.

## Durante la implementación
- Aplica cambios mínimos y acotados a la tarea solicitada.
- Mantén la v2.42 publicada; desarrolla v2.43 en `integracion/pos-auditoria` hasta aprobación expresa.
- La conexión a Firebase real requiere autorización y credenciales seguras. No despliegues Functions/reglas, no borres datos ni hagas pruebas con escrituras sin autorización explícita.
- Separa hechos comprobados, hipótesis y decisiones pendientes.
- No afirmes que un test del emulador valida Firebase real. Los fallos históricos de PWA deben permanecer visibles.

## Cierre obligatorio de cada ronda
1. Ejecuta y registra las pruebas pertinentes; si no puedes ejecutarlas, indica por qué.
2. Actualiza `docs/ESTADO_ACTUAL.md`: una sola próxima acción concreta, estado real de CI, hechos terminados y bloqueos; elimina información caducada.
3. Añade a `docs/BITACORA.md` una entrada de **3–5 líneas** con fecha, cambio, verificación, riesgo y siguiente paso.
4. Mantén cada archivo en **máximo 200 líneas** (preferiblemente 150). Resume entradas antiguas de la bitácora sin borrar referencias esenciales; nunca elimines reglas comerciales permanentes.
5. Incluye estos dos documentos en el mismo commit/PR del trabajo. Si una tarea es solo lectura, no hagas un commit innecesario: entrega un diagnóstico e indica que no hubo cambios.
6. Responde con los archivos modificados, resultado real de las pruebas, riesgos abiertos y **qué debe hacer exactamente el propietario**.

## Invocación
El usuario puede escribir: «Usa `$pos-contexto` y continúa el POS» o «Lee la memoria del repositorio y retoma el próximo pendiente».

Esta skill es un **procedimiento**, no una copia estática de los documentos. Siempre lee su versión actual en el repositorio.
