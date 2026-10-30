// ══════════════════════════════════════════════════════════════════
//  NBV CORE v4.6.3 — AirNubeiro ACARS / OPS Center
//  Módulo común cargado por index.html y ops-center.html.
//  Red (proxy local), IVAO, meteo, Hoppie, phpVMS, Discord, FSUIPC,
//  cifrado de API key, generadores OPS y utilidades.
//  Creado por Varo para AirNubeiro · Todos los derechos reservados
// ══════════════════════════════════════════════════════════════════
'use strict';

const NBV = window.NBV = window.NBV || {};
NBV.VERSION = '4.6.3';

// ── Endpoints ──
const HURL         = 'https://www.hoppie.nl/acars/system/connect.html'; // HTTPS + CORS: funciona sin proxy
const IVAO_WHAZZUP = 'https://api.ivao.aero/v2/tracker/whazzup';
const SIMBRIEF_API = 'https://www.simbrief.com/api/xml.fetcher.php';
const METAR_API    = 'https://aviationweather.gov/api/data/metar';
const TAF_API      = 'https://aviationweather.gov/api/data/taf';
const SIGMET_API   = 'https://aviationweather.gov/api/data/isigmet'; // internacional (Europa incluida)
const PIREP_API    = 'https://aviationweather.gov/api/data/pirep';   // requiere bbox o id+distance
// Fuentes meteo secundarias (solo si aviationweather.gov falla o no tiene datos)
const VATSIM_METAR = 'https://metar.vatsim.net/';                              // METAR, admite CORS (sin proxy)
const NOAA_METAR   = 'https://tgftp.nws.noaa.gov/data/observations/metar/stations/';
const NOAA_TAF     = 'https://tgftp.nws.noaa.gov/data/forecasts/taf/stations/';

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function ts() { return new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'; }
function tsShort() { return new Date().toISOString().substring(11, 19); }
function ss(c, t) { const b = $('sBar'), x = $('sTxt'); if (b) b.className = 'sb ' + c; if (x) x.textContent = t; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function safeNum(v) { return typeof v === 'number' ? v : (v && typeof v === 'object') ? 0 : (parseFloat(v) || 0); }
function safeStr(v) { return typeof v === 'string' ? v : (v && typeof v === 'object') ? (v.id || v.code || v.icaoCode || '') : String(v ?? ''); }
function hhmmz(d) { return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}z`; }

function splitMsg(txt, max) {
  txt = String(txt || '');
  if (txt.length <= max) return [txt];
  const chunks = []; let pos = 0;
  while (pos < txt.length) {
    let end = Math.min(pos + max, txt.length);
    if (end < txt.length) { const nl = txt.lastIndexOf('\n', end); if (nl > pos + 50) end = nl; }
    chunks.push(txt.substring(pos, end).trim());
    pos = end;
  }
  return chunks.filter(Boolean);
}

// Hoppie solo admite ASCII: normaliza tildes/ñ y elimina el resto
function sanitizeForHoppie(txt) {
  if (!txt) return '';
  return String(txt)
    .replace(/[¿¡]/g, '')
    .replace(/[→⇒]/g, '>').replace(/[←]/g, '<').replace(/[—–]/g, '-').replace(/[°º]/g, '').replace(/…/g, '...')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x00-\x7F]/g, '');
}

// Quita envoltorios {tipo {contenido}} de las respuestas inforeq/poll
function cleanHoppie(txt) {
  if (!txt) return '';
  let s = String(txt).trim();
  const m = s.match(/^\{[^{]*\{(.+)\}\s*\}$/s);
  if (m) return m[1].trim();
  if (s.startsWith('{') && s.endsWith('}')) return s.substring(1, s.length - 1).trim();
  return s;
}

// ── Audio (Web Audio, sin archivos) ──
let audioCtx;
function beep(freq = 880, dur = 0.15, vol = 0.25) {
  if (typeof soundOn === 'boolean' ? !soundOn : NBV.cfg?.loadShared?.().snd === false) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) {}
}
function notifySound() { NBV.sound.play('ok'); }
function errorSound() { NBV.sound.play('error'); }

// ══════════════════════════════════════════════════════════════════
//  RED — enrutado automático: directo si la API admite CORS,
//  proxy local (nbv-server.py) si no, o proxy personalizado.
// ══════════════════════════════════════════════════════════════════
NBV.net = (() => {
  // Verificado 2026-10: estas APIs devuelven Access-Control-Allow-Origin
  const DIRECT_CORS = new Set(['api.ivao.aero', 'www.simbrief.com', 'discord.com', 'discordapp.com', 'www.hoppie.nl', 'metar.vatsim.net']);
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
  let localProxy = null; // null = sin comprobar, true/false tras probe

  const onLocalServer = () => /^https?:$/.test(location.protocol) && LOCAL_HOSTS.has(location.hostname);

  // Proxy público heredado (corsproxy.io sin key) ya no funciona → se ignora
  function isLegacyProxy(p) { return /corsproxy\.io\/\?/i.test(p) && !/[?&]key=/i.test(p); }
  // Proxy por defecto de la versión publicada (GitHub Pages); se fija en el build
  const DEFAULT_PROXY = 'https://nbv-proxy.ilfuzza.workers.dev/?url=';
  function customProxy() {
    const p = ($('cP')?.value || '').trim();
    if (p && !isLegacyProxy(p)) return p;
    return DEFAULT_PROXY && !onLocalServer() ? DEFAULT_PROXY : '';
  }
  function viaCustom(p, url) {
    return p.includes('{url}') ? p.replace('{url}', encodeURIComponent(url)) : p + encodeURIComponent(url);
  }
  function needsProxy(u) {
    if (location.protocol === 'https:' && u.protocol === 'http:') return true; // mixed content
    return !DIRECT_CORS.has(u.hostname);
  }
  // Devuelve la URL real a pedir (síncrono, compatible con fetch(proxy(url)))
  function route(url) {
    let u; try { u = new URL(url, location.href); } catch (e) { return url; }
    if (u.origin === location.origin || !needsProxy(u)) return url;
    if (onLocalServer() && localProxy !== false) return '/proxy?url=' + encodeURIComponent(u.href);
    const p = customProxy();
    return p ? viaCustom(p, u.href) : url;
  }
  async function probe() {
    if (!onLocalServer()) { localProxy = false; return false; }
    try {
      const r = await fetch('/__nbv/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      localProxy = r.ok;
    } catch (e) { localProxy = false; }
    return localProxy;
  }
  // Diagnóstico legible para la barra de estado
  function mode() {
    if (onLocalServer() && localProxy !== false) return { ok: true, label: 'Proxy local' };
    if (customProxy()) return { ok: true, label: 'Proxy personalizado' };
    if (!onLocalServer()) return { ok: false, partial: true, label: 'Versión web sin proxy: TELEX, CPDLC, IVAO y METAR funcionan; TAF, SIGMET y phpVMS necesitan el proxy (Ajustes → Proxy personalizado)' };
    return { ok: false, label: 'Sin proxy — abre la app con START-ACARS.bat' };
  }
  // fetch con enrutado + timeout + error HTTP explícito
  async function req(url, opts = {}) {
    const { timeout = 12000, retries, ...rest } = opts;
    const idempotent = !rest.method || rest.method === 'GET';
    let left = retries ?? (idempotent ? 1 : 0);
    for (;;) {
      try {
        return await fetch(route(url), { signal: AbortSignal.timeout(timeout), ...rest });
      } catch (e) {
        // Reintento único en GET ante timeout o fallo de red transitorio
        if (left-- > 0 && (e.name === 'TimeoutError' || e.name === 'AbortError' || e.name === 'TypeError')) { await sleep(600); continue; }
        if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error(`timeout ${new URL(url, location.href).hostname}`);
        throw e;
      }
    }
  }
  async function text(url, opts) {
    const r = await req(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${new URL(url).hostname}`);
    return r.text();
  }
  async function json(url, opts) {
    const r = await req(url, opts);
    if (!r.ok) throw new Error(`HTTP ${r.status} ${new URL(url).hostname}`);
    return r.json();
  }
  return { route, probe, mode, req, text, json, isLegacyProxy, get localProxy() { return localProxy; } };
})();

// Compatibilidad con el código existente
function proxy(url) { return NBV.net.route(url); }
function phpvmsProxy(url) { return NBV.net.route(url); }

// ══════════════════════════════════════════════════════════════════
//  CONFIGURACIÓN COMPARTIDA ACARS ↔ OPS CENTER
//  Logon, callsign, proxy, FSUIPC, phpVMS y Discord se configuran
//  una sola vez y ambas apps los leen.
// ══════════════════════════════════════════════════════════════════
NBV.cfg = (() => {
  const KEY = 'nbv_shared';
  // discordUrl ya no se guarda aquí: va cifrado en 'an_dc' (v4.5)
  const FIELDS = ['l', 's', 'p', 'fsuipcEn', 'fsuipcUrl', 'fsuipcCs', 'fsuipcPoll',
    'phpvmsEn', 'phpvmsUrl', 'phpvmsPoll', 'discordEn',
    'dcEvFlight', 'dcEvPhase', 'dcEvTelex', 'dcEvAlert', 'snd', 'sndMode'];
  function clean(o) {
    if (o && typeof o.p === 'string' && NBV.net.isLegacyProxy(o.p)) o.p = '';
    return o;
  }
  function loadShared() {
    try { return clean(JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return {}; }
  }
  function saveShared(obj) {
    try {
      const cur = loadShared();
      for (const k of FIELDS) if (obj[k] !== undefined) cur[k] = obj[k];
      localStorage.setItem(KEY, JSON.stringify(clean(cur)));
      try { NBV.bus.emitRemote('cfg'); } catch (e) {}
    } catch (e) {}
  }
  // Migración desde 4.3.x: la primera vez, siembra la compartida con la config propia de la app
  function seed(own) {
    if (!own) return;
    const sh = loadShared(); let changed = false;
    for (const k of FIELDS) if (sh[k] === undefined && own[k] !== undefined && own[k] !== '') { sh[k] = own[k]; changed = true; }
    if (changed) try { localStorage.setItem(KEY, JSON.stringify(clean(sh))); } catch (e) {}
  }
  // Mezcla config propia de la app con la compartida (la compartida manda)
  function merge(own) {
    seed(own);
    const sh = loadShared();
    const out = clean(Object.assign({}, own || {}));
    for (const k of FIELDS) if (sh[k] !== undefined) out[k] = sh[k];
    return out;
  }
  return { loadShared, saveShared, merge, FIELDS };
})();

// Bus mínimo entre la app principal y el OPS Center embebido (mismo origen)
NBV.bus = (() => {
  const h = {};
  function on(ev, fn) { (h[ev] = h[ev] || []).push(fn); }
  function emitLocal(ev, data) { (h[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.warn('[NBV bus]', e); } }); }
  // Solo hacia la otra ventana (parent ↔ iframe), sin eco local
  function emitRemote(ev, data) {
    try { if (window.parent !== window && window.parent.NBV?.bus) window.parent.NBV.bus.emitLocal(ev, data); } catch (e) {}
    try { document.querySelectorAll('iframe').forEach(f => f.contentWindow?.NBV?.bus?.emitLocal(ev, data)); } catch (e) {}
  }
  function emit(ev, data) { emitLocal(ev, data); emitRemote(ev, data); }
  return { on, emit, emitLocal, emitRemote };
})();

// Activa/desactiva visualmente un bloque de campos de módulo (ambos estilos de UI)
function cfgFieldsToggle(id, en) {
  const el = $(id); if (!el) return;
  if (el.classList.contains('cfg-mod-fields')) { el.classList.toggle('active', !!en); return; }
  el.style.opacity = en ? '1' : '.45';
  el.style.pointerEvents = en ? '' : 'none';
}
// Lee del DOM los campos comunes (mismos IDs en ambas apps)
function cfgCollectShared() {
  const v = id => ($(id)?.value ?? '').trim(), c = id => !!$(id)?.checked;
  return {
    l: v('cL'), s: v('cS').toUpperCase(), p: v('cP'),
    fsuipcEn: c('fsuipcEn'), fsuipcUrl: v('fsuipcUrl') || 'ws://127.0.0.1:2048/fsuipc/', fsuipcCs: v('fsuipcCs').toUpperCase(), fsuipcPoll: v('fsuipcPoll') || '500',
    phpvmsEn: c('phpvmsEn'), phpvmsUrl: v('phpvmsUrl') || 'https://operaciones.airnubeiro.es', phpvmsPoll: v('phpvmsPoll') || '30',
    discordEn: c('discordEn'),
    snd: typeof soundOn === 'boolean' ? soundOn : undefined, sndMode: $('sndMode') ? v('sndMode') : undefined,
    dcEvFlight: $('dcEvFlight') ? c('dcEvFlight') : true, dcEvPhase: $('dcEvPhase') ? c('dcEvPhase') : true,
    dcEvTelex: $('dcEvTelex') ? c('dcEvTelex') : true, dcEvAlert: $('dcEvAlert') ? c('dcEvAlert') : true,
  };
}
// Vuelca en el DOM los campos comunes (sin arrancar módulos)
function cfgApplyFields(c) {
  if (!c) return;
  const setV = (id, val) => { const el = $(id); if (el && val !== undefined && val !== null) el.value = val; };
  const setC = (id, val) => { const el = $(id); if (el && val !== undefined) el.checked = !!val; };
  setV('cL', c.l); setV('cS', c.s);
  if (c.p !== undefined) setV('cP', NBV.net.isLegacyProxy(c.p || '') ? '' : c.p);
  setV('fsuipcUrl', c.fsuipcUrl); setV('fsuipcCs', c.fsuipcCs); setV('fsuipcPoll', c.fsuipcPoll);
  setV('phpvmsUrl', c.phpvmsUrl); setV('phpvmsPoll', c.phpvmsPoll); setV('sndMode', c.sndMode);
  if (typeof soundOn === 'boolean' && typeof c.snd === 'boolean') { soundOn = c.snd; NBV.ui ? NBV.ui.snd(soundOn) : null; }
  setC('fsuipcEn', c.fsuipcEn); setC('phpvmsEn', c.phpvmsEn); setC('discordEn', c.discordEn);
  setC('dcEvFlight', c.dcEvFlight); setC('dcEvPhase', c.dcEvPhase); setC('dcEvTelex', c.dcEvTelex); setC('dcEvAlert', c.dcEvAlert);
  cfgFieldsToggle('fsuipcCfgFields', !!$('fsuipcEn')?.checked);
  cfgFieldsToggle('phpvmsCfgFields', !!$('phpvmsEn')?.checked);
  cfgFieldsToggle('discordCfgFields', !!$('discordEn')?.checked);
}
// Aviso visible si no hay forma de salvar CORS
async function netCheckBanner() {
  await NBV.net.probe();
  const m = NBV.net.mode();
  if (!m.ok) ss(m.partial ? 'idle' : 'err', m.partial ? m.label : `✗ ${m.label}`);
  return m;
}

// ══════════════════════════════════════════════════════════════════
//  IVAO — whazzup con caché compartida (una descarga sirve a ambas apps)
// ══════════════════════════════════════════════════════════════════
NBV.ivao = (() => {
  const TTL = 15000; // IVAO refresca cada 15 s
  let cache = null, cacheAt = 0, inflight = null;
  function shared() {
    try { if (window.parent !== window && window.parent.NBV?.ivao && window.parent.NBV.ivao !== api) return window.parent.NBV.ivao; } catch (e) {}
    return null;
  }
  async function get({ maxAge = TTL } = {}) {
    const p = shared(); if (p) return p.get({ maxAge });
    if (cache && Date.now() - cacheAt < maxAge) return cache;
    if (inflight) return inflight;
    inflight = (async () => {
      const r = await NBV.net.req(IVAO_WHAZZUP, { timeout: 30000, cache: 'no-store' });
      if (!r.ok) throw new Error(`IVAO HTTP ${r.status}`);
      const txt = await r.text();
      let data; try { data = JSON.parse(txt); } catch (e) { throw new Error(`IVAO: respuesta inválida (${txt.length} bytes)`); }
      cache = data; cacheAt = Date.now();
      return data;
    })();
    try { return await inflight; } finally { inflight = null; }
  }
  function last() { const p = shared(); return p ? p.last() : cache; }
  const pilots = d => d?.clients?.pilots || [];
  const atcs = d => d?.clients?.atcs || [];
  const depOf = p => safeStr(p?.flightPlan?.departureId).toUpperCase();
  const arrOf = p => safeStr(p?.flightPlan?.arrivalId).toUpperCase();
  // Tipo de posición: IVAO v2 da atcSession.position; fallback por callsign
  function posOf(a) {
    const pos = safeStr(a?.atcSession?.position).toUpperCase();
    if (pos) return pos === 'DEP' ? 'APP' : pos;
    return atcType(safeStr(a?.callsign).toUpperCase());
  }
  // ATIS de un aeropuerto directamente del whazzup (sin Hoppie)
  function atisFor(data, icao) {
    icao = String(icao || '').toUpperCase();
    const order = { APP: 0, TWR: 1, CTR: 2, GND: 3, DEL: 4 };
    return atcs(data)
      .filter(a => a.atis?.lines?.length && safeStr(a.callsign).toUpperCase().startsWith(icao + '_'))
      .sort((a, b) => (order[posOf(a)] ?? 9) - (order[posOf(b)] ?? 9))
      .map(a => ({ station: a.callsign, letter: a.atis.revision || '', text: a.atis.lines.slice(1).join(' ').trim() }));
  }
  // Resumen de tráfico de un aeropuerto
  function traffic(data, icao) {
    icao = String(icao || '').toUpperCase();
    const ps = pilots(data);
    const arriving = ps.filter(p => arrOf(p) === icao);
    const departing = ps.filter(p => depOf(p) === icao);
    const total = arriving.length + departing.length;
    const density = total === 0 ? 'NINGUNO' : total <= 3 ? 'BAJO' : total <= 8 ? 'MODERADO' : 'ALTO';
    return { arriving, departing, total, density };
  }
  // ATC relevante: posiciones locales del ICAO + CTR/FSS del país (sin GND/DEL)
  function atcFor(data, icao, { includeGround = false } = {}) {
    icao = String(icao || '').toUpperCase();
    const p2 = icao.substring(0, 2);
    return atcs(data).filter(a => {
      const cs = safeStr(a.callsign).toUpperCase(); if (!cs) return false;
      const t = posOf(a);
      if (!includeGround && (t === 'GND' || t === 'DEL')) return false;
      if (cs.startsWith(icao)) return true;
      return (t === 'CTR' || t === 'FSS') && cs.startsWith(p2);
    });
  }
  const api = { get, last, pilots, atcs, depOf, arrOf, posOf, atisFor, traffic, atcFor, TTL };
  return api;
})();

// Compatibilidad: ivaoFetch() devolvía un Response; ahora usa la caché
async function ivaoFetch() { const d = await NBV.ivao.get(); return { ok: true, status: 200, json: async () => d }; }

// Frecuencia IVAO → MHz. v2 la da ya en MHz (118.555); v1 en kHz/Hz
function fmtFreq(f) {
  f = parseFloat(f);
  if (!f) return '---';
  if (f > 1e6) f = f / 1e6; else if (f > 1000) f = f / 1000;
  return f.toFixed(3);
}
function atcType(cs) {
  cs = String(cs || '').toUpperCase();
  if (cs.includes('_DEL')) return 'DEL';
  if (cs.includes('_GND')) return 'GND';
  if (cs.includes('_TWR')) return 'TWR';
  if (cs.includes('_APP') || cs.includes('_DEP')) return 'APP';
  if (cs.includes('_CTR')) return 'CTR';
  if (cs.includes('_FSS')) return 'FSS';
  return 'ATC';
}
const atcTypeOf = atcType;

// Estado IVAO → etiqueta de tabla (OCC / Stream)
function mapState(raw) {
  const s = String(raw || '').toLowerCase();
  // Clases CSS existentes: st-gnd, st-dep, st-clb, st-enr, st-crz, st-dsc, st-app, st-lnd
  if (s.includes('boarding')) return { label: 'BOARDING', cls: 'gnd' };
  if (s.includes('departing')) return { label: 'DEPARTING', cls: 'dep' };
  if (s.includes('climb')) return { label: 'CLIMB', cls: 'clb' };
  if (s.includes('en route')) return { label: 'EN ROUTE', cls: 'enr' };
  if (s.includes('descen')) return { label: 'DESCENT', cls: 'dsc' };
  if (s.includes('approach')) return { label: 'APPROACH', cls: 'app' };
  if (s.includes('landed')) return { label: 'LANDED', cls: 'lnd' };
  if (s.includes('block')) return { label: 'ON BLOCKS', cls: 'gnd' };
  return { label: raw ? String(raw).toUpperCase() : '—', cls: 'gnd' };
}

// ══════════════════════════════════════════════════════════════════
//  GEO
// ══════════════════════════════════════════════════════════════════
function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065, toR = Math.PI / 180;
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearing(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180, dLon = (lon2 - lon1) * toR;
  const y = Math.sin(dLon) * Math.cos(lat2 * toR);
  const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) - Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
const bearingTo = bearing;
function isAhead(pLat, pLon, pHdg, tLat, tLon) {
  let diff = Math.abs(bearing(pLat, pLon, tLat, tLon) - (pHdg || 0));
  if (diff > 180) diff = 360 - diff;
  return diff < 100;
}
// Distancia mínima de un punto a un polígono SIGMET (aprox. por vértices y centroide)
function distToPolyNm(lat, lon, coords) {
  if (!Array.isArray(coords) || !coords.length) return Infinity;
  let min = Infinity, cLat = 0, cLon = 0;
  for (const c of coords) { const d = haversineNm(lat, lon, c.lat, c.lon); if (d < min) min = d; cLat += c.lat; cLon += c.lon; }
  cLat /= coords.length; cLon /= coords.length;
  // Dentro del polígono (ray casting) → distancia 0
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i].lon, yi = coords[i].lat, xj = coords[j].lon, yj = coords[j].lat;
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-9) + xi)) inside = !inside;
  }
  return inside ? 0 : Math.min(min, haversineNm(lat, lon, cLat, cLon));
}

const APT_COORDS = {
  'LEMD':[40.472,-3.561],'LEBL':[41.297,2.078],'LEPA':[39.551,2.739],'LEAL':[38.282,-0.558],
  'LEMG':[36.675,-4.499],'LEZL':[37.418,-5.893],'LEBB':[43.301,-2.911],'LEST':[42.896,-8.415],
  'LECO':[43.302,-8.377],'LEVX':[42.232,-8.627],'LEVC':[39.489,-0.473],'LEXJ':[43.427,-3.820],
  'LEAS':[43.564,-6.035],'LEIB':[38.873,1.373],'LEZG':[41.666,-1.042],'LEGE':[41.901,2.760],
  'GCXO':[28.483,-16.341],'GCLP':[27.932,-15.387],'GCFV':[28.453,-13.864],'GCTS':[28.045,-16.572],
  'GCRR':[28.945,-13.605],'GCLA':[28.626,-17.756],
  'LPPT':[38.774,-9.134],'LPPR':[41.236,-8.681],'LPFR':[37.014,-7.966],'LPMA':[32.694,-16.774],
  'LFPG':[49.010,2.548],'LFPO':[48.723,2.359],'LFBO':[43.629,1.364],'LFML':[43.437,5.214],
  'LFMN':[43.658,7.216],'LFLL':[45.726,5.091],'LFSB':[47.590,7.529],
  'EGLL':[51.470,-0.461],'EGKK':[51.148,-0.190],'EGSS':[51.885,0.235],'EGGW':[51.875,-0.368],
  'EGCC':[53.354,-2.275],'EGGP':[53.334,-2.850],'EGPH':[55.950,-3.373],'EGBB':[52.454,-1.748],
  'EDDF':[50.033,8.570],'EDDM':[48.354,11.786],'EDDB':[52.362,13.509],'EDDL':[51.289,6.767],
  'EDDK':[50.866,7.143],'EDDS':[48.690,9.222],'EDDH':[53.630,9.988],
  'LIRF':[41.800,12.239],'LIMC':[45.630,8.723],'LIPZ':[45.505,12.352],'LIPE':[44.535,11.289],
  'LIMF':[45.200,7.650],'LIRN':[40.886,14.291],'LICC':[37.467,15.066],'LICJ':[38.176,13.091],
  'EHAM':[52.308,4.764],'EBBR':[50.901,4.484],'EBCI':[50.459,4.454],'EIDW':[53.421,-6.270],'EICK':[51.841,-8.491],
  'ESSA':[59.652,17.919],'ESGG':[57.663,12.280],'ENGM':[60.194,11.100],'ENBR':[60.294,5.218],'EKCH':[55.618,12.656],
  'LOWW':[48.110,16.570],'LSZH':[47.458,8.548],'LSGG':[46.238,6.109],
  'LKPR':[50.101,14.260],'EPWA':[52.166,20.967],'EPKK':[50.078,19.785],
  'LGAV':[37.936,23.944],'LGTS':[40.520,22.971],'LGIR':[35.340,25.180],
  'LTFM':[41.275,28.752],'LTAI':[36.899,30.800],'LTBS':[36.713,28.793],
};
function calcDistToAirport(lat, lon, icao) {
  const c = APT_COORDS[String(icao || '').toUpperCase()];
  return c ? haversineNm(lat, lon, c[0], c[1]) : null;
}

// ══════════════════════════════════════════════════════════════════
//  METEO — aviationweather.gov (vía proxy, no admite CORS)
// ══════════════════════════════════════════════════════════════════
NBV.wx = (() => {
  const cache = new Map();
  async function cached(key, ttl, fn) {
    const c = cache.get(key);
    if (c && Date.now() - c.t < ttl) return c.v;
    const v = await fn(); cache.set(key, { v, t: Date.now() }); return v;
  }
  const ids = list => [].concat(list).map(x => String(x || '').toUpperCase()).filter(x => /^[A-Z0-9]{3,4}$/.test(x) && x !== '????');
  // METAR crudo; hours=1 → la observación más reciente primero
  // Prueba fuentes en orden; la primera con datos gana. Error solo si todas fallan.
  const src = {};
  async function firstOk(kind, tries) {
    const errs = [];
    for (const [name, fn] of tries) {
      try { const v = String(await fn() || '').trim(); if (v) { src[kind] = name; return v; } errs.push(`${name}: sin datos`); }
      catch (e) { errs.push(`${name}: ${e.message}`); }
    }
    src[kind] = '';
    if (errs.every(e => e.endsWith('sin datos'))) return '';
    throw new Error(errs.join(' · '));
  }
  // NOAA: un fichero por estación; 1.ª línea = fecha
  async function noaa(base, i) {
    const parts = await Promise.all(i.map(id => NBV.net.text(`${base}${id}.TXT`, { timeout: 8000 })
      .then(t => t.split('\n').slice(1).map(l => l.trim()).filter(Boolean).join('\n')).catch(() => '')));
    return parts.filter(Boolean).join('\n');
  }
  async function metar(list, hours = 1) {
    const i = ids(list); if (!i.length) return '';
    return cached(`m:${i}:${hours}`, 120000, () => firstOk('metar', [
      ['aviationweather.gov', async () => NBV.net.text(`${METAR_API}?ids=${i.join(',')}&format=raw&hours=${hours}`, { timeout: 7000 })],
      ['VATSIM', async () => NBV.net.text(`${VATSIM_METAR}${i.join(',')}`, { timeout: 7000 })],
      ['NOAA', () => noaa(NOAA_METAR, i)],
    ]));
  }
  async function metarLatest(icao) { return (await metar(icao, 1)).split('\n').find(l => l.trim()) || ''; }
  async function taf(list) {
    const i = ids(list); if (!i.length) return '';
    return cached(`t:${i}`, 600000, () => firstOk('taf', [
      ['aviationweather.gov', async () => NBV.net.text(`${TAF_API}?ids=${i.join(',')}&format=raw`, { timeout: 7000 })],
      ['NOAA', () => noaa(NOAA_TAF, i)],
      ['Hoppie', async () => (await Promise.all(i.map(id => hoppieInfo('TAF', id).catch(() => '')))).filter(Boolean).join('\n')],
    ]));
  }
  // SIGMET internacionales cerca de una posición
  async function sigmetsNear(lat, lon, radiusNm = 400, { prefixes = [] } = {}) {
    const all = await cached('isig', 600000, () => NBV.net.json(`${SIGMET_API}?format=json`, { timeout: 10000 }));
    const now = Date.now() / 1000, out = [];
    for (const s of Array.isArray(all) ? all : []) {
      if (s.validTimeTo && s.validTimeTo < now) continue;
      const raw = String(s.rawSigmet || '').replace(/\s+/g, ' ').trim();
      const d = distToPolyNm(lat, lon, s.coords);
      const fir = String(s.firId || s.icaoId || '');
      if (d <= radiusNm || (!s.coords?.length && prefixes.some(p => p && fir.startsWith(p)))) {
        const fl = (s.base != null || s.top != null) ? ` ${s.base ? 'FL' + Math.round(s.base / 100) : 'SFC'}/FL${Math.round((s.top || 0) / 100)}` : '';
        out.push({ raw, dist: isFinite(d) ? Math.round(d) : null, coords: s.coords?.length ? s.coords : null, summary: `${fir} ${s.hazard || '?'}${s.qualifier ? ' ' + s.qualifier : ''}${fl}` });
      }
    }
    return out.sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999));
  }
  // PIREP con turbulencia/engelamiento en un radio (la API exige bbox)
  async function pirepsNear(lat, lon, radiusNm = 400) {
    const dLat = radiusNm / 60, dLon = radiusNm / (60 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => v.toFixed(2)).join(',');
    const key = `p:${Math.round(lat)}:${Math.round(lon)}:${radiusNm}`;
    const data = await cached(key, 300000, () => NBV.net.json(`${PIREP_API}?format=json&age=4&bbox=${bbox}`, { timeout: 10000 }));
    const out = [];
    for (const p of Array.isArray(data) ? data : []) {
      const pLat = p.lat ?? p.latitude, pLon = p.lon ?? p.longitude;
      if (pLat == null || pLon == null) continue;
      const turb = p.tbInt1 || p.turbulenceCondition || p.tbInt || '';
      const ice = p.icgInt1 || p.icingCondition || p.icInt || '';
      if (!turb && !ice) continue;
      const d = haversineNm(lat, lon, pLat, pLon);
      if (d > radiusNm) continue;
      out.push({ raw: String(p.rawOb || `FL${p.fltLvl || '?'} TURB:${turb || 'NIL'} ICE:${ice || 'NIL'}`), dist: Math.round(d), lat: +pLat, lon: +pLon });
    }
    return out.sort((a, b) => a.dist - b.dist);
  }
  return { metar, metarLatest, taf, sigmetsNear, pirepsNear, source: kind => src[kind] || '' };
})();

function parseMetarSummary(raw) {
  const result = { wind: null, vis: null, visWarn: false, qnh: null, temp: null };
  try {
    const wm = raw.match(/\b(\d{3}|VRB)(\d{2,3})(G\d{2,3})?(KT|MPS)\b/);
    if (wm) result.wind = `${wm[1] === 'VRB' ? 'VRB' : wm[1] + '°'}/${wm[2]}${wm[3] || ''}${wm[4]}`;
    if (raw.includes('CAVOK')) result.vis = 'CAVOK';
    else {
      const vm = raw.match(/\s(\d{4})\s/);
      if (vm) { const v = parseInt(vm[1]); result.vis = v >= 9999 ? '10km+' : (v >= 1000 ? (v / 1000).toFixed(1) + 'km' : v + 'm'); result.visWarn = v < 5000; }
    }
    const qm = raw.match(/\b(Q\d{4}|A\d{4})\b/); if (qm) result.qnh = qm[1];
    const tm = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
    if (tm) result.temp = `${tm[1].replace('M', '-')}°/${tm[2].replace('M', '-')}°`;
  } catch (e) {}
  return result;
}

// ══════════════════════════════════════════════════════════════════
//  HOPPIE ACARS
// ══════════════════════════════════════════════════════════════════
async function hReq(to, type, packet) {
  const clean = type === 'telex' || type === 'inforeq' ? sanitizeForHoppie(packet) : String(packet ?? '');
  const r = await NBV.net.req(HURL, {
    method: 'POST', timeout: 15000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ logon: ($('cL')?.value || '').trim(), from: ($('cS')?.value || '').trim().toUpperCase(), to, type, packet: clean }).toString()
  });
  if (!r.ok) throw new Error(`Hoppie HTTP ${r.status}`);
  return (await r.text()).trim();
}
const hoppieOk = raw => String(raw || '').toLowerCase().startsWith('ok');
// inforeq limpio: devuelve el texto o '' si no hay datos
async function hoppieInfo(kind, icao) {
  const raw = await hReq('SERVER', 'inforeq', `${kind} ${icao}`);
  if (!hoppieOk(raw)) return '';
  return cleanHoppie(raw.substring(2).trim());
}
// TELEX troceado (máx 480 por bloque) con numeración [n/N]
async function hoppieSendTelex(to, body, { gap = 500 } = {}) {
  const chunks = splitMsg(sanitizeForHoppie(body), 480);
  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
    const raw = await hReq(to, 'telex', prefix + chunks[i]);
    if (!hoppieOk(raw)) throw new Error(raw || 'Hoppie sin respuesta');
    if (i < chunks.length - 1) await sleep(gap);
  }
  return chunks.length;
}

// ══════════════════════════════════════════════════════════════════
//  API KEY phpVMS — AES-256-GCM + PBKDF2
//  Clave derivada estable (sin resolución de pantalla) y común a ambas
//  apps. Migra automáticamente las keys cifradas por v4.3.x.
// ══════════════════════════════════════════════════════════════════
function cryptoSalt() {
  let salt = localStorage.getItem('an_ks');
  if (!salt) {
    salt = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('an_ks', salt);
  }
  return new Uint8Array(salt.match(/.{2}/g).map(h => parseInt(h, 16)));
}
async function cryptoKeyFrom(fp) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(fp), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: cryptoSalt(), iterations: 120000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
const cryptoFp = () => `${navigator.userAgent}|${navigator.language}|AN_NBV`;
const cryptoLegacyFps = () => ['AN_OPS', 'AN_ACARS'].map(s => `${navigator.userAgent}|${screen.width}x${screen.height}|${navigator.language}|${s}`);
async function cryptoGetKey() { return cryptoKeyFrom(cryptoFp()); }
async function cryptoEncrypt(plaintext) {
  const key = await cryptoGetKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const buf = new Uint8Array(12 + enc.byteLength); buf.set(iv); buf.set(new Uint8Array(enc), 12);
  return btoa(String.fromCharCode(...buf));
}
async function cryptoDecryptWith(key, b64) {
  const data = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12));
  return new TextDecoder().decode(dec);
}
async function cryptoDecrypt(b64) {
  try { return await cryptoDecryptWith(await cryptoGetKey(), b64); } catch (e) {}
  for (const fp of cryptoLegacyFps()) {
    try {
      const plain = await cryptoDecryptWith(await cryptoKeyFrom(fp), b64);
      localStorage.setItem('an_ak', await cryptoEncrypt(plain)); // migrar a clave estable
      console.info('[NBV] API key migrada al cifrado v4.4');
      return plain;
    } catch (e) {}
  }
  return null;
}
let _akCache = null;
async function phpvmsGetKey() {
  const blob = localStorage.getItem('an_ak');
  if (!blob) return '';
  if (_akCache && _akCache.blob === blob) return _akCache.key;
  const key = (await cryptoDecrypt(blob)) || '';
  _akCache = { blob: localStorage.getItem('an_ak'), key };
  return key;
}

function phpvmsSetStatus(msg, ok) {
  const el = $('phpvmsStatus'); if (!el) return;
  el.textContent = msg;
  el.style.color = ok === true ? '#a78bfa' : ok === false ? 'var(--wrn,#fbbf24)' : 'var(--tx3)';
}
function phpvmsBase() { return (($('phpvmsUrl')?.value || '').trim() || 'https://operaciones.airnubeiro.es').replace(/\/$/, ''); }

function apikeyOnInput() {
  const val = ($('phpvmsKeyRaw')?.value || '').trim();
  const btn = $('apikeyValidateBtn');
  if (btn) btn.style.display = val.length > 8 ? '' : 'none';
}
function apikeyRenderState() {
  const display = $('apikeyDisplay'), wrap = $('apikeyInputWrap');
  if (!display) return;
  if (localStorage.getItem('an_ak')) {
    display.innerHTML = `<div class="apikey-badge ok">API Key cifrada (AES-256) <button class="apikey-btn clear" onclick="apikeyClear()">Borrar</button></div>`;
  } else {
    display.innerHTML = `<div class="apikey-badge err" style="cursor:pointer" onclick="apikeyShowInput()">Sin API Key — haz clic para configurarla</div>`;
  }
  if (wrap) wrap.style.display = 'none';
}
function apikeyShowInput() { const w = $('apikeyInputWrap'); if (w) w.style.display = ''; $('phpvmsKeyRaw')?.focus(); }
async function apikeyValidateAndSave() {
  const raw = ($('phpvmsKeyRaw')?.value || '').trim();
  if (!raw) return;
  const btn = $('apikeyValidateBtn');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  phpvmsSetStatus('Validando API Key contra phpVMS…', null);
  try {
    const r = await NBV.net.req(`${phpvmsBase()}/api/user`, { headers: { 'X-API-Key': raw, 'Accept': 'application/json' }, timeout: 10000 });
    if (!r.ok) throw new Error(`HTTP ${r.status} — key inválida o sin permisos`);
    const json = await r.json();
    const name = json?.data?.name || json?.name || 'usuario';
    localStorage.setItem('an_ak', await cryptoEncrypt(raw));
    _akCache = null;
    $('phpvmsKeyRaw').value = '';
    apikeyRenderState();
    phpvmsSetStatus(`✓ API Key validada (${name}) y cifrada con AES-256`, true);
    NBV.bus.emit('apikey');
  } catch (e) {
    phpvmsSetStatus(`✗ Validación fallida: ${e.message}`, false);
  }
  if (btn) { btn.textContent = 'Validar'; btn.disabled = false; }
}
function apikeyClear() {
  const d = $('apikeyDisplay');
  // confirmación en línea (sin confirm(), bloqueado en algunos contextos)
  if (d && !d.dataset.confirm) {
    d.dataset.confirm = '1';
    d.innerHTML = `<div class="apikey-badge err">¿Borrar la API Key? <button class="apikey-btn clear" onclick="apikeyClear()" style="margin-left:6px;position:static;transform:none">Sí, borrar</button> <button class="apikey-btn" onclick="delete $('apikeyDisplay').dataset.confirm;apikeyRenderState()" style="position:static;transform:none">Cancelar</button></div>`;
    return;
  }
  if (d) delete d.dataset.confirm;
  localStorage.removeItem('an_ak'); _akCache = null;
  apikeyRenderState();
  phpvmsSetStatus('API Key eliminada', null);
  NBV.bus.emit('apikey');
}

// ══════════════════════════════════════════════════════════════════
//  DISCORD WEBHOOK — cola con control de rate-limit
// ══════════════════════════════════════════════════════════════════
const discordQueue = [];
let discordSending = false, discordLastSent = 0;
const DC_MIN_GAP = 420;
const DC_COLORS = { PREFLIGHT: 0xFBBF24, ENROUTE: 0x60A5FA, DESCENT: 0xA78BFA, LANDED: 0x34D399, DETECTED: 0x2E8CF0, TELEX: 0x6EE7B7, ALERT: 0xF87171, TEST: 0x7289DA };
const DISCORD_COLORS = DC_COLORS;
const DC_MSG_COLORS = { out: 0x2E8CF0, in: 0x60A5FA, cpm: 0xA78BFA, logon: 0x34D399, erm: 0xF87171 };

function discordSetStatus(msg, ok) {
  const el = $('discordStatus'); if (!el) return;
  el.textContent = msg;
  el.style.color = ok === true ? '#7289da' : ok === false ? 'var(--wrn,#fbbf24)' : 'var(--tx3)';
}
function discordEnabled() { return !!$('discordEn')?.checked && !!dcUrl(); }
function discordEvFlight() { return discordEnabled() && $('dcEvFlight')?.checked !== false; }
function discordEvPhase() { return discordEnabled() && $('dcEvPhase')?.checked !== false; }
function discordEvTelex() { return discordEnabled() && $('dcEvTelex')?.checked !== false; }
function discordEvAlert() { return discordEnabled() && $('dcEvAlert')?.checked !== false; }
function dTrunc(s, max = 1024) { s = String(s || ''); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
function discordEmbed({ color, title, description, fields = [], footer = '' }) {
  return { embeds: [{ color, title: dTrunc(title, 256), description: description ? dTrunc(description, 4000) : undefined,
    fields: fields.slice(0, 25).map(f => ({ name: dTrunc(f.name, 256), value: dTrunc(String(f.value || '—'), 1024), inline: f.inline !== false })),
    footer: { text: footer || `AirNubeiro ${NBV.APP || 'ACARS'} v${NBV.VERSION} • ${new Date().toISOString().slice(11, 19)}Z` },
    timestamp: new Date().toISOString() }] };
}
function discordEnqueue(payload) { if (!discordEnabled()) return; discordQueue.push(payload); discordFlush(); }
async function discordFlush() {
  if (discordSending || !discordQueue.length) return;
  discordSending = true;
  try {
    while (discordQueue.length) {
      const payload = discordQueue.shift();
      const gap = Date.now() - discordLastSent;
      if (gap < DC_MIN_GAP) await sleep(DC_MIN_GAP - gap);
      const url = dcUrl(); if (!url) break;
      try {
        const r = await NBV.net.req(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), timeout: 8000 });
        discordLastSent = Date.now();
        if (r.status === 429) {
          const ra = (parseFloat(r.headers.get('Retry-After') || '2') || 2) * 1000;
          discordQueue.unshift(payload); await sleep(ra + 200);
        } else if (!r.ok) discordSetStatus(`⚠ HTTP ${r.status}${r.status === 404 ? ' — webhook inexistente' : ''}`, false);
        else discordSetStatus(`✓ Último envío: ${new Date().toISOString().slice(11, 19)}Z`, true);
      } catch (e) { discordSetStatus(`✗ ${e.message}`, false); }
    }
  } finally { discordSending = false; }
}
function discordOnToggle() {
  const en = !!$('discordEn')?.checked;
  cfgFieldsToggle('discordCfgFields', en);
  discordSetStatus(en ? 'Webhook activo' : 'Desactivado', en ? true : null);
  if (typeof saveCfg === 'function') saveCfg();
}
const srcLabel = f => f.srcSim ? 'SIM' : f.srcPhpvms ? 'phpVMS' : 'IVAO';
function discordNotifyDetected(flt) {
  if (!discordEvFlight()) return;
  discordEnqueue(discordEmbed({ color: DC_COLORS.DETECTED, title: `✈ Vuelo detectado — ${flt.callsign}`,
    fields: [{ name: 'Callsign', value: flt.callsign }, { name: 'Ruta', value: `${flt.dep}→${flt.arr}` },
      { name: 'Aeronave', value: flt.aircraft || '—' }, { name: 'Fuente', value: srcLabel(flt) }, { name: 'Piloto', value: flt.pilotName || '—' }] }));
}
function discordNotifyPhase(flt, oldPhase, newPhase) {
  if (!discordEvPhase()) return;
  const labels = { PREFLIGHT: '🟡 PREFLIGHT', ENROUTE: '🔵 ENROUTE', DESCENT: '🟣 DESCENT', LANDED: '🟢 LANDED' };
  discordEnqueue(discordEmbed({ color: DC_COLORS[newPhase] || DC_COLORS.DETECTED, title: `${labels[newPhase] || newPhase} — ${flt.callsign}`,
    fields: [{ name: 'Callsign', value: flt.callsign }, { name: 'Ruta', value: `${flt.dep}→${flt.arr}` },
      { name: 'Transición', value: `${oldPhase} → **${newPhase}**` },
      { name: 'FL', value: `FL${Math.round((flt.alt || 0) / 100)}` }, { name: 'GS', value: `${flt.gs || 0}kt` }] }));
}
function discordNotifyTelex(to, body, auto = false, ok = true) {
  if (!discordEvTelex()) return;
  const from = ($('cS')?.value || 'OPS').toUpperCase();
  discordEnqueue(discordEmbed({ color: ok ? DC_MSG_COLORS.out : DC_MSG_COLORS.erm, title: `📤 TELEX ${auto ? '[AUTO]' : '[MANUAL]'} → ${to}`,
    fields: [{ name: 'De', value: from }, { name: 'Para', value: to }, { name: 'Tipo', value: auto ? 'Auto-OPS' : 'Manual' },
      { name: 'Mensaje', value: dTrunc(body, 512), inline: false }] }));
}
function discordNotifyAlert(callsign, alertType, detail) {
  if (!discordEvAlert()) return;
  discordEnqueue(discordEmbed({ color: DC_COLORS.ALERT, title: `🚨 Alerta OPS — ${alertType}`,
    fields: [{ name: 'Vuelo', value: callsign || '—' }, { name: 'Tipo', value: alertType }, { name: 'Detalle', value: dTrunc(detail, 512), inline: false }] }));
}
async function discordTest() {
  if (!dcUrl()) { discordSetStatus('✗ Pega la URL del webhook y pulsa fuera del campo para guardarla', false); return; }
  if (!$('discordEn')?.checked) { discordSetStatus('✗ Activa el webhook primero', false); return; }
  discordEnqueue(discordEmbed({ color: DC_COLORS.TEST, title: `✅ AirNubeiro ${NBV.APP || 'ACARS'} — Test de conexión`,
    description: 'Webhook correctamente configurado.',
    fields: [{ name: 'App', value: `${NBV.APP || 'ACARS'} v${NBV.VERSION}` }, { name: 'Estación', value: $('cS')?.value || '—' },
      { name: 'Hora', value: `${new Date().toISOString().slice(11, 19)}Z` }] }));
}

// ══════════════════════════════════════════════════════════════════
//  FASE DE VUELO — phpVMS > estado IVAO > distancia > heurística
// ══════════════════════════════════════════════════════════════════
function detectPhase(pilot, prev) {
  const lt = pilot.lastTrack || {};
  const onGround = lt.onGround === true || lt.onGround === 1;
  const gs = safeNum(lt.groundSpeed), alt = safeNum(lt.altitude), altDiff = safeNum(lt.altitudeDifference);
  const arrDist = typeof lt.arrivalDistance === 'number' ? lt.arrivalDistance : null;
  const st = typeof lt.state === 'string' ? lt.state.toLowerCase() : '';
  const prevPhase = prev?.phase || null;
  // En tierra junto al destino y lejos del origen = ya ha volado (útil al detectarlo por primera vez)
  const atDest = onGround && arrDist !== null && arrDist < 5 && safeNum(lt.departureDistance) > 20;
  const flown = prevPhase === 'ENROUTE' || prevPhase === 'DESCENT' || prevPhase === 'LANDED' || atDest;

  if (pilot._phpvmsPhase) {
    const pm = { DEP: 'PREFLIGHT', BST: 'PREFLIGHT', TXI: 'PREFLIGHT', TOF: 'ENROUTE', ICL: 'ENROUTE', ENR: 'ENROUTE', INP: 'ENROUTE',
      APR: 'DESCENT', FIN: 'DESCENT', LDG: 'LANDED', ARR: 'LANDED', ONB: 'LANDED', CMP: 'LANDED' };
    const p = pm[String(pilot._phpvmsPhase).toUpperCase()];
    if (p) return p;
  }
  if (st) {
    // On Blocks / Landed tras haber volado = LANDED (antes volvía a PREFLIGHT)
    if (st.includes('landed') || st.includes('on block') || st.includes('arrived')) return flown || st.includes('landed') ? 'LANDED' : 'PREFLIGHT';
    if (st.includes('boarding') || st.includes('departing') || st.includes('taxi')) {
      if (prevPhase === 'ENROUTE' || prevPhase === 'DESCENT') return 'LANDED'; // aterrizó entre scans
      if (prevPhase === 'LANDED') {
        // Nueva pierna con el mismo callsign: plan de vuelo distinto → PREFLIGHT
        const nd = safeStr(pilot.flightPlan?.departureId).toUpperCase(), na = safeStr(pilot.flightPlan?.arrivalId).toUpperCase();
        return (nd && na && (nd !== prev.dep || na !== prev.arr)) ? 'PREFLIGHT' : 'LANDED';
      }
      return 'PREFLIGHT';
    }
    if (st.includes('approach') || st.includes('landing') || st.includes('descen')) return 'DESCENT';
    if (st.includes('climb') || st.includes('en route')) {
      if (prevPhase === 'DESCENT' && altDiff <= 100) return 'DESCENT';
      if (arrDist !== null && arrDist < 150 && altDiff < -100 && (prevPhase === 'ENROUTE' || prevPhase === 'DESCENT')) return 'DESCENT';
      return 'ENROUTE';
    }
  }
  if (onGround) return flown ? 'LANDED' : 'PREFLIGHT';
  if (prevPhase === 'LANDED') return 'LANDED';
  const prevAlt = prev?.alt || alt;
  if (prevPhase === 'ENROUTE' || prevPhase === 'DESCENT') {
    if (prevAlt - alt > 300 || altDiff < -300) return 'DESCENT';
    if (prevPhase === 'DESCENT' && prevAlt - alt >= -200) return 'DESCENT';
  }
  if (gs > 40 || alt > 1000) return 'ENROUTE';
  return prevPhase || 'PREFLIGHT';
}



// ══════════════════════════════════════════════════════════════════
//  GENERADORES OPS — aerolíneas, conexiones, tripulación, stands
// ══════════════════════════════════════════════════════════════════

const AIRLINES_BY_PREFIX = {
  'LE':['NBV','IBE','VLG','AEA','RYR','ANE','ELY'],         // Spain
  'LP':['NBV','TAP','NTP','RYR'],                             // Portugal
  'LF':['NBV','AFR','EZY','TVF','BEE','HOP'],                // France
  'EG':['NBV','BAW','EZY','RYR','TOM','LOG','VIR'],          // UK
  'ED':['NBV','DLH','EWG','CFG','RYR','SXS'],                // Germany
  'LI':['NBV','AZA','RYR','EZY','NOS','VOE'],                // Italy
  'EH':['NBV','KLM','TRA','EZY','RYR'],                      // Netherlands
  'EB':['NBV','BEL','TUI','RYR'],                             // Belgium
  'EI':['NBV','EIN','RYR','ASL'],                             // Ireland
  'ES':['NBV','SAS','NAX','RYR'],                             // Sweden
  'EN':['NBV','SAS','NAX','WIF'],                             // Norway
  'EK':['NBV','SAS','NAX','RYR'],                             // Denmark
  'LO':['NBV','AUA','RYR','EZY','LWG'],                      // Austria
  'LS':['NBV','SWR','EZY','EZS'],                             // Switzerland
  'LK':['NBV','CSA','TVS','RYR'],                             // Czech Republic
  'EP':['NBV','LOT','RYR','WZZ'],                             // Poland
  'LG':['NBV','AEE','RYR','OAL'],                             // Greece
  'LT':['NBV','THY','PGT','SXS','AJA'],                      // Turkey
  'LC':['NBV','CYP','RYR'],                                    // Cyprus
  'LH':['NBV','HVA','WZZ'],                                    // Hungary
  'LR':['NBV','ROT','WZZ'],                                    // Romania
  'LZ':['NBV','BUC','WZZ'],                                    // Slovakia/Bulgaria
};

const DESTINATIONS_BY_PREFIX = {
  'LE':['LEMD','LEBL','LEPA','LEAL','LEMG','LEZL','LEBB','LEST','LEVC','LEXJ','GCXO','GCLP','GCFV','GCTS'],
  'LP':['LPPT','LPPR','LPFR','LPMA'],
  'LF':['LFPG','LFPO','LFBO','LFML','LFMN','LFLL','LFSB'],
  'EG':['EGLL','EGKK','EGSS','EGGW','EGCC','EGGP','EGPH','EGBB'],
  'ED':['EDDF','EDDM','EDDB','EDDL','EDDK','EDDS','EDDH'],
  'LI':['LIRF','LIMC','LIPZ','LIPE','LIMF','LIRN','LICC','LICJ'],
  'EH':['EHAM'],
  'EB':['EBBR','EBCI'],
  'EI':['EIDW','EICK'],
  'ES':['ESSA','ESGG','ESMS'],
  'EN':['ENGM','ENBR','ENZV'],
  'EK':['EKCH','EKBI'],
  'LO':['LOWW','LOWS','LOWG'],
  'LS':['LSZH','LSGG','LSZA'],
  'LK':['LKPR','LKTB'],
  'EP':['EPWA','EPKK','EPGD'],
  'LG':['LGAV','LGTS','LGIR','LGKR','LGSA'],
  'LT':['LTFM','LTAI','LTBS','LTFE'],
};

const GALICIAN_BASES = ['LEST','LECO','LEVX'];

const SPAIN_DOMESTIC = ['LEMD','LEBL','LEPA','LEAL','LEMG','LEZL','LEBB','LEVC','LEXJ','LEZG','GCXO','GCLP','GCFV','GCTS'];

const EUROPE_DEST = ['LFPG','EGLL','EDDF','LIRF','EHAM','EBBR','LPPT','LFBO','EDDM','LSZH','LOWW','LKPR','EPWA','EKCH','ENGM','LGAV','EIDW','ESSA'];

function genPaxConnections(arrIcao, arrivalTimeEstimate) {
  if (!arrIcao || arrIcao === '????') return '';

  // 40% probability: no connecting passengers
  if (Math.random() < 0.40) {
    return `=== CONEXIONES PAX ${arrIcao} ===\n0 PAX EN CONEXION\nNo hay pasajeros con enlaces en este vuelo.`;
  }

  const prefix = arrIcao.substring(0, 2);

  // Airlines operating at destination: own airline + country-based + some international
  const localAirlines = AIRLINES_BY_PREFIX[prefix] || ['NBV','RYR','EZY'];
  const intlAirlines = ['NBV','IBE','AFR','BAW','DLH','KLM']; // always possible
  const pool = [...new Set([...localAirlines, ...intlAirlines])];

  // Possible destinations from this airport
  const localDests = DESTINATIONS_BY_PREFIX[prefix] || [];
  const allDests = [...new Set([...localDests, ...EUROPE_DEST])].filter(d => d !== arrIcao);

  // Generate 2-4 connections
  const numConn = 2 + Math.floor(Math.random() * 3); // 2-4
  const connections = [];
  const usedDests = new Set();

  // Base departure time: ~45-120 min after estimated arrival
  const now = new Date();
  const baseMin = 45 + Math.floor(Math.random() * 75);

  for (let i = 0; i < numConn && allDests.length > 0; i++) {
    // Pick destination (no repeats)
    let dest;
    let attempts = 0;
    do {
      dest = allDests[Math.floor(Math.random() * allDests.length)];
      attempts++;
    } while (usedDests.has(dest) && attempts < 20);
    if (usedDests.has(dest)) continue;
    usedDests.add(dest);

    // Pick airline — 40% chance same airline (NBV), 60% local/intl
    const airline = Math.random() < 0.4 ? 'NBV' : pool[Math.floor(Math.random() * pool.length)];

    // Flight number
    const fltNum = `${airline}${String(Math.floor(Math.random() * 9000) + 1000)}`;

    // Gate — use real gate database
    const gate = genParking(arrIcao) || `GATE ${Math.floor(Math.random()*40)+1}`;

    // Departure time
    const depOffset = baseMin + i * (15 + Math.floor(Math.random() * 30)); // staggered
    const depTime = new Date(now.getTime() + depOffset * 60000);
    const depStr = `${String(depTime.getUTCHours()).padStart(2,'0')}:${String(depTime.getUTCMinutes()).padStart(2,'0')}z`;

    // Pax count
    const pax = Math.floor(Math.random() * 12) + 1;

    connections.push({ airline, fltNum, dest, gate, depStr, pax });
  }

  if (!connections.length) return '';

  let msg = `=== CONEXIONES PAX ${arrIcao} ===\n`;
  const totalPax = connections.reduce((s, c) => s + c.pax, 0);
  msg += `${totalPax} PAX EN CONEXION:\n`;
  for (const c of connections) {
    msg += `${c.fltNum} → ${c.dest} GATE ${c.gate} ETD ${c.depStr} (${c.pax}pax)\n`;
  }

  return msg;
}

function genCrewInfo(flt) {
  const arr = flt.arr || '????';
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();

  // Estimate local hour (rough offset from ICAO prefix)
  const localOffset = getLocalOffset(arr);
  const localHour = (utcHour + localOffset + 24) % 24;
  const localMin = utcMin;

  const isBase = GALICIAN_BASES.includes(arr);
  let crewChange;
  let reason;
  let isLastFlightGoodnight = false;

  // Late night: local time >= 00:30 → last flight, buenas noches
  if (localHour >= 0 && localHour < 5 && (localHour > 0 || localMin >= 30)) {
    crewChange = true;
    isLastFlightGoodnight = true;
    reason = 'ULTIMO VUELO DEL DIA';
  } else if (utcHour >= 21 || localHour >= 23) {
    crewChange = true;
    reason = 'ULTIMO VUELO DEL DIA';
  } else if (utcHour >= 19 || localHour >= 21) {
    crewChange = Math.random() < (isBase ? 0.5 : 0.7);
    reason = crewChange ? 'VUELO NOCTURNO - RELEVO PROGRAMADO' : null;
  } else {
    crewChange = Math.random() < (isBase ? 0.1 : 0.2);
    reason = crewChange ? 'RELEVO DE TRIPULACION PROGRAMADO' : null;
  }

  let msg = '';

  if (crewChange) {
    if (isLastFlightGoodnight) {
      msg += `--- TRIPULACION ---\n`;
      msg += `NO HAY MAS VUELOS PROGRAMADOS HOY\n`;
      msg += `Tripulacion libre de servicio.\n`;
      msg += `Buenas noches y buen descanso.\n`;
    } else {
      msg += `--- TRIPULACION ---\nCAMBIO DE TRIPULACION: ${reason}\n`;
      msg += `Tripulacion entrante reportar a briefing.\n`;
    }
  } else {
    msg += `--- TRIPULACION ---\nSIN CAMBIO - MISMA TRIPULACION CONTINUA\n`;

    // Generate next flight for this crew
    const nextFlt = genNextFlight(flt, arr);
    if (nextFlt) {
      msg += `PROXIMO VUELO: ${nextFlt.fltNum}\n`;
      msg += `${nextFlt.dep}→${nextFlt.dest} ETD ${nextFlt.etd}\n`;
      msg += `ACFT: ${flt.aircraft || '???'} GATE: ${nextFlt.gate}\n`;
      if (nextFlt.isReturn) msg += `(RETORNO A BASE)\n`;
      msg += `TURNAROUND: ${nextFlt.turnaround}min\n`;
    }
  }

  return msg;
}

function getLocalOffset(icao) {
  if (!icao || icao.length < 2) return 1;
  const pfx = icao.substring(0, 2);
  const offsets = {
    'LE':1,'LP':0,'LF':1,'EG':0,'ED':1,'LI':1,'EH':1,'EB':1,
    'EI':0,'ES':1,'EN':1,'EK':1,'LO':1,'LS':1,'LK':1,'EP':1,
    'LG':2,'LT':3,'LC':2,'LH':1,'LR':2,'LZ':2,
    'GC':0, // Canarias
  };
  // Canarias special case
  if (icao.startsWith('GC')) return 0;
  return offsets[pfx] ?? 1;
}

function genNextFlight(flt, currentAirport) {
  const now = new Date();
  const prefix = currentAirport.substring(0, 2);

  // Decision: return to base or continue to another destination?
  // 50% return to Galician base, 30% domestic Spain, 20% European
  const roll = Math.random();
  let dest, isReturn = false;

  if (roll < 0.50) {
    // Return to base — pick a Galician airport (not the current one)
    const bases = GALICIAN_BASES.filter(b => b !== currentAirport);
    dest = bases.length ? bases[Math.floor(Math.random() * bases.length)] : GALICIAN_BASES[0];
    isReturn = true;
  } else if (roll < 0.80) {
    // Domestic Spanish flight
    const domestic = SPAIN_DOMESTIC.filter(d => d !== currentAirport);
    dest = domestic[Math.floor(Math.random() * domestic.length)] || 'LEMD';
  } else {
    // European continental
    const euro = EUROPE_DEST.filter(d => d !== currentAirport);
    dest = euro[Math.floor(Math.random() * euro.length)] || 'LFPG';
  }

  // Turnaround time: 35-75 min
  const turnaround = 35 + Math.floor(Math.random() * 40);
  const etdDate = new Date(now.getTime() + turnaround * 60000);
  const etd = `${String(etdDate.getUTCHours()).padStart(2,'0')}:${String(etdDate.getUTCMinutes()).padStart(2,'0')}z`;

  // Flight number
  const fltNum = `NBV${String(Math.floor(Math.random() * 9000) + 1000)}`;

  // Gate
  const gate = genParking(currentAirport) || `STAND ${Math.floor(Math.random()*30)+1}`;

  return { fltNum, dep: currentAirport, dest, etd, gate, turnaround, isReturn };
}

const GALICIAN_AIRPORTS = {
  'LEVX': {
    messages: [
      cs => `=== BENVIDO A VIGO ===\n${cs} / A CIDADE OLIVEIRA\n\nAterrado en Vigo-Peinador, porta de entrada as Rias Baixas.\nA ria de Vigo agarda con posta de sol entre as illas Ces.\n\nRecomendacion AirNubeiro:\n- Marisco nas Ruas do Berbes\n- Ruta pola Ponte de Rande\n- Visita as Illas Ces (Parque Nacional)\n\nBo descanso. Graza por volar con AirNubeiro. OPS NBV.`,
      cs => `=== VIGO CHEGADA ===\n${cs} / AEROPORTO VIGO-PEINADOR\n\nBenvido a capital da provincia de Pontevedra.\nEspecialidade local: zamburinas e mexillons da ria.\n\nCieus atlanticos, Cies no horizonte.\nVOO COMPLETADO. OPS NBV.`,
    ]
  },
  'LECO': {
    messages: [
      cs => `=== BENVIDO A CORUNA ===\n${cs} / AEROPORTO ALVEDRO\n\nAterrado na Cidade de Cristal.\nA Torre de Hercules — faro romano, Patrimonio UNESCO —\nvixa estas chegadas dende hai 2.000 anos.\n\nRecomendacion AirNubeiro:\n- Paseo maritimo dende Riazor ata o Parrote\n- Pulpo a feira no Mercado de Abastos\n\nVento atlantico garantido. Paraguas recomendado.\nOPS NBV.`,
      cs => `=== A CORUNA CHEGADA ===\n${cs}\n\nBenvido ao extremo noroeste de Europa.\nFinisterre espera ao suroeste.\n\nTripulacion: excelente voo. Descansen.\nAirNubeiro OPS.`,
    ]
  },
  'LEST': {
    messages: [
      cs => `=== BENVIDO A SANTIAGO ===\n${cs} / AEROPORTO ROSALIA DE CASTRO\n\nAterrado na capital de Galicia.\nA Catedral do Apostolo aguarda no centro historico.\n\nULTREIA ET SUSEIA — Antiguo saludo peregrino\n"Adelante y hacia arriba"\n\n- Praza do Obradoiro — imprescindible\n- Tarta de Santiago de postre\n\nBon Camino. AirNubeiro OPS.`,
      cs => `=== SANTIAGO CHEGADA ===\n${cs}\n\nBenvido ao fin do Camino de Santiago.\nO Casco Vello: Patrimonio da Humanidade UNESCO.\n\n"Aquel que ten saudade, nen come, nen durme, nen ri"\n— Rosalia de Castro\n\nOPS NBV — Benvidos peregrinos do aire.`,
    ]
  },
};

async function genLanded(flt) {
  const dep = flt.dep || '????';
  const arr = flt.arr || '????';
  const flightMin = flt.enrouteStart ? Math.round((Date.now() - flt.enrouteStart) / 60000) : 0;
  const monitorMin = flt.firstSeen ? Math.round((Date.now() - flt.firstSeen) / 60000) : 0;
  const stand = flt.assignedParking || genParking(arr);
  const msgs = [];

  // Mensaje gallego personalizado (si aplica) — va primero
  const galMsg = genGalicianWelcome(flt);
  if (galMsg) msgs.push({ id: 'galician_welcome', label: 'GAL WELCOME', body: galMsg });

  // Welcome message with flight time
  const welcome = [
    `=== BIENVENIDO ${arr} ===`,
    `${flt.callsign} — ${dep}/${arr} (${flt.aircraft})`,
    flightMin > 0 ? `TIEMPO DE VUELO: ${Math.floor(flightMin/60)}h${String(flightMin%60).padStart(2,'0')}m` : '',
    monitorMin > flightMin + 5 ? `TIEMPO TOTAL: ${Math.floor(monitorMin/60)}h${String(monitorMin%60).padStart(2,'0')}m` : '',
    stand ? `PARKING: ${stand}` : '',
    `Gracias por volar con AirNubeiro.`,
    `Buen servicio, cielos limpios.`,
  ].filter(Boolean).join('\n');
  msgs.push({ id: 'welcome', label: 'WELCOME', body: welcome });

  // Delay report — check if departure was late vs planned
  const delayMsg = genDelayReport(flt);
  if (delayMsg) {
    msgs.push({ id: 'delay', label: 'DELAY RPT', body: delayMsg });
  }

  // Crew rotation + next flight
  const crewMsg = genCrewInfo(flt);
  if (crewMsg) {
    msgs.push({ id: 'crew', label: 'CREW INFO', body: `=== CREW ${flt.callsign} ===\n${arr}\n${crewMsg}` });
  }

  return msgs;
}

function genParking(icao) {
  if (!icao || icao === '????') return '';
  // AirNubeiro official stands from Manual de Procedimientos Operacionales
  const NBV_STANDS = {
    'LEST':['2','3','4','5','6','7','21','22'],'LEVX':['4','5','7'],'LEAS':['2','3'],
    'LECO':['1','3','12'],'LEXJ':['2','6'],'LEBB':['4','6','16'],
    'LEBL':['236','238','240','242','248'],'LEVC':['4','6','42'],
    'LEAL':['29','31'],'LEPA':['84','86','88','48','66'],'LEMG':['24','26','28'],
    'LEMD':['T27','T28','T29','T32','T18'],'LEIB':['18','25','27','28'],
    'LEZL':['6','7'],'GCFV':['21','22','23'],'GCLA':['7','9'],
    'GCXO':['T1','T4'],'GCRR':['T1','T3'],'GCLP':['T05','T06'],'GCTS':['14','16'],
  };
  // Real gates for major European airports (A320-A350 size)
  const REAL_GATES = {
    'EGLL':['A5','A7','A10','A14','A18','A22','B32','B34','B36','B38','B42','B44','B46','C54','C56','C60','C62','301','305','307','340','501','503','505','510','520','525','544','546','555','562'],
    'LFPG':['E40','E42','E44','E46','E48','E50','K21','K24','K30','K36','L40','L42','L44','M30','M32','M34','M36','A22','A24','A26','A30','D51','D53','D55','F32','F34','F36','F38'],
    'EDDF':['A15','A17','A21','A24','A26','A50','A52','A60','A62','B20','B22','B24','B28','B30','B40','B42','B44','C14','C15','D2','D4','D6','D8','E4','E6','E8','E12','E15','E21'],
    'EHAM':['B18','B20','B22','B24','B28','C8','C10','C12','D18','D20','D22','D51','D53','D57','D59','E18','E20','E22','E24','F3','F5','F7','F9','G3','G5','G9','H1','H3','H5','H7'],
    'LIRF':['B1','B3','B5','B7','B11','B13','B15','B17','B19','B21','D1','D3','D5','D7','E1','E3','E5','E7','E11','E13','E15','E17','E19','E21','E23','E25','G1','G3','G5','G7','G9'],
    'EBBR':['A26','A28','A30','A32','A34','A40','A42','A44','A46','B50','B52','B54','B56','B58','B60','B62','B64'],
    'EIDW':['101','102','103','104','105','201','202','203','204','301','302','303','304','305','306','307','308','310','311','312','314','315'],
    'LPPT':['14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50','52','54','56','58'],
    'LPPR':['3','5','7','9','11','13','15','17','19','21','23','25'],
    'LOWW':['B14','B16','B18','B20','B22','B24','C28','C30','C32','C34','D42','D44','D46','D48','D50','D52','F68','F70','F72','F74','F76','G81','G83','G85'],
    'LSZH':['A10','A12','A14','A16','A20','A22','A24','A26','A28','A30','A32','A34','B51','B53','B55','B57','B59','B61','B63','B65','D31','D33','D35','D37','D39','D41','E54','E56','E58','E60','E62','E64'],
    'EKCH':['A1','A2','A3','A4','A5','A7','B5','B6','B7','B8','B9','B10','C22','C24','C26','C28','C30','C32','C34','D4','D6','D8','D10','E52','E54','E56','E58','E60','E62','E64','E66'],
    'ESSA':['1','2','3','4','5','6','7','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44'],
    'ENGM':['A11','A12','A13','A14','A15','A16','A17','A18','A19','B22','B24','B26','B28','B30','B32','B34','C36','C38','C40','C42','C44','C46','C48','D50','D52','D54','D56','D58','D60','D62'],
    'LKPR':['A2','A4','A6','A8','A10','B15','B17','B19','B21','B23','B25','C30','C32','C34','C36','C38','C40','D42','D44','D46','D48'],
    'EPWA':['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29'],
    'LGAV':['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','B15','B16','B17','B18','B19','B20','B21','B22','B23','B24','B25','B26'],
    'LTFM':['D201','D203','D205','D207','D209','D211','D213','D215','F101','F103','F105','F107','F109','F111','F113','F115','G301','G303','G305','G307','G309','G311'],
    'LIMC':['A1','A3','A5','A7','A9','A11','B15','B17','B19','B21','B23','B25','B27','C1','C3','C5','C7','C9'],
    'LFBO':['A1','A3','A5','A7','A9','A11','B1','B3','B5','B7','B9','B11','B13','C1','C3','C5','D1','D3','D5','D7'],
    'LFML':['A2','A4','A6','A8','A10','A12','A14','B1','B3','B5','B7','B9','B11','B13'],
    'LFMN':['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12','T2-1','T2-3','T2-5','T2-7'],
    'EGKK':['1','2','3','4','5','6','10','11','12','13','14','15','21','22','23','24','25','26','31','32','33','34','35','36','40','41','42','43','44','45','46','47','48','51','52','53','54','55','56','101','102','103'],
  };
  // Check NBV official first, then real gates, then generate plausible
  if (NBV_STANDS[icao]) {
    const sl = NBV_STANDS[icao];
    return `STAND ${sl[Math.floor(Math.random() * sl.length)]}`;
  }
  if (REAL_GATES[icao]) {
    const gl = REAL_GATES[icao];
    return `GATE ${gl[Math.floor(Math.random() * gl.length)]}`;
  }
  // Fallback: generate plausible stand based on ICAO prefix
  const prefix = icao.substring(0, 2);
  const ranges = {
    'LE':[1,50],'LP':[1,40],'LF':[1,60],'EG':[1,60],'ED':[1,50],'LI':[1,40],
    'EH':[1,70],'EB':[1,60],'EI':[1,40],'ES':[1,50],'EN':[1,60],'EK':[1,40],
    'LO':[1,50],'LS':[1,50],'LK':[1,40],'EP':[1,30],'LG':[1,30],'LT':[1,50],
  };
  const r = ranges[prefix] || [1,30];
  return `STAND ${Math.floor(Math.random()*(r[1]-r[0]+1))+r[0]}`;
}

function genParkingStand(icao) { return genParking(icao); }


// ══════════════════════════════════════════════════════════════════
//  FSUIPC WEBSOCKET — Paul Henty WebSocket Server (FSUIPC4/5/7)
// ══════════════════════════════════════════════════════════════════

let fsuipcWs         = null;

let fsuipcConnected  = false;

let fsuipcReady      = false;

let fsuipcData       = null;

let fsuipcRetryTimer = null;

let fsuipcRetryCount = 0;

const FSUIPC_MAX_RETRY   = 8;

const FSUIPC_RETRY_DELAY = 15000;

const FSUIPC_GROUP_NAME  = 'AN_FLIGHT_DATA';

const FSUIPC_OFFSETS = [
  { name: 'lat',      address: '0x0560', type: 'lat',   size: 8 }, // Latitud  — decimal ° (auto)
  { name: 'lon',      address: '0x0568', type: 'lon',   size: 8 }, // Longitud — decimal ° (auto)
  { name: 'altM',     address: '0x6020', type: 'float', size: 8 }, // Altitud MSL en metros
  { name: 'gs',       address: '0x02B4', type: 'uint',  size: 4 }, // Ground speed (m/s × 65536)
  { name: 'hdg',      address: '0x0580', type: 'uint',  size: 4 }, // True heading (deg × 65536)
  { name: 'vs',       address: '0x02C8', type: 'int',   size: 4 }, // VS (m/s × 256)
  { name: 'onGround', address: '0x0366', type: 'uint',  size: 2 }, // 1=suelo, 0=vuelo
  { name: 'squawk',   address: '0x0354', type: 'uint',  size: 2 }, // Transponder BCD
  { name: 'flaps',    address: '0x0BDC', type: 'uint',  size: 4 }, // Flaps handle position
  { name: 'fuel',     address: '0x0AF8', type: 'uint',  size: 4 }, // Combustible total (gal × 128)
];

function fsuipcNormalize(raw) {
  // Ground speed: uint32, m/s × 65536 → knots
  const gsKts = Math.round((raw.gs || 0) / 65536 * 1.943844);

  // Heading: uint32, deg × 65536 → grados
  const hdgDeg = Math.round((raw.hdg || 0) / 65536) % 360;

  // Altitud: float metros → feet
  const altFt = Math.round((raw.altM || 0) * 3.28084);

  // VS: int32, m/s × 256 → ft/min
  const vsFpm = Math.round((raw.vs || 0) * 60 * 3.28084 / 256);

  // onGround: uint16, 1 = suelo
  const onGround = (raw.onGround === 1 || raw.onGround === true);

  // Squawk BCD → string 4 dígitos
  let squawk = '2000';
  if (raw.squawk) {
    const v = parseInt(raw.squawk);
    const d1 = (v >> 12) & 0xF;
    const d2 = (v >> 8)  & 0xF;
    const d3 = (v >> 4)  & 0xF;
    const d4 =  v        & 0xF;
    squawk = `${d1}${d2}${d3}${d4}`;
  }

  // Combustible: uint32, gal × 128 → litros (1 gal = 3.785 l)
  const fuelL = Math.round((raw.fuel || 0) / 128 * 3.785);

  return {
    lat:           raw.lat       || 0,
    lon:           raw.lon       || 0,
    altitude:      altFt,
    groundSpeed:   gsKts,
    heading:       hdgDeg,
    verticalSpeed: vsFpm,
    onGround:      onGround,
    squawk:        squawk,
    flaps:         raw.flaps || 0,
    fuelL:         fuelL,
    ts:            Date.now(),
  };
}

function fsuipcUpdateBadge(state) {
  const b = $('fsuipcBadge');
  if (!b) return;
  b.className = `fsuipc-badge src-${state}`;
  const labels = { ivao: 'IVAO', fsuipc: 'SIM', connecting: 'SIM…' };
  const titles = {
    ivao:       'Fuente: IVAO Whazzup (red)',
    fsuipc:     'Fuente: FSUIPC WebSocket (simulador local)',
    connecting: 'FSUIPC: conectando…',
  };
  b.innerHTML = `<span class="fsuipc-dot"></span>${labels[state] || 'IVAO'}`;
  b.title = titles[state] || '';
}

function fsuipcSetStatus(msg, ok) {
  const el = $('fsuipcStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok === true ? '#34d399' : ok === false ? 'var(--wrn)' : 'var(--tx3)';
}

function fsuipcRegisterOffsets() {
  if (!fsuipcWs || fsuipcWs.readyState !== WebSocket.OPEN) return;
  const pollMs = Math.max(200, parseInt($('fsuipcPoll')?.value) || 500);

  // 1. Declarar el grupo de offsets
  fsuipcWs.send(JSON.stringify({
    command: 'offsets.declare',
    name:    FSUIPC_GROUP_NAME,
    offsets: FSUIPC_OFFSETS,
  }));

  // 2. Iniciar lectura continua con push automático del servidor
  fsuipcWs.send(JSON.stringify({
    command:  'offsets.read',
    name:     FSUIPC_GROUP_NAME,
    interval: pollMs,   // ms — el servidor hace push a este ritmo
  }));

  fsuipcSetStatus(`✓ Offsets registrados — intervalo ${pollMs}ms`, true);
}

function fsuipcHandleMessage(evt) {
  if (evt.target && evt.target !== fsuipcWs) return;
  let msg;
  try { msg = JSON.parse(evt.data); } catch { return; }

  // Datos de vuelo: success + name del grupo + data object
  if (msg.success && msg.name === FSUIPC_GROUP_NAME && msg.data) {
    // data puede ser objeto {key:val} o array [{name,value}]
    let raw = msg.data;
    if (Array.isArray(raw)) {
      raw = {};
      for (const item of msg.data) { if (item.name) raw[item.name] = item.value; }
    }
    fsuipcReady = true;
    fsuipcData  = fsuipcNormalize(raw);
    fsuipcUpdateBadge('fsuipc');
    fsuipcSetStatus(
      `✓ Sim: Alt ${fsuipcData.altitude}ft  GS ${fsuipcData.groundSpeed}kt  ${fsuipcData.onGround ? 'TIERRA' : 'VUELO'}`,
      true
    );
    return;
  }

  // Confirmación de declare/read (sin datos)
  if (msg.success && msg.name === FSUIPC_GROUP_NAME) {
    fsuipcSetStatus('✓ Offsets aceptados — recibiendo datos…', true);
    return;
  }

  // Error del servidor
  if (msg.success === false) {
    const err = msg.errorMessage || msg.error || msg.errorCode || 'desconocido';
    console.warn('[FSUIPC] Error servidor:', err, msg);
    fsuipcSetStatus(`⚠ Error servidor: ${err}`, false);
  }
}

function fsuipcConnect(force = false) {
  if (!force && fsuipcWs && (fsuipcWs.readyState === WebSocket.OPEN || fsuipcWs.readyState === WebSocket.CONNECTING)) return;
  fsuipcDisconnect(false);

  const url = fsuipcWsUrl($('fsuipcUrl')?.value);
  const blocked = fsuipcBlockedReason(url);
  if (blocked) { fsuipcSetStatus('✗ ' + blocked, false); fsuipcUpdateBadge('ivao'); return; }
  fsuipcUpdateBadge('connecting');
  fsuipcSetStatus(`Conectando a ${url}…`, null);
  console.log('[FSUIPC] Conectando a', url);

  try {
    // Subprotocolo 'fsuipc' requerido por Paul Henty WS Server
    fsuipcWs = new WebSocket(url, 'fsuipc');
  } catch(e) {
    fsuipcSetStatus(`✗ URL inválida: ${e.message}`, false);
    fsuipcUpdateBadge('ivao');
    return;
  }

  // Timeout de conexión: 8 segundos
  const connTimeout = setTimeout(() => {
    if (fsuipcWs && fsuipcWs.readyState !== WebSocket.OPEN) {
      fsuipcWs.close();
      fsuipcSetStatus('✗ Sin respuesta en ' + url + ' — ¿FSUIPC WebSocket Server abierto en este PC y con el simulador cargado?', false);
      fsuipcUpdateBadge('ivao');
      fsuipcScheduleRetry();
    }
  }, 8000);

  fsuipcWs.addEventListener('open', (evt) => {
    if (evt.target !== fsuipcWs) return; // socket antiguo
    clearTimeout(connTimeout);
    fsuipcConnected  = true;
    fsuipcRetryCount = 0;
    console.log('[FSUIPC] Conexión WS establecida — registrando offsets');
    fsuipcSetStatus('✓ WS conectado — declarando offsets…', true);
    fsuipcRegisterOffsets();
  });

  fsuipcWs.addEventListener('message', fsuipcHandleMessage);

  fsuipcWs.addEventListener('close', (evt) => {
    if (evt.target !== fsuipcWs) return; // socket antiguo tras reconexión
    clearTimeout(connTimeout);
    fsuipcConnected = false;
    fsuipcReady     = false;
    const reason = evt.wasClean ? 'cierre limpio' : `código ${evt.code}`;
    console.log(`[FSUIPC] Desconectado (${reason})`);
    if ($('fsuipcEn')?.checked) {
      fsuipcUpdateBadge('connecting');
      fsuipcSetStatus(`Desconectado (${reason}) — reintentando…`, null);
      fsuipcScheduleRetry();
    } else {
      fsuipcUpdateBadge('ivao');
      fsuipcData = null;
      fsuipcSetStatus('Desactivado', null);
    }
  });

  fsuipcWs.addEventListener('error', (e) => {
    clearTimeout(connTimeout);
    console.warn('[FSUIPC] Error WS:', e);
    // 'close' se dispara tras 'error' — el retry lo gestiona el handler close
  });
}

function fsuipcScheduleRetry() {
  if (fsuipcRetryCount >= FSUIPC_MAX_RETRY) {
    fsuipcSetStatus(`✗ Sin conexión tras ${FSUIPC_MAX_RETRY} intentos — desactiva y reactiva`, false);
    fsuipcUpdateBadge('ivao');
    return;
  }
  fsuipcRetryCount++;
  clearTimeout(fsuipcRetryTimer);
  fsuipcSetStatus(`Reintento ${fsuipcRetryCount}/${FSUIPC_MAX_RETRY} en ${FSUIPC_RETRY_DELAY/1000}s…`, null);
  fsuipcRetryTimer = setTimeout(() => {
    if ($('fsuipcEn')?.checked) fsuipcConnect();
  }, FSUIPC_RETRY_DELAY);
}

function fsuipcDisconnect(resetData = true) {
  clearTimeout(fsuipcRetryTimer);
  fsuipcRetryCount = 0;
  if (fsuipcWs) {
    fsuipcWs.onclose = null;
    fsuipcWs.onerror = null;
    if (fsuipcWs.readyState === WebSocket.OPEN || fsuipcWs.readyState === WebSocket.CONNECTING) {
      fsuipcWs.close(1000, 'Usuario desactivó FSUIPC');
    }
    fsuipcWs = null;
  }
  fsuipcConnected = false;
  fsuipcReady     = false;
  if (resetData) fsuipcData = null;
}

function fsuipcGetData(maxAgeMs = 5000) {
  if (!fsuipcConnected || !fsuipcReady || !fsuipcData) return null;
  if (Date.now() - fsuipcData.ts > maxAgeMs) return null;
  return fsuipcData;
}

function fsuipcInjectIntoFlight(flt) {
  const csLocal = $('fsuipcCs')?.value.trim().toUpperCase();
  if (!csLocal) return false;
  if (flt.callsign !== csLocal) return false;
  const sim = fsuipcGetData();
  if (!sim) return false;

  flt.alt       = sim.altitude;
  flt.gs        = sim.groundSpeed;
  flt.heading   = sim.heading;
  flt.lat       = sim.lat;
  flt.lng       = sim.lon;
  flt.onGround  = sim.onGround;
  flt.vs        = sim.verticalSpeed;
  flt.squawk    = sim.squawk;
  flt.srcSim    = true;
  return true;
}

// IVAO v2: flightPlan.departureTime = segundos desde 00:00Z (p.ej. 24600 = 06:50Z)
function genDelayReport(flt) {
  if (flt.plannedDepTime == null || !flt.enrouteStart) return null;
  const pdt = flt.plannedDepTime;
  let plannedMin = null;
  if (typeof pdt === 'number' || /^\d+$/.test(String(pdt))) {
    const n = Number(pdt);
    if (n > 1e9) { const d = new Date(n * 1000); plannedMin = d.getUTCHours() * 60 + d.getUTCMinutes(); }
    else if (n >= 0 && n < 86400) plannedMin = Math.floor(n / 60);
  } else {
    const m = String(pdt).match(/(\d{1,2}):?(\d{2})/);
    if (m) plannedMin = parseInt(m[1]) * 60 + parseInt(m[2]);
  }
  if (plannedMin == null) return null;
  const actual = new Date(flt.enrouteStart);
  const actualMin = actual.getUTCHours() * 60 + actual.getUTCMinutes();
  let delayMin = actualMin - plannedMin;
  if (delayMin < -720) delayMin += 1440;
  if (delayMin > 720) delayMin -= 1440;
  if (delayMin <= 15) return null;
  const hhmm = min => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}${String(min % 60).padStart(2, '0')}z`;
  const plan = hhmm(plannedMin), real = hhmm(actualMin);
  const templates = [
    [`=== DELAY REPORT ${flt.callsign} ===`, `${flt.dep}→${flt.arr}`, `ETD PLANIFICADO: ${plan}`, `SALIDA REAL: ${real}`, `DELAY: +${delayMin} MIN`, `---`,
      `ACCION REQUERIDA:`, `Reportar motivo del retraso a OPS.`, `Codigo delay IATA requerido.`, `Contactar jefe de operaciones antes`, `de iniciar siguiente rotacion.`],
    [`=== DELAY REPORT ${flt.callsign} ===`, `${flt.dep}→${flt.arr}`, `RETRASO DETECTADO: +${delayMin} MIN`, `ETD ${plan} → REAL ${real}`, `---`,
      `DOCUMENTACION PENDIENTE:`, `Completar formulario de incidencia`, `operacional post-vuelo.`, `Incluir codigo IATA y descripcion`, `del motivo del retraso.`,
      `Entregar en briefing room o via email`, `a ops@airnubeiro.va`],
    [`=== DELAY REPORT ${flt.callsign} ===`, `${flt.dep}→${flt.arr} — DELAY +${delayMin}MIN`, `PLAN: ${plan} / REAL: ${real}`, `---`,
      `PAPERWORK REQUERIDO:`, `Se requiere informe de retraso.`, `Rellenar delay report antes de`, `abandonar la aeronave.`, `Motivo + codigo IATA + firma PIC.`, `Copia a dispatch y crew planning.`],
  ];
  return templates[Math.floor(Math.random() * templates.length)].join('\n');
}

// Activación desde checkbox: ahora usa el estilo de cada UI
function fsuipcOnToggle() {
  const enabled = $('fsuipcEn').checked;
  cfgFieldsToggle('fsuipcCfgFields', enabled);
  if (enabled) { fsuipcRetryCount = 0; fsuipcConnect(true); }
  else {
    fsuipcDisconnect(true);
    fsuipcUpdateBadge('ivao');
    fsuipcSetStatus('Desactivado — activa para conectar al simulador local', null);
  }
  if (typeof saveCfg === 'function') saveCfg();
}

// Bienvenida de llegada: plantillas editables (por defecto, los mensajes gallegos de LEVX/LECO/LEST)
function genGalicianWelcome(flt) { return NBV.tpl.welcome(flt.arr, flt.callsign); }

// ROUTE INFO por corredor de ruta (v4.5): ATC, SIGMET y PIREP a lo largo del tramo
// que queda hasta destino, no en un círculo alrededor del avión
async function buildRouteInfo({ callsign, dep, arr, lat, lon, hdg, alt, gs, data, arrLat, arrLon, arrDist }) {
  const CTR_NM = 150, WX_NM = 80;
  const cor = await routeCorridor({ lat, lon, hdg, arr, arrLat, arrLon, arrDist });
  let body = `=== ROUTE INFO ${callsign} ===\n${dep}→${arr} FL${Math.round((alt || 0) / 100)} GS${gs || 0}${hdg ? ' HDG' + Math.round(hdg) : ''}\n`;
  body += `TRAMO RESTANTE ${cor.total}nm${cor.mode === 'rumbo' ? ' (estimado por rumbo)' : ''}\n`;
  const enr = [], dst = [];
  for (const a of NBV.ivao.atcs(data)) {
    const aLat = a.lastTrack?.latitude, aLon = a.lastTrack?.longitude;
    if (!a.callsign || (!aLat && !aLon)) continue;
    const type = NBV.ivao.posOf(a);
    if (type === 'GND' || type === 'DEL') continue;
    const cs = a.callsign.toUpperCase(), freq = fmtFreq(a.atcSession?.frequency);
    if (arr && arr !== '????' && cs.startsWith(arr)) { dst.push({ cs: a.callsign, type, freq }); continue; }
    if (type !== 'CTR' && type !== 'FSS') continue;
    const off = distToCorridorNm(cor.pts, aLat, aLon);
    if (off > CTR_NM) continue;
    enr.push({ cs: a.callsign, type, freq, dist: Math.round(haversineNm(lat, lon, aLat, aLon)) });
  }
  enr.sort((a, b) => a.dist - b.dist);
  if (enr.length) { body += `--- ATC EN RUTA (CTR/FSS) ---\n`; for (const a of enr.slice(0, 8)) body += `${a.cs} ${a.freq} ${a.type} ${a.dist}nm\n`; }
  if (dst.length) { body += `--- ATC DESTINO ${arr} ---\n`; for (const a of dst.slice(0, 6)) body += `${a.cs} ${a.freq} ${a.type}\n`; }
  if (!enr.length && !dst.length) body += `NO ATC ACTIVO EN RUTA/DESTINO\n`;
  let nSig = 0, nPirep = 0;
  try {
    // Candidatos en un radio amplio y después filtro fino contra el corredor
    const mid = cor.pts[Math.floor(cor.pts.length / 2)];
    const radius = cor.total / 2 + WX_NM + 400;
    const sig = (await NBV.wx.sigmetsNear(mid.lat, mid.lon, radius))
      .map(s => s).filter(s => s.coords ? distToPolyCorridor(cor.pts, s.coords) <= WX_NM : s.dist != null && s.dist <= radius);
    if (sig.length) { nSig = sig.length; body += `--- SIGMET EN RUTA ---\n`; for (const s of sig.slice(0, 5)) body += `${s.summary}\n`; }
  } catch (e) { if (typeof log === 'function') log(`SIGMET: ${e.message}`, 'wrn'); }
  try {
    const mid = cor.pts[Math.floor(cor.pts.length / 2)];
    const pir = (await NBV.wx.pirepsNear(mid.lat, mid.lon, Math.min(600, cor.total / 2 + WX_NM)))
      .filter(p => p.lat == null || distToCorridorNm(cor.pts, p.lat, p.lon) <= WX_NM);
    if (pir.length) { nPirep = pir.length; body += `--- PIREP EN RUTA ---\n`; for (const p of pir.slice(0, 5)) body += `${p.raw.substring(0, 140)}\n`; }
  } catch (e) { if (typeof log === 'function') log(`PIREP: ${e.message}`, 'wrn'); }
  if (arr && arr !== '????') {
    try { const m = await NBV.wx.metarLatest(arr); if (m) body += `--- METAR DESTINO ---\n${m}\n`; } catch (e) {}
  }
  return { body, atcCount: enr.length + dst.length, nSig, nPirep, corridor: cor };
}
// Distancia mínima de un polígono SIGMET al corredor (0 si algún punto del corredor cae dentro)
function distToPolyCorridor(pts, coords) { let m = Infinity; for (const p of pts) { const d = distToPolyNm(p.lat, p.lon, coords); if (d < m) m = d; if (m === 0) break; } return m; }


// ══════════════════════════════════════════════════════════════════
//  v4.5 — AVISOS SONOROS · AEROPUERTOS · CORREDOR DE RUTA · ETA
//         WEBHOOK CIFRADO · PLANTILLAS EDITABLES
// ══════════════════════════════════════════════════════════════════

// ── Avisos sonoros (sin notificaciones de Windows) ──
// Un tono distinto por evento. Modo compartido: all | rx | off
NBV.sound = (() => {
  // [frecuencia Hz, duración s, retardo ms]
  const PATTERNS = {
    rx:       [[660, .12, 0], [880, .12, 140], [1175, .18, 280]],   // TELEX recibido: tres notas ascendentes
    cpdlc:    [[988, .10, 0], [988, .10, 130]],                      // CPDLC recibido: doble nota
    logon:    [[1319, .08, 0], [1319, .08, 110], [1319, .08, 220], [1568, .2, 330]], // LOGON: insistente
    detected: [[523, .12, 0], [784, .2, 150]],                       // OPS: vuelo detectado
    phase:    [[740, .14, 0]],                                       // OPS: cambio de fase
    ok:       [[800, .12, 0], [1100, .15, 160]],                     // operación completada
    error:    [[300, .25, 0], [220, .3, 260]],                       // error
  };
  const RX_KINDS = new Set(['rx', 'cpdlc', 'logon', 'error']);
  function mode() { return NBV.cfg.loadShared().sndMode || 'all'; }
  function muted() {
    if (typeof soundOn === 'boolean') return !soundOn;
    return NBV.cfg.loadShared().snd === false;
  }
  function ctx() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return audioCtx;
    } catch (e) { return null; }
  }
  function tone(c, f, d, vol) {
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function play(kind = 'ok', { force = false } = {}) {
    if (!force) {
      if (muted()) return;
      const m = mode();
      if (m === 'off' || (m === 'rx' && !RX_KINDS.has(kind))) return;
    }
    const c = ctx(); if (!c) return;
    for (const [f, d, delay] of PATTERNS[kind] || PATTERNS.ok) setTimeout(() => { try { tone(c, f, d, 0.25); } catch (e) {} }, delay);
  }
  // El navegador solo permite audio tras una interacción: se desbloquea con el primer clic/tecla
  const unlock = () => { ctx(); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
  return { play, PATTERNS };
})();

// Contador en el título de la pestaña cuando la app no está visible
NBV.attention = (() => {
  let n = 0, base = null;
  function bump(k = 1) {
    if (!document.hidden) return;
    if (base === null) base = document.title;
    n += k; document.title = `(${n}) ✉ ${base}`;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && base !== null) { document.title = base; base = null; n = 0; } });
  return { bump };
})();

// ── Coordenadas de aeropuerto: tabla local → caché → aviationweather.gov ──
NBV.apt = (() => {
  const KEY = 'nbv_apt';
  let mem = {}; try { mem = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const inflight = {};
  function known(icao) {
    icao = String(icao || '').toUpperCase();
    if (APT_COORDS[icao]) return { lat: APT_COORDS[icao][0], lon: APT_COORDS[icao][1] };
    return mem[icao] || null;
  }
  async function get(icao) {
    icao = String(icao || '').toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(icao)) return null;
    const k = known(icao); if (k) return k;
    if (mem[icao] === false) return null;
    if (!inflight[icao]) inflight[icao] = (async () => {
      try {
        const d = await NBV.net.json(`https://aviationweather.gov/api/data/airport?ids=${icao}&format=json`, { timeout: 8000 });
        const a = Array.isArray(d) ? d.find(x => String(x.icaoId).toUpperCase() === icao) : null;
        mem[icao] = a && isFinite(a.lat) && isFinite(a.lon) ? { lat: +a.lat, lon: +a.lon } : false;
        try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
        return mem[icao] || null;
      } catch (e) { return null; } finally { delete inflight[icao]; }
    })();
    return inflight[icao];
  }
  return { get, known };
})();

// Punto de destino a partir de origen, rumbo y distancia (NM)
function destPoint(lat, lon, brgDeg, distNm) {
  const R = 3440.065, d = distNm / R, b = brgDeg * Math.PI / 180, p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 * 180 / Math.PI, lon: ((l2 * 180 / Math.PI + 540) % 360) - 180 };
}

// Corredor de ruta: puntos cada ~50 NM desde la posición actual hasta el destino.
// Destino conocido → ruta ortodrómica; desconocido → proyección por rumbo y distancia restante.
async function routeCorridor({ lat, lon, hdg, arr, arrLat, arrLon, arrDist }) {
  let dest = (arrLat != null && arrLon != null) ? { lat: +arrLat, lon: +arrLon } : null;
  if (!dest && arr && arr !== '????') dest = await NBV.apt.get(arr);
  let pts = [], total, mode;
  if (dest) {
    total = haversineNm(lat, lon, dest.lat, dest.lon);
    const brg = bearing(lat, lon, dest.lat, dest.lon), n = Math.max(1, Math.ceil(total / 50));
    for (let i = 0; i <= n; i++) pts.push(destPoint(lat, lon, brg, total * i / n));
    mode = 'ruta';
  } else {
    total = Math.min(typeof arrDist === 'number' && arrDist > 0 ? arrDist : 400, 800);
    const n = Math.max(1, Math.ceil(total / 50));
    for (let i = 0; i <= n; i++) pts.push(destPoint(lat, lon, hdg || 0, total * i / n));
    mode = 'rumbo';
  }
  return { pts, total: Math.round(total), dest, mode };
}
function distToCorridorNm(pts, la, lo) { let m = Infinity; for (const p of pts) { const d = haversineNm(p.lat, p.lon, la, lo); if (d < m) m = d; } return m; }

// ETA a destino: distancia de IVAO (cualquier aeropuerto) o calculada
function etaInfo({ arrivalDist, gs, lat, lon, arr }) {
  let dist = typeof arrivalDist === 'number' ? arrivalDist : null;
  if (dist == null && lat && lon && arr) { const k = NBV.apt.known(arr); if (k) dist = haversineNm(lat, lon, k.lat, k.lon); }
  if (dist == null) return { dist: null, eta: null, min: null };
  const min = gs > 50 ? Math.round(dist / gs * 60) : null;
  return { dist: Math.round(dist), min, eta: min != null ? hhmmz(new Date(Date.now() + min * 60000)) : null };
}

// ── Webhook de Discord cifrado (AES-256, misma clave que la API key) ──
NBV.secret = { dc: '' };
function dcUrl() { return NBV.secret.dc || ''; }
function dcRender() {
  const el = $('discordUrl'); if (!el) return;
  el.value = '';
  el.placeholder = dcUrl() ? 'Webhook guardado cifrado — pega otro para cambiarlo' : 'https://discord.com/api/webhooks/...';
  let b = $('dcClear');
  if (!b && el.parentNode) {
    b = document.createElement('button'); b.id = 'dcClear'; b.type = 'button'; b.className = 'apikey-btn clear';
    b.style.cssText = 'margin-top:4px;position:static;transform:none'; b.textContent = '✕ Borrar webhook';
    b.onclick = () => dcSave('').then(() => discordSetStatus('Webhook borrado', null));
    el.parentNode.appendChild(b);
  }
  if (b) b.style.display = dcUrl() ? '' : 'none';
}
const cryptoAvailable = () => !!(window.crypto && crypto.subtle);
async function dcSave(url) {
  url = String(url || '').trim();
  NBV.secret.dc = url;
  try {
    if (!url) localStorage.removeItem('an_dc');
    else if (cryptoAvailable()) localStorage.setItem('an_dc', await cryptoEncrypt(url));
    else discordSetStatus('⚠ Cifrado no disponible en este contexto: webhook solo en memoria (abre la app en localhost)', false);
  } catch (e) { discordSetStatus(`⚠ No se pudo cifrar el webhook: ${e.message}`, false); }
  dcRender();
  NBV.bus.emitRemote('secret');
  return true;
}
let _dcLoading = null, _dcRetry = false;
function dcLoad() {
  // Una sola carga a la vez por ventana
  if (_dcLoading) return _dcLoading;
  _dcLoading = (async () => {
    try {
      let blob = localStorage.getItem('an_dc');
      // Migración desde v4.4: el texto plano solo se borra cuando la copia cifrada ya está guardada
      const stores = ['nbv_shared', 'an3', 'an_ops'];
      let plain = '';
      for (const k of stores) { try { plain = plain || JSON.parse(localStorage.getItem(k))?.discordUrl || ''; } catch (e) {} }
      if (plain && !blob && cryptoAvailable()) {
        try { localStorage.setItem('an_dc', await cryptoEncrypt(plain)); blob = localStorage.getItem('an_dc'); NBV.bus.emitRemote('secret'); } catch (e) {}
      }
      if (blob) for (const k of stores) {
        try { const o = JSON.parse(localStorage.getItem(k)); if (o && 'discordUrl' in o) { delete o.discordUrl; localStorage.setItem(k, JSON.stringify(o)); } } catch (e) {}
      }
      if (blob && cryptoAvailable()) NBV.secret.dc = (await cryptoDecrypt(blob)) || '';
      else if (plain) NBV.secret.dc = plain; // sin cifrado disponible: se sigue usando el antiguo, sin borrarlo
    } catch (e) { console.warn('[NBV] webhook:', e); }
    dcRender();
    // Segunda lectura por si la otra ventana estaba migrando en paralelo
    if (!NBV.secret.dc && !_dcRetry) { _dcRetry = true; setTimeout(() => dcLoad(), 3000); }
    return NBV.secret.dc;
  })();
  _dcLoading.finally(() => { _dcLoading = null; });
  return _dcLoading;
}
async function dcOnChange() {
  const v = ($('discordUrl')?.value || '').trim();
  if (!v) return;
  if (!/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(v)) { discordSetStatus('✗ URL no válida: debe empezar por https://discord.com/api/webhooks/', false); return; }
  await dcSave(v);
  discordSetStatus('✓ Webhook guardado cifrado (AES-256)', true);
}

// ══════════════════════════════════════════════════════════════════
//  PLANTILLAS EDITABLES — TELEX, PDC, CPDLC y bienvenidas por aeropuerto
//  Variables: {CS} callsign destino · {STN} estación · {UTC} hora UTC
//             {DEP} {ARR} plan de vuelo IVAO del destinatario
// ══════════════════════════════════════════════════════════════════
NBV.tpl = (() => {
  const KEY = 'nbv_tpl';
  const CATS = {
    telex: { name: 'TELEX', hint: 'Botones de la pestaña Telex' },
    pdc: { name: 'PDC', hint: 'Autorizaciones de salida (se envían como TELEX)' },
    cpdlc: { name: 'CPDLC', hint: 'Botones de la pestaña CPDLC (en mayúsculas)' },
    welcome: { name: 'Bienvenidas', hint: 'Etiqueta = ICAO de llegada. Varias por aeropuerto = una al azar' },
  };
  function defaults() {
    const welcome = [];
    try { for (const [icao, a] of Object.entries(GALICIAN_AIRPORTS)) for (const fn of a.messages) welcome.push({ label: icao, text: fn('{CS}') }); } catch (e) {}
    return {
      telex: [
        { label: 'GATE CHG', text: 'GATE CHANGE: PROCEED TO GATE __' },
        { label: 'DELAY', text: 'DELAY EXPECTED. REVISED EOBT: ____Z' },
        { label: 'TAXI CLR', text: 'CLEARED TO TAXI VIA __' },
        { label: 'RDY DEP?', text: 'CONFIRM READY FOR DEPARTURE' },
        { label: 'FREQ CHG', text: 'CONTACT __ ON FREQ ___.__' },
        { label: 'SQUAWK', text: 'SQUAWK ____' },
      ],
      pdc: [
        { label: 'PDC', text: 'PDC {CS} {UTC}\nCLRD TO {ARR} VIA ____ DEP\nRWY __ INITIAL CLIMB ____FT\nSQUAWK ____ NEXT FREQ ___.___\nREADBACK ON VOICE' },
        { label: 'PDC DCT', text: 'PDC {CS} {UTC}\nCLRD TO {ARR} AS FILED\nRWY __ CLIMB ____FT EXP FL___ 10 MIN AFT DEP\nSQUAWK ____' },
      ],
      cpdlc: [
        { label: 'CLIMB', text: 'CLIMB TO FL___' }, { label: 'DESCEND', text: 'DESCEND TO FL___' },
        { label: 'MAINTAIN', text: 'MAINTAIN FL___' }, { label: 'TURN L', text: 'TURN LEFT HDG ___' },
        { label: 'TURN R', text: 'TURN RIGHT HDG ___' }, { label: 'DIRECT', text: 'PROCEED DIRECT TO ___' },
        { label: 'CONTACT', text: 'CONTACT ___ ON ___.__' }, { label: 'SQUAWK', text: 'SQUAWK ____' },
        { label: 'REPORT', text: 'REPORT POSITION' }, { label: 'CLR TO', text: 'CLEARED TO ___ VIA ___' },
        { label: 'CROSS AT', text: 'CROSS ___ AT FL___' }, { label: 'RESUME NAV', text: 'RESUME OWN NAVIGATION' },
      ],
      welcome,
    };
  }
  function load() {
    const d = defaults();
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) for (const k of Object.keys(CATS)) if (Array.isArray(s[k])) d[k] = s[k]; } catch (e) {}
    return d;
  }
  function save(all) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, ...all })); } catch (e) {}
    NBV.bus.emit('tpl');
  }
  function reset(cat) { const all = load(); all[cat] = defaults()[cat]; save(all); }
  // Sustitución de variables
  async function fill(text, { cs = '' } = {}) {
    let dep = '', arr = '';
    if (/\{(DEP|ARR)\}/.test(text) && cs) {
      try { const p = NBV.ivao.pilots(await NBV.ivao.get()).find(x => safeStr(x.callsign).toUpperCase() === cs.toUpperCase()); dep = NBV.ivao.depOf(p); arr = NBV.ivao.arrOf(p); } catch (e) {}
    }
    const now = new Date(), utc = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}Z`;
    return text.replace(/\{CS\}/g, cs || '____').replace(/\{STN\}/g, ($('cS')?.value || '').toUpperCase())
      .replace(/\{UTC\}/g, utc).replace(/\{DEP\}/g, dep || '____').replace(/\{ARR\}/g, arr || '____');
  }
  // Bienvenida de llegada para el OPS Center (null si no hay para ese ICAO)
  function welcome(icao, cs) {
    const list = load().welcome.filter(w => String(w.label).toUpperCase() === String(icao || '').toUpperCase() && w.text);
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)].text.replace(/\{CS\}/g, cs || '');
  }
  // Botones de plantillas en un contenedor
  function render(containerId, cats, onPick, btnClass = 'tp') {
    const box = $(containerId); if (!box) return;
    const all = load();
    box.innerHTML = '';
    for (const cat of cats) for (const t of all[cat] || []) {
      if (!t.label || !t.text) continue;
      const b = document.createElement('button');
      b.className = `${btnClass}${cat === 'pdc' ? ' tp-pdc' : ''}`; b.type = 'button';
      b.textContent = t.label; b.title = t.text;
      b.onclick = () => onPick(t.text, cat);
      box.appendChild(b);
    }
    const e = document.createElement('button');
    e.className = `${btnClass} tp-edit`; e.type = 'button'; e.textContent = '✎ Editar'; e.title = 'Editar plantillas';
    e.onclick = () => edit(cats[0]);
    box.appendChild(e);
  }
  // ── Editor modal ──
  function css() {
    if ($('nbvTplCss')) return;
    const s = document.createElement('style'); s.id = 'nbvTplCss';
    s.textContent = `.nbv-tpl-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}
.nbv-tpl{background:var(--bg1,#0b1220);border:1px solid var(--brd,#1c2a40);border-radius:10px;width:min(720px,100%);padding:14px;color:var(--tx1,#e6eaef);font-family:var(--sans,system-ui)}
.nbv-tpl h3{font:600 .95rem var(--mono,monospace);margin:0 0 4px}.nbv-tpl .hint{font:.62rem var(--mono,monospace);color:var(--tx3,#7d8aa0);margin-bottom:10px}
.nbv-tpl .tabs2{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}.nbv-tpl .tabs2 button{background:none;border:1px solid var(--brd,#1c2a40);color:var(--tx2,#9aa6b8);border-radius:6px;padding:4px 10px;font:.7rem var(--mono,monospace);cursor:pointer}
.nbv-tpl .tabs2 button.on{border-color:var(--acc,#2e8cf0);color:var(--acc,#2e8cf0)}
.nbv-tpl .row{display:grid;grid-template-columns:110px 1fr 28px;gap:6px;margin-bottom:6px;align-items:start}
.nbv-tpl input,.nbv-tpl textarea{width:100%;background:var(--bg0,#060910);border:1px solid var(--brd,#1c2a40);color:var(--tx1,#e6eaef);border-radius:6px;padding:6px;font:.72rem var(--mono,monospace);box-sizing:border-box}
.nbv-tpl textarea{min-height:34px;resize:vertical}.nbv-tpl .rm{background:none;border:1px solid var(--brd,#1c2a40);color:var(--tx3,#7d8aa0);border-radius:6px;height:30px;cursor:pointer}
.nbv-tpl .acts{display:flex;gap:6px;justify-content:space-between;margin-top:10px;flex-wrap:wrap}.nbv-tpl .acts button{border:1px solid var(--brd,#1c2a40);background:none;color:var(--tx1,#e6eaef);border-radius:6px;padding:6px 12px;font:.72rem var(--mono,monospace);cursor:pointer}
.nbv-tpl .acts .pri{background:var(--acc,#2e8cf0);border-color:var(--acc,#2e8cf0);color:#fff}.nbv-tpl .msg{font:.65rem var(--mono,monospace);color:var(--ok,#34d399);min-height:1em}
.tp.tp-pdc{border-color:rgba(251,191,36,.35);color:#fbbf24}.tp.tp-edit{opacity:.7}`;
    document.head.appendChild(s);
  }
  function edit(cat = 'telex') {
    css();
    let all = load(), cur = cat;
    const ov = document.createElement('div'); ov.className = 'nbv-tpl-ov';
    ov.innerHTML = `<div class="nbv-tpl" role="dialog" aria-label="Editor de plantillas"><h3>Plantillas</h3>
<div class="hint">Variables: {CS} callsign destino · {STN} tu estación · {UTC} hora · {DEP} {ARR} plan de vuelo IVAO del destinatario. Los cambios valen para ACARS y OPS Center.</div>
<div class="tabs2"></div><div class="hint" id="nbvTplHint"></div><div id="nbvTplRows"></div>
<div class="acts"><div style="display:flex;gap:6px"><button type="button" id="nbvTplAdd">+ Añadir</button><button type="button" id="nbvTplReset">Restaurar por defecto</button></div>
<div style="display:flex;gap:6px;align-items:center"><span class="msg" id="nbvTplMsg"></span><button type="button" id="nbvTplClose">Cerrar</button><button type="button" class="pri" id="nbvTplSave">Guardar</button></div></div></div>`;
    document.body.appendChild(ov);
    const tabs = ov.querySelector('.tabs2'), rows = ov.querySelector('#nbvTplRows'), msg = ov.querySelector('#nbvTplMsg');
    function collect() {
      all[cur] = [...rows.querySelectorAll('.row')].map(r => ({ label: r.querySelector('input').value.trim(), text: r.querySelector('textarea').value }))
        .filter(t => t.label || t.text.trim());
    }
    function draw() {
      tabs.innerHTML = '';
      for (const [k, c] of Object.entries(CATS)) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = `${c.name} (${(all[k] || []).length})`;
        b.className = k === cur ? 'on' : ''; b.onclick = () => { collect(); cur = k; draw(); };
        tabs.appendChild(b);
      }
      ov.querySelector('#nbvTplHint').textContent = CATS[cur].hint;
      rows.innerHTML = '';
      for (const t of all[cur] || []) addRow(t);
    }
    function addRow(t = { label: '', text: '' }) {
      const r = document.createElement('div'); r.className = 'row';
      const i = document.createElement('input'); i.value = t.label; i.placeholder = cur === 'welcome' ? 'LEST' : 'ETIQUETA'; i.maxLength = 16;
      const a = document.createElement('textarea'); a.value = t.text; a.rows = Math.min(8, Math.max(1, String(t.text).split('\n').length));
      const x = document.createElement('button'); x.type = 'button'; x.className = 'rm'; x.textContent = '✕'; x.title = 'Quitar'; x.onclick = () => r.remove();
      r.append(i, a, x); rows.appendChild(r);
      return i;
    }
    ov.querySelector('#nbvTplAdd').onclick = () => addRow().focus();
    ov.querySelector('#nbvTplReset').onclick = () => { all[cur] = defaults()[cur]; draw(); msg.textContent = 'Restaurado (pulsa Guardar)'; };
    ov.querySelector('#nbvTplClose').onclick = () => ov.remove();
    ov.querySelector('#nbvTplSave').onclick = () => { collect(); save(all); draw(); msg.textContent = '✓ Guardado'; };
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') ov.remove(); });
    draw();
  }
  return { load, save, reset, fill, welcome, render, edit, CATS, defaults };
})();



// ══════════════════════════════════════════════════════════════════
//  v4.6 — NBV.ui: iconos SVG, tema claro/oscuro, actividad del día
// ══════════════════════════════════════════════════════════════════
NBV.ui = (() => {
  const embed = (() => { try { return new URLSearchParams(location.search).has('embed') && window.parent !== window; } catch (e) { return false; } })();
  const icon = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

  // ── Tema: auto | light | dark (compartido entre ventanas por localStorage + bus) ──
  const TKEY = 'nbv_theme';
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const theme = {
    get() { try { return localStorage.getItem(TKEY) || 'auto'; } catch (e) { return 'auto'; } },
    resolved(m = theme.get()) { return m === 'auto' ? (mq && !mq.matches ? 'light' : 'dark') : m; },
    apply(m = theme.get()) {
      const r = theme.resolved(m);
      document.documentElement.dataset.theme = r;
      document.documentElement.dataset.themeMode = m;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = r === 'light' ? '#F4F7FB' : '#07111F';
      document.querySelectorAll('[data-theme-ico]').forEach(b => {
        b.innerHTML = icon(r === 'light' ? 'moon' : 'sun') + (b.dataset.themeIco === 'label' ? '<span>Tema</span>' : '');
        b.title = { auto: 'Tema: automático (sistema)', light: 'Tema: claro', dark: 'Tema: oscuro' }[m];
      });
      const sel = document.getElementById('themeSel'); if (sel && sel.value !== m) sel.value = m;
    },
    set(m) { try { localStorage.setItem(TKEY, m); } catch (e) {} theme.apply(m); try { NBV.bus.emitRemote('theme', m); } catch (e) {} },
    cycle() { theme.set(theme.resolved() === 'dark' ? 'light' : 'dark'); },
  };
  NBV.bus.on('theme', m => theme.apply(m));
  if (mq) (mq.addEventListener ? mq.addEventListener('change', () => theme.apply()) : mq.addListener(() => theme.apply()));
  theme.apply();

  // ── Actividad de hoy (UTC), compartida por ambas apps ──
  const SKEY = 'nbv_today';
  const day = () => new Date().toISOString().slice(0, 10);
  function load() {
    let s = null; try { s = JSON.parse(localStorage.getItem(SKEY)); } catch (e) {}
    if (!s || s.d !== day()) s = { d: day(), fl: [], tx: 0, rx: 0, svc: 0, svcAt: 0 };
    return s;
  }
  function save(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} }
  const stats = {
    get: load,
    seen(cs) { if (!cs) return; const s = load(); if (!s.fl.includes(cs)) { s.fl.push(cs); save(s); } },
    msg(dir, ok = true) { if (!ok) return; const s = load(); s[dir === 'rx' ? 'rx' : 'tx']++; save(s); },
    // Tiempo de servicio del monitor; varias ventanas no suman doble (latido ≥ 25 s)
    svc(sec) { const s = load(), now = Date.now(); if (now - (s.svcAt || 0) < 25000) return; s.svc += sec; s.svcAt = now; save(s); },
    fmtSvc(sec) { const m = Math.floor(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; },
  };

  // Botón de sonido (ambas apps)
  function snd(on) {
    const b = document.getElementById('btnSnd'); if (!b) return;
    b.innerHTML = icon(on ? 'bell' : 'bell-off');
    b.classList.toggle('off', !on); b.classList.remove('on');
    b.title = on ? 'Avisos sonoros activos — clic para silenciar' : 'Sonido silenciado — clic para activar';
    b.setAttribute('aria-pressed', String(on));
  }

  if (embed) document.documentElement.classList.add('embed');
  return { embed, icon, theme, stats, snd };
})();

// ── FSUIPC WebSocket Server (Paul Henty) escucha en /fsuipc/ ──
function fsuipcWsUrl(v) {
  let s = String(v || '').trim() || 'ws://127.0.0.1:2048/fsuipc/';
  if (!/^wss?:\/\//i.test(s)) s = 'ws://' + s.replace(/^[a-z]+:\/\//i, '');
  try { const u = new URL(s); if (!u.pathname || u.pathname === '/') u.pathname = '/fsuipc/'; return u.href; } catch (e) { return s; }
}
// Motivo por el que el navegador no permitirá la conexión (o '' si es posible)
function fsuipcBlockedReason(url) {
  let u; try { u = new URL(url); } catch (e) { return 'URL WebSocket no válida'; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (location.protocol === 'https:' && u.protocol === 'ws:' && !local) return 'Desde la versión web (https) solo se puede conectar a un simulador en este mismo equipo (ws://127.0.0.1). Usa START-ACARS.bat';
  if (local && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '')) return 'El simulador no está en este dispositivo: FSUIPC solo funciona en el PC del simulador';
  return '';
}



// Fin NBV CORE
