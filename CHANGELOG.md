# Changelog — AirNubeiro ACARS Suite

Todos los cambios notables del proyecto. Formato: [vX.Y.Z] — YYYY-MM-DD

---

## [v4.7.3] — 2026-11-02

- **FSUIPC: direcciones de offset numéricas**: el servidor WebSocket de FSUIPC espera la dirección como número (`0x0560`), y la app la enviaba como texto (`"0x0560"`). Ahora se envía en el formato documentado.
- Herramienta de diagnóstico `tools/nbv-diag.py` para revisar Hoppie, FSUIPC e IVAO durante un vuelo.

---

## [v4.7.2] — 2026-11-02

- **FSUIPC: conexión a `localhost`**: FSUIPCWebSocketServer escucha por defecto en `localhost:2048/fsuipc/` y rechaza las conexiones dirigidas a `127.0.0.1` («Invalid Hostname»). La app usa ahora `ws://localhost:2048/fsuipc/` y corrige sola las configuraciones guardadas con `127.0.0.1`.
- Mensaje de error de FSUIPC con la causa más habitual: el servidor WebSocket no está abierto.

---

## [v4.7.1] — 2026-11-02

- **Proxy personalizado tolerante**: se acepta pegado tal cual (dominio, con o sin `https://`, sin `?url=`); antes una URL sin `?url=` rompía la consulta de Hoppie y la meteo por proxy.
- **Diálogo CPDLC**: lista con el estado de cada autorización enviada (ABIERTO, WILCO, UNABLE, STANDBY, ROGER…) enlazando la respuesta del piloto con su mensaje. Las peticiones del piloto quedan PENDIENTES y el siguiente CPDLC a ese avión se envía como respuesta (referencia MIN/MRN, como en el CPDLC real). Clic en una petición pendiente para responder.
- **Callsign ACARS distinto del de IVAO** (Ajustes): p. ej. IVAO NBV11WT → ACARS NBV011. Lo usan Redactar, los chips de vuelos y los envíos automáticos del OPS Center; la tarjeta del vuelo muestra el callsign ACARS.
- **Aviso de entrega**: tras enviar, la app vigila en Hoppie los mensajes en cola; cuando el avión los recoge suena un aviso, la barra indica «NBV011 ha recibido N mensajes» y en Enviados se añade «Entregado HH:MMZ». También para los mensajes automáticos del OPS Center.

---

## [v4.7.0] — 2026-11-02

- **Estado Hoppie del destino en Redactar**: al escribir o elegir un callsign, la app consulta Hoppie y muestra si el avión está conectado (y en qué red), si está en otra red distinta a tu estación (no recibiría), o si no está conectado (los mensajes quedan en cola 24 h hasta que el avión haga su primera petición). Avisa también si tu propia estación no aparece conectada.
- **Seguimiento de entrega**: número de mensajes pendientes y entregados al destino en las últimas 24 h, según el registro de Hoppie. Se actualiza tras cada envío y cada minuto.

---

## [v4.6.3] — 2026-10-31

- **Proxy de Cloudflare integrado**: la versión web usa por defecto `https://nbv-proxy.ilfuzza.workers.dev/?url=`; no hace falta escribirlo en cada dispositivo (Ajustes → Proxy personalizado sigue permitiendo otro).
- **Worker «nbv-proxy» completo**: el mismo Worker sirve la app y el proxy (`wrangler.jsonc` + `worker.js` en el repositorio). Las peticiones con `?url=` pasan por el proxy con lista blanca de hosts; el resto sirve los archivos de la app.

---

## [v4.6.2] — 2026-10-30

- **METAR y TAF con fuentes de respaldo**: si aviationweather.gov falla o no tiene datos, la app prueba sola VATSIM (METAR) y NOAA (METAR y TAF), y para el TAF también Hoppie. La barra de estado indica cuándo se ha usado una fuente secundaria. Aplica a Meteo, Dispatch, Route Info y a los mensajes automáticos del OPS Center.
- **Hoppie por HTTPS**: TELEX, CPDLC y consultas a Hoppie van por HTTPS y sin proxy (Hoppie admite CORS). En la versión web funcionan aunque no haya Worker configurado.
- **Versión web sin proxy**: aviso informativo (no error) que explica qué funciona y qué necesita el proxy.
- Lista blanca del proxy local y del Worker ampliada a `tgftp.nws.noaa.gov` y `metar.vatsim.net`.

---

## [v4.6.1] — 2026-10-30

Correcciones tras la primera prueba de la 4.6.

- **Interfaz antigua al abrir la 4.6 (Windows)**: el servidor local compartía el puerto 8433 con una versión anterior que siguiera abierta y el navegador acababa en la vieja. Ahora el puerto es exclusivo; si otra versión lo ocupa, el lanzador lo dice con su número de versión y espera a que la cierres. Si es la misma versión, abre el navegador.
- **FSUIPC parpadeando en naranja sin conectar**: FSUIPC WebSocket Server atiende en la ruta `/fsuipc/` y la app conectaba a la raíz. La URL se completa sola (`ws://127.0.0.1:2048` → `ws://127.0.0.1:2048/fsuipc/`), también para configuraciones guardadas. Mensajes claros cuando la conexión no es posible (versión web hacia otro equipo, móvil sin simulador) y el indicador del ACARS refleja el estado real del OPS Center en lugar de quedarse en «conectando».
- **Versión publicada**: admite un proxy por defecto fijado al compilar (`NBV_PROXY`), para no tener que escribirlo en cada móvil.

---

## [v4.6.0] — 2026-10-30

Rediseño completo de la interfaz «Torre de control»: minimalista, con la identidad de AirNubeiro, modo claro y oscuro, y pensada para dejar la estación en servicio.

### Interfaz
- **Nueva estructura**: barra lateral (Flota · Mensajes · Meteo · Dispatch · Ajustes), barra superior con el estado y panel **Redactar** fijo a la derecha (TELEX / CPDLC). En pantallas medianas Redactar se abre como panel lateral; en móvil, navegación inferior y botón flotante **Redactar**.
- **Pantalla de inicio «Flota en vivo»**: el OPS Center integrado sin cabecera duplicada, con indicadores de vuelos por fase, botón Iniciar/Detener monitor, pantalla AOC, ajustes de flota y estado del último escaneo.
- **Tarjetas de vuelo rediseñadas**: ruta con barra de progreso, ALT/GS/ETA/DEST/EET, fuente de datos y mensajes por fase (los pendientes o con error se envían con un clic). **Clic en una tarjeta → Redactar con el destino ya puesto.**
- **Tema claro, oscuro o automático** (sigue al sistema), compartido entre ACARS y OPS Center, sin parpadeo al cargar. Stream Mode y pantalla AOC siempre en modo noche.
- Paleta AirNubeiro (#0070CB) con contraste AA en ambos temas, tipografías Raleway (marca), IBM Plex Sans (interfaz) y JetBrains Mono (datos), iconos SVG en lugar de emoji, logotipo del triskel e iconos PWA nuevos.

### Uso continuado
- **«Pon la torre en servicio»**: lista de 4 pasos (estación Hoppie, monitor, recepción automática, sonido) que desaparece cuando todo está activo y vuelve si algo se apaga.
- **Actividad de hoy**: vuelos atendidos, mensajes enviados y recibidos, y tiempo de servicio del monitor (UTC, compartido entre ventanas sin contar doble).
- **Recepción automática persistente**: si estaba activa, se reanuda al abrir la app. Píldoras de estado *Monitor* y *Recepción* siempre visibles.
- En Redactar, **chips con los vuelos activos** para elegir destino con un clic. Estados vacíos con explicación y acción directa.

### Técnico
- Hoja de estilos compartida `nbv-ui.css` (tokens claro/oscuro); todos los IDs de 4.5 se conservan. `NBV.ui` en el núcleo (iconos, tema, actividad). `opsUiState()` expone el estado del OPS Center a la shell.

---

## [v4.5.0] — 2026-10-30

Mejoras de operación diaria: el monitor sobrevive a una recarga, avisos sonoros por tipo de evento, Route Info por corredor de ruta, webhook de Discord cifrado y plantillas editables.

### Nuevas funciones
- **Estado persistente del OPS Center**: las tarjetas de vuelo, el estado de cada mensaje y su contenido se conservan al recargar la página (vuelos vistos en los últimos 20 min). Los envíos interrumpidos por la recarga quedan como **✗ retry**.
- **Auto-iniciar monitor** (config del OPS Center): *Como estaba al cerrar* (por defecto), *Siempre* o *Nunca*.
- **Avisos sonoros por evento**, sin notificaciones de Windows: TELEX recibido (3 notas ascendentes), CPDLC (doble nota), solicitud de LOGON (insistente), vuelo detectado, cambio de fase y error. Suenan con la ventana en segundo plano tras el primer clic en la app. Modo configurable: *Todos*, *Solo mensajes recibidos y errores* o *Ninguno*; 🔔 silencia todo. Con la pestaña oculta, el título muestra el número de mensajes nuevos: `(2) ✉ …`.
- **Route Info por corredor de ruta**: ATC (CTR/FSS a ≤150 NM), SIGMET y PIREP (a ≤80 NM) a lo largo del tramo que queda hasta destino, en lugar de un círculo de 400 NM alrededor del avión. El destino se localiza con phpVMS, la tabla interna o la API de aeropuertos de aviationweather.gov (cualquier ICAO); si no se encuentra, se proyecta por rumbo y distancia restante.
- **ETA y distancia con datos de IVAO** para cualquier destino: nuevas columnas DIST y ETA en Stream Mode y ETA en las tarjetas del OPS Center.
- **Plantillas editables** (botón **✎ Editar** en Telex y CPDLC; **✎ Bienvenidas y plantillas** en el OPS Center): TELEX, PDC (autorizaciones de salida), CPDLC y bienvenidas por aeropuerto. Variables `{CS}`, `{STN}`, `{UTC}`, `{DEP}`, `{ARR}` (estas dos, del plan de vuelo IVAO del destinatario). Se comparten entre ACARS y OPS Center.

### Seguridad
- **Webhook de Discord cifrado** con AES-256-GCM, igual que la API key de phpVMS. El campo queda vacío tras guardarlo y muestra que hay un webhook cifrado; botón **✕ Borrar webhook**. Las URL en claro de versiones anteriores se migran y se eliminan del almacenamiento solo cuando la copia cifrada ya está guardada. Se rechazan URL que no sean de `discord.com/api/webhooks/`.

### Correcciones y limpieza
- Eliminadas `processMessagesConditional` y `discordNotifyOpsMsg` (unas 60 líneas sin uso que seguían en la 4.4.0) y las antiguas funciones de plantillas fijas.
- Si el cifrado no está disponible (app abierta por IP en lugar de `localhost`), el webhook sigue funcionando en memoria con un aviso, en vez de fallar.

### Validación
- 74 pruebas funcionales contra las APIs reales (47 de la 4.4.0 + 27 nuevas), 0 funciones inalcanzables, 0 identificadores sin declarar.

---

## [v4.4.0] — 2026-10-30

Revisión completa del código y refactor profundo. Recupera todas las funciones que habían dejado de funcionar y unifica la lógica de ACARS y OPS Center en un módulo común.

### Causa raíz de los fallos
- **corsproxy.io retiró el acceso anónimo** (`403 keyless_legacy_url`). Todo el tráfico de ambas apps pasaba por él, por lo que IVAO, Hoppie, METAR/TAF, phpVMS y Discord fallaban a la vez.
- Solución: **`nbv-server.py`**, servidor local con proxy propio en `/proxy` (lista blanca de hosts, solo escucha en 127.0.0.1). `START-ACARS.bat` lo arranca y abre el navegador.
- Enrutado automático (`NBV.net`): IVAO, Hoppie, SimBrief y Discord van **directos** (admiten CORS); aviationweather.gov y phpVMS van por el proxy local. El campo de proxy pasa a ser opcional (Cloudflare Worker para GitHub Pages). El valor heredado de corsproxy.io se limpia solo.

### Funciones restauradas (ReferenceError desde v4.3.3)
- **ROUTE INFO** (pestaña DSP): faltaban `haversineNm` / `isAhead`.
- **CONEXIONES PAX** y **CREW INFO**: faltaban `genPaxConnections` / `genCrewInfo`.
- **STREAM MODE (F11)**: faltaban `mapState`, `APT_COORDS`, `lastOccData`.
- **OPS Center**: el iframe tenía `loading="lazy"` dentro de una pestaña oculta → el monitor no arrancaba hasta abrir OCC. Ahora carga al inicio.

### Bugs corregidos
- **Frecuencias ATC**: IVAO v2 da MHz (`118.555`); se mostraban como `0.119`.
- **EET**: `flightPlan.eet` está en segundos; vuelos de menos de 2h45 se leían como HHMM (1h → 36h), rompiendo el ROUTE INFO de mitad de vuelo.
- **Delay report**: `departureTime` está en segundos desde 00Z; generaba retrasos absurdos.
- **Fase de vuelo**: tras aterrizar, el estado IVAO `On Blocks` devolvía el vuelo a PREFLIGHT. Ahora se mantiene LANDED; una nueva pierna con plan distinto reinicia el ciclo de mensajes. Un vuelo detectado por primera vez ya en tierra junto al destino entra directamente como LANDED.
- **Envío manual** desde el dashboard: el contenido del mensaje se perdía en el siguiente scan. Ahora persiste (`msgBodies`).
- **SIGMET**: se consultaba `airsigmet` (solo EE.UU.). Ahora `isigmet` internacional con distancia real al polígono.
- **PIREP**: la API exige `bbox` → devolvía HTTP 400. Corregido.
- **API key phpVMS**: ACARS y OPS la cifraban con huellas distintas sobre la misma clave de almacenamiento, y además dependía de la resolución de pantalla. Cifrado estable común; las keys de 4.3.x se migran automáticamente.
- **phpVMS en ACARS** escribía en un `#dashboard` inexistente → error en cada scan. El escaneo phpVMS lo ejecuta solo el OPS Center.
- **Dashboard OPS**: los vuelos solo-phpVMS no tenían `msgStatus` → el render lanzaba excepción.
- **SimBrief**: un usuario inexistente mostraba `HTTP 400`; ahora muestra el mensaje real de SimBrief.
- **Discord**: los TELEX manuales se notificaban dos veces.
- **FSUIPC**: al reconectar, el evento `close` del socket antiguo programaba reintentos fantasma.
- **Service Worker**: estrategia cache-first servía versiones antiguas y podía cachear respuestas del proxy. Ahora red primero, sin cachear APIs.

### Refactor y optimización
- **`nbv-core.js`** (nuevo): red, IVAO, meteo, Hoppie, phpVMS, Discord, FSUIPC, cifrado, generadores OPS y fase de vuelo en un único módulo compartido. 61 funciones duplicadas entre ambos archivos eliminadas.
- **Configuración compartida** (`nbv_shared`): logon, callsign, FSUIPC, phpVMS y Discord se configuran una vez y se sincronizan en vivo entre ACARS y OPS Center. Migración automática desde la config 4.3.x.
- **Un único dueño por módulo**: FSUIPC y phpVMS corren solo en el OPS Center; el ACARS refleja su estado (badge SIM y estado phpVMS). Se elimina la doble conexión WebSocket y el doble polling.
- **Whazzup IVAO con caché compartida** (TTL 15 s, peticiones simultáneas agrupadas): una sola descarga de unos 800 KB sirve a ambas apps. Antes se descargaba por cada vuelo y por cada mensaje.
- **ATIS IVAO** leído directamente del whazzup (con Hoppie como respaldo).
- Reintento automático en GET ante timeout o fallo de red transitorio.
- Eliminadas unas 550 líneas de código muerto (motor OPS antiguo del ACARS) y el overlay AOC huérfano del ACARS (el OPS Center conserva el suyo).
- Tamaño total: 365 KB → 290 KB (−21 %), con el núcleo descargado una sola vez.

### Validación
- Sintaxis de todos los scripts, grafo de llamadas (0 funciones inalcanzables), 0 identificadores sin declarar y 0 colisiones de declaración entre el núcleo y las apps.
- 47 pruebas funcionales contra las APIs reales (IVAO, Hoppie, aviationweather.gov, phpVMS, SimBrief), con vuelos NBV en vivo.

---

## [v4.2.0] — 2026-02-27

### Nuevas funciones

#### OCC Board — Integración phpVMS / FSUIPC
- Vuelos detectados por phpVMS y FSUIPC WebSocket aparecen ahora en el OCC Board del ACARS Dispatch.
- Los vuelos de fuente alternativa (no IVAO) se distinguen con badges `phpVMS` (violeta) y `SIM` (verde).
- Intervalo de refresco OCC configurable independientemente del scan principal.
- Merge unificado: si un vuelo aparece tanto en IVAO como en phpVMS, IVAO tiene prioridad de datos.

#### Discord Webhook — Mensajes TELEX/CPDLC en tiempo real
- Todos los mensajes **enviados** (TELEX manual, TELEX auto-OPS, CPDLC) generan un embed en Discord.
- Todos los mensajes **recibidos** (TELEX, CPDLC, LOGON request) generan un embed en Discord.
- Código de colores idéntico al de la interfaz ACARS:
  - 🔵 `#2E8CF0` — TELEX enviado
  - 🔵 `#60A5FA` — TELEX recibido
  - 🟣 `#A78BFA` — CPDLC
  - 🟢 `#34D399` — LOGON
  - 🔴 `#F87171` — Error
- Los tres módulos (FSUIPC, phpVMS, Discord) integrados también en el OPS Center.

### Mejoras
- Bump de versión a v4.2 en todos los archivos (ACARS Dispatch, OPS Center, Service Worker).

---

## [v4.1.0] — 2026-02-27

### Nuevas funciones

#### FSUIPC WebSocket Module
- Conexión directa al simulador local via WebSocket (Paul Henty FSUIPC WS Server en `ws://127.0.0.1:2048`).
- Offsets leídos: lat, lon, altitud, GS, heading, VS, onGround, squawk, flaps, combustible.
- Prioridad de datos: FSUIPC > IVAO Whazzup (100ms vs 45s de latencia).
- Badge en header: `IVAO` (gris) / `SIM` (verde parpadeante) / `SIM…` (ámbar, conectando).
- Reintentos automáticos: máximo 8 intentos cada 15 segundos.
- Configuración persistida: URL WebSocket, callsign local, intervalo de polling.

#### phpVMS Integration Module
- Conexión con la instalación phpVMS de AirNubeiro (`operaciones.airnubeiro.es`).
- Fuente principal: `GET /api/acars/geojson` (público, sin autenticación) — todos los vuelos activos.
- Enriquecimiento: `GET /api/pireps/{id}` (con API Key cifrada) — dep, arr, aeronave, piloto.
- Caché de PIREPs: 5 minutos por vuelo, limpieza automática.
- Merge inteligente: phpVMS enriquece datos IVAO existentes; solo añade vuelos no detectados en IVAO.
- Callsign construido desde `airline.icao` + `flight_number` → ej. `NBV011`.

#### API Key Encryption (AES-256-GCM + PBKDF2)
- La API Key de phpVMS **nunca se almacena en claro**.
- Flujo: paste → validación en vivo contra `/api/user` → cifrado AES-256-GCM.
- Clave derivada con PBKDF2 (120.000 iteraciones) usando huella de dispositivo + sal aleatoria.
- Blob cifrado en `localStorage` como `an_ak`. Solo descifrable en el mismo navegador/dispositivo.
- UI: badge `🔒 API Key cifrada (AES-256)` o `⚠ Sin API Key — click para configurar`.

#### Discord Webhook Module
- Notificaciones a canal Discord via webhook para eventos OPS clave.
- Eventos configurables (toggles individuales):
  - Vuelo detectado (nuevo en IVAO/phpVMS/FSUIPC)
  - Cambio de fase (PREFLIGHT → ENROUTE → DESCENT → LANDED)
  - TELEX auto-OPS enviado
  - Alertas ATC (congestión)
- Embeds con campos: callsign, ruta, FL, GS, fuente de datos, piloto.
- Cola anti-rate-limit: 420ms mínimos entre envíos, auto-reencola en HTTP 429.
- Botón de prueba en panel de configuración.

### Integración OPS Center
- Los tres módulos (FSUIPC, phpVMS, Discord) portados e integrados en `ops-center.html`.
- Panel de configuración unificado con secciones colapsables para cada módulo.
- Hooks en `scan()`, `sendTelex()` y alertas ATC.

---

## [v4.0.2] — 2026-02-23

### Correcciones
- Fix TypeError en AWOS: API IVAO v2 devuelve objetos anidados donde se esperaban valores simples.
- Fix visualización de llegadas/salidas en monitor de tráfico.
- Estabilización del sistema de anti-duplicación de mensajes.
- Fix re-envío de mensajes ya enviados al recargar sesión.

---

## [v4.0.0] — 2026-02-22

### Rediseño completo (major release)

#### Cambios de diseño
- Migración de paleta ámbar/dorada a azul corporativo AirNubeiro (`#0062B8`).
- Refactorización completa del sistema de variables CSS (`--acc`, `--inf`, `--ok`, `--err`, `--cpdlc`).
- Nueva tipografía monospace `JetBrains Mono` para datos operacionales.
- Redesign de tarjetas de vuelo en OPS tab y OCC Board.

#### Nuevas funciones
- **OPS Monitor**: Detección automática de pilotos NBV en IVAO Whazzup.
- **Auto-TELEX por fase**: mensajes automáticos en PREFLIGHT, ENROUTE, DESCENT y LANDED.
  - Preflight: METAR del aeropuerto de salida + briefing de tráfico.
  - Enroute: Route Info con distancia restante y ETA.
  - Descent: METAR/ATIS destino + tráfico en llegada.
  - Landed: Mensaje de bienvenida + asignación de parking.
- **OCC Board**: Vista de flota completa con tabla de todos los vuelos NBV activos.
- **DSP (Dispatch)**: Generación de mensajes de despacho estructurados.
- **Stream Mode**: Visualización fullscreen AOC para sala de operaciones.
- **CPDLC básico**: Logon, standby, logoff con gestión de sesión.
- Sistema de anti-duplicación persistente en `localStorage` con TTL configurable.
- Historial de mensajes con persistencia entre sesiones.
- Integración SimBrief: loadsheet automático por callsign.

#### Arquitectura
- PWA completa con Service Worker (`sw.js`) y `manifest.json`.
- Single-file HTML autocontenido — sin dependencias externas de build.
- Soporte offline para datos cacheados.

---

## [v3.x] — Legacy

Versiones anteriores con paleta ámbar. No documentadas en este changelog.

---

## Archivos del proyecto

| Archivo | Descripción |
|---|---|
| `index.html` | ACARS Dispatch — aplicación principal |
| `ops-center.html` | OPS Center — monitor de flota automatizado |
| `nbv-core.js` | Núcleo común (red, IVAO, meteo, Hoppie, phpVMS, Discord, FSUIPC) |
| `nbv-server.py` | Servidor local + proxy CORS |
| `START-ACARS.bat` | Lanzador Windows (arranca `nbv-server.py`) |
| `sw.js` | Service Worker — PWA y caché offline |
| `manifest.json` | PWA Manifest |
| `icons/` | Iconos PNG (192px, 512px) y SVG |

## URLs de despliegue

- Local (recomendado): `START-ACARS.bat` → `http://localhost:8433/index.html`
- ACARS Dispatch: `https://[tu-dominio]/index.html` (requiere proxy personalizado, p.ej. Cloudflare Worker)
- OPS Center: `https://[tu-dominio]/ops-center.html`

## Dependencias externas (runtime)

- [Hoppie ACARS](https://www.hoppie.nl/acars/) — protocolo de mensajería
- [IVAO Whazzup v2](https://api.ivao.aero/v2/networks/whazzup) — datos de vuelo en tiempo real
- [aviationweather.gov](https://aviationweather.gov/api/data/) — METAR/TAF/SIGMET/PIREP (vía proxy local)
- [SimBrief](https://www.simbrief.com/) — planes de vuelo
- phpVMS (`operaciones.airnubeiro.es`) — base de datos de pilotos AirNubeiro
- FSUIPC WebSocket Server (Paul Henty) — datos del simulador local

---

## [v4.3.0] — 2026-02-27

### Datos phpVMS extendidos — integración completa

#### Objeto de vuelo enriquecido (ACARS Dispatch + OPS Center)
Todos los PIREPs de phpVMS ahora propagan los siguientes campos al objeto de vuelo activo:
- `registration` — matrícula del avión (`EC-OUR`)
- `acName` — nombre del avión en phpVMS (`Ourense`)
- `pilotIdent` — identificador de piloto (`NBV011`)
- `pilotName` — nombre real del piloto
- `phpvmsRoute` — ruta ATS planificada completa
- `planFL` — nivel de crucero planificado (ft)
- `progressPct` — porcentaje de ruta completado (distancia volada / planificada)
- `arrLat`, `arrLon` — coordenadas exactas del aeropuerto de destino
- `pirepId` — ID interno del PIREP para trazabilidad
- `_phpvmsPhase` — fase phpVMS (`DEP`/`ENR`/`ARR`/`CMP`) para detectPhase

Si el vuelo ya está en IVAO Whazzup, los datos phpVMS enriquecen el objeto existente sin sobreescribir datos de posición (IVAO tiene prioridad de tracking).

#### Visualización enriquecida
- **ACARS Dispatch (OPS tab)**: línea adicional bajo cada vuelo con `matrícula · pilotIdent · nombre · X% ruta · Xnm dest · IVAO state`
- **OPS Center (dashboard)**: cards con barra de progreso visual, matrícula, piloto, distancia a destino, estado IVAO nativo

### detectPhase v2 — Lógica de fase mejorada

#### Jerarquía de fuentes (prioridad descendente)
1. **phpVMS phase** (`_phpvmsPhase`): fuente de servidor, 100% fiable para vuelos vmsACARS
2. **IVAO state nativo** (`lastTrack.state`): 7 estados documentados de la API:
   - `Boarding` / `On Blocks` / `Departing` → `PREFLIGHT`
   - `Initial Climb` / `En Route` → `ENROUTE`  
   - `Approach` → `DESCENT`
   - `Landed` → `LANDED`
3. **arrivalDistance < 150nm + altitudeDifference < -100ft** → fuerza `DESCENT`
4. **Heurística legacy** (altitud anterior vs actual): fallback para pilotos sin estado IVAO

#### Mejora de detección práctica
- Descenso detectado ~150nm antes de destino en lugar de esperar alt diff entre scans de 45s
- IVAO state directo elimina falsos positivos de ENROUTE para pilotos en tierra

### Mensajes gallegos — Telex de llegada personalizado

#### Aeropuertos cubiertos
| ICAO | Aeropuerto | Temática |
|---|---|---|
| `LEVX` | Vigo-Peinador | Rías Baixas, Illas Cíes, marisco |
| `LECO` | A Coruña-Alvedro | Torre de Hércules, Finisterre, Ría de Betanzos |
| `LEST` | Santiago de Compostela (Rosalía de Castro) | Catedral, Camino, Rosalía de Castro |

- 2-3 mensajes por aeropuerto, selección aleatoria en cada llegada
- Escritos en gallego con referencias locales auténticas (UNESCO, gastronomía, geografía)
- Se envían **antes** del mensaje de bienvenida estándar (stand + tiempo de vuelo)
- Integrado tanto en **ACARS Dispatch** (`genGalicianWelcome`) como en **OPS Center** (`genLanded`)

### Callsign = Remitente TELEX — Aclaración

**Respuesta directa**: el campo `CALLSIGN ESTACIÓN` ya controla el remitente visible en el avión. El protocolo Hoppie ACARS usa el parámetro `from=` como remitente; ese parámetro es exactamente el campo `cS` de la config. Cambiar `CALLSIGN ESTACIÓN` a `NBVOPS` hace que el piloto vea `NBVOPS` como emisor de todos los mensajes.

El label del campo en la UI se ha actualizado con tooltip explicativo.


---

## [v4.3.1] — 2026-02-28

### Bug fixes

#### ATIS múltiple — fix panel Quick Dispatch
Cuando Hoppie devuelve una lista de estaciones (`AVAILABLE ATIS FOR XXXX`) en lugar del ATIS directamente, el texto anterior `{acars info {AVAILABLE ATIS FOR LEST\nLEST-APP\nLEST-TWR\nLEST-GND}}` se mostraba en bruto y el botón Enviar TELEX enviaba ese literal sin valor.

Comportamiento nuevo:
1. Detecta automáticamente la respuesta de lista múltiple
2. Auto-selecciona por prioridad: APP → TWR → GND → DEP → primera disponible
3. Hace una segunda petición automática a la estación seleccionada
4. Muestra el ATIS real — el botón Enviar TELEX funciona correctamente

#### HTTP 413 en proxy CORS — fix global
`ivaoFetch()` y todas las peticiones a IVAO Whazzup incluían parámetros de cache-busting (`?_t=EPOCH&_r=RANDOM`) que inflaban la URL hasta superar el límite del proxy CORS, devolviendo silenciosamente 0 pilotos y 0 ATCs.

Afectaba a:
- OPS Monitor (scan de pilotos NBV)
- Quick Dispatch — tráfico de aeropuerto
- `opsAutoRouteInfo` — ATC en ruta y tráfico en destino
- OPS Center — scan general (fix previo en v4.3.0 patch)

Eliminado el cache-busting innecesario en todos los puntos. El endpoint IVAO Whazzup ya sirve datos frescos en cada petición.

### Versiones actualizadas
- `index.html`: AirNubeiro v4.3.1 / ACARS Dispatch v4.3.1
- `ops-center.html`: OPS Center v4.3.1
- `sw.js`: CACHE_NAME `an-acars-v4.3.1`

---

## [v4.3.2] — 2026-03-01

### FSUIPC WebSocket — Reescritura completa del módulo

Módulo reescrito desde cero con el protocolo correcto del FSUIPC WebSocket Server de Paul Henty. La implementación anterior nunca llegó a conectarse porque usaba comandos que no existen en el servidor.

#### Bugs corregidos

| # | Bug | Antes | Ahora |
|---|-----|-------|-------|
| 1 | Subprotocolo WS | `new WebSocket(url)` | `new WebSocket(url, 'fsuipc')` — requerido por el servidor |
| 2 | Comando declarar | `groups.add` (no existe) | `offsets.declare` con array de offsets |
| 3 | Comando leer | `groups.read` (no existe) | `offsets.read` con parámetro `interval` (ms) |
| 4 | Push automático | Poll manual con `setInterval` | El servidor hace push al ritmo de `interval` — sin timer manual |
| 5 | Respuesta parsing | `msg.command === GROUP_NAME` | `msg.success && msg.name === GROUP_NAME && msg.data` |
| 6 | Offset altitud | `0x0574` INT64 | `0x6020` float size 8 (metros → feet) |
| 7 | Offset GS | `0x02B8` | `0x02B4` uint size 4 |
| 8 | Offset VS | `0x030C` | `0x02C8` int size 4 |
| 9 | Tipos lat/lon | `DBL` | `lat` / `lon` — el servidor devuelve decimal° directamente |
| 10 | Fórmula heading | `(raw/65536)*360` (doble escala) | `raw/65536` |
| 11 | Tipos squawk/flaps | `UINT16` / `UINT32` | `uint` |

#### Flujo de conexión correcto
```
1. new WebSocket(url, 'fsuipc')     ← subprotocolo obligatorio
2. onopen → offsets.declare         ← declara el grupo de offsets
3. onopen → offsets.read + interval ← servidor arranca push automático
4. onmessage → { success, name, data: {lat, lon, altM, gs, hdg, ...} }
```

#### Compatibilidad
Validado contra implementaciones reales (FSUIPC-Shirley-Bridge, flightsim-aircraft-panel). Offsets verificados para FSUIPC4/5/7 (FS9, FSX, P3D, MSFS 2020/2024).

---

## [v4.3.3] — 2026-03-01

### OCC — OPS Center embebido via iframe

El tab OCC del ACARS Dispatch ahora carga el OPS Center completo mediante un `<iframe>`. Ambas aplicaciones conviven en el mismo despliegue de GitHub Pages sin interferencias.

**Decisión de arquitectura:** integración directa de código descartada por inviabilidad técnica (69 funciones con nombre idéntico, 8 constantes duplicadas, cientos de IDs HTML en colisión). El iframe aísla completamente ambos contextos JS y es la solución mantenible a largo plazo.

**Requisito de despliegue:** ambos archivos deben servirse desde el mismo origen (GitHub Pages). Si se abre `index.html` desde `file://` local el iframe puede bloquearse — funciona correctamente desde el servidor.

**Limpieza de código:** eliminado el bloque "OPS CENTER ENGINE portado" (~1800 líneas) que era código muerto desde el rediseño, y corregida una llave `}` sobrante en `saveCfg()`.

---

## [v4.3.3] — 2026-03-01

### OPS Center integrado en pestaña OCC (iframe embed)

La pestaña OCC del ACARS ahora carga el `ops-center.html` completo en un iframe. El usuario trabaja desde un único punto de entrada (`index.html`) y tiene acceso al OPS Center sin abrir una segunda pestaña.

**Motivo del enfoque iframe** (vs merge de código): ambos archivos comparten 68 IDs idénticos en el DOM. Un merge directo generaría colisiones de `document.getElementById()` que romperían la funcionalidad en ambas direcciones. El iframe aisla los contextos DOM y JS completamente.

**Funcionalidad:**
- Botón ⟳ recarga el OPS Center sin recargar el ACARS
- Botón ⬡ abre el OPS Center en pestaña independiente si se prefiere pantalla completa
- La altura del iframe ocupa `100dvh - 130px` (adapta a cualquier pantalla)
- Config del OPS Center se guarda en `an_ops` (localStorage), independiente de `an3` (ACARS)

**Requisito de deploy:** `index.html` y `ops-center.html` deben estar en la misma carpeta. En GitHub Pages ya es el caso por defecto.
