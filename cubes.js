// Cube types: scrambles + which methods each cube shows. Custom cubes (added by the user) live in S.custom.
const CUBES = [
  { id: '2', n: '2x2', t: '2', meth: ['lbl2', 'ort', 'cll'] },
  { id: '3', n: '3x3', t: '3', meth: ['cfop'] },
  { id: '4', n: '4x4', t: '4', meth: ['red4', 'yau', 'hoya'] },
  { id: '5', n: '5x5', t: '5', meth: ['red5', 'yau5'] },
  { id: '6', n: '6x6', t: '6', meth: ['red6'] },
  { id: '7', n: '7x7', t: '7', meth: ['red7'] },
  { id: 'oh', n: '3x3 OH', t: '3', meth: ['ohm'] },
  { id: 'pyra', n: 'Pyraminx', t: 'pyra', meth: ['pyr', 'pyl4e', 'pytop'] },
  { id: 'skewb', n: 'Skewb', t: 'skewb', meth: ['skb', 'ski', 'ska'] },
  { id: 'mega', n: 'Megaminx', t: 'mega', meth: ['mgx', 'mgf2l'] }
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
  // ---- 2x2 ----
  lbl2: {
    n: 'Layer by layer',
    sub: {
      st: X('Steps', 'Solve one layer, then the last layer. First layer on the bottom.', ['Match the side colours, not only the top.', 'R U R\' U\' puts a corner in its slot.', 'Plan the first layer in inspection.']),
      ll: X('Last layer', 'Orient the 4 top corners, then permute them.', ['Repeat Sune or Anti-Sune until all top corners are yellow.', 'Then fix the corners with T or Y.'], [
        ['#', 'Orient'], ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"],
        ['#', 'Permute'], ['Adjacent swap (T)', "R U R' U' R' F R2 U' R' U' R U R' F'"], ['Diagonal swap (Y)', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
      ])
    }
  },
  ort: {
    n: 'Ortega',
    sub: {
      o: X('Overview', 'Solve one face, orient the other face, then permute both layers.', ['1. Face (side colours do not matter)', '2. Orient: 7 algs', '3. Permute both layers (PBL)']),
      f: X('1. Face', 'Solve any face. Ignore the side colours.', ['Plan it in inspection.', 'Pick the cheapest face, not always white.']),
      oll: X('2. Orient', 'Face on the bottom. Count the yellow stickers on top, then match the case.', ['1 on top: Sune or Anti-Sune', '2 on top: U, T or L', '0 on top: Pi or H'], [
        ['#', '1 on top'], ['Sune', "R U R' U R U2 R'", 'Yellow front-left.'], ['Anti-Sune', "R U2 R' U' R U' R'", 'Mirror of Sune.'],
        ['#', '2 on top'], ['U', "F R U R' U' F'", 'Two adjacent. Other two yellows on the same side.'],
        ['T', "R U R' U' R' F R F'", 'Two adjacent. Other two yellows on opposite sides.'],
        ['L', "F R' F' R U R U' R'", 'Two diagonal. Other two yellows on adjacent sides.'],
        ['#', '0 on top'], ['Pi', "F R U R' U' R U R' U' F'", 'Bar of two on one side, one on each neighbour. Also R U2 R2 U\' R2 U\' R2 U2 R.'],
        ['H', "F R U R' U' R U R' U' R U R' U' F'", 'Bar of two on opposite sides.']
      ]),
      pbl: X('3. Permute (PBL)', 'Each layer is solved, needs an adjacent swap, or needs a diagonal swap.', ['Fix the bottom with U/D first.', 'One layer solved: use T or Y.'], [
        ['#', 'One layer'], ['Adjacent swap (T)', "R U R' U' R' F R2 U' R' U' R U R' F'"], ['Diagonal swap (Y)', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
      ])
    }
  },
  cll: {
    n: 'CLL',
    sub: {
      o: X('Overview', 'Solve one layer, then orient and permute all last-layer corners with one alg. 42 cases.', ['1. Layer', '2. One alg, then a U turn', 'Learn the Ortega orient algs first.'])
    }
  },

  // ---- 4x4 ----
  red4: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Build the 6 centers, one colour at a time.', ['Opposite centers last.', 'Use Rw/Lw/Uw to bring pieces in.']),
      e: X('Edges', 'Pair the 12 edges. Put a pair in the front-right slot and tuck it in.', ['Work in one direction so you keep your pairs.', 'Protect paired edges before turning Rw.']),
      f: X('3x3 stage', 'Solve like a 3x3, then fix parity.', ['No inner-layer turns here.']),
      p: X('Parity', 'OLL parity: one flipped edge. PLL parity: two swapped edges.', ['It shows up in the last layer.'], [
        ['OLL parity', "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"],
        ['PLL parity', "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2"]
      ])
    }
  },
  yau: {
    n: 'Yau',
    sub: {
      st: X('Steps', 'Reduction in a faster order: the cross is built early.', ['1. Two opposite centers', '2. Three cross edges', '3. Last four centers', '4. Finish the cross', '5. Pair the other 8 edges (3-2-3)', '6. 3x3 stage, cross done', 'Parity algs: see Reduction.'])
    }
  },
  hoya: {
    n: 'Hoya',
    sub: {
      st: X('Steps', 'Yau, but the cross edges come after four centers.', ['1. Four centers', '2. Cross edges', '3. Last two centers + other edges', '4. 3x3 stage', 'Parity algs: see Reduction.'])
    }
  },

  // ---- 5x5, 6x6, 7x7 ----
  red5: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Build the 6 centers. Each middle piece is fixed.', ['Opposite colours last.']),
      e: X('Edges', 'Pair 12 edges: a fixed middle piece and two wings.', ['Use a free slot. 3-cycle for the last wings.']),
      f: X('3x3 stage', 'Solve like a 3x3. No parity.')
    }
  },
  yau5: {
    n: 'Yau5',
    sub: {
      st: X('Steps', 'Yau on the 5x5: cross first.', ['1. Two opposite centers', '2. Three cross edges', '3. Other centers + last cross edge', '4. Pair the other edges (free slice)', '5. 3x3 stage. No parity.'])
    }
  },
  red6: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Each center is 4x4. Build 2x2 blocks, one colour at a time.', ['Opposite colours last.']),
      e: X('Edges', 'Pair 12 edges of 4 wings each.', ['Middle wings first, then outer wings.']),
      f: X('3x3 stage + parity', 'Solve like a 3x3. Same parity cases as the 4x4: OLL and PLL.', ['The 4x4 parity algs turn 2 layers and break the 6x6 centers. Use the 6x6 versions (3 layers, 3Rw).'])
    }
  },
  red7: {
    n: 'Reduction',
    sub: {
      c: X('Centers', 'Each center is 5x5. Build the 6 centers, one colour at a time.', ['Opposite colours last.']),
      e: X('Edges', 'Pair 12 edges: a fixed middle piece and 4 wings.', ['3-cycle for the middle edge.']),
      f: X('3x3 stage', 'Solve like a 3x3. No parity.')
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

  // ---- Pyraminx ----
  pyr: {
    n: 'Beginner',
    sub: {
      t: X('Tips', 'Turn the 4 tips (u l r b) to match their centers. Any time.', ['Tips are free.']),
      l: X('First layer', 'Solve the 3 bottom edges to match the centers.', ['Do all three at once if you can.']),
      m: X('Last layer', 'Flip the last 3 edges, then cycle them.', ['4 edge cases, 2 cycle algs.'])
    }
  },
  pyl4e: {
    n: 'V first / L4E',
    sub: {
      st: X('Steps', 'Solve a V (three centers, two edges), then the last four edges in one step.', ['Find a V in inspection.', 'Intuitive first, algs later.', 'Layer by layer is the beginner version.'])
    }
  },
  pytop: {
    n: 'Top first',
    sub: {
      st: X('Steps', 'Solve the three edges around one center first, then finish with a few algs.', ['Keyhole: 5 last-layer algs, four of them mirrors.', 'Later: Oka, WO, Nutella.'])
    }
  },

  // ---- Skewb ----
  skb: {
    n: "Sarah's beginner",
    sub: {
      s: X('Steps', 'Solve a face with its 4 corners, then the last layer with the two algs below.', ['Same grip every time.', 'Hedgehammer is the inverse of sledgehammer.'], [
        ['#', 'Algs'], ['Sledgehammer', "R' F R F'"], ['Hedgehammer', "F R' F' R"]
      ])
    }
  },
  ski: {
    n: "Sarah's intermediate",
    sub: {
      s: X('Steps', 'First layer, then the last five centers, then the last corners. Plan each sledgehammer / hedgehammer.', ['First layer: about 7 to 8 moves.', 'Look for cases that one hammer nearly solves.'], [
        ['#', 'Algs'], ['Sledgehammer', "R' F R F'"], ['Hedgehammer', "F R' F' R"]
      ])
    }
  },
  ska: {
    n: "Sarah's advanced",
    sub: {
      s: X('Steps', 'First layer, then last five centers and last corners together with one alg per case.', ['Start with the skip cases.', 'Learn intermediate first.'])
    }
  },

  // ---- Megaminx ----
  mgx: {
    n: 'Beginner',
    sub: {
      s: X('Steps', 'Like a 3x3 on 12 faces: star, first-layer corners, second layer, third layer, last layer.', ['Star first.', 'R U R\' U\' inserts corners.', 'Accuracy first.'])
    }
  },
  mgf2l: {
    n: 'F2L style',
    sub: {
      s: X('Steps', 'Star and corners, then build and insert pairs like 3x3 F2L. Last layers in two looks: edges, then corners.', ['Pair order: Westlund is the most common.', 'Look ahead.'])
    }
  }
};
Object.assign(M, MX);
