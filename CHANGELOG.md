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
