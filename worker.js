// AirNubeiro ACARS — proxy CORS para GitHub Pages (Cloudflare Workers, plan gratuito)
// Uso en la app: Ajustes → Proxy personalizado = https://<tu-worker>.workers.dev/?url=
// Misma lista blanca que nbv-server.py. Solo atiende a los orígenes de ALLOWED_ORIGINS.
const ALLOW_HOSTS = new Set([
  'aviationweather.gov', 'api.ivao.aero', 'www.hoppie.nl', 'www.simbrief.com',
  'discord.com', 'discordapp.com', 'operaciones.airnubeiro.es',
  'tgftp.nws.noaa.gov', 'metar.vatsim.net',
]);
const ALLOW_SUFFIXES = ['.airnubeiro.es'];
// Orígenes que pueden usar el proxy (añade tu dominio propio si lo usas)
const ALLOWED_ORIGINS = ['https://varohub-ilfuzza.github.io', 'https://nbv-proxy.ilfuzza.workers.dev', 'http://localhost:8433', 'http://127.0.0.1:8433'];
const FWD_REQ_HEADERS = ['content-type', 'accept', 'x-api-key', 'authorization'];
const MAX_BODY = 5 * 1024 * 1024;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
const deny = (status, msg, origin) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'Content-Type': 'application/json', ...(origin ? cors(origin) : {}) },
});

export default {
  async fetch(request, env) {
    // Sin ?url= → no es una petición de proxy: sirve la app (si el Worker tiene assets)
    if (!new URL(request.url).searchParams.has('url')) {
      if (env && env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('AirNubeiro ACARS proxy: uso ?url=<destino>', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    const self = new URL(request.url).origin;
    const sameOrigin = request.headers.get('Sec-Fetch-Site') === 'same-origin';
    const origin = request.headers.get('Origin') || (sameOrigin ? self : '');
    if (!ALLOWED_ORIGINS.includes(origin) && origin !== self) return deny(403, 'Origen no permitido');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    const target = new URL(request.url).searchParams.get('url');
    let u; try { u = new URL(target); } catch { return deny(400, 'Parámetro url inválido', origin); }
    const host = u.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(u.protocol) || !(ALLOW_HOSTS.has(host) || ALLOW_SUFFIXES.some(s => host.endsWith(s))))
      return deny(403, `Host no permitido: ${host}`, origin);

    const headers = new Headers({ 'User-Agent': 'AirNubeiro-ACARS-Proxy/1.0' });
    for (const h of FWD_REQ_HEADERS) { const v = request.headers.get(h); if (v) headers.set(h, v); }
    // 5.0 rc2: autoATIS de IVAO. La API key vive solo aquí (secreto IVAO_API_KEY: npx wrangler secret put IVAO_API_KEY)
    // y se añade únicamente a GET /v2/auto-atis/{ICAO}; nunca a otras rutas ni hosts.
    if (host === 'api.ivao.aero' && /^\/v2\/auto-atis\/[A-Za-z0-9]{4}$/.test(u.pathname) && request.method === 'GET' && env && env.IVAO_API_KEY)
      headers.set('apiKey', env.IVAO_API_KEY);
    let body;
    if (!['GET', 'HEAD'].includes(request.method)) {
      body = await request.arrayBuffer();
      if (body.byteLength > MAX_BODY) return deny(413, 'Cuerpo demasiado grande', origin);
    }
    let resp;
    try { resp = await fetch(u.href, { method: request.method, headers, body, redirect: 'follow' }); }
    catch (e) { return deny(502, `Error de red: ${e.message}`, origin); }
    const out = new Headers(cors(origin));
    const ct = resp.headers.get('Content-Type'); if (ct) out.set('Content-Type', ct);
    out.set('Cache-Control', 'no-store');
    return new Response(resp.body, { status: resp.status, headers: out });
  },
};
