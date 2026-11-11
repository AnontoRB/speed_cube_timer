// stackmat.js - wired Stackmat timers (audio cable, or USB sound adapter) read through the microphone input.
// The timer sends its time as a 1200 baud serial signal in the sound: 8N1, packets of
// status char + 6 digits (m ss mmm) + checksum + CR. The decoder tries the normal and the inverted signal.
// It drives the page's own timer through window.BT (from bt-timer.js), like the Bluetooth timer does.
//
// Used by the timer menu (timer-menu.js): the first time you pick the sound input there; afterwards it
// listens by itself whenever that input is plugged in and the site is open (SM.auto).
(() => {
  const DEV = 'ct2smdev', LAB = 'ct2smlab';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  let ctx = null, stream = null, proc = null, src = null, probeT = 0;
  let heard = false, starting = false, known = 0;
  let prev = '', lastMs = 0, readyT = 0, inspT = 0, running = false;

  function setStatus(text, on) { if (window.TM) TM.status('sm', text, !!on); }
  const note = t => { const m = document.querySelector('#msg'); if (m && mode === 'idle') m.textContent = t; };

  // ================= decoder =================
  // One UART decoder per polarity. Levels are pushed as 0/1; bytes come out through onByte.
  function Uart(sr, onByte) {
    const bp = sr / 1200, q = bp / 4;
    let lv = [], pos = 1;
    // a bit is read as the majority of 3 samples around its middle
    const bit = c => (lv[Math.round(c - q)] + lv[Math.round(c)] + lv[Math.round(c + q)]) >= 2 ? 1 : 0;
    return {
      push(a) {
        for (let i = 0; i < a.length; i++) lv.push(a[i]);
        const need = Math.ceil(bp * 10.5);
        while (pos < lv.length) {
          // start bit = idle (1) followed by 0
          if (!(lv[pos - 1] === 1 && lv[pos] === 0)) { pos++; continue; }
          if (pos + need >= lv.length) break;   // wait for more samples
          if (bit(pos + bp * 0.5) === 0 && bit(pos + bp * 9.5) === 1) {
            let b = 0;
            for (let k = 0; k < 8; k++) b |= bit(pos + bp * (1.5 + k)) << k;   // LSB first
            onByte(b);
            pos = Math.round(pos + bp * 9.5);
          } else pos++;
        }
        if (pos > 20000) { lv = lv.slice(pos - 1); pos = 1; }
      }
    };
  }

  // Turns raw audio samples into 0/1 levels. The threshold follows the signal (middle of its high and low),
  // so a weak signal, a signal that is not centred on zero, or noise on the line still decode.
  function Slicer() {
    let hi = 0, lo = 0, lvl = 1;
    return {
      run(x) {
        const out = new Uint8Array(x.length);
        for (let i = 0; i < x.length; i++) {
          const v = x[i];
          if (v > hi) hi = v; else hi += (v - hi) * 0.0003;
          if (v < lo) lo = v; else lo += (v - lo) * 0.0003;
          const r = hi - lo;
          if (r > 0.006) {                      // something is there (not silence)
            const t = (hi + lo) / 2, h = r * 0.12;
            if (v > t + h) lvl = 1; else if (v < t - h) lvl = 0;
          } else lvl = 1;
          out[i] = lvl;
        }
        return out;
      },
      range: () => hi - lo
    };
  }

  // Second way of turning samples into 0/1 levels, for inputs that are AC coupled (most microphone jacks): the signal
  // then slowly drifts back to zero, so a fixed middle line is wrong. Here only the EDGES count: a big step up
  // sets 1, a big step down sets 0, and the level is held in between.
  function EdgeSlicer(sr) {
    const k = Math.max(2, Math.round(sr / 1200 / 3)), h = new Float32Array(k);
    let p = 0, pk = 0, lvl = 1;
    return {
      run(x) {
        const out = new Uint8Array(x.length);
        for (let i = 0; i < x.length; i++) {
          const v = x[i], d = v - h[p], a = d < 0 ? -d : d;
          h[p] = v; p = p + 1 === k ? 0 : p + 1;
          if (a > pk) pk = a; else pk -= pk * 0.00005;
          if (pk > 0.004) { const t = pk * 0.4; if (d > t) lvl = 1; else if (d < -t) lvl = 0; } else lvl = 1;
          out[i] = lvl;
        }
        return out;
      },
      range: () => pk
    };
  }

  // One decoder set for a stream: every channel, normal and inverted. Whichever gives valid packets wins.
  function Decoder(sr, nch, onPacket, diag) {
    const sl = [], us = [];   // sl[c * 2 + s]: level slicer (s = 0) and edge slicer (s = 1) of channel c
    let lock = -1, lastPk = 0, tot = 0;   // lock = the decoder in use; released after 2 s without packets
    for (let c = 0; c < nch; c++) {
      sl.push(Slicer(), EdgeSlicer(sr));
      for (const inv of [0, 1]) for (const sx of [0, 1]) {
        const id = us.length;
        // each decoder has its own packet buffer; the first one that gives a valid packet is the only one used
        // (the other channel or polarity would repeat the same packets, in a different order)
        const p = Packets((st, ms) => {
          if (lock !== -1 && lock !== id) return;
          lock = id; lastPk = tot;
          diag.packets++; onPacket(st, ms);
        });
        us.push({ c, sx, inv, u: Uart(sr, b => { diag.bytes++; diag.last.push(b); if (diag.last.length > 12) diag.last.shift(); p(b); }) });
      }
    }
    return chans => {
      tot += chans[0].length;
      if (lock !== -1 && tot - lastPk > sr * 2) lock = -1;
      const lev = sl.map((z, i) => z.run(chans[i >> 1]));
      let peak = 0;
      for (let c = 0; c < nch; c++) { const x = chans[c]; for (let i = 0; i < x.length; i += 8) { const a = Math.abs(x[i]); if (a > peak) peak = a; } }
      diag.peak = peak;
      for (const o of us) {
        const L = lev[o.c * 2 + o.sx];
        if (!o.inv) o.u.push(L);
        else { const a = L, b = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) b[i] = a[i] ^ 1; o.u.push(b); }
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
  // The solve ends in whichever way the timer shows it, so several signs are used:
  //  - status 'S' (stopped), or any other status than "running" while a solve runs (hands on the pads again)
  //  - the time stops changing for a few packets
  // 'I' with 0:00.000 is a reset: it also cancels a run that never got its stop.
  let sameN = 0, lastSeen = -1, doneMs = -1, info = '', bothOn = false, restarts = 0;
  const hist = [];   // the last status changes, shown in the Timer window
  const NAMES = { I: 'reset', A: 'ready', C: 'both hands', L: 'left hand', R: 'right hand', ' ': 'running', S: 'stopped' };
  const fmt = ms => (ms / 1000).toFixed(3);
  function finish(ms) { running = false; doneMs = ms; lastMs = ms; BT.stop(ms); }
  function onPacket(st, ms) {
    if (!window.BT) return;
    if (!heard) {
      heard = true;
      clearTimeout(probeT);
      remember();
      setStatus('Connected', true);
      note('Stackmat timer connected');
    }
    info = (NAMES[st] || 'status "' + st + '"') + ' ' + fmt(ms);
    if (ms === lastSeen) sameN++; else { sameN = 0; lastSeen = ms; }
    const was = prev; prev = st;
    const stale = doneMs > 0 && ms === doneMs;          // still showing the time of the solve just saved
    if (!stale) doneMs = -1;

    if (running) {
      if (st === ' ') { if (sameN >= 4 && ms > 0) finish(ms); return; }        // the time froze: stopped
      if (st === 'I' && ms === 0) { running = false; BT.abort(); return; }     // reset during a run: cancel
      if (ms === 0) { running = false; BT.abort(); return; }                  // a 0 time is not a solve
      finish(ms); return;                                                      // 'S', or hands back on the pads
    }
    if (st === was && st !== ' ') return;
    clearTimeout(readyT);
    hist.push((NAMES[st] || 'status') + '[' + (st === ' ' ? 'space' : st) + '] ' + fmt(ms)); if (hist.length > 10) hist.shift();
    // ONE pad (the right one) touched alone and then let go, without both hands ever being on: start the inspection.
    // Both hands on the pads (C / A) and then lifted is the normal start of the solve and never starts an inspection.
    const side = typeof S !== 'undefined' && S.set && S.set.padsw ? 'L' : 'R';
    const tapped = was === side && st !== side && st !== 'C' && st !== 'L' && st !== 'R' && st !== ' ' && !bothOn && !stale;
    if (st === 'C' || st === 'A') bothOn = true; else if (st === 'I' || st === ' ' || st === 'S') bothOn = false;
    if (tapped && typeof S !== 'undefined' && S.set && (S.set.rins || S.set.insp)) BT.inspect();
    const hold = (typeof S !== 'undefined' && S.set && S.set.hold) || 300;
    if (st === ' ') {
      if (!stale && ms < 3000) { running = true; BT.run(); }
    } else if (stale) { /* hands still on after the stop: nothing to show */ }
    else if (st === 'L' || st === 'R') BT.hold();
    else if (st === 'C') { BT.hold(); readyT = setTimeout(BT.ready, hold); }
    else if (st === 'A') BT.ready();
    else if (st === 'I') { BT.idle(); if (ms === 0) BT.clear(); }
    if (typeof mode !== 'undefined' && mode === 'run' && st !== ' ' && !running) BT.abort();   // the page is stuck in a run the timer does not know about
  }

  // ================= audio =================
  function remember() {
    const t = stream && stream.getAudioTracks()[0];
    if (!t) return;
    const id = t.getSettings && t.getSettings().deviceId;
    if (id) lsSet(DEV, id);
    if (t.label) lsSet(LAB, t.label);
  }
  function stop() {
    clearTimeout(probeT); clearTimeout(readyT); clearTimeout(inspT); clearTimeout(waitT);
    try { if (proc) { proc.onaudioprocess = null; proc.disconnect(); } } catch (e) {}
    try { if (src) src.disconnect(); } catch (e) {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { if (ctx) ctx.close(); } catch (e) {}
    ctx = stream = proc = src = null; prev = ''; running = false;
    if (heard) { heard = false; if (window.BT) BT.idle(); }
    setStatus('Wired', false);
  }
  let waitT = 0;
  const diag = { bytes: 0, packets: 0, last: [], peak: 0, sr: 0, nch: 0 };
  // what the page hears, shown in the wired window while it is listening
  function report() {
    if (!stream) return 'Not listening';
    if (heard) return 'Connected';
    const lvl = Math.min(100, Math.round(diag.peak * 100));
    if (lvl < 1) return 'Listening, but the input is silent (0%). Check the cable is in the microphone jack, the timer is on, and the input volume is up.';
    if (!diag.bytes) return 'Listening: sound level ' + lvl + '%, but it does not look like a timer signal yet.';
    return 'Listening: sound level ' + lvl + '%, ' + diag.bytes + ' bytes, ' + diag.packets + ' timer packets. Last bytes: ' + diag.last.map(b => b.toString(16).padStart(2, "0")).join(" ");
  }

  // o.probe: stop again after 12 s if no Stackmat signal is heard (used for inputs that just appeared)
  // o.exact: use exactly this input (the one chosen in the menu)
  async function start(deviceId, o = {}) {
    if (stream || starting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus('No microphone support', false); return; }
    starting = true; restarts++;
    try {
      const dv = deviceId ? (o.exact ? { exact: deviceId } : { ideal: deviceId }) : undefined;
      stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: dv, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 2 } } });
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const sr = ctx.sampleRate;
      const nch = Math.min(2, stream.getAudioTracks()[0].getSettings().channelCount || 2);
      diag.bytes = 0; diag.packets = 0; diag.last = []; diag.peak = 0; diag.sr = sr; diag.nch = nch;
      const dec = Decoder(sr, nch, onPacket, diag);
      src = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, nch, 1);
      proc.onaudioprocess = e => { const ch = []; for (let c = 0; c < nch; c++) ch.push(e.inputBuffer.getChannelData(c)); dec(ch); };
      src.connect(proc); proc.connect(ctx.destination);   // output stays silent (we never write to it)
      stream.getAudioTracks()[0].addEventListener('ended', () => stop());
      remember();
      setStatus('Listening, turn the timer on', false);
      // some browsers keep sound paused until the page is touched once
      waitT = setTimeout(() => { if (ctx && ctx.state === 'suspended') setStatus('Click the page once to start listening', false); }, 1500);
      if (o.probe) probeT = setTimeout(() => { if (!heard) { stop(); setStatus('No Stackmat signal heard', false); } }, 12000);
    } catch (err) {
      stream = null;
      const blocked = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      setStatus(blocked ? 'Microphone blocked' : err && err.name === 'NotFoundError' ? 'Input not found' : 'Wired', false);
    } finally { starting = false; }
  }

  // ================= inputs and automatic start =================
  async function inputs() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch (e) { return []; }
  }
  // Ask for the microphone once (needed so the browser shows the names of the inputs), then list them.
  async function listInputs() {
    try { const t = await navigator.mediaDevices.getUserMedia({ audio: true }); t.getTracks().forEach(x => x.stop()); }
    catch (e) { return { error: e && e.name }; }
    return { list: await inputs() };
  }
  const saved = list => { const id = lsGet(DEV), lab = lsGet(LAB); return list.find(d => id && d.deviceId === id) || list.find(d => lab && d.label && d.label === lab); };
  async function auto(newOne) {
    if (!SM.enabled || stream || starting || !navigator.mediaDevices) return;
    const list = await inputs(), d = saved(list);
    if (d) return start(d.deviceId, { exact: true });          // the input you chose is plugged in
    if (newOne) return start(null, { probe: true });   // a new sound input appeared: listen for a few seconds
  }

  const SM = window.SM = { ver: 'wired-2026-11-11d', restarts: () => restarts, hist: () => hist.join('  >  '), info: () => info, Decoder, Slicer, diag, report, Uart, Packets, onPacket, enabled: false, start, stop, auto, inputs, listInputs, saved, active: () => !!stream, heard: () => heard };

  document.addEventListener('DOMContentLoaded', async () => {
    known = (await inputs()).length;
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const list = await inputs(), more = list.length > known;
        if (!SM.enabled) {   // wired timer not chosen yet: a new sound input may be the timer, so say how to connect it
          known = list.length;
          if (more && window.TM) TM.toast('New sound input plugged in. Is it your timer? Tap here, then pick Wired timer.', 9000, () => document.querySelector('[data-a="bt"]').click());
          return;
        }
        known = list.length;
        if (stream) {   // the input we listen to was unplugged?
          const id = lsGet(DEV);
          if (!list.length || (id && heard && !list.some(d => d.deviceId === id))) stop();
          return;
        }
        auto(more);
      });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); auto(false); } });
    ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended') { ctx.resume().catch(() => {}); } }, { passive: true }));
  });
})();
