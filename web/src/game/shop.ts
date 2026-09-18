// The potting shed: what petals buy. Petals are earned by harvesting blooms, so
// the shop is a sink for the core loop rather than a way around it — there is no
// hard currency and nothing here is bought with money.
//
// Three kinds of stock:
//   seed packet — three seeds of a random species of that rarity (how the
//                 almanac fills out: rare seeds are otherwise unobtainable)
//   fertilizer  — a time-boxed growth multiplier (the one multiplier in the game)
//   gnome       — an auto-tender that works the active bed at the SAME capped
//                 rate a walker would: comfort while you sit, never an advantage
//   decor       — paths, fences, pots and ornaments, priced in decor.csv. The
//                 one kind of stock that does nothing at all to growth: it is
//                 how the garden gets designed rather than only filled.
import type { Decor, Gardener, Rarity } from '../types'
import { allDecor, getDecor, speciesByRarity } from './catalog'
import { addSeeds } from './inventory'

export type ShopKind = 'seed_packet' | 'fertilizer' | 'gnome' | 'decor'

export interface ShopItem {
  id: string
  kind: ShopKind
  label: string
  /** price in petals. */
  petals: number
  blurb: string
  /** seed packet: which rarity it draws from, and how many seeds. */
  rarity?: Rarity
  seeds?: number
  /** fertilizer: growth multiplier. */
  factor?: number
  /** fertilizer / gnome: how long the effect lasts, ms. */
  durationMs?: number
  /** decor: which piece of decoration this buys. */
  decorId?: string
}

export const STOCKPILE_MAX = 20

const MIN = 60_000
const HOUR = 60 * MIN

const PACKETS: ShopItem[] = [
  { id: 'packet-common', kind: 'seed_packet', label: 'Cottage mix', petals: 12, rarity: 'common', seeds: 3, blurb: '3 seeds — a common kind, picked at random' },
  { id: 'packet-uncommon', kind: 'seed_packet', label: 'Border mix', petals: 40, rarity: 'uncommon', seeds: 3, blurb: '3 seeds — an uncommon kind' },
  { id: 'packet-rare', kind: 'seed_packet', label: 'Collector’s packet', petals: 120, rarity: 'rare', seeds: 2, blurb: '2 seeds — a rare kind, the only way to find one' },
]

// Fertilizer: a small matrix of multiplier × duration. Priced so a boost costs
// roughly what the blooms it buys you are worth — it saves walking, it does not
// replace it.
const FERTILIZERS: ShopItem[] = [
  { id: 'fert-2x-10m', kind: 'fertilizer', label: 'Compost tea · 2× · 10m', petals: 25, factor: 2, durationMs: 10 * MIN, blurb: 'every step counts double' },
  { id: 'fert-3x-10m', kind: 'fertilizer', label: 'Bone meal · 3× · 10m', petals: 60, factor: 3, durationMs: 10 * MIN, blurb: 'for the slow growers' },
  { id: 'fert-5x-5m', kind: 'fertilizer', label: 'Growth tonic · 5× · 5m', petals: 110, factor: 5, durationMs: 5 * MIN, blurb: 'a short, spectacular burst' },
]

const GNOMES: ShopItem[] = [
  { id: 'gnome-15m', kind: 'gnome', label: 'Garden gnome · 15m', petals: 45, durationMs: 15 * MIN, blurb: 'tends the chosen bed at walking pace while you do something else' },
  { id: 'gnome-1h', kind: 'gnome', label: 'Garden gnome · 1h', petals: 150, durationMs: 1 * HOUR, blurb: 'same capped pace, longer shift' },
]

export const SHOP_ITEMS: ShopItem[] = [...PACKETS, ...FERTILIZERS, ...GNOMES]

const byId = new Map(SHOP_ITEMS.map(i => [i.id, i]))

// --- decoration -------------------------------------------------------------
// Decor stock is derived from the live decor.csv rather than written here, so a
// swapped config restocks the shed. Never cache what these hand back across a
// config change — ask again, same rule as the species catalog.

const DECOR_PREFIX = 'decor:'

/** The shed id an owned piece of decoration is counted under. */
export function decorItemId(decorId: string): string { return `${DECOR_PREFIX}${decorId}` }

/** The decor id behind a shed id, or null if that item isn't decoration. */
export function decorIdOf(itemId: string): string | null {
  return itemId.startsWith(DECOR_PREFIX) ? itemId.slice(DECOR_PREFIX.length) : null
}

function decorItem(decor: Decor): ShopItem {
  return {
    id: decorItemId(decor.id),
    kind: 'decor',
    label: decor.name,
    petals: decor.petals,
    blurb: decor.blurb,
    decorId: decor.id,
  }
}

/** Everything in the decoration aisle, in catalog order. */
export function decorShopItems(): ShopItem[] {
  return allDecor().map(decorItem)
}

export function getShopItem(id: string): ShopItem | undefined {
  const fixed = byId.get(id)
  if (fixed) return fixed
  const decorId = decorIdOf(id)
  const decor = decorId ? getDecor(decorId) : undefined
  return decor ? decorItem(decor) : undefined
}

export interface ShopResult {
  ok: boolean
  reason?: string
  /** seed packet: what came out of it. */
  granted?: { speciesId: string; count: number }
}

/** Spend petals. A seed packet is opened on the spot (there is nothing to
 *  "use" later); fertilizer and gnomes go into the shed until activated. */
export function buyItem(gardener: Gardener, itemId: string, rand: () => number = Math.random): ShopResult {
  const item = getShopItem(itemId)
  if (!item) return { ok: false, reason: 'unknown item' }
  if (gardener.petals < item.petals) return { ok: false, reason: 'not enough petals — harvest a bloom' }

  if (item.kind === 'seed_packet') {
    const pool = speciesByRarity(item.rarity ?? 'common')
    if (pool.length === 0) return { ok: false, reason: `no ${item.rarity} species in this catalog` }
    const pick = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]
    const count = item.seeds ?? 3
    gardener.petals -= item.petals
    addSeeds(gardener, pick.id, count)
    return { ok: true, granted: { speciesId: pick.id, count } }
  }

  if ((gardener.items[itemId] || 0) >= STOCKPILE_MAX) return { ok: false, reason: 'the shed is full' }
  gardener.petals -= item.petals
  gardener.items[itemId] = (gardener.items[itemId] || 0) + 1
  return { ok: true }
}

/** Activate a fertilizer or a gnome from the shed. */
export function useItem(gardener: Gardener, itemId: string, now: number): ShopResult {
  const item = getShopItem(itemId)
  if (!item) return { ok: false, reason: 'unknown item' }
  if ((gardener.items[itemId] || 0) <= 0) return { ok: false, reason: 'none in the shed' }
  if (item.kind === 'fertilizer') {
    gardener.boost = { factor: item.factor!, expiresAt: now + item.durationMs! }
  } else if (item.kind === 'gnome') {
    gardener.gnomeUntil = Math.max(gardener.gnomeUntil ?? 0, now) + item.durationMs!
  } else if (item.kind === 'decor') {
    return { ok: false, reason: 'decoration is placed in the garden, not used here' }
  } else {
    return { ok: false, reason: 'seed packets open when you buy them' }
  }
  gardener.items[itemId] -= 1
  return { ok: true }
}

/** The growth multiplier in effect right now (1 when no fertilizer is active). */
export function currentMultiplier(gardener: Gardener, now: number): number {
  if (gardener.boost && now < gardener.boost.expiresAt) return gardener.boost.factor
  return 1
}

export function isGnomeWorking(gardener: Gardener, now: number): boolean {
  return gardener.gnomeUntil != null && now < gardener.gnomeUntil
}

/** Clear lapsed boosts. Returns true if anything changed (so callers re-emit). */
export function expireBoosts(gardener: Gardener, now: number): boolean {
  let changed = false
  if (gardener.boost && now >= gardener.boost.expiresAt) { gardener.boost = null; changed = true }
  if (gardener.gnomeUntil != null && now >= gardener.gnomeUntil) { gardener.gnomeUntil = null; changed = true }
  return changed
}

/** Fill in any fields missing from an older persisted gardener. */
export function normalizeGardener(gardener: Gardener): Gardener {
  return {
    ...gardener,
    seeds: gardener.seeds ?? {},
    petals: gardener.petals ?? 0,
    discovered: gardener.discovered ?? [],
    items: gardener.items ?? {},
    plantedToday: gardener.plantedToday ?? 0,
    dayIndex: gardener.dayIndex ?? 0,
    totalUnits: gardener.totalUnits ?? 0,
    totalSteps: gardener.totalSteps ?? 0,
    blooms: gardener.blooms ?? 0,
    harvests: gardener.harvests ?? 0,
    boost: gardener.boost ?? null,
    gnomeUntil: gardener.gnomeUntil ?? null,
  }
}
