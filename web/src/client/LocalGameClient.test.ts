import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { LocalGameClient } from './LocalGameClient'
import { resetConfig, applyConfig, knobs } from '../game/config'
import { getSpecies, bloomUnits, stageCount } from '../game/catalog'
import { isBloomed } from '../game/garden'
import { decorShopItems } from '../game/shop'
import type { GameEvent } from '../types'

const SAVE_KEY = 'gd.save.v1'

/** Tend a bed until it blooms (or we give up) — the loop a walk performs. */
function walkUntilBloom(client: LocalGameClient, cellIndex: number, maxSteps = 60_000): number {
  for (let i = 0; i < maxSteps; i++) {
    client.tend(cellIndex, 'step')
    const garden = (client as unknown as { garden: { cells: Array<{ plant: { stage: number } | null }> } }).garden
    const plant = garden.cells[cellIndex].plant
    if (plant && plant.stage >= stageCount()) return i + 1
  }
  return -1
}

beforeEach(() => {
  localStorage.removeItem(SAVE_KEY)
  // A fast garden keeps the walk in these specs short without changing the loop.
  applyConfig({ tuningCsv: 'key,value\ngrowth.scale,0.02\ntend.capacity,100000\ntend.refill_per_sec,100000\n' }, { persist: false })
})

afterEach(() => {
  localStorage.removeItem(SAVE_KEY)
  resetConfig()
})

describe('the core loop, end to end', () => {
  it('sows, grows on steps, blooms, and gives seeds and petals back', async () => {
    const client = new LocalGameClient()
    const events: GameEvent[] = []
    client.on(e => events.push(e))

    const gardener = await client.register('Test plot')
    expect(Object.keys(gardener.seeds).length).toBeGreaterThan(0)
    const speciesId = Object.keys(gardener.seeds)[0]
    const species = getSpecies(speciesId)!

    await client.plantSeed(0, speciesId)
    const garden = await client.getGarden()
    expect(garden.cells[0].plant?.speciesId).toBe(speciesId)

    const steps = walkUntilBloom(client, 0)
    expect(steps).toBeGreaterThan(0)
    // Steps spent ≈ the species' cost in growth units (nothing else is growing,
    // so no share goes elsewhere).
    expect(steps).toBeCloseTo(bloomUnits(species) / knobs().tendUnits, -1)

    const bloom = events.find(e => e.type === 'bloom')
    expect(bloom).toBeDefined()
    expect(bloom!.type === 'bloom' && bloom!.data.firstOfKind).toBe(true)
    expect(events.filter(e => e.type === 'growth')).toHaveLength(stageCount())

    const before = (await client.me())!
    expect(before.discovered).toContain(speciesId)
    expect(before.totalSteps).toBe(steps)
    const seedsBefore = before.seeds[speciesId] ?? 0

    await client.harvest(0)
    const after = (await client.me())!
    expect(after.petals).toBe(species.petalYield)
    expect(after.seeds[speciesId]).toBe(seedsBefore + species.seedYield)
    expect((await client.getGarden()).cells[0].plant).toBeNull()
  })

  it('spends nothing on a bed with nothing to grow', async () => {
    const client = new LocalGameClient()
    await client.register('Test plot')
    const events: GameEvent[] = []
    client.on(e => events.push(e))

    client.tend(5, 'tap') // empty bed
    expect((await client.me())!.totalUnits).toBe(0)
    expect(events.some(e => e.type === 'throttle')).toBe(false)
    expect(events.some(e => e.type === 'notice')).toBe(true)
  })

  it('caps planting at the daily allowance but never caps clearing', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Test plot')
    const speciesId = Object.keys(gardener.seeds)[0]
    gardener.seeds[speciesId] = 10 // plenty of seeds: the day, not the tray, is the limit

    for (let i = 0; i < 4; i++) await client.plantSeed(i, speciesId)
    const garden = await client.getGarden()
    expect(garden.cells.filter(c => c.plant)).toHaveLength(Math.floor(knobs().plantsPerDay))

    for (const cell of garden.cells) if (cell.plant) await client.clearCell(cell.index)
    expect((await client.getGarden()).cells.every(c => !c.plant)).toBe(true)
  })

  it('throttles a machine-speed tapper', async () => {
    applyConfig({ tuningCsv: 'key,value\ngrowth.scale,0.02\ntend.capacity,5\ntend.refill_per_sec,0.001\n' }, { persist: false })
    const client = new LocalGameClient()
    const gardener = await client.register('Test plot')
    await client.plantSeed(0, Object.keys(gardener.seeds)[0])

    const blocked: boolean[] = []
    client.on(e => { if (e.type === 'throttle') blocked.push(e.data.blocked) })
    for (let i = 0; i < 20; i++) client.tend(0, 'tap')
    expect(blocked.filter(b => b).length).toBeGreaterThan(10)
    expect((await client.me())!.totalUnits).toBeGreaterThan(0)
  })

  it('shares a tend with the other beds still growing', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Test plot')
    const speciesId = Object.keys(gardener.seeds)[0]
    gardener.seeds[speciesId] = 10
    await client.plantSeed(0, speciesId)
    await client.plantSeed(1, speciesId)

    for (let i = 0; i < 50; i++) client.tend(0, 'step')
    const garden = await client.getGarden()
    const focus = garden.cells[0].plant!.totalUnits
    const neighbour = garden.cells[1].plant!.totalUnits
    expect(neighbour).toBeGreaterThan(0)
    expect(focus).toBeGreaterThan(neighbour)
    expect(focus + neighbour).toBeCloseTo(50 * knobs().tendUnits, 5)
  })
})

describe('persistence and reset', () => {
  it('reloads the plot exactly as it was left', async () => {
    const first = new LocalGameClient()
    const gardener = await first.register('Kept')
    const speciesId = Object.keys(gardener.seeds)[0]
    await first.plantSeed(3, speciesId)
    for (let i = 0; i < 25; i++) first.tend(3, 'step')
    await new Promise(r => setTimeout(r, 700)) // the save is debounced

    const second = new LocalGameClient()
    const restored = await second.getGarden()
    expect(restored.cells[3].plant?.speciesId).toBe(speciesId)
    expect(restored.cells[3].plant!.totalUnits).toBeGreaterThan(0)
    expect((await second.me())!.name).toBe('Kept')
  })

  it('a reset digs everything up — plot, gardener and save', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Doomed')
    await client.plantSeed(0, Object.keys(gardener.seeds)[0])

    const events: GameEvent[] = []
    client.on(e => events.push(e))
    await client.resetGame('test reset')

    expect(events.some(e => e.type === 'world_reset')).toBe(true)
    expect(await client.me()).toBeNull()
    expect((await client.getGarden()).cells.every(c => !c.plant)).toBe(true)
    expect(localStorage.getItem(SAVE_KEY)).toBeNull()
  })

  it('a config swap re-makes the garden', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Doomed')
    await client.plantSeed(0, Object.keys(gardener.seeds)[0])

    const resets: string[] = []
    client.on(e => { if (e.type === 'world_reset') resets.push(e.data.reason) })
    applyConfig({ plantsCsv: 'id,name,growth_units\nhosta,Hosta,500\n' }, { persist: false })

    expect(resets).toHaveLength(1)
    expect(await client.me()).toBeNull()
    expect((await client.getGarden()).cells.every(c => !c.plant)).toBe(true)
  })

  it('survives a save whose species the catalog no longer has', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      garden: {
        width: 2, height: 2, activeCell: 0,
        cells: [
          { index: 0, x: 0, y: 0, plant: { speciesId: 'extinct-fern', stage: 3, units: 0, totalUnits: 10, plantedAt: 0, bloomedAt: null } },
          { index: 1, x: 1, y: 0, plant: null },
          { index: 2, x: 0, y: 1, plant: null },
          { index: 3, x: 1, y: 1, plant: null },
        ],
      },
      gardener: { id: 'g', name: 'Old' },
      savedAt: 0,
    }))

    const client = new LocalGameClient()
    const garden = await client.getGarden()
    expect(garden.cells).toHaveLength(knobs().gardenWidth * knobs().gardenHeight) // regrown to the configured size
    expect(garden.cells[0].plant).toBeNull()                                       // the unknown species dropped
    const gardener = (await client.me())!
    expect(gardener.name).toBe('Old')
    expect(gardener.petals).toBe(0)   // backfilled fields a young save lacks
    expect(gardener.items).toEqual({})
  })
})

describe('the gnome', () => {
  it('tends the chosen bed at the same capped rate, and never an empty one', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Helped')
    const speciesId = Object.keys(gardener.seeds)[0]
    await client.plantSeed(0, speciesId)
    client.setActiveCell(0)

    gardener.petals = 500
    await client.buyItem('gnome-15m')
    await client.useItem('gnome-15m')

    const tick = (client as unknown as { tick: () => void }).tick.bind(client)
    tick()
    const grown = (await client.getGarden()).cells[0].plant!.totalUnits
    expect(grown).toBeGreaterThan(0)

    // Clear the bed: the gnome has nothing to work and must not burn anything.
    await client.clearCell(0)
    const before = (await client.me())!.totalUnits
    tick()
    expect((await client.me())!.totalUnits).toBe(before)
  })
})

describe('a bloom left standing', () => {
  it('is not fed further — the walk goes to what is still growing', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Test plot')
    const speciesId = Object.keys(gardener.seeds)[0]
    await client.plantSeed(0, speciesId)
    walkUntilBloom(client, 0)

    const garden = await client.getGarden()
    expect(isBloomed(garden.cells[0].plant!)).toBe(true)
    const banked = garden.cells[0].plant!.totalUnits
    const before = (await client.me())!.totalUnits
    client.tend(0, 'step')
    expect((await client.getGarden()).cells[0].plant!.totalUnits).toBe(banked)
    expect((await client.me())!.totalUnits).toBe(before)
  })
})

describe('decorating through the client', () => {
  it('buys a piece, places it, and takes it back to the shed', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Designer')
    const bench = decorShopItems().find(i => i.decorId === 'bench')!
    gardener.petals = bench.petals

    await client.buyItem(bench.id)
    expect((await client.me())!.items[bench.id]).toBe(1)

    await client.placeDecor(3, 'bench')
    expect((await client.getGarden()).cells[3].decor).toBe('bench')
    expect((await client.me())!.items[bench.id]).toBe(0) // out of the shed…

    await client.removeDecor(3, 'decor')
    expect((await client.getGarden()).cells[3].decor).toBeNull()
    expect((await client.me())!.items[bench.id]).toBe(1) // …and back into it
  })

  it('refuses to place what isn’t in the shed, and says so', async () => {
    const client = new LocalGameClient()
    await client.register('Designer')
    const notices: string[] = []
    client.on(e => { if (e.type === 'notice') notices.push(e.data.text) })

    await client.placeDecor(0, 'bench')
    expect((await client.getGarden()).cells[0].decor).toBeNull()
    expect(notices.join(' ')).toMatch(/no garden bench in the shed/i)
  })

  it('keeps decoration across a reload, and out of the way of growth', async () => {
    const client = new LocalGameClient()
    const gardener = await client.register('Designer')
    const path = decorShopItems().find(i => i.decorId === 'stone-path')!
    gardener.petals = path.petals
    await client.buyItem(path.id)

    const speciesId = Object.keys(gardener.seeds)[0]
    await client.plantSeed(0, speciesId)
    await client.placeDecor(0, 'stone-path')
    const steps = walkUntilBloom(client, 0)
    expect(steps).toBeGreaterThan(0) // a decorated bed grows exactly as any other

    await new Promise(r => setTimeout(r, 700)) // let the debounced save land
    const reloaded = await new LocalGameClient().getGarden()
    expect(reloaded.cells[0].ground).toBe('stone-path')
  })
})
