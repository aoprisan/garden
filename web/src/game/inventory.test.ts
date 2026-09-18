import { describe, it, expect } from 'vitest'
import { addSeeds, heldSpecies, seedCount, takeSeed, totalSeeds } from './inventory'
import { makeGardener } from './testUtils'

describe('the seed tray', () => {
  it('adds, counts and spends seeds', () => {
    const gardener = makeGardener({ seeds: {} })
    addSeeds(gardener, 'poppy', 3)
    addSeeds(gardener, 'tulip', 1)
    expect(seedCount(gardener, 'poppy')).toBe(3)
    expect(totalSeeds(gardener)).toBe(4)
    expect(heldSpecies(gardener).sort()).toEqual(['poppy', 'tulip'])

    expect(takeSeed(gardener, 'tulip')).toBe(true)
    expect(seedCount(gardener, 'tulip')).toBe(0)
    expect(heldSpecies(gardener)).toEqual(['poppy'])
  })

  it('cannot spend what isn’t there, and ignores nonsense adds', () => {
    const gardener = makeGardener({ seeds: {} })
    expect(takeSeed(gardener, 'poppy')).toBe(false)
    addSeeds(gardener, 'poppy', 0)
    addSeeds(gardener, 'poppy', -5)
    expect(totalSeeds(gardener)).toBe(0)
  })
})
