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

let S = {
  set: { theme: th, ...PRE[th], rd: '#2ecc71', fs: 96, ss: 18, hold: 300, insp: true, snd: true, auto: true, hide: false, dec: 2, showScr: true, focus: true },
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

const arr = v => Float64Array.from(v);

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
          return `<div class="dcard"><h4>${cn ? cn.n : id}</h4><div class="dtiles">${tile('Solves', e.solves.length)}${tile('Best', fx(b))}${tile('Mean', fx(m))}${tile('Best ao5', fx(ba))}${tile('Time spent', dur(tot))}</div><div class="chips">${e.solves.map((s, i) => `<span><small>${i + 1}</small> ${fmtS(s)}</span>`).join('')}</div></div>`;
        }).join('') : '<p class="lead">No solves this day.</p>',
        long = new Date(cal.sel + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  open(`<h3>Calendar</h3><div class="row"><button data-a="calm" data-d="-1">&lsaquo;</button><b style="flex:1;text-align:center">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button data-a="calm" data-d="1">&rsaquo;</button></div><div class="cal">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span>${x}</span>`).join('')}${cells}</div><div class="row dayhead"><b>${long}</b><span class="sp"></span><button class="on" data-a="openday" data-k="${cal.sel}">${cal.sel === S.day ? 'Go to today' : 'Open this day'}</button></div>${det}`);
}

function applyTheme() {
  const r = document.documentElement.style, s = S.set;
  for (const k of ['bg', 'fg', 'ac', 'rd']) r.setProperty('--' + k, s[k]);
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
    o.connect(c.destination);
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
    const s = L[i], t = s ? fmtS(s) : '–';
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

function add(t, p) {
  undoDel = null;
  rollover();
  const e = D(), pb = Math.min(Infinity, ...e.solves.map(val)),
        s = { t, p, s: scr, d: Date.now(), r: S.set.auto ? e.round : 0 };
  e.solves.push(s);
  tm.textContent = fmtS(s);
  let m = 'Solve saved';
  focusUI();
  if (isFinite(val(s)) && val(s) < pb && e.solves.length > 1) m = 'New personal best!';
  if (S.set.auto) {
    const rs = e.solves.filter(x => x.r === e.round);
    if (rs.length >= 5) {
      const res = ao5(arr(rs.map(val)));
      e.rounds.push({ n: e.round, res, v: rs.map(fmtS) });
      m = `Round ${e.round} done: ao5 = ${fx(res)}. New round started.`;
      e.round++;
    }
  }
  $('#msg').textContent = m;
  save();
  newScr();
  render();
}

function tick() {
  focusUI();
  if (mode === 'run') {
    tm.textContent = S.set.hide ? '…' : F(performance.now() - t0, S.set.dec);
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
  open(`<h3>Choose a cube</h3><div class="cubes">${allCubes().map(one).join('')}</div><h4>Add your own cube</h4><div class="add"><input id="cn" placeholder="Name (e.g. Mirror cube)" maxlength="24"><select id="ct">${CTYPES.map(x => `<option value="${x[0]}">${x[1]}</option>`).join('')}</select><button data-a="addcube">Add</button></div><p class="lead">Scramble style decides which scrambles it uses. Custom cubes get their own times and a notes page under Methods.</p>`);
}

function settings() {
  const s = S.set,
        c = (k, l) => `<label class="set">${l}<input type="checkbox" data-k="${k}" ${s[k] ? 'checked' : ''}></label>`,
        r = (k, l, a, b, st) => `<label class="set">${l}: <span id="v_${k}">${s[k]}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${s[k]}"></label>`,
        col = (k, l) => `<label class="set">${l}<input type="color" data-k="${k}" value="${s[k]}"></label>`;
  open(`<h3>Settings</h3><label class="set">Theme<select data-k="theme">${['dark', 'light', 'custom'].map(x => `<option ${s.theme === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>${col('bg', 'Background')}${col('fg', 'Text')}${col('ac', 'Accent')}${col('rd', 'Ready color')}${r('fs', 'Timer size', 40, 200, 2)}${r('ss', 'Scramble size', 12, 36, 1)}${r('hold', 'Hold time (ms)', 0, 1000, 50)}${c('insp', '15 s inspection')}${c('snd', 'Inspection beeps')}${c('auto', 'Auto rounds (new round after each ao5)')}${c('focus', 'Focus mode (hide everything while solving)')}${c('hide', 'Hide time while solving')}${c('showScr', 'Show scramble')}<label class="set">Decimals<select data-k="dec"><option ${s.dec == 2 ? 'selected' : ''}>2</option><option ${s.dec == 3 ? 'selected' : ''}>3</option></select></label><div class="row" style="margin-top:8px;flex-wrap:wrap"><button data-a="exp">Export data</button><button data-a="imp">Import data</button></div>`);
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