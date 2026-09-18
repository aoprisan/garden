// Derived species and decor tables, rebuilt whenever the config changes.
// Everything reads the ACTIVE config through here, so an uploaded plants.csv or
// decor.csv is live the moment it's applied.
//
// Never cache the arrays this hands out across a config swap — ask again.
import { decorList, onConfigChange, speciesList, knobs } from './config'
import { stageCost, totalGrowthUnits } from './tuning'
import type { Decor, DecorKind, Rarity, Species } from '../types'

let byId = new Map<string, Species>()
let ordered: Species[] = []
let decorById = new Map<string, Decor>()
let decorOrdered: Decor[] = []

function rebuild(): void {
  ordered = speciesList().slice()
  byId = new Map(ordered.map(s => [s.id, s]))
  decorOrdered = decorList().slice()
  decorById = new Map(decorOrdered.map(d => [d.id, d]))
}
rebuild()
onConfigChange(rebuild)

export function allSpecies(): Species[] { return ordered }

export function getSpecies(id: string): Species | undefined { return byId.get(id) }

export function allDecor(): Decor[] { return decorOrdered }

export function getDecor(id: string | null | undefined): Decor | undefined {
  return id ? decorById.get(id) : undefined
}

export function decorByKind(kind: DecorKind): Decor[] {
  return decorOrdered.filter(d => d.kind === kind)
}

export function speciesByRarity(rarity: Rarity): Species[] {
  return ordered.filter(s => s.rarity === rarity)
}

/** The first species in the catalog — the fallback when a save (or a starting
 *  tray) names something the current plants.csv no longer has. */
export function defaultSpeciesId(): string {
  return ordered[0]?.id ?? ''
}

/** Growth units the plant needs to leave `stage` behind. */
export function stageUnits(species: Species, stage: number): number {
  return stageCost(species.growthUnits, stage, knobs())
}

/** Growth units from seed to full bloom under the running tuning. */
export function bloomUnits(species: Species): number {
  return totalGrowthUnits(species.growthUnits, knobs())
}

/** Visual stages a plant passes through (config-driven; design default 10). */
export function stageCount(): number {
  return Math.max(1, Math.round(knobs().stages))
}
