# Publicación definitiva de POS v2.43.2

El corte se hará en el [POS oficial](https://kdnaskrlos.github.io/Punto-de-Venta/), con el mismo origen y alcance `/Punto-de-Venta/`. El código aprobado es `55a66a6a6431269301cd4032d4d7bfb1595d3219`. Incluye `ventasAtomicas: true` y la reparación de caché del Service Worker. La transición en PC y Android se verificará durante la publicación oficial supervisada. [CI del código aprobado](https://github.com/kdnaskrlos/Punto-de-Venta/actions/runs/46073890069)

## Antes de autorizar

1. **Respaldo.** Confirma en Firestore un respaldo vigente y recuperable de `(default)` en `punto-de-venta-comic-shop`. Registra su referencia y fecha. El respaldo del servidor no contiene los carritos o cobros locales de los dispositivos.
2. **Operaciones pendientes.** Pausa los cobros durante el cambio. En cada terminal y cuenta del POS oficial, conecta y verifica que la cola esté vacía o que cada operación tenga un resultado remoto conciliado por su ID original. Para ventas procesadas, comprueba solicitud, marca de `operacionesCobro` y venta o conflicto asociado. Para ventas directas, abonos y liquidaciones comprueba el registro correspondiente. Conserva los borradores y revisa el UID anterior si cambió la cuenta. Detén el corte si queda alguna terminal operativa sin revisar, un cobro indeterminado, un duplicado o una escritura parcial. Registra por separado las colas del piloto, que se cierran antes de retirarlo en su propio origen.
3. **Pages y CI.** En **Settings → Pages**, confirma que se publica desde la raíz de `release/pos-v2.42-candidata`. El procedimiento coteja también los puntos de entrada de v2.42 en la URL oficial y exige el SHA exacto del PR #21 y su CI antes de integrarlo. Si la fuente o el código cambian, detén el corte y revisa la diferencia. Si aún hay una instalación v2.35 activa, concilia sus operaciones y protege el carrito antes de cerrar pestañas. [Migración supervisada](VALIDACION-FINAL-V243.md#puerta-de-migración-supervisada-desde-v235)

## Publicar y verificar

Desde un checkout del HEAD revisado del PR #21 con Git, Node.js, curl y GitHub CLI autenticados para leer Pages, integrar el PR y publicar en su rama estática, ejecuta:

```bash
bash scripts/publicar-v2432.sh publicar "$(git rev-parse HEAD)"
```

Si Git por HTTPS aún no usa la sesión de GitHub CLI, configura `gh auth setup-git`. Escribe `PUBLICAR v2.43.2` al confirmar el corte. El script verifica la fuente de Pages, espera los controles del PR e integra el HEAD verificado en `main`. Prepara el sitio con `ventasAtomicas: true`, conserva el grafo anterior y verifica los bytes del prefijo nuevo en Pages antes de promover juntos el HTML y el worker. El despliegue se limita al sitio estático.

Con los cobros aún en pausa, usa una instalación habitual de PC y una de Android en el POS oficial. Mantén el perfil y el almacenamiento del navegador. Si el nuevo worker queda en espera, conserva el carrito, cierra el último cliente antiguo y vuelve a abrir. Si la actualización aún no aparece, usa **Update** con la publicación disponible. Confirma la versión y el worker activo, la sesión, el carrito, el arranque online y offline y la consulta de inventario, caja y operaciones preexistentes. Habilita el resto de terminales al confirmar ambos dispositivos y revisar que las operaciones conciliadas siguen registradas una sola vez. [Recuperación del worker](RECUPERACION-PWA.md)

## Revertir si falla el corte

Pausa los cobros y concilia por ID cualquier operación iniciada con v2.43.2. Desde el mismo checkout ejecuta `bash scripts/publicar-v2432.sh revertir` y confirma con `REVERTIR v2.42`. Se restauran los puntos de entrada y la configuración raíz de v2.42, conservando ambos conjuntos de recursos y el mismo origen. Verifica v2.42 y los datos al reabrir. La reversión actúa sobre Pages y conserva Firestore y el almacenamiento local. [Recuperación del 503 en v2.42](RECUPERACION-PWA.md)

## Retirar el piloto existente

Una vez confirmada la estabilidad de producción, detén el uso de `piloto-v243`. Revisa cada dispositivo y cuenta que lo usó **en el origen del piloto** y registra el resultado de sus operaciones por ID. Ejecuta la retirada solo con todas sus colas conciliadas. En **Firebase Console → Hosting → Canales de vista previa**, selecciona exclusivamente `piloto-v243` del sitio `punto-de-venta-comic-shop` y elimina ese canal. Si ya expiró, comprueba que esté inactivo. Conserva los registros, las ventas del piloto, el almacenamiento de los dispositivos y GitHub Pages. [Piloto existente](https://punto-de-venta-comic-shop--piloto-v243-n8egt6cf.web.app)
