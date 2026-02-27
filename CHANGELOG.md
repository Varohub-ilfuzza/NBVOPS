# Changelog — AirNubeiro ACARS Suite

Todos los cambios notables del proyecto. Formato: [vX.Y.Z] — YYYY-MM-DD

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
| `sw.js` | Service Worker — PWA y caché offline |
| `manifest.json` | PWA Manifest |
| `icons/` | Iconos PNG (192px, 512px) y SVG |

## URLs de despliegue

- ACARS Dispatch: `https://[tu-dominio]/index.html`
- OPS Center: `https://[tu-dominio]/ops-center.html`

## Dependencias externas (runtime)

- [Hoppie ACARS](https://www.hoppie.nl/acars/) — protocolo de mensajería
- [IVAO Whazzup v2](https://api.ivao.aero/v2/networks/whazzup) — datos de vuelo en tiempo real
- [aviationweather.gov](https://aviationweather.gov/api/data/) — METAR/ATIS
- [SimBrief](https://www.simbrief.com/) — planes de vuelo
- phpVMS (`operaciones.airnubeiro.es`) — base de datos de pilotos AirNubeiro
- FSUIPC WebSocket Server (Paul Henty) — datos del simulador local
