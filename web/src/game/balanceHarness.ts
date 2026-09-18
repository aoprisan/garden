// Headless balance harness. Runs a whole gardener's week — sowing the daily
// allowance, walking a given number of steps, harvesting what bloomed — with no
// DOM, no localStorage, no timers and a seeded PRNG, so a run is fully
// deterministic. It answers the question the design leaves open ("the speed at
// which plants grow as players walk is TBD"): does a realistic day's walking
// finish a realistic number of plants, or does the garden stall / trivialize?
//
// The step→growth path is the same code the client drives (game/growth.ts via
// tendGarden), so the harness measures the real economy, not a parallel toy.
import type { Garden, Gardener, Species } from '../types'
import { allSpecies, getSpecies, stageCount } from './catalog'
import { knobs } from './config'
import { createGarden, harvestCell, isBloomed, isGrowing, plantSeed } from './garden'
import { tendGarden } from './growth'
import { heldSpecies } from './inventory'
import { rollDay } from './daily'
import { dayLengthMs } from './tuning'
import { RateMeter } from './throttle'

// --- deterministic PRNG (mulberry32) ----------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimOptions {
  seed?: number
  days?: number
  /** steps walked per day. 7,000 is an ordinary adult day; 2,000 is sedentary. */
  stepsPerDay?: number
  /** steps per second while walking — used to check the throttle never bites. */
  cadence?: number
  /** seeds the gardener starts with, defaulting to the configured tray. */
  startingSeeds?: Record<string, number>
}

export interface DayRecord {
  day: number
  steps: number
  planted: number
  blooms: number
  harvested: number
  petals: number
  /** beds holding something at the end of the day. */
  occupied: number
}

export interface SimResult {
  garden: Garden
  gardener: Gardener
  history: DayRecord[]
  /** steps the throttle refused — walking should never be throttled. */
  throttledSteps: number
  totals: {
    steps: number
    planted: number
    blooms: number
    harvested: number
    petals: number
    species: number
  }
}

function makeGardener(seeds: Record<string, number>): Gardener {
  return {
    id: 'sim', name: 'sim', seeds: { ...seeds }, petals: 0, discovered: [],
    dayIndex: 0, plantedToday: 0, totalUnits: 0, totalSteps: 0, blooms: 0, harvests: 0,
    items: {}, boost: null, gnomeUntil: null,
  }
}

/** Cheapest-first: a gardener sows what they have, preferring quick growers so
 *  the loop keeps turning — the same instinct a new player has. */
function pickSeed(gardener: Gardener, rand: () => number): string | null {
  const held = heldSpecies(gardener)
    .map(id => getSpecies(id))
    .filter((s): s is Species => !!s)
    .sort((a, b) => a.growthUnits - b.growthUnits)
  if (held.length === 0) return null
  // mostly the quickest, occasionally something else — keeps runs from being
  // a single-species degenerate case
  return (rand() < 0.75 ? held[0] : held[Math.floor(rand() * held.length)]).id
}

export function simulate(opts: SimOptions = {}): SimResult {
  const { seed = 1, days = 14, stepsPerDay = 7000, cadence = 2 } = opts
  const rand = mulberry32(seed)
  const garden = createGarden()
  const gardener = makeGardener(opts.startingSeeds ?? knobs().startingSeeds)
  const units = knobs().tendUnits
  const dayMs = dayLengthMs(knobs())

  // A real clock for the throttle so the refill rate is exercised honestly: the
  // walker takes `cadence` steps a second, and the meter refills in between.
  let clock = 0
  const meter = new RateMeter(knobs().tendCapacity, knobs().tendRefillPerSec, () => clock)
  let throttledSteps = 0

  const history: DayRecord[] = []

  for (let day = 0; day < days; day++) {
    rollDay(gardener, day * dayMs)
    const record: DayRecord = { day, steps: 0, planted: 0, blooms: 0, harvested: 0, petals: 0, occupied: 0 }

    // Morning: sow the day's allowance into the first free beds.
    while (gardener.plantedToday < Math.floor(knobs().plantsPerDay)) {
      const free = garden.cells.find(c => !c.plant)
      const speciesId = pickSeed(gardener, rand)
      if (!free || !speciesId) break
      if (!plantSeed(garden, gardener, free.index, speciesId, day * dayMs).ok) break
      record.planted++
    }

    // The walk. Each step is one tend aimed at the oldest bed still growing.
    for (let i = 0; i < stepsPerDay; i++) {
      clock += 1000 / cadence
      const focus = garden.cells.find(c => isGrowing(c.plant))
      if (!focus) break // nothing left to grow — the rest of the walk is just a walk
      if (!meter.tryConsume()) { throttledSteps++; continue }
      const out = tendGarden(garden, focus.index, units)
      if (!out.ok) break
      gardener.totalUnits += out.units
      gardener.totalSteps += 1
      record.steps++
      for (const b of out.blooms) {
        gardener.blooms++
        if (!gardener.discovered.includes(b.speciesId)) gardener.discovered.push(b.speciesId)
        record.blooms++
      }
    }

    // Evening: bring in whatever bloomed.
    for (const cell of garden.cells) {
      if (!cell.plant || !isBloomed(cell.plant)) continue
      const before = gardener.petals
      if (harvestCell(garden, gardener, cell.index).ok) {
        record.harvested++
        record.petals += gardener.petals - before
      }
    }

    record.occupied = garden.cells.filter(c => c.plant).length
    history.push(record)
  }

  return {
    garden,
    gardener,
    history,
    throttledSteps,
    totals: {
      steps: history.reduce((a, d) => a + d.steps, 0),
      planted: history.reduce((a, d) => a + d.planted, 0),
      blooms: history.reduce((a, d) => a + d.blooms, 0),
      harvested: history.reduce((a, d) => a + d.harvested, 0),
      petals: gardener.petals,
      species: gardener.discovered.length,
    },
  }
}

/** Physical invariants no run may ever break — the cheap net under the bands. */
export function findInvariantViolations(result: SimResult): string[] {
  const problems: string[] = []
  const stages = stageCount()
  const seen = new Set<number>()
  for (const cell of result.garden.cells) {
    if (seen.has(cell.index)) problems.push(`duplicate cell index ${cell.index}`)
    seen.add(cell.index)
    const plant = cell.plant
    if (!plant) continue
    if (plant.stage < 0 || plant.stage > stages) problems.push(`cell ${cell.index}: stage ${plant.stage} out of range`)
    if (plant.units < 0) problems.push(`cell ${cell.index}: negative banked units`)
    if (!getSpecies(plant.speciesId)) problems.push(`cell ${cell.index}: unknown species ${plant.speciesId}`)
  }
  if (result.gardener.petals < 0) problems.push('negative petals')
  if (Object.values(result.gardener.seeds).some(n => n < 0)) problems.push('negative seed count')
  for (const day of result.history) {
    if (day.planted > Math.floor(knobs().plantsPerDay)) problems.push(`day ${day.day}: planted ${day.planted} over the daily allowance`)
  }
  return problems
}

/** Human-readable summary — what `npm run balance` prints. */
export function report(result: SimResult): string {
  const lines: string[] = []
  lines.push(`days ${result.history.length}  steps ${result.totals.steps.toLocaleString()}  blooms ${result.totals.blooms}  petals ${result.totals.petals}  species ${result.totals.species}/${allSpecies().length}`)
  lines.push('day  steps  sown  blooms  harvest  petals  beds')
  for (const d of result.history) {
    lines.push(
      `${String(d.day + 1).padStart(3)}  ${String(d.steps).padStart(5)}  ${String(d.planted).padStart(4)}  ${String(d.blooms).padStart(6)}  ${String(d.harvested).padStart(7)}  ${String(d.petals).padStart(6)}  ${String(d.occupied).padStart(4)}`,
    )
  }
  return lines.join('\n')
}
