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