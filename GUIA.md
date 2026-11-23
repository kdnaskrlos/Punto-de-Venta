# Guía de instalación · Comic Shop · Punto de Venta

Esta guía se sigue **una sola vez**. Toma unos 20 minutos. Mientras no la completes, el enlace del punto de venta abre en **modo demostración** con productos de ejemplo, así que puedes probarlo antes.

---

## 1. Publicar la app en GitHub Pages

La instalación debe conservar el origen y la ruta `/Punto-de-Venta/`. La fuente de Pages debe servir el árbol estático **preparado para publicar**. La raíz de este repositorio es el árbol de desarrollo y contiene módulos nuevos en las URL que todavía usa v2.35. Si Pages publica automáticamente `main`, verifica la fuente de publicación antes de integrar cambios de la PWA.

Desde la raíz del repositorio, con el historial de Git disponible, prepara un directorio nuevo:

```bash
node scripts/preparar-publicacion.cjs /ruta/al/artefacto-nuevo
```

Para una publicación posterior, pasa el último artefacto como segundo argumento. Así se incluyen las rutas versionadas que siguen usando otras instalaciones:

```bash
node scripts/preparar-publicacion.cjs /ruta/al/artefacto-nuevo /ruta/al/artefacto-anterior
```

El comando conserva las rutas que necesita v2.35 y emite el prefijo, la caché y la huella de la nueva publicación. El POS sigue abriendo en **https://kdnaskrlos.github.io/Punto-de-Venta/** con el mismo alcance de instalación.

### Transición desde v2.35

1. Sirve primero el directorio `versiones/` y el grafo compatible de las rutas históricas. Mantén los `index.html` y `sw.js` activos durante esta preparación. Verifica por HTTPS el contenido que servirá Pages.
2. Promueve juntos el `index.html` y el `sw.js` del artefacto verificado. Comprueba la instalación y la recuperación en terminales piloto. Conserva las rutas históricas y las publicaciones anteriores.
3. Si v2.35 muestra **¿Continuar venta?**, pulsa **Continuar** en esa misma pestaña y comprueba las prendas y los pagos en el carrito. Si hay trabajo distinto en varias pestañas de una misma cuenta, termina esas operaciones antes de actualizar. v2.35 comparte un solo borrador por cuenta.
4. Si las pestañas todavía ejecutan el módulo original de v2.35, cierra primero las que estén vacías y deja abierta la que muestra el carrito retomado. Al cerrarse, una pestaña antigua vacía puede borrar la copia compartida. La pestaña que aún tiene el carrito abierto en v2.35 vuelve a guardar su contenido cuando se cierra al final. Con la actualización descargada, cierra esa última pestaña, abre el POS y comprueba que el borrador se puede retomar.
5. Si la descarga se rechaza, conserva el worker activo y repón los recursos completos. Si el problema aparece después de activar, prepara el último código estable con las rutas de ambas publicaciones y un worker de transición. Conserva el origen, el alcance, las cachés y los datos locales. El worker original de v2.35 elimina otras cachés al activarse y queda fuera del procedimiento de reversión.

Un worker en espera no puede leer el almacenamiento local de las pestañas antiguas ni cambiar su código en ejecución. Si no puedes confirmar qué código cargaron las pestañas, termina las operaciones abiertas antes de cerrarlas. Una pestaña vacía que ya cargó el módulo compatible deja intacto el borrador compartido al cerrarse.

En cada promoción o reversión, usa la configuración pública y las fotos vigentes. La subida de fotos del POS escribe en la rama predeterminada de GitHub. Si Pages pasa a servir un artefacto generado, su proceso de publicación debe incorporar los cambios de `fotos/` de esa rama.

## 2. Crear el proyecto de Firebase

1. Entra a **https://console.firebase.google.com** con tu cuenta de Google.
2. Toca **Agregar proyecto** y nómbralo **Punto de Venta Comic Shop**. Google Analytics no hace falta.
3. Dentro del proyecto, toca el ícono **</>** ("Web") para registrar una app. Ponle de nombre **Punto de Venta** y **no** marques Hosting.
4. Firebase te muestra un bloque `firebaseConfig = { apiKey: "...", ... }`. **Déjalo abierto**: lo usas en el paso 5.

## 3. Activar la entrada con usuario y PIN

1. En el menú: **Compilación → Authentication → Comenzar**.
2. En **Método de acceso** activa **Correo electrónico/contraseña** (solo la primera opción) y guarda.

La app convierte cada usuario en un correo interno y el PIN en su contraseña. Nadie tiene que crear un correo real.

## 4. Crear la base de datos y publicar las reglas

1. En el menú: **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: **nam5 (Estados Unidos)**. Modo: **producción**.
3. Ve a la pestaña **Reglas**, borra todo, pega **todo** el contenido del archivo `firestore.rules` de este repositorio y toca **Publicar**.

## 5. Conectar la app con Firebase

1. En GitHub abre el archivo **config.js** y toca el lápiz para editarlo.
2. Reemplaza `export const firebaseConfig = {};` por los datos del paso 2, así:

```js
export const firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…"
};
```

3. Guarda la configuración pública en el árbol fuente y vuelve a preparar el artefacto antes de publicarlo. Estos datos son públicos por diseño. Las reglas del paso 4 protegen la información.

## 6. Primer ingreso: tú como administrador

1. Abre **https://kdnaskrlos.github.io/Punto-de-Venta/**. Recarga si todavía ves el modo demostración.
2. Aparece **Crear administrador**. Escribe tu nombre, tu usuario (minúsculas, sin espacios) y un PIN de 4 números.
3. Ya dentro, ve a **Ajustes**:
   - **Tasas:** escribe los pesos por dólar y elige cómo se toma la tasa de bolívares (Binance con recargo, BCV o manual).
   - **Usuarios:** crea a tu esposa como **Encargada** y a la vendedora como **Vendedora**, cada una con su PIN. Envíales el enlace, su usuario y su PIN.

## 7. Cargar los productos

1. Primero, en tu herramienta de **Carga Masiva**, sube el inventario a GitHub, como siempre.
2. En el punto de venta (en la PC) ve a **Inventario → Importar**. Revisa la vista previa y toca **Aplicar**.
3. Las existencias iniciales salen del archivo. Después, el punto de venta lleva las existencias: volver a importar actualiza precios, costos y códigos, pero **no** cambia las existencias.

## 8. Fotos de los productos

Para subir fotos, el punto de venta necesita un permiso de GitHub que **solo** puede escribir en este repositorio:

1. En GitHub: tu foto de perfil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories* → **Punto-de-Venta**.
3. **Permissions → Repository permissions → Contents:** *Read and write*. Ninguno más.
4. Genera el token y cópialo.
5. En el punto de venta: **Inventario → Fotos**, arrastra la carpeta y toca **Subir fotos**. La primera vez te pide el token: pégalo. Queda guardado **solo en ese navegador**.

Nombra cada foto como el modelo y el color: por ejemplo `Franela AS Niño Blanco.jpg`. Las que no coincidan las puedes asignar a mano.

## 9. Instalar en los teléfonos

- **Android (Chrome):** abre el enlace → menú ⋮ → **Instalar app** o **Agregar a pantalla principal**.
- **PC (Chrome):** el ícono de instalar aparece al final de la barra de direcciones.

---

### Si algo no funciona

- **"Sin conexión" todo el tiempo:** revisa que `config.js` tenga los datos correctos (paso 5).
- **"No se pudo guardar" al vender:** revisa que publicaste las reglas completas (paso 4).
- **Una foto no aparece:** GitHub Pages tarda uno o dos minutos en publicarla.
