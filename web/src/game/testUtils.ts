import type { Gardener } from '../types'
import { dayIndexAt } from './daily'

export function makeGardener(over: Partial<Gardener> = {}): Gardener {
  return {
    id: 'g1',
    name: 'Test plot',
    seeds: { marigold: 3 },
    petals: 0,
    discovered: [],
    dayIndex: dayIndexAt(Date.now()),
    plantedToday: 0,
    totalUnits: 0,
    totalSteps: 0,
    blooms: 0,
    harvests: 0,
    items: {},
    boost: null,
    gnomeUntil: null,
    ...over,
  }
}
