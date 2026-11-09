// practice.js - practice modes for the 3x3 (CFOP): cross, cross + F2L, F2L, OLL, PLL, last layer and algorithm drills.
// Every mode is a small "virtual cube" (see PRAC), so each one keeps its own times, averages and records
// and your normal 3x3 stats stay clean. Click "3x3" in the cube chooser while 3x3 is selected to open the menu.
//
// How the scrambles are made: for OLL, PLL, F2L and the drills, the scramble is the INVERSE of the algorithm
// from Methods (plus random U turns / a random slot), turned into plain face turns. Doing the algorithm
// solves the case. For "F2L (cross solved)" a small solver finds the cross for a random scramble and adds it.
// This file only touches the page when a function is called, so it can be tested without a browser.

const PRAC = [
  { id: 'p-cross', n: '3x3 Cross', t: 'prac', meth: ['cfop'], prac: 'cross' },
  { id: 'p-cf', n: '3x3 Cross+F2L', t: 'prac', meth: ['cfop'], prac: 'cf' },
  { id: 'p-f2l', n: '3x3 F2L', t: 'prac', meth: ['cfop'], prac: 'f2l' },
  { id: 'p-oll', n: '3x3 OLL', t: 'prac', meth: ['cfop'], prac: 'oll' },
  { id: 'p-pll', n: '3x3 PLL', t: 'prac', meth: ['cfop'], prac: 'pll' },
  { id: 'p-ll', n: '3x3 Last layer', t: 'prac', meth: ['cfop'], prac: 'll' },
  { id: 'p-alg', n: '3x3 Alg drill', t: 'prac', meth: ['cfop'], prac: 'alg' }
];

const PMODE = {
  full: { n: 'Full solve', d: 'The normal 3x3 solve, cross to PLL, with a random scramble.' },
  cross: { n: 'Cross', d: 'Random scramble. Solve only the cross, then stop the timer.' },
  cf: { n: 'Cross + F2L', d: 'Random scramble. Solve the first two layers, then stop the timer.' },
  f2l: { n: 'F2L', d: 'The cross is already solved. Do the four pairs, then stop the timer.' },
  oll: { n: 'OLL', d: 'One OLL case at a time. First two layers solved, orient the top, stop.' },
  pll: { n: 'PLL', d: 'One PLL case at a time. Top is yellow, permute the last layer, stop.' },
  ll: { n: 'Last layer', d: 'OLL then PLL, with the first two layers already solved.' },
  alg: { n: 'Algorithm drill', d: 'Pick the exact algorithms (OLL, PLL, F2L pairs) you want to drill.' }
};

// ---------------------------------------------------------------------------------------------
// Small cube simulator (54 stickers, built from geometry so there are no hand-typed tables)
// ---------------------------------------------------------------------------------------------
const PR = (() => {
  const ORDER = 'URFDLB';
  const AX = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const key = (p, n) => p.join(',') + '|' + n.join(',');

  const ST = [], KEY = new Map();
  for (const f of ORDER) {
    const n = AX[f];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      const p = [x, y, z];
      if (dot(p, n) === 1) { KEY.set(key(p, n), ST.length); ST.push({ p, n, f }); }
    }
  }
  const CEN = {};
  for (const f of ORDER) CEN[f] = KEY.get(key(AX[f], AX[f]));

  // Moves: axis (pointing out of the face that turns clockwise) and which layers (1 = outer, 0 = middle, -1 = far side) move.
  const MV = {};
  const def = (name, face, layers) => { MV[name] = { a: AX[face], ls: layers }; };
  for (const f of ORDER) def(f, f, [1]);
  for (const f of ORDER) def(f.toLowerCase(), f, [1, 0]);
  def('M', 'L', [0]); def('E', 'D', [0]); def('S', 'F', [0]);
  def('x', 'R', [1, 0, -1]); def('y', 'U', [1, 0, -1]); def('z', 'F', [1, 0, -1]);

  const rotQ = (v, a) => { const c = crs(a, v), d = dot(a, v); return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d]; };   // -90 degrees about a
  const PERM = {};
  for (const name in MV) {
    const m = MV[name];
    PERM[name] = ST.map((s, i) => (m.ls.includes(dot(s.p, m.a)) ? KEY.get(key(rotQ(s.p, m.a), rotQ(s.n, m.a))) : i));
  }

  const solved = () => Uint8Array.from(ST, t => ORDER.indexOf(t.f));
  function applyQ(s, name, pow) {
    for (let k = 0; k < pow; k++) { const P = PERM[name], n = new Uint8Array(54); for (let i = 0; i < 54; i++) n[P[i]] = s[i]; s = n; }
    return s;
  }
  const run = (tokens, s) => tokens.reduce((a, [n, p]) => applyQ(a, n, p), s || solved());

  // ----- notation -----
  const TOK = /^([URFDLB]w|[URFDLBurfdlbMESxyz])(2'?|')?$/;
  function parse(str) {
    const out = [];
    for (const t of String(str).trim().split(/\s+/).filter(Boolean)) {
      const m = TOK.exec(t);
      if (!m) return null;
      const name = m[1].length === 2 ? m[1][0].toLowerCase() : m[1];
      out.push([name, !m[2] ? 1 : m[2][0] === '2' ? 2 : 3]);
    }
    return out;
  }
  const inv = tokens => tokens.slice().reverse().map(([n, p]) => [n, (4 - p) % 4]);
  const fmt = list => list.map(([f, p]) => f + (p === 1 ? '' : p === 2 ? '2' : "'")).join(' ');
  const U_ = k => (k ? [['U', k]] : []);
  const Y_ = k => (k ? [['y', k]] : []);

  // Turn any move list (with wide moves, slices and cube rotations) into plain face turns, so a scramble needs no rotations.
  // Every rotation changes which face is where; later moves are renamed to the face they really turn.
  const DEC = {
    r: { f: [['L', 1]], r: ['x', 1] }, l: { f: [['R', 1]], r: ['x', -1] },
    u: { f: [['D', 1]], r: ['y', 1] }, d: { f: [['U', 1]], r: ['y', -1] },
    f: { f: [['B', 1]], r: ['z', 1] }, b: { f: [['F', 1]], r: ['z', -1] },
    M: { f: [['R', 1], ['L', -1]], r: ['x', -1] }, E: { f: [['U', 1], ['D', -1]], r: ['y', -1] }, S: { f: [['F', -1], ['B', 1]], r: ['z', 1] },
    x: { f: [], r: ['x', 1] }, y: { f: [], r: ['y', 1] }, z: { f: [], r: ['z', 1] }
  };
  for (const f of ORDER) DEC[f] = { f: [[f, 1]] };
  const ROT = {
    x: o => ({ ...o, U: o.F, B: o.U, D: o.B, F: o.D }),
    y: o => ({ ...o, L: o.F, B: o.L, R: o.B, F: o.R }),
    z: o => ({ ...o, R: o.U, D: o.R, L: o.D, U: o.L })
  };
  const pw = (p, k) => (k > 0 ? p : (4 - p) % 4);
  function faceOnly(tokens) {
    let ori = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
    const out = [];
    for (const [n, p] of tokens) {
      const d = DEC[n];
      for (const [f, k] of d.f) out.push([ori[f], pw(p, k)]);
      if (d.r) for (let t = pw(p, d.r[1]); t > 0; t--) ori = ROT[d.r[0]](ori);
    }
    return out;
  }
  function simplify(list) {
    const out = [];
    for (const [f, p] of list) {
      const L = out[out.length - 1];
      if (L && L[0] === f) { const np = (L[1] + p) % 4; out.pop(); if (np) out.push([f, np]); } else out.push([f, p]);
    }
    return out;
  }

  // Where every face ends up after the moves (a cube rotation inside an alg leaves the cube turned).
  function oriOf(tokens) {
    let ori = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
    for (const [n, p] of tokens) { const d = DEC[n]; if (d.r) for (let t = pw(p, d.r[1]); t > 0; t--) ori = ROT[d.r[0]](ori); }
    return ori;
  }
  // The shortest list of cube rotations that turns the cube back to how it was before the moves.
  function restore(tokens) {
    const o = oriOf(tokens);
    if (ORDER.split('').every(f => o[f] === f)) return [];
    let best = null;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
      const rot = [['x', a], ['y', b], ['z', c]].filter(r => r[1]), t = oriOf(tokens.concat(rot));
      if (ORDER.split('').every(f => t[f] === f) && (!best || rot.length < best.length)) best = rot;
    }
    return best || [];
  }

  // ----- cross solver (breadth-first search over the 4 cross edges: 24^4 = 331,776 keys, built on first use) -----
  const EID = new Map(), EDG = [];
  ST.forEach((s, i) => { if (s.p.filter(v => v === 0).length === 1) { EID.set(i, EDG.length); EDG.push(i); } });
  const FM = [];   // the 18 face turns
  for (const f of ORDER) for (let p = 1; p <= 3; p++) FM.push([f, p]);
  const EP = FM.map(([f, p]) => EDG.map(i => { let j = i; for (let k = 0; k < p; k++) j = PERM[f][j]; return EID.get(j); }));
  const GOAL = [[0, -1, 1], [1, -1, 0], [0, -1, -1], [-1, -1, 0]].map(p => EID.get(KEY.get(key(p, AX.D))));
  const enc = e => ((e[0] * 24 + e[1]) * 24 + e[2]) * 24 + e[3];
  let DIST = null;
  function distTable() {
    if (DIST) return DIST;
    DIST = new Int8Array(24 ** 4).fill(-1);
    const q = new Int32Array(24 ** 4);
    let h = 0, t = 0;
    const g = enc(GOAL);
    DIST[g] = 0; q[t++] = g;
    while (h < t) {
      const k = q[h++], d = DIST[k], e = [Math.floor(k / 13824), Math.floor(k / 576) % 24, Math.floor(k / 24) % 24, k % 24];
      for (let m = 0; m < 18; m++) {
        const E = EP[m], nk = enc([E[e[0]], E[e[1]], E[e[2]], E[e[3]]]);
        if (DIST[nk] < 0) { DIST[nk] = d + 1; q[t++] = nk; }
      }
    }
    return DIST;
  }
  // A short solution for the cross on the D face, for the cube after "moves" (a list of [face, power]).
  function crossSolve(moves, rnd) {
    const D = distTable();
    let e = GOAL.slice();
    for (const [f, p] of moves) { const E = EP[ORDER.indexOf(f) * 3 + p - 1]; e = e.map(x => E[x]); }
    const out = [];
    while (D[enc(e)] > 0) {
      const d = D[enc(e)], c = [];
      for (let m = 0; m < 18; m++) { const E = EP[m], n = e.map(x => E[x]); if (D[enc(n)] === d - 1) c.push([m, n]); }
      const [m, n] = c[rnd ? rnd(c.length) : 0];
      out.push(FM[m]); e = n;
    }
    return out;
  }

  return { ST, KEY, CEN, ORDER, solved, run, applyQ, parse, inv, fmt, U_, Y_, faceOnly, simplify, restore, crossSolve, distTable, GOAL };
})();

// ---------------------------------------------------------------------------------------------
// Cases (from the lists in algs.js) and scramble builders
// ---------------------------------------------------------------------------------------------
const PR_TWO = { oll: ['Line', 'L shape', 'Dot', 'Sune', 'Anti-Sune', 'H', 'Pi', 'U', 'T', 'L'], pll: ['Aa', 'Y', 'Ua', 'Ub', 'H', 'Z'] };
const HOLD = 'Hold yellow on top and green in front (cross colour on the bottom).';
let PRC = null, PCASE = null, PLAST = null, PREV = false;

const isPrac = id => typeof id === 'string' && id.startsWith('p-');
const on3 = () => S.cur === '3' || isPrac(S.cur);
const prs = () => {
  const P = S.pr = S.pr || {};
  P.set = P.set || { oll: 'all', pll: 'all' };
  P.pick = P.pick || {};
  return P;
};

function prCases(type) {
  PRC = PRC || {};
  if (!PRC[type]) {
    PRC[type] = M.cfop.sub[type].algs.filter(a => a[0] !== '#' && a[0] !== 't' && PR.parse(a[1]))
      .map(a => ({ k: type + '|' + a[0], type, name: a[0], alg: a[1] }));
  }
  return PRC[type];
}
function prPool(type, set) {
  const rows = prCases(type);
  if (set === 'known') return rows.filter(r => S.known && S.known[r.alg]);
  if (set === '2look' && PR_TWO[type]) return rows.filter(r => PR_TWO[type].includes(r.name));
  if (type === 'oll') { const full = rows.filter(r => /^OLL \d+$/.test(r.name)); return full.length ? full : rows; }
  return rows;
}

const toks = alg => PR.parse(alg);
const fmtT = tk => tk.map(([n, p]) => n + (p === 1 ? '' : p === 2 ? '2' : "'")).join(' ');

function prPick(pool, prev) {
  if (!pool.length) return null;
  let r = pool[R(pool.length)];
  for (let i = 0; i < 6 && pool.length > 1 && prev && r.k === prev; i++) r = pool[R(pool.length)];
  return r;
}

function genPrac(c) {
  const m = c.prac, P = prs(), prevKey = PCASE && PCASE.key;
  if (PCASE && PCASE.sol) PLAST = PCASE;
  PCASE = { mode: m };
  if (m === 'cross') { PCASE.hint = 'Solve only the cross, then stop the timer.'; return scramble('3'); }
  if (m === 'cf') { PCASE.hint = 'Solve the cross and all four F2L pairs, then stop the timer.'; return scramble('3'); }
  if (m === 'f2l') {
    const moves = PR.simplify((PR.parse(scramble('3') || '') || []).filter(x => 'URFDLB'.includes(x[0])));
    const sol = PR.crossSolve(moves, R);
    PCASE.hint = 'The cross is already solved. Do the four F2L pairs, then stop the timer. ' + HOLD;
    return PR.fmt(PR.simplify(moves.concat(sol)));
  }
  const wrap = tk => tk.concat(PR.restore(tk)), au = () => PR.U_(R(4)), pick = (type, set) => prPick(prPool(type, set), prevKey);
  let sol, name, key, hint;
  if (m === 'oll' || m === 'pll' || m === 'alg') {
    let row;
    if (m === 'alg') {
      const pool = ['oll', 'pll', 'f2l'].flatMap(t => prCases(t)).filter(r => P.pick[r.k]);
      row = prPick(pool.length ? pool : prPool('pll', 'all'), prevKey);
    } else {
      let set = P.set[m], pool = prPool(m, set);
      if (!pool.length) { set = 'all'; pool = prPool(m, 'all'); PCASE.note = 'You have not ticked any ' + m.toUpperCase() + ' algs as known (Methods), so all cases are used.'; }
      row = prPick(pool, prevKey);
    }
    const a = toks(row.alg);
    if (row.type === 'oll') sol = wrap(au().concat(a));
    else if (row.type === 'pll') sol = wrap(au().concat(a)).concat(au());
    else sol = wrap(PR.Y_(R(4)).concat(a));
    name = row.name; key = row.k;
    hint = row.type === 'f2l' ? 'One F2L pair, cross and the other pairs solved. ' + HOLD : (row.type === 'oll' ? 'Orient the top face. ' : 'Permute the last layer. ') + HOLD;
  } else {   // 'll': OLL, then PLL
    const o = pick('oll', P.set.oll) || pick('oll', 'all'), p = pick('pll', P.set.pll) || pick('pll', 'all');
    sol = wrap(au().concat(toks(o.alg))).concat(wrap(au().concat(toks(p.alg))), au());
    name = o.name + ' + ' + p.name; key = o.k + '+' + p.k;
    hint = 'Do OLL, then PLL. ' + HOLD;
  }
  const full = PR.simplify(sol);   // merges repeated moves such as U U'
  Object.assign(PCASE, { key, name, hint, sol: fmtT(full) });
  return PR.fmt(PR.simplify(PR.faceOnly(PR.inv(full))));
}

// ---------------------------------------------------------------------------------------------
// Page parts (info box under the scramble, the menu, the algorithm picker)
// ---------------------------------------------------------------------------------------------
function pracUI() {
  let el = document.getElementById('pc');
  const c = typeof curCube === 'function' ? curCube() : null;
  if (!c || !c.prac || view || S.set.rnd) { if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'pc'; document.getElementById('tm').before(el); }
  const p = PCASE || {}, l = PLAST && PLAST.mode === c.prac ? PLAST : null;
  el.hidden = false;
  el.innerHTML =
    `<div><b>${esc(PMODE[c.prac].n)}</b> practice${p.hint ? ' · ' + esc(p.hint) : ''}</div>` +
    (p.note ? `<div class="pcl">${esc(p.note)}</div>` : '') +
    (PREV && p.sol ? `<div class="pcr"><b>${esc(p.name)}</b> <code>${esc(p.sol)}</code></div>` : '') +
    (l ? `<div class="pcl">Previous case: <b>${esc(l.name)}</b> <code>${esc(l.sol)}</code></div>` : '') +
    `<div class="pcb">${p.sol ? `<button data-pr="reveal">${PREV ? 'Hide case' : 'Show case'}</button>` : ''}<button data-pr="menu">Change practice</button></div>`;
}

function pracHint() {
  if (!on3()) return '';
  return '<div class="row btns"><button class="on" data-pr="menu">3x3 practice modes…</button></div><p class="lead">Tip: tap 3x3 again to open the practice modes (cross, F2L, OLL, PLL, algorithm drills).</p>';
}

function pracMenu(keepScroll) {
  const P = prs(), keep = keepScroll ? dl.scrollTop : 0, cur = S.cur === '3' ? 'full' : isPrac(S.cur) ? S.cur.slice(2) : '';
  const card = m => `<button data-pr="go" data-m="${m}" class="${cur === m ? 'on' : ''}"><b>${PMODE[m].n}</b><small>${PMODE[m].d}</small></button>`;
  const setRow = (t, label) => {
    const b = [['all', 'All'], ['2look', '2-look'], ['known', 'My known']].map(([v, n]) => `<button data-pr="set" data-t="${t}" data-v="${v}" class="${P.set[t] === v ? 'on' : ''}">${n} (${prPool(t, v).length})</button>`).join('');
    return `<div class="row tabs"><b style="min-width:3.5em">${label}</b>${b}</div>`;
  };
  open(`<h3>3x3 practice</h3><p class="lead">What do you want to practice? Every mode keeps its own times, so your normal 3x3 stats stay untouched.</p>
<div class="prl">${['full', 'cross', 'cf', 'f2l', 'oll', 'pll', 'll', 'alg'].map(card).join('')}</div>
<h4>Which cases? (OLL, PLL and last layer)</h4>${setRow('oll', 'OLL')}${setRow('pll', 'PLL')}
<p class="lead">All = every case in Methods. 2-look = the few cases of the beginner 2-look method. My known = only the algs you ticked in Methods. For the exact algs you want, use Algorithm drill.</p>`);
  dl.scrollTop = keep;
}

function pracPick(keepScroll) {
  const P = prs(), keep = keepScroll ? dl.scrollTop : 0;
  const grp = (type, title) => {
    const rows = prCases(type), n = rows.filter(r => P.pick[r.k]).length;
    return `<h4>${title} <small class="lead" data-cnt="${type}">${n} / ${rows.length}</small></h4><div class="row btns"><button data-pr="gsel" data-g="${type}" data-v="1">All</button><button data-pr="gsel" data-g="${type}" data-v="0">None</button></div><div class="pk">${rows.map(r => `<label><input type="checkbox" data-pk="${esc(r.k)}"${P.pick[r.k] ? ' checked' : ''}>${esc(r.name)}</label>`).join('')}</div>`;
  };
  const tot = Object.values(P.pick).filter(Boolean).length;
  open(`<h3>Algorithm drill</h3><p class="lead">Tick the algorithms you want to drill. Each scramble is one of them. F2L cases show up in a random slot.</p>
<div class="row btns"><button data-pr="known">Select only the algs I know</button><button data-pr="clear">Clear all</button></div>
${grp('oll', 'OLL')}${grp('pll', 'PLL')}${grp('f2l', 'F2L (one pair)')}
<p id="pkmsg" class="lead"></p><div class="row btns"><button data-pr="menu">Back</button><button class="on" data-pr="start" id="pkgo">Start drill (${tot})</button></div>`);
  dl.scrollTop = keep;
}

function pracRefreshPick() {
  const P = prs();
  for (const t of ['oll', 'pll', 'f2l']) { const el = dl.querySelector(`[data-cnt="${t}"]`), rows = prCases(t); if (el) el.textContent = rows.filter(r => P.pick[r.k]).length + ' / ' + rows.length; }
  const go = document.getElementById('pkgo');
  if (go) go.textContent = 'Start drill (' + Object.values(P.pick).filter(Boolean).length + ')';
}

function pracGo(m) {
  if (m === 'alg' && !Object.values(prs().pick).some(Boolean)) { pracPick(); return; }
  S.cur = m === 'full' ? '3' : 'p-' + m;
  PCASE = PLAST = null; PREV = false;
  save(); dl.close(); fresh();
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pr]');
  if (!b) return;
  const a = b.dataset.pr, P = prs();
  b.blur();
  if (a === 'reveal') { PREV = !PREV; pracUI(); return; }
  if (typeof mode !== 'undefined' && mode !== 'idle') return;   // never while a solve is running
  if (a === 'menu') pracMenu();
  else if (a === 'go') pracGo(b.dataset.m);
  else if (a === 'set') {
    P.set[b.dataset.t] = b.dataset.v; save(); pracMenu(true);
    const c = curCube();
    if (c.prac === b.dataset.t || c.prac === 'll') { fresh(); }
  } else if (a === 'gsel') {
    for (const r of prCases(b.dataset.g)) { if (b.dataset.v === '1') P.pick[r.k] = 1; else delete P.pick[r.k]; }
    save(); pracPick(true);
  } else if (a === 'known') {
    P.pick = {};
    for (const t of ['oll', 'pll', 'f2l']) for (const r of prCases(t)) if (S.known && S.known[r.alg]) P.pick[r.k] = 1;
    save(); pracPick(true);
    if (!Object.keys(P.pick).length) document.getElementById('pkmsg').textContent = 'No algs are ticked as known yet. Tick them in Methods, or pick them here.';
  } else if (a === 'clear') { P.pick = {}; save(); pracPick(true); }
  else if (a === 'start') {
    if (!Object.values(P.pick).some(Boolean)) { document.getElementById('pkmsg').textContent = 'Tick at least one algorithm first.'; return; }
    pracGo('alg');
  }
});

document.addEventListener('change', e => {
  const k = e.target && e.target.dataset && e.target.dataset.pk;
  if (!k) return;
  const P = prs();
  if (e.target.checked) P.pick[k] = 1; else delete P.pick[k];
  save(); pracRefreshPick();
});

if (typeof module !== 'undefined' && module.exports) module.exports = { PR, PRAC, prCases, prPool, genPrac, PR_TWO };
