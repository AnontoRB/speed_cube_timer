// Cube types: scrambles + which methods each cube shows. Custom cubes (added by the user) live in S.custom.
const CUBES = [
  { id: '2', n: '2x2', t: '2', meth: ['eg'] },
  { id: '3', n: '3x3', t: '3', meth: ['cfop'] },
  { id: '4', n: '4x4', t: '4', meth: ['yau'] },
  { id: '5', n: '5x5', t: '5', meth: ['yau5'] },
  { id: '6', n: '6x6', t: '6', meth: ['yau6'] },
  { id: '7', n: '7x7', t: '7', meth: ['yau7'] },
  { id: 'oh', n: '3x3 OH', t: '3', meth: ['ohm'] },
  { id: 'pyra', n: 'Pyraminx', t: 'pyra', meth: ['pyl4e'] },
  { id: 'skewb', n: 'Skewb', t: 'skewb', meth: ['ns'] },
  { id: 'mega', n: 'Megaminx', t: 'mega', meth: ['mgll'] }
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

// Methods for the other cubes (3x3 CFOP is in algs.js). Every cube has its own list (see CUBES above).
// X(name, info, tips, algs). An alg row is ['name', 'alg', 'note'], ['#', 'Heading'] is a heading.
// The algs were run through a cube simulator to check what they do.
const X = (n, info, tips = [], algs = []) => ({ n, info, tips, algs });
const MX = {
  // ---- 2x2: EG ----
  eg: {
    n: 'EG Method',
    sub: {
      ov: X('Overview', 'Two steps. Build a face with the last-layer corners set up, then solve everything left with one EG algorithm.', ['1. Build a face while planning ahead (inspection)', '2. One EG algorithm, then a U turn (AUF)', 'Know CLL before you learn EG.', 'Learn the cases for the face you build most often first.']),
      st1: X('1. Build the face', 'Solve one face. The side colours of that face decide which EG case you get, so look for a good one while you build.', ['Plan the whole face in inspection.', 'Aim for a case you already know.', 'Fewer moves in step 1 beats a better case.']),
      st2: X('2. EG algorithm', 'Look at the last layer and the side colours of the first face. Recognise the case, then do its algorithm.', ['Recognise by the top-layer corner orientation and the first-layer pairs.', 'Do an AUF at the end to finish.', 'Use CLL algs for the cases you have no EG alg for yet.'], [
        ['#', 'Corner orient (to learn first)'], ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"]
      ])
    }
  },

  // ---- 4x4: Yau ----
  yau: {
    n: 'The Yau Method',
    sub: {
      st: X('Steps', 'Reduction in a faster order: the cross is built early.', ['1. Two opposite centers', '2. Three cross edges', '3. Last four centers', '4. Finish the cross', '5. Pair the other 8 edges (3-2-3)', '6. 3x3 stage, cross done', 'Parity algs: see Parity.']),
      p: X('Parity', 'OLL parity: one flipped edge. PLL parity: two swapped edges.', ['It shows up in the last layer.'], [
        ['OLL parity', "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"],
        ['PLL parity', "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2"]
      ])
    }
  },

  // ---- 5x5: Yau ----
  yau5: {
    n: 'The Yau Method',
    sub: {
      st: X('Steps', 'Yau on the 5x5: cross first.', ['1. Two opposite centers', '2. Three cross edges', '3. Other centers + last cross edge', '4. Pair the other edges (free slice)', '5. 3x3 stage. No parity.'])
    }
  },

  // ---- 6x6: Yau ----
  yau6: {
    n: 'The Yau Method',
    sub: {
      st: X('Steps', 'Yau on the 6x6: cross first.', ['1. Two opposite centers', '2. Three cross edges', '3. Other centers + last cross edge', '4. Pair the other edges', '5. 3x3 stage, then parity if it shows up.']),
      p: X('Parity', 'Same parity cases as the 4x4: OLL and PLL.', ['The 4x4 parity algs turn 2 layers and break the 6x6 centers. Use the 6x6 versions (3 layers, 3Rw).'])
    }
  },

  // ---- 7x7: Yau ----
  yau7: {
    n: 'The Yau Method',
    sub: {
      st: X('Steps', 'Yau on the 7x7: cross first. No parity.', ['1. Two opposite centers', '2. Three cross edges', '3. Other centers + last cross edge', '4. Pair the other edges', '5. 3x3 stage.'])
    }
  },

  // ---- 3x3 one-handed ----
  ohm: {
    n: 'OH method',
    sub: {
      ov: X('Overview', 'Same steps as 3x3. Use moves that suit one hand.', ['Slow and smooth first.', 'Rotate on the table, not in the air.', 'Plan the cross in inspection.']),
      gr: X('Grip', 'Thumb left, fingers right. Stay on R, U, F.', ['R: index or middle finger. R\': thumb.', 'U: index. U\': thumb.', 'F: ring finger. F\': thumb.', 'Avoid L, D, B: rotate, then use R or U.']),
      al: X('Algs', 'OH-friendly algs (R, U, F, B2).', [], [
        ['#', 'Orient'], ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"],
        ['#', 'Permute'], ['Ua', "R U' R U R U R U' R' U' R2"], ['Ub', "R2 U R U R' U' R' U' R' U R'"], ['H', "R2 U2 R U2 R2 U2 R2 U2 R U2 R2"],
        ['Aa', "R' F R' B2 R F' R' B2 R2"], ['Ab', "R B' R F2 R' B R F2 R2"], ['T', "R U R' U' R' F R2 U' R' U' R U R' F'"]
      ])
    }
  },

  // ---- Pyraminx: L4E ----
  pyl4e: {
    n: 'L4E',
    sub: {
      st: X('Steps', 'Solve a V (three centers, two edges), then the last four edges in one step.', ['Find a V in inspection.', 'Intuitive first, algs later.', 'Turn the 4 tips (u l r b) at any time.'])
    }
  },

  // ---- Skewb: NS ----
  ns: {
    n: 'NS Method',
    sub: {
      st: X('Steps', 'Solve a first layer, then finish the rest with one algorithm for each case.', ['Plan the first layer in inspection.', 'Learn the hammers first.', 'Same grip every time.'], [
        ['#', 'Basics'], ['Sledgehammer', "R' F R F'"], ['Hedgehammer', "F R' F' R"]
      ])
    }
  },

  // ---- Megaminx: Last Layer ----
  mgll: {
    n: 'Last Layer (4LL or 2LL)',
    sub: {
      ov: X('Overview', 'Solve the last layer in few looks. 4LL: four steps. 2LL: two steps (edges, then corners) with more algorithms.', ['Learn 4LL first.', 'Go to 2LL when the 4LL algs are fast.', 'Look ahead during the last F2L pair.']),
      ll: X('4LL', 'Orient the edges, orient the corners, permute the corners, permute the edges.', ['Do an AUF at the end.', 'Check each alg on your own cube before you learn it.'], [
        ['#', 'Orient edges'], ['Edge flip', "F R U R' U' F'"],
        ['#', 'Orient corners'], ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"]
      ])
    }
  }
};
Object.assign(M, MX);
