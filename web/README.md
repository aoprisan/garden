# Garden (web)

The whole game: React 19 + TypeScript + Vite, no backend. State lives in `localStorage`
(`gd.save.v1`), the species catalog and the numbers live in CSVs that are parsed in the browser at
boot, and a service worker makes it work offline — which matters, because the game is played on a
walk.

## Commands

```bash
npm install         # first time only
npm run dev         # Vite dev server on :5175
npm test            # vitest — the pure game-logic suites and the component specs
npm run balance     # headless balance harness — day-by-day report + sane-band asserts
npm run build       # tsc -b + vite build (emits the PWA service worker)
npm run preview     # serve the production build locally
```

Running a single test: `npx vitest run src/game/growth.test.ts`

## The core loop

One step (or one tap of WATER) = one **growth unit**, capped by a rate meter that steps and taps
share — walking is the intended input, tapping is the fallback, and neither can out-pace the other.
A unit is aimed at the **chosen bed**; `tend.spread` of it is shared among the other plants still
growing. Units push a plant up the ten visual stages of its species; at stage 10 it is in **full
bloom** and can be **harvested** for its seeds back plus **petals**. Petals buy seed packets (new
species), fertilizer (a timed growth multiplier) and a gnome (auto-tends the chosen bed at the same
capped rate). You may sow **two seeds a day**; clearing beds is unlimited.

Nothing grows on a timer. The one background tick handles the day rolling over, fertilizer lapsing
and the gnome — everything else happens because you moved.

## Architecture

Three layers, arranged so the in-browser client could later be swapped for a server without
touching the UI:

- **`src/client/`** — the seam. `GameClient.ts` is the interface; `LocalGameClient.ts` holds the
  plot and the gardener, runs the small tick loop and persists to `localStorage`. A future
  `LiveGameClient` (fetch + WebSocket) drops in at `src/client/index.ts`.
- **`src/game/`** — pure, unit-tested logic (no React, no I/O): `config` (the live config store —
  active CSVs, apply/revert, persistence, change subscribers), `plants` (CSV → species),
  `catalog` (derived species tables, rebuilt on every config change — never cache its arrays across
  one), `tuning` (the knobs CSV and the built-in `DEFAULT_KNOBS`, plus the stage-cost curve),
  `garden` (the grid: sow, clear, harvest), `growth` (units → stages → blooms), `daily` (the day
  clock and the planting allowance), `inventory`, `shop` (petals), `throttle` (the rate meter),
  `pedometer` (step detection + walking/jogging classification) and `balanceHarness` (headless
  deterministic sim).
- **`src/components/`** — the UI: `GardenField` (the rotatable isometric plot), `PlantSprite`
  (every species at every stage, drawn procedurally from its CSV row), `SeedTray`, `BedPanel`,
  `ShedPanel`, `WaterButton` (the dial, the throttle meter and the Walk Mode toggle), `Almanac`,
  `Onboarding`, `Tutorial`, `ConfigPanel`, `ToastSystem`, `PwaPrompts`, `ErrorBoundary`.
- **`src/hooks/`** — `useGameClient` (wires the client's events into React state), `useWalkMode`
  (steps → tends, plus the banked-steps drip), `usePwaUpdate`.
- **`src/steps/`** — the step-source seam: `DeviceMotionStepSource` (accelerometer →
  `game/pedometer`, foreground only, the web's limit). The interface already carries
  `claimBanked()`, which is how a native wrapper around an OS step counter would hand over the
  steps taken while the app was closed.

## Live game data (no rebuild, no backend)

Two files — `docs/plants.csv` (the species) and a tuning CSV (`key,value`) — are read at runtime by
`game/config.ts`. The **⚙ Data** panel downloads exactly what the game is running on, takes an
upload or a paste, applies it immediately and remembers it in `localStorage` (`gd.config.v1`) until
reverted; `docs/plants.csv` and the built-in defaults in `tuning.ts` are what ships.

Applying any file **re-makes the garden** (`GameClient.resetGame()` → wipes `gd.save.v1`, emits
`world_reset`) because species ids, the grid size and the stage count all move. "Reset garden" is
the same path with the data untouched. A species file with nothing readable in it is rejected and
the running config is kept; softer problems (an unknown rarity, a starting seed naming a species
that isn't there, an unknown tuning key) surface as warnings in the panel.

## Tuning knobs

`tuning.csv` (editable live): plot size, growth stages, seeds per day, day length, units per step,
the spread fraction, the global growth scale and stage ramp, the throttle, and the starting tray.
Still code-side: `game/shop.ts` (petal prices and durations), `game/pedometer.ts` (step-detection
thresholds), `game/growth.ts` (the loop itself). Watch `npm run balance` after changing any of it.

## Deployment

`.github/workflows/deploy-pages.yml` builds `web/` and publishes to GitHub Pages on every push to
`main` that touches `web/**`, `docs/**` or the workflow. The Pages build sets `VITE_BASE=/garden/`
so the app serves from the repo subpath; locally `base` defaults to `/`.

## Testing on a desk

Motion sensors need a phone (and, on iOS, a permission prompt from a user gesture), so Walk Mode
only appears on touch devices. To exercise the loop without walking, tap WATER, or shorten the
game in ⚙ Data: `growth.scale,0.02` makes a bloom a few dozen taps, and `day.length_minutes,1`
makes the planting allowance come back every minute.
