import { describe, it, expect, beforeEach } from 'vitest'
import {
  SHOP_ITEMS, buyItem, useItem, currentMultiplier, isGnomeWorking, expireBoosts,
  normalizeGardener, getShopItem, decorShopItems, decorItemId, decorIdOf,
} from './shop'
import { applyConfig, resetConfig } from './config'
import { totalSeeds } from './inventory'
import { makeGardener } from './testUtils'

const NOW = 5_000_000

describe('the potting shed', () => {
  beforeEach(() => resetConfig())

  it('prices everything in petals, and refuses what you can’t afford', () => {
    const gardener = makeGardener({ petals: 0 })
    expect(SHOP_ITEMS.every(i => i.petals > 0)).toBe(true)
    expect(buyItem(gardener, 'fert-2x-10m').reason).toMatch(/petals/)
    expect(buyItem(gardener, 'nope').reason).toMatch(/unknown/)
  })

  it('opens a seed packet on the spot', () => {
    const gardener = makeGardener({ seeds: {}, petals: 500 })
    const item = getShopItem('packet-rare')!
    const result = buyItem(gardener, 'packet-rare', () => 0)
    expect(result.ok).toBe(true)
    expect(result.granted?.count).toBe(item.seeds)
    expect(totalSeeds(gardener)).toBe(item.seeds!)
    expect(gardener.petals).toBe(500 - item.petals)
  })

  it('stocks fertilizer in the shed until it is used', () => {
    const gardener = makeGardener({ petals: 500 })
    expect(buyItem(gardener, 'fert-3x-10m').ok).toBe(true)
    expect(gardener.items['fert-3x-10m']).toBe(1)
    expect(currentMultiplier(gardener, NOW)).toBe(1)

    expect(useItem(gardener, 'fert-3x-10m', NOW).ok).toBe(true)
    expect(currentMultiplier(gardener, NOW)).toBe(3)
    expect(gardener.items['fert-3x-10m']).toBe(0)
    expect(useItem(gardener, 'fert-3x-10m', NOW).reason).toMatch(/none/)
  })

  it('lapses boosts once their time is up', () => {
    const gardener = makeGardener({ petals: 500 })
    buyItem(gardener, 'gnome-15m')
    useItem(gardener, 'gnome-15m', NOW)
    expect(isGnomeWorking(gardener, NOW + 60_000)).toBe(true)
    expect(isGnomeWorking(gardener, NOW + 16 * 60_000)).toBe(false)
    expect(expireBoosts(gardener, NOW + 16 * 60_000)).toBe(true)
    expect(gardener.gnomeUntil).toBeNull()
    expect(expireBoosts(gardener, NOW + 17 * 60_000)).toBe(false)
  })

  it('backfills a gardener saved before a field existed', () => {
    const old = { id: 'x', name: 'old' } as unknown as Parameters<typeof normalizeGardener>[0]
    const fixed = normalizeGardener(old)
    expect(fixed.seeds).toEqual({})
    expect(fixed.petals).toBe(0)
    expect(fixed.items).toEqual({})
    expect(fixed.boost).toBeNull()
  })
})

describe('the decoration aisle', () => {
  beforeEach(() => resetConfig())

  it('stocks whatever decor.csv holds, priced from it', () => {
    const items = decorShopItems()
    expect(items.length).toBeGreaterThan(0)
    expect(items.every(i => i.kind === 'decor' && i.petals >= 0 && !!i.decorId)).toBe(true)
    const bench = items.find(i => i.decorId === 'bench')!
    expect(getShopItem(bench.id)).toMatchObject({ id: bench.id, petals: bench.petals })
    expect(decorIdOf(bench.id)).toBe('bench')
    expect(decorIdOf('fert-2x-10m')).toBeNull()
  })

  it('restocks when the config is swapped', () => {
    applyConfig({ decorCsv: 'id,name,kind,form,color,accent,petals,blurb\nobelisk,Obelisk,object,rock,#888,#444,9,\n' }, { persist: false })
    expect(decorShopItems().map(i => i.decorId)).toEqual(['obelisk'])
    expect(getShopItem(decorItemId('bench'))).toBeUndefined()
  })

  it('buys into the shed, and is placed in the garden rather than used here', () => {
    const gardener = makeGardener({ petals: 100 })
    const bench = decorShopItems().find(i => i.decorId === 'bench')!
    expect(buyItem(gardener, bench.id).ok).toBe(true)
    expect(gardener.items[bench.id]).toBe(1)
    expect(gardener.petals).toBe(100 - bench.petals)
    expect(useItem(gardener, bench.id, NOW).reason).toMatch(/placed in the garden/)
    expect(currentMultiplier(gardener, NOW)).toBe(1) // and it never touches growth
  })
})
