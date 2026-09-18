// Canonical domain model for the garden. Shared by the local client (today) and
// any future server behind the same GameClient seam.

export type Rarity = 'common' | 'uncommon' | 'rare'

/** How a bloom is drawn (PlantSprite picks geometry from this, not from an
 *  asset per species — a new row in plants.csv draws itself). */
export type PlantForm = 'daisy' | 'cup' | 'bell' | 'spike' | 'globe' | 'vine' | 'berry' | 'herb'

/** One row of plants.csv: everything the game knows about a kind of plant. */
export interface Species {
  id: string
  name: string
  family: string
  rarity: Rarity
  form: PlantForm
  petalColor: string
  leafColor: string
  /** growth units from seed to full bloom, across all stages. */
  growthUnits: number
  /** seeds returned when a bloom is harvested. */
  seedYield: number
  /** petals (the soft currency) a harvested bloom is worth. */
  petalYield: number
  blurb: string
}

/** A plant occupying one cell. `stage` is the visual stage 0..stages: 0 is bare
 *  seeded soil, `stages` (10 by default) is full bloom. */
export interface Plant {
  speciesId: string
  stage: number
  /** growth units banked toward the NEXT stage. */
  units: number
  /** total growth units this plant has received (for the cell readout). */
  totalUnits: number
  plantedAt: number
  /** epoch ms the plant reached full bloom, or null while it's still growing. */
  bloomedAt: number | null
}

export interface Cell {
  index: number
  x: number
  y: number
  plant: Plant | null
}

export interface Garden {
  width: number
  height: number
  cells: Cell[]
  /** the cell tending (taps and steps) currently feeds; null = none chosen. */
  activeCell: number | null
}

/** A time-boxed growth multiplier from fertilizer. */
export interface ActiveBoost {
  factor: number
  /** epoch ms when the boost lapses. */
  expiresAt: number
}

export interface Gardener {
  id: string
  name: string
  /** species id → seeds held. */
  seeds: Record<string, number>
  /** soft currency, earned by harvesting blooms. */
  petals: number
  /** species ids that have bloomed here at least once (the almanac). */
  discovered: string[]
  /** which in-game day we're on, and how many seeds have gone in today. */
  dayIndex: number
  plantedToday: number
  /** lifetime counters for the HUD. */
  totalUnits: number
  totalSteps: number
  blooms: number
  harvests: number
  /** owned shop items: item id → count (fertilizers, gnomes, seed packets). */
  items: Record<string, number>
  /** the fertilizer currently in effect, if any. */
  boost: ActiveBoost | null
  /** epoch ms the garden gnome (auto-tender) works until, if any. */
  gnomeUntil: number | null
}

export interface GardenStats {
  planted: number
  growing: number
  blooming: number
  empty: number
  /** 0..1 — how far every planted cell is toward bloom, averaged. */
  progress: number
}

// --- realtime events ---
export interface ThrottleState {
  /** tends remaining in the current window. */
  remaining: number
  capacity: number
  /** true when the last tend was dropped by the cap. */
  blocked: boolean
}

/** A plant advanced one or more visual stages on the last tend. */
export interface GrowthEvent {
  cellIndex: number
  speciesId: string
  stage: number
  stages: number
}

export interface BloomEvent {
  cellIndex: number
  speciesId: string
  speciesName: string
  /** first time this species has ever bloomed here (almanac entry). */
  firstOfKind: boolean
}

export interface HarvestEvent {
  cellIndex: number
  speciesId: string
  speciesName: string
  seeds: number
  petals: number
}

export interface DayEvent {
  dayIndex: number
  /** seeds that can still go in the ground today. */
  plantsLeft: number
}

export interface NoticeEvent {
  text: string
  tone: 'info' | 'good' | 'warn'
}

/** The garden was dug up and re-made — every cell, the gardener and the save are
 *  gone (a manual reset, or a config swap that invalidated them). The UI must
 *  drop all cached state and re-read the client. */
export interface WorldResetEvent {
  reason: string
}

export type GameEvent =
  | { type: 'garden_update'; data: Garden }
  | { type: 'gardener_update'; data: Gardener }
  | { type: 'growth'; data: GrowthEvent }
  | { type: 'bloom'; data: BloomEvent }
  | { type: 'harvest'; data: HarvestEvent }
  | { type: 'day'; data: DayEvent }
  | { type: 'throttle'; data: ThrottleState }
  | { type: 'notice'; data: NoticeEvent }
  | { type: 'world_reset'; data: WorldResetEvent }
