# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Garden** — sow seeds in an isometric plot and **walk**: every step grows what is in the ground,
through ten visual stages from seed to full bloom. A client-only PWA (React + Vite, no backend, no
account) living entirely under `web/`, with its game data in `docs/*.csv`.

The design brief and the decisions it left open are in [docs/GARDEN_DESIGN.md](docs/GARDEN_DESIGN.md).
The fullest description of the build is [web/README.md](web/README.md); the roadmap is
[web/WHATS_NEXT.md](web/WHATS_NEXT.md).

The mechanics are deliberately the same as the v2 prototype in the sibling repo
[`aoprisan/click`](https://github.com/aoprisan/click) (`web/`): one step (or tap) = one unit through
a shared rate meter, a `GameClient` seam between UI and world, pure unit-tested game modules, a
headless balance harness, and a Config panel that swaps the game's CSVs at runtime. Where that game
spends clicks building a city, this one spends steps growing plants.

## Stack

- React 19 + TypeScript, Vite, `vite-plugin-pwa` (offline service worker)
- No backend, no auth — all state is in-browser (`localStorage`, key `gd.save.v1`)
- Tests: Vitest (jsdom) over the pure game modules plus a few component specs

## Commands (run from `web/`)

```bash
cd web
npm install         # first time only
npm run dev         # Vite dev server on :5175
npm test            # vitest
npm run balance     # headless balance harness — day-by-day report + sane-band asserts
npm run build       # tsc -b + vite build (emits the PWA service worker)
npm run preview     # serve the production build locally
```

Running a single test: `cd web && npx vitest run src/game/growth.test.ts`

There is no data-generation step: `docs/plants.csv` is bundled as text and parsed in the browser at
boot, so the catalog can also be swapped at runtime (see **Live game data** below).

## The core loop

A step (from Walk Mode) or a tap of WATER is one **growth unit**, and both pass through the same
`RateMeter` — walking is the intended input and tapping the fallback; neither can out-pace the
other. A unit is aimed at the **chosen bed**, with `tend.spread` of it shared evenly among the other
plants still growing (and kept on the chosen bed when nothing else is). Units push a plant up the
ten stages of its species (`stageCost` ramps: the last stage costs `1 + growth.ramp` times the
first); stage 10 is **full bloom**, which can be **harvested** for its seeds back plus **petals**.
Petals buy seed packets (the only source of unseen species), fertilizer (the one growth multiplier)
and a gnome that auto-tends the chosen bed at the same capped rate. **Two seeds a day**; clearing is
unlimited and loses an unbloomed plant.

Nothing grows on a timer — the one background tick handles the day rolling over, fertilizer lapsing
and the gnome. Nothing wilts or dies.

## Architecture

- **`src/client/`** — the seam. `GameClient.ts` is the interface; `LocalGameClient.ts` is the whole
  game in the browser (plot, gardener, tick loop, `localStorage`). A `LiveGameClient` would drop in
  at `src/client/index.ts` without the UI changing.
- **`src/game/`** — pure logic, no React and no I/O: `config` (the live config store),
  `plants` (CSV → species), `catalog` (derived tables, rebuilt on every config change — never cache
  its arrays across one), `tuning` (knobs CSV + `DEFAULT_KNOBS` + the stage-cost curve), `garden`
  (the grid: sow/clear/harvest), `growth` (units → stages → blooms), `daily` (day clock, planting
  allowance), `inventory`, `shop` (petals), `throttle`, `pedometer`, `balanceHarness`.
- **`src/components/`** — `GardenField` (the CSS-3D rotatable plot), `PlantSprite` (every species at
  every stage, drawn from its CSV row — no art assets), `SeedTray`, `BedPanel`, `ShedPanel`,
  `WaterButton`, `Almanac`, `Onboarding`, `Tutorial`, `ConfigPanel`, `ToastSystem`, `PwaPrompts`,
  `ErrorBoundary`.
- **`src/hooks/`** — `useGameClient`, `useWalkMode` (steps → tends, banked-step drip), `usePwaUpdate`.
- **`src/steps/`** — the step-source seam: `DeviceMotionStepSource` today (foreground only);
  `claimBanked()` is where a native OS pedometer would hand over steps taken while the app was shut.

### Two things about `GardenField` that will bite

- A cell needs a 3D transform of its own (`translateZ(0.01px)`), or Chrome hit-tests it against the
  parent plane and no bed is ever selectable — while `elementFromPoint` still reports the cell, so a
  DOM test won't catch it.
- Drag-to-spin is wired to `window` and must NOT use `setPointerCapture`: capture re-targets the
  follow-up click at the scene and the cell buttons never see the tap.

## Live game data (no rebuild, no backend)

`docs/plants.csv` (species) and a tuning CSV (`key,value`) are read at runtime by `game/config.ts`.
The **⚙ Data** panel downloads what the game is running on, takes an upload or a paste, applies it
immediately and persists it (`gd.config.v1`) until reverted. Applying anything **re-makes the
garden** (`resetGame()` → wipes `gd.save.v1`, emits `world_reset`) because species ids, grid size and
stage count all move. An unreadable species file is rejected and the running config kept; softer
problems surface as warnings in the panel.

## Tuning knobs

In the tuning CSV: plot size, stages, seeds per day, day length, units per step, `tend.spread`,
`growth.scale` / `growth.ramp`, the throttle, and the starting tray (`starting_seeds.<species>`).
Code-side: `game/shop.ts` (petal prices), `game/pedometer.ts` (detection thresholds). After any
change, check `npm run balance` — it asserts that an ordinary walking day still buys a sensible
number of blooms.

## Deployment

`.github/workflows/deploy-pages.yml` tests and builds `web/` and publishes to GitHub Pages on every
push to `main` touching `web/**` or `docs/**`. The Pages build sets `VITE_BASE=/garden/`; locally
`base` defaults to `/`.
