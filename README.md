# ACARS Dispatch — AirNubeiro PWA

App de dispatch TELEX/CPDLC para controladores virtuales IVAO.  
Creado por Varo para AirNubeiro.

## Archivos

```
├── index.html        ← La app (todo en un archivo)
├── manifest.json     ← Configuración PWA (nombre, iconos, colores)
├── sw.js             ← Service Worker (caché offline)
├── icons/
│   ├── icon.svg      ← Icono fuente (vectorial)
│   ├── icon-192.png  ← Icono app 192x192
│   └── icon-512.png  ← Icono app 512x512
└── README.md         ← Este archivo
```

## Despliegue en GitHub Pages (gratis, 5 minutos)

### 1. Crear cuenta en GitHub
- Ve a https://github.com/signup
- Crea una cuenta gratuita (email + contraseña)

### 2. Crear repositorio
- Pulsa el botón **"+"** arriba a la derecha → **"New repository"**
- Nombre: `acars-dispatch` (o el que quieras)
- Visibilidad: **Public** (necesario para GitHub Pages gratis)
- Marca **"Add a README file"** → desmarcar (ya tienes uno)
- Pulsa **"Create repository"**

### 3. Subir archivos
- En la página del repo vacío, pulsa **"uploading an existing file"**
- Arrastra TODOS los archivos de esta carpeta (index.html, manifest.json, sw.js, carpeta icons/)
- ⚠️ **IMPORTANTE**: La carpeta `icons/` tiene que subirse como carpeta, no los archivos sueltos
  - Opción A: Arrastra la carpeta entera al navegador
  - Opción B: Usa GitHub Desktop (más fácil para carpetas)
- Escribe un mensaje de commit: "Initial release v3.4"
- Pulsa **"Commit changes"**

### 4. Activar GitHub Pages
- Ve a **Settings** (pestaña arriba del repo)
- En el menú lateral, pulsa **"Pages"**
- En "Source", selecciona **"Deploy from a branch"**
- Branch: **main** / **/ (root)**
- Pulsa **Save**
- Espera 1-2 minutos

### 5. Tu app está online
- URL: `https://TU-USUARIO.github.io/acars-dispatch/`
- Comparte esta URL con los pilotos de AirNubeiro

## Instalar como app en el móvil

### iPhone / iPad (Safari)
1. Abre la URL en Safari
2. Pulsa el botón de compartir (□↑)
3. Pulsa **"Añadir a pantalla de inicio"**
4. Confirma → aparece el icono en tu escritorio

### Android (Chrome)
1. Abre la URL en Chrome
2. Pulsa los 3 puntos (⋮) arriba a la derecha
3. Pulsa **"Instalar app"** o **"Añadir a pantalla de inicio"**
4. Confirma → aparece como app instalada

### PC / Mac (Chrome / Edge)
1. Abre la URL en Chrome o Edge
2. Aparecerá un icono de "instalar" en la barra de direcciones
3. O ve a ⋮ → "Instalar ACARS Dispatch..."

## Actualizar la app

1. Edita los archivos en tu repositorio de GitHub
2. Cambia el valor de `CACHE_NAME` en `sw.js` (ej: de `an-acars-v3.4` a `an-acars-v3.5`)
3. Haz commit → GitHub Pages se actualiza automáticamente
4. Los usuarios recibirán la nueva versión al abrir la app

## Notas técnicas

- La app funciona SIN conexión para la interfaz (los botones, tabs, etc.)
- Las funciones que necesitan red (Hoppie, SimBrief, IVAO) requieren conexión a internet
- El CORS proxy (`corsproxy.io`) es necesario porque Hoppie no permite peticiones desde navegador
- Configuración, mensajes e historial se guardan en LocalStorage del dispositivo
