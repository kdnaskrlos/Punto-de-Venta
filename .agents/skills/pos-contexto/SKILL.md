---
name: pos-contexto
description: Recupera y mantiene el contexto permanente del proyecto Punto-de-Venta Comic Shop. Úsala al comenzar o continuar tareas del POS, revisar cambios de Codex, preparar prompts, cerrar una iteración o retomar trabajo en otro chat. Lee AGENTS.md, docs/ESTADO_ACTUAL.md y docs/BITACORA.md sin pedir que se adjunten.
---

# POS — contexto operativo persistente

## Inicio de cualquier tarea en este repositorio
1. Verifica repositorio y rama actuales. Contrasta el checkout con `origin/main`, base del código fuente, y con la versión que sirve GitHub Pages.
2. Lee `AGENTS.md` **íntegro**. Es el contrato de trabajo, pero si contradice código o evidencia reciente, informa de la discrepancia.
3. Lee `docs/ESTADO_ACTUAL.md` **íntegro** para identificar alcance, versión publicada, PR, riesgos, bloqueo y siguiente paso.
4. Lee las últimas entradas de `docs/BITACORA.md` (máximo 20–30 líneas recientes); consulta entradas anteriores solo si son relevantes.
5. Comprueba mediante Git el estado real de cambios, PR y CI. El resumen de memoria no demuestra por sí solo que una prueba se ejecutó.
6. Localiza el módulo en el [plan maestro](../../../docs/PLAN_MAESTRO.md). Consulta el índice del [catálogo](../../../docs/ESCENARIOS_COMERCIALES.md) y busca los IDs o palabras clave de la tarea y sus dependencias con `rg`. Lee solo esas definiciones, su seguimiento y las decisiones vinculadas.
7. Para decisiones comerciales, consulta el [registro de reglas](../../../docs/REGLAS_COMERCIALES.md) y abre la fuente de aprobación cuando sea necesaria. La memoria histórica y el código sirven como evidencia del alcance que documentan.

Si falta algún archivo, **no inventes su contenido**. Créalo a partir del estado comprobado y señala lo que requiera confirmación. Mantén `AGENTS.md` existente; jamás lo sobrescribas con un resumen genérico.

## Durante la implementación
- Aplica cambios mínimos y acotados a la tarea solicitada.
- Usa la versión oficial en GitHub Pages como referencia operativa. Parte de `main` y verifica la revisión publicada en cada ronda, con autorización expresa para un nuevo despliegue.
- La conexión a Firebase real requiere autorización y credenciales seguras. No despliegues Functions/reglas, no borres datos ni hagas pruebas con escrituras sin autorización explícita.
- Separa hechos comprobados, hipótesis y decisiones pendientes.
- No afirmes que un test del emulador valida Firebase real. Los fallos históricos de PWA deben permanecer visibles.

## Mantener el catálogo vivo

- Registra nuevos escenarios cuando el propietario lo solicite. Busca candidatos por descripción, sinónimos, módulo, comportamiento y efecto, incluso entre reemplazados y descartados. Si ya existe el mismo caso, enlázalo o actualiza su alcance; conserva por separado los casos con criterios diferentes aunque compartan servicio.
- Asigna el siguiente ID consecutivo libre a partir de **ESC-181**, comprobando el último ID de todas las categorías. Usa el mismo esquema para POS, tienda online, Pedidos Personalizados, producción y otros módulos. Mantén un índice central con los rangos y un ancla por ID si el catálogo se separa por categoría. El catálogo queda exento del límite de 200 líneas.
- Registra módulo, estado verificable, prioridad, dependencias, fecha y evidencia de cada escenario revisado. La prioridad orienta la planificación. Los diagnósticos de origen y las propuestas se conservan como antecedentes. Para marcar **Implementado**, exige evidencia de código y pruebas que cubran el alcance; si solo cubren una parte, registra **Parcial** con el límite concreto.
- Al ampliar un escenario, conserva su ID, registra fecha, decisión, autor, motivo, cambios de alcance y enlace a la revisión anterior. Si se reemplaza o descarta, conserva su definición y estado histórico y enlaza los sucesores cuando existan. Los IDs nunca se eliminan ni se reutilizan.
- Registra las aprobaciones comerciales explícitas en el [registro de reglas](../../../docs/REGLAS_COMERCIALES.md) con fuente, vigencia, alcance, permisos y excepciones. Si falta aprobación, registra una propuesta o decisión pendiente.
- Vincula cambios de código y pruebas a los IDs aplicables en el PR o commit y en el seguimiento del escenario. Al cerrar cada iteración, actualiza el estado, dependencias y evidencia de los casos afectados; registra lo que falte verificar.

## Cierre obligatorio de cada ronda
1. Ejecuta y registra las pruebas pertinentes; si no puedes ejecutarlas, indica por qué.
2. Actualiza `docs/ESTADO_ACTUAL.md`: una sola próxima acción concreta, estado real de CI, hechos terminados y bloqueos; elimina información caducada.
3. Añade a `docs/BITACORA.md` una entrada de **3–5 líneas** con fecha, cambio, verificación, riesgo y siguiente paso.
4. Mantén AGENTS.md, estado y bitácora en **máximo 200 líneas** (preferiblemente 150). Resume entradas antiguas de la bitácora sin borrar referencias esenciales; nunca elimines reglas comerciales permanentes.
5. Incluye estos dos documentos en el mismo commit/PR del trabajo. Si una tarea es solo lectura, no hagas un commit innecesario: entrega un diagnóstico e indica que no hubo cambios.
6. Responde con los archivos modificados, resultado real de las pruebas, riesgos abiertos y **qué debe hacer exactamente el propietario**.

## Invocación
El usuario puede escribir: «Usa `$pos-contexto` y continúa el POS» o «Lee la memoria del repositorio y retoma el próximo pendiente».

Esta skill es un **procedimiento**, no una copia estática de los documentos. Siempre lee su versión actual en el repositorio.
