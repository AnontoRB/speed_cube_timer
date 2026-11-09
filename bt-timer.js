// bt-timer.js - QiYi Smart Timer (QY-Timer / QY-Adapter) over Web Bluetooth.
// Protocol ported from csTimer's qiyitimer.js: the timer only talks after an encrypted "hello"
// (AES-128, key 0x77 x16, CRC16-Modbus) is written to it. Timer states then drive the page's own
// timer (hold -> ready -> run -> stop), so focus mode, the cancel button and the solve list work
// exactly like the spacebar. A log panel shows everything (works on phones).
(() => {
  const SERVICE = '0000fd50-0000-1000-8000-00805f9b34fb';
  const SUFFIX = '-0000-1001-8001-00805f9b07d0';
  const CH_WRITE = '00000001' + SUFFIX;
  const CH_READ = '00000002' + SUFFIX;
  const CIC = 0x0504; // manufacturer data id that carries the timer's MAC address

  let dev = null, wChar = null, rChar = null, aes = null;
  let waitPkg = 0, payloadLen = 0, payloadData = [];
  let lastT = 0, lastAt = 0, readyT = 0, got = 0;

  // ================= log panel =================
  // The log is always collected, but the panel only pops up when debug is on (add ?btdebug to the address, or
  // run localStorage.setItem('ct2btdebug','1') once) or when the connection fails, so it can be copied and sent.
  let box = null, pre = null, closed = false;
  const lines = [];
  const dbg = (() => { try { if (localStorage.getItem('ct2btdebug') === '1') return true; } catch (e) {} return /[?&]btdebug\b/.test(location.search); })();
  function logBox() {
    if (box && box.isConnected) return;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2000;background:#000e;color:#9f9;font:11px ui-monospace,Menlo,Consolas,monospace;padding:6px;max-height:40vh;display:flex;flex-direction:column;user-select:text;-webkit-user-select:text';
    box.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:4px"><button type="button" data-bt="copy" style="min-height:32px">Copy log</button><button type="button" data-bt="close" style="min-height:32px">Close</button></div><pre style="margin:0;overflow:auto;white-space:pre-wrap;flex:1"></pre>';
    pre = box.querySelector('pre');
    pre.textContent = lines.join('');
    box.querySelector('[data-bt=close]').onclick = () => { closed = true; box.remove(); };
    box.querySelector('[data-bt=copy]').onclick = () => { try { navigator.clipboard.writeText(pre.textContent); } catch (e) {} };
    document.body.appendChild(box);
  }
  function log(t) {
    console.log('[BT]', t);
    lines.push(new Date().toISOString().slice(14, 23) + ' ' + t + '\n');
    if (lines.length > 400) lines.splice(0, lines.length - 300);   // the log must not grow forever
    if ((dbg && !closed) || (box && box.isConnected)) showLog();
  }
  function showLog() {
    logBox();
    pre.textContent = lines.join('');
    pre.scrollTop = pre.scrollHeight;
  }
  const hex = b => Array.from(b, x => (x & 255).toString(16).padStart(2, '0')).join(' ');

  // ================= AES-128 (ECB, one 16-byte block) =================
  const SBOX = new Uint8Array(256), INV = new Uint8Array(256);
  const xt = x => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
  const gm = (a, b) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };
  (() => {
    const rl = (x, n) => ((x << n) | (x >> (8 - n))) & 0xff;
    let p = 1, q = 1;
    do {
      p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
      q ^= q << 1; q &= 0xff; q ^= q << 2; q &= 0xff; q ^= q << 4; q &= 0xff;
      if (q & 0x80) q ^= 0x09;
      SBOX[p] = q ^ rl(q, 1) ^ rl(q, 2) ^ rl(q, 3) ^ rl(q, 4) ^ 0x63;
    } while (p !== 1);
    SBOX[0] = 0x63;
    for (let i = 0; i < 256; i++) INV[SBOX[i]] = i;
  })();

  function makeAes(key) {
    const rk = new Uint8Array(176);
    rk.set(key);
    for (let i = 16, rc = 1; i < 176; i += 4) {
      let t = [rk[i - 4], rk[i - 3], rk[i - 2], rk[i - 1]];
      if (i % 16 === 0) { t = [SBOX[t[1]] ^ rc, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]]; rc = xt(rc); }
      for (let j = 0; j < 4; j++) rk[i + j] = rk[i - 16 + j] ^ t[j];
    }
    const addK = (s, r) => { for (let i = 0; i < 16; i++) s[i] ^= rk[r * 16 + i]; };
    const shift = (s, inv) => {
      const o = s.slice();
      for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) s[r + 4 * (inv ? (c + r) % 4 : c)] = o[r + 4 * (inv ? c : (c + r) % 4)];
    };
    const sub = (s, box) => { for (let i = 0; i < 16; i++) s[i] = box[s[i]]; };
    const mix = (s, m) => {
      for (let c = 0; c < 4; c++) {
        const a = s.slice(4 * c, 4 * c + 4);
        for (let r = 0; r < 4; r++) s[4 * c + r] = gm(a[0], m[(4 - r) % 4]) ^ gm(a[1], m[(5 - r) % 4]) ^ gm(a[2], m[(6 - r) % 4]) ^ gm(a[3], m[(7 - r) % 4]);
      }
    };
    return {
      encrypt(b) {
        const s = Uint8Array.from(b);
        addK(s, 0);
        for (let r = 1; r < 10; r++) { sub(s, SBOX); shift(s, 0); mix(s, [2, 3, 1, 1]); addK(s, r); }
        sub(s, SBOX); shift(s, 0); addK(s, 10);
        for (let i = 0; i < 16; i++) b[i] = s[i];
      },
      decrypt(b) {
        const s = Uint8Array.from(b);
        addK(s, 10);
        for (let r = 9; r > 0; r--) { shift(s, 1); sub(s, INV); addK(s, r); mix(s, [14, 11, 13, 9]); }
        shift(s, 1); sub(s, INV); addK(s, 0);
        for (let i = 0; i < 16; i++) b[i] = s[i];
      }
    };
  }

  function crc16(bytes) {
    let crc = 0xffff;
    for (const b of bytes) {
      crc ^= b & 255;
      for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
    return crc;
  }

  // ================= sending =================
  let wMode = 'resp';
  async function writeBlock(buf) {
    if (wMode === 'noresp' && wChar.writeValueWithoutResponse) await wChar.writeValueWithoutResponse(buf);
    else if (wChar.writeValueWithResponse) await wChar.writeValueWithResponse(buf);
    else await wChar.writeValue(buf);
  }
  async function sendMessage(sendSN, ackSN, cmd, data) {
    let msg = [];
    for (const n of [sendSN, ackSN]) msg.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
    msg.push((cmd >> 8) & 255, cmd & 255, (data.length >> 8) & 255, data.length & 255);
    msg = msg.concat(data);
    const crc = crc16(msg);
    msg.push(crc >> 8, crc & 255);
    for (let i = 0; i < msg.length; i += 16) {
      const block = msg.slice(i, i + 16);
      while (block.length < 16) block.push(1);
      aes.encrypt(block);
      const out = i === 0 ? [0x00, msg.length + 2, 0x40, 0x00] : [i >> 4];
      await writeBlock(new Uint8Array(out.concat(block)).buffer);
    }
    log('TX ' + hex(msg));
  }
  function sendHello(mac) {
    const content = [0, 0, 0, 0, 0, 33, 8, 0, 1, 5, 90];
    for (let i = 5; i >= 0; i--) content.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
    return sendMessage(1, 0, 1, content);
  }
  const sendAck = (sendSN, ackSN, cmd) => sendMessage(sendSN, ackSN, cmd, [0]);

  // ================= drive the page's timer (variables come from app.js) =================
  const msg = t => { const m = document.querySelector('#msg'); if (m) m.textContent = t; };
  const BT = {
    hold() {
      if (view || mode === 'run') return;
      holding = true; ready = false;
      tm.className = 'hold';
    },
    ready() {
      if (view || mode === 'run') return;
      holding = true; ready = true;
      tm.className = 'ready';
    },
    run() {
      if (view || mode === 'run') return;
      holding = ready = false;
      clearTimeout(ht);
      pen = 0;
      mode = 'run';
      t0 = performance.now();
      ibLabel(); ib.hidden = false;
      tm.className = '';
      msg('');
      tick();
    },
    stop(ms) {
      if (view) return;
      const now = Date.now();
      if (ms === lastT && now - lastAt < 10000) return;
      lastT = ms; lastAt = now;
      holding = ready = false;
      clearTimeout(ht);
      const p = mode === 'run' ? pen : 0;
      mode = 'idle';
      ib.hidden = true;
      tm.className = '';
      add(ms, p, 'bt');
    },
    idle() {
      if (mode === 'run') return;
      holding = ready = false;
      tm.className = '';
    }
  };
  window.BT = BT;

  // ================= receiving =================
  const NAMES = ['IDLE', 'INSPECTION', 'GET_SET', 'RUNNING', 'FINISHED', 'STOPPED', 'DISCONNECT'];
  function onState(state, ms) {
    clearTimeout(readyT);
    log('STATE ' + (NAMES[state] || state) + (ms ? ' ' + ms + ' ms' : ''));
    if (state === 2) {                       // hands on the pads
      BT.hold();
      readyT = setTimeout(BT.ready, (typeof S !== 'undefined' && S.set && S.set.hold) || 300);
    } else if (state === 3) BT.run();        // hands lifted, running
    else if (state === 4) BT.stop(ms);       // stopped: ms = final time
    else if (state === 0 || state === 5 || state === 6) BT.idle();
  }

  function handlePayload(data) {
    const len = (data[10] << 8) | data[11];
    const chk = data.slice(0, len + 12).concat([data[len + 13], data[len + 12]]);
    if (crc16(chk) !== 0) { log('crc error'); return; }
    const sendSN = ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
    const ackSN = ((data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7]) >>> 0;
    const cmd = (data[8] << 8) | data[9];
    const d = data.slice(12, len + 12);
    if (cmd !== 0x1003) { log('cmd 0x' + cmd.toString(16) + ' ' + hex(d)); return; }
    const u32 = o => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;
    if (d[0] === 1 && d[1] === 1) {          // record: final solve time
      const ms = u32(8), insp = u32(12);
      log('RECORD ' + ms + ' ms (inspection ' + insp + ' ms)');
      if (Date.now() - lastAt > 10000) BT.stop(ms); // not already saved by the FINISHED state
      sendAck(ackSN + 1, sendSN, 0x1003).catch(e => log('ack failed: ' + e.message));
    } else if (d[0] === 4 && d[1] === 4) {   // timer state
      onState(d[4], u32(5));
    } else log('unknown ' + hex(d));
  }

  function onPacket(ev) {
    if (++got === 1) setStatus('Connected');   // the timer answered, so it really is connected
    const v = ev.target.value;
    let m = Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    log('RX ' + hex(m));
    try {
      if (m[0] !== waitPkg) { waitPkg = 0; payloadData = []; if (m[0] !== 0) return; }
      if (m[0] === 0) { payloadLen = m[1] - 2; m = m.slice(4); } else m = m.slice(1);
      for (let i = 0; i < m.length; i += 16) {
        const block = m.slice(i, i + 16);
        if (block.length < 16) { waitPkg = 0; payloadData = []; return; }
        aes.decrypt(block);
        payloadData = payloadData.concat(block);
      }
      if (payloadData.length < payloadLen) { waitPkg++; return; }
      const data = payloadData.slice(0, payloadLen);
      waitPkg = 0; payloadData = [];
      handlePayload(data);
    } catch (e) { log('parse error: ' + e.message); }
  }

  // ================= connecting =================
  // The hello needs the timer's real MAC. Chrome can read it from the advertisement; if not, ask.
  function macFromAdverts(device) {
    return new Promise(res => {
      if (!device.watchAdvertisements) { log('watchAdvertisements: not supported by this browser'); return res(null); }
      const ac = new AbortController();
      let n = 0, mac = null, fin = false;
      const finish = () => {
        if (fin) return; fin = true;
        clearTimeout(to); device.removeEventListener('advertisementreceived', h);
        try { ac.abort(); } catch (e) {}
        log('advertisements seen: ' + n);
        res(mac);
      };
      const h = e => {
        n++;
        const ids = [];
        if (e.manufacturerData) e.manufacturerData.forEach((dv, id) => ids.push('0x' + id.toString(16) + ': ' + hex(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength))));
        if (n <= 3) log('ADV name=' + e.name + ' rssi=' + e.rssi + ' mfr=' + (ids.join(' | ') || 'none'));
        const dv = e.manufacturerData && e.manufacturerData.get(CIC);
        if (dv && dv.byteLength >= 6 && !mac) {
          const a = [];
          for (let i = 5; i >= 0; i--) a.push(dv.getUint8(i).toString(16).padStart(2, '0'));
          mac = a.join(':');
          finish();
        }
      };
      const to = setTimeout(finish, 6000);
      device.addEventListener('advertisementreceived', h);
      device.watchAdvertisements({ signal: ac.signal }).then(() => log('watching advertisements...')).catch(e => { log('watchAdvertisements failed: ' + e.name + ': ' + e.message); finish(); });
    });
  }
  function defaultMac(name) {
    const m = /^QY-(?:Timer|Adapter).*-([0-9A-Fa-f]{4})$/.exec(name || '');
    return m ? (name.startsWith('QY-Adapter') ? 'CC:A8' : 'CC:A1') + ':00:00:' + m[1].slice(0, 2).toUpperCase() + ':' + m[1].slice(2, 4).toUpperCase() : '';
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const btn = () => document.querySelector('[data-a="bt"]');
  function setStatus(text) {
    const b = btn(); if (!b) return;
    const tx = b.querySelector('.tx'); if (tx) tx.textContent = text;
    b.title = text;
    b.classList.toggle('on', text === 'Connected');
  }

  let connecting = false;
  const hooked = new WeakSet();   // devices that already have the disconnect listener (no duplicates on reconnect)
  async function connect() {
    if (connecting) return;       // a second click while scanning must not start a second connection
    if (!navigator.bluetooth) {
      alert('Web Bluetooth is not supported here. Use Chrome or Edge on desktop or Android (not Firefox, Safari or iPhone) over HTTPS.');
      return;
    }
    connecting = true;
    try {
      got = 0; waitPkg = 0; payloadData = [];
      aes = makeAes(new Uint8Array(16).fill(0x77));
      setStatus('Scanning...');
      const reqOpts = { filters: [{ namePrefix: 'QY-Timer' }, { namePrefix: 'QY-Adapter' }], optionalServices: [SERVICE] };
      try {
        // ask for a range of company ids so the log can show which one the V2 timer really uses
        dev = await navigator.bluetooth.requestDevice({ ...reqOpts, optionalManufacturerData: Array.from({ length: 256 }, (_, i) => 0x0500 + i) });
      } catch (e) {
        if (e.name === 'NotFoundError') throw e;
        log('requestDevice with many ids failed (' + e.message + '), retrying with one id');
        dev = await navigator.bluetooth.requestDevice({ ...reqOpts, optionalManufacturerData: [CIC] });
      }
      log('Device: ' + dev.name);
      if (!hooked.has(dev)) {
        hooked.add(dev);
        dev.addEventListener('gattserverdisconnected', () => { setStatus('Bluetooth'); log('Disconnected'); clearTimeout(readyT); BT.idle(); dev = null; });
      }

      setStatus('Connecting...');
      let mac = await macFromAdverts(dev);
      log(mac ? 'MAC from advertisement: ' + mac : 'MAC not available from advertisement');
      if (!mac) {
        mac = lsGet('qiyiMac') || defaultMac(dev.name);
        const ans = prompt('Timer MAC address (like CC:A1:00:00:B4:B2). Press OK to use the suggestion.', mac);
        if (ans && /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(ans.trim())) mac = ans.trim().toUpperCase();
        log('Using MAC ' + mac);
      }
      if (!mac) throw new Error('No MAC address for the timer.');

      const server = await dev.gatt.connect();
      const service = await server.getPrimaryService(SERVICE);
      const chars = await service.getCharacteristics();
      wChar = chars.find(c => c.uuid === CH_WRITE);
      rChar = chars.find(c => c.uuid === CH_READ);
      if (!wChar || !rChar) throw new Error('Timer characteristics not found.');
      rChar.addEventListener('characteristicvaluechanged', onPacket);
      await rChar.startNotifications();
      log('Subscribed. write props: ' + ['write', 'writeWithoutResponse'].filter(k => wChar.properties[k]).join(','));
      for (const m of ['resp', 'noresp']) {
        wMode = m;
        log('Sending hello (' + (m === 'resp' ? 'write with response' : 'write without response') + ')');
        await sendHello(mac);
        for (let i = 0; i < 35 && !got; i++) await new Promise(r => setTimeout(r, 100));
        if (got) { log('Timer answered to the "' + m + '" hello.'); lsSet('qiyiMac', mac); break; }
      }
      setStatus(got ? 'Connected' : 'No reply');   // click the button again to disconnect
      log(got ? 'Ready. Touch the pads and do a solve.' : 'NO REPLY to either hello. MAC used: ' + mac);
      if (!got) { closed = false; showLog(); }   // something is wrong: show the log so it can be copied
    } catch (err) {
      setStatus('Bluetooth');
      log('Error: ' + err.message);
      if (err.name !== 'NotFoundError') { closed = false; showLog(); alert('Bluetooth failed: ' + err.message); }
    } finally {
      connecting = false;
    }
  }

  BT._t = { makeAes, crc16, handlePayload, onPacket, sendMessage, setAes: a => { aes = a; }, setW: w => { wChar = w; } };

  document.addEventListener('DOMContentLoaded', () => {
    const b = btn(); if (!b) return;
    b.addEventListener('click', () => {
      if (dev && dev.gatt && dev.gatt.connected) { dev.gatt.disconnect(); setStatus('Bluetooth'); }
      else connect();
    });
  });
})();
