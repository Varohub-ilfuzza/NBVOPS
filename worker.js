// AirNubeiro ACARS — Worker «nbv-proxy» (Cloudflare Workers, plan gratuito): sirve la app y el proxy CORS (?url=)
// Uso en la app: Ajustes → Proxy personalizado = https://<tu-worker>.workers.dev/?url=
// Misma lista blanca que nbv-server.py. Solo atiende a los orígenes de ALLOWED_ORIGINS.
// 5.3 (hardening, docs/HARDENING-ACARS.md): cabeceras de seguridad en la app (OWASP A02), redirecciones
// revalidadas contra la lista blanca (A01/SSRF), solo GET/HEAD/POST, respuestas del proxy aisladas (nosniff +
// CSP sandbox), errores sin detalles internos (A10) y registro estructurado sin datos sensibles (A09).
const ALLOW_HOSTS = new Set([
  'aviationweather.gov', 'api.ivao.aero', 'www.hoppie.nl', 'www.simbrief.com',
  'discord.com', 'discordapp.com', 'operaciones.airnubeiro.es',
  'tgftp.nws.noaa.gov', 'metar.vatsim.net',
]);
const ALLOW_SUFFIXES = ['.airnubeiro.es'];
// Orígenes que pueden usar el proxy (añade tu dominio propio si lo usas)
const ALLOWED_ORIGINS = ['https://varohub-ilfuzza.github.io', 'https://nbv-proxy.ilfuzza.workers.dev', 'http://localhost:8433', 'http://127.0.0.1:8433'];
const FWD_REQ_HEADERS = ['content-type', 'accept', 'x-api-key', 'authorization'];
const METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'];
const MAX_BODY = 5 * 1024 * 1024, MAX_REDIRECTS = 3;

// Cabeceras de seguridad de la app (las páginas añaden su propia CSP con los hashes de sus scripts en un <meta>;
// esta CSP de cabecera cubre lo que un <meta> no puede: frame-ancestors). Todas las CSP se aplican a la vez.
export const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
};
// Lo que devuelve el proxy es un dato, nunca una página: no se interpreta ni se ejecuta en el origen del Worker
const PROXY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'", 'Cache-Control': 'no-store' };

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
// Registro estructurado (Workers Logs): sin consulta (?…) ni cuerpos, que pueden llevar el logon de Hoppie o claves
function audit(event, data) { try { console.log(JSON.stringify({ app: 'nbv-proxy', event, ...data })); } catch (e) { /* sin registro */ } }
const deny = (status, msg, origin, why = {}) => {
  audit('deny', { status, msg, origin: origin || null, ...why });
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json', ...PROXY_HEADERS, ...(origin ? cors(origin) : {}) } });
};
const allowedTarget = u => ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password
  && (ALLOW_HOSTS.has(u.hostname.toLowerCase()) || ALLOW_SUFFIXES.some(s => u.hostname.toLowerCase().endsWith(s)));
const where = u => `${u.hostname}${u.pathname}`;

function withSecurityHeaders(resp) {
  const r = new Response(resp.body, resp);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) r.headers.set(k, v);
  return r;
}

export default {
  async fetch(request, env) {
    // Sin ?url= → no es una petición de proxy: sirve la app (si el Worker tiene assets) con sus cabeceras de seguridad
    if (!new URL(request.url).searchParams.has('url')) {
      if (env && env.ASSETS) return withSecurityHeaders(await env.ASSETS.fetch(request));
      return new Response('AirNubeiro ACARS proxy: uso ?url=<destino>', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS } });
    }
    const self = new URL(request.url).origin;
    const sameOrigin = request.headers.get('Sec-Fetch-Site') === 'same-origin';
    const origin = request.headers.get('Origin') || (sameOrigin ? self : '');
    if (!ALLOWED_ORIGINS.includes(origin) && origin !== self) return deny(403, 'Origen no permitido', '', { badOrigin: request.headers.get('Origin') || null });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (!METHODS.includes(request.method)) return deny(405, 'Método no permitido', origin, { method: request.method });

    const target = new URL(request.url).searchParams.get('url');
    let u; try { u = new URL(target); } catch { return deny(400, 'Parámetro url inválido', origin); }
    if (!allowedTarget(u)) return deny(403, `Host no permitido: ${u.hostname.toLowerCase()}`, origin, { host: u.hostname });

    const headers = new Headers({ 'User-Agent': 'AirNubeiro-ACARS-Proxy/1.0' });
    for (const h of FWD_REQ_HEADERS) { const v = request.headers.get(h); if (v) headers.set(h, v); }
    // 5.0 rc2: autoATIS de IVAO. La API key vive solo aquí (secreto IVAO_API_KEY: npx wrangler secret put IVAO_API_KEY)
    // y se añade únicamente a GET /v2/auto-atis/{ICAO}; nunca a otras rutas ni hosts, ni tras una redirección.
    if (u.hostname === 'api.ivao.aero' && /^\/v2\/auto-atis\/[A-Za-z0-9]{4}$/.test(u.pathname) && request.method === 'GET' && env && env.IVAO_API_KEY)
      headers.set('apiKey', env.IVAO_API_KEY);
    let body;
    if (!['GET', 'HEAD'].includes(request.method)) {
      body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY) return deny(413, 'Cuerpo demasiado grande', origin);
    }
    // Redirecciones a mano: cada destino vuelve a pasar por la lista blanca (una redirección no abre otro host)
    let resp, method = request.method;
    for (let hop = 0; ; hop++) {
      try { resp = await fetch(u.href, { method, headers, body, redirect: 'manual' }); }
      catch (e) { audit('upstream_error', { where: where(u), error: String(e && e.name || 'Error') }); return deny(502, 'Error de red con el servicio de destino', origin); }
      const loc = resp.headers.get('Location');
      if (![301, 302, 303, 307, 308].includes(resp.status) || !loc) break;
      if (hop >= MAX_REDIRECTS) return deny(508, 'Demasiadas redirecciones', origin, { where: where(u) });
      let next; try { next = new URL(loc, u); } catch { return deny(502, 'Redirección no válida', origin); }
      if (!allowedTarget(next)) return deny(403, `Redirección a un host no permitido: ${next.hostname}`, origin, { from: where(u), host: next.hostname });
      if (resp.status === 303 || ((resp.status === 301 || resp.status === 302) && method === 'POST')) { method = 'GET'; body = undefined; headers.delete('content-type'); }
      headers.delete('apiKey');
      u = next;
    }
    const out = new Headers({ ...cors(origin), ...PROXY_HEADERS });
    const ct = resp.headers.get('Content-Type'); if (ct) out.set('Content-Type', ct);
    return new Response(resp.body, { status: resp.status, headers: out });
  },
};
