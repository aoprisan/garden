// The plot itself: an isometric grid of cells, one plant per cell (design).
// Pure state transitions — no React, no storage, no clocks beyond the `now`
// each caller passes in.
import type { Cell, Garden, GardenStats, Gardener, Plant } from '../types'
import { getSpecies, stageCount } from './catalog'
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
    for (let x = 0; x < w; x++) cells.push({ index: y * w + x, x, y, plant: null })
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
 *  config: resize the grid, drop plants whose species no longer exists, and
 *  clamp stages that a smaller `garden.stages` left out of range. */
export function normalizeGarden(garden: Garden, width = Math.round(knobs().gardenWidth), height = Math.round(knobs().gardenHeight)): Garden {
  const next = createGarden(width, height)
  const stages = stageCount()
  for (const cell of garden.cells) {
    if (!cell.plant) continue
    if (cell.x >= next.width || cell.y >= next.height) continue // the plot shrank
    if (!getSpecies(cell.plant.speciesId)) continue             // the species is gone
    const target = next.cells[cell.y * next.width + cell.x]
    target.plant = { ...cell.plant, stage: Math.min(stages, Math.max(0, Math.round(cell.plant.stage))) }
  }
  const active = garden.activeCell
  next.activeCell = active != null && next.cells[active]?.plant ? active : null
  return next
}
