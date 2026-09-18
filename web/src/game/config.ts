// The live config store: the single place the game reads its data from, and the
// seam that lets a designer swap that data at runtime.
//
// Two CSVs make up a config. The ones shipped with the build are docs/plants.csv
// (bundled as text) plus the hand-authored defaults in tuning.ts serialized back
// to CSV — so "download current" always gives you exactly what the running game
// is using, and re-uploading it changes nothing.
//
// Applying a config rebuilds the catalog in place and notifies subscribers;
// catalog.ts rebuilds its derived tables and the client re-makes the garden
// (species ids and grid size can change, so the old plot would be nonsense).
// Whatever differs from the built-ins is persisted to localStorage, so an
// uploaded config survives a reload — and a file you never touched keeps
// tracking the shipped one.
import plantsCsvBuiltIn from '../../../docs/plants.csv?raw'
import { parsePlantsCsv } from './plants'
import type { Species } from '../types'
import { DEFAULT_KNOBS, formatTuningCsv, parseTuningCsv, type Knobs } from './tuning'

export type ConfigFileKey = 'plantsCsv' | 'tuningCsv'

export type ConfigSource = Record<ConfigFileKey, string>

export interface GameConfig {
  source: ConfigSource
  species: Species[]
  knobs: Knobs
  /** non-fatal problems from the CSVs, for the Config panel to show. */
  warnings: string[]
  /** which files differ from the ones shipped with this build. */
  custom: ConfigFileKey[]
}

/** Panel metadata: what each file is, and what it's called when downloaded. */
export const CONFIG_FILES: Array<{ key: ConfigFileKey; label: string; filename: string; blurb: string }> = [
  {
    key: 'plantsCsv',
    label: 'Plants',
    filename: 'plants.csv',
    blurb: 'one row per species: look, rarity, growth units, what a bloom gives back',
  },
  {
    key: 'tuningCsv',
    label: 'Tuning numbers',
    filename: 'tuning.csv',
    blurb: 'key,value — plot size, growth stages, seeds per day, throttle, starting tray',
  },
]

export const BUILT_IN_SOURCE: ConfigSource = {
  plantsCsv: plantsCsvBuiltIn,
  tuningCsv: formatTuningCsv(DEFAULT_KNOBS),
}

const STORAGE_KEY = 'gd.config.v1'

/** Build a full config from CSV text. A missing file falls back to the built-in
 *  one, so uploading a single file is a valid config.
 *  @throws if the species list can't be read at all — the caller keeps the
 *          config it already had and surfaces the message. */
export function buildConfig(patch: Partial<ConfigSource>): GameConfig {
  const source: ConfigSource = { ...BUILT_IN_SOURCE, ...stripBlanks(patch) }
  const tuning = parseTuningCsv(source.tuningCsv)
  const plants = parsePlantsCsv(source.plantsCsv)

  const warnings = [...plants.warnings, ...tuning.warnings]
  const known = new Set(plants.species.map(s => s.id))
  for (const id of Object.keys(tuning.knobs.startingSeeds)) {
    if (!known.has(id)) warnings.push(`starting_seeds.${id}: no such species in plants.csv — ignored`)
  }

  const custom = (Object.keys(source) as ConfigFileKey[]).filter(k => source[k] !== BUILT_IN_SOURCE[k])
  return { source, species: plants.species, knobs: tuning.knobs, warnings, custom }
}

function stripBlanks(patch: Partial<ConfigSource>): Partial<ConfigSource> {
  const out: Partial<ConfigSource> = {}
  for (const [k, v] of Object.entries(patch) as Array<[ConfigFileKey, string | undefined]>) {
    if (typeof v === 'string' && v.trim() !== '') out[k] = v
  }
  return out
}

// --- active config ----------------------------------------------------------

const listeners = new Set<(config: GameConfig) => void>()
let active: GameConfig = bootConfig()

/** Restore a persisted config at startup; a broken one is dropped rather than
 *  bricking the game (it would otherwise fail on every reload with no way back
 *  to the panel). */
function bootConfig(): GameConfig {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ConfigSource>
      const config = buildConfig(stored)
      if (config.custom.length > 0) {
        config.warnings.unshift(`using an uploaded config (${config.custom.length} file(s)) — revert in the Config panel`)
      }
      return config
    }
  } catch (err) {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage disabled */ }
    const config = buildConfig({})
    config.warnings.unshift(`stored config could not be loaded (${message(err)}) — reverted to the built-in one`)
    return config
  }
  return buildConfig({})
}

export function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function activeConfig(): GameConfig { return active }
export function knobs(): Knobs { return active.knobs }
export function speciesList(): Species[] { return active.species }
export function isCustomConfig(): boolean { return active.custom.length > 0 }

/** Subscribe to config swaps. Called after `active` is updated, so a listener
 *  can read the new config straight off `activeConfig()`. */
export function onConfigChange(fn: (config: GameConfig) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Swap in new CSV text. Throws (leaving the running config untouched) if the
 *  species list can't be parsed. */
export function applyConfig(patch: Partial<ConfigSource>, opts: { persist?: boolean } = {}): GameConfig {
  const next = buildConfig({ ...active.source, ...patch })
  active = next
  if (opts.persist !== false) persist(next)
  notify(next)
  return next
}

/** Drop every uploaded file and go back to the config shipped with this build. */
export function resetConfig(): GameConfig {
  const next = buildConfig({})
  active = next
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* storage disabled */ }
  notify(next)
  return next
}

function persist(config: GameConfig): void {
  try {
    if (config.custom.length === 0) { localStorage.removeItem(STORAGE_KEY); return }
    const stored: Partial<ConfigSource> = {}
    for (const key of config.custom) stored[key] = config.source[key]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch { /* quota or disabled storage — the config still applies for this session */ }
}

function notify(config: GameConfig): void {
  for (const fn of listeners) {
    try { fn(config) } catch { /* never let one subscriber break a config swap */ }
  }
}

/** Counts for the Config panel header. */
export function configSummary(config: GameConfig = active) {
  const families = new Set(config.species.map(s => s.family))
  return {
    species: config.species.length,
    families: families.size,
    cells: Math.round(config.knobs.gardenWidth) * Math.round(config.knobs.gardenHeight),
    stages: Math.round(config.knobs.stages),
    startingSeeds: Object.values(config.knobs.startingSeeds).reduce((a, b) => a + b, 0),
  }
}
