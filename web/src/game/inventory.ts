// The seed tray. Seeds are the only thing a gardener spends to plant, and a
// harvested bloom is how they come back (design: the loop closes at the bloom).
import type { Gardener } from '../types'

export function seedCount(gardener: Gardener, speciesId: string): number {
  return gardener.seeds[speciesId] || 0
}

export function totalSeeds(gardener: Gardener): number {
  return Object.values(gardener.seeds).reduce((a, b) => a + b, 0)
}

/** Species the gardener actually holds seeds for, catalog order not guaranteed. */
export function heldSpecies(gardener: Gardener): string[] {
  return Object.entries(gardener.seeds).filter(([, n]) => n > 0).map(([id]) => id)
}

export function addSeeds(gardener: Gardener, speciesId: string, count: number): void {
  if (count <= 0) return
  gardener.seeds[speciesId] = seedCount(gardener, speciesId) + Math.floor(count)
}

/** Spend one seed. Returns false (and changes nothing) when the tray is empty. */
export function takeSeed(gardener: Gardener, speciesId: string): boolean {
  const have = seedCount(gardener, speciesId)
  if (have <= 0) return false
  if (have === 1) delete gardener.seeds[speciesId]
  else gardener.seeds[speciesId] = have - 1
  return true
}
