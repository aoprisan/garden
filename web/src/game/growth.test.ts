import { describe, it, expect, beforeEach } from 'vitest'
import { growPlant, tendGarden, stageProgress, bloomProgress, unitsToBloom } from './growth'
import { createGarden, newPlant, isBloomed } from './garden'
import { getSpecies, stageCount, bloomUnits } from './catalog'
import { applyConfig, resetConfig } from './config'
import type { Garden } from '../types'

const NOW = 1_000

function sow(garden: Garden, index: number, speciesId = 'marigold'): void {
  garden.cells[index].plant = newPlant(speciesId, NOW)
}

describe('growPlant', () => {
  beforeEach(() => resetConfig())

  it('walks a plant up the ten stages and stops at full bloom', () => {
    const species = getSpecies('marigold')!
    const plant = newPlant('marigold', NOW)
    expect(plant.stage).toBe(0)

    growPlant(plant, species, bloomUnits(species) / 2, NOW)
    expect(plant.stage).toBeGreaterThan(0)
    expect(plant.stage).toBeLessThan(stageCount())
    expect(plant.bloomedAt).toBeNull()

    const taken = growPlant(plant, species, bloomUnits(species), NOW)
    expect(plant.stage).toBe(stageCount())
    expect(plant.bloomedAt).toBe(NOW)
    // a bloom banks nothing more — the overflow isn't taken
    expect(taken).toBeLessThan(bloomUnits(species))
    expect(growPlant(plant, species, 500, NOW)).toBe(0)
  })

  it('banks part-stage progress instead of rounding it away', () => {
    const species = getSpecies('marigold')!
    const plant = newPlant('marigold', NOW)
    const oneStage = bloomUnits(species) / stageCount()
    growPlant(plant, species, oneStage * 0.4, NOW)
    expect(plant.stage).toBe(0)
    expect(stageProgress(plant)).toBeGreaterThan(0.2)
    expect(bloomProgress(plant)).toBeGreaterThan(0)
    expect(unitsToBloom(plant)).toBeLessThan(bloomUnits(species))
  })
})

describe('tendGarden', () => {
  beforeEach(() => resetConfig())

  it('refuses a bed with nothing that can grow — the caller spends nothing', () => {
    const garden = createGarden(3, 3)
    expect(tendGarden(garden, 0, 5).ok).toBe(false)
    sow(garden, 0)
    garden.cells[0].plant!.stage = stageCount() // in bloom
    expect(tendGarden(garden, 0, 5).reason).toMatch(/bloom/)
    expect(tendGarden(garden, 99, 5).ok).toBe(false)
  })

  it('splits a tend between the chosen bed and the rest, by tend.spread', () => {
    applyConfig({ tuningCsv: 'key,value\ntend.spread,0.5\n' }, { persist: false })
    const garden = createGarden(3, 3)
    sow(garden, 0); sow(garden, 1); sow(garden, 2)
    const out = tendGarden(garden, 0, 100)
    expect(out.ok).toBe(true)
    expect(out.units).toBeCloseTo(100, 5)
    expect(garden.cells[0].plant!.totalUnits).toBeCloseTo(50, 5)
    expect(garden.cells[1].plant!.totalUnits).toBeCloseTo(25, 5)
    expect(garden.cells[2].plant!.totalUnits).toBeCloseTo(25, 5)
    resetConfig()
  })

  it('keeps the shared part on the chosen bed when nothing else is growing', () => {
    const garden = createGarden(2, 2)
    sow(garden, 0)
    const out = tendGarden(garden, 0, 40)
    expect(out.units).toBeCloseTo(40, 5)
    expect(garden.cells[0].plant!.totalUnits).toBeCloseTo(40, 5)
  })

  it('never feeds a bed that already bloomed', () => {
    const garden = createGarden(2, 2)
    sow(garden, 0); sow(garden, 1)
    garden.cells[1].plant!.stage = stageCount()
    tendGarden(garden, 0, 60)
    expect(garden.cells[1].plant!.totalUnits).toBe(0)
  })

  it('reports every stage crossed, and the bloom at the top', () => {
    const garden = createGarden(1, 1)
    sow(garden, 0)
    const species = getSpecies('marigold')!
    const out = tendGarden(garden, 0, bloomUnits(species) * 1.5)
    expect(out.stageUps).toHaveLength(stageCount())
    expect(out.blooms).toHaveLength(1)
    expect(out.blooms[0].cellIndex).toBe(0)
    expect(isBloomed(garden.cells[0].plant!)).toBe(true)
  })
})
