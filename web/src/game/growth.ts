// The core loop, in one place: growth units land on plants and push them up the
// ten visual stages (design: "each seed has 10 visual stages of its growing").
//
// Units come from walking (a step) or from tapping WATER — the same units, the
// same throttle, because walking is meant to be an alternative input and not a
// faster one. A tend is aimed at ONE cell (the active bed), but a fraction of
// it (tend.spread) is shared out evenly among the other plants still growing,
// so a walk moves the whole garden along while the bed you chose moves most.
// With nothing else growing, that fraction stays on the chosen bed rather than
// evaporating.
import type { Cell, Garden, Plant, Species } from '../types'
import { getSpecies, stageUnits, stageCount } from './catalog'
import { knobs } from './config'
import { isGrowing } from './garden'

export interface StageUp {
  cellIndex: number
  speciesId: string
  stage: number
}

export interface TendOutcome {
  /** false when the aimed-at cell has nothing that can grow — the caller should
   *  spend no throttle and burn no step on it. */
  ok: boolean
  reason?: string
  /** growth units that actually landed, focus + spread. */
  units: number
  stageUps: StageUp[]
  blooms: StageUp[]
}

const NOTHING: TendOutcome = { ok: false, units: 0, stageUps: [], blooms: [] }

/** Push `units` of growth into the garden, aimed at `cellIndex`. */
export function tendGarden(garden: Garden, cellIndex: number, units: number): TendOutcome {
  const focus = garden.cells[cellIndex]
  if (!focus) return { ...NOTHING, reason: 'no such cell' }
  if (!focus.plant) return { ...NOTHING, reason: 'nothing planted there — sow a seed first' }
  if (!isGrowing(focus.plant)) return { ...NOTHING, reason: 'that one is in full bloom — harvest it' }
  if (units <= 0) return { ...NOTHING, reason: 'no growth to give' }

  const spreadFraction = Math.min(1, Math.max(0, knobs().tendSpread))
  const others = garden.cells.filter(c => c.index !== cellIndex && isGrowing(c.plant))
  // Nothing else is growing, so the shared part stays on the chosen bed.
  const share = others.length > 0 ? (units * spreadFraction) / others.length : 0
  const focusUnits = others.length > 0 ? units * (1 - spreadFraction) : units

  const out: TendOutcome = { ok: true, units: 0, stageUps: [], blooms: [] }
  applyToCell(focus, focusUnits, out)
  for (const cell of others) applyToCell(cell, share, out)
  return out
}

function applyToCell(cell: Cell, units: number, out: TendOutcome): void {
  const plant = cell.plant
  if (!plant || units <= 0) return
  const species = getSpecies(plant.speciesId)
  if (!species) return
  const before = plant.stage
  const grown = growPlant(plant, species, units)
  out.units += grown
  for (let stage = before + 1; stage <= plant.stage; stage++) {
    const step: StageUp = { cellIndex: cell.index, speciesId: plant.speciesId, stage }
    out.stageUps.push(step)
    if (stage >= stageCount()) out.blooms.push(step)
  }
}

/** Bank growth units on one plant, advancing as many stages as they pay for.
 *  Returns the units actually taken (a plant that reaches full bloom mid-tend
 *  stops there rather than banking the remainder into nothing). */
export function growPlant(plant: Plant, species: Species, units: number, now = Date.now()): number {
  const stages = stageCount()
  if (plant.stage >= stages) return 0
  let left = units
  let taken = 0
  while (left > 0 && plant.stage < stages) {
    const need = stageUnits(species, plant.stage) - plant.units
    if (left < need) {
      plant.units += left
      taken += left
      left = 0
      break
    }
    left -= need
    taken += need
    plant.units = 0
    plant.stage += 1
    if (plant.stage >= stages) {
      plant.bloomedAt = now
      break // a bloom banks nothing further
    }
  }
  plant.totalUnits += taken
  return taken
}

/** 0..1 progress through the CURRENT stage — the thin bar under a cell. */
export function stageProgress(plant: Plant): number {
  const species = getSpecies(plant.speciesId)
  if (!species || plant.stage >= stageCount()) return 1
  const need = stageUnits(species, plant.stage)
  return need <= 0 ? 1 : Math.min(1, plant.units / need)
}

/** 0..1 progress from seed to bloom, for the cell readout. */
export function bloomProgress(plant: Plant): number {
  const stages = stageCount()
  if (plant.stage >= stages) return 1
  return Math.min(1, (plant.stage + stageProgress(plant)) / stages)
}

/** Growth units still owed before this plant blooms — "≈ 240 steps to go". */
export function unitsToBloom(plant: Plant): number {
  const species = getSpecies(plant.speciesId)
  if (!species) return 0
  let left = 0
  for (let s = plant.stage; s < stageCount(); s++) left += stageUnits(species, s)
  // Round off float dust so a fresh plant reads "2500 steps", not "2501".
  return Math.max(0, Math.round((left - plant.units) * 1000) / 1000)
}
