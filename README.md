# CubeTimer

A fast, minimal, customizable speedcubing timer that runs in any browser. It works offline, installs like an app, and needs no account.

Built with plain **HTML + CSS + JavaScript**, with an optional **Rust / WebAssembly core** and an optional **Rust server** for saving your data across devices.

---

## Table of contents

- [Features](#features)
- [Supported cubes](#supported-cubes)
- [Quick start](#quick-start)
- [Running with the server (sync across devices)](#running-with-the-server-sync-across-devices)
- [Building the Rust / WebAssembly core](#building-the-rust--webassembly-core)
- [How to use the timer](#how-to-use-the-timer)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Timing rules](#timing-rules)
- [Statistics](#statistics)
- [Methods and algorithm guides](#methods-and-algorithm-guides)
- [Settings](#settings)
- [Your data: saving, export and import](#your-data-saving-export-and-import)
- [Offline use](#offline-use)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

---

## Features

- **Timer** with hold-to-start, a green "ready" signal and a configurable hold time.
- **15-second inspection** with beeps at 8 s and 12 s, automatic **+2** (15–17 s) and **DNF** (over 17 s).
- **10 built-in cubes** plus **custom cubes** you can add yourself.
- **Scramble generator** for every cube.
- **Live stats**: best, mean, current ao5, best ao5, and the first five solves of the round.
- **Auto rounds**: every 5 solves become a round (ao5), and rounds are compared with each other.
- **Daily sessions**: each day starts fresh, and older days are kept in a **calendar** you can open read-only.
- **Records window**: best single, ao5, ao12, ao100, mean, solving time, streaks, progress and sub-X badges.
- **Daily goal** with a progress bar and a 7-day chart.
- **Reactions**: cheers, PB celebrations (confetti, glow, sounds, vibration), and tips after slow solves. Can be switched to "kind" or turned off.
- **Method guides** with notes, tips and algorithms you can tick off as you learn them.
- **Deep customization**: colors, fonts, sizes, layout and what is shown on screen.
- **Works offline** thanks to a service worker.
- **Export and import** your data as a file.

## Supported cubes

| Cube | Scramble | Method guides |
| --- | --- | --- |
| 2x2 | random-move | Layer by layer, Ortega / CLL |
| 3x3 | random-move | Beginner, CFOP, ZZ, Roux, Petrus |
| 4x4 | random-move | Reduction (centers, edges, 3x3 stage, parity) |
| 5x5, 6x6, 7x7 | random-move | Reduction |
| 3x3 OH (one-handed) | random-move | Same as 3x3 |
| Pyraminx | random-move | Beginner |
| Skewb | random-move | Beginner |
| Megaminx | Pochmann-style | Beginner |

**Custom cubes:** click the **CubeTimer** logo, type a name (for example *Mirror cube*), choose which scramble type it uses (3x3, 2x2, 4x4, 5x5, 6x6, 7x7, Pyraminx, Skewb, Megaminx or none), then press **Add**. Each custom cube gets its own times and its own saved **notes page** under **Methods**.

---

## Quick start

### Option 1: Just open it (no setup)

1. Download or clone this folder.
2. Double-click `index.html`.

That is all. Your solves, settings and ticked algorithms are saved **in your browser** (`localStorage`). Nothing is sent anywhere.

> Some features (the service worker for offline use, the server sync, the WebAssembly core) only work when the page is served over `http://` or `https://`, not from a `file://` address. See the next option.

### Option 2: Serve it locally

Any static file server works. For example:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

---

## Running with the server (sync across devices)

The included Rust server stores everything in a single `data.json` file, so **everyone who opens your site sees the same solves, settings and ticked algorithms**. This is how you can use the same data on your phone and your computer.

```bash
rustc -O server.rs -o server
./server                 # then open http://localhost:8000
PORT=3000 ./server       # use a different port
```

- Data is saved in `data.json` next to the server program.
- The page talks to the server through `api/state` (a `GET` to load and a `PUT` to save, with a short delay after each change).
- If the server is not reachable, the app automatically falls back to saving in the browser only.
- The service worker never caches `api/state`, so you always get fresh data.

**Important:** the server has no login. Anyone who can open the site can read and change the data, so only expose it to people you trust (or put it behind your own password or VPN).

---

## Building the Rust / WebAssembly core

The app works without this step. The JavaScript implementation of the scramble generator and the stats functions is always built in. If you build the WebAssembly package, the app **automatically uses it instead**.

```bash
cargo install wasm-pack
wasm-pack build --target web --release
```

This creates a `pkg/` folder (`pkg/cubetimer.js` and `pkg/cubetimer_bg.wasm`). On startup the app tries `import('./pkg/cubetimer.js')`; if it is missing or fails, the JavaScript version stays active.

The Rust core provides: `scramble`, `ao5`, `stats`, `insp` and `insp_text`.

The crate is configured as a `cdylib` and uses `wasm-bindgen` and `js-sys`. The release profile is tuned for small size (`opt-level = "s"`, `lto = true`).

---

## How to use the timer

1. **Choose a cube** by clicking the **CubeTimer** logo in the top-left corner.
2. Read the **scramble** shown above the timer and scramble your cube.
3. **Hold** `Space` (or press and hold the timer area on a touch screen). The timer turns red while you hold, then **green** when it is ready.
4. **Release** to start. If inspection is on, the first release starts the 15 s inspection and the next hold-and-release starts the solve.
5. **Press any key or tap** to stop.
6. The time is added to your session. A new scramble appears automatically.
7. Fix mistakes right away with the shortcuts below (delete, +2, DNF).

While solving, **focus mode** hides everything except the timer (you can turn this off in Settings).

### Top bar

| Button | What it does |
| --- | --- |
| **CubeTimer ▾** | Choose or add a cube |
| **Date button** | Open the calendar and browse past days (read-only) |
| **Methods** | Method guides, tips and algorithms |
| **Records** | Best times, averages, streaks and badges |
| **Rules** | Quick summary of the timing rules |
| **Settings** | Appearance, timing, sound, reactions, data |

### Side column

Shows your daily goal progress, a 7-day chart, today's numbers, the list of rounds with their ao5 (and how each compares to the previous one), and a **Delete session** button.

On narrow screens (phones) the layout switches to a single column: menu, timer, then summary.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` (hold, then release) | Start the timer |
| Any key / tap | Stop the timer |
| `Esc` | Cancel inspection |
| `Backspace` / `Delete` | Delete the last solve |
| `2` | Toggle +2 on the last solve |
| `D` | Toggle DNF on the last solve |

---

## Timing rules

- A **new scramble** is generated for every attempt.
- **Inspection** lasts 15 seconds, with beeps at 8 s and 12 s (can be turned off).
- Starting between **15 and 17 s** adds **+2**. Going past **17 s** is a **DNF**.
- You can also add **+2** or **DNF** manually to any solve, for judge penalties.
- **Ao5**: the best and worst of five solves are dropped and the middle three are averaged. Two or more DNFs make the average a DNF.
- Times are **truncated, not rounded** (as in official WCA rules).
- **3x3 OH**: solve and inspect with one hand only.
- Scrambles are **random-move**, not the official random-state scrambler. They are good for practice, but not identical to competition scrambles.

---

## Statistics

**During a session** you see: best, mean, current ao5, best ao5, the current round (for example `Round 3 · 2/5`) and each solve of the round in its own box.

**In the Records window** (per cube) you see:

- Best single, best ao5, best ao12, best ao100, and overall mean
- Total solves and DNF count
- Total solving time
- Number of days you cubed and your best day
- Number of PBs (★)
- Best streak of fast solves in a row (under your average)
- Day streak (consecutive days with solves)
- Progress: your first 25 solves compared with your latest 25
- **Sub-X badges** that show which milestones you reached, which is next, and which are still locked

**In the calendar**, click any day to see that day's solves per cube with best, mean, best ao5, time spent, PBs and DNFs.

---

## Methods and algorithm guides

Open **Methods** to learn or review a method. Each method is split into steps with an explanation, tips and (where it applies) algorithms.

- **3x3**: Beginner, CFOP (Cross, F2L, OLL, PLL), ZZ, Roux, Petrus
- **2x2**: Layer by layer, Ortega / CLL
- **4x4**: Reduction, including OLL and PLL parity algorithms
- **5x5, 6x6, 7x7**: Reduction
- **Pyraminx, Skewb, Megaminx**: Beginner guides
- **Custom cubes**: your own notes page

**Tick the checkbox** next to an algorithm to mark it as learned. Ticks are saved with the rest of your data.

---

## Settings

Everything is saved automatically.

| Group | What you can change |
| --- | --- |
| **Theme and colors** | Dark, light or custom theme; background, text, accent, ready color (green) and hold color (red) |
| **Layout** | Interface size, corner roundness, timer area height, and show or hide the scramble, solve boxes, stats and side column |
| **Text** | Timer font and weight, timer size, scramble size, monospace scramble, 2 or 3 decimals |
| **Timing and sound** | Hold time, inspection on/off, beeps and volume, auto rounds, focus mode, hide time while solving, whole seconds only while solving |
| **Reactions and fun** | Fun / Kind / Off reactions, short or detailed messages, break suggestions after slow solves, daily solve goal |
| **Effects** | Confetti and glow, effect strength (1 to 3), sound effects, "ready" blip, vibration on phones, and an effects preview |
| **Data** | Export, import and reset settings |

The theme follows your system's light or dark preference by default.

---

## Your data: saving, export and import

CubeTimer stores:

- All solves, rounds and past days (the calendar)
- Settings
- Ticked algorithms and your custom cubes (with their notes)

Where it is saved:

| Mode | Storage |
| --- | --- |
| Opened as a file or static site | Your browser (`localStorage`, key `ct2`). The app also asks the browser to keep this storage persistent. |
| With the Rust server | `data.json` on the server, plus a copy in each browser |

**Back up your data** from **Settings → Export data**, and restore it later (or move it to another device) with **Import data**.

> Clearing your browser data erases local solves. If your times matter to you, use the server or export regularly.

---

## Offline use

When served over `http://` or `https://`, a service worker (`sw.js`) caches the app files.

- It uses **network first**, so updates always show up when you are online.
- When you are offline, it falls back to the cached copy.
- To force an update after changing files, bump the cache name in `sw.js` (`cubetimer-v3` → `cubetimer-v4`).

---

## Project structure

```
.
├── index.html      Page layout (header, timer, stats, side column, dialog)
├── style.css       All styling, themes, responsive layout and animations
├── app.js          Main app: timer, inspection, stats, calendar, records,
│                   settings, reactions, effects, storage and sync
├── cubes.js        Cube list, scramble generators, methods for 2x2/4x4/5x5+/Pyraminx/Skewb/Megaminx
├── algs.js         Algorithms and guides for 3x3 (Beginner, CFOP, ZZ, Roux, Petrus)
├── sw.js           Service worker (offline support)
├── Cargo.toml      Rust crate for the WebAssembly core
├── Cargo.lock      Locked Rust dependency versions
├── server.rs       Optional Rust server that saves data to data.json
├── pkg/            (generated) WebAssembly build output from wasm-pack
└── data.json       (generated) server data file
```

Scripts are loaded with `defer` in this order: `algs.js` → `cubes.js` → `app.js`.

---

## Deployment

**Static hosting** (GitHub Pages, Netlify, Cloudflare Pages, and similar): upload the folder. Everything works, but data is saved **per browser** only, because static hosts cannot run the server.

**Server hosting** (a VPS, Render, Fly.io, and similar): upload the folder and the compiled `server` program, then run it. Set `PORT` if your host requires a specific port. Use a persistent disk for `data.json`, otherwise your data may be lost when the host restarts.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| The timer does nothing when I press Space | Click the page first so it has focus, and close any open window (dialog). |
| My times disappeared | Browser data was cleared, or you opened the app from a different address (each address has its own storage). Restore from an export. |
| Changes to the code do not show up | The service worker may be serving a cached file. Hard refresh, or bump the cache name in `sw.js`. |
| Offline mode does not work | Serve the app over `http://` or `https://`; service workers do not run from `file://`. |
| Data does not sync between devices | Make sure you are running the Rust server and opening the site through it. Static hosting cannot sync. |
| The WebAssembly core is not used | Run the `wasm-pack` build and make sure the `pkg/` folder is next to `index.html`. The JS version keeps working in the meantime. |
| No sound on iPhone | Tap the page once first; browsers block audio until you interact. |

---

## Limitations

- Scrambles are random-move, **not** official random-state scrambles.
- The server has no authentication.
- "Progress" compares your first 25 solves with your latest 25, so it is only meaningful after about 50 solves.
- Scrambles for 6x6, 7x7, Pyraminx, Skewb and Megaminx are always generated in JavaScript (the Rust core covers 2x2 to 5x5).

---

Happy cubing!
