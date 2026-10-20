<<<<<<< Updated upstream
// Plain JavaScript core, so the timer always works. If the Rust/WebAssembly build exists in pkg/, it replaces these.
const R = n => Math.floor(Math.random() * n), pk = a => a[R(a.length)];

let scramble = ev => {
  const n = ev === '2' ? 2 : ev === '4' ? 4 : ev === '5' ? 5 : 3,
        len = { 2: 9, 3: 20, 4: 40, 5: 60 }[n],
        fs = 'URFDLB'.slice(0, n == 2 ? 3 : 6);
  let o = [], la = -1;
  while (o.length < len) {
    const f = R(fs.length), a = f % 3;
    if (a === la) continue;
    la = a;
    o.push(fs[f] + ((n > 3 && R(2)) ? 'w' : '') + pk(['', "'", '2']));
  }
  return o.join(' ');
};

let F = (ms, dec) => {
  if (!isFinite(ms)) return 'DNF';
  const d = dec == 3 ? 3 : 2, den = d == 3 ? 1000 : 100, s = Math.floor(ms / (d == 3 ? 1 : 10)) / den;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return m + ':' + (s - m * 60).toFixed(d).padStart(d + 3, '0');
  }
  return s.toFixed(d);
};

let ao5 = v => {
  if (v.length < 5) return NaN;
  if (v.filter(x => x === Infinity).length > 1) return Infinity;
  const s = [...v].sort((a, b) => a === b ? 0 : a - b);
  return (s[1] + s[2] + s[3]) / 3;
};

let stats = v => {
  const fin = [...v].filter(isFinite);
  let b = NaN;
  for (let i = 5; i <= v.length; i++) {
    const x = ao5(v.slice(i - 5, i));
    if (isNaN(b) || x < b) b = x;
  }
  return [fin.length ? Math.min(...fin) : NaN, fin.length ? fin.reduce((a, c) => a + c) / fin.length : NaN, v.length >= 5 ? ao5(v.slice(-5)) : NaN, b];
};

let insp = s => s >= 17 ? -1 : s > 15 ? 2 : 0,
    insp_text = s => s < 15 ? String(Math.ceil(15 - s)) : '+2';

if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const $ = s => document.querySelector(s),
      tm = $('#tm'),
      dl = $('#dl');

const allCubes = () => [...CUBES, ...(S.custom || [])],
      curCube = () => allCubes().find(c => c.id === S.cur) || CUBES[1];
const PRE = { dark: { bg: '#14161a', fg: '#eef0f3', ac: '#5b9dff' }, light: { bg: '#f6f7f9', fg: '#15181d', ac: '#2563eb' } };
const th = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

const defSet = () => ({
  theme: th, ...PRE[th], rd: '#2ecc71', hd: '#e74c3c', fs: 96, ss: 18, hold: 300, insp: true, snd: true, vol: 60, auto: true, hide: false, secs: false, dec: 2, showScr: true, focus: true,
  tone: 'fun', fx: true, sfx: true, vib: true, goal: 20,
  tf: 'system', tw: 600, sfm: true, ui: 100, rad: 8, th: 42, showRs: true, showSt: true, showSide: true
});

const FONTS = { system: 'inherit', mono: 'ui-monospace, Menlo, Consolas, monospace', serif: "Georgia, 'Times New Roman', serif", rounded: "ui-rounded, 'Segoe UI', system-ui, sans-serif" };

let S = {
  set: defSet(),
  cur: '3',
  data: {}
};

try {
  const j = JSON.parse(localStorage.getItem('ct2') || 'null');
  if (j) S = { ...S, ...j, set: { ...S.set, ...j.set } };
} catch (e) {}

S.known = S.known || {};
S.view = S.view || { m: 'cfop', t: 'f2l' };
S.hist = S.hist || {};

try { navigator.storage.persist(); } catch (e) {}

let pt;
const push = () => {
  if (!location.protocol.startsWith('http')) return;
  clearTimeout(pt);
  pt = setTimeout(() => fetch('api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) }).catch(() => {}), 500);
};

const save = () => {
  S.ts = Date.now();
  try { localStorage.setItem('ct2', JSON.stringify(S)); } catch (e) {}
  push();
};

let view = null; // a past day (YYYY-MM-DD) opened read-only from the calendar, or null for today
const viewData = () => {
  const h = (S.hist[view] || {})[S.cur];
  return h ? { solves: h.solves, rounds: h.rounds, round: h.round || h.rounds.length + 1 } : { solves: [], rounds: [], round: 1 };
};

const D = () => view ? viewData() : S.data[S.cur] || (S.data[S.cur] = { solves: [], rounds: [], round: 1 }),
      name = () => curCube().n;

const val = s => s.p === 'D' ? Infinity : s.t + (s.p === 2 ? 2000 : 0);
const fx = x => Number.isNaN(x) ? '–' : F(x, S.set.dec),
      fmtS = s => s.p === 'D' ? 'DNF' : F(val(s), S.set.dec) + (s.p === 2 ? '+' : '');

const arr = v => Float64Array.from(v),
      fmtP = s => fmtS(s) + (s.pb ? ' ★' : '');

// ---- Days: each day starts a fresh session; older days are kept in S.hist (shown in the calendar) ----
const dkey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function rollover() {
  const today = dkey(Date.now());
  if (S.day === today) return false;
  S.hist = S.hist || {};
  let last = 0;
  for (const id in S.data) { const L = S.data[id].solves; if (L.length) last = Math.max(last, L[L.length - 1].d || 0); }
  const key = S.day || (last ? dkey(last) : today);
  let moved = false;
  if (key !== today) {
    for (const id in S.data) {
      const e = S.data[id];
      if (!e.solves.length) continue;
      const h = (S.hist[key] = S.hist[key] || {}), o = h[id];
      h[id] = o ? { solves: o.solves.concat(e.solves), rounds: o.rounds.concat(e.rounds), round: Math.max(o.round || 1, e.round) } : { solves: e.solves, rounds: e.rounds, round: e.round };
      moved = true;
    }
    if (moved) S.data = {};
  }
  S.day = today;
  if (moved) save();
  return moved;
}

function dayData(key) {
  const h = { ...(S.hist[key] || {}) };
  if (key === S.day) for (const id in S.data) if (S.data[id].solves.length) h[id] = S.data[id];
  return h;
}

const dur = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + s % 60 + 's'; };
const cal = { y: 0, m: 0, sel: '' };

function calendar(key) {
  const now = new Date(), today = dkey(now);
  if (key) cal.sel = key;
  if (!cal.sel) { cal.sel = today; cal.y = now.getFullYear(); cal.m = now.getMonth(); }
  const first = new Date(cal.y, cal.m, 1), n = new Date(cal.y, cal.m + 1, 0).getDate();
  let cells = '<span></span>'.repeat(first.getDay());
  for (let i = 1; i <= n; i++) {
    const k = cal.y + '-' + String(cal.m + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    const c = Object.values(dayData(k)).reduce((a, e) => a + e.solves.length, 0);
    cells += `<button data-a="calday" data-k="${k}" class="${k === cal.sel ? 'on' : c ? 'has' : ''}${k === today ? ' td' : ''}">${i}${c ? `<small>${c}</small>` : ''}</button>`;
  }
  const day = dayData(cal.sel), ids = Object.keys(day), tile = (l, x) => `<div><small>${l}</small><b>${x}</b></div>`,
        det = ids.length ? ids.map(id => {
          const e = day[id], v = e.solves.map(val), [b, m, , ba] = stats(arr(v)), tot = v.filter(isFinite).reduce((a, c) => a + c, 0), cn = allCubes().find(c => c.id === id);
          return `<div class="dcard"><h4>${cn ? cn.n : id}</h4><div class="dtiles">${tile('Solves', e.solves.length)}${tile('Best', fx(b))}${tile('Mean', fx(m))}${tile('Best ao5', fx(ba))}${tile('Time spent', dur(tot))}</div><div class="chips">${e.solves.map((s, i) => `<span><small>${i + 1}</small> ${fmtP(s)}</span>`).join('')}</div></div>`;
        }).join('') : '<p class="lead">No solves this day.</p>',
        long = new Date(cal.sel + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  open(`<h3>Calendar</h3><div class="row"><button data-a="calm" data-d="-1">&lsaquo;</button><b style="flex:1;text-align:center">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button data-a="calm" data-d="1">&rsaquo;</button></div><div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}${cells}</div><div class="row dayhead"><b>${long}</b><span class="sp"></span><button class="on" data-a="openday" data-k="${cal.sel}">${cal.sel === S.day ? 'Go to today' : 'Open this day'}</button></div>${det}`);
}

function applyTheme() {
  const r = document.documentElement.style, s = S.set;
  for (const k of ['bg', 'fg', 'ac', 'rd', 'hd']) r.setProperty('--' + k, s[k]);
  r.setProperty('--rad', s.rad + 'px');
  r.setProperty('--ui', s.ui / 100);
  r.setProperty('--th', s.th + 'vh');
  r.setProperty('--tf', FONTS[s.tf] || 'inherit');
  r.setProperty('--tw', s.tw);
  r.setProperty('--sf', s.sfm ? FONTS.mono : 'inherit');
  document.body.classList.toggle('no-rs', !s.showRs);
  document.body.classList.toggle('no-st', !s.showSt);
  document.body.classList.toggle('no-side', !s.showSide);
  r.setProperty('--fs', s.fs + 'px');
  r.setProperty('--ss', s.ss + 'px');
  $('#scr').style.display = s.showScr ? '' : 'none';
}

let scr = '', mode = 'idle', holding = false, ready = false, ht, t0 = 0, i0 = 0, pen = 0, b8 = 0, b12 = 0;

const newScr = () => {
  scr = genScr(curCube());
  $('#scr').textContent = view ? '' : (scr || '(this cube has no scramble)');
};

function beep(f) {
  if (!S.set.snd) return;
  try {
    const c = new AudioContext(), o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = (S.set.vol ?? 60) / 100;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    setTimeout(() => { o.stop(); c.close(); }, 180);
  } catch (e) {}
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

function rstrip(d) {
  const ix = d.solves.map((_, i) => i);
  let I = S.set.auto ? ix.filter(i => d.solves[i].r === d.round) : ix.slice(-5);
  if (S.set.auto && !I.length && d.round > 1) I = ix.filter(i => d.solves[i].r === d.round - 1);
  const L = I.map(i => d.solves[i]);
  let lo = -1, hi = -1;
  if (L.length > 1) {
    const v = L.map(val);
    hi = v.indexOf(Math.max(...v));
    lo = v.indexOf(Math.min(...v));
    if (lo === hi) lo = hi = -1;
  }
  $('#rs').innerHTML = ORD.map((o, i) => {
    const s = L[i], t = s ? fmtP(s) : '–';
    const w = L.length === 5 ? '(' + t + ')' : t;
    return `<div${s ? ` data-a="solve" data-i="${I[i]}" class="pick"` : ''}><small>${o} solve</small><b${i === lo ? ' class="g"' : i === hi ? ' class="r"' : ''}>${i === lo ? '+' + w : i === hi ? '-' + w : t}</b></div>`;
  }).join('');
}

function render() {
  $('#ev').textContent = name();
  const d = D(), [best, mean, cur, bao] = stats(arr(d.solves.map(val))),
        bx = (l, x) => `<div><small>${l}</small><b>${fx(x)}</b></div>`;
  rstrip(d);
  $('#st').innerHTML = bx('Best', best) + bx('Mean', mean) + bx('Current ao5', cur) + bx('Best ao5', bao) + `<div><small>Round</small><b>${S.set.auto ? d.round + ' · ' + d.solves.filter(x => x.r === d.round).length + '/5' : 'off'}</b></div>`;
  $('#cnt').textContent = name() + ' · ' + d.solves.length + ' solves today';
  $('#dt').textContent = (view ? new Date(view + 'T00:00:00') : new Date()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $('#dt').classList.toggle('on', !!view);
  const gc = view ? Object.values(dayData(view)).reduce((a, y) => a + y.solves.length, 0) : todayCount(), gl = S.set.goal, sk = view ? 0 : streak();
  $('#goal').innerHTML = (gl ? `<small>Daily goal</small><div class="gbar"><i style="width:${Math.min(100, gc / gl * 100)}%"></i></div><small>${gc} / ${gl} solves${view ? '' : ' today'}${gc >= gl ? ' ✓' : ''}</small>` : '') + (sk > 1 ? `<div class="sk">🔥 ${sk}-day streak</div>` : '');
  document.body.classList.toggle('view', !!view);
  const vb = $('#vb');
  vb.hidden = !view;
  if (view) {
    vb.innerHTML = `<span>Viewing <b>${new Date(view + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</b> · read-only</span><span class="sp"></span><button data-a="today">Back to today</button>`;
    tm.textContent = d.solves.length ? fmtS(d.solves[d.solves.length - 1]) : '–';
    $('#msg').textContent = 'Past day: you can look, but nothing can be changed.';
  }
  $('#rd').innerHTML = [...d.rounds].reverse().map(r => `<div><b>Round ${r.n}: ${fx(r.res)}</b> (ao5) · ${r.v.join(', ')}</div>`).join('');
}

// Rebuild finished-round records from the solves, so deleting/restoring a time keeps them correct.
function fixRounds(d) {
  d.rounds = [];
  for (let n = 1; n < d.round; n++) {
    const rs = d.solves.filter(x => x.r === n);
    if (rs.length === 5) d.rounds.push({ n, res: ao5(arr(rs.map(val))), v: rs.map(fmtS) });
  }
}

let undoDel = null;

function delSolve(i) {
  if (view) return;
  const d = D(), s = d.solves[i];
  if (!s) return;
  d.solves.splice(i, 1);
  fixRounds(d);
  undoDel = { ev: S.cur, i, s };
  save();
  render();
  const l = d.solves[d.solves.length - 1];
  tm.textContent = l ? fmtS(l) : '0.00';
  $('#msg').innerHTML = `Deleted ${fmtS(s)} · <button data-a="undo">Undo</button>`;
}

function undoSolve() {
  if (!undoDel) return;
  const u = undoDel;
  undoDel = null;
  S.cur = u.ev;
  const d = D();
  d.solves.splice(Math.min(u.i, d.solves.length), 0, u.s);
  fixRounds(d);
  save();
  render();
  tm.textContent = fmtS(u.s);
  $('#msg').textContent = 'Time restored';
}

const focusUI = () => document.body.classList.toggle('run', S.set.focus && mode !== 'idle');

// ---- Reactions: cheers, comfort, streaks, goals, effects ----
const hist = id => Object.keys(S.hist || {}).sort().map(k => S.hist[k][id]).filter(Boolean),
      pastSolves = id => hist(id).flatMap(x => x.solves),
      pastRounds = id => hist(id).flatMap(x => x.rounds),
      todayCount = () => Object.values(S.data).reduce((a, x) => a + x.solves.length, 0),
      buzz = ms => { if (S.set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };

function jingle(notes, step = 0.11, len = 0.16) {
  const vol = (S.set.vol ?? 60) / 100 * 0.6;
  if (!S.set.sfx || vol <= 0) return;
  try {
    const c = new AudioContext();
    notes.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * step;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + len);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + len + 0.02);
    });
    setTimeout(() => c.close(), (notes.length * step + len + 0.3) * 1000);
  } catch (e) {}
}

function confetti(n = 150) {
  if (!S.set.fx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas'), x = cv.getContext('2d'), cols = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#ff9f43'];
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99';
  cv.width = innerWidth;
  cv.height = innerHeight;
  document.documentElement.appendChild(cv);
  const P = Array.from({ length: n }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 240, y: innerHeight * .45, vx: (Math.random() - .5) * 18, vy: -Math.random() * 15 - 4, s: 6 + Math.random() * 6, r: Math.random() * 6, c: pk(cols) }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, cv.width, cv.height);
    P.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5); x.restore(); });
    if (++f < 140) requestAnimationFrame(step); else cv.remove();
  })();
}

function celebrate(kind) {
  if (kind === 'pb') {
    confetti(170);
    jingle([523, 659, 784, 1047, 1319], 0.1, 0.22);
    buzz([60, 40, 60, 40, 140]);
    tm.classList.add('pbflash');
    setTimeout(() => tm.classList.remove('pbflash'), 1600);
  } else if (kind === 'goal' || kind === 'milestone') {
    confetti(90);
    jingle([659, 880, 1047], 0.1, 0.2);
    buzz([40, 30, 80]);
  } else if (kind === 'good') jingle([659, 784], 0.09, 0.14);
  else if (kind === 'bad' || kind === 'vbad') jingle([392, 330], 0.14, 0.22);
  else if (kind === 'dnf') jingle([330, 262], 0.15, 0.25);
}

const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10 < 4 ? n % 10 : 0]);

// Looks at one new solve (before it is stored) and answers with a message, a kind and a PB flag.
function react(s) {
  const e = D(), prior = pastSolves(S.cur).concat(e.solves), fin = prior.map(val).filter(isFinite),
        v = val(s), tone = S.set.tone, fun = tone === 'fun', t = fmtS(s), P = profile(curCube()), cn = curCube().n,
        prevBest = fin.length ? Math.min(...fin) : Infinity,
        isPB = isFinite(v) && fin.length >= 5 && v < prevBest,
        recent = fin.slice(-12), base = recent.length >= 5 ? recent.reduce((a, c) => a + c, 0) / recent.length : 0,
        r = base && isFinite(v) ? v / base : 0, total = prior.length + 1, today = e.solves.length + 1,
        hr = new Date().getHours(), greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  if (isPB) s.pb = 1;
  if (tone === 'off') return { text: isPB ? 'New personal best!' : 'Solve saved', kind: '' };
  let text, kind = 'ok';
  if (isPB) {
    const gap = ((prevBest - v) / 1000).toFixed(2), sub = P.subs.find(x => v < x * 1000 && prevBest >= x * 1000);
    kind = 'pb';
    text = pk([
      `🎉 NEW PERSONAL BEST! ${t}! You beat your record by ${gap}s. Absolutely incredible!`,
      `🏆 ${t} — THAT'S A PB! ${gap}s faster than ever before. Be so proud!`,
      `🔥 PERSONAL BEST!!! ${t}! All that practice just paid off — amazing!`,
      `⚡ New record: ${t}! (${gap}s better.) You are on fire!`
    ]);
    if (sub) text += ` And your first sub-${sub} on ${cn}!`;
  } else if (!isFinite(v)) {
    kind = 'dnf';
    text = pk(fun
      ? ['DNF 😬 The cube won that round. It happens to everybody — shake it off, the next one is yours!', 'A DNF! Even the world record holders have them. On to the next one 💪']
      : ['DNF happens to every cuber. It is just one solve. Breathe and go again 💙', 'Not this one, but the next could be a great one. You are doing fine 💙']);
  } else if (r >= 1.6) {
    kind = 'vbad';
    text = pk(fun
      ? [`Whoa, ${t}?! That one took the scenic route 🐢😄 Don't worry, everyone has solves like this. Reset and crush the next one!`,
         `${t}… the cube said "not today" 😅 It's totally okay! One slow solve doesn't erase all your fast ones.`,
         `Plot twist: that solve was a speed-limit zone 🚧😂 Breathe — you are still improving, and the next one's yours!`]
      : [`${t} was a tough one. It happens to every cuber and one solve does not define you. Breathe and go again 💙`,
         `A slow one, and that is completely fine. Your real progress shows in the average 💙`]);
  } else if (r >= 1.2) {
    kind = 'bad';
    text = pk(['A bit slower than your usual. Totally normal! Breathe and go again 💙', 'Not your fastest, but your average is the real story. Keep going!', 'Everybody has slower solves. Shake it off, the next scramble is fresh 💪']);
  } else if (r && r <= 0.9) {
    kind = 'good';
    text = pk(['Faster than your usual! 🔥', 'Nice one, that is well under your average ⚡', 'Smooth! That one was quicker than normal 👏']);
  } else {
    text = pk(['Solid solve. 👍', 'Nice and steady.', 'Clean solve, keep the rhythm.', 'Saved. Next scramble when you are ready.']);
  }
  // streak of solves faster than the recent average, or a comeback after a slow one
  if (kind !== 'pb' && base && isFinite(v)) {
    let n = 0;
    for (const x of [...recent, v].reverse()) { if (x < base) n++; else break; }
    const prev = recent[recent.length - 1];
    if (n >= 3) text += ` 🔥 ${n} in a row faster than average!`;
    else if (prev && prev / base >= 1.2 && r <= 0.95) text += ' Bounce-back! 💪';
  }
  if (kind !== 'pb' && today === 1) text = `${greet}! First ${cn} solve of the day, ${pk(P.hi)} ` + text;
  const goal = S.set.goal;
  if (kind !== 'pb') {
    if (P.miles.includes(total)) { kind = 'milestone'; text += ` 🎖️ That was your ${ord(total)} ${cn} solve! ${P.fl}`; }
    else if (goal && todayCount() + 1 === goal) { kind = 'goal'; text += ` 🎯 Daily goal reached: ${goal} solves!`; }
  }
  return { text, kind, pb: isPB };
}

const streak = () => {
  const days = new Set(Object.keys(S.hist || {}).filter(k => Object.values(S.hist[k]).some(x => x.solves.length)));
  if (todayCount()) days.add(S.day || dkey(Date.now()));
  let n = 0;
  const d = new Date();
  if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dkey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
};

function add(t, p) {
  undoDel = null;
  rollover();
  const e = D(), s = { t, p, s: scr, d: Date.now(), r: S.set.auto ? e.round : 0 },
        x = react(s);
  let m = x.text, kind = x.kind;
  e.solves.push(s);
  tm.textContent = fmtS(s);
  focusUI();
  if (S.set.auto) {
    const rs = e.solves.filter(y => y.r === e.round);
    if (rs.length >= 5) {
      const res = ao5(arr(rs.map(val))),
            old = pastRounds(S.cur).concat(e.rounds).map(y => y.res).filter(isFinite),
            best = isFinite(res) && old.length > 0 && res < Math.min(...old);
      e.rounds.push({ n: e.round, res, v: rs.map(fmtS) });
      m += ` · Round ${e.round} done: ao5 = ${fx(res)}.` + (best && S.set.tone !== 'off' ? ' 🏆 NEW BEST AO5! Congratulations!' : '') + ' New round started.';
      if (best && S.set.tone !== 'off') kind = 'pb';
      e.round++;
    }
  }
  $('#msg').innerHTML = kind ? `<span class="${kind}">${m}</span>` : m;
  celebrate(kind);
  save();
  newScr();
  render();
}

function tick() {
  focusUI();
  if (mode === 'run') {
    tm.textContent = S.set.hide ? '…' : S.set.secs ? F(performance.now() - t0, 2).split('.')[0] : F(performance.now() - t0, S.set.dec);
  } else if (mode === 'insp') {
    const e = (performance.now() - i0) / 1000;
    if (e >= 8 && !b8) { b8 = 1; beep(600); }
    if (e >= 12 && !b12) { b12 = 1; beep(900); }
    if (insp(e) < 0) {
      mode = 'idle';
      tm.className = '';
      $('#msg').textContent = 'Inspection over 17 s: DNF';
      add(0, 'D');
      return;
    }
    tm.textContent = insp_text(e);
  } else {
    return;
  }
  requestAnimationFrame(tick);
}

function down() {
  if (view) return;
  if (mode === 'run') {
    const t = performance.now() - t0;
    mode = 'idle';
    tm.className = '';
    add(t, pen);
    return;
  }
  holding = true;
  ready = false;
  const need = mode === 'insp' || !S.set.insp;
  if (need) tm.className = 'hold';
  ht = setTimeout(() => {
    if (holding && need) {
      ready = true;
      tm.className = 'ready';
      jingle([880], 0.1, 0.07);
      buzz(15);
    }
  }, S.set.hold);
}

function up() {
  if (!holding) return;
  holding = false;
  clearTimeout(ht);
  if (mode === 'idle' && S.set.insp) {
    mode = 'insp';
    i0 = performance.now();
    b8 = b12 = 0;
    pen = 0;
    tm.className = 'insp';
    $('#msg').textContent = 'Inspection: hold and release to start';
    tick();
  } else if (ready) {
    pen = mode === 'insp' ? Math.max(0, insp((performance.now() - i0) / 1000)) : 0;
    mode = 'run';
    t0 = performance.now();
    tm.className = '';
    $('#msg').textContent = pen ? '+2 penalty (inspection over 15 s)' : '';
    tick();
  } else {
    tm.className = mode === 'insp' ? 'insp' : '';
  }
  ready = false;
}

document.addEventListener('keydown', e => {
  if (dl.open) return;
  if (e.code === 'Escape' && mode === 'insp') {
    mode = 'idle';
    tm.className = '';
    tm.textContent = '0.00';
    focusUI();
    return;
  }
  if (mode === 'idle' && !view && D().solves.length && !e.ctrlKey && !e.metaKey) {
    const L = D().solves, s = L[L.length - 1];
    let h = 1;
    if (e.key === 'Backspace' || e.key === 'Delete') L.pop();
    else if (e.key === '2') s.p = s.p === 2 ? 0 : 2;
    else if (e.key === 'd' || e.key === 'D') s.p = s.p === 'D' ? 0 : 'D';
    else h = 0;
    if (h) {
      save();
      render();
      const l = L[L.length - 1];
      tm.textContent = l ? fmtS(l) : '0.00';
      return;
    }
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) down();
  } else if (mode === 'run') {
    down();
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!dl.open) up();
  }
});

document.addEventListener('pointerdown', e => {
  if (dl.open) return;
  if (mode === 'run') { down(); return; }
  if (e.target.closest('#tz') && !e.target.closest('button')) down();
});

['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { if (!dl.open) up(); }));

const open = h => {
  dl.innerHTML = '<div class="dc"><button data-a="close" class="x" aria-label="Close" title="Close">&times;</button>' + h + '</div>';
  if (!dl.open) dl.showModal();
};

const RULES = [
  ['a', 'New scramble for every attempt (Rust generates it).'],
  ['a', '15 s inspection with beeps at 8 s and 12 s (can be turned off).'],
  ['a', 'Hold, wait for green, release to start. Any key or tap stops.'],
  ['a', 'Start between 15 and 17 s = +2. Past 17 s = DNF.'],
  ['a', 'Manual +2 and DNF buttons on every solve for judge penalties.'],
  ['a', 'Ao5: best and worst dropped, two or more DNFs = DNF. Times are truncated, not rounded.'],
  ['h', '3x3 OH: solve and inspect with one hand only.'],
  ['h', 'Scrambles are random-move, not the official random-state scrambler.']
];

function cubePicker() {
  const one = c => `<span class="cb"><button data-a="cube" data-i="${c.id}" class="${c.id === S.cur ? 'on' : ''}">${c.n}</button>${c.meth ? '' : `<button data-a="rmcube" data-i="${c.id}" class="rm" title="Remove">&times;</button>`}</span>`;
  open(`<h3>Choose a cube</h3><div class="cubes">${allCubes().map(one).join('')}</div><h4>Add your own cube</h4><div class="add"><input id="cn" placeholder="Name (e.g. Mirror cube)" maxlength="24"><select id="ct">${CTYPES.map(x => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select><button data-a="addcube">Add</button></div><p class="lead">Pick which scramble it uses. Custom cubes get their own times and a notes page under Methods.</p>`);
}

function settings() {
  const s = S.set,
        c = (k, l) => `<label class="set">${l}<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`,
        r = (k, l, a, b, st) => `<label class="set">${l}: <span id="v_${k}">${s[k]}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${s[k]}"></label>`,
        col = (k, l) => `<label class="set">${l}<input type="color" data-k="${k}" value="${s[k]}"></label>`,
        sl = (k, l, o) => `<label class="set">${l}<select data-k="${k}">${o.map(x => `<option value="${x[0]}" ${s[k] == x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label>`;
  open(`<h3>Settings</h3>
<h4>Theme and colors</h4>${sl('theme', 'Theme', [['dark', 'dark'], ['light', 'light'], ['custom', 'custom']])}${col('bg', 'Background')}${col('fg', 'Text')}${col('ac', 'Accent')}${col('rd', 'Ready color (green)')}${col('hd', 'Hold color (red)')}
<h4>Layout</h4>${r('ui', 'Interface size (%)', 70, 150, 5)}${r('rad', 'Corner roundness (px)', 0, 24, 1)}${r('th', 'Timer area height (%)', 30, 70, 2)}${c('showScr', 'Show scramble')}${c('showRs', 'Show 1st to 5th solve boxes')}${c('showSt', 'Show stats (best, mean, ao5)')}${c('showSide', 'Show side column (rounds, delete)')}
<h4>Text</h4>${sl('tf', 'Timer font', [['system', 'System'], ['mono', 'Monospace'], ['serif', 'Serif'], ['rounded', 'Rounded']])}${r('tw', 'Timer weight', 300, 800, 100)}${r('fs', 'Timer size', 40, 200, 2)}${r('ss', 'Scramble size', 12, 36, 1)}${c('sfm', 'Monospace scramble')}${sl('dec', 'Decimals', [[2, '2'], [3, '3']])}
<h4>Timing and sound</h4>${r('hold', 'Hold time (ms)', 0, 1000, 50)}${c('insp', '15 s inspection')}${c('snd', 'Inspection beeps')}${r('vol', 'Beep volume (%)', 0, 100, 5)}${c('auto', 'Auto rounds (new round after each ao5)')}${c('focus', 'Focus mode (hide everything while solving)')}${c('hide', 'Hide time while solving')}${c('secs', 'Show whole seconds only while solving')}
<h4>Reactions and fun</h4>${sl('tone', 'Reactions', [['fun', 'Fun (cheers, comfort, playful teasing)'], ['kind', 'Kind (cheers and comfort only)'], ['off', 'Off']])}${c('fx', 'Confetti')}${c('sfx', 'Sound effects')}${c('vib', 'Vibration (phones)')}${r('goal', 'Daily solve goal (0 = off)', 0, 200, 5)}
<div class="row" style="margin-top:10px;flex-wrap:wrap"><button data-a="exp">Export data</button><button data-a="imp">Import data</button><span class="sp"></span><button data-a="rst">Reset settings</button></div>`);
}

dl.addEventListener('input', e => {
  if (e.target.id === 'nt') { curCube().notes = e.target.value; save(); return; }
  const k = e.target.dataset.k;
  if (!k) return;
  const s = S.set;
  let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (e.target.type === 'range') {
    v = +v;
    const sp = $('#v_' + k);
    if (sp) sp.textContent = v;
  }
  if (k === 'dec') v = +v;
  s[k] = v;
  if (k === 'theme' && PRE[v]) {
    Object.assign(s, PRE[v]);
    settings();
  } else if (['bg', 'fg', 'ac'].includes(k)) {
    s.theme = 'custom';
  }
  applyTheme();
  save();
  render();
});

let sel = -1;

dl.addEventListener('click', e => {
  if (e.target === dl) { dl.close(); return; } // click outside the window (on the dark backdrop)
  const b = e.target.closest('button');
  if (!b) return;
  const a = b.dataset.a, d = D(), s = d.solves[sel];
  if (view && ['p2', 'dnf', 'del', 'yes'].includes(a)) return;
  if (a === 'close') dl.close();
  else if (a === 'calm') { cal.m += +b.dataset.d; if (cal.m < 0) { cal.m = 11; cal.y--; } else if (cal.m > 11) { cal.m = 0; cal.y++; } calendar(); }
  else if (a === 'calday') calendar(b.dataset.k);
  else if (a === 'rst') { if (confirm('Reset all settings to their defaults? Your solves are not touched.')) { S.set = defSet(); applyTheme(); save(); render(); settings(); } }
  else if (a === 'openday') { view = b.dataset.k === S.day ? null : b.dataset.k; dl.close(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); }
  else if (a === 'cube') { S.cur = b.dataset.i; save(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); dl.close(); }
  else if (a === 'addcube') {
    const n = $('#cn').value.trim();
    if (!n) { $('#cn').focus(); return; }
    (S.custom = S.custom || []).push({ id: 'c' + Date.now(), n, t: $('#ct').value, meth: null });
    S.cur = S.custom[S.custom.length - 1].id;
    save(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); dl.close();
  } else if (a === 'rmcube') {
    const c = allCubes().find(x => x.id === b.dataset.i);
    if (c && confirm('Remove ' + c.n + ' and all its solves?')) {
      S.custom = S.custom.filter(x => x.id !== c.id);
      delete S.data[c.id];
      if (S.cur === c.id) S.cur = '3';
      save(); newScr(); tm.textContent = '0.00'; render(); cubePicker();
    }
  }
  else if (a === 'mt') methods(b.dataset.m, b.dataset.t);
  else if (a === 'exp') {
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
    l.download = 'cubetimer-data.json';
    l.click();
  } else if (a === 'imp') {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = '.json';
    i.onchange = () => i.files[0].text().then(t => { try { S = JSON.parse(t); save(); location.reload(); } catch (x) { alert('Invalid file'); } });
    i.click();
  } else if (a === 'p2') { s.p = s.p === 2 ? 0 : 2; save(); render(); dl.close(); }
  else if (a === 'dnf') { s.p = s.p === 'D' ? 0 : 'D'; save(); render(); dl.close(); }
  else if (a === 'del') { dl.close(); delSolve(sel); }
  else if (a === 'yes') { S.data[S.cur] = { solves: [], rounds: [], round: 1 }; save(); tm.textContent = '0.00'; render(); dl.close(); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('button, [data-a]');
  if (!b || dl.contains(b)) return;
  const a = b.dataset.a;
  b.blur();
  if (a === 'cubes' && mode === 'idle') cubePicker();
  else if (a === 'cal' && mode === 'idle') { cal.sel = ''; calendar(); }
  else if (a === 'today') { view = null; newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); }
  else if (a === 'rules') {
    open('<h3>Rules (WCA based)</h3><p style="color:var(--mut);margin:0">Green tag: applied automatically. Grey tag: honor system.</p><ul style="padding-left:18px">' + RULES.map(r => `<li><span class="tg ${r[0] == 'h' ? 'h' : ''}">${r[0] == 'a' ? 'applied' : 'honor'}</span>${r[1]}</li>`).join('') + '</ul>');
  } else if (a === 'set') settings();
  else if (a === 'meth') methods();
  else if (a === 'solve') {
    sel = +b.dataset.i;
    const s = D().solves[sel];
    open(`<h3>#${sel + 1} · ${fmtS(s)}</h3><div style="white-space:pre-line;font-family:ui-monospace,monospace;margin-bottom:8px">${s.s}</div><small style="color:var(--mut)">${new Date(s.d).toLocaleString()}</small>${view ? '' : `<div class="row" style="margin-top:10px"><button data-a="p2" class="${s.p === 2 ? 'on' : ''}">+2</button><button data-a="dnf" class="${s.p === 'D' ? 'on' : ''}">DNF</button><button data-a="del">Delete</button></div>`}`);
  } else if (a === 'x' && mode === 'idle') {
    delSolve(+b.dataset.i);
  } else if (a === 'undo') {
    undoSolve();
  } else if (a === 'delall' && !view) {
    open(`<h3>Delete today's ${name()} times?</h3><p>This removes today's solves and rounds for this cube. Earlier days in the calendar are not touched. It cannot be undone.</p><button data-a="yes">Yes, delete session</button>`);
  }
});

rollover();
applyTheme();
newScr();
render();

// Optional: use the Rust/WebAssembly versions when pkg/ is built and served over http.
(async () => {
  try {
    const m = await import('./pkg/cubetimer.js');
    await m.default();
    ({ scramble, ao5, stats, insp, insp_text } = m);
    F = m.fmt;
    render();
    console.log('Rust core loaded');
  } catch (e) {
    console.log('Using JavaScript core');
  }
})();

function methods(m, t) {
  const c = curCube();
  if (!c.meth) {
    open(`<h3>${c.n} notes</h3><p class="lead">Your own cube. Write your method, algs or tips here. They are saved.</p><textarea id="nt" class="notes" placeholder="Method, algs, tips...">${(c.notes || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>`);
    return;
  }
  const MS = Object.fromEntries(c.meth.map(k => [k, M[k]])), st = S.view;
  if (!MS[st.m]) { st.m = c.meth[0]; st.t = Object.keys(MS[st.m].sub)[0]; }
  if (m) {
    if (m !== st.m || t) st.t = t || Object.keys(MS[m].sub)[0];
    st.m = m;
  }
  const me = MS[st.m], ks = Object.keys(me.sub);
  if (!me.sub[st.t]) st.t = ks[0];
  const d = me.sub[st.t];
  save();
  const A = d.algs.filter(a => a[0] !== '#' && a[0] !== 't'),
        kn = A.filter(a => S.known[a[1]]).length;
  open(`<h3>Methods · ${c.n} <small class="lead" id="kc">${A.length ? kn + ' / ' + A.length + ' known' : ''}</small></h3><div class="row tabs">${Object.keys(MS).map(k => `<button data-a="mt" data-m="${k}" class="${k === st.m ? 'on' : ''}">${MS[k].n}</button>`).join('')}</div>${ks.length > 1 ? `<div class="row tabs">${ks.map(k => `<button data-a="mt" data-m="${st.m}" data-t="${k}" class="${k === st.t ? 'on' : ''}">${me.sub[k].n}</button>`).join('')}</div>` : ''}<p class="lead">${d.info}</p>${A.length ? '' : '<p class="lead">No algs in this step. It is solved by thinking and practice, so there is nothing to tick.</p>'}${d.tips.length ? `<ul style="padding-left:18px">${d.tips.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}${d.algs.map(a => a[0] === '#' ? `<h4>${a[1]}</h4>` : a[0] === 't' ? `<p style="margin:2px 0">${a[1]}</p>` : `<label class="alg"><input type="checkbox" data-alg="${a[1]}" ${S.known[a[1]] ? 'checked' : ''}><b>${a[0]}</b><code>${a[1]}</code></label>`).join('')}`);
  dl.scrollTop = 0;
}

dl.addEventListener('change', e => {
  const a = e.target.dataset.alg;
  if (a === undefined) return;
  if (e.target.checked) S.known[a] = 1;
  else delete S.known[a];
  save();
  const c = [...dl.querySelectorAll('[data-alg]')];
  $('#kc').textContent = c.filter(x => x.checked).length + ' / ' + c.length + ' known';
});

// Shared saving: if the site runs with server.rs, load the newest saved data from it (works for any visitor).
async function pull() {
  if (!location.protocol.startsWith('http') || mode !== 'idle') return;
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.ts > (S.ts || 0)) {
      S = { ...S, ...j, set: { ...S.set, ...j.set } };
      S.known = S.known || {};
      S.view = S.view || { m: 'cfop', t: 'f2l' };
      S.hist = S.hist || {};
      rollover();
      try { localStorage.setItem('ct2', JSON.stringify(S)); } catch (e) {}
      applyTheme();
      newScr();
      render();
    } else if ((S.ts || 0) > ((j && j.ts) || 0)) {
      push();
    }
  } catch (e) {}
}

pull();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (mode === 'idle' && rollover()) { tm.textContent = '0.00'; render(); } pull(); } });
setInterval(() => { if (mode === 'idle' && !dl.open && rollover()) { tm.textContent = '0.00'; render(); } }, 30000);
=======
// Plain JavaScript core, so the timer always works. If the Rust/WebAssembly build exists in pkg/, it replaces these.
const R = n => Math.floor(Math.random() * n), pk = a => a[R(a.length)];

let scramble = ev => {
  const n = ev === '2' ? 2 : ev === '4' ? 4 : ev === '5' ? 5 : 3,
        len = { 2: 9, 3: 20, 4: 40, 5: 60 }[n],
        fs = 'URFDLB'.slice(0, n == 2 ? 3 : 6);
  let o = [], la = -1;
  while (o.length < len) {
    const f = R(fs.length), a = f % 3;
    if (a === la) continue;
    la = a;
    o.push(fs[f] + ((n > 3 && R(2)) ? 'w' : '') + pk(['', "'", '2']));
  }
  return o.join(' ');
};

let F = (ms, dec) => {
  if (!isFinite(ms)) return 'DNF';
  const d = dec == 3 ? 3 : 2, den = d == 3 ? 1000 : 100, s = Math.floor(ms / (d == 3 ? 1 : 10)) / den;
  if (s >= 60) {
    const m = Math.floor(s / 60);
    return m + ':' + (s - m * 60).toFixed(d).padStart(d + 3, '0');
  }
  return s.toFixed(d);
};

let ao5 = v => {
  if (v.length < 5) return NaN;
  if (v.filter(x => x === Infinity).length > 1) return Infinity;
  const s = [...v].sort((a, b) => a === b ? 0 : a - b);
  return (s[1] + s[2] + s[3]) / 3;
};

let stats = v => {
  const fin = [...v].filter(isFinite);
  let b = NaN;
  for (let i = 5; i <= v.length; i++) {
    const x = ao5(v.slice(i - 5, i));
    if (isNaN(b) || x < b) b = x;
  }
  return [fin.length ? Math.min(...fin) : NaN, fin.length ? fin.reduce((a, c) => a + c) / fin.length : NaN, v.length >= 5 ? ao5(v.slice(-5)) : NaN, b];
};

let insp = s => s >= 17 ? -1 : s > 15 ? 2 : 0,
    insp_text = s => s < 15 ? String(Math.ceil(15 - s)) : '+2';

if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const $ = s => document.querySelector(s),
      tm = $('#tm'),
      dl = $('#dl');

const allCubes = () => [...CUBES, ...(S.custom || [])],
      curCube = () => allCubes().find(c => c.id === S.cur) || CUBES[1];
const PRE = { dark: { bg: '#14161a', fg: '#eef0f3', ac: '#5b9dff' }, light: { bg: '#f6f7f9', fg: '#15181d', ac: '#2563eb' } };
const th = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

const defSet = () => ({
  theme: th, ...PRE[th], rd: '#2ecc71', hd: '#e74c3c', fs: 96, ss: 18, hold: 300, insp: true, snd: true, vol: 60, auto: true, hide: false, secs: false, dec: 2, showScr: true, focus: true,
  tone: 'fun', det: 'full', fx: true, fxi: 2, sfx: true, rdy: true, vib: true, brk: true, goal: 20,
  tf: 'system', tw: 600, sfm: true, ui: 100, rad: 8, th: 42, showRs: true, showSt: true, showSide: true
});

const FONTS = { system: 'inherit', mono: 'ui-monospace, Menlo, Consolas, monospace', serif: "Georgia, 'Times New Roman', serif", rounded: "ui-rounded, 'Segoe UI', system-ui, sans-serif" };

let S = {
  set: defSet(),
  cur: '3',
  data: {}
};

try {
  const j = JSON.parse(localStorage.getItem('ct2') || 'null');
  if (j) S = { ...S, ...j, set: { ...S.set, ...j.set } };
} catch (e) {}

S.known = S.known || {};
S.view = S.view || { m: 'cfop', t: 'f2l' };
S.hist = S.hist || {};
S.rec = S.rec || {};

try { navigator.storage.persist(); } catch (e) {}

let pt;
const push = () => {
  if (!location.protocol.startsWith('http')) return;
  clearTimeout(pt);
  pt = setTimeout(() => fetch('api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S) }).catch(() => {}), 500);
};

const save = () => {
  S.ts = Date.now();
  try { localStorage.setItem('ct2', JSON.stringify(S)); } catch (e) {}
  push();
};

let view = null; // a past day (YYYY-MM-DD) opened read-only from the calendar, or null for today
const viewData = () => {
  const h = (S.hist[view] || {})[S.cur];
  return h ? { solves: h.solves, rounds: h.rounds, round: h.round || h.rounds.length + 1 } : { solves: [], rounds: [], round: 1 };
};

const D = () => view ? viewData() : S.data[S.cur] || (S.data[S.cur] = { solves: [], rounds: [], round: 1 }),
      name = () => curCube().n;

const val = s => s.p === 'D' ? Infinity : s.t + (s.p === 2 ? 2000 : 0);
const fx = x => Number.isNaN(x) ? '–' : F(x, S.set.dec),
      fmtS = s => s.p === 'D' ? 'DNF' : F(val(s), S.set.dec) + (s.p === 2 ? '+' : '');

const arr = v => Float64Array.from(v),
      fmtP = s => fmtS(s) + (s.pb ? ' ★' : '');

// ---- Days: each day starts a fresh session; older days are kept in S.hist (shown in the calendar) ----
const dkey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function rollover() {
  const today = dkey(Date.now());
  if (S.day === today) return false;
  S.hist = S.hist || {};
  let last = 0;
  for (const id in S.data) { const L = S.data[id].solves; if (L.length) last = Math.max(last, L[L.length - 1].d || 0); }
  const key = S.day || (last ? dkey(last) : today);
  let moved = false;
  if (key !== today) {
    for (const id in S.data) {
      const e = S.data[id];
      if (!e.solves.length) continue;
      const h = (S.hist[key] = S.hist[key] || {}), o = h[id];
      h[id] = o ? { solves: o.solves.concat(e.solves), rounds: o.rounds.concat(e.rounds), round: Math.max(o.round || 1, e.round) } : { solves: e.solves, rounds: e.rounds, round: e.round };
      moved = true;
    }
    if (moved) S.data = {};
  }
  S.day = today;
  if (moved) save();
  return moved;
}

function dayData(key) {
  const h = { ...(S.hist[key] || {}) };
  if (key === S.day) for (const id in S.data) if (S.data[id].solves.length) h[id] = S.data[id];
  return h;
}

const dur = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + s % 60 + 's'; };
const cal = { y: 0, m: 0, sel: '' };

function calendar(key) {
  const now = new Date(), today = dkey(now);
  if (key) cal.sel = key;
  if (!cal.sel) { cal.sel = today; cal.y = now.getFullYear(); cal.m = now.getMonth(); }
  const first = new Date(cal.y, cal.m, 1), n = new Date(cal.y, cal.m + 1, 0).getDate();
  let cells = '<span></span>'.repeat(first.getDay());
  for (let i = 1; i <= n; i++) {
    const k = cal.y + '-' + String(cal.m + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
    const dd = Object.values(dayData(k)), c = dd.reduce((a, e) => a + e.solves.length, 0), hasPb = dd.some(e => e.solves.some(x => x.pb));
    cells += `<button data-a="calday" data-k="${k}" class="${k === cal.sel ? 'on' : c ? 'has' : ''}${k === today ? ' td' : ''}">${i}${c ? `<small>${c}${hasPb ? ' ★' : ''}</small>` : ''}</button>`;
  }
  const day = dayData(cal.sel), ids = Object.keys(day), tile = (l, x) => `<div><small>${l}</small><b>${x}</b></div>`,
        det = ids.length ? ids.map(id => {
          const e = day[id], v = e.solves.map(val), [b, m, , ba] = stats(arr(v)), tot = v.filter(isFinite).reduce((a, c) => a + c, 0), cn = allCubes().find(c => c.id === id), pbn = e.solves.filter(x => x.pb).length, dnn = e.solves.filter(x => x.p === 'D').length;
          return `<div class="dcard"><h4>${cn ? cn.n : id}</h4><div class="dtiles">${tile('Solves', e.solves.length)}${tile('Best', fx(b))}${tile('Mean', fx(m))}${tile('Best ao5', fx(ba))}${tile('Time spent', dur(tot))}${pbn ? tile('PBs ★', pbn) : ''}${dnn ? tile('DNFs', dnn) : ''}</div><div class="chips">${e.solves.map((s, i) => `<span><small>${i + 1}</small> ${fmtP(s)}</span>`).join('')}</div></div>`;
        }).join('') : '<p class="lead">No solves this day.</p>',
        long = new Date(cal.sel + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  open(`<h3>Calendar</h3><div class="row"><button data-a="calm" data-d="-1">&lsaquo;</button><b style="flex:1;text-align:center">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button data-a="calm" data-d="1">&rsaquo;</button></div><div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}${cells}</div><div class="row dayhead"><b>${long}</b><span class="sp"></span><button class="on" data-a="openday" data-k="${cal.sel}">${cal.sel === S.day ? 'Go to today' : 'Open this day'}</button></div>${det}`);
}

function applyTheme() {
  const r = document.documentElement.style, s = S.set;
  for (const k of ['bg', 'fg', 'ac', 'rd', 'hd']) r.setProperty('--' + k, s[k]);
  r.setProperty('--rad', s.rad + 'px');
  r.setProperty('--ui', s.ui / 100);
  r.setProperty('--th', s.th + 'vh');
  r.setProperty('--tf', FONTS[s.tf] || 'inherit');
  r.setProperty('--tw', s.tw);
  r.setProperty('--sf', s.sfm ? FONTS.mono : 'inherit');
  document.body.classList.toggle('no-rs', !s.showRs);
  document.body.classList.toggle('no-st', !s.showSt);
  document.body.classList.toggle('no-side', !s.showSide);
  r.setProperty('--fs', s.fs + 'px');
  r.setProperty('--ss', s.ss + 'px');
  $('#scr').style.display = s.showScr ? '' : 'none';
}

let scr = '', mode = 'idle', holding = false, ready = false, ht, t0 = 0, i0 = 0, pen = 0, b8 = 0, b12 = 0;

const newScr = () => {
  scr = genScr(curCube());
  $('#scr').textContent = view ? '' : (scr || '(this cube has no scramble)');
};

function beep(f) {
  if (!S.set.snd) return;
  try {
    const c = new AudioContext(), o = c.createOscillator();
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = (S.set.vol ?? 60) / 100;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    setTimeout(() => { o.stop(); c.close(); }, 180);
  } catch (e) {}
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th'];

function rstrip(d) {
  const ix = d.solves.map((_, i) => i);
  let I = S.set.auto ? ix.filter(i => d.solves[i].r === d.round) : ix.slice(-5);
  if (S.set.auto && !I.length && d.round > 1) I = ix.filter(i => d.solves[i].r === d.round - 1);
  const L = I.map(i => d.solves[i]);
  let lo = -1, hi = -1;
  if (L.length > 1) {
    const v = L.map(val);
    hi = v.indexOf(Math.max(...v));
    lo = v.indexOf(Math.min(...v));
    if (lo === hi) lo = hi = -1;
  }
  $('#rs').innerHTML = ORD.map((o, i) => {
    const s = L[i], t = s ? fmtP(s) : '–';
    const w = L.length === 5 ? '(' + t + ')' : t;
    return `<div${s ? ` data-a="solve" data-i="${I[i]}" class="pick"` : ''}><small>${o} solve</small><b${i === lo ? ' class="g"' : i === hi ? ' class="r"' : ''}>${i === lo ? '+' + w : i === hi ? '-' + w : t}</b></div>`;
  }).join('');
}

function render() {
  $('#ev').textContent = name();
  const d = D(), [best, mean, cur, bao] = stats(arr(d.solves.map(val))),
        bx = (l, x) => `<div><small>${l}</small><b>${fx(x)}</b></div>`;
  rstrip(d);
  $('#st').innerHTML = bx('Best', best) + bx('Mean', mean) + bx('Current ao5', cur) + bx('Best ao5', bao) + `<div><small>Round</small><b>${S.set.auto ? d.round + ' · ' + d.solves.filter(x => x.r === d.round).length + '/5' : 'off'}</b></div>`;
  $('#cnt').textContent = name() + ' · ' + d.solves.length + ' solves today';
  $('#dt').textContent = (view ? new Date(view + 'T00:00:00') : new Date()).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $('#dt').classList.toggle('on', !!view);
  $('#goal').innerHTML = goalPanel();
  document.body.classList.toggle('view', !!view);
  const vb = $('#vb');
  vb.hidden = !view;
  if (view) {
    vb.innerHTML = `<span>Viewing <b>${new Date(view + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</b> · read-only</span><span class="sp"></span><button data-a="today">Back to today</button>`;
    tm.textContent = d.solves.length ? fmtS(d.solves[d.solves.length - 1]) : '–';
    $('#msg').textContent = 'Past day: you can look, but nothing can be changed.';
  }
  const rbest = minOf(d.rounds.map(r => r.res).filter(isFinite));
  $('#rd').innerHTML = [...d.rounds].reverse().map((r, i, a) => { const p = a[i + 1], dd = p && isFinite(r.res) && isFinite(p.res) ? r.res - p.res : null; return `<div><b>Round ${r.n}: ${fx(r.res)}${d.rounds.length > 1 && r.res === rbest ? ' ★' : ''}</b> (ao5)${dd === null ? '' : ` <span class="${dd <= 0 ? 'g' : 'r'}">${dd <= 0 ? '▼' : '▲'}${ds(dd)}</span>`} · ${r.v.join(', ')}</div>`; }).join('');
}

// Rebuild finished-round records from the solves, so deleting/restoring a time keeps them correct.
function fixRounds(d) {
  d.rounds = [];
  for (let n = 1; n < d.round; n++) {
    const rs = d.solves.filter(x => x.r === n);
    if (rs.length === 5) d.rounds.push({ n, res: ao5(arr(rs.map(val))), v: rs.map(fmtS) });
  }
}

let undoDel = null;

function delSolve(i) {
  if (view) return;
  const d = D(), s = d.solves[i];
  if (!s) return;
  d.solves.splice(i, 1);
  fixRounds(d);
  repb(S.cur);
  undoDel = { ev: S.cur, i, s };
  save();
  render();
  const l = d.solves[d.solves.length - 1];
  tm.textContent = l ? fmtS(l) : '0.00';
  $('#msg').innerHTML = `Deleted ${fmtS(s)} · <button data-a="undo">Undo</button>`;
}

function undoSolve() {
  if (!undoDel) return;
  const u = undoDel;
  undoDel = null;
  S.cur = u.ev;
  const d = D();
  d.solves.splice(Math.min(u.i, d.solves.length), 0, u.s);
  fixRounds(d);
  repb(S.cur);
  save();
  render();
  tm.textContent = fmtS(u.s);
  $('#msg').textContent = 'Time restored';
}

const focusUI = () => document.body.classList.toggle('run', S.set.focus && mode !== 'idle');

// ---- Reactions: cheers, comfort, streaks, goals, effects ----
const hist = id => Object.keys(S.hist || {}).sort().map(k => S.hist[k][id]).filter(Boolean),
      pastSolves = id => hist(id).flatMap(x => x.solves),
      pastRounds = id => hist(id).flatMap(x => x.rounds),
      allSolves = id => pastSolves(id).concat((S.data[id] || { solves: [] }).solves),
      todayCount = () => Object.values(S.data).reduce((a, x) => a + x.solves.length, 0),
      buzz = ms => { if (S.set.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };

// small helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      ds = ms => (Math.abs(ms) / 1000).toFixed(S.set.dec === 3 ? 3 : 2),
      plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's'),
      fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? ''),
      mn = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN,
      minOf = a => a.reduce((m, x) => x < m ? x : m, Infinity),
      maxOf = a => a.reduce((m, x) => x > m ? x : m, -Infinity),
      ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 >> 3 ^ 1) && n % 10 < 4 ? n % 10 : 0]),
      ago = ms => {
        const m = Math.round(ms / 6e4), h = Math.round(ms / 36e5), d = Math.round(ms / 864e5);
        return m < 2 ? 'about a minute' : m < 90 ? m + ' minutes' : h < 48 ? h + ' hours' : d < 60 ? d + ' days' : Math.round(d / 30) + ' months';
      };

// Trimmed averages like WCA: drop the best and worst 5% (at least one each). Too many DNFs = DNF.
const aoW = (w, n) => {
        const trim = Math.ceil(n * .05), a = Float64Array.from(w).sort();
        let dnf = 0;
        for (let i = n - 1; i >= 0 && a[i] === Infinity; i--) dnf++;
        if (dnf > trim) return Infinity;
        let sum = 0;
        for (let i = trim; i < n - trim; i++) sum += a[i];
        return sum / (n - 2 * trim);
      },
      aoN = (v, n) => v.length < n ? NaN : aoW(v.slice(-n), n),
      rollMin = (v, n) => { let b = Infinity; for (let i = n; i <= v.length; i++) { const x = aoW(v.slice(i - n, i), n); if (x < b) b = x; } return b; };

// Remembers the best average up to a point, so a long history is not rescanned on every solve.
let AOC = {};
function bestAoUpTo(id, v, k, upto) {
  const key = id + '|' + k, c = AOC[key] && AOC[key].n <= upto ? AOC[key] : { n: 0, b: Infinity };
  let b = c.b;
  for (let i = Math.max(c.n + 1, k); i <= upto; i++) { const x = aoW(v.slice(i - k, i), k); if (x < b) b = x; }
  AOC[key] = { n: upto, b };
  return b;
}

// Personal-best stars: rebuilt from the whole history, so deleting or editing a time keeps them correct.
function repb(id) {
  AOC = {};
  let b = Infinity, n = 0;
  for (const s of allSolves(id)) {
    const x = val(s);
    if (!isFinite(x)) { delete s.pb; continue; }
    if (n >= 5 && x < b) s.pb = 1; else delete s.pb;
    if (x < b) b = x;
    n++;
  }
}

function migrate() {
  S.rec = S.rec || {};
  S.rec.c = S.rec.c || {};
  AOC = {};
  if (!S.rec.v) { for (const c of allCubes()) repb(c.id); S.rec.v = 1; }
}

const recOf = id => { S.rec = S.rec || {}; S.rec.c = S.rec.c || {}; return S.rec.c[id] || (S.rec.c[id] = {}); };

// ---- Per-cube knowledge: sub-X targets, greetings, flavor lines and a tip for slow solves ----
const MILES = [1, 10, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000],
      DSM = [3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365],
      HRS = [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      BASE = {
        subs: [],
        hi: ["Let's go!", 'Ready when you are!', 'Time to turn some cubes!'],
        fl: ['Every solve builds your look-ahead and your fingers.', 'Practice like this is how times drop.', 'Showing up every day is what makes people fast.'],
        tip: ''
      },
      PROF = {
        '2': { subs: [15, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1], hi: ['Tiny cube, big speed!', "Let's twist!"], tip: 'On a 2x2 a slow solve usually means an awkward last layer. Spend a little more of your inspection planning the first layer.' },
        '3': { subs: [60, 45, 30, 25, 20, 18, 15, 13, 12, 11, 10, 9, 8, 7, 6, 5], hi: ['Time to turn some layers!', "Let's go!"], tip: 'A slow 3x3 solve is often one long pause. Next time notice where you stopped to think; that is the step to practice.' },
        oh: { subs: [90, 60, 45, 40, 35, 30, 25, 20, 18, 15, 12, 10], hi: ['One hand, full focus!', "Let's go, lefty or righty!"], tip: 'One-handed solves swing more than two-handed ones, mostly from regrips. Smooth, slow turns usually beat fast, jerky ones.' },
        '4': { subs: [240, 180, 150, 120, 100, 90, 80, 70, 60, 50, 45, 40, 35, 30], hi: ['Centers, edges, then the fun part!'], tip: 'On a 4x4 a slow solve is often a long edge-pairing stage or a parity case. Both vary a lot, so do not worry.' },
        '5': { subs: [360, 300, 240, 180, 150, 120, 100, 90, 80, 70, 60], hi: ['Big cube, big patience. Go!'], tip: 'Big cubes have many more places to lose time, so times swing more. Keep your turns smooth and your pairing steady.' },
        '6': { subs: [600, 480, 420, 360, 300, 240, 210, 180, 150, 120], hi: ['Big cube, big patience. Go!'], tip: 'A 6x6 solve has a lot of steps, so one slow stage is normal. Smooth turning matters more than speed.' },
        '7': { subs: [900, 720, 600, 480, 420, 360, 300, 240, 180], hi: ['Big cube, big patience. Go!'], tip: 'A 7x7 solve has a lot of steps, so one slow stage is normal. Smooth turning matters more than speed.' },
        pyra: { subs: [60, 40, 30, 20, 15, 12, 10, 8, 7, 6, 5, 4, 3], hi: ['Pyraminx time, sharp and quick!'], tip: 'Pyraminx times swing a lot because one awkward last-layer case can double the time.' },
        skewb: { subs: [60, 40, 30, 20, 15, 12, 10, 8, 7, 6, 5, 4, 3], hi: ['Skewb time, short and sharp!'], tip: 'Skewb solves are short, so one bad case stands out. Practice the rare cases to even it out.' },
        mega: { subs: [600, 480, 360, 300, 240, 180, 150, 120, 100, 90, 80, 70, 60, 50, 45, 40, 30], hi: ['Twelve faces, one calm mind!'], tip: 'Megaminx has many moves, so small pauses add up. Aim for a smooth, steady rhythm.' }
      },
      profile = c => ({ ...BASE, ...(PROF[c.id === 'oh' ? 'oh' : c.t] || {}) });

// ---- Message pools. {t} time, {cn} cube, {gap} seconds gained, {old} old record, {pct} percent, {dif} seconds off average, {avg} average, {off} seconds off PB, {best} PB ----
const PBL = {
  std: [
    `🎉 NEW PERSONAL BEST! {t} is {gap}s faster than your old record of {old}. Absolutely incredible!`,
    `🏆 {t}, THAT'S A PB! {gap}s quicker than ever before ({pct}% faster). Be so proud!`,
    `🔥 PERSONAL BEST!!! {t} on {cn}. All that practice just paid off, amazing!`,
    `⚡ New record: {t}! You just knocked {gap}s off your best. You are on fire!`
  ],
  big: [
    `🚀 HUGE PB! {t}! You smashed your old record of {old} by {gap}s ({pct}%). Unreal!`,
    `🤯 {t}?! That is a MASSIVE {gap}s improvement on your record. Take a bow!`,
    `💥 BOOM! {t}! Your old best of {old} just got crushed by {pct}%!`
  ],
  tiny: [
    `😮 NEW PB by just {gap}s: {t}! Every hundredth counts, and that one is yours!`,
    `✨ A razor-thin PB: {t}, only {gap}s faster than before. A record is a record! 🏆`
  ]
};

const SLOW = {
  vbad2: [
    [`Whoa, {t}?! That solve took a long vacation 🏖️😄 It happens to everyone. Shake it off, the next one is yours!`,
     `{t}… you and the cube clearly had a disagreement 😅 No problem! One wild solve does not erase all the fast ones.`,
     `That was a collector's edition solve ({t}) 🐢 Rare, funny, and already forgotten. Reset and go!`],
    [`{t} was a very tough one. It happens to every cuber, and one solve says nothing about how good you are. Breathe and go again 💙`,
     `A rough one, and that is completely okay. Your real progress shows in your averages, not in single solves 💙`]
  ],
  vbad: [
    [`Whoa, {t}?! That one took the scenic route 🐢😄 Don't worry, everyone has solves like this. Reset and crush the next one!`,
     `{t}… the cube said "not today" 😅 It's totally okay! One slow solve doesn't erase all your fast ones.`,
     `Plot twist: that solve was a speed-limit zone 🚧😂 Breathe, you are still improving, and the next one's yours!`,
     `{t}: the cube is just keeping you humble 😌 That was {dif}s over your average, nothing a fresh scramble can't fix!`],
    [`{t} was a tough one, {dif}s slower than your average of {avg}. It happens to every cuber, and one solve does not define you. Breathe and go again 💙`,
     `A slow one, and that is completely fine. Your real progress shows in the average 💙`,
     `That one fought back ({t}). Everyone has solves like this. Reset your hands and go again 💙`]
  ],
  bad2: [
    [`{t} is {dif}s slower than your average of {avg}. Totally normal! Breathe and go again 💙`,
     `A slower one ({t}). Your average of {avg} is the real story, so keep going 💪`,
     `Not your best, but even the best cubers have off solves. Fresh scramble, fresh start 💙`]
  ],
  bad1: [
    [`A bit slower than your usual ({dif}s over your {avg} average). Totally normal! Breathe and go again 💙`,
     `Not your fastest, but your average of {avg} is the real story. Keep going!`,
     `Everybody has slower solves. Shake it off, the next scramble is fresh 💪`]
  ]
};

const GOOD = {
  near: [
    `So close! {t} is only {off}s off your PB of {best} 😮 The next one could be the one!`,
    `⚡ {t}, just {off}s away from your record! Keep this energy.`,
    `Almost a PB! Only {off}s from {best}. You are right at the edge 🔥`
  ],
  good3: [
    `🚀 Wow, {t} is way faster than usual, {dif}s under your {avg} average!`,
    `🔥 That was a fast one! {dif}s quicker than your average. Are you warmed up?`
  ],
  good2: [
    `Faster than your usual! 🔥 {t} beats your {avg} average by {dif}s.`,
    `⚡ Quick! {dif}s under your average of {avg}.`
  ],
  good1: [
    `Nice one, {t} is under your average ⚡ ({dif}s faster).`,
    `Smooth! That one was quicker than normal 👏`,
    `Faster than your usual, keep it rolling 🔥`
  ],
  ok: ['Solid solve. 👍', 'Nice and steady.', 'Clean solve, keep the rhythm.', 'Saved. Next scramble when you are ready.']
};

const DNFL = {
  fun: ['DNF 😬 The cube won that round. It happens to everybody, so shake it off and go again!', 'A DNF! Even world record holders get them. Onto the next one 💪', 'The cube said no. Fair enough. Next scramble, fresh start! 🧊'],
  kind: ['A DNF happens to every cuber. It is only one solve. Breathe and go again 💙', 'Not this one, but the next could be a great one. You are doing fine 💙', 'That one did not count, but you lost nothing. Reset when you are ready 💙'],
  two: [`Two DNFs in a row 😬 Take a breath, shake out your hands and reset. The next one is a fresh start!`, `Two in a row is rough, but it is just a bad patch. Shake out your hands, breathe, and go again 💙`],
  insp: '⏱️ Inspection ran past 17 s, which is an automatic DNF by the rules. Next time aim to start around 12 to 13 s; that leaves a calm buffer and no penalty.',
  tip: 'Tip: before you stop the timer, take half a second to check that every face is solved.'
};

// ---- Sounds and effects ----
function jingle(notes, step = 0.11, len = 0.16) {
  const vol = (S.set.vol ?? 60) / 100 * 0.6;
  if (!S.set.sfx || vol <= 0) return;
  try {
    const c = new AudioContext();
    notes.forEach((n, i) => {
      const fs = [].concat(n), t = c.currentTime + i * step;
      fs.forEach(f => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(vol / Math.sqrt(fs.length), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(g);
        g.connect(c.destination);
        o.start(t);
        o.stop(t + len + 0.02);
      });
    });
    setTimeout(() => c.close(), (notes.length * step + len + 0.3) * 1000);
  } catch (e) {}
}

// mode 'c' = burst from the middle, 'lr' = two cannons from the lower corners
function confetti(n = 150, mode = 'c') {
  if (!S.set.fx || n <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight, cv = document.createElement('canvas'), x = cv.getContext('2d'),
        cols = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6', '#ff9f43', '#ff6b9d'];
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99';
  cv.setAttribute('aria-hidden', 'true');
  cv.width = W * dpr;
  cv.height = H * dpr;
  x.scale(dpr, dpr);
  document.documentElement.appendChild(cv);
  const mk = (ox, oy, ang, spread) => {
    const a = ang + (Math.random() - .5) * spread, sp = 7 + Math.random() * 13;
    return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: 6 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .5, c: pk(cols), k: R(3) };
  };
  const P = Array.from({ length: n }, (_, i) => mode === 'lr'
    ? (i % 2 ? mk(W, H * .85, -Math.PI * .72, .8) : mk(0, H * .85, -Math.PI * .28, .8))
    : mk(W / 2 + (Math.random() - .5) * 240, H * .45, -Math.PI / 2, Math.PI * 1.1));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, W, H);
    x.globalAlpha = f > 100 ? Math.max(0, (140 - f) / 40) : 1;
    P.forEach(p => {
      p.vx *= .995;
      p.vy = p.vy * .995 + .35;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      x.save();
      x.translate(p.x, p.y);
      x.rotate(p.r);
      x.fillStyle = p.c;
      if (p.k === 1) { x.beginPath(); x.arc(0, 0, p.s / 2.2, 0, 7); x.fill(); }
      else if (p.k === 2) x.fillRect(-p.s, -1.5, p.s * 2, 3);
      else x.fillRect(-p.s / 2, -p.s / 3, p.s, p.s / 1.5);
      x.restore();
    });
    if (++f < 140) requestAnimationFrame(step); else cv.remove();
  })();
}

function flash(el, cls, ms) {
  if (!el || !S.set.fx) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// kind: pb, milestone, goal, good, bad, vbad, dnf. x.big = a huge PB or a first sub-X. Strength setting scales the confetti.
function celebrate(kind, x = {}) {
  const k = (S.set.fxi ?? 2) / 2, big = !!x.big, tz = $('#tz');
  if (kind === 'pb') {
    confetti(Math.round((big ? 220 : 130) * k), big ? 'lr' : 'c');
    if (big) setTimeout(() => confetti(Math.round(110 * k), 'c'), 650);
    jingle(big ? [523, 659, 784, [1047, 523], 1319, [1568, 784, 392]] : [523, 659, 784, 1047, 1319], big ? 0.11 : 0.1, 0.24);
    buzz(big ? [60, 40, 60, 40, 60, 40, 220] : [60, 40, 60, 40, 140]);
    flash(tm, 'pbflash', 1600);
    flash(tz, 'pbglow', 1900);
  } else if (kind === 'milestone') {
    confetti(Math.round(110 * k), 'c');
    jingle([659, 784, 988, 1319], 0.1, 0.2);
    buzz([40, 30, 40, 30, 120]);
    flash(tz, 'cheer', 1500);
  } else if (kind === 'goal') {
    confetti(Math.round(150 * k), 'lr');
    jingle([523, 659, 784, 1047, 784, 1047], 0.1, 0.2);
    buzz([50, 30, 50, 30, 150]);
    flash(tz, 'cheer', 1500);
    flash($('#goal'), 'flash', 1500);
  } else if (kind === 'good') {
    jingle(x.fast >= 3 ? [659, 784, 988].slice(0, Math.min(3, x.fast - 1)).concat(1175) : [659, 784], 0.09, 0.14);
    buzz(25);
  } else if (kind === 'bad') {
    jingle([392, 330], 0.14, 0.22);
    buzz(60);
  } else if (kind === 'vbad') {
    jingle(S.set.tone === 'fun' ? [392, 349, 311, 262] : [392, 349], 0.16, 0.26);
    buzz(80);
  } else if (kind === 'dnf') {
    jingle([330, 262], 0.15, 0.25);
    buzz(100);
  }
}

const rk = k => ({ pb: 5, milestone: 4, goal: 3 }[k] || 0),
      bump = (x, k) => { if (rk(k) > rk(x.kind)) x.kind = k; };

// Daily goal: quarter, half, three quarters, one to go, reached, and bonus solves after that.
function goalEvent(x, after, best) {
  const g = S.set.goal;
  if (!g) return;
  const m = {};
  if (g >= 8) m[Math.ceil(g * .25)] = ['goalp', `📈 A quarter of the way to your daily goal (${after}/${g}). Nice start!`];
  m[Math.ceil(g * .5)] = ['goalp', `📈 Halfway to your daily goal (${after}/${g}). Keep the rhythm!`];
  m[Math.ceil(g * .75)] = ['goalp', `📈 Three quarters done (${after}/${g}). The finish line is in sight!`];
  if (g >= 4) m[g - 1] = ['goalp', `🎯 One more solve to hit your daily goal!`];
  m[g] = ['goal', `🎯 DAILY GOAL REACHED: ${g} solves today!${isFinite(best) ? ` Best of today so far: ${fx(best)}.` : ''} Great work!`];
  let hit = m[after];
  if (after > g && after % g === 0) hit = ['goal', `🌟 ${after / g}× your daily goal (${after} solves)! Bonus territory!`];
  else if (after > g && (after - g) % 10 === 0 && !hit) hit = ['goalp', `💪 ${after - g} bonus solves past your goal.`];
  if (hit) {
    x.events.push({ k: hit[0], text: hit[1] });
    if (hit[0] === 'goal') bump(x, 'goal');
  }
}

// Looks at one new solve (before it is stored) and builds the whole reaction: headline, number chips, events and tips.
function react(s, why) {
  S.rec = S.rec || {};
  const cube = curCube(), P = profile(cube), cn = esc(cube.n), e = D(), tone = S.set.tone, fun = tone === 'fun',
        prior = allSolves(S.cur), pv = prior.map(val), fin = pv.filter(isFinite), v = val(s), ok = isFinite(v), t = fmtS(s),
        prevBest = minOf(fin), isPB = ok && fin.length >= 5 && v < prevBest,
        recent = fin.slice(-12), base = recent.length >= 5 ? mn(recent) : 0,
        r = base && ok ? v / base : 0, diff = r ? v - base : 0, n = prior.length + 1, nt = e.solves.length + 1,
        tv = e.solves.map(val).filter(isFinite), dayFirst = todayCount() === 0,
        x = { head: '', hk: 'ok', kind: 'ok', chips: [], events: [], pre: [], tip: '', pb: isPB, big: false, fast: 0 };
  if (isPB) s.pb = 1;
  if (tone === 'off') { x.head = isPB ? 'New personal best!' : 'Solve saved'; x.hk = x.kind = ''; return x; }

  if (isPB) {
    // ---- a new personal best ----
    const g = prevBest - v, gap = ds(g), pct = (g / prevBest * 100).toFixed(1), o = { t, cn, gap, pct, old: fx(prevBest) },
          tier = g >= 1000 || g / prevBest >= .04 ? 'big' : g < 100 ? 'tiny' : 'std',
          sub = P.subs.filter(y => v < y * 1000 && prevBest >= y * 1000).pop(), nxt = P.subs.find(y => v >= y * 1000),
          last = prior[prior.length - 1], k = e.solves.filter(y => y.pb).length + 1, held = [...prior].reverse().find(y => val(y) === prevBest);
    x.hk = x.kind = 'pb';
    x.big = tier === 'big' || !!sub;
    x.head = fill(pk(PBL[tier]), o) + (last && last.pb ? ' Back-to-back PBs!! 🙌' : '') + (sub ? ` 🥇 That is your FIRST sub-${sub} on ${cn}!` : '');
    x.chips.push(`old record ${fx(prevBest)}`, `−${gap}s (${pct}% faster)`);
    if (held && held.d) x.chips.push(`old PB stood for ${ago(Date.now() - held.d)}`);
    if (k > 1) x.chips.push(`PB #${k} today`);
    x.chips.push(`solve #${n}`);
    if (nxt) x.chips.push(`next goal: sub-${nxt} (${ds(Math.max(v - nxt * 1000, 10))}s to go)`);
  } else if (!ok) {
    // ---- a DNF ----
    const dn = e.solves.filter(y => y.p === 'D').length + 1, rate = Math.round(dn / nt * 100), had = prior.some(y => y.p === 'D'),
          two = prior.length && prior[prior.length - 1].p === 'D';
    let clean = 0;
    for (let i = prior.length - 1; i >= 0 && prior[i].p !== 'D'; i--) clean++;
    x.hk = x.kind = 'dnf';
    x.head = why === 'insp' ? DNFL.insp : two ? pk(DNFL.two.slice(fun ? 0 : 1, fun ? 1 : 2)) : pk(fun ? DNFL.fun : DNFL.kind);
    x.chips.push(`DNFs today: ${dn} of ${nt} (${rate}%)`);
    if (prior.length && !had) x.chips.push(`first DNF in ${plural(clean, 'solve')}`);
    else if (clean >= 10) x.chips.push(`clean streak of ${clean} solves ended`);
    if (why !== 'insp') x.tip = DNFL.tip;
  } else {
    // ---- a normal finished solve: compare it with the recent average ----
    const rel = !r ? '' : Math.abs(diff) < 50 ? 'right on your average' : `${ds(diff)}s ${diff < 0 ? 'faster' : 'slower'} than your average`,
          o = { t, cn, dif: ds(diff), avg: fx(base), off: ds(v - prevBest), best: fx(prevBest) },
          rank = tv.filter(y => y < v).length + 1, pct = fin.length >= 20 ? Math.round(fin.filter(y => y > v).length / fin.length * 100) : -1,
          seq = pv.slice(-20).concat(v), near = fin.length >= 10 && v <= prevBest * 1.03, say = a => fill(pk(a), o), tm2 = mn(tv.concat(v));
    let slow = 0, fast = 0;
    if (base) {
      for (let i = seq.length - 1; i >= 0 && seq[i] > base * 1.1; i--) slow++;
      for (let i = seq.length - 1; i >= 0 && seq[i] < base; i--) fast++;
    }
    x.fast = fast;
    if (r >= 1.2) {
      const tier = r >= 2.5 ? 'vbad2' : r >= 1.6 ? 'vbad' : r >= 1.4 ? 'bad2' : 'bad1', pool = SLOW[tier];
      x.hk = x.kind = tier.startsWith('vbad') ? 'vbad' : 'bad';
      x.head = say(pool[fun ? 0 : Math.min(1, pool.length - 1)]);
      if (tv.length >= 7 && slow < 2 && v > maxOf(tv)) x.head += fun ? ' That is your slowest of today, so from here every solve is an upgrade 😄' : ' It is just the slowest one of today. The rest of your session has been solid 💙';
      if (x.kind === 'vbad' || slow >= 2) x.tip = P.tip;
    } else if (near) {
      x.hk = x.kind = 'good';
      x.head = say(GOOD.near);
    } else if (r && r <= .9) {
      x.hk = x.kind = 'good';
      x.head = say(GOOD[r <= .7 ? 'good3' : r <= .8 ? 'good2' : 'good1']);
    } else {
      x.head = pk(GOOD.ok) + (rel ? ` It was ${rel}.` : '');
    }
    const slowOne = r >= 1.2;
    if (s.p === 2) x.chips.push('includes +2 (inspection past 15 s)');
    if (base) x.chips.push(`${diff < 0 ? '−' : '+'}${ds(diff)}s vs avg of last ${recent.length} (${fx(base)})`);
    else x.chips.push(`averages and PBs unlock after 5 solves (${Math.min(5, fin.length + 1)}/5)`);
    if (slowOne) {
      // for a slow solve show the bigger picture, not a scoreboard
      if (tv.length) x.chips.push(`best of today ${fx(minOf(tv))}`);
      x.chips.push(`overall mean ${fx(mn(fin))}`);
    } else {
      if (isFinite(prevBest) && fin.length >= 5) x.chips.push(`${ds(v - prevBest)}s off your PB (${fx(prevBest)})`);
      if (tv.length >= 2) x.chips.push(`#${rank} of ${tv.length + 1} today`);
      if (pct >= 50) x.chips.push(`faster than ${pct}% of your ${fin.length} solves`);
    }
    if (tv.length >= 2) x.chips.push(`today's mean ${fx(tm2)}`);
    x.chips = x.chips.slice(0, 5);

    // streaks, comebacks and a gentle nudge to rest
    const rc = recOf(S.cur), prev = pv[pv.length - 1];
    if (fast >= 3) {
      let tx = `${fast >= 10 ? '🔥🔥🔥' : fast >= 5 ? '🔥🔥' : '🔥'} ${fast} in a row faster than your average!`;
      if (fast > (rc.streak || 0)) {
        if ((rc.streak || 0) >= 3) tx += ` New personal streak record (the old one was ${rc.streak})!`;
        rc.streak = fast;
      }
      x.events.push({ k: 'streak', text: tx });
    } else if (prev && isFinite(prev) && base && prev / base >= 1.2 && r <= .95) {
      x.events.push({ k: 'streak', text: `Bounce-back! 💪 From ${fx(prev)} to ${t}, that is ${ds(prev - v)}s better.` });
    }
    if (S.set.brk && (slow === 3 || slow === 6)) x.events.push({ k: 'tip', text: `☕ ${plural(slow, 'slower solve')} in a row. That is usually tired hands or a rushed pace. A minute off the cube and a quick stretch often resets it.` });
  }

  // ---- opening line: greeting on the first solve of the day, a note on the first solve of each cube ----
  if (dayFirst) {
    const hr = new Date().getHours(), dsn = streak() + 1, y = new Date(),
          ysum = (y.setDate(y.getDate() - 1), Object.values(dayData(dkey(y))).reduce((a, z) => a + z.solves.length, 0)),
          last = Object.keys(S.hist).filter(k => k < S.day && Object.values(S.hist[k]).some(z => z.solves.length)).sort().pop(),
          away = last ? Math.round((new Date(S.day) - new Date(last)) / 864e5) : 0, rc = S.rec.days || 0;
    x.pre.push(hr < 5 ? 'Burning the midnight oil? 🌙' : hr < 12 ? 'Good morning! ☀️' : hr < 17 ? 'Good afternoon! 🌤️' : hr < 22 ? 'Good evening! 🌆' : 'Late-night session! 🌙', pk(P.hi));
    if (away >= 3) x.pre.splice(1, 0, `Welcome back, it has been ${away} days`);
    if (dsn >= 2) x.pre.push(`🔥 Day ${dsn} of your streak`);
    if (ysum) x.pre.push(`Yesterday: ${plural(ysum, 'solve')}`);
    if (dsn > rc) S.rec.days = dsn;
    if (DSM.includes(dsn)) {
      x.events.push({ k: 'milestone', text: `🔥 ${dsn}-day streak! ${dsn} days in a row of cubing.${dsn > rc && rc >= 2 ? ' That is your longest streak yet!' : ''}` });
      bump(x, 'milestone');
    }
  } else if (nt === 1) {
    x.pre.push(`First ${cn} solve today. ${pk(P.hi)}`);
  }

  // ---- milestones: solve count, hours spent ----
  const fin2 = ok ? fin.concat(v) : fin;
  if (MILES.includes(n)) {
    let tx = n === 1 ? `👋 That was your very first ${cn} solve here. Welcome, and have fun!` : `🎖️ That was your ${ord(n)} ${cn} solve! ${pk(P.fl)}`;
    if (n >= 50 && fin2.length >= 50) {
      const a = mn(fin2.slice(0, 25)), b = mn(fin2.slice(-25));
      tx += a - b > 500 ? ` Your latest 25 average ${fx(b)}, which is ${ds(a - b)}s faster than your first 25 (${fx(a)}). Real progress!` : ` Your first 25 averaged ${fx(a)} and your latest 25 average ${fx(b)}. Keep building!`;
    } else if (n >= 10 && fin2.length) tx += ` Mean of all of them: ${fx(mn(fin2))}.`;
    x.events.push({ k: 'milestone', text: tx });
    bump(x, 'milestone');
  }
  const before = prior.reduce((a, y) => a + (y.t || 0), 0), hh = HRS.find(h => before < h * 36e5 && before + (s.t || 0) >= h * 36e5);
  if (hh) {
    x.events.push({ k: 'milestone', text: `⏱️ You have now spent ${plural(hh, 'hour')} solving ${cn}!` });
    bump(x, 'milestone');
  }

  goalEvent(x, todayCount() + 1, minOf(ok ? tv.concat(v) : tv));
  return x;
}

// Draws a reaction: opening line, headline, number chips, events and a tip. "Short" detail keeps only the headline and events.
function rx(x) {
  const full = S.set.det !== 'short';
  if (!x.head && !x.events.length) return '';
  let h = '<div class="rx">';
  if (x.pre.length) h += `<div class="rx-g">${x.pre.slice(0, full ? 5 : 1).join(' · ')}</div>`;
  h += `<div class="rx-h ${x.hk}">${x.head}</div>`;
  if (full && x.chips.length) h += `<div class="rx-c">${x.chips.map(c => `<span>${c}</span>`).join('')}</div>`;
  h += x.events.map(ev => `<div class="rx-e ${ev.k}">${ev.text}</div>`).join('');
  if (full && x.tip) h += `<div class="rx-t">${x.tip}</div>`;
  return h + '</div>';
}

const streak = () => {
  const days = new Set(Object.keys(S.hist || {}).filter(k => Object.values(S.hist[k]).some(x => x.solves.length)));
  if (todayCount()) days.add(S.day || dkey(Date.now()));
  let n = 0;
  const d = new Date();
  if (!days.has(dkey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dkey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
};

// Right column: daily goal, day streak, last 7 days, and a few numbers for today's session.
function goalPanel() {
  const gl = S.set.goal, key = view || S.day || dkey(Date.now()), cnt = k => Object.values(dayData(k)).reduce((a, y) => a + y.solves.length, 0),
        gc = cnt(key), sk = view ? 0 : streak(), bestSk = Math.max(S.rec ? S.rec.days || 0 : 0, sk), pc = gl ? Math.min(100, Math.round(gc / gl * 100)) : 0;
  let h = '';
  if (gl) h += `<small>Daily goal</small><div class="gbar"><i style="width:${pc}%"></i></div><small>${gc} / ${gl} solves${view ? '' : ' today'} · ${pc}%${gc >= gl ? ' ✓' : ` · ${gl - gc} to go`}${gc > gl ? ` (+${gc - gl} bonus)` : ''}</small>`;
  if (sk > 1) h += `<div class="sk">🔥 ${sk}-day streak${bestSk > sk ? ` <small>(best ${bestSk})</small>` : ''}</div>`;
  const days = [], b0 = new Date(key + 'T00:00:00');
  for (let i = 6; i >= 0; i--) {
    const d = new Date(b0);
    d.setDate(d.getDate() - i);
    const k = dkey(d);
    days.push({ k, c: cnt(k), w: 'SMTWTFS'[d.getDay()] });
  }
  if (days.some(y => y.c)) {
    const mx = Math.max(gl || 0, ...days.map(y => y.c), 1);
    h += `<div class="wk">${days.map(y => `<div class="${gl && y.c >= gl ? 'ok' : ''}${y.k === key ? ' td' : ''}" title="${y.k}: ${plural(y.c, 'solve')}"><span class="bar"><i style="height:${Math.round(y.c / mx * 100)}%"></i></span><small>${y.w}</small></div>`).join('')}</div>`;
  }
  const L = D().solves;
  if (L.length) {
    const tt = L.reduce((a, y) => a + (y.t || 0), 0), span = L[L.length - 1].d - L[0].d, pace = span >= 3e5 ? Math.round((L.length - 1) / (span / 36e5)) : 0;
    h += `<div class="tsum"><div><small>PBs ★</small><b>${L.filter(y => y.pb).length}</b></div><div><small>DNFs</small><b>${L.filter(y => y.p === 'D').length}</b></div><div><small>Solving time</small><b>${dur(tt)}</b></div><div><small>Solves/hour</small><b>${pace || '–'}</b></div></div>`;
  }
  return h;
}

// Detail lines for one solve in its popup: PB, rank that day, percentile, penalties.
function solveInfo(s) {
  const L = D().solves, v = val(s), dv = L.map(val).filter(isFinite), line = t => `<div class="dtl">${t}</div>`;
  let h = '';
  if (s.pb) {
    let b = Infinity;
    for (const y of allSolves(S.cur)) { if (y === s) break; b = Math.min(b, val(y)); }
    h += line(`★ Personal best${isFinite(b) ? ` · beat the old record of ${fx(b)} by ${ds(b - v)}s` : ''}`);
  }
  if (isFinite(v) && dv.length) {
    const m = mn(dv), fin = allSolves(S.cur).map(val).filter(isFinite);
    h += line(`Rank ${dv.filter(y => y < v).length + 1} of ${dv.length} that day · ${ds(v - m)}s ${v < m ? 'faster' : 'slower'} than that day's mean (${fx(m)})`);
    if (fin.length >= 20) h += line(`Faster than ${Math.round(fin.filter(y => y > v).length / fin.length * 100)}% of all ${fin.length} ${esc(name())} solves`);
  }
  if (s.p === 2) h += line('Includes +2 (inspection past 15 s or a judge penalty)');
  if (s.r) h += line('Round ' + s.r);
  return h;
}

// Records window: best single and averages, totals, streaks, sub-X badges and the last personal bests.
function records() {
  const c = curCube(), P = profile(c), L = allSolves(c.id), v = L.map(val), fin = v.filter(isFinite), fm = x => isFinite(x) ? fx(x) : '–',
        tile = (l, x, sub) => `<div><small>${l}</small><b>${x}</b>${sub ? `<small>${sub}</small>` : ''}</div>`,
        dt = s => s && s.d ? new Date(s.d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  if (!L.length) { open(`<h3>Records · ${esc(c.n)}</h3><p class="lead">No solves yet on this cube. Records appear as soon as you start solving.</p>`); return; }
  const best = minOf(fin), bs = L.find(s => val(s) === best), tot = L.reduce((a, s) => a + (s.t || 0), 0), dn = L.filter(s => s.p === 'D').length,
        perDay = Object.keys(S.hist).sort().map(k => (S.hist[k][c.id] || { solves: [] }).solves.length).concat((S.data[c.id] || { solves: [] }).solves.length).filter(Boolean),
        sk = streak(), prog = fin.length >= 50 ? mn(fin.slice(0, 25)) - mn(fin.slice(-25)) : NaN, nxt = P.subs.find(x => best >= x * 1000);
  let b = Infinity;
  const pbs = [];
  for (const s of L) { const q = val(s); if (!isFinite(q)) continue; if (s.pb) pbs.push({ s, g: b - q }); if (q < b) b = q; }
  open(`<h3>Records · ${esc(c.n)}</h3>
<div class="dtiles">${tile('Best single', fm(best), dt(bs))}${tile('Best ao5', fm(rollMin(v, 5)))}${tile('Best ao12', fm(rollMin(v, 12)))}${tile('Best ao100', fm(rollMin(v, 100)))}${tile('Mean', fm(mn(fin)))}${tile('Solves', L.length, dn ? plural(dn, 'DNF') : '')}${tile('Solving time', dur(tot))}${tile('Days cubed', perDay.length, 'best day: ' + Math.max(0, ...perDay))}${tile('PBs ★', L.filter(s => s.pb).length)}${tile('Best streak', (recOf(c.id).streak || 0) + ' fast', 'in a row under average')}${tile('Day streak', sk, 'best ' + Math.max(S.rec.days || 0, sk))}${isNaN(prog) ? '' : tile('Progress', (prog >= 0 ? '−' : '+') + ds(prog) + 's', 'first 25 vs latest 25')}</div>
${P.subs.length && isFinite(best) ? `<h4>Sub-X targets</h4><div class="chips">${P.subs.map(x => best < x * 1000 ? `<span class="ok">sub-${x} ✓</span>` : x === nxt ? `<span class="nx">🎯 sub-${x}: ${ds(Math.max(best - x * 1000, 10))}s to go</span>` : `<span class="lk">sub-${x}</span>`).join('')}</div>` : ''}
<h4>Latest personal bests</h4>${pbs.length ? pbs.slice(-10).reverse().map(p => `<div class="dsum"><b>★ ${fmtS(p.s)}</b> <span class="dtl">${dt(p.s)}${isFinite(p.g) ? ` · ${ds(p.g)}s faster than the previous best` : ''}</span></div>`).join('') : '<p class="lead">No personal bests yet. They start counting after 5 solves.</p>'}`);
}

function add(t, p, why) {
  undoDel = null;
  rollover();
  const e = D(), s = { t, p, s: scr, d: Date.now(), r: S.set.auto ? e.round : 0 }, x = react(s, why), off = S.set.tone === 'off';
  e.solves.push(s);
  tm.textContent = fmtS(s);
  focusUI();
  if (S.set.auto) {
    const rs = e.solves.filter(y => y.r === e.round);
    if (rs.length >= 5) {
      const vs = rs.map(val), res = ao5(arr(vs)), old = pastRounds(S.cur).concat(e.rounds).map(y => y.res).filter(isFinite),
            ob = minOf(old), prv = old[old.length - 1], rn = e.round, sv = [...vs].sort((a, b) => a === b ? 0 : a - b),
            dropped = `${fx(sv[0])} and ${fx(sv[4])} dropped`, nb = isFinite(res) && old.length > 0 && res < ob && !off;
      e.rounds.push({ n: rn, res, v: rs.map(fmtS) });
      let tx;
      if (!isFinite(res)) tx = `🧩 Round ${rn} finished as a DNF (two or more DNFs).`;
      else if (nb) {
        tx = `🏆 NEW BEST AO5! Round ${rn}: ${fx(res)} beats your old best of ${fx(ob)} by ${ds(ob - res)}s. Congratulations! (${dropped})`;
        bump(x, 'pb');
      } else {
        tx = `✅ Round ${rn} done · ao5 ${fx(res)} (${dropped}).`;
        if (isFinite(prv)) tx += ` ${ds(res - prv)}s ${res < prv ? 'faster' : 'slower'} than your previous round.`;
        if (isFinite(ob) && res > ob && prv !== ob) tx += ` ${ds(res - ob)}s off your best ao5 (${fx(ob)}).`;
      }
      x.events.push({ k: nb ? 'pb' : 'round', text: tx + ` Round ${rn + 1} starts now.` });
      e.round++;
    }
  }
  if (!off) {
    // rolling averages over the whole history
    const av = allSolves(S.cur).map(val);
    for (const k of [12, 100]) {
      if (av.length < k) continue;
      const cur = aoN(av, k);
      if (!isFinite(cur)) continue;
      if (av.length === k) { x.events.push({ k: 'round', text: `📊 Your first ao${k} is complete: ${fx(cur)}!` }); continue; }
      const old = bestAoUpTo(S.cur, av, k, av.length - 1);
      if (isFinite(old) && cur < old) {
        x.events.push({ k: 'pb', text: `🏆 NEW BEST AO${k}! ${fx(cur)} beats your old best of ${fx(old)} by ${ds(old - cur)}s.` });
        bump(x, 'pb');
      }
    }
  }
  $('#msg').innerHTML = rx(x);
  celebrate(x.kind, x);
  save();
  newScr();
  render();
}

function tick() {
  focusUI();
  if (mode === 'run') {
    tm.textContent = S.set.hide ? '…' : S.set.secs ? F(performance.now() - t0, 2).split('.')[0] : F(performance.now() - t0, S.set.dec);
  } else if (mode === 'insp') {
    const e = (performance.now() - i0) / 1000;
    if (e >= 8 && !b8) { b8 = 1; beep(600); }
    if (e >= 12 && !b12) { b12 = 1; beep(900); }
    if (insp(e) < 0) {
      mode = 'idle';
      tm.className = '';
      $('#msg').textContent = 'Inspection over 17 s: DNF';
      add(0, 'D', 'insp');
      return;
    }
    tm.textContent = insp_text(e);
  } else {
    return;
  }
  requestAnimationFrame(tick);
}

function down() {
  if (view) return;
  if (mode === 'run') {
    const t = performance.now() - t0;
    mode = 'idle';
    tm.className = '';
    add(t, pen);
    return;
  }
  holding = true;
  ready = false;
  const need = mode === 'insp' || !S.set.insp;
  if (need) tm.className = 'hold';
  ht = setTimeout(() => {
    if (holding && need) {
      ready = true;
      tm.className = 'ready';
      if (S.set.rdy) jingle([880], 0.1, 0.07);
      buzz(15);
    }
  }, S.set.hold);
}

function up() {
  if (!holding) return;
  holding = false;
  clearTimeout(ht);
  if (mode === 'idle' && S.set.insp) {
    mode = 'insp';
    i0 = performance.now();
    b8 = b12 = 0;
    pen = 0;
    tm.className = 'insp';
    $('#msg').textContent = 'Inspection: hold and release to start';
    tick();
  } else if (ready) {
    pen = mode === 'insp' ? Math.max(0, insp((performance.now() - i0) / 1000)) : 0;
    mode = 'run';
    t0 = performance.now();
    tm.className = '';
    $('#msg').textContent = pen ? '+2 penalty (inspection over 15 s)' : '';
    tick();
  } else {
    tm.className = mode === 'insp' ? 'insp' : '';
  }
  ready = false;
}

document.addEventListener('keydown', e => {
  if (dl.open) return;
  if (e.code === 'Escape' && mode === 'insp') {
    mode = 'idle';
    tm.className = '';
    tm.textContent = '0.00';
    focusUI();
    return;
  }
  if (mode === 'idle' && !view && D().solves.length && !e.ctrlKey && !e.metaKey) {
    const L = D().solves, s = L[L.length - 1];
    let h = 1;
    if (e.key === 'Backspace' || e.key === 'Delete') L.pop();
    else if (e.key === '2') s.p = s.p === 2 ? 0 : 2;
    else if (e.key === 'd' || e.key === 'D') s.p = s.p === 'D' ? 0 : 'D';
    else h = 0;
    if (h) {
      repb(S.cur);
      save();
      render();
      const l = L[L.length - 1];
      tm.textContent = l ? fmtS(l) : '0.00';
      return;
    }
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) down();
  } else if (mode === 'run') {
    down();
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!dl.open) up();
  }
});

document.addEventListener('pointerdown', e => {
  if (dl.open) return;
  if (mode === 'run') { down(); return; }
  if (e.target.closest('#tz') && !e.target.closest('button')) down();
});

['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, () => { if (!dl.open) up(); }));

const open = h => {
  dl.innerHTML = '<div class="dc"><button data-a="close" class="x" aria-label="Close" title="Close">&times;</button>' + h + '</div>';
  if (!dl.open) dl.showModal();
};

const RULES = [
  ['a', 'New scramble for every attempt (Rust generates it).'],
  ['a', '15 s inspection with beeps at 8 s and 12 s (can be turned off).'],
  ['a', 'Hold, wait for green, release to start. Any key or tap stops.'],
  ['a', 'Start between 15 and 17 s = +2. Past 17 s = DNF.'],
  ['a', 'Manual +2 and DNF buttons on every solve for judge penalties.'],
  ['a', 'Ao5: best and worst dropped, two or more DNFs = DNF. Times are truncated, not rounded.'],
  ['h', '3x3 OH: solve and inspect with one hand only.'],
  ['h', 'Scrambles are random-move, not the official random-state scrambler.']
];

function cubePicker() {
  const one = c => `<span class="cb"><button data-a="cube" data-i="${c.id}" class="${c.id === S.cur ? 'on' : ''}">${c.n}</button>${c.meth ? '' : `<button data-a="rmcube" data-i="${c.id}" class="rm" title="Remove">&times;</button>`}</span>`;
  open(`<h3>Choose a cube</h3><div class="cubes">${allCubes().map(one).join('')}</div><h4>Add your own cube</h4><div class="add"><input id="cn" placeholder="Name (e.g. Mirror cube)" maxlength="24"><select id="ct">${CTYPES.map(x => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select><button data-a="addcube">Add</button></div><p class="lead">Pick which scramble it uses. Custom cubes get their own times and a notes page under Methods.</p>`);
}

function settings() {
  const s = S.set,
        c = (k, l) => `<label class="set">${l}<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`,
        r = (k, l, a, b, st) => `<label class="set">${l}: <span id="v_${k}">${s[k]}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${s[k]}"></label>`,
        col = (k, l) => `<label class="set">${l}<input type="color" data-k="${k}" value="${s[k]}"></label>`,
        sl = (k, l, o) => `<label class="set">${l}<select data-k="${k}">${o.map(x => `<option value="${x[0]}" ${s[k] == x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label>`;
  open(`<h3>Settings</h3>
<h4>Theme and colors</h4>${sl('theme', 'Theme', [['dark', 'dark'], ['light', 'light'], ['custom', 'custom']])}${col('bg', 'Background')}${col('fg', 'Text')}${col('ac', 'Accent')}${col('rd', 'Ready color (green)')}${col('hd', 'Hold color (red)')}
<h4>Layout</h4>${r('ui', 'Interface size (%)', 70, 150, 5)}${r('rad', 'Corner roundness (px)', 0, 24, 1)}${r('th', 'Timer area height (%)', 30, 70, 2)}${c('showScr', 'Show scramble')}${c('showRs', 'Show 1st to 5th solve boxes')}${c('showSt', 'Show stats (best, mean, ao5)')}${c('showSide', 'Show side column (rounds, delete)')}
<h4>Text</h4>${sl('tf', 'Timer font', [['system', 'System'], ['mono', 'Monospace'], ['serif', 'Serif'], ['rounded', 'Rounded']])}${r('tw', 'Timer weight', 300, 800, 100)}${r('fs', 'Timer size', 40, 200, 2)}${r('ss', 'Scramble size', 12, 36, 1)}${c('sfm', 'Monospace scramble')}${sl('dec', 'Decimals', [[2, '2'], [3, '3']])}
<h4>Timing and sound</h4>${r('hold', 'Hold time (ms)', 0, 1000, 50)}${c('insp', '15 s inspection')}${c('snd', 'Inspection beeps')}${r('vol', 'Beep volume (%)', 0, 100, 5)}${c('auto', 'Auto rounds (new round after each ao5)')}${c('focus', 'Focus mode (hide everything while solving)')}${c('hide', 'Hide time while solving')}${c('secs', 'Show whole seconds only while solving')}
<h4>Reactions and fun</h4>${sl('tone', 'Reactions', [['fun', 'Fun (cheers, comfort, playful teasing)'], ['kind', 'Kind (cheers and comfort only)'], ['off', 'Off']])}${sl('det', 'Message detail', [['full', 'Detailed (numbers, comparisons, tips)'], ['short', 'Short (headline only)']])}${c('brk', 'Suggest a break after several slow solves')}${r('goal', 'Daily solve goal (0 = off)', 0, 200, 5)}
<h4>Effects</h4>${c('fx', 'Confetti and glow')}${r('fxi', 'Effects strength (1 = subtle, 3 = wild)', 1, 3, 1)}${c('sfx', 'Sound effects')}${c('rdy', 'Blip when the timer turns green')}${c('vib', 'Vibration (phones)')}<div class="row" style="margin-top:6px"><button data-a="fxtest">Preview effects (closes this window)</button></div>
<div class="row" style="margin-top:10px;flex-wrap:wrap"><button data-a="exp">Export data</button><button data-a="imp">Import data</button><span class="sp"></span><button data-a="delall">Delete everything</button><button data-a="rst">Reset settings</button></div>`);
}

dl.addEventListener('input', e => {
  if (e.target.id === 'nt') { curCube().notes = e.target.value; save(); return; }
  const k = e.target.dataset.k;
  if (!k) return;
  const s = S.set;
  let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (e.target.type === 'range') {
    v = +v;
    const sp = $('#v_' + k);
    if (sp) sp.textContent = v;
  }
  if (k === 'dec') v = +v;
  s[k] = v;
  if (k === 'theme' && PRE[v]) {
    Object.assign(s, PRE[v]);
    settings();
  } else if (['bg', 'fg', 'ac'].includes(k)) {
    s.theme = 'custom';
  }
  applyTheme();
  save();
  render();
});

let sel = -1;

dl.addEventListener('click', e => {
  if (e.target === dl) { dl.close(); return; } // click outside the window (on the dark backdrop)
  const b = e.target.closest('button');
  if (!b) return;
  const a = b.dataset.a, d = D(), s = d.solves[sel];
  if (view && ['p2', 'dnf', 'del', 'yes'].includes(a)) return;
  if (a === 'close') dl.close();
  else if (a === 'calm') { cal.m += +b.dataset.d; if (cal.m < 0) { cal.m = 11; cal.y--; } else if (cal.m > 11) { cal.m = 0; cal.y++; } calendar(); }
  else if (a === 'calday') calendar(b.dataset.k);
  else if (a === 'rst') { if (confirm('Reset all settings to their defaults? Your solves are not touched.')) { S.set = defSet(); applyTheme(); save(); render(); settings(); } }
  else if (a === 'openday') { view = b.dataset.k === S.day ? null : b.dataset.k; dl.close(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); }
  else if (a === 'cube') { S.cur = b.dataset.i; save(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); dl.close(); }
  else if (a === 'addcube') {
    const n = $('#cn').value.trim();
    if (!n) { $('#cn').focus(); return; }
    (S.custom = S.custom || []).push({ id: 'c' + Date.now(), n, t: $('#ct').value, meth: null });
    S.cur = S.custom[S.custom.length - 1].id;
    save(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); dl.close();
  } else if (a === 'rmcube') {
    const c = allCubes().find(x => x.id === b.dataset.i);
    if (c && confirm('Remove ' + c.n + ' and all its solves?')) {
      S.custom = S.custom.filter(x => x.id !== c.id);
      delete S.data[c.id];
      if (S.cur === c.id) S.cur = '3';
      save(); newScr(); tm.textContent = '0.00'; render(); cubePicker();
    }
  }
  else if (a === 'fxtest') { dl.close(); setTimeout(() => celebrate('pb', { big: true }), 150); }
  else if (a === 'mt') methods(b.dataset.m, b.dataset.t);
  else if (a === 'exp') {
    const l = document.createElement('a');
    l.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
    l.download = 'cubetimer-data.json';
    l.click();
  } else if (a === 'imp') {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = '.json';
    i.onchange = () => i.files[0].text().then(t => { try { S = JSON.parse(t); save(); location.reload(); } catch (x) { alert('Invalid file'); } });
    i.click();
  } else if (a === 'p2') { s.p = s.p === 2 ? 0 : 2; repb(S.cur); save(); render(); dl.close(); }
  else if (a === 'dnf') { s.p = s.p === 'D' ? 0 : 'D'; repb(S.cur); save(); render(); dl.close(); }
  else if (a === 'del') { dl.close(); delSolve(sel); }
  else if (a === 'delall') {
    open(`<h3>Delete times</h3><p class="lead">What do you want to delete?</p>${view ? '' : `<p><button data-a="yes" style="width:100%">Only today (${name()})</button><small style="display:block;color:var(--mut);margin-top:4px">Removes today\'s solves and rounds for this cube. Earlier days and other cubes are kept.</small></p>`}<p><button data-a="delevery" style="width:100%">Everything</button><small style="display:block;color:var(--mut);margin-top:4px">Removes ALL solves, rounds, past days, records and PBs for ALL cubes. Settings, custom cubes and ticked algs are kept. It cannot be undone.</small></p>`);
  }
  else if (a === 'delevery') {
    if (!confirm('Delete ALL solves, past days and records for every cube? This cannot be undone.')) return;
    S.data = {}; S.hist = {}; S.rec = { c: {}, v: 1 }; AOC = {}; view = null;
    save(); newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); dl.close();
  }
  else if (a === 'yes') { S.data[S.cur] = { solves: [], rounds: [], round: 1 }; repb(S.cur); save(); tm.textContent = '0.00'; render(); dl.close(); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('button, [data-a]');
  if (!b || dl.contains(b)) return;
  const a = b.dataset.a;
  b.blur();
  if (a === 'cubes' && mode === 'idle') cubePicker();
  else if (a === 'cal' && mode === 'idle') { cal.sel = ''; calendar(); }
  else if (a === 'today') { view = null; newScr(); tm.textContent = '0.00'; $('#msg').textContent = ''; render(); }
  else if (a === 'rules') {
    open('<h3>Rules (WCA based)</h3><p style="color:var(--mut);margin:0">Green tag: applied automatically. Grey tag: honor system.</p><ul style="padding-left:18px">' + RULES.map(r => `<li><span class="tg ${r[0] == 'h' ? 'h' : ''}">${r[0] == 'a' ? 'applied' : 'honor'}</span>${r[1]}</li>`).join('') + '</ul>');
  } else if (a === 'set') settings();
  else if (a === 'rec' && mode === 'idle') records();
  else if (a === 'meth') methods();
  else if (a === 'solve') {
    sel = +b.dataset.i;
    const s = D().solves[sel];
    open(`<h3>#${sel + 1} · ${fmtS(s)}</h3><div style="white-space:pre-line;font-family:ui-monospace,monospace;margin-bottom:8px">${s.s}</div><small style="color:var(--mut)">${new Date(s.d).toLocaleString()}</small>${solveInfo(s)}${view ? '' : `<div class="row" style="margin-top:10px"><button data-a="p2" class="${s.p === 2 ? 'on' : ''}">+2</button><button data-a="dnf" class="${s.p === 'D' ? 'on' : ''}">DNF</button><button data-a="del">Delete</button></div>`}`);
  } else if (a === 'x' && mode === 'idle') {
    delSolve(+b.dataset.i);
  } else if (a === 'undo') {
    undoSolve();
  }
});

migrate();
rollover();
applyTheme();
newScr();
render();

// Optional: use the Rust/WebAssembly versions when pkg/ is built and served over http.
(async () => {
  try {
    const m = await import('./pkg/cubetimer.js');
    await m.default();
    ({ scramble, ao5, stats, insp, insp_text } = m);
    F = m.fmt;
    render();
    console.log('Rust core loaded');
  } catch (e) {
    console.log('Using JavaScript core');
  }
})();

function methods(m, t) {
  const c = curCube();
  if (!c.meth) {
    open(`<h3>${c.n} notes</h3><p class="lead">Your own cube. Write your method, algs or tips here. They are saved.</p><textarea id="nt" class="notes" placeholder="Method, algs, tips...">${(c.notes || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>`);
    return;
  }
  const MS = Object.fromEntries(c.meth.map(k => [k, M[k]])), st = S.view;
  if (!MS[st.m]) { st.m = c.meth[0]; st.t = Object.keys(MS[st.m].sub)[0]; }
  if (m) {
    if (m !== st.m || t) st.t = t || Object.keys(MS[m].sub)[0];
    st.m = m;
  }
  const me = MS[st.m], ks = Object.keys(me.sub);
  if (!me.sub[st.t]) st.t = ks[0];
  const d = me.sub[st.t];
  save();
  const A = d.algs.filter(a => a[0] !== '#' && a[0] !== 't'),
        kn = A.filter(a => S.known[a[1]]).length;
  open(`<h3>Methods · ${c.n} <small class="lead" id="kc">${A.length ? kn + ' / ' + A.length + ' known' : ''}</small></h3><div class="row tabs">${Object.keys(MS).map(k => `<button data-a="mt" data-m="${k}" class="${k === st.m ? 'on' : ''}">${MS[k].n}</button>`).join('')}</div>${ks.length > 1 ? `<div class="row tabs">${ks.map(k => `<button data-a="mt" data-m="${st.m}" data-t="${k}" class="${k === st.t ? 'on' : ''}">${me.sub[k].n}</button>`).join('')}</div>` : ''}<p class="lead">${d.info}</p>${A.length ? '' : '<p class="lead">No algs in this step. It is solved by thinking and practice, so there is nothing to tick.</p>'}${d.tips.length ? `<ul style="padding-left:18px">${d.tips.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}${d.algs.map(a => a[0] === '#' ? `<h4>${a[1]}</h4>` : a[0] === 't' ? `<p style="margin:2px 0">${a[1]}</p>` : `<label class="alg"><input type="checkbox" data-alg="${a[1]}" ${S.known[a[1]] ? 'checked' : ''}><b>${a[0]}</b><code>${a[1]}</code></label>`).join('')}`);
  dl.scrollTop = 0;
}

dl.addEventListener('change', e => {
  const a = e.target.dataset.alg;
  if (a === undefined) return;
  if (e.target.checked) S.known[a] = 1;
  else delete S.known[a];
  save();
  const c = [...dl.querySelectorAll('[data-alg]')];
  $('#kc').textContent = c.filter(x => x.checked).length + ' / ' + c.length + ' known';
});

// Shared saving: if the site runs with server.rs, load the newest saved data from it (works for any visitor).
async function pull() {
  if (!location.protocol.startsWith('http') || mode !== 'idle') return;
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (!r.ok) return;
    const j = await r.json();
    if (j && j.ts > (S.ts || 0)) {
      S = { ...S, ...j, set: { ...S.set, ...j.set } };
      S.known = S.known || {};
      S.view = S.view || { m: 'cfop', t: 'f2l' };
      S.hist = S.hist || {};
      migrate();
      rollover();
      try { localStorage.setItem('ct2', JSON.stringify(S)); } catch (e) {}
      applyTheme();
      newScr();
      render();
    } else if ((S.ts || 0) > ((j && j.ts) || 0)) {
      push();
    }
  } catch (e) {}
}

pull();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (mode === 'idle' && rollover()) { tm.textContent = '0.00'; render(); } pull(); } });
setInterval(() => { if (mode === 'idle' && !dl.open && rollover()) { tm.textContent = '0.00'; render(); } }, 30000);
>>>>>>> Stashed changes
