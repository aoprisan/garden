# Garden — design

## The brief (source)

> Core idea: players design and grow their gardens by planting flowers and seeds. Plants and
> flowers grow when players walk / do physical exercises. Gardens are visual. The visual
> reference can be as basic as Stardew Valley (pixel like graphic) but doesn't need to be limited to
> that and can be more advanced (to the point where the garden field can be rotated around the Y
> axis).
>
> Players have seeds of flowers and plants in their inventories.
>
> Testing inventory at the start contains e.g. 10 seeds of different flowers or plants.
>
> Players can plant e.g. 2 seeds a day. Players can remove any number of growing plants a day
> (clear cell).
>
> The field visualisation is an isometric grid of cells. Each cell can be used only for a single plant.
>
> Each seed has 10 visual stages of its growing. The speed at which plants and flowers grow as
> players walk is TBD and can be set to a short duration for testing.

## How the brief maps onto the build

| Brief | Where it lives |
|---|---|
| Isometric grid, one plant per cell | `components/GardenField.tsx` — a CSS 3D ground plane; `game/garden.ts` holds the cells |
| Rotate the field around Y | drag the plot, the ⟲ / ⟳ buttons, or ← / → |
| Seeds in an inventory | `game/inventory.ts`, `components/SeedTray.tsx` |
| Ten seeds of different kinds to start | `starting_seeds.*` in the tuning CSV (2 marigold, 2 chamomile, 2 basil, tulip, bluebell, cosmos, strawberry) |
| Two seeds a day, unlimited clearing | `game/daily.ts` + `plantSeed` / `clearCell` in `game/garden.ts` |
| 10 visual growth stages | `garden.stages` knob; `components/PlantSprite.tsx` draws every stage of every species |
| Growth comes from walking | `game/pedometer.ts` → `steps/` → `hooks/useWalkMode.ts` → `GameClient.tend()` |
| Growth speed is TBD / tunable | `growth_units` per species (plants CSV) × `growth.scale` (tuning CSV); `npm run balance` reports what a day's walking buys |

## Decisions the brief left open

**One click = one step = one unit.** Walking is the engine, but a tap on the WATER dial is worth
exactly the same and passes through the same rate meter (`game/throttle.ts`). Tapping is the
accessibility path and the desk-bound fallback, never a shortcut: at the default cap a tapper and a
jogger mine the same ceiling, and a jogger only gets more because they take more steps.

**A chosen bed, plus a little for everyone.** A tend is aimed at one bed (the one you tapped), but
`tend.spread` (default 25%) is shared evenly among the other plants still growing, so a walk moves
the whole garden and the bed you chose most. With nothing else growing, the shared part stays on
the chosen bed rather than evaporating.

**Stages ramp.** Every stage of a plant costs a share of its `growth_units`, with the last stage
`1 + growth.ramp` times dearer than the first (default: twice). Early progress feels quick; the
bloom is earned.

**The loop closes at the bloom.** A plant at stage 10 can be harvested: its seeds come back plus
petals, the soft currency. Petals buy seed packets (the only source of species you have never
grown), fertilizer (the one growth multiplier in the game) and a garden gnome that tends at the
same capped rate while you are away from the phone. Nothing is bought with money.

**A bloom left standing is safe.** Nothing wilts, nothing dies, and no plant is lost to time — the
garden is a place you come back to, not a chore. Clearing a bed before the bloom does lose the
seed, which is the only cost of changing your mind.

**Balance.** At the shipped numbers a common flower is ~2,500–4,750 steps from seed to bloom and a
rare one ~9,000. Two seeds a day at ~3,000 steps each makes ~6,000 steps/day the pace that keeps
up with the planting cap — an ordinary walking day. A sedentary 2,000-step day still moves
everything along, just with a growing backlog of half-grown beds. `npm run balance` asserts those
bands, and every number is in a CSV you can swap at runtime (⚙ Data).
