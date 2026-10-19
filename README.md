# CubeTimer

Minimal speedcubing timer: 2x2, 3x3, 4x4, 5x5 and 3x3 OH. HTML + CSS + JavaScript, with the core logic also written in Rust.

## Run it (no build needed)
Double-click `index.html`. It works with the plain JavaScript core and saves to your browser.

## Optional: Rust/WebAssembly core + offline install
    cargo install wasm-pack
    wasm-pack build --target web --release
    python3 -m http.server 8000      # open http://localhost:8000

Console shows "Rust core loaded" when the Rust version is used. After one visit over http the service worker caches everything for offline use.

## Keys
Space (hold, release) start/stop · Esc cancel inspection · Backspace delete last · 2 toggle +2 · D toggle DNF
