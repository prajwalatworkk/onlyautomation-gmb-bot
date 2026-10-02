// Vercel Routing Middleware: the dashboard and its APIs need a login session (or the bot's key).
export const config = {
  matcher: ['/gmb-dashboard', '/gmb-dashboard.html', '/api/config', '/api/logo', '/config.json'],
};

const COOKIE = 'oa_session';
const enc = new TextEncoder();

async function hmacHex(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// Signing key mixes in GITHUB_TOKEN so a captured cookie can't be used to brute-force the password offline.
const signingKey = password => `${process.env.GITHUB_TOKEN || ''}|${password}`;

async function validSession(token, password) {
  const parts = (token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  if (!(Number(parts[1]) > Date.now() / 1000)) return false;
  return safeEqual(parts[2], await hmacHex(signingKey(password), `v1.${parts[1]}`));
}

const json = (status, error) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

export default async function middleware(request) {
  const url = new URL(request.url);
  const isApi = url.pathname.startsWith('/api/');

  if (url.pathname === '/config.json') return new Response('Not found', { status: 404 });

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return isApi ? json(503, 'Login is not set up yet.')
                 : new Response('The dashboard is locked until the DASHBOARD_PASSWORD setting is added in Vercel.', { status: 503 });
  }
  if (isApi && request.method === 'OPTIONS') return;

  const botKey = request.headers.get('x-localpulse-key');
  if (botKey && safeEqual(botKey, password)) return;
  if (await validSession(readCookie(request, COOKIE), password)) return;

  if (isApi) return json(401, 'Login required');
  return Response.redirect(new URL('/login?next=' + encodeURIComponent(url.pathname), url), 307);
}
