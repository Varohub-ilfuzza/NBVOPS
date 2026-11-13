# Changelog — AirNubeiro ACARS Suite

Todos los cambios notables del proyecto. Formato: [vX.Y.Z] — YYYY-MM-DD

---

## [v5.5.1] — 2026-11-13

Revisión completa del código y rediseño de la interfaz («Sala de operaciones»); sin cambios de `CSP_MODE` ni de cabeceras. La caché del service worker pasa a `an-acars-v5.5.1`: al actualizar se descarta la de la 5.5.0 (con las entradas `version.json?t=…` acumuladas).

### Corregido
- El OPS Center dejaba de funcionar tras unas 200 líneas de actividad (≈2 h de monitor): `log()` recortaba `#logBox` por el último hijo y borraba `#logEmpty`, y desde entonces cada escaneo lanzaba un `TypeError` (no se detectaban vuelos ni salían mensajes hasta recargar). Ahora solo recorta las entradas. Probable causa del «tras aterrizar no detecta el avión» de los pendientes de la 5.5.1. Mutante X79.
- «Limpiar» el historial de mensajes ya no borra el antiduplicado (antes se reenviaban fases y TELEX OOOI). X80.
- La pantalla AOC ya no manda los vuelos en PREFLIGHT al final. X81.
- El parking y el EET de SimBrief se anotan en el vuelo vigente aunque el escaneo haya sustituido el objeto durante la espera, y nunca en una pierna nueva del mismo callsign. X82, X83, X100, X101.
- Conexiones PAX y próximo vuelo sin «GATE» duplicado («GATE STAND T18» → «STAND T18»). X84, X85.
- LOGON ACCEPTED, STANDBY, UNABLE y LOGOFF comprueban la respuesta de Hoppie y muestran su error, sin avanzar el MIN. Tras un LOGOFF fallido, un segundo clic en la ✕ quita la estación solo en local y avisa de que el avión no lo ha recibido. X86, X96.
- El MIN de CPDLC sigue al último enviado en las últimas 24 h tras recargar (antes volvía a 1 y un WILCO tardío se asociaba al mensaje equivocado); solo valen MIN de 1 a 999 y tras el 999 vuelve a 1. X87, X97–X99.
- Dispatch: el METAR de WX EN-ROUTE va por `NBV.wx.metarLatest` (antes un JSON de error del proxy podía llegar al piloto como METAR) y el tipo de avión desconocido sale «????», no «NBV». X88, X89.
- Service worker: no intercepta `/techlog`, peticiones `no-store` ni recursos con consulta (`version.json?t=…` llenaba la caché); sin red, `ops-center.html?embed=1` se sirve aunque no se haya visitado antes con red. X90–X92, X102.
- FSUIPC: el contador de reintentos ya no sube de dos en dos al vencer el tiempo de conexión. X93.
- Un aeropuerto sin coordenadas ya no queda marcado para siempre: el fallo caduca a los 7 días. X94, X95.

### Cambiado
- Rediseño «Sala de operaciones»: paleta pizarra con el azul AirNubeiro solo para acciones; Barlow, Barlow Semi Condensed e IBM Plex Mono; fichas de vuelo como fichas de progresión (banda de fase, celdas de datos, casillas de mensajes); mensajes y dispatch como impreso de datalink (ámbar en oscuro, papel térmico en claro); contadores en una banda continua; radios por jerarquía; contraste AA medido en ambos temas. Mismos ids, clases y controles: golden `clics-controles` sin cambios.
- Enviado en azul y entregado en verde en todas las vistas (antes estaba invertido en el historial).
- Colores fijos del JS (estado de phpVMS, Discord y FSUIPC, marbete «SB» del AOC, editor de plantillas, `theme-color`) pasan a tokens del tema.
- Accesibilidad: se permite el zoom (fuera `user-scalable=no`), los campos van a 16 px en móvil para que iOS no amplíe al enfocarlos, `aria-label` en los botones de solo icono y el contador de no leídos sigue anunciándose.
- Respaldo sin `color-mix()` en los bordes para Safari < 16.2.

### Interno
- Fuera tres ficheros sin código: `acars/05-ops-legado.js`, `ops/05-apikey-fsuipc.js`, `ops/07-discord.js`.
- Sección `revision` en `tests/char/` y mutantes X79–X102. 411 pruebas de caracterización y 105 mutantes detectados. S6 sigue en 3; lint a 0.

### Pendiente
- El próximo vuelo sale de un stand al azar distinto del asignado al llegar (`11-generadores.js`, `genParking`); va con el encargo de la puerta en ARR INFO.
- La conversión del rumbo de FSUIPC (offset 0x0580) parece usar `grados·65536` en vez de `grados·2³²/360`; comprobar con una captura de `tools/nbv-diag.py` antes de cambiarla.

---

## [v5.5.0] — 2026-11-09

OOOI desde el simulador, PDC con datos del OFP y ATIS sintético; sin cambios de `CSP_MODE` ni de cabeceras.

### Añadido
- OOOI desde FSUIPC para tu avión (`NBV.oooi`, módulo sin DOM): OUT tras 10 s moviéndose a ≥3 kt, OFF y ON por el cambio de `onGround` (5 s), IN tras 3 min parado a <1 kt (`IN_STILL_MS = 180000`; una espera de 30-45 s en el rodaje de llegada no es el IN; la hora sigue siendo el inicio de la parada). Si el OPS se abre o se recarga con `flt.oooi` vacío, el detector usa la fase de vuelo de IVAO: con `LANDED` o `DESCENT` y en tierra pasa a rodaje de llegada y nunca arma un OUT. La hora del evento es la del inicio de la condición. Los tiempos se guardan en el vuelo, en el registro de vuelos (`off/on` pasan a ser los del simulador en tu vuelo) y en el CSV (columnas `out_utc` e `in_utc`). FSUIPC solo existe en el OPS Center para «Mi callsign»; para otros aviones nada cambia. Mutantes X60, X61, X62, X66, X67, X69.
- TELEX OOOI opcional a tu avión (Ajustes → «Enviar TELEX OOOI a mi avión», desactivado por defecto): cuatro TELEX en total (OUT, OFF, ON e IN); el del IN lleva el resumen (BLK y FLT). Como FSUIPC solo existe en el OPS, el TELEX sale de la estación del OPS (NBVOPS) hacia tu avión, no desde el avión. Deduplicado por tramo (callsign, ruta y evento, con `firstSeen`) y con reintentos a los 30 s y a los 120 s. Añade hasta 4 mensajes por vuelo a Hoppie. Solo envía la ventana del OPS con el monitor en marcha (la embebida en el ACARS y otra abierta aparte reciben las mismas muestras; los tiempos se registran en todas): antes de enviar se relee el registro compartido (`an_ops_sent_registry`) y se reserva el envío 60 s, así que con dos ventanas activas salen 4 TELEX, no 8, aunque cada una haya detectado el vuelo en su propio escaneo (la reserva no depende de `firstSeen`). Un reintento tras fallo sale aunque entretanto se haya detenido el monitor. El IN se retiene («retenido», como los mensajes de llegada) si el avión ya no está conectado a Hoppie, y se envía a mano desde la tarjeta. Tras el tercer fallo el TELEX queda en «error» con su texto y el botón de la tarjeta lo reenvía. Los tiempos OOOI se guardan en cuanto hay un evento (no solo al final del escaneo): recargar justo después del OFF no emite otro OFF ni pisa `t.off`. Mutantes X63, X72, X73, X74, X75, X76, X77 y X78.
- Flota → «Historial de mensajes»: cuando el avión recoge un mensaje, su fila pasa de «✓ ENVIADO» a «✓✓ RECIBIDO <hora de recogida de Hoppie>». Usa la misma comprobación de entrega de las tarjetas de vuelo (cada minuto, solo mientras el monitor está activo); las filas anteriores a esta versión no llevan clave y se quedan como «enviado». Cada mensaje de Hoppie confirma como mucho una clave, se compara con el texto completo (el primer paquete `[1/N]` si se troceó) y solo cuenta si Hoppie lo recibió después del envío (hora `DD-HH:MMZ`, con 1 min de margen): al recoger el ON, el IN pendiente sigue «enviado». Mutantes X59 y X71.
- PDC con `{SID} {RWY} {CRZ} {ROUTE}` tomados del OFP de SimBrief, solo cuando `ofp.atc.callsign` coincide con el callsign del destinatario del PDC; si no coincide, las variables salen como `____`. Además, el origen y el destino del OFP deben coincidir con el plan presentado en IVAO por ese callsign (el vuelo de vuelta no hereda el SID y la pista de la ida); sin plan en IVAO también salen `____`. Las plantillas ya guardadas ocultan los nuevos valores por defecto de PDC hasta pulsar «Restaurar por defecto». Mutantes X64 y X68.
- ATIS sintético a partir del METAR, en el panel Info del ACARS: se ofrece solo como último recurso, tras el ATIS real y la respuesta de Hoppie, y sustituye la respuesta corta «ATIS IS NOT AVAILABLE» de Hoppie únicamente si hay METAR. Quick Dispatch y Stream Mode no cambian. Mutante X65.

### Pruebas e interno
- Mutantes X59–X78 (X65 corregido: solo comprueba que el ATIS sintético no se ponga por delante de Hoppie; X70 cubre la publicación de FSUIPC en el bus); sección `oooi` en `tests/char/` (más casos en `ops`, `registro`, `ajustes` y `atis`). Golden del CSV del registro actualizado con las columnas nuevas. S6 sigue en 3.
- A comprobar con tu primer OFP: los nombres de campo de SimBrief (`general.sid_ident`, `origin.plan_rwy`, `general.initial_altitude`, `general.route`, `atc.callsign`) salen de la documentación de SimBrief, sin comprobar con un OFP real (`origin.icao_code` y `destination.icao_code` incluidos); el repositorio no tiene ningún OFP real en los datos de prueba.

### Limitaciones conocidas
- Recargar el OPS durante un reintento pendiente del TELEX OOOI (≤150 s) pierde ese reintento.
- Un objeto de vuelo nuevo (OPS cerrado más de 20 min o vuelo purgado) puede reenviar un TELEX OOOI ya enviado.
- Los umbrales del OOOI (OUT tras 10 s a ≥3 kt, IN tras 3 min a <1 kt) se ajustarán tras el primer vuelo de prueba.
- Si se cierra el simulador antes de 3 min parado en la puerta, el IN se pierde.
- Tras un reinicio con la fase PREFLIGHT y el avión parado en el punto de espera, el OUT sale allí (al empezar a rodar hacia la pista), no en la puerta.
- Un reinicio rodando con la fase PREFLIGHT pasa a AIRBORNE sin OFF al despegar: el OUT y el OFF de esa pierna se pierden.
- Tras un reinicio ya aterrizado, si el IN se registra al reconectar, su hora es la de la reconexión, no la de la llegada real a la puerta.
- Con las notificaciones de Discord de TELEX activadas, los TELEX OOOI suman hasta 4 publicaciones por vuelo.
- La comprobación de entrega no recuerda tras recargar qué mensajes de Hoppie ya confirmaron una clave; lo suple la hora de recepción, así que dos mensajes de texto idéntico enviados en el mismo minuto podrían intercambiarse entre sí.

---

## [v5.4.2] — 2026-11-09

Deuda técnica de la 5.4.1; sin cambios de `CSP_MODE` ni de cabeceras.

### Seguridad
- Los mensajes de la bandeja del ACARS se guardan como datos y se reconstruyen al cargar (`buildMsgEl`); antes se guardaba su `outerHTML` y se reinyectaba. Lo ya guardado por versiones anteriores se migra leyendo solo el texto con un `DOMParser` inerte, de modo que un `<img onerror>` o un `<script>` antiguos no se reinyectan. Mutante X56.
- S6 (interpolaciones sin `esc()` en HTML generado) pasa a analizar el código por AST: ya ve las plantillas anidadas, que el análisis por expresiones regulares no veía, y no acepta formas como `esc(a) + otro`. Total: 3 interpolaciones sin `esc()`, revisadas e internas (etiquetas constantes de las tarjetas del OPS y dos funciones que devuelven HTML ya escapado); tres variables que ya contenían HTML construido con `esc()` pasan a llamarse `…Html`, que es el contrato que S6 reconoce. Tras la revisión final: una plantilla anidada sin etiqueta también se evalúa (antes se daba por buena), `icon(x)` solo es seguro con literales (el nombre del icono se interpola en el SVG: ahora `esc(n)`) y los identificadores `i`/`n`/`idx` dejan de bastar; `Number()` en cuatro números que S6 ya veía. Mutantes X54, X55, X57, X58 y X52 (reorientado a «||»).

### Pruebas e interno
- tsc de 8 a 0 errores de tipo y ESLint de 1 a 0 (anotaciones JSDoc); `node tests/lint.js --list` muestra todos los avisos actuales. Mutante X53.
- El golden `clics-controles` ya es reproducible bajo carga: con la máquina ocupada, la respuesta de red del clic anterior llegaba antes o después del siguiente y la traza cambiaba. La prueba espera ahora a las peticiones en vuelo (18 de 18 generaciones en paralelo idénticas; antes 2 de 6 distintas). Sin cambios en `tests/golden/`.
- `DOMParser` en la lista de globales conocidos del comprobador estático; sección `mensajes` en `tests/char/`; nombres de las pruebas de `CONNECT_ALLOW` separados; dedupe de `csp-bloqueo` por host evaluado, sin cambios.

---

## [v5.4.1] — 2026-11-08

Limpieza tras la 5.4.0; sin cambios de `CSP_MODE`.

### Seguridad
- `CONNECT_ALLOW` sin orígenes `http:` (el servidor local `:8433` no lo usa ninguna página servida por el Worker y la `<meta>` ya lo bloqueaba). Quitar entradas no añade tráfico permitido: no reabre el periodo de observación. Mutante X50.

### Corregido
- Stream Mode: un estado de IVAO que la app no conoce se pintaba sin escapar; ahora es texto. Mutante X51.

### Pruebas e interno
- S6: interpolaciones sin `esc()` de 77 a 3, con cuatro formas seguras reconocidas por el verificador, autoprueba y `--s6-list` (X52). El golden `clics-controles` gana `esc` en 7 líneas (la traza de funciones llamadas; la salida no cambia).
- tsc: errores de tipo de 48 a 8 (anotaciones JSDoc y valores por defecto; quedan los 7 de `window.NBV` y el de `Window`).
- UTF-16 BE impar con secreto en el barrido, con otro fichero detrás en el mismo staged (X49), y mutante de `markBlocked` con un host suelto (X48).
- `tests/characterization.js` partido en `tests/char/<sección>.js` (misma interfaz y los mismos 246 casos).

---

## [v5.4.0] — 2026-11-07

Seguridad: C1 de `docs/PLAN-PRUEBAS-5.4.md` (P-03 cerrado) y las correcciones de la revisión de código.

### Seguridad
- **`connect-src` aplicado** (C1 · P-03 · OWASP A02): el Worker publica `CSP_MODE=enforce`; cualquier conexión fuera de la lista cerrada se bloquea y la app lo avisa («Seguridad: csp-bloqueo»). Vuelta atrás sin recompilar: `CSP_MODE=report` (`deploy/DEPLOY.md`). Inventario de integraciones probado en Node y en Chromium con el Worker en `enforce`; mutantes X37–X38. `live-check.py` espera `enforce` por defecto desde la 5.4.0 (sin sufijo `-rc`).

### Verificación en producción
- Publicada en NBVOPS `2544005` (07-nov-2026). `live-check --version 5.4.0 --browser all --csp-mode enforce` (07-nov 23:31Z–23:35Z, desde el contenedor): 191/191 OK y 0 violaciones de CSP en Chromium y WebKit 26.6; una sola cabecera de CSP (base + `connect-src` + `report-uri`), sin `Report-Only`.
- Pendientes: ensayo de vuelta atrás en producción (`CSP_MODE=report` y vuelta) y vuelo de prueba (§5 de `docs/PLAN-PRUEBAS-5.4.md`).

### Corregido
- **Aviso csp-bloqueo:** los intentos repetidos contra el mismo host (p. ej. reconectar FSUIPC) ya no gastan el cupo de 5 avisos por minuto; un host nuevo siempre aparece. Mutantes X31 y X35 (privacidad de `cspTarget`).
- **Bloqueos de la CSP por origen** (esquema + host + puerto), no por host: bloquear `https://localhost:8433` ya no corta `http://localhost:8433`, ni `wss://` corta `ws://`. Mutantes X32 y X36 (guarda de `req()`).
- **Worker:** `csp_mode_invalid` se registra una vez por valor y por isolate, no en cada página servida. Mutante X33.
- **Barrido de secretos:** los ficheros UTF-16 con BOM (PowerShell 5.1 con `>`) se analizan; los binarios siguen sin analizarse. Mutante X34.
- **`tests/live-check.py`** compara versiones como números (`5.10.0` ≥ `5.4`), con prueba en `tests/nbv_version_test.py` (`npm run test:py`).
- **Revisión de código (hardening):** la regla S4 detecta también nombres camelCase (`accessToken`, `hoppieLogon`); el fail-closed del hook (si git no puede leer lo staged, el commit se detiene) tiene prueba (X40, X41). El proxy local responde 400 a un `Content-Length` no numérico o negativo en lugar de lanzar o quedarse esperando (X42), y el Worker rechaza con 413 por el `Content-Length` declarado antes de leer el cuerpo (X43). `phpvmsScan` ya no se solapa consigo mismo cuando un escaneo tarda más que el intervalo (X44), y la clave AES del dispositivo se crea una sola vez aunque varios cifrados coincidan en el primer arranque (X45: antes cada llamada generaba la suya y el secreto podía quedar ilegible). El aviso de bloqueo de la CSP llega a la red y a FSUIPC por el bus (`csp-block`) en lugar de llamadas opcionales por nombre a globales (X46, X47); `live-check.py --version v5.4.0-rc.2` ya no aborta con una traza. El arnés de mutantes puede ahora ejecutar pruebas que arrancan lo construido (`withDist`).

---

## [v5.4.0-rc.2] — 2026-11-07

### Corregido
- **Service Worker: «a redirected response was used for a request whose redirect mode is not "follow"»** (consola del navegador). Una respuesta con redirección (p. ej. `ops-center.html` → `/ops-center` que aplica Cloudflare, o una página guardada en caché con el indicador de redirección) no puede servirse a una navegación y la página fallaba. `sw.js` reconstruye ahora la respuesta sin el indicador, tanto la de red como la de caché y la de respaldo `index.html`.
- **Pruebas:** `tests/sw.test.js` (carga `src/pwa/sw.js` con Cache API y `fetch` simulados) y mutantes X29–X30 en `tests/regressions.js` (los mutantes de repositorio copian ahora también `src/`). Sin cambios en el Worker ni en `CSP_MODE`.

---

## [v5.4.0-rc.1] — 2026-11-07

Seguridad (C2–C4 de `docs/PLAN-PRUEBAS-5.4.md`). `connect-src` sigue sin aplicarse (C1, bloqueada hasta cumplir G0): esta versión publica con `CSP_MODE=report`.

### Seguridad
- **Interruptor `CSP_MODE` en el Worker** (C2 · P-03): `report` (publicado) mantiene `connect-src` en Report-Only; `enforce` lo aplica en una sola cabecera `Content-Security-Policy` que fusiona la base (`frame-ancestors`, `object-src`, `base-uri`, `form-action`). Ausente o no válido cae a `report` y registra `csp_mode_invalid`. Vuelta atrás: `deploy/DEPLOY.md`.
- **Aviso «Seguridad: csp-bloqueo»** (C3 · A09): una violación de `connect-src` aplicada se registra con solo el host (con puerto), nunca ruta, consulta ni credenciales; como mucho 5 avisos por minuto y un resumen. `csp-informe` (modo informe) también pasa a guardar solo el host: antes podía incluir la consulta de la URL.
- **Avisos concretos con la CSP aplicada** (C3): un proxy personalizado fuera de la lista muestra «Proxy no permitido por la política de seguridad: <host>» y deja de reintentarse; un FSUIPC en la LAN fuera de la lista muestra un mensaje claro en el indicador SIM, sin reintentos, y la app sigue con IVAO.
- **Hook pre-commit de secretos y barrido en la release** (C4 · P-11 · A03/A07): `tools/hooks/pre-commit` analiza lo staged (no el disco) con las reglas S4, que pasan a `tools/secrets.js` y comparte `tests/security-check.js`; bloquea por nombre `.env`, `.dev.vars`, `*.pem` y `*.key` aunque se añadan con `git add -f`; indica fichero y línea, nunca el valor. Excepciones solo en `tools/secrets-allow.json` (fichero + regla + motivo). `tools/release.js` barre todo el árbol antes de construir. Instalación: `npm run hooks:install`.
- **Pruebas:** `tests/secret-hook.test.js` (11 casos), Worker real en Chromium con `enforce` y `report`, y mutantes X25–X28 en `tests/regressions.js` (ahora también sobre ficheros del repositorio).

---

## [v5.3.1] — 2026-11-07

Seguridad (pendientes P-01, P-02 y P-03 de `docs/HARDENING-ACARS.md`) y los tres fallos del vuelo de prueba del 07-nov (NBV011 LECO→LEAS, Fenix A320).

### Seguridad
- **Logon de Hoppie cifrado** (P-01 · OWASP A04/A07): se guarda solo en `an_hl` con la clave v2 (AES-256-GCM, no extraíble). Ya no aparece en claro en `nbv_shared`, `an3` ni `an_ops`. Se migra solo la primera vez y deja un evento «Seguridad: logon-migrado». Si una configuración vieja o un ajuste importado lo trae en claro, no se vuelve a escribir.
- **Conexiones en lista cerrada, en modo informe** (P-03 · A02): el Worker añade a las páginas `Content-Security-Policy-Report-Only` con `connect-src` limitado a los servicios que usa la app. No bloquea nada: cada conexión fuera de la lista queda en la actividad («Seguridad: csp-informe») y en Workers Logs (`/__csp-report`, solo directiva y host). Se aplicará de verdad en la 5.4 si no hay informes.
- **Límite de peticiones al proxy** (P-02 · A06, CIS 13): 240 por minuto e IP con el binding de Cloudflare `LIMITER`. Al superarlo, 429 con CORS. Si el límite falla, el proxy sigue funcionando.

### Corregido (vuelo de prueba)
- **Falso DESCENSO en el ascenso**: la fase usaba `altitudeDifference` de IVAO, que no es una tendencia vertical sino la diferencia fija entre altitud real y barométrica (−268 ft en el vuelo). Ahora el descenso exige bajar en dos pasadas seguidas, estar 1.000 ft por debajo del máximo del tramo y cerca del destino (unos 4 NM por cada 1.000 ft más 30 NM), o la velocidad vertical de FSUIPC si es tu avión. Con los datos del vuelo: ENROUTE hasta las 14:33 y DESCENT a las 14:34 (inicio real del descenso: 14:33).
- **Desconexión falsa al aterrizar**: el whazzup omitió NBV011 unos 2 minutos. Ahora un vuelo solo se da por desconectado si falta 3 pasadas seguidas y 3 minutos, y nunca mientras FSUIPC siga dando datos de ese avión.

### Mejorado
- **Recepción Hoppie según su guía**: por defecto cada 45 s (mínimo 20), con un reparto aleatorio de ±10 %. Tras un CPDLC enviado o recibido (o un LOGON aceptado), consulta cada 20 s durante 3 minutos.

### Pruebas
- Nueva sección de caracterización `fase` con la reproducción del vuelo real (17 pruebas) y pruebas de P-01 en `ajustes`. Worker: 53 casos (Report-Only, informes CSP y límite de peticiones). Regresiones X21–X24. `live-check.py` comprueba la cabecera Report-Only y que no haya informes.

---

## [v5.3.0-rc.1] — 2026-11-07

**Hardening** según OWASP Top 10:2025, CIS Controls v8.1 y NIST CSF 2.0/SSDF. Detalle, hallazgos y pendientes en `docs/HARDENING-ACARS.md`; la norma común a todos los proyectos está en el Claude Doc «Estándar de seguridad AirNubeiro». Preparada y probada; **sin publicar** hasta probarla en el PC.

### Corregido
- **Cifrado de secretos v2** (A04): la API key de phpVMS y el webhook de Discord se cifran con una clave AES-256 aleatoria y **no extraíble** guardada en IndexedDB.
  - Antes la clave salía del User-Agent: era predecible y cambiaba con cada actualización del navegador.
  - Lo cifrado con los esquemas antiguos se migra solo, cada secreto en su propia clave. Se corrige además que la migración antigua escribiera el webhook en `an_ak`.
- **SSRF por redirecciones** (A01), tanto en el Worker como en el proxy local: cada redirección se revalida contra la lista blanca (máx. 3) y la API key de IVAO nunca viaja tras redirigir.
- **Servidor local** (A01/A02):
  - Solo responde a Host `localhost` o `127.0.0.1` de su puerto, lo que lo protege del DNS rebinding.
  - `/proxy` y `/techlog` solo atienden a la propia app (Origin y `Sec-Fetch-Site`).
  - Sin listados de carpetas ni ficheros ocultos, y con cabeceras de seguridad.
- **CSP** (A05/A02): cada página lleva su política con el hash SHA-256 de cada script inline; solo se ejecuta el código del build. `object-src 'none'`, `base-uri 'none'` y `form-action 'none'`.
- **Cabeceras de seguridad** en el Worker: HSTS, `nosniff`, `X-Frame-Options`/`frame-ancestors 'self'`, `Referrer-Policy: no-referrer`, `Permissions-Policy` y COOP.
- **Respuestas del proxy**: aisladas con `CSP: sandbox` y `nosniff`. Solo GET, HEAD y POST, y errores sin detalles internos (A10).
- Datos de SimBrief en el dispatch y el id de CPDLC escapados (A05). `esc()` ya escapaba las comillas desde la 5.1.
- Dependencia de pruebas `ws` actualizada a 8.22.1 (vulnerabilidad alta, A03).
- Carrera en la carga del webhook: si cambiaba en la otra ventana mientras se descifraba, el OPS se quedaba con el anterior. Ahora se repite la carga. La derivación PBKDF2 se calcula una sola vez por sesión.

### Nuevo
- **Eventos de seguridad** (`NBV.security`, A09/A10): acciones bloqueadas, violaciones de CSP, ficheros de ajustes rechazados y errores no controlados.
  - Se guardan en `nbv_secevents` (máx. 100) y aparecen en la actividad del OPS, sin pila ni datos sensibles.
  - El Worker registra sus rechazos en Workers Logs sin la consulta ni los cuerpos.
- **Puertas de seguridad en la release**:
  - `tests/security-check.js` (S1–S6): sin eval, manejadores inline ni secretos, CSP correcta, `noopener` y trinquete de interpolaciones sin escapar.
  - `npm audit` (altas).
  - `tests/browser-security.test.js` en Chromium: la CSP no bloquea la app y sí lo inyectado, y se comprueba el cifrado v2.
  - `tests/local-server.test.js`.
  - `live-check`: 0 violaciones de CSP en producción.
- Regresiones nuevas: X19 (evento de seguridad) y X20 (SimBrief sin escapar).

### Pendiente (ver HARDENING §2 y §5)
- Logon de Hoppie cifrado (5.3.1).
- `connect-src` cerrado (5.3.1).
- Acciones manuales de cuentas, repositorio y Cloudflare.
- Revisión del PC con el CIS Benchmark de Windows 11.

---

## [v5.2.0-rc.2] — 2026-11-07

Segunda candidata de la 5.2: **TechLog** y **comprobación de PIREP**, con las decisiones de Álvaro (integración completa con TechLog; PIREP con vmsACARS en modo «preparar y confirmar»).

### TechLog (app de ersindevrim, antes Fenix TechLog)
Estudiada en el PC de Álvaro con su permiso. TechLog sirve una API local en `http://127.0.0.1:7720/api/...` (state, plan, flights, defects/history, mel…) **sin CORS**. Las capturas reales están en `tests/fixtures/techlog/`.
- **Acceso**: a través del servidor local (`nbv-server.py` → `/techlog/api/...`), **solo GET y solo a rutas de consulta**. El OPS nunca escribe en TechLog: ni diferir, ni reparar, ni ajustes. Funciona con el ACARS/OPS abierto con START-ACARS en el PC del simulador; desde GitHub Pages lo indica. Puerto configurable con `NBV_TECHLOG_PORT`.
- **Módulo «TechLog»** en Ajustes (ACARS y OPS). Tu vuelo es el de «Mi callsign» de FSUIPC.
- **Tarjeta de tu vuelo**: `TECH GO · CAUTION · 2 def.`, en naranja si hay NO-GO, NOT READY o librea distinta.
- **TELEX «TECH STATUS»** en el preflight de tu vuelo, antes del WX BRIEFING: DISPATCH y PLANNER, diferidos con MEL, categoría, fecha límite y restricción, defectos abiertos, motivos, checks próximos y fuel factor.
- **Matrícula**: TechLog elige el avión por la matrícula de la librea cargada y su API no permite seleccionarlo desde fuera. Por eso, en lugar de cambiarla, el OPS **avisa** si la librea cargada no es la matrícula asignada al vuelo (actividad, tarjeta y TELEX).
- **Registro de vuelos**: al cerrar tu vuelo en TechLog se guardan la toma (fpm y pista) y los defectos aparecidos en ese vuelo (columna TOMA y CSV).

### Comprobación de PIREP (phpVMS + vmsACARS)
- La API de phpVMS solo deja presentar PIREP del dueño de la API key, y los pilotos ya los presentan con vmsACARS. Por eso el OPS **no presenta PIREP: los comprueba**.
- Cada pierna completada se contrasta con su PIREP (`GET /api/pireps/{id}`, público): estado (pendiente, aceptado, rechazado…), origen y destino frente a IVAO, y tiempo de vuelo frente a IVAO (±15 min).
- Avisos de **«PIREP sin presentar»** (30 min tras aterrizar) y **«Sin PIREP de ACARS»** (no se vio PIREP en vuelo).
- En tu vuelo sin PIREP, el botón **«Preparar»** copia los datos (horas, tiempo de vuelo y toma) y abre el formulario de PIREP de phpVMS. Lo envías tú.
- Columna PIREP en el registro y en el CSV. Un PIREP aceptado o rechazado no se vuelve a consultar.

### Pruebas
- Sección nueva `techlog` (29 casos, con las capturas reales), más `tests/techlog-server.test.js` (10 casos: solo lectura, rutas bloqueadas, POST rechazado, TechLog cerrada).
- Regresiones nuevas: X17 (TECH STATUS a otros pilotos) y X18 (PIREP final consultado otra vez).
- CSV: los números negativos (toma en fpm) ya no llevan el apóstrofo antifórmulas.

---

## [v5.2.0-rc.1] — 2026-11-06

Primera candidata de la 5.2: **saneado de la arquitectura**, la fase 2 del ADR-003 en la versión que eligió Álvaro tras medir el código. No cambia nada visible: el vuelo de referencia, los clics y el E2E dan lo mismo. Prepara el terreno para TechLog y la comprobación de PIREP (rc.2) y deja los módulos reales a un paso.

### Medido antes de empezar
48 ficheros y 348 nombres globales, con 12 variables modificadas desde otro fichero, 5 funciones declaradas dos veces y 9 sitios donde el núcleo llamaba a funciones de la app.

### Saneado
- **Contrato app → núcleo (`NBV.app`)**: el núcleo ya no llama a funciones de las apps por su nombre. Cada página registra lo que ofrece (`saveCfg`, `log` y el sonido del ACARS). Se eliminan los `typeof soundOn` y `typeof saveCfg` repartidos por el núcleo.
- **Cada variable global solo la modifica su fichero**:
  - `busy`, `autoPoll`, `scanBusy`, `lastIvaoData` y `monitorInterval` se declaran ahora donde se usan.
  - Para el resto hay funciones del fichero dueño: `rxAdd` y `rxReset` (insignia de recibidos), `msgCountRestore`, `fsuipcReconnect`, `audioContext` y `soundMuted`.
  - `phpvmsStop()` pasa a `06-phpvms.js`.
- **Sin funciones duplicadas**: el `fsuipcOnToggle` del ACARS pisaba en silencio al del núcleo; ahora se llama `acarsFsuipcOnToggle`. Los otros cuatro duplicados (`saveCfg`, `loadCfg`, `toggleCfg` y `phpvmsOnToggle`) están en páginas distintas y no se pisan.

### Nuevo verificador de arquitectura (`tests/arch-check.js`, en `npm test`)
Analiza cada fichero con `eslint-scope` y hace fallar el build si:
- R1: un nombre se declara dos veces en la misma página.
- R2: un fichero modifica una variable de otro.
- R3: el núcleo usa nombres de una app.
- R4: el ACARS usa nombres del OPS o al revés.
- R5: se usa un nombre que no declara nadie.

`tests/arch-check.test.js` demuestra que cada regla detecta su incumplimiento. Estado actual: 48 ficheros, 355 nombres y 462 dependencias entre ficheros, sin ningún incumplimiento.

---

## [v5.1.0-rc.2] — 2026-11-06

Correcciones de la revisión de código de la 5.1 (`docs/REVISION-5.1.md`). Se han aplicado las 7.

### Seguridad
- **`esc()` escapa también las comillas** (`"` → `&quot;`, `'` → `&#39;`) y vale ya para texto y para atributos. Antes, un mapa ACARS o un roster con comillas, por ejemplo llegados en un fichero de ajustes manipulado, podía inyectar atributos HTML con código.
- **Importar ajustes**:
  - El mapa ACARS solo admite callsigns, y el roster, callsigns y usuarios de SimBrief.
  - Las direcciones de red (proxy, phpVMS, FSUIPC) del fichero **no se aplican salvo que lo aceptes en una segunda confirmación** que las muestra: la API key de phpVMS se envía a esa URL y todo el tráfico pasa por el proxy. Por defecto se mantienen las de este equipo.
  - Se rechazan las direcciones no seguras: phpVMS sin https, o un proxy con `javascript:`.

### Registro de vuelos
- Una pierna que reaparece (OPS recargado con el estado caducado, o caída de IVAO en mitad del vuelo) **sigue en su misma fila** durante 12 h, en lugar de duplicarse.
- Las filas «En curso» que llevan 12 h sin datos (OPS cerrado en mitad del vuelo) se muestran **«Sin datos»**.
- CSV: los campos que empiezan por `=`, `+`, `-` o `@` llevan un apóstrofo delante para que Excel no los ejecute como fórmula.
- Con el OPS abierto en dos ventanas, al guardar **se fusionan** las filas en lugar de pisarse.

### Otros
- La copia previa a una migración de esquema ya no incluye el registro de vuelos ni la copia de la importación.
- `PUBLICAR.bat`: funciona con rutas con espacios (node y git se lanzan sin shell), y `--dry-run` ya no pregunta S/N.
- Pruebas: sección nueva `registro` (10 casos), 12 casos más en `ajustes` y 1 en `publicar`. Regresiones nuevas: X13 a X16.

---

## [v5.1.0-rc.1] — 2026-11-06

Primera candidata de la 5.1: robustez y operación (`docs/PLAN-V5.1.md` §2). Incluye todo lo de la 5.0.0-rc.2.

### Nuevo
- **Registro de vuelos** (OPS Center): cada pierna detectada queda registrada con callsign, ruta, avión, horas de detección, despegue, descenso y aterrizaje, tiempo de vuelo, mensajes (enviados, entregados, retenidos y con error), route info y estado (en curso, completado o desconectado). Se puede filtrar y exportar a CSV (separador «;», listo para Excel). Guarda hasta 500 vuelos en `nbv_flightlog`.
- **Aviso de versión nueva**: cuando se publica otra versión, aparece una barra «Nueva versión X — Recargar / Más tarde». Nunca recarga sola, para no cortar un vuelo. Comprueba `version.json` cada 15 min y al volver a la pestaña.
- **Copia de ajustes** (Ajustes → Copia de ajustes): exporta e importa la configuración, el mapa ACARS, las plantillas y el roster. **No exporta credenciales**: ni la API key de phpVMS, ni el webhook de Discord, ni el logon de Hoppie. Al importar se valida el fichero entero antes de tocar nada, se guarda una copia previa y se puede deshacer.
- **`PUBLICAR.bat`**: publicación guiada desde el PC. Hace la release con E2E, copia a M: y sincroniza el clon de NBVOPS; después enseña el `git diff --stat` y pide confirmación **S/N** antes del commit y el push. Al terminar espera al despliegue y lanza las pruebas sobre producción. Con `--dry-run` hace todo menos publicar.

### Robustez
- **Lista blanca de acciones** (revisión F2 #1): los botones solo pueden ejecutar las acciones registradas en cada página. Una ruta inyectada en un atributo, como `localStorage.clear`, ya no hace nada y queda avisada en la consola.
- **esbuild, fase 1**: lo que se publica va minimizado (−32 % de tamaño) con mapas de código para depurar. La sintaxis se comprueba contra Safari 15, Chrome, Edge y Firefox 100. El ámbito no cambia: un control verifica que la minimización no añade ni quita nombres globales, y toda la batería de caracterización se ejecuta también sobre la versión minimizada. Los módulos reales (`import`/`export`) se dejan para la 5.2 (ADR-003).
- **WebKit (Safari)**: `tests/live-check.py --browser webkit|all` ejecuta las pruebas de producción también con el motor de Safari, en escritorio y en iPhone. Hay que instalarlo una vez en el PC con `py -m playwright install webkit`.

### Pruebas
- Secciones nuevas: `ajustes` (17 casos), `version` (10) y registro de vuelos dentro de `ops` (golden del CSV), además de `tests/publicar.test.js` (8 casos, con un remoto git local).
- Regresiones nuevas: X10 (acción no registrada), X11 (el registro no cierra la pierna) y X12 (logon de Hoppie en la exportación).

---

## [v5.0.0-rc.2] — 2026-11-06

Correcciones y mejoras a partir del vuelo de validación 1 (NBV011 LIPX→EDDM, `docs/VUELO-1-INFORME.md`).

### Mensajes
- **Estado real de entrega en el OPS**: cada mensaje pasa por «enviado — esperando a que el avión lo recoja» (reloj) y luego «entregado al avión HH:MMZ» (check), con la hora de Hoppie. En el vuelo 1, la app entregó a Hoppie al instante y el Fenix recogió los mensajes en 0–1 min.
- **Mensajes de llegada retenidos si el avión ya no consulta Hoppie**: en el vuelo 1, el Fenix dejó de consultar unos 3 min después de tomar tierra y BIENVENIDO y CREW se quedaron en cola 24 h, de modo que habrían llegado en el siguiente vuelo. Ahora no se envían, quedan «retenidos» en la tarjeta y se pueden enviar con un clic.

### ATIS
- **ATIS de salida** en el WX BRIEFING (OPS y dispatch de SimBrief del ACARS) y de llegada en el ARRIVAL INFO, en este orden: controlador humano de IVAO (whazzup), **autoATIS de IVAO** (el que muestra Webeye) y, por último, Hoppie.
- **autoATIS**: `api.ivao.aero/v2/auto-atis/{ICAO}` exige una API key de IVAO. La key vive solo en el Worker (secreto `IVAO_API_KEY`), que la añade únicamente a esa ruta. Sin key, la app sigue funcionando sin autoATIS. Se descartan los autoATIS de más de 35 min, el mismo criterio que usa Webeye.
- Corregido: «EDDM ATIS IS NOT AVAILABLE» de Hoppie ya no se envía como si fuera un ATIS.

### Herramientas y pruebas
- Simulador FSUIPC igualado al servidor real con las capturas del vuelo 1: tipos desconocidos aceptados y códigos `BadMessage` y `UnknownName`. Las capturas quedan como fixtures y se comparan en cada ejecución.
- `nbv-diag.py`: UTF-8 forzado; con la salida redirigida se cerraba al escribir «→».
- Pruebas nuevas: orden de fuentes del ATIS, antigüedad del autoATIS, API key solo en el endpoint del autoATIS (Worker, 7 casos), retención tras aterrizar, estado «entregado». Regresiones nuevas: X8 (retención) y X9 («NOT AVAILABLE»).

### Pendiente (5.0.1)
- Offset de combustible: `0x0AF8` da valores no plausibles. Sin confirmar en la documentación de FSUIPC; se verificará con una captura en vuelo antes del PIREP automático. Hoy no se usa.

---

## [v5.0.0-rc.1] — 2026-11-05

Candidata de la 5.0 con la F2 («modularización») completa, publicada para el vuelo de validación. No cambia el funcionamiento ni la interfaz. La 5.0.0 definitiva llegará con la F3.

### Código fuente
- **Módulos por fichero**: el núcleo se divide en 19 ficheros (`src/core/NN-nombre.js`: red, configuración, IVAO, meteo, Hoppie, FSUIPC, plantillas, interfaz…), el ACARS en 11 (`src/app/acars/`) y el OPS en 10 (`src/app/ops/`). El build los concatena en orden; la salida era idéntica byte a byte antes de los cambios siguientes. El aislamiento real en módulos (esbuild) queda para una 5.x.
- **Offsets FSUIPC en un solo sitio** (`src/core/fsuipc-offsets.json`): el build los inserta en el núcleo y `nbv-diag.py` los lee, de modo que el diagnóstico declara exactamente los mismos 10 offsets que la app.
- **Registro del almacenamiento** (`NBV.store`): documenta las 18 claves de localStorage (quién las usa, formato y para qué sirven) y fija la versión de esquema 1 (`nbv_schema`), con un mecanismo de migración con copia previa para el futuro. No mueve ni reescribe datos.
- **Lógica del monitor OPS separada** (`NBV.opsLogic`, `src/core/10-ops-logica.js`): estado de cada vuelo, cambio de fase, nueva pierna, desconexión, EET y decisión de qué mensajes y route info enviar, sin DOM, red ni almacenamiento (el tiempo llega como parámetro). `scan()` queda como orquestador: registro, sonido, Discord, FSUIPC y envío. Lista para reutilizarla en el futuro monitor en la nube. El vuelo de referencia LEST→LEMD produce exactamente los mismos mensajes.
- Se conservan como globales los nombres que existían (`estimateEnrouteMin`, `PHASE_DEDUP`, `newSent`) para no cambiar la superficie pública: ninguna función global de la 4.9.0 desaparece.
- **Tipado JSDoc de `NBV` y `$()`**: los avisos de tipo bajan de 465 a 49 (ninguno es un fallo real), y el linter ya puede señalar errores nuevos sin que queden ocultos entre el ruido.
- **Sin manejadores inline**: los 99 `onclick`/`onchange`/`oninput`/`onkeydown` pasan a ser acciones delegadas (`data-click="uiGo|msgs"`, `NBV.act`). Siete manejadores compuestos se convierten en funciones con nombre (`uiCpReply`, `uiOnbCfg`, `uiCpClear`, `uiAcDelete`, `uiAcRemoveRow`, `apikeyCancelConfirm`; los de `manualSend` y `clearMsgHistory` pierden el `stopPropagation`, que la delegación ya cubre).

### Revisión de código (aplicada)
- El build se detiene si un fichero de módulo no sigue el patrón `NN-nombre.js`; antes lo omitía sin avisar.
- Los argumentos de las acciones solo se convierten a número si se indica con `#` (`toggleMsgBody|#3`); así un texto como `0012` llega intacto.
- Los eventos internos `input` se lanzan con `bubbles: true` y llegan también a las acciones delegadas.
- Callsign escapado en las acciones de las tarjetas del OPS.
- La prueba de clics cubre todos los botones: una segunda pasada para los que aparecen tras pulsar otros y secuencias explícitas para el borrado del mapa ACARS y la cancelación del borrado de la API key.

### Pruebas
- **Prueba de clics**: pulsa los 84 controles de las dos páginas y registra las funciones de la app que ejecuta cada uno. Comparada antes y después de la migración, solo aparecen las dos funciones envoltorio nuevas, con las mismas llamadas internas.
- `tests/store-check.js`: falla si el código usa una clave de localStorage que no está en el registro, o si hay claves registradas que ya nadie usa.
- `check` reconoce las acciones `data-*` (manejador inexistente, código muerto). Regresiones nuevas: X6 (botón mal cableado) y X7 (lógica OPS: route info fuera de tiempo); el verificador admite mutaciones repartidas en varios ficheros (11 en total, todas detectadas).
- Pruebas unitarias directas de `NBV.opsLogic`: desconexión, nueva pierna, omisión por registro, route info en modo inteligente y por intervalo, y EET.

---

## [v4.9.0] — 2026-11-05

Fase F1 de la 5.0 («consolidación»). No cambia el funcionamiento ni la interfaz: la app generada es idéntica byte a byte a la 4.8.0, salvo el número de versión y los iconos, que vuelven a ser los publicados.

### Código fuente
- **Se acaba el build por parches**: la salida de la 4.8.0 pasa a ser el código fuente (`src/`). Desaparecen la base 4.3.3, los 56 reemplazos textuales y el análisis con acorn. `build.js` pasa de 245 a 50 líneas: solo inserta la versión y el proxy y vuelve a incrustar el script de cada página.
- Estructura: `src/core/nbv-core.js` (núcleo), `src/app/` (ACARS `index.html` + `acars.js`, OPS `ops-center.html` + `ops.js`, `nbv-ui.css`), `src/pwa/` (service worker y manifiesto), `src/local/` (servidor y lanzador del PC), `src/icons/`.
- **Versión en un solo sitio**: `package.json` → `version`. Desaparece el `replaceAll('4.3.3')`.
- **Proxy por defecto en `build.config.json`**: ya no depende de acordarse de `NBV_PROXY` al compilar.
- El build se detiene si queda algún marcador sin sustituir o hay metadatos C2PA en la salida.

### Publicación
- **Worker con una sola copia** (`deploy/`): la carpeta de publicación del repo se genera desde ahí, sin copias a mano.
- **`npm run release`**: build + pruebas → paquete para M: + zip → raíz del repo GitHub (`out/publish/`) con hashes. Opciones `--copy-to` (M:), `--repo` (clon local; no hace commit ni push) y `--e2e`.

### Limpieza
- Iconos PNG: las copias de M: llevaban metadatos C2PA (6–7 KB por icono, mismos píxeles); se usan los publicados en GitHub.
- Las dependencias pasan a ser solo de desarrollo (la app no tiene dependencias).

---

## [v4.8.0] — 2026-11-03

Fase F0 de la 5.0 («red de seguridad»): sin cambios de funcionamiento ni de interfaz. Solo cambia el número de versión en la app.

### Pruebas
- **Caracterización hermética** (`tests/characterization.js`, 79 pruebas): la app generada se ejecuta contra un mundo simulado sin Internet (IVAO, Hoppie, aviationweather, NOAA, VATSIM, SimBrief, Discord y el Worker) con datos reales capturados. Fija con ficheros de referencia (`tests/golden/`) los mensajes del OPS Center en un vuelo completo LEST→LEMD, el diálogo CPDLC y la tabla de fases.
- **Simulador FSUIPC estricto** (`tests/sim/fsuipc-strict.js`): rechaza como el servidor real `127.0.0.1` (400 Invalid Hostname), la ruta raíz, la falta del subprotocolo `fsuipc` y las direcciones de offset como texto. Cada regla indica si es real, documentada o supuesta.
- **Hoppie con CORS real**: `connect.html` admite CORS y `online.html`/`callsign.html` no; un enrutado erróneo falla en la prueba igual que en el navegador.
- **Regresiones** (`tests/regressions.js`): reintroduce los fallos de 4.6.1, 4.7.1, 4.7.2 y 4.7.3 y cinco más (subprotocolo, CORS de Hoppie, duplicados del OPS, reenvío tras recarga, referencia CPDLC). La batería detecta los nueve.
- **Linter y tipos** (`npm run lint`): ESLint y `tsc --checkJs` sobre el código generado, con la línea base de la 4.7.3 como tope. Si aparece un aviso nuevo, la prueba falla.
- `npm run check` falla de verdad si detecta choques de nombres, identificadores sin declarar, manejadores inexistentes, código muerto o metadatos incrustados. Antes solo informaba.
- **E2E**: arranca su propio servidor desde `dist/` en un puerto libre. Otra versión abierta en el 8433 ya no da un falso fallo.
- `npm test` ejecuta en un solo paso las pruebas que no necesitan red.

### Herramientas
- `nbv-diag.py --capture DIR`: guarda las respuestas en bruto de FSUIPC (handshake, datos y tres sondas de rechazo) y de Hoppie para usarlas como fixtures.

### Limpieza
- `src/ui/sprite.svg` llevaba ~7,7 KB de metadatos C2PA incrustados al copiarlo; se eliminan. La versión publicada no los tenía.

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
