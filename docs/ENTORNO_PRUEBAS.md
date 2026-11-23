# Laboratorio local de Punto-de-Venta (Firebase emulado)

El POS publicado en GitHub Pages sigue siendo la versión v2.36 y no se modifica.

## Pruebas inmediatas sin Firebase

Abre [POS demostración](https://kdnaskrlos.github.io/Punto-de-Venta/?demo). Los registros ficticios viven en el almacenamiento local de ese navegador; no se sincronizan entre dispositivos ni escriben en Firestore.

## Pruebas más completas (Authentication y Firestore)

En una copia del repositorio de desarrollo, con Git instalado, ejecuta:

```bash
node scripts/preparar-entorno-local.cjs ../Punto-de-Venta-LAB
cd ../Punto-de-Venta-LAB
```

El preparador crea una **carpeta nueva** fuera del repositorio, modifica solo esa copia, reemplaza la configuración de Firebase por `demo-pos-local`, conecta Authentication y Firestore a los emuladores en `127.0.0.1` y desactiva el service worker en el LAB. No toca GitHub ni Firebase operativo.

Terminal 1 (en la carpeta LAB):

```bash
npx --yes firebase-tools@15.0.0 emulators:start --project demo-pos-local --only auth,firestore
```

Terminal 2 (en la carpeta LAB):

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000/` y crea el administrador de prueba. La interfaz de los emuladores está en `http://127.0.0.1:4000/`.

Se necesitan **Node.js, Python 3 y Java**, además de Internet para descargar las herramientas y servir los módulos de Firebase de Google CDN. No existe soporte de sincronización entre dispositivos externos en esta configuración `localhost`; para ello se debe preparar otro proyecto Firebase de pruebas con controles de acceso y reglas verificadas.

## Alcance y precauciones

- El laboratorio usa el mismo código de negocio y `firestore.rules` del repositorio, pero datos sintéticos en emuladores.
- Si el laboratorio se abre en otra dirección distinta de `localhost` o `127.0.0.1`, la inicialización de Firebase se bloquea.
- No conectes una copia del LAB con una configuración de Firebase productiva ni publiques su `config.js`.
- No reutilices cuentas ni PIN reales en las pruebas.
- Si se detienen los emuladores, los datos se pierden a menos que se haga una exportación controlada; no hay borrado del proyecto real.
- La PWA publicada y los datos locales de la URL pública permanecen separados por origen de los datos del LAB.
- Las suites con emuladores requieren instalación local y deben ejecutarse antes de declarar verificados los permisos y la sincronización.
