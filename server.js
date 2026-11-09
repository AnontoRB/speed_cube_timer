'use strict';
// CubeTimer server: serves the website AND the account/sync API. No npm packages needed (Node 18+).
//
//   node server.js
//
// Environment variables (all optional):
//   PORT           port to listen on (default 3000)
//   DATA_DIR       where accounts and solves are stored (default ./data). Put this on a PERSISTENT disk.
//   ALLOW_ORIGIN   only if the website is hosted somewhere else (for example GitHub Pages):
//                  the website address(es), comma separated, e.g. https://yourname.github.io
//   TRUST_PROXY    set to 1 when running behind a proxy/host (Render, Railway, Fly, nginx) so rate limits see the real IP
//
// API (JSON):
//   POST /api/register {username, password}  -> {token, username}
//   POST /api/login    {username, password}  -> {token, username}
//   POST /api/logout                          (Bearer token)
//   GET  /api/me                              (Bearer token)
//   GET  /api/state                           (Bearer token) -> {state: {...} | null}
//   PUT  /api/state?base=<ts of the server version the data is based on>  {...whole app state}  (Bearer token) -> {ts, d:1}
//                                                                          409 if another computer saved in the meantime
//        Partial upload: {...everything except hist, delta:true, hist:{'YYYY-MM-DD': day | null}} replaces only those past days
//        (null removes a day). The answers carry d:1 so the website knows the server understands this.
//   POST /api/recovery/new {password}         (Bearer token) -> {key}   makes a new recovery key (shown once, replaces the old one)
//   POST /api/recovery/use {username, key, next}  -> {token, username}   forgot password: set a new one with the key (the key is used up)
//   POST /api/password {current, next}        (Bearer token)
//   POST /api/delete   {password}             (Bearer token)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const SITE = __dirname;
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const ORIGINS = (process.env.ALLOW_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const SESSION_MS = 90 * 24 * 3600 * 1000;
const MAX_STATE = 25 * 1024 * 1024;
const MAX_SMALL = 8 * 1024;

fs.mkdirSync(path.join(DATA, 'state'), { recursive: true });

// ---------- tiny file database ----------
const DB_FILE = path.join(DATA, 'users.json');
// Null-prototype objects: a username like "__proto__" or "constructor" must be a normal key, never crash or touch Object.prototype.
let db = { users: Object.create(null), sessions: Object.create(null) };
try {
  const j = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  Object.assign(db.users, j.users);
  Object.assign(db.sessions, j.sessions);
} catch (e) { /* first run */ }

function writeAtomic(file, text) {
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}
const saveDb = () => writeAtomic(DB_FILE, JSON.stringify(db));
const stateFile = id => path.join(DATA, 'state', id + '.json');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

function cleanSessions() {
  const now = Date.now();
  let n = 0;
  for (const k in db.sessions) if (db.sessions[k].exp < now) { delete db.sessions[k]; n++; }
  if (n) saveDb();
}
cleanSessions();
setInterval(cleanSessions, 6 * 3600 * 1000).unref();

// ---------- passwords (scrypt, a random salt per user) ----------
const scrypt = (pw, salt) => new Promise((res, rej) =>
  crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
const DUMMY_SALT = crypto.randomBytes(16);

async function checkPassword(user, pw) {
  if (!user) { await scrypt(pw, DUMMY_SALT); return false; }   // same work whether or not the user exists
  const h = await scrypt(pw, Buffer.from(user.salt, 'base64'));
  const want = Buffer.from(user.hash, 'base64');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}

// ---------- rate limits (in memory) ----------
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), h = hits.get(key);
  if (!h || h.reset < now) return false;
  return h.n >= max;
}
function hit(key, windowMs) {
  const now = Date.now(), h = hits.get(key);
  if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
  else h.n++;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 600000).unref();

// Behind a proxy the LAST x-forwarded-for entry is the one the proxy added itself; the first can be faked by the visitor.
const ipOf = req => (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',').pop().trim()) || req.socket.remoteAddress || '?';

// ---------- helpers ----------
function send(req, res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...cors(req),
    ...(extra || {})
  });
  res.end(body);
}
function cors(req) {
  const o = req.headers.origin;
  if (!o || !ORIGINS.length) return {};
  if (ORIGINS.includes('*') || ORIGINS.includes(o.replace(/\/$/, ''))) {
    return {
      'Access-Control-Allow-Origin': ORIGINS.includes('*') ? '*' : o,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
  }
  return {};
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0, big = false;
    const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) big = true; else chunks.push(c); });
    req.on('end', () => (big ? reject(Object.assign(new Error('That is too much data.'), { status: 413 })) : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const t = await readBody(req, limit);
  try { const j = JSON.parse(t); if (j && typeof j === 'object' && !Array.isArray(j)) return j; } catch (e) { /* fall through */ }
  throw Object.assign(new Error('Invalid request.'), { status: 400 });
}
const fail = (status, message) => Object.assign(new Error(message), { status });

// Partial upload: the website sends the state without its past days (hist) plus only the days that changed.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
function applyDelta(old, b) {
  const days = b.hist;
  if (!days || typeof days !== 'object' || Array.isArray(days)) throw fail(400, 'Invalid request.');
  const hist = Object.fromEntries(Object.entries((old && old.hist) || {}));
  for (const d of Object.keys(days)) {
    const v = days[d];
    if (!DAY.test(d)) throw fail(400, 'Invalid request.');
    if (v === null) delete hist[d];
    else if (v && typeof v === 'object' && !Array.isArray(v)) hist[d] = v;
    else throw fail(400, 'Invalid request.');
  }
  const out = { ...b, hist };
  delete out.delta;
  return out;
}

function userFrom(req) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const key = sha(m[1]), s = db.sessions[key];
  if (!s || s.exp < Date.now()) return null;
  const user = db.users[s.u];
  return user ? { user, key, uk: s.u } : null;
}
function newSession(uk) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[sha(token)] = { u: uk, exp: Date.now() + SESSION_MS };
  saveDb();
  return token;
}
const validName = n => typeof n === 'string' && /^[A-Za-z0-9_.-]{3,24}$/.test(n);
const validPass = p => typeof p === 'string' && p.length >= 8 && p.length <= 200;

// Recovery key: 25 random characters (125 bits) from an alphabet without look-alike letters. Only a hash is stored.
const KEY_ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const newRecoveryKey = () => Array.from(crypto.randomBytes(25), x => KEY_ALPHA[x & 31]).join('');
const cleanKey = k => String(k || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
const keyHash = (uk, k) => sha('ct-rec|' + uk + '|' + k);

// ---------- API ----------
async function api(req, res, p) {
  const m = req.method;

  if (p === '/api/register' && m === 'POST') {
    const ip = ipOf(req);
    if (limited('reg|' + ip, 10, 3600e3)) throw fail(429, 'Too many new accounts from this network. Try again later.');
    const b = await readJson(req, MAX_SMALL);
    if (!validName(b.username)) throw fail(400, 'Username: 3 to 24 letters, numbers, _ . or -');
    if (!validPass(b.password)) throw fail(400, 'Password: at least 8 characters.');
    const uk = b.username.toLowerCase();
    if (db.users[uk]) throw fail(409, 'That username is already taken.');
    const salt = crypto.randomBytes(16), hash = await scrypt(b.password, salt);
    if (db.users[uk]) throw fail(409, 'That username is already taken.');   // someone registered while we hashed
    db.users[uk] = { id: crypto.randomBytes(12).toString('hex'), name: b.username, salt: salt.toString('base64'), hash: hash.toString('base64'), created: Date.now() };
    const token = newSession(uk);
    hit('reg|' + ip, 3600e3);
    return send(req, res, 200, { token, username: b.username });
  }

  if (p === '/api/login' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    const name = typeof b.username === 'string' ? b.username.trim() : '', uk = name.toLowerCase(), key = 'login|' + ipOf(req) + '|' + uk;
    if (limited(key, 8, 900e3) || limited('loginip|' + ipOf(req), 40, 900e3)) throw fail(429, 'Too many tries. Wait 15 minutes and try again.');
    const user = db.users[uk];
    const ok = typeof b.password === 'string' && b.password.length <= 200 && await checkPassword(user, b.password);
    if (!ok) { hit(key, 900e3); hit('loginip|' + ipOf(req), 900e3); throw fail(401, 'Wrong username or password.'); }
    hits.delete(key);
    return send(req, res, 200, { token: newSession(uk), username: user.name });
  }

  // Forgot the password: the recovery key (from the QR code) lets the user choose a new one. The key works once.
  if (p === '/api/recovery/use' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL), ip = ipOf(req);
    const uk = (typeof b.username === 'string' ? b.username.trim() : '').toLowerCase(), key = 'rec|' + ip + '|' + uk;
    if (limited(key, 5, 900e3) || limited('recip|' + ip, 30, 900e3)) throw fail(429, 'Too many tries. Wait 15 minutes and try again.');
    const user = db.users[uk], k = cleanKey(b.key);
    let ok = false;
    if (user && user.rk && k.length === 25) {
      const want = Buffer.from(user.rk, 'hex'), got = Buffer.from(keyHash(uk, k), 'hex');
      ok = want.length === got.length && crypto.timingSafeEqual(want, got);
    }
    if (!ok) { hit(key, 900e3); hit('recip|' + ip, 900e3); throw fail(401, 'That username or recovery key is not right.'); }
    if (!validPass(b.next)) throw fail(400, 'New password: at least 8 characters.');
    const salt = crypto.randomBytes(16), hash = await scrypt(b.next, salt);
    user.salt = salt.toString('base64');
    user.hash = hash.toString('base64');
    delete user.rk;   // used up: the user makes a new one after logging in
    for (const s in db.sessions) if (db.sessions[s].u === uk) delete db.sessions[s];   // every computer must log in again
    hits.delete(key);
    return send(req, res, 200, { token: newSession(uk), username: user.name });
  }

  const a = userFrom(req);
  if (!a) throw fail(401, 'Please log in again.');

  if (p === '/api/me' && m === 'GET') return send(req, res, 200, { username: a.user.name, created: a.user.created, recovery: !!a.user.rk });

  if (p === '/api/logout' && m === 'POST') {
    delete db.sessions[a.key];
    saveDb();
    return send(req, res, 200, { ok: true });
  }

  if (p === '/api/state' && m === 'GET') {
    let state = null;
    try { state = JSON.parse(fs.readFileSync(stateFile(a.user.id), 'utf8')); } catch (e) { /* none yet */ }
    return send(req, res, 200, { state, d: 1 });
  }

  if (p === '/api/state' && m === 'PUT') {
    const text = await readBody(req, MAX_STATE);
    let b;
    try { b = JSON.parse(text); } catch (e) { throw fail(400, 'Invalid request.'); }
    if (!b || typeof b !== 'object' || Array.isArray(b) || !b.data || typeof b.data !== 'object') throw fail(400, 'That is not CubeTimer data.');
    const ts = Number(b.ts) || 0;
    let old = 0, exists = false, oldState = null;
    try { oldState = JSON.parse(fs.readFileSync(stateFile(a.user.id), 'utf8')); old = Number(oldState.ts) || 0; exists = true; } catch (e) { /* none yet */ }
    // The client says which server version its data is based on (?base=). If another computer saved in the
    // meantime the versions differ and the client must merge first, so nothing is ever overwritten by accident.
    const base = Number(new URL(req.url, 'http://x').searchParams.get('base')) || 0;
    if (exists && (base !== old || ts < old)) throw Object.assign(fail(409, 'The server has newer data.'), { extra: { ts: old } });
    let out = text;
    if (b.delta === true) {
      if (!exists) throw Object.assign(fail(409, 'The server has no data yet.'), { extra: { ts: 0 } });   // the website then sends everything
      out = JSON.stringify(applyDelta(oldState, b));
      if (Buffer.byteLength(out) > MAX_STATE) throw fail(413, 'That is too much data.');
    }
    writeAtomic(stateFile(a.user.id), out);
    return send(req, res, 200, { ts, d: 1 });
  }

  if (p === '/api/recovery/new' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL), rk = 'recnew|' + a.uk;
    if (limited(rk, 8, 900e3)) throw fail(429, 'Too many tries. Wait 15 minutes and try again.');
    if (!(typeof b.password === 'string' && b.password.length <= 200 && await checkPassword(a.user, b.password))) { hit(rk, 900e3); throw fail(403, 'Your password is wrong.'); }
    const key = newRecoveryKey();
    a.user.rk = keyHash(a.uk, key);   // replaces any earlier key
    saveDb();
    return send(req, res, 200, { key });
  }

  if (p === '/api/password' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    if (!validPass(b.next)) throw fail(400, 'New password: at least 8 characters.');
    if (!(typeof b.current === 'string' && await checkPassword(a.user, b.current))) throw fail(403, 'Your current password is wrong.');
    const salt = crypto.randomBytes(16), hash = await scrypt(b.next, salt);
    a.user.salt = salt.toString('base64');
    a.user.hash = hash.toString('base64');
    for (const k in db.sessions) if (db.sessions[k].u === a.uk && k !== a.key) delete db.sessions[k];   // other computers must log in again
    saveDb();
    return send(req, res, 200, { ok: true });
  }

  if (p === '/api/delete' && m === 'POST') {
    const b = await readJson(req, MAX_SMALL);
    if (!(typeof b.password === 'string' && await checkPassword(a.user, b.password))) throw fail(403, 'Your password is wrong.');
    for (const k in db.sessions) if (db.sessions[k].u === a.uk) delete db.sessions[k];
    delete db.users[a.uk];
    saveDb();
    try { fs.unlinkSync(stateFile(a.user.id)); } catch (e) { /* no data */ }
    return send(req, res, 200, { ok: true });
  }

  throw fail(404, 'Not found.');
}

// ---------- website files (only these are public; data/ and server.js never are) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['index.html', 'style.css', 'app.js', 'algs.js', 'cubes.js', 'practice.js', 'bt-timer.js', 'qr.js', 'sw.js', 'manifest.json', 'icon.svg']);

function serveStatic(req, res, p) {
  let rel;
  try { rel = decodeURIComponent(p === '/' ? '/index.html' : p).slice(1); } catch (e) { rel = ''; }
  if (!(PUBLIC.has(rel) || /^pkg\/[\w.-]+\.(js|wasm)$/.test(rel))) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  const file = path.join(SITE, rel);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  try {
    if (p.startsWith('/api/')) {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors(req)); return res.end(); }
      return await api(req, res, p);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, p);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (!res.headersSent) send(req, res, status, { error: status === 500 ? 'Server error.' : e.message, ...(e.extra || {}) });
  }
});
server.requestTimeout = 60000;
server.listen(PORT, () => console.log('CubeTimer on http://localhost:' + PORT + '  (data: ' + DATA + ')'));
