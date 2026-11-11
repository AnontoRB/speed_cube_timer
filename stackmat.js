// stackmat.js - wired Stackmat timers (audio cable, or USB sound adapter) read through the microphone input.
// The timer sends its time as a 1200 baud serial signal in the sound: 8N1, packets of
// status char + 6 digits (m ss mmm) + checksum + CR. The decoder tries the normal and the inverted signal.
// It drives the page's own timer through window.BT (from bt-timer.js), like the Bluetooth timer does.
//
// Out of the box: the first time a new sound input is plugged in, the browser asks once for microphone access.
// If the Stackmat signal is heard, the input is remembered and from then on it connects by itself whenever
// it is plugged in and the site is open. The mic is only opened while that input is present.
(() => {
  const KEY = 'ct2sm', DEV = 'ct2smdev';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  let ctx = null, stream = null, proc = null, src = null, probeT = 0;
  let heard = false, manualOff = false, starting = false, known = 0;
  let prev = '', lastMs = 0, readyT = 0, running = false;

  const btn = () => document.querySelector('[data-a="sm"]');
  function setStatus(text, on) {
    const b = btn(); if (!b) return;
    const tx = b.querySelector('.tx'); if (tx) tx.textContent = text;
    b.title = text;
    b.classList.toggle('on', !!on);
  }
  const note = t => { const m = document.querySelector('#msg'); if (m && mode === 'idle') m.textContent = t; };

  // ================= decoder =================
  // One UART decoder per polarity. Levels are pushed as 0/1; bytes come out through onByte.
  function Uart(sr, onByte) {
    const bp = sr / 1200;
    let lv = [], pos = 1;
    return {
      push(a) {
        for (let i = 0; i < a.length; i++) lv.push(a[i]);
        const need = Math.ceil(bp * 10.5);
        while (pos < lv.length) {
          // start bit = idle (1) followed by 0
          if (!(lv[pos - 1] === 1 && lv[pos] === 0)) { pos++; continue; }
          if (pos + need >= lv.length) break;   // wait for more samples
          let ok = lv[Math.round(pos + bp * 0.5)] === 0 && lv[Math.round(pos + bp * 9.5)] === 1, b = 0;
          if (ok) {
            for (let k = 0; k < 8; k++) b |= lv[Math.round(pos + bp * (1.5 + k))] << k;   // LSB first
            onByte(b);
            pos = Math.round(pos + bp * 9.5);
          } else pos++;
        }
        if (pos > 20000) { lv = lv.slice(pos - 1); pos = 1; }
      }
    };
  }

  // Packet assembly + checksum. Status: I reset, A armed/ready, L/R/C hands on, ' ' running, S stopped.
  function Packets(onPacket) {
    let bytes = [];
    return b => {
      if (b !== 13) { bytes.push(b); if (bytes.length > 14) bytes.shift(); return; }
      let p = bytes; bytes = [];
      while (p.length && p[p.length - 1] === 10) p.pop();
      if (p.length < 8) return;
      p = p.slice(p.length - 8);
      const d = p.slice(1, 7).map(c => c - 48);
      if (d.some(x => x < 0 || x > 9)) return;
      if (p[7] !== 64 + d.reduce((a, x) => a + x, 0)) return;   // checksum
      onPacket(String.fromCharCode(p[0]), d[0] * 60000 + (d[1] * 10 + d[2]) * 1000 + d[3] * 100 + d[4] * 10 + d[5]);
    };
  }

  // ================= drive the page's timer =================
  function onPacket(st, ms) {
    if (!window.BT) return;
    if (!heard) {
      heard = true;
      clearTimeout(probeT);
      lsSet(KEY, '1');
      const id = stream && stream.getAudioTracks()[0] && stream.getAudioTracks()[0].getSettings().deviceId;
      if (id) lsSet(DEV, id);
      setStatus('Stackmat connected', true);
      note('Stackmat timer connected');
    }
    const was = prev; prev = st;
    if (st === was && st !== ' ' ) return;
    clearTimeout(readyT);
    const hold = (typeof S !== 'undefined' && S.set && S.set.hold) || 300;
    if (st === 'L' || st === 'R') { if (!running) BT.hold(); }
    else if (st === 'C') { if (!running) { BT.hold(); readyT = setTimeout(BT.ready, hold); } }
    else if (st === 'A') { if (!running) BT.ready(); }
    else if (st === ' ') {
      if (!running && ms < 1000 && was !== 'S') { running = true; BT.run(); }
    } else if (st === 'S') {
      if (running || was === ' ') { running = false; lastMs = ms; BT.stop(ms); }
    } else if (st === 'I') { running = false; BT.idle(); }
  }

  // ================= audio =================
  function stop(why) {
    clearTimeout(probeT); clearTimeout(readyT);
    try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) {}
    try { if (src) src.disconnect(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (ctx) ctx.close(); } catch (e) {}
    ctx = stream = proc = src = null; prev = ''; running = false;
    if (heard) { heard = false; if (window.BT) BT.idle(); }
    setStatus(lsGet(KEY) ? 'Stackmat' : 'Stackmat', false);
  }

  async function start(deviceId, probe) {
    if (stream || starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    starting = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { ideal: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const sr = ctx.sampleRate;
      // normal and inverted signal, each with its own packet buffer: whichever gives valid packets wins
      const u1 = Uart(sr, Packets(onPacket)), u2 = Uart(sr, Packets(onPacket));
      src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      proc.onaudioprocess = e => {
        const x = e.inputBuffer.getChannelData(0), n = x.length, a = new Uint8Array(n), b = new Uint8Array(n);
        for (let i = 0; i < n; i++) { const hi = x[i] > 0 ? 1 : 0; a[i] = hi; b[i] = hi ^ 1; }
        u1.push(a); u2.push(b);
      };
      src.connect(proc); proc.connect(ctx.destination);   // output stays silent (we never write to it)
      stream.getAudioTracks()[0].addEventListener('ended', () => stop('ended'));
      setStatus('Listening...', false);
      // the first time we only listen for a few seconds, so a normal microphone is not kept open for nothing
      if (probe) probeT = setTimeout(() => { if (!heard) { stop('no signal'); note('No Stackmat signal heard. Turn the timer on and click Stackmat.'); } }, 12000);
    } catch (err) {
      stream = null;
      setStatus('Stackmat', false);
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) note('Microphone access was blocked. Allow it for this site to use a Stackmat timer.');
    } finally { starting = false; }
  }

  // ================= automatic start =================
  async function inputs() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { return []; }
  }
  async function auto(newOne) {
    if (manualOff || stream || starting || !navigator.mediaDevices) return;
    const list = await inputs(), id = lsGet(DEV);
    if (lsGet(KEY) && id && list.some(d => d.deviceId === id)) return start(id, false);   // a known Stackmat input is plugged in
    if (newOne) return start(null, true);   // a new sound input appeared: listen for a Stackmat signal for a few seconds
  }

  document.addEventListener('DOMContentLoaded', async () => {
    known = (await inputs()).length;
    const b = btn();
    if (b) b.addEventListener('click', () => {
      if (stream) { manualOff = true; stop('manual'); lsSet(KEY, ''); return; }
      manualOff = false; start(lsGet(DEV), true);
    });
    auto(false);
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const n = (await inputs()).length, more = n > known;
        known = n;
        if (stream && !n) return stop('unplugged');
        if (stream) {   // the input we use is gone?
          const id = lsGet(DEV), list = await inputs();
          if (id && heard && !list.some(d => d.deviceId === id)) return stop('unplugged');
          return;
        }
        auto(more);
      });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); auto(false); } });
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }, { passive: true }));
  });

  // for tests
  window.SM = { Uart, Packets, onPacket };
})();
