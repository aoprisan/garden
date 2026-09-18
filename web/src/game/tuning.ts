// The "numbers for the garden" — everything the growth loop is balanced on that
// isn't a plant's own row. One spreadsheet-shaped file, round-trippable from the
// Config panel (download → edit in Excel → upload → play):
//
//   tuning.csv   key,value,note   grid size, stages, daily allowance, throttle
//
// The built-in values live here and are what the download is generated from, so
// the shipped game and an uploaded file are the same data.
import { parseCSV, formatCSV } from './csv'

export interface Knobs {
  // --- the plot ---
  gardenWidth: number
  gardenHeight: number
  /** visual growth stages from seeded soil to full bloom (design: 10). */
  stages: number
  // --- the day ---
  /** seeds a gardener may put in the ground per day (design: 2). */
  plantsPerDay: number
  /** how long a game day lasts. 1440 = a real day; drop it to test rollover. */
  dayLengthMinutes: number
  // --- growth ---
  /** growth units one step (or one tap) is worth. */
  tendUnits: number
  /** fraction of every tend that spreads evenly across the OTHER growing
   *  plants — walking tends the whole garden a little, the chosen bed a lot. */
  tendSpread: number
  /** global multiplier over every species' growth_units (raise = slower). */
  growthScale: number
  /** how much dearer the last stage is than the first (0 = flat stages). */
  growthRamp: number
  // --- tend throttle ---
  tendCapacity: number
  tendRefillPerSec: number
  /** species id → seeds a new gardener starts with. Naming even one row
   *  replaces the whole starting inventory. */
  startingSeeds: Record<string, number>
}

export const DEFAULT_KNOBS: Knobs = {
  gardenWidth: 6,
  gardenHeight: 6,
  stages: 10,
  plantsPerDay: 2,
  dayLengthMinutes: 1440,
  tendUnits: 1,
  tendSpread: 0.25,
  growthScale: 1,
  growthRamp: 1,
  tendCapacity: 100,
  tendRefillPerSec: 100 / 6,
  // "Testing inventory at the start contains e.g. 10 seeds of different
  // flowers or plants" — ten seeds, seven kinds.
  startingSeeds: {
    marigold: 2,
    chamomile: 2,
    basil: 2,
    tulip: 1,
    bluebell: 1,
    cosmos: 1,
    strawberry: 1,
  },
}

/** Growth units this stage costs. Stages ramp: the last one costs
 *  (1 + growthRamp) times the first, and the whole ladder still adds up to the
 *  species' growth_units × growthScale. `stage` is 0-based (0 = seed → stage 1). */
export function stageCost(growthUnits: number, stage: number, knobs: Knobs): number {
  const stages = Math.max(1, Math.round(knobs.stages))
  const ramp = Math.max(0, knobs.growthRamp)
  const total = Math.max(1, growthUnits * Math.max(0.01, knobs.growthScale))
  // weights 1 .. 1+ramp, normalized so Σ weight = stages
  const weight = stages === 1 ? 1 : 1 + (ramp * stage) / (stages - 1)
  const meanWeight = 1 + ramp / 2
  return (total / stages) * (weight / meanWeight)
}

/** Growth units from seed to bloom, for a progress bar or the balance harness. */
export function totalGrowthUnits(growthUnits: number, knobs: Knobs): number {
  let sum = 0
  for (let s = 0; s < Math.max(1, Math.round(knobs.stages)); s++) sum += stageCost(growthUnits, s, knobs)
  return sum
}

/** A game day in ms. */
export function dayLengthMs(knobs: Knobs): number {
  return Math.max(1, knobs.dayLengthMinutes) * 60_000
}

// --- tuning.csv -------------------------------------------------------------
// One row per knob. `note` is documentation only — it round-trips for the
// gardener's benefit and is ignored on the way back in.

type ScalarKey = {
  [K in keyof Knobs]: Knobs[K] extends number ? K : never
}[keyof Knobs]

const SCALARS: Array<[key: string, field: ScalarKey, note: string]> = [
  ['garden.width', 'gardenWidth', 'cells across the plot'],
  ['garden.height', 'gardenHeight', 'cells deep'],
  ['garden.stages', 'stages', 'visual growth stages from seed to bloom'],
  ['day.plants', 'plantsPerDay', 'seeds that may be planted per day'],
  ['day.length_minutes', 'dayLengthMinutes', 'length of a game day (1440 = a real day)'],
  ['tend.units', 'tendUnits', 'growth units one step or tap is worth'],
  ['tend.spread', 'tendSpread', 'fraction of each tend shared with the other growing plants'],
  ['growth.scale', 'growthScale', 'multiplier over every species growth_units (higher = slower)'],
  ['growth.ramp', 'growthRamp', 'how much dearer the last stage is than the first (0 = flat)'],
  ['tend.capacity', 'tendCapacity', 'tend throttle: burst size'],
  ['tend.refill_per_sec', 'tendRefillPerSec', 'tend throttle: tends refilled per second'],
]

const SEED_PREFIX = 'starting_seeds.'

export interface ParsedTuning {
  knobs: Knobs
  warnings: string[]
}

/** Read a tuning CSV over the built-in defaults. Anything the file omits keeps
 *  its default — except starting seeds, where naming even one row replaces the
 *  whole set (that's how you drop a species from the starting tray). */
export function parseTuningCsv(text: string, base: Knobs = DEFAULT_KNOBS): ParsedTuning {
  const warnings: string[] = []
  const knobs: Knobs = { ...base, startingSeeds: { ...base.startingSeeds } }
  const byKey = new Map(SCALARS.map(([key, field]) => [key, field]))
  const seeds: Record<string, number> = {}
  let sawSeeds = false

  for (const [i, row] of parseCSV(text).entries()) {
    const key = (row[0] || '').trim()
    if (!key || key.toLowerCase() === 'key') continue // header (or a blank key)
    const rawValue = (row[1] || '').trim()
    const line = i + 1

    if (key.startsWith(SEED_PREFIX)) {
      const species = key.slice(SEED_PREFIX.length).trim()
      const value = Number(rawValue)
      if (!species) { warnings.push(`line ${line}: "${key}" names no species`); continue }
      if (!Number.isFinite(value) || value < 0) { warnings.push(`line ${line}: starting seeds for "${species}" must be a number`); continue }
      seeds[species] = Math.floor(value)
      sawSeeds = true
      continue
    }

    const field = byKey.get(key)
    if (!field) { warnings.push(`line ${line}: unknown key "${key}" — ignored`); continue }
    const value = Number(rawValue)
    if (!Number.isFinite(value)) { warnings.push(`line ${line}: "${key}" is not a number — kept ${base[field]}`); continue }
    knobs[field] = value
  }

  if (sawSeeds) knobs.startingSeeds = seeds

  // Clamp the knobs that would otherwise make an unplayable garden.
  if (knobs.gardenWidth < 1) { warnings.push('garden.width below 1 — clamped to 1'); knobs.gardenWidth = 1 }
  if (knobs.gardenHeight < 1) { warnings.push('garden.height below 1 — clamped to 1'); knobs.gardenHeight = 1 }
  if (knobs.stages < 1) { warnings.push('garden.stages below 1 — clamped to 1'); knobs.stages = 1 }
  if (knobs.tendCapacity < 1) { warnings.push('tend.capacity below 1 — clamped to 1'); knobs.tendCapacity = 1 }
  if (knobs.tendSpread < 0 || knobs.tendSpread > 1) {
    warnings.push('tend.spread must be between 0 and 1 — clamped')
    knobs.tendSpread = Math.min(1, Math.max(0, knobs.tendSpread))
  }
  if (knobs.plantsPerDay < 1) warnings.push('day.plants is below 1 — nothing can ever be planted')
  if (Object.keys(knobs.startingSeeds).length === 0) warnings.push('no starting seeds — a new gardener has nothing to plant')

  return { knobs, warnings }
}

export function formatTuningCsv(knobs: Knobs): string {
  const rows: (string | number)[][] = [['key', 'value', 'note']]
  for (const [key, field, note] of SCALARS) rows.push([key, round(knobs[field]), note])
  for (const [species, count] of Object.entries(knobs.startingSeeds)) {
    rows.push([`${SEED_PREFIX}${species}`, count, 'seeds in a new gardener’s tray'])
  }
  return formatCSV(rows)
}

/** Keep the round-trip readable: 16.666666666666668 is nobody's tuning value. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
