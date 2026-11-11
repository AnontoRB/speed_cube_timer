// timer-menu.js - the "Timer" button. One menu to connect a Bluetooth timer (QiYi) or a wired timer (Stackmat, audio).
// The first time you pick a way to connect. The choice is remembered, and from then on the timer connects by
// itself when it is switched on or plugged in. Uses the page's own dialog (open(), dl) and the engines in
// bt-timer.js (BT) and stackmat.js (SM).
(() => {
  const MODE = 'ct2tm';   // 'bt' | 'wired' | ''
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const st = { bt: { text: '', on: false }, sm: { text: '', on: false } };
  const chosen = () => lsGet(MODE) || '';
  const NAME = { bt: 'Bluetooth timer', wired: 'Wired timer (audio)' };

  // ---- status shown on the button (green when connected) and inside the menu ----
  function line() {
    const m = chosen();
    if (m === 'bt') return st.bt.on ? 'Connected: Bluetooth timer' : st.bt.text && st.bt.text !== 'Bluetooth' ? 'Bluetooth: ' + st.bt.text : 'Bluetooth timer: waiting for the timer';
    if (m === 'wired') return st.sm.on ? 'Connected: wired timer' + (SM.info() ? ' (' + SM.info() + ')' : '') : SM.active() ? SM.report() : st.sm.text && st.sm.text !== 'Wired' ? 'Wired: ' + st.sm.text : 'Wired timer: waiting for the cable';
    return 'No timer connected (keyboard or touch)';
  }
  function paint() {
    const b = document.querySelector('[data-a="bt"]');
    if (b) { b.classList.toggle('on', st.bt.on || st.sm.on); b.title = 'Timer: ' + line(); }
    const p = document.getElementById('tmst');
    if (p) p.textContent = line();
    const h = document.getElementById('tmhist');
    if (h) h.textContent = 'Timer signal: ' + (SM.hist() || 'none yet') + '  (' + SM.ver + ', packets ' + SM.diag.packets + ', restarts ' + SM.restarts() + ')';
  }
  // ---- small pop-up at the top: only when a timer is connecting, connected or fails (never while idle) ----
  let toastEl = null, toastT = 0;
  function toast(text, ms, onClick) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:3000;max-width:min(92vw,420px);padding:10px 16px;border-radius:12px;background:var(--card,#222);color:var(--fg,#fff);border:1px solid var(--ac,#5b9dff);box-shadow:0 6px 24px #0008;font-size:.95em;text-align:center;cursor:pointer';
      toastEl.addEventListener('click', () => { const f = toastEl._f; toastEl.hidden = true; if (f) f(); });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text; toastEl._f = onClick || null; toastEl.hidden = false;
    clearTimeout(toastT);
    if (ms) toastT = setTimeout(() => { toastEl.hidden = true; }, ms);
  }
  const hideToast = () => { clearTimeout(toastT); if (toastEl) toastEl.hidden = true; };
  const CONNECTING = /^(Scanning|Connecting|Waiting for timer|Listening)/;
  const TM = window.TM = {
    status(src, text, on) {
      const was = st[src];
      st[src] = { text, on }; paint();
      if (was && was.text === text && was.on === on) return;
      if (on) toast('Timer connected \u2713', 3500);
      else if (CONNECTING.test(text)) toast('Timer is trying to connect\u2026', 12000);
      else if (/^(No reply|No Stackmat|Microphone blocked|Input not found|No microphone)/.test(text)) toast('Timer not connected: ' + text, 6000, () => document.querySelector('[data-a="bt"]').click());
      else if (was && (was.on || CONNECTING.test(was.text))) hideToast();
    },
    toast,
    line
  };

  // ---- pages ----
  const isOpen = () => typeof dl !== 'undefined' && dl.open && dl.querySelector('[data-tm-page]');
  function pageMain() {
    const m = chosen(), hasBT = !!navigator.bluetooth;
    const on = (k, t, sub) => `<button data-tm="${k}" class="${m === k ? 'on' : ''}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px"><b>${t}</b><br><small>${sub}</small></button>`;
    open(`<div data-tm-page="main"><h3>Connect a timer</h3>
<p class="lead">Pick how your timer connects. You only do this once. After that it connects by itself.</p>
<p id="tmst" class="lead" role="status"><b>${esc(line())}</b></p>
${on('bt', 'Bluetooth timer', hasBT ? 'QiYi Smart Timer (QY-Timer). Needs Chrome or Edge.' : 'QiYi Smart Timer. This browser has no Web Bluetooth: use Chrome or Edge.')}
${on('wired', 'Wired timer (audio cable)', 'Stackmat-style timer on the microphone / line-in jack, or a USB sound adapter.')}
<div class="row btns">${m ? '<button data-tm="off" class="danger">Disconnect and use keyboard / touch only</button>' : ''}</div></div>`);
  }

  let inputList = [];
  function pageWired(msg) {
    const sel = SM.saved(inputList), cur = sel ? sel.deviceId : (inputList.find(d => d.deviceId === 'default') || inputList[0] || {}).deviceId;
    const have = inputList.length > 0;
    // "Monitor of ..." entries are copies of speakers / monitors, never a timer: hide them
    const shown = inputList.filter(d => !/^monitor of /i.test(d.label || ''));
    open(`<div data-tm-page="wired"><h3>Wired timer</h3>
<p class="lead">1. Plug the timer's cable into the computer's <b>microphone (or line-in)</b> jack, or into a USB sound adapter.<br>2. Switch the timer on.<br>3. Allow the microphone when the browser asks, then pick the input below.</p>
<p id="tmst" class="lead" role="status"><b>${esc(msg || line())}</b></p>
<p id="tmhist" class="lead" style="font-size:.85em"></p>
${have ? `<label class="lead" for="tmin">Sound input</label>
<select id="tmin" style="width:100%;margin:4px 0 8px">${shown.map((d, i) => `<option value="${esc(d.deviceId)}"${d.deviceId === cur ? ' selected' : ''}>${esc(d.label || 'Input ' + (i + 1))}</option>`).join('')}</select>
<div class="row btns"><button data-tm="wgo" class="on">${SM.active() ? 'Listen to this input' : 'Start listening'}</button>${SM.active() ? '<button data-tm="wstop">Stop</button>' : ''}</div>
<p class="lead">Which one? Use the input of your computer's sound chip (for example "... Audio Controller"), with the cable in the red / pink microphone jack. Not a headset or a "Monitor of" entry. Switch the timer on: the sound level below should move. If it stays at 0%, try the next input.</p>
<p class="lead">It only works while this input is plugged in. Set the input volume to about 50-100% in your system sound settings.</p>`
  : `<div class="row btns"><button data-tm="wallow" class="on">Allow microphone and find the inputs</button></div>`}</div>`);
  }

  // ---- actions ----
  function disconnectAll() { BT.enabled = false; BT.disconnect(); SM.enabled = false; SM.stop(); }

  async function wiredPage() {
    lsSet(MODE, 'wired');
    BT.enabled = false; BT.disconnect();
    SM.enabled = true;
    // when the microphone was allowed before, the names are already there: no extra question
    inputList = [];
    try { const p = await navigator.permissions.query({ name: 'microphone' }); if (p.state === 'granted') inputList = await SM.inputs(); } catch (e) {}
    if (inputList.length && !inputList[0].label) inputList = [];
    pageWired();
    if (inputList.length && SM.saved(inputList) && !SM.active()) SM.auto(false);
  }

  async function onClick(e) {
    const b = e.target.closest('[data-tm]');
    if (!b) return;
    const a = b.dataset.tm;
    if (a === 'bt') {
      lsSet(MODE, 'bt');
      SM.enabled = false; SM.stop();
      BT.enabled = true;
      dl.close();           // the Bluetooth chooser must open straight from this click
      paint();
      BT.connect();
    } else if (a === 'wired') {
      wiredPage();
    } else if (a === 'off') {
      lsSet(MODE, '');
      disconnectAll(); paint(); pageMain();
    } else if (a === 'wallow') {
      b.disabled = true; b.textContent = 'Waiting for permission...';
      const r = await SM.listInputs();
      if (r.error) { inputList = []; pageWired(r.error === 'NotAllowedError' ? 'Microphone blocked. Allow it for this site in the browser address bar, then try again.' : 'No sound input found (' + r.error + ').'); return; }
      inputList = r.list;
      pageWired();
    } else if (a === 'wgo') {
      const id = (document.getElementById('tmin') || {}).value, d = inputList.find(x => x.deviceId === id);
      try { localStorage.setItem('ct2smdev', id || ''); localStorage.setItem('ct2smlab', (d && d.label) || ''); } catch (er) {}
      SM.stop(); SM.enabled = true;
      await SM.start(id, { exact: true });
      pageWired();
    } else if (a === 'wstop') {
      SM.stop(); pageWired();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const b = document.querySelector('[data-a="bt"]');
    if (b) b.addEventListener('click', () => { if (mode === 'run') return; pageMain(); });   // 'mode' = the page's timer state
    if (typeof dl !== 'undefined') dl.addEventListener('click', onClick);
    // connect by itself with the way chosen before
    const m = chosen();
    if (m === 'bt') { BT.enabled = true; BT.auto(); }
    else if (m === 'wired') { SM.enabled = true; SM.auto(false); }
    paint();
    setInterval(() => { if (SM.active()) paint(); }, 500);   // live sound level while listening
  });
})();
