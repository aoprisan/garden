// Decoration: the "design" half of "players design and grow their gardens".
// The rules it has to keep are that an ornament never grows anything, never
// costs you a plant, and never goes somewhere that would strand one.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  createGarden, plantSeed, placeDecor, removeDecor, isBlockedByDecor, normalizeGarden,
} from './garden'
import { tendGarden } from './growth'
import { resetConfig, applyConfig } from './config'
import { allDecor, getDecor } from './catalog'
import { makeGardener } from './testUtils'
import type { Garden, Gardener } from '../types'

const NOW = 1_000_000_000

describe('decorating the plot', () => {
  let garden: Garden
  let gardener: Gardener

  beforeEach(() => {
    resetConfig()
    garden = createGarden()
    gardener = makeGardener({ seeds: { marigold: 2 } })
  })

  it('ships a catalog with something of each kind', () => {
    const kinds = new Set(allDecor().map(d => d.kind))
    expect(kinds).toEqual(new Set(['ground', 'object', 'pot']))
    expect(allDecor().every(d => d.petals >= 0)).toBe(true)
  })

  it('paints the ground under a plant that is already growing', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    expect(placeDecor(garden, 0, 'stone-path').ok).toBe(true)
    expect(garden.cells[0].ground).toBe('stone-path')
    expect(garden.cells[0].plant?.speciesId).toBe('marigold') // the plant stays put
  })

  it('refuses an object where something is growing, and a seed where one stands', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    expect(placeDecor(garden, 0, 'bench').reason).toMatch(/growing there/)

    expect(placeDecor(garden, 1, 'bench').ok).toBe(true)
    expect(isBlockedByDecor(garden.cells[1])).toBe(true)
    expect(plantSeed(garden, gardener, 1, 'marigold', NOW).reason).toMatch(/Garden bench/)
  })

  it('lets a pot hold a plant — the bed underneath is still a bed', () => {
    expect(placeDecor(garden, 2, 'terracotta-pot').ok).toBe(true)
    expect(isBlockedByDecor(garden.cells[2])).toBe(false)
    expect(plantSeed(garden, gardener, 2, 'marigold', NOW).ok).toBe(true)
    // and a pot may go under a plant that's already in the ground
    plantSeed(garden, gardener, 3, 'marigold', NOW)
    expect(placeDecor(garden, 3, 'stone-trough').ok).toBe(true)
    expect(garden.cells[3].plant?.speciesId).toBe('marigold')
  })

  it('hands back whatever it swapped or removed — an ornament is never lost', () => {
    placeDecor(garden, 0, 'gravel')
    expect(placeDecor(garden, 0, 'stone-path').replaced).toBe('gravel')

    placeDecor(garden, 1, 'boulder')
    expect(placeDecor(garden, 1, 'bench').replaced).toBe('boulder')

    const taken = removeDecor(garden, 1, 'decor')
    expect(taken).toMatchObject({ ok: true, removed: 'bench' })
    expect(garden.cells[1].decor).toBeNull()
    expect(removeDecor(garden, 1, 'decor').reason).toMatch(/nothing to take back/)
  })

  it('refuses the same piece twice and an unknown one', () => {
    placeDecor(garden, 0, 'lawn')
    expect(placeDecor(garden, 0, 'lawn').reason).toMatch(/already/)
    expect(placeDecor(garden, 0, 'gazebo').reason).toMatch(/unknown/)
  })

  it('changes nothing about growth', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    const plain = createGarden()
    plantSeed(plain, makeGardener({ seeds: { marigold: 2 } }), 0, 'marigold', NOW)

    placeDecor(garden, 0, 'stone-path')
    placeDecor(garden, 0, 'terracotta-pot')
    placeDecor(garden, 4, 'bench')

    const decorated = tendGarden(garden, 0, 500)
    const bare = tendGarden(plain, 0, 500)
    expect(decorated.units).toBe(bare.units)
    expect(garden.cells[0].plant!.totalUnits).toBe(plain.cells[0].plant!.totalUnits)
    expect(garden.cells[0].plant!.stage).toBe(plain.cells[0].plant!.stage)
  })

  it('survives a reload, and drops what a new decor.csv no longer has', () => {
    plantSeed(garden, gardener, 0, 'marigold', NOW)
    placeDecor(garden, 0, 'stone-path')
    placeDecor(garden, 1, 'bench')

    const reloaded = normalizeGarden(garden)
    expect(reloaded.cells[0].ground).toBe('stone-path')
    expect(reloaded.cells[0].plant?.speciesId).toBe('marigold')
    expect(reloaded.cells[1].decor).toBe('bench')

    applyConfig({ decorCsv: 'id,name,kind,form,color,accent,petals,blurb\nstone-path,Stone path,ground,path,#9a958c,#6f6a62,4,\n' }, { persist: false })
    expect(getDecor('bench')).toBeUndefined()
    const trimmed = normalizeGarden(garden)
    expect(trimmed.cells[0].ground).toBe('stone-path')
    expect(trimmed.cells[1].decor).toBeNull()
  })

  it('reads a save written before decoration existed', () => {
    // Old saves have no ground/decor fields at all — they must load as an
    // undecorated garden, not dig it up.
    const old = createGarden()
    old.cells[0].plant = { speciesId: 'marigold', stage: 3, units: 0, totalUnits: 10, plantedAt: NOW, bloomedAt: null }
    for (const cell of old.cells) {
      delete (cell as Partial<typeof cell>).ground
      delete (cell as Partial<typeof cell>).decor
    }

    const loaded = normalizeGarden(old)
    expect(loaded.cells[0].plant?.stage).toBe(3)
    expect(loaded.cells.every(c => c.ground === null && c.decor === null)).toBe(true)
  })
})
