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

## 3. Accounts and sync with a Cloudflare Worker (for GitHub Pages)
GitHub Pages cannot run a server, so the same API is available as a Worker (`worker.js`, free plan):

1. Create a KV namespace and put its id in `wrangler.toml`.
2. Set `ALLOW_ORIGIN` in `wrangler.toml` to your website address (origin only, no path).
3. `npx wrangler deploy`
4. Put the Worker address in `API_BASE` in `app.js` and in `API` in `admin.html`.
5. Optional admin page: `npx wrangler secret put ADMIN_USER` and `npx wrangler secret put ADMIN_PASS`, then open `admin.html`. Its address must also be in `ALLOW_ORIGIN`.

## 4. Optional: Rust/WebAssembly core
The timer works without it. If you have a Rust build in `pkg/` (made with `wasm-pack build --target web --release`), it is used automatically instead of the JavaScript core. The Rust source is not part of this repository.

## 3x3 practice modes
Choose 3x3, then tap **3x3 again** in the cube chooser (or the "3x3 practice modes" button). Pick what to practice:
Full solve, Cross, Cross + F2L, F2L (cross already solved), OLL, PLL, Last layer (OLL + PLL), or an Algorithm drill
(tick exactly the OLL / PLL / F2L algs you want). OLL, PLL and last layer can use all cases, only 2-look, or only the algs you ticked as known in Methods.
Each mode keeps its own times and records, so your normal 3x3 stats stay clean. The code is in `practice.js`.

## Keys (can be changed in Settings)
Space (hold, release) start/stop · Shift+C cancel inspection or a running solve (Esc also cancels inspection) · Shift+D or Backspace delete last · Shift+Z undo delete · Shift+2 toggle +2 · D toggle DNF · N new scramble · K cubes · M methods · P progress · R records · C calendar · I rules · S settings
