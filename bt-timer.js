// bt-timer.js - QiYi Smart Timer over Web Bluetooth (diagnostic + display hooks)
(() => {
  const OPTIONAL = [
    '0000fd50-0000-1000-8000-00805f9b34fb',
    0xfff0, 0xffe0, 0xfee7, 0x180a, 0x180f, 0xff00,
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb'
  ];
  const GUESS = false; // true = old "last 4 bytes = time" guess (can add fake solves)

  let dev = null, got = 0, runTimer = null, lastT = 0, lastAt = 0;

  // ---------- on-screen log (works on phones) ----------
  let box = null, pre = null;
  function logBox() {
    if (box) return;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:200;background:#000d;color:#9f9;font:11px ui-monospace,monospace;padding:6px;max-height:40vh;display:flex;flex-direction:column';
    box.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:4px"><button id="btcopy" style="min-height:30px">Copy log</button><button id="btx" style="min-height:30px">Close</button></div><pre style="margin:0;overflow:auto;white-space:pre-wrap;flex:1"></pre>';
    pre = box.querySelector('pre');
    box.querySelector('#btx').onclick = () => { box.remove(); box = null; };
    box.querySelector('#btcopy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(pre.textContent);
    document.body.appendChild(box);
  }
  const log = t => {
    console.log('[BT]', t);
    logBox();
    pre.textContent += new Date().toISOString().slice(14, 23) + ' ' + t + '\n';
    pre.scrollTop = pre.scrollHeight;
  };

  // ---------- button status ----------
  const btn = () => document.querySelector('[data-a="bt"]');
  function setStatus(text) {
    const b = btn(); if (!b) return;
    const tx = b.querySelector('.tx'); if (tx) tx.textContent = text;
    b.title = text;
    b.classList.toggle('on', text === 'Connected');
  }

  // ---------- hooks that drive the big timer on the page ----------
  const inView = () => typeof view !== 'undefined' && view;
  const BT = {
    hold()  { clearInterval(runTimer); tm.className = 'hold'; },
    ready() { clearInterval(runTimer); tm.className = 'ready'; },
    run() {
      const t0 = performance.now();
      clearInterval(runTimer);
      tm.className = '';
      runTimer = setInterval(() => { tm.textContent = F(performance.now() - t0, S.set.dec); }, 30);
    },
    stop(ms) {
      clearInterval(runTimer);
      tm.className = '';
      if (inView()) return;
      const now = Date.now();
      if (ms === lastT && now - lastAt < 5000) return; // same solve sent twice
      lastT = ms; lastAt = now;
      add(ms, 0, 'bt');
    }
  };
  window.BT = BT;

  // ---------- packet parser: TO BE FILLED IN once real packets are known ----------
  function parse(bytes, uuid) {
    if (GUESS && bytes.length >= 4) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let t = dv.getUint32(bytes.length - 4, true);
      if (t < 50 || t > 3600000) t = dv.getUint32(bytes.length - 4, false);
      if (t >= 50 && t < 3600000) BT.stop(t);
    }
    // real version: decide hold / ready / run / stop from the bytes, e.g.
    //   if (bytes[X] === 1) BT.hold(); else if (...) BT.ready(); else if (...) BT.run(); else if (...) BT.stop(ms);
  }

  function onPacket(ev) {
    got++;
    const v = ev.target.value;
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    log('RX ' + ev.target.uuid.slice(0, 8) + ': ' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join(' '));
    parse(bytes, ev.target.uuid);
  }

  async function connect() {
    if (!navigator.bluetooth) { alert('Web Bluetooth needs Chrome or Edge (desktop or Android) over HTTPS.'); return; }
    try {
      got = 0;
      setStatus('Scanning...');
      dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL });
      log('Device: ' + (dev.name || '(no name)'));
      dev.addEventListener('gattserverdisconnected', () => { setStatus('Bluetooth'); log('Disconnected'); BT.hold(); tm.className = ''; dev = null; });

      setStatus('Connecting...');
      const server = await dev.gatt.connect();
      const services = await server.getPrimaryServices();
      if (!services.length) log('No services visible (UUID not in optionalServices?)');

      for (const s of services) {
        log('SERVICE ' + s.uuid);
        let chars = [];
        try { chars = await s.getCharacteristics(); } catch (e) { log('  cannot list: ' + e.message); continue; }
        for (const c of chars) {
          const p = c.properties, props = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter(k => p[k]).join(',');
          log('  CHAR ' + c.uuid + ' [' + props + ']');
          if (p.read) {
            try { const r = await c.readValue(); log('    value: ' + [...new Uint8Array(r.buffer)].map(b => b.toString(16).padStart(2, '0')).join(' ')); } catch (e) {}
          }
          if (p.notify || p.indicate) {
            try { await c.startNotifications(); c.addEventListener('characteristicvaluechanged', onPacket); log('    subscribed'); }
            catch (e) { log('    subscribe failed: ' + e.message); }
          }
        }
      }
      setStatus('Connected');
      log('Now touch the timer pads / do a solve. Packets appear as RX lines.');
      setTimeout(() => { if (dev && !got) log('NO PACKETS after 8 s. The timer may need a handshake (write) or is connected to another app.'); }, 8000);
    } catch (err) {
      setStatus('Bluetooth');
      log('Error: ' + err.message);
      if (err.name !== 'NotFoundError') alert('Bluetooth failed: ' + err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const b = btn(); if (!b) return;
    b.addEventListener('click', () => {
      if (dev && dev.gatt && dev.gatt.connected) { dev.gatt.disconnect(); setStatus('Bluetooth'); }
      else connect();
    });
  });
})();