// CubeTimer account + sync API as a Cloudflare Worker (free plan). Same API as server.js.
// Storage: one KV namespace bound as KV. Variable ALLOW_ORIGIN = your website address(es), comma separated.
const SESSION_S = 90 * 24 * 3600, MAX_STATE = 25 * 1024 * 1024, MAX_SMALL = 8 * 1024, ITER = 100000;
const enc = new TextEncoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = u8 => [...u8].map(x => x.toString(16).padStart(2, '0')).join('');
const fail = (status, message, extra) => Object.assign(new Error(message), { status, extra });
const validName = n => typeof n === 'string' && /^[A-Za-z0-9_.-]{3,24}$/.test(n);
const validPass = p => typeof p === 'string' && p.length >= 8 && p.length <= 200;

async function sha(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))); }
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, k, 256));
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
const DUMMY = new Uint8Array(16);
async function checkPassword(user, pw) {
  if (!user) { await hashPw(pw, DUMMY); return false; }
  return same(await hashPw(pw, unb64(user.salt)), unb64(user.hash));
}

function cors(req, env) {
  const o = req.headers.get('Origin'), list = (env.ALLOW_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (!o || !list.length || !(list.includes('*') || list.includes(o.replace(/\/$/, '')))) return {};
  return { 'Access-Control-Allow-Origin': list.includes('*') ? '*' : o, 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
}
const send = (req, env, code, obj) => new Response(JSON.stringify(obj), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors(req, env) } });

async function readText(req, limit) {
  const t = await req.text();
  if (t.length > limit) throw fail(413, 'That is too much data.');
  return t;
}
async function readJson(req, limit) {
  try { const j = JSON.parse(await readText(req, limit)); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) { if (e.status) throw e; }
  throw fail(400, 'Invalid request.');
}
const getJ = async (env, k) => { const t = await env.KV.get(k); return t ? JSON.parse(t) : null; };

async function newSession(env, uk, ver) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await env.KV.put('s:' + await sha(token), JSON.stringify({ u: uk, ver }), { expirationTtl: SESSION_S });
  return token;
}
async function auth(req, env) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const key = 's:' + await sha(m[1]), s = await getJ(env, key);
  if (!s) return null;
  const user = await getJ(env, 'u:' + s.u);
  if (!user || (user.ver || 0) !== (s.ver || 0)) return null;
  return { user, key, uk: s.u };
}
async function limited(env, key, max) { return (+(await env.KV.get('rl:' + key)) || 0) >= max; }
async function hitFail(env, key) { const n = (+(await env.KV.get('rl:' + key)) || 0) + 1; await env.KV.put('rl:' + key, String(n), { expirationTtl: 900 }); }

async function api(req, env, p) {
  const m = req.method, ip = req.headers.get('CF-Connecting-IP') || '?';

  if (p === '/api/register' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    if (!validName(b.username)) throw fail(400, 'Username: 3 to 24 letters, numbers, _ . or -');
    if (!validPass(b.password)) throw fail(400, 'Password: at least 8 characters.');
    const uk = b.username.toLowerCase();
    if (await env.KV.get('u:' + uk)) throw fail(409, 'That username is already taken.');
    const salt = crypto.getRandomValues(new Uint8Array(16)), hash = await hashPw(b.password, salt);
    const user = { id: hex(crypto.getRandomValues(new Uint8Array(12))), name: b.username, salt: b64(salt), hash: b64(hash), created: Date.now(), ver: 0 };
    await env.KV.put('u:' + uk, JSON.stringify(user));
    return send(req, env, 200, { token: await newSession(env, uk, 0), username: b.username });
  }

  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    const uk = (typeof b.username === 'string' ? b.username.trim() : '').toLowerCase(), key = ip + '|' + uk;
    if (await limited(env, key, 8)) throw fail(429, 'Too many tries. Wait 15 minutes and try again.');
    const user = await getJ(env, 'u:' + uk);
    const ok = typeof b.password === 'string' && b.password.length <= 200 && await checkPassword(user, b.password);
    if (!ok) { await hitFail(env, key); throw fail(401, 'Wrong username or password.'); }
    return send(req, env, 200, { token: await newSession(env, uk, user.ver || 0), username: user.name });
  }

  const a = await auth(req, env);
  if (!a) throw fail(401, 'Please log in again.');
  const sk = 'st:' + a.user.id;

  if (p === '/api/me' && m === 'GET') return send(req, env, 200, { username: a.user.name, created: a.user.created });
  if (p === '/api/logout' && m === 'POST') { await env.KV.delete(a.key); return send(req, env, 200, { ok: true }); }

  if (p === '/api/state' && m === 'GET') {
    const t = await env.KV.get(sk);
    return send(req, env, 200, { state: t ? JSON.parse(t) : null });
  }

  if (p === '/api/state' && m === 'PUT') {
    const text = await readText(req, MAX_STATE);
    let b;
    try { b = JSON.parse(text); } catch (e) { throw fail(400, 'Invalid request.'); }
    if (!b || typeof b !== 'object' || Array.isArray(b) || !b.data || typeof b.data !== 'object') throw fail(400, 'That is not CubeTimer data.');
    const ts = Number(b.ts) || 0, cur = await env.KV.getWithMetadata(sk);
    const exists = cur.value !== null, old = exists ? Number(cur.metadata && cur.metadata.ts) || 0 : 0;
    const base = Number(new URL(req.url).searchParams.get('base')) || 0;
    if (exists && (base !== old || ts < old)) throw fail(409, 'The server has newer data.', { ts: old });
    await env.KV.put(sk, text, { metadata: { ts } });
    return send(req, env, 200, { ts });
  }

  if (p === '/api/password' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    if (!validPass(b.next)) throw fail(400, 'New password: at least 8 characters.');
    if (!(typeof b.current === 'string' && await checkPassword(a.user, b.current))) throw fail(403, 'Your current password is wrong.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    a.user.salt = b64(salt); a.user.hash = b64(await hashPw(b.next, salt)); a.user.ver = (a.user.ver || 0) + 1;   // other computers must log in again
    await env.KV.put('u:' + a.uk, JSON.stringify(a.user));
    await env.KV.put(a.key, JSON.stringify({ u: a.uk, ver: a.user.ver }), { expirationTtl: SESSION_S });
    return send(req, env, 200, { ok: true });
  }

  if (p === '/api/delete' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    if (!(typeof b.password === 'string' && await checkPassword(a.user, b.password))) throw fail(403, 'Your password is wrong.');
    await env.KV.delete('u:' + a.uk); await env.KV.delete(sk); await env.KV.delete(a.key);
    return send(req, env, 200, { ok: true });
  }
  throw fail(404, 'Not found.');
}

export default {
  async fetch(req, env) {
    const p = new URL(req.url).pathname;
    try {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
      if (!p.startsWith('/api/')) return new Response('CubeTimer API', { status: 200 });
      return await api(req, env, p);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      return send(req, env, status, { error: status === 500 ? 'Server error.' : e.message, ...(e.extra || {}) });
    }
  }
};
