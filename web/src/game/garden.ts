// The plot itself: an isometric grid of cells, one plant per cell (design).
// Pure state transitions — no React, no storage, no clocks beyond the `now`
// each caller passes in.
//
// A cell carries two decoration slots alongside its plant, because the brief
// asks for a garden you *design*: `ground` is painted into the tile and a plant
// can still stand on it, `decor` stands in the cell and is either an `object`
// (which rules the plant out) or a `pot` (which holds one). Decoration is
// cosmetic — nothing in here touches growth.
import type { Cell, Garden, GardenStats, Gardener, Plant } from '../types'
import { getDecor, getSpecies, stageCount } from './catalog'
import { knobs } from './config'
import { addSeeds, takeSeed } from './inventory'
import { plantsLeftToday } from './daily'

export interface ActionResult {
  ok: boolean
  reason?: string
}

export function createGarden(width = Math.round(knobs().gardenWidth), height = Math.round(knobs().gardenHeight)): Garden {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const cells: Cell[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) cells.push({ index: y * w + x, x, y, plant: null, ground: null, decor: null })
  }
  return { width: w, height: h, cells, activeCell: null }
}

export function cellAt(garden: Garden, index: number): Cell | null {
  return garden.cells[index] ?? null
}

/** Put a seed in the ground. Costs one seed from the tray and one of the day's
 *  planting slots (design: "players can plant e.g. 2 seeds a day"). */
export function plantSeed(garden: Garden, gardener: Gardener, index: number, speciesId: string, now: number): ActionResult {
  const cell = cellAt(garden, index)
  if (!cell) return { ok: false, reason: 'no such cell' }
  if (cell.plant) return { ok: false, reason: 'that cell is taken — clear it first' }
  const standing = getDecor(cell.decor)
  if (standing && standing.kind !== 'pot') {
    return { ok: false, reason: `the ${standing.name} is in that bed — take it back to the shed first` }
  }
  const species = getSpecies(speciesId)
  if (!species) return { ok: false, reason: 'unknown species' }
  if ((gardener.seeds[speciesId] || 0) <= 0) return { ok: false, reason: `no ${species.name} seeds left` }
  if (plantsLeftToday(gardener) <= 0) return { ok: false, reason: 'that’s today’s planting done — come back tomorrow' }

  takeSeed(gardener, speciesId)
  gardener.plantedToday += 1
  cell.plant = newPlant(speciesId, now)
  garden.activeCell = index
  return { ok: true }
}

export function newPlant(speciesId: string, now: number): Plant {
  return { speciesId, stage: 0, units: 0, totalUnits: 0, plantedAt: now, bloomedAt: null }
}

/** Pull a plant out. Unlimited per day by design — but a plant that isn't in
 *  bloom yet is simply lost, seed and all. */
export function clearCell(garden: Garden, index: number): ActionResult {
  const cell = cellAt(garden, index)
  if (!cell) return { ok: false, reason: 'no such cell' }
  if (!cell.plant) return { ok: false, reason: 'nothing growing there' }
  cell.plant = null
  if (garden.activeCell === index) garden.activeCell = null
  return { ok: true }
}

// --- decoration -------------------------------------------------------------

export interface DecorResult extends ActionResult {
  /** a piece already in that slot, handed back to the shed (placing swaps). */
  replaced?: string
}

/** Put a piece of decoration in a cell. Ground goes under whatever is there; an
 *  object needs the bed empty; a pot may go under a plant that's already
 *  growing. Swapping hands the old piece back rather than destroying it —
 *  unlike a seed, an ornament is never lost. */
export function placeDecor(garden: Garden, index: number, decorId: string): DecorResult {
  const cell = cellAt(garden, index)
  if (!cell) return { ok: false, reason: 'no such cell' }
  const decor = getDecor(decorId)
  if (!decor) return { ok: false, reason: 'unknown decoration' }

  if (decor.kind === 'ground') {
    if (cell.ground === decorId) return { ok: false, reason: `that bed is already ${decor.name.toLowerCase()}` }
    const replaced = cell.ground ?? undefined
    cell.ground = decorId
    return { ok: true, replaced }
  }

  if (decor.kind === 'object' && cell.plant) {
    return { ok: false, reason: 'something is growing there — clear or harvest it first' }
  }
  if (cell.decor === decorId) return { ok: false, reason: `there is already a ${decor.name.toLowerCase()} there` }
  // A plant rules an object out above, so a pot swapped for an object can never
  // strand the plant that was in it.
  const replaced = cell.decor ?? undefined
  cell.decor = decorId
  return { ok: true, replaced }
}

export interface RemoveDecorResult extends ActionResult {
  /** the piece that came out, for the caller to put back in the shed. */
  removed: string
}

/** Take a piece of decoration out of a cell. Always returns it — clearing a bed
 *  loses an unbloomed plant, but nothing is lost by moving a bench. */
export function removeDecor(garden: Garden, index: number, layer: 'ground' | 'decor'): RemoveDecorResult {
  const cell = cellAt(garden, index)
  if (!cell) return { ok: false, reason: 'no such cell', removed: '' }
  const held = layer === 'ground' ? cell.ground : cell.decor
  if (!held) return { ok: false, reason: 'nothing to take back', removed: '' }
  cell[layer] = null
  return { ok: true, removed: held }
}

/** True when a bed can't take a seed because something is standing in it. Takes
 *  a missing cell too: a stale active index shouldn't throw at the caller. */
export function isBlockedByDecor(cell: Cell | null | undefined): boolean {
  const decor = getDecor(cell?.decor)
  return !!decor && decor.kind !== 'pot'
}

export interface HarvestResult extends ActionResult {
  seeds: number
  petals: number
  speciesId: string
}

/** Collect a bloom: the cell empties, and the gardener gets the species' seeds
 *  back plus petals to spend. Only a fully grown plant can be harvested. */
export function harvestCell(garden: Garden, gardener: Gardener, index: number): HarvestResult {
  const none = { seeds: 0, petals: 0, speciesId: '' }
  const cell = cellAt(garden, index)
  if (!cell?.plant) return { ok: false, reason: 'nothing growing there', ...none }
  const species = getSpecies(cell.plant.speciesId)
  if (!species) return { ok: false, reason: 'unknown species', ...none }
  if (!isBloomed(cell.plant)) return { ok: false, reason: `${species.name} is not in bloom yet`, ...none }

  addSeeds(gardener, species.id, species.seedYield)
  gardener.petals += species.petalYield
  gardener.harvests += 1
  cell.plant = null
  if (garden.activeCell === index) garden.activeCell = null
  return { ok: true, seeds: species.seedYield, petals: species.petalYield, speciesId: species.id }
}

export function isBloomed(plant: Plant): boolean {
  return plant.stage >= stageCount()
}

/** A plant that still has growing to do — what tending feeds. */
export function isGrowing(plant: Plant | null): plant is Plant {
  return !!plant && !isBloomed(plant)
}

export function growingCells(garden: Garden): Cell[] {
  return garden.cells.filter(c => isGrowing(c.plant))
}

export function gardenStats(garden: Garden): GardenStats {
  const stages = stageCount()
  let planted = 0, blooming = 0, progress = 0
  for (const c of garden.cells) {
    if (!c.plant) continue
    planted++
    if (isBloomed(c.plant)) { blooming++; progress += 1 }
    else progress += Math.min(1, c.plant.stage / stages)
  }
  return {
    planted,
    growing: planted - blooming,
    blooming,
    empty: garden.cells.length - planted,
    progress: planted === 0 ? 0 : progress / planted,
  }
}

/** Bring a loaded (or config-swapped) garden back in line with the running
 *  config: resize the grid, drop plants whose species no longer exists, drop
 *  decoration a new decor.csv no longer has, and clamp stages that a smaller
 *  `garden.stages` left out of range. A save written before decoration existed
 *  simply has empty slots — it is not a reason to dig the garden up. */
export function normalizeGarden(garden: Garden, width = Math.round(knobs().gardenWidth), height = Math.round(knobs().gardenHeight)): Garden {
  const next = createGarden(width, height)
  const stages = stageCount()
  for (const cell of garden.cells) {
    if (cell.x >= next.width || cell.y >= next.height) continue // the plot shrank
    const target = next.cells[cell.y * next.width + cell.x]
    if (cell.plant && getSpecies(cell.plant.speciesId)) {       // the species may be gone
      target.plant = { ...cell.plant, stage: Math.min(stages, Math.max(0, Math.round(cell.plant.stage))) }
    }
    // A piece that changed kind under a new decor.csv goes back in the slot it
    // belongs in — a ground covering never stands, and vice versa.
    if (getDecor(cell.ground)?.kind === 'ground') target.ground = cell.ground
    const standing = getDecor(cell.decor)
    if (standing && standing.kind !== 'ground') target.decor = cell.decor
  }
  const active = garden.activeCell
  next.activeCell = active != null && next.cells[active]?.plant ? active : null
  return next
}
