// Cube types: scrambles + which methods each cube shows. Custom cubes (added by the user) live in S.custom.
const CUBES = [
  { id: '2', n: '2x2', t: '2', meth: ['lbl2', 'ort'] },
  { id: '3', n: '3x3', t: '3', meth: ['beg', 'cfop', 'zz', 'roux', 'petrus'] },
  { id: '4', n: '4x4', t: '4', meth: ['red4'] },
  { id: '5', n: '5x5', t: '5', meth: ['redn'] },
  { id: '6', n: '6x6', t: '6', meth: ['redn'] },
  { id: '7', n: '7x7', t: '7', meth: ['redn'] },
  { id: 'oh', n: '3x3 OH', t: '3', meth: ['beg', 'cfop', 'zz', 'roux', 'petrus'] },
  { id: 'pyra', n: 'Pyraminx', t: 'pyra', meth: ['pyr'] },
  { id: 'skewb', n: 'Skewb', t: 'skewb', meth: ['skb'] },
  { id: 'mega', n: 'Megaminx', t: 'mega', meth: ['mgx'] }
];

// Scramble types a custom cube can use.
const CTYPES = [['3', '3x3 scramble'], ['2', '2x2 scramble'], ['4', '4x4 scramble'], ['5', '5x5 scramble'], ['6', '6x6 scramble'], ['7', '7x7 scramble'], ['pyra', 'Pyraminx scramble'], ['skewb', 'Skewb scramble'], ['mega', 'Megaminx scramble'], ['none', 'No scramble']];

function nxn(n, len) {
  const fs = 'URFDLB', mx = Math.floor(n / 2), o = [];
  let la = -1;
  while (o.length < len) {
    const f = R(6), a = f % 3;
    if (a === la) continue;
    la = a;
    const k = 1 + R(mx);
    o.push((k > 2 ? k : '') + fs[f] + (k > 1 ? 'w' : '') + pk(['', "'", '2']));
  }
  return o.join(' ');
}

function turns(faces, len, dbl) {
  const o = [];
  let l = -1;
  while (o.length < len) {
    const i = R(faces.length);
    if (i === l) continue;
    l = i;
    o.push(faces[i] + pk(dbl ? ['', "'", '2'] : ['', "'"]));
  }
  return o;
}

const pyra = () => turns('ULRB', 11).concat([...'ulrb'].map(c => { const r = R(3); return r ? c + (r == 2 ? "'" : '') : ''; }).filter(Boolean)).join(' ');
const skewb = () => turns('RLUB', 11).join(' ');
const mega = () => Array.from({ length: 7 }, () => Array.from({ length: 10 }, (_, i) => (i % 2 ? 'D' : 'R') + pk(['++', '--'])).concat(R(2) ? 'U' : "U'").join(' ')).join('\n');

// t = scramble type. R and pk (random helpers) come from app.js. Uses the (Rust or JS) scramble() for 2x2-5x5.
function genScr(c) {
  const t = c.t;
  if (['2', '3', '4', '5'].includes(t)) return scramble(t);
  if (t === '6') return nxn(6, 80);
  if (t === '7') return nxn(7, 100);
  if (t === 'pyra') return pyra();
  if (t === 'skewb') return skewb();
  if (t === 'mega') return mega();
  return '';
}

// Methods for the other cubes (3x3 methods are in algs.js).
const X = (n, info, tips = [], algs = []) => ({ n, info, tips, algs });
const MX = {
  lbl2: {
    n: 'Layer by layer',
    sub: {
      st: X('Steps', 'Treat the 2x2 as a 3x3 without edges. Solve one layer, then the last layer. Hold the first layer on the bottom.', ['Solve one face first (4 corners). Match the side colors, not only the top.', 'Use R U R\' U\' to move a corner into its slot.', 'Aim for a solved first layer in under 8 moves, then drill the last layer.']),
      ll: X('Last layer', 'Orient the 4 top corners (Sune / Anti-Sune), then permute them.', ['Sune and Anti-Sune solve most orientation cases; repeat or turn U to find the right one.', 'After orienting, solve the corner swap with the T or Y perm.'], [
        ['#', 'Orient'], ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"],
        ['#', 'Permute'], ['Adjacent swap (T)', "R U R' U' R' F R2 U' R' U' R U R' F'"], ['Diagonal swap (Y)', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
      ])
    }
  },
  ort: {
    n: 'Ortega / CLL',
    sub: {
      o: X('Overview', 'Faster 2x2 methods. Ortega: solve one face, orient the other, then permute both layers (PBL). CLL: solve one layer, then the last layer corners in one look (42 algs).', ['Learn the 7 OLL cases first, then PBL (5 algs).', 'Look ahead for a free first-layer solution during inspection (a 2x2 can be solved in about 11 moves).'])
    }
  },
  red4: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Build the 6 centers (2x2 blocks), one color at a time. Keep solved centers on top or front while you build the next.', ['Solve opposite centers last because they are the hardest to keep.', 'Use Rw/Lw/Uw layer moves to pair pieces.']),
      e: X('Edges', 'Pair the 12 edges (24 pieces) so the cube acts like a 3x3. Use the slot trick: put a pair in the front-right slot and tuck it in.', ['Work from one side to another so you do not break pairs.', 'Do not turn Rw while paired edges are on the right slot without protecting them.']),
      f: X('3x3 stage', 'Solve the cube like a 3x3, then fix parity if it appears.', ['Never turn the inner layers (Rw, Uw...) during the 3x3 stage.']),
      p: X('Parity', 'Two cases only on 4x4: OLL parity (one flipped edge) and PLL parity (two swapped edges).', ['OLL parity shows up if an edge is flipped in the last layer.', 'PLL parity shows up if two edges are swapped, or if only two edges need to swap.'], [
        ['OLL parity', "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"],
        ['PLL parity', "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2"]
      ])
    }
  },
  redn: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Build all centers (a block per color). On 6x6 and 7x7 do the inner centers one color at a time too.', ['Solve opposite colors last.', 'Use slice moves to bring pieces in, never undo solved centers.']),
      e: X('Edges', 'Pair all edges. On 5x5 each edge has 3 pieces, on 6x6 4 pieces, on 7x7 5 pieces.', ['Use the 3-cycle trick for the middle edge of 5x5 and 7x7.', 'Pair with a free edge slot so you do not need extra algs.']),
      f: X('3x3 stage', 'Solve like a 3x3. 5x5 and 7x7 have no parity, 6x6 has the same parities as 4x4.', ['Use the 4x4 parity algs on 6x6 only.'])
    }
  },
  pyr: {
    n: 'Beginner',
    sub: {
      t: X('Tips and centers', 'Turn the 4 tips so each matches the center below it (lowercase u l r b moves). Do this at the start or the end.', ['Tips are free: just twist them to match.']),
      l: X('First layer', 'Solve the 3 bottom edges (the first layer), matching them with the centers.', ['Solve all three at once if you can.']),
      m: X('Last layer', 'Orient the last 3 edges (flip them if needed), then cycle them if they are out of place. Same ideas as the 3x3 but with only 6 edges.', ['Learn the 4 edge cases, then the 2 cycle algs.'])
    }
  },
  skb: {
    n: 'Beginner',
    sub: {
      s: X('Steps', 'Solve a face and its 4 corners first (with one corner twisted if needed), then orient the last layer with a repeating alg, then permute.', ['The Skewb has only 4 turning axes. Hold it with the same two corners every time.', 'Learn the Sarah\'s Intermediate method when you want to improve.'])
    }
  },
  mgx: {
    n: 'Beginner',
    sub: {
      s: X('Steps', 'Treat it like a 3x3 on 12 faces: star, first-layer corners, second layer, third layer, then the last layer (about 10 algs).', ['Solve the star around one center first.', 'Use R U R\' U\' to insert corners.', 'Megaminx is slow at first. Aim for accuracy and lookahead.'])
    }
  }
};
Object.assign(M, MX);
