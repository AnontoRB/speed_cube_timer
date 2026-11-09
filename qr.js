// Tiny QR code generator for the recovery key. No libraries, no network.
// Byte mode, error correction level M, versions 1 to 6 (up to 84 bytes of text).
// qrMatrix(text) -> array of rows of booleans (true = dark). qrSvg(text) and qrCanvas(text) draw it.
const qrMatrix = (() => {
  // Reed-Solomon over GF(256)
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  const gen = n => {
    let g = [1];
    for (let i = 0; i < n; i++) {
      const r = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) { r[j] ^= g[j]; r[j + 1] ^= mul(g[j], EXP[i]); }
      g = r;
    }
    return g;
  };
  const ecc = (data, n) => {
    const g = gen(n), r = new Array(n).fill(0);
    for (const d of data) {
      const f = d ^ r.shift();
      r.push(0);
      if (f) for (let i = 0; i < n; i++) r[i] ^= mul(g[i + 1], f);
    }
    return r;
  };

  // version -> [error-correction bytes per block, number of blocks, data bytes per block] (level M)
  const V = { 1: [10, 1, 16], 2: [16, 1, 28], 3: [26, 1, 44], 4: [18, 2, 32], 5: [24, 2, 43], 6: [16, 4, 27] };
  const ALIGN = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };

  return text => {
    const bytes = [...new TextEncoder().encode(String(text))];
    let ver = 1;
    while (ver <= 6 && bytes.length > V[ver][1] * V[ver][2] - 2) ver++;
    if (ver > 6) throw new Error('Text too long for the QR code');
    const [ecn, nb, dpb] = V[ver], total = nb * dpb;

    // data bits: mode 0100 (bytes), 8-bit length, the bytes, terminator, padding
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
    for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0xec; data.length < total; p ^= 0xec ^ 0x11) data.push(p);

    // split into blocks, add error correction, interleave
    const blocks = [], ecs = [];
    for (let b = 0; b < nb; b++) { const d = data.slice(b * dpb, (b + 1) * dpb); blocks.push(d); ecs.push(ecc(d, ecn)); }
    const all = [];
    for (let i = 0; i < dpb; i++) blocks.forEach(b => all.push(b[i]));
    for (let i = 0; i < ecn; i++) ecs.forEach(e => all.push(e[i]));
    const stream = [];
    all.forEach(b => put2(stream, b));
    function put2(a, v) { for (let i = 7; i >= 0; i--) a.push((v >>> i) & 1); }

    // matrix with the fixed patterns
    const sz = 17 + 4 * ver;
    const m = Array.from({ length: sz }, () => Array(sz).fill(false));
    const fn = Array.from({ length: sz }, () => Array(sz).fill(false));
    const set = (x, y, v) => { m[y][x] = v; fn[y][x] = true; };
    for (const [cx, cy] of [[0, 0], [sz - 7, 0], [0, sz - 7]]) {
      for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= sz || y >= sz) continue;
        const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
        set(x, y, d !== 2 && d !== 4);
      }
    }
    for (let i = 8; i < sz - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    if (ALIGN[ver]) {
      const c = ALIGN[ver];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const format = mask => {
      const d = mask;   // error correction level M = 00
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const f = ((d << 10) | r) ^ 0x5412, bit = i => ((f >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(sz - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, sz - 15 + i, bit(i));
      set(8, sz - 8, true);
    };
    format(0);

    // place the data bits in the zig-zag order
    let k = 0;
    for (let right = sz - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < sz; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? sz - 1 - v : v;
        if (!fn[y][x] && k < stream.length) m[y][x] = stream[k++] === 1;
      }
    }

    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    const apply = n => { for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) if (!fn[y][x] && MASKS[n](x, y)) m[y][x] = !m[y][x]; };
    const PAT = [true, false, true, true, true, false, true, false, false, false, false];
    const penalty = () => {
      let p = 0;
      const line = get => {
        let run = 1;
        for (let i = 1; i < sz; i++) {
          if (get(i) === get(i - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
        for (let i = 0; i + 11 <= sz; i++) {
          let a = true, b = true;
          for (let j = 0; j < 11; j++) { if (get(i + j) !== PAT[j]) a = false; if (get(i + j) !== PAT[10 - j]) b = false; }
          if (a) p += 40;
          if (b) p += 40;
        }
      };
      for (let i = 0; i < sz; i++) { line(j => m[i][j]); line(j => m[j][i]); }
      for (let y = 0; y < sz - 1; y++) for (let x = 0; x < sz - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
      let dark = 0;
      m.forEach(r => r.forEach(v => { if (v) dark++; }));
      p += Math.floor(Math.abs(dark * 20 - sz * sz * 10) / (sz * sz)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let n = 0; n < 8; n++) {
      apply(n); format(n);
      const p = penalty();
      if (p < bestP) { bestP = p; best = n; }
      apply(n);
    }
    apply(best); format(best);
    return m;
  };
})();

// SVG markup (black on white with the 4-module quiet zone scanners need).
function qrSvg(text) {
  const m = qrMatrix(text), q = 4, n = m.length + 2 * q;
  let d = '';
  m.forEach((row, y) => row.forEach((v, x) => { if (v) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z'; }));
  return '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="Recovery QR code"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}

// Canvas, for saving the QR code as an image.
function qrCanvas(text, scale = 8) {
  const m = qrMatrix(text), q = 4, n = m.length + 2 * q, c = document.createElement('canvas');
  c.width = c.height = n * scale;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000';
  m.forEach((row, y) => row.forEach((v, i) => { if (v) x.fillRect((i + q) * scale, (y + q) * scale, scale, scale); }));
  return c;
}
