# Garden

Sow seeds in an isometric plot, then **walk**: every step you take grows what is in the ground,
through the ten visual stages from seed to full bloom. A client-only PWA — no backend, no account —
that runs entirely in the browser and keeps growing offline.

Play: `cd web && npm install && npm run dev` (http://localhost:5175)

- **[docs/GARDEN_DESIGN.md](docs/GARDEN_DESIGN.md)** — the design brief and the decisions it left open
- **[web/README.md](web/README.md)** — the build: architecture, commands, live game data
- **[web/WHATS_NEXT.md](web/WHATS_NEXT.md)** — the roadmap
- **[docs/plants.csv](docs/plants.csv)** — the species catalog, read at runtime (swap it in the app, no rebuild)

The game shares its mechanics with [`aoprisan/click`](https://github.com/aoprisan/click)'s v2
prototype — the same step→throttle→growth loop, the same GameClient seam, the same
live-CSV config panel — pointed at a garden instead of a city.
