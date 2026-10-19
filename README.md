# CubeTimer

Minimal speedcubing timer: 2x2, 3x3, 4x4, 5x5 and 3x3 OH. HTML + CSS + JavaScript, with a Rust core (WebAssembly) and a Rust server.

## 1. Just use it (saved in your own browser)
Double-click `index.html`. Solves, settings and ticked algs are saved in this browser.

## 2. Save for everyone who visits (server)
    rustc -O server.rs -o server
    ./server                 # open http://localhost:8000   (PORT=3000 ./server to change port)

Everything is saved in `data.json` next to the server. Anyone who opens the site finds the same solves, settings and ticked algs. Deploy the folder + the `server` program on any host that runs programs (a VPS, Render, Fly.io, etc.). GitHub Pages cannot run it, so there it falls back to per-browser saving.

## 3. Optional: Rust/WebAssembly core
    cargo install wasm-pack
    wasm-pack build --target web --release

## Keys
Space (hold, release) start/stop · Esc cancel inspection · Backspace delete last · 2 toggle +2 · D toggle DNF
