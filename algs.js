// Algorithm data for the CFOP and Beginner panels.
const L = (p, a) => a.map((s, i) => [p + ' ' + (i + 1), s]);
const N = (p, a) => a.map(s => { const i = s.indexOf(' '); return [p + s.slice(0, i), s.slice(i + 1)]; });
const H = t => ['#', t];

const BEG = {
  info: 'Notation: R/L/U/D/F/B = right/left/up/down/front/back face, clockwise. A prime (\') = counter-clockwise, 2 = half turn. Hold the cube the same way for every step.',
  steps: [
    ['1. White cross (daisy)', 'Get the 4 white edges around the yellow center (the daisy). Turn U until an edge\'s side color matches its center, then turn that face 180° (F2, R2, B2 or L2) to bring it down. Repeat for all four.', ''],
    ['2. White corners', 'Put a white corner above the slot where it belongs (it sits between the two matching centers), on the front-right of the top layer. Repeat the alg until the corner is home, with white facing down. It takes 1 to 5 repeats.', "R' D' R D"],
    ['3. Middle layer edges', 'Find a top edge with no yellow. Turn U until its front color matches the front center. If it must go right use the first alg, if left use the second.', "U R U' R' U' F' U F  (right)\nU' L' U L U F U' F'  (left)"],
    ['4. Yellow cross', 'Look at the yellow edges on top: dot, L shape or line. For the L shape hold it at back-left, for the line hold it horizontal. Do the alg once for each step (dot → L → line → cross).', "F R U R' U' F'"],
    ['5. Match yellow edges', 'Turn U until at least two edges match their side centers. If two neighbours match hold them at back and right. If two opposite match hold one at the back. Do the alg, turn U, repeat until all four match.', "R U R' U R U2 R' U"],
    ['6. Place yellow corners', 'Find a corner that is already in its correct spot (ignore its twist). Hold it at front-right and do the alg. Repeat until all four corners are in the right place. If none is correct, do the alg once anywhere.', "U R U' L' U R' U' L"],
    ['7. Twist yellow corners', 'Hold an unsolved corner at front-right, yellow not up. Repeat the alg until yellow faces up. Then turn only the U face to bring the next unsolved corner to front-right. Do NOT rotate the whole cube. The cube looks scrambled mid-way. It fixes itself at the end.', "R' D' R D"]
  ]
};

const CFOP = {
  cross: {
    info: 'Solve the 4 white edges on the bottom, each matched to its center. Done by planning, not by algs.',
    tips: [
      'Plan the whole cross during the 15 s inspection, then solve with your eyes on the F2L pairs ahead.',
      'Aim for 8 moves or fewer. Look for edges that are already close to their spot.',
      'Build the cross on the bottom so you can see the F2L pieces without rotating.',
      'Later learn colour neutrality: pick the easiest colour to cross from.',
      'Fast inserts: a white edge on top above its slot is F2 (once matched). A white edge in the middle layer is F or F\' to lift it.'
    ],
    algs: []
  },
  f2l: {
    info: 'First 2 Layers: pair each corner with its edge, then insert both together into the slot. 4 slots, ~8 moves each at most.',
    tips: [
      'Learn the 4 basic cases first, then solve everything else by intuition: separate the pair, then re-join.',
      'Always look at the next pair while the current one is being inserted.',
      'Avoid cube rotations. Use U moves and d moves to set up slots instead.',
      'Keep the pair on the top or on the opposite side of its slot so insertion is easy.',
      'Slow, smooth turning with no pauses beats fast lookahead stops. Do not rush.'
    ],
    algs: [
      H('1. Basic cases'), ...L('F2L', ["R U R'", "F' U' F", "U R U' R'", "U' F' U F"]),
      H('2. Corner and edge in top'), ...L('F2L', ["U' R U' R' U R U R'", "U F' U F U' F' U' F", "U' R U R' U R U R'", "U F' U' F U' F' U' F", "d R' U2 R d' R U R'", "U' R U2 R' d R' U' R", "R U' R' U d R' U' R", "F' U F U' d' F U F'", "U F' U2 F U F' U2 F", "U' R U2 R' U' R U2 R'", "U F' U' F U F' U2 F", "U' R U R' U' R U2 R'"]),
      H('3. Corner pointing up, edge in top'), ...L('F2L', ["R U2 R' U' R U R'", "F' U2 F U F' U' F", "U R U2 R' U R U' R'", "U' F' U2 F U' F' U F", "U2 R U R' U R U' R'", "U2 F' U' F U' F' U F", "R U R' U' U' R U R' U' R U R'", "y' R' U' R U U R' U' R U R' U' R"]),
      H('4. Corner in top, edge in middle'), ...L('F2L', ["U F' U F U F' U2 F", "U' R U' R' U' R U2 R'", "U F' U' F d' F U F'", "U' R U R' d R' U' R", "R U' R' d R' U R", "R U R' U' R U R' U' R U R'"]),
      H('5. Corner in bottom, edge in top'), ...L('F2L', ["U R U' R' U' F' U F", "U' F' U F U R U' R'", "F' U F U' F' U F", "R U' R' U R U' R'", "R U R' U' R U R'", "F' U' F U F' U' F"]),
      H('6. Corner in bottom, edge in middle'), ...L('F2L', ["R U' R' U R U2 R' U R U' R'", "R U' R' U' R U R' U' R U2 R'", "R U R' U' R U' R' U d R' U' R", "R U' R' d R' U' R U' R' U' R", "R U' R' d R' U2 R U R' U2 R"])
    ]
  },
  oll: {
    info: 'Orient the Last Layer: make the whole top face yellow. Start with 2-look (10 algs), then learn the full 57 over time.',
    tips: [
      '2-look: first make the yellow cross (3 algs), then solve the corners (7 algs).',
      'Learn by shape. Group cases that share a trigger like R U R\' U\'.',
      'Practise each alg slowly until it is smooth, then speed up. Do not drill a new alg at full speed.',
      'Add a few full OLLs at a time. Start with the ones you hit most often.',
      'Look at the whole layer before you start. Recognition is half the time.'
    ],
    algs: [
      H('2-look OLL: cross'), ['Line', "F R U R' U' F'"], ['L shape', "f R U R' U' f'"], ['Dot', "F R U R' U' F' f R U R' U' f'"],
      H('2-look OLL: corners'), ['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"], ['H', "F R U R' U' R U R' U' R U R' U' F'"], ['Pi', "R U2 R2 U' R2 U' R2 U2 R"], ['U', "R2 D R' U2 R D' R' U2 R'"], ['T', "r U R' U' r' F R F'"], ['L', "F R' F' r U R U' r'"],
      H('Full OLL: crosses'), ...N('OLL ', ["27 R' U2 R U R' U R", "26 R U2 R' U' R U' R'", "25 F' r U R' U' r' F R", "24 r U R' U' r' F R F'", "22 R U2 R2 U' R2 U' R2 U2 R", "21 R U R' U R U' R' U R U2 R'", "23 R2 D R' U2 R D' R' U2 R'"]),
      H('Dots'), ...N('OLL ', ["1 R U2 R' R' F R F' U2 R' F R F'", "2 F R U R' U' F' f R U R' U' f'", "4 f R U R' U' f' U F R U R' U' F'", "3 f R U R' U' f' U' F R U R' U' F'", "19 M U R U R' U' M' R' F R F'", "18 F R U R' U y' R' U2 R' F R F'", "17 R U R' U R' F R F' U2 R' F R F'", "20 M U R U R' U' M2 U R U' r'"]),
      H('All corners oriented'), ...N('OLL ', ["57 R U R' U' M' U R U' r'", "28 M' U' M U2 M' U' M"]),
      H('Lines'), ...N('OLL ', ["55 R U2 R2 U' R U' R' U2 F R F'", "52 R U R' U R d' R U' R' F'", "51 f R U R' U' R U R' U' f'", "56 F R U R' U' R F' r U R' U' r'"]),
      H('T shapes'), ...N('OLL ', ["45 F R U R' U' F'", "33 R U R' U' R' F R F'"]),
      H('Z shapes'), ...N('OLL ', ["40 R' F R U R' U' F' U R", "39 L F' L' U' L U F U' L'"]),
      H('Big L shapes'), ...N('OLL ', ["14 R' F R U R' F' R y' R U' R'", "13 F U R U' R2 F' R U R U' R'", "16 r U r' R U R' U' r U' r'", "15 l' U' l L' U' L U l' U l"]),
      H('C shapes'), ...N('OLL ', ["46 R' U' R' F R F' U R", "34 R U R' U' x D' R' U R U' D x'"]),
      H('W shapes'), ...N('OLL ', ["38 R U R' U R U' R' U' R' F R F'", "36 L' U' L U' L' U L U L F' L' F"]),
      H('P shapes'), ...N('OLL ', ["44 f R U R' U' f'", "43 f' L' U' L U f", "31 R' U' F U R U' R' F' R", "32 F U R U' F' r U R' U' r'"]),
      H('Square shapes'), ...N('OLL ', ["35 R U2 R' R' F R F' R U2 R'", "37 F R' F' R U R U' R'", "5 r' U2 R U R' U r", "6 r U2 R' U' R U' r'"]),
      H('Small L shapes'), ...N('OLL ', ["48 F R U R' U' R U R' U' F'", "47 F' L' U' L U L' U' L U F", "50 R' F R2 B' R2 F' R2 B R'", "49 R' F R' F' R2 U2 y R' F R F'", "53 l' U' L U' L' U L U' L' U2 l", "54 r U R' U R U' R' U R U2 r'"]),
      H('Other shapes'), ...N('OLL ', ["11 F' L' U' L U F y F R U R' U' F'", "12 F R U R' U' F' U F R U R' U' F'", "7 r U R' U R U2 r'", "8 r' U' R U' R' U2 r", "10 R U R' U R' F R F' R U2 R'", "9 R U R' U' R' F R2 U R' U' F'", "29 R U R' U' R U' R' F' U' F R U R'", "42 R' F R F' R' F R F' R U R' U' R U R'", "41 R U R' U R U2 R' F R U R' U' F'", "30 L F' L' F L' U2 L d R U R'"])
    ]
  },
  pll: {
    info: 'Permute the Last Layer: move the pieces into place. 2-look PLL: corners with Aa or Y, then edges with Ua, Ub, H or Z. Learn the other perms later.',
    tips: [
      'Recognise by looking for headlights (two matching corners side by side) and blocks of matching colours.',
      'Turn U (AUF) at the end to finish. Plan it as you do the alg.',
      'Do not rotate the cube during an alg. The rotations x, y in the list are one-time setups.',
      'Start with 2-look PLL (6 algs), then add T, J, Y, F, R, V, N, G.',
      'Never pause before the last U turn. A pause there costs more time than any alg.'
    ],
    algs: [
      H('Edges only'), ...N('', ["H M2 U M2 U2 M2 U M2", "Z M' U M2 U M2 U M' U2 M2", "Ua R2 U' R' U' R U R U R U' R", "Ub R' U R' U' R' U' R' U R U R2"]),
      H('Corners only'), ...N('', ["Aa x R' U R' D2 R U' R' D2 R2", "Ab x R2 D2 R U R' D2 R U' R", "E x' R U' R' D R U R' D' R U R' D R U' R' D'"]),
      H('Edges and corners'), ...N('', ["T R U R' U' R' F R2 U' R' U' R U R' F'", "Y F R U' R' U' R U R' F' R U R' U' R' F R F'", "F R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", "V R' U R' U' y R' F' R2 U' R' U R' F R F", "Ja R' U L' U2 R U' R' U2 R L", "Jb R U R' F' R U R' U' R' F R2 U' R'", "Ra R U' R' U' R U R D R' U' R D' R' U2 R'", "Rb R' U2 R U2 R' F R U R' U' R' F' R2", "Na R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", "Nb R' U R U' R' F' U' F R U R' F R' F' R U' R", "Ga R2 U R' U R' U' R U' R2 D U' R' U R D'", "Gb R' U' R U D' R2 U R' U R U' R U' R2 D", "Gc R2 U' R U' R U R' U R2 D' U R U' R' D", "Gd R U R' U' D R2 U' R U' R' U R' U R2 D'"])
    ]
  }
};

// ---- All methods in one structure: method -> tabs -> [heading '#', text 't', or [name, alg]] ----
const T = s => ['t', s];
const B3 = s => s.split('\n').map(x => { const m = x.match(/^(.*?)\s+\((.*)\)$/); return m ? [m[2], m[1]] : ['Alg', x]; });
const OC = CFOP.oll.algs.slice(5, 12); // 7 corner orientation algs (Sune ... L)

const M = {
  beg: {
    n: 'Beginner',
    sub: {
      steps: {
        n: 'Steps',
        info: BEG.info,
        tips: [
          'Solve one layer at a time and keep the cube in the same orientation.',
          'Slow and accurate beats fast. Speed comes later.'
        ],
        algs: BEG.steps.flatMap(s => [H(s[0]), T(s[1]), ...(s[2] ? B3(s[2]) : [])])
      }
    }
  },
  cfop: {
    n: 'CFOP',
    sub: Object.fromEntries(Object.entries(CFOP).map(([k, v]) => [k, { n: k.toUpperCase(), ...v }]))
  },
  zz: {
    n: 'ZZ',
    sub: {
      eo: {
        n: 'EOLine',
        info: 'Orient all 12 edges and place the DF and DB edges (the line) in one step. About 6 to 7 moves, planned in inspection. No algs.',
        tips: [
          'Quarter turns of F and B flip edges. R, L, U and D turns never flip them.',
          'Count the "bad" edges (the ones that need F or B to be solved). Fix them with as few F/B turns as possible.',
          'Place DF and DB while you orient, so the line is built at the same time.',
          'After EOLine you never use F or B again until the last layer.'
        ],
        algs: []
      },
      f2l: {
        n: 'F2L',
        info: 'Build the left 1x2x3 block, then the right one, using only R, L, U (and D) turns. Edges stay oriented, so there are no F or B moves.',
        tips: [
          'Solve the left block first, then the right block.',
          'Use the same pair triggers as CFOP: R U R\' and R U\' R\'.',
          'With only 3 faces turning, lookahead is much easier. Use it.',
          'Finish the last pair on the right without disturbing the left block.'
        ],
        algs: []
      },
      ll: {
        n: 'Last layer',
        info: 'After F2L the edges are already oriented. Use OCLL to orient the corners (7 algs), then PLL. Full ZBLL (493 algs) does it in one step for advanced solvers.',
        tips: [
          'OCLL: 7 cases, learn them once.',
          'PLL: see the CFOP tab. Start with Ua, Ub, H, Z, Aa and Y.'
        ],
        algs: [H('OCLL'), ...OC]
      }
    }
  },
  roux: {
    n: 'Roux',
    sub: {
      fb: {
        n: 'First block',
        info: 'Build a 1x2x3 block on the left (DL edge, two left corners and two left edges). Intuitive, about 7 moves.',
        tips: [
          'Plan the DL edge first, then the corners, then the middle edges.',
          'Use only left-side moves so you can look ahead.',
          'Aim for 7 moves or fewer.'
        ],
        algs: []
      },
      sb: {
        n: 'Second block',
        info: 'Build a second 1x2x3 block on the right using R, r, U and M turns, without breaking the first block.',
        tips: [
          'Solve the DR edge, then the right corner and edge together.',
          'Use r and U moves. M moves can bring pieces in without touching the blocks.',
          'Look ahead to the CMLL case while you finish.'
        ],
        algs: []
      },
      cmll: {
        n: 'CMLL',
        info: 'Solve the 4 top corners and ignore the edges. Full CMLL is 42 algs. Beginners do it in two looks.',
        tips: [
          'Look 1: orient all corners with the 7 algs below (R, U, F only).',
          'Look 2: permute the corners with the two algs at the bottom. Edges get scrambled, LSE fixes them.',
          'Later learn the full 42 CMLL algs to do it in one look.'
        ],
        algs: [
          H('Orient corners'),
          ['Sune', "R U R' U R U2 R'"],
          ['Anti-Sune', "R U2 R' U' R U' R'"],
          ['H', "F R U R' U' R U R' U' R U R' U' F'"],
          ['Pi', "R U2 R2 U' R2 U' R2 U2 R"],
          ['U', "R2 D R' U2 R D' R' U2 R'"],
          ['T', "R U R' U' R' F R F'"],
          ['L', "F R' F' R U R U' R'"],
          H('Permute corners'),
          ['Adjacent swap', "R U R' F' R U R' U' R' F R2 U' R'"],
          ['Diagonal swap', "F R U' R' U' R U R' F' R U R' U' R' F R F'"]
        ]
      },
      lse: {
        n: 'LSE',
        info: 'Solve the last 6 edges and the centers with only M and U turns: orient edges, place UL and UR, then finish with M2 and U moves.',
        tips: [
          'Step 1: orient the edges (EO) with M and U moves.',
          'Step 2: put the UL and UR edges on the correct sides.',
          'Step 3: finish with the 4 algs below.',
          'Only M and U turns, so it is very ergonomic and fast.'
        ],
        algs: [
          ['H', "M2 U M2 U2 M2 U M2"],
          ['Z', "M' U M2 U M2 U M' U2 M2"],
          ['Ua', "M2 U M U2 M' U M2"],
          ['Ub', "M2 U' M U2 M' U' M2"]
        ]
      }
    }
  },
  petrus: {
    n: 'Petrus',
    sub: {
      blk: {
        n: '2x2x3 block',
        info: 'Build a 2x2x2 block, then expand it to a 2x2x3. All intuitive, no algs.',
        tips: [
          'Start with a 2x2x2 in one corner and plan it in inspection.',
          'Expand to 2x2x3 by adding a pair next to the block while keeping the block together.',
          'Most later moves are R, U and L.'
        ],
        algs: []
      },
      eo: {
        n: 'Edge orientation',
        info: 'Orient all remaining edges without breaking the 2x2x3 block. This removes edge-flipping moves from the rest of the solve.',
        tips: [
          'Same idea as ZZ: bad edges are the ones that need F or B turns.',
          'Look for edges you can flip while building the next pair.',
          'After EO you only need R, U and L turns.'
        ],
        algs: []
      },
      f2l: {
        n: 'Finish F2L',
        info: 'Solve the last F2L pairs with R, U and L moves only, so EO stays intact.',
        tips: [
          'Insert the remaining pairs with R U R\' style triggers.',
          'Keep the block on the left and use R and U.'
        ],
        algs: []
      },
      ll: {
        n: 'Last layer',
        info: 'Edges are oriented, so use OCLL (7 algs) then PLL. Advanced solvers use COLL or ZBLL.',
        tips: ['Same last-layer algs as ZZ and CFOP.'],
        algs: [H('OCLL'), ...OC]
      }
    }
  }
};