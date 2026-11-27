# Publicación definitiva de POS v2.43.2

El POS público conserva [su URL de GitHub Pages](https://kdnaskrlos.github.io/Punto-de-Venta/) y el alcance `/Punto-de-Venta/`. Se comprobó que el HTML, el worker, la configuración, el manifiesto y los módulos muestreados coinciden con la v2.42 del commit estático `0c3c7983fb288acc475ff4b44bcf071ea40df0f2`. El piloto v2.43.2 de Firebase Hosting es la evidencia funcional en PC y Android.

## Antes de autorizar

1. **Conciliación operativa indispensable.** Coordina una pausa de cobros y revisa cada terminal, cuenta y origen usado para operar, incluido el piloto. Conecta las terminales y confirma que la cola haya quedado vacía, o que cada operación tenga un resultado verificable con su ID original. Para ventas procesadas, contrasta `usuarios/{uid}/solicitudesVenta/{id}` con `usuarios/{uid}/operacionesCobro/venta:{id}` y `ventas/{id}`. Una marca rechazada requiere revisar el conflicto asociado. Para la ruta histórica, verifica la venta o el abono por ID y, si la cuenta cambió de UID, comprueba también el UID anterior. Revisa pendientes de apartados y liquidaciones cuando se hayan usado durante las pruebas. Una terminal ausente, un cobro indeterminado, un duplicado o una escritura parcial bloquea el corte. Las ventas de prueba ya documentadas como V-0004, V-0006 y V-0007 no requieren otro cobro.
2. **Instalaciones antiguas.** Si hay una v2.35 abierta, sigue la migración supervisada antes de cerrar pestañas. Identifica el carrito en la sesión que lo conserva, registra y termina o cancela explícitamente el trabajo abierto y concilia sus cobros. Cierra todas las pestañas después. Los fallos históricos 04 y 05 siguen vigentes en el código antiguo. Para v2.42 deja que el nuevo worker complete la instalación y cierra la última ventana solo con las operaciones conciliadas. En ambos casos reabre desde el mismo origen, sin borrar almacenamiento ni reinstalar. [Migración supervisada](VALIDACION-FINAL-V243.md#puerta-de-migración-supervisada-desde-v235)
3. **Respaldo y fuente de Pages.** Verifica un respaldo recuperable y vigente de Firestore `(default)` del proyecto `punto-de-venta-comic-shop` y registra su referencia y fecha. La aceptación anterior de operar sin respaldo cubría las pruebas sintéticas. En **Settings → Pages** confirma que se publica desde la raíz de `release/pos-v2.42-candidata`, separada de `main`. El procedimiento repite esa lectura con `gh api`. Si la fuente no coincide, detén la integración y verifica la configuración efectiva antes de ajustar el procedimiento. El push de la rama estática debe estar permitido para la cuenta que autoriza.

Se pueden aplazar la repetición de las matrices ya aprobadas para el alcance funcional, la ampliación de la matriz sintética a más casos de estrés, la retirada de las rutas de clientes antiguos y el trabajo sobre los registros de prueba. Si una ruta histórica presenta una diferencia de datos o un cobro indeterminado, aplica el primer criterio.

Antes de autorizar el corte, confirma con el nuevo candidato en un origen de prueba que Chrome puede instalar el worker nuevo desde un perfil controlado por v2.42 con caché incompleta. Si la actualización aún no aparece, usa **Update** con el worker nuevo disponible en ese origen. Tras resguardar el trabajo, cierra el último cliente antiguo y reabre desde el mismo perfil. Comprueba un arranque con red, otro sin red y la conservación de borradores y pendientes. El worker nuevo verifica huellas antes de reparar su caché. Si faltan recursos y sigue sin red, muestra un 503 con reintento manual. [Recuperación](RECUPERACION-PWA.md)

## Publicar con autorización

Desde un checkout del PR #21 con Git, Node.js, curl y GitHub CLI autenticados para leer Pages, integrar el PR y escribir en la rama estática, ejecuta el siguiente comando. Si Git por HTTPS aún no usa la sesión de GitHub CLI, configúralo con `gh auth setup-git`. Sustituye el valor por el SHA completo aprobado de la rama de integración.

```bash
bash scripts/publicar-v2432.sh publicar SHA_COMPLETO_APROBADO
```

El procedimiento valida la fuente y los puntos de entrada públicos y pide escribir `PUBLICAR v2.43.2` antes de realizar cambios. Quita el estado de borrador si sigue activo, espera la CI, integra el SHA autorizado y comprueba que el código de la PWA en `main` corresponda a ese SHA. Prepara el paquete con `ventasAtomicas: true`, conserva los prefijos y rutas históricas, precarga el prefijo nuevo y verifica sus bytes en Pages antes de publicar los nuevos puntos de entrada juntos. Una exigencia de revisión o protección de rama se satisface en GitHub antes de volver a ejecutar el procedimiento.

Tras la publicación, abre la URL pública en una terminal conciliada y comprueba v2.43.2, sesión, reinicio sin red y estado de ventas, caja e inventario preexistentes. Amplía a las demás terminales cuando esa comprobación esté completa.

## Reversión

Si la versión pública requiere volver a v2.42, pausa los cobros y concilia las colas de v2.43.2 por ID antes de cambiar de worker. Desde el mismo checkout ejecuta `bash scripts/publicar-v2432.sh revertir` y escribe `REVERTIR v2.42` cuando se solicite. Se restauran juntos `index.html`, `sw.js` y la configuración raíz de v2.42, con ambos grafos y las fotos vigentes disponibles. Comprueba la versión y el estado de las operaciones al reabrir. v2.42 mantiene su limitación ante una caché incompleta. Si falla tras la reversión, aplica la recuperación con el registro del POS y conserva los datos del origen. El procedimiento actúa sobre GitHub Pages. Firebase conserva las ventas y sus marcas durante toda la operación. [Recuperación](RECUPERACION-PWA.md)
