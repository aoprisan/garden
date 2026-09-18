import { describe, it, expect, beforeEach } from 'vitest'
import { createGarden, plantSeed, clearCell, harvestCell, gardenStats, normalizeGarden, isBloomed } from './garden'
import { growPlant } from './growth'
import { getSpecies, stageCount } from './catalog'
import { resetConfig, applyConfig } from './config'
import { makeGardener } from './testUtils'
import type { Garden, Gardener } from '../types'

const NOW = 1_000_000_000

function fullyGrow(garden: Garden, index: number): void {
  const plant = garden.cells[index].plant!
  const species = getSpecies(plant.speciesId)!
  for (let i = 0; i < stageCount() + 2; i++) growPlant(plant, species, species.growthUnits, NOW)
}

describe('the plot', () => {
  let garden: Garden
  let gardener: Gardener

  beforeEach(() => {
    resetConfig()
    garden = createGarden()
    gardener = makeGardener({ seeds: { marigold: 2 } })
  })

  it('is a rectangular grid of one-plant cells', () => {
    expect(garden.cells).toHaveLength(garden.width * garden.height)
    expect(garden.cells[garden.width].y).toBe(1)
    expect(garden.cells.every(c => c.plant === null)).toBe(true)
  })

  it('plants a seed, spending one seed and one of the day’s slots', () => {
    expect(plantSeed(garden, gardener, 4, 'marigold', NOW).ok).toBe(true)
    expect(garden.cells[4].plant?.speciesId).toBe('marigold')
    expect(gardener.seeds.marigold).toBe(1)
    expect(gardener.plantedToday).toBe(1)
  })

  it('refuses a taken cell, a missing seed and a spent day', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    expect(plantSeed(garden, gardener, 0, 'marigold', NOW).reason).toMatch(/taken/)
    expect(plantSeed(garden, gardener, 1, 'wisteria', NOW).reason).toMatch(/no Wisteria seeds/)

    plantSeed(garden, gardener, 1, 'marigold', NOW) // second of the two daily slots
    gardener.seeds.marigold = 5
    const third = plantSeed(garden, gardener, 2, 'marigold', NOW)
    expect(third.ok).toBe(false)
    expect(third.reason).toMatch(/today/)
    expect(gardener.seeds.marigold).toBe(5) // nothing spent on a refusal
  })

  it('clears any number of beds a day, losing an unbloomed plant', () => {
    plantSeed(garden, gardener, 3, 'marigold', NOW)
    plantSeed(garden, gardener, 5, 'marigold', NOW)
    expect(clearCell(garden, 3).ok).toBe(true)
    expect(clearCell(garden, 5).ok).toBe(true)
    expect(clearCell(garden, 5).ok).toBe(false)
    expect(garden.cells.every(c => c.plant === null)).toBe(true)
    expect(gardener.seeds.marigold ?? 0).toBe(0) // clearing gives nothing back
  })

  it('harvests only a full bloom, returning seeds and petals', () => {
    plantSeed(garden, gardener, 7, 'marigold', NOW)
    expect(harvestCell(garden, gardener, 7).ok).toBe(false)

    fullyGrow(garden, 7)
    expect(isBloomed(garden.cells[7].plant!)).toBe(true)
    const species = getSpecies('marigold')!
    const result = harvestCell(garden, gardener, 7)
    expect(result.ok).toBe(true)
    expect(result.seeds).toBe(species.seedYield)
    expect(gardener.petals).toBe(species.petalYield)
    expect(gardener.harvests).toBe(1)
    expect(garden.cells[7].plant).toBeNull()
  })

  it('counts what is in the ground', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    plantSeed(garden, gardener, 1, 'marigold', NOW)
    fullyGrow(garden, 1)
    const stats = gardenStats(garden)
    expect(stats.planted).toBe(2)
    expect(stats.growing).toBe(1)
    expect(stats.blooming).toBe(1)
    expect(stats.empty).toBe(garden.cells.length - 2)
  })
})

describe('normalizeGarden', () => {
  beforeEach(() => resetConfig())

  it('keeps plants that still fit when the plot shrinks', () => {
    const garden = createGarden(4, 4)
    const gardener = makeGardener({ seeds: { marigold: 9 }, plantedToday: -99 })
    plantSeed(garden, gardener, 0, 'marigold', NOW)   // (0,0) — survives
    plantSeed(garden, gardener, 15, 'marigold', NOW)  // (3,3) — cut off
    const smaller = normalizeGarden(garden, 2, 2)
    expect(smaller.cells).toHaveLength(4)
    expect(smaller.cells[0].plant).not.toBeNull()
  })

  it('drops plants whose species left the catalog', () => {
    const garden = createGarden(2, 2)
    const gardener = makeGardener({ seeds: { marigold: 1 } })
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    applyConfig({ plantsCsv: 'id,name,growth_units\npoppy,Poppy,100\n' }, { persist: false })
    try {
      expect(normalizeGarden(garden, 2, 2).cells[0].plant).toBeNull()
    } finally {
      resetConfig()
    }
  })
})
