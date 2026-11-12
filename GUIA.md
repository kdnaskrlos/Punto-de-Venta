# Guía de instalación · Comic Shop · Punto de Venta

Esta guía se sigue **una sola vez**. Toma unos 20 minutos. Mientras no la completes, el enlace del punto de venta abre en **modo demostración** con productos de ejemplo, así que puedes probarlo antes.

---

## 1. Publicar la app en GitHub Pages

1. Entra a tu repositorio **Punto-de-Venta** en GitHub.
2. Ve a **Settings → Pages**.
3. En **Source** elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Toca **Save**.
4. Espera uno o dos minutos. La app queda en:
   **https://kdnaskrlos.github.io/Punto-de-Venta/**

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

3. Toca **Commit changes**. Estos datos son públicos por diseño: lo que protege la información son las reglas del paso 4.

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
