# CubeTimer

Minimal speedcubing timer: 2x2 to 7x7, 3x3 OH and BLD, Pyraminx, Skewb and Megaminx. Plain HTML + CSS + JavaScript. Optional account sync with a Node server or a Cloudflare Worker.

## 1. Just use it (saved in your own browser)
Open `index.html` (or the GitHub Pages site). Solves, settings and ticked algs are saved in this browser. Accounts and sync need the page to be opened over http(s), not as a local file.

## 2. Accounts and sync with the Node server
Needs Node 18 or newer. No packages to install.

    node server.js           # open http://localhost:3000

Accounts and solves are saved in the `data/` folder next to `server.js` (put it on a persistent disk when you deploy). Environment variables (all optional):

- `PORT`: port to listen on (default 3000)
- `DATA_DIR`: where the data is stored (default `./data`)
- `ALLOW_ORIGIN`: only if the website is hosted somewhere else, for example `https://yourname.github.io`
- `TRUST_PROXY=1`: set it behind a proxy or host (Render, Railway, Fly, nginx) so rate limits see the real IP

Leave `API_BASE` in `app.js` empty (`''`) when the same server serves the website.

### How saving and syncing work
- On this device the main data is one small key (`ct2`); every past day is its own key (`ct2h:YYYY-MM-DD`) and is only rewritten when it changed. Data saved by older versions is moved over automatically.
- Uploads to the account send the main data plus only the past days that changed. The server answers with `d:1` to show it understands this; against an older server the website still sends everything, so deploy the server or Worker first, then the website.
- Settings, "Keep the scramble of old solves": drop the scramble text of solves older than 1 year / 90 days / 30 days (default: forever). Times are never touched.

## 3. Accounts and sync with a Cloudflare Worker (for GitHub Pages)
GitHub Pages cannot run a server, so the same API is available as a Worker (`worker.js`, free plan):

1. Create a KV namespace and put its id in `wrangler.toml`.
2. Set `ALLOW_ORIGIN` in `wrangler.toml` to your website address (origin only, no path).
3. `npx wrangler deploy`
4. Put the Worker address in `API_BASE` in `app.js` and in `API` in `admin.html`.
5. Optional admin page: `npx wrangler secret put ADMIN_USER` and `npx wrangler secret put ADMIN_PASS`, then open `admin.html`. Its address must also be in `ALLOW_ORIGIN`.

## 4. Optional: Rust/WebAssembly core
The timer works without it. If you have a Rust build in `pkg/` (made with `wasm-pack build --target web --release`), it is used automatically instead of the JavaScript core. The Rust source is not part of this repository.

## Recovery key (forgot your password)
Accounts use a username and a password. To get back in after forgetting the password, an account can have a **recovery key**:

- Log in, open **Profile**, scroll to **Recovery key**, enter your password and press **Make a recovery key**. A QR code and a 25-character key are shown **once**. Take a screenshot, save the picture, or copy the key, and keep it private.
- The QR code holds the username and the recovery key, **not the password**. The server only stores a hash of the key.
- On the log in screen press **Forgot your password?**, then scan the QR code with the camera, upload the picture, or type the key. Choose a new password. All other computers are logged out.
- A key works **once**. After using it, make a new one in the Profile. Making a new key also cancels the old one.
- Anyone who has the QR code or the key can reset the password. Do not share it.
- Wrong tries are limited (5 per 15 minutes for each username and network).
- Scanning with the camera or from a picture needs a browser with `BarcodeDetector` (Chrome, Edge, Android, recent Safari). Everywhere else, type the key. The QR code itself is made by `qr.js` (no libraries).

API: `POST /api/recovery/new {password}` (logged in) and `POST /api/recovery/use {username, key, next}`. `GET /api/me` also says whether the account has a key (`recovery`). Both `server.js` and `worker.js` have them: **deploy the server or Worker first, then the website.**

## Install as an app
The site has a `manifest.json` and a service worker, so on a phone or in Chrome/Edge you can use "Install app" / "Add to Home Screen".

## Connecting a timer (Timer button)
The **Timer** button in the menu opens one window to connect a timer. Pick the way once; it is remembered and from then on the timer connects by itself.

- **Bluetooth timer** (QiYi Smart Timer, `bt-timer.js`): the first time you pick the timer in the browser's Bluetooth chooser. After that it reconnects by itself whenever the timer is switched on and the site is open. Needs Chrome or Edge over HTTPS. If it never says "waiting for the timer", enable `chrome://flags/#enable-web-bluetooth-new-permissions-backend` once.
- **Wired timer** (Stackmat-style, on the microphone / line-in jack or a USB sound adapter, `stackmat.js`): plug it in, switch it on, pick **Wired timer**, allow the microphone and choose the sound input. After that it listens by itself whenever that input is plugged in and the site is open. Hands on the pads, ready, run and stop work like the spacebar, and the exact time from the timer is saved. Set the input volume to about 50-100% in the system sound settings.
- **Disconnect and use keyboard / touch only** turns both off. Only the chosen way is active: with Bluetooth chosen, the microphone is never opened.

## Bluetooth timer debug log
The Bluetooth log panel stays hidden unless the connection fails. To always show it, open the site with `?btdebug` added to the address, or run `localStorage.setItem('ct2btdebug','1')` in the browser console.

## 3x3 practice modes
Choose 3x3, then tap **3x3 again** in the cube chooser (or the "3x3 practice modes" button). Pick what to practice:
Full solve, Cross, Cross + F2L, F2L (cross already solved), OLL, PLL, Last layer (OLL + PLL), or an Algorithm drill
(tick exactly the OLL / PLL / F2L algs you want). OLL, PLL and last layer can use all cases, only 2-look, or only the algs you ticked as known in Methods.
Each mode keeps its own times and records, so your normal 3x3 stats stay clean. The code is in `practice.js`.

## Starting inspection with a tap
With the setting **Right half of the timer starts the inspection** on (Settings, Timing and sound; on by default), a tap on the right half of the timer starts the 15 s inspection, even if the inspection setting is off. A hold on the left half starts a solve straight away, without inspection. After the inspection starts, hold and release anywhere to start the solve. The keyboard (Space) and the Bluetooth / wired timers are not affected: they follow the "15 s inspection" setting as before. Turn the option off to go back to the old behaviour (a tap anywhere starts the inspection when it is on).

## Keys (can be changed in Settings)
Space (hold, release) start/stop · Shift+C cancel inspection or a running solve (Esc also cancels inspection) · Shift+D or Backspace delete last · Shift+Z undo delete · Shift+2 toggle +2 · D toggle DNF · N new scramble · K cubes · M methods · P progress · R records · C calendar · I rules · S settings

## Keyboard shortcuts

Every shortcut can be changed in **Settings → Keyboard shortcuts**, including the start key (Space by default). Each action can have one key, several keys or none. Click a key, then press the new key (Shift, Ctrl and Alt combinations work, e.g. `Shift+D`); click **+** to add another key and **×** to remove one. If you pick a key another action already uses, it moves to the new action. **Reset keys to default** restores everything. Tab and Enter cannot be used. Shortcuts are saved with your settings and sync with your account.
