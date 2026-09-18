// The whole game, in the browser. Holds the plot and the gardener, runs a small
// tick loop (day rollover, lapsing fertilizer, the gnome) and serves the
// GameClient interface the UI talks to. No server. Persisted to localStorage, so
// a reload picks the garden back up exactly where it was.
import type { GameClient, ConnectionState, TendSource } from './GameClient'
import { EventBus } from './GameClient'
import type { Garden, Gardener, GameEvent } from '../types'
import { getSpecies, defaultSpeciesId, stageCount } from '../game/catalog'
import { knobs, onConfigChange } from '../game/config'
import {
  createGarden, normalizeGarden, plantSeed, clearCell, harvestCell, isGrowing,
} from '../game/garden'
import { tendGarden } from '../game/growth'
import { dayIndexAt, plantsLeftToday, rollDay } from '../game/daily'
import { RateMeter } from '../game/throttle'
import {
  buyItem as shopBuy, useItem as shopUse, currentMultiplier, isGnomeWorking,
  expireBoosts, normalizeGardener, getShopItem,
} from '../game/shop'

const SAVE_KEY = 'gd.save.v1'
const TICK_MS = 1500
const SAVE_DEBOUNCE_MS = 600
/** Tends a gnome may fire in one tick — the meter still governs the real rate. */
const GNOME_BURST = 30

interface SaveState {
  garden: Garden
  gardener: Gardener | null
  savedAt: number
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export class LocalGameClient implements GameClient {
  private bus = new EventBus()
  private garden: Garden
  private gardener: Gardener | null = null
  private meter = new RateMeter()
  private timer: ReturnType<typeof setInterval> | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  /** throttles a repeated notice so a held tap doesn't flood the toast stack. */
  private lastNoticeKey = ''
  private lastNoticeAt = 0

  constructor() {
    const loaded = this.load()
    this.garden = loaded ? normalizeGarden(loaded.garden) : createGarden()
    this.gardener = loaded?.gardener ? normalizeGardener(loaded.gardener) : null
    this.startTicking()
    // New config = new species ids, grid size and stage counts: the plot in
    // memory was grown against the old data, so the garden starts over.
    onConfigChange(() => { void this.resetGame('game data updated') })
  }

  /** Dig everything up and start over from the CURRENT config. */
  async resetGame(reason = 'garden reset'): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null }
    try { localStorage.removeItem(SAVE_KEY) } catch { /* disabled storage */ }
    this.garden = createGarden()
    this.gardener = null
    this.meter = new RateMeter() // re-reads the tend-throttle knobs
    this.lastNoticeKey = ''
    this.lastNoticeAt = 0
    this.bus.emit({ type: 'world_reset', data: { reason } })
    this.scheduleSave()
  }

  // --- persistence ---
  private load(): SaveState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as SaveState
      if (!parsed.garden?.cells?.length) return null
      return parsed
    } catch {
      return null
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      try {
        const state: SaveState = { garden: this.garden, gardener: this.gardener, savedAt: Date.now() }
        localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      } catch { /* quota or disabled storage — ignore */ }
    }, SAVE_DEBOUNCE_MS)
  }

  // --- tick loop ---
  private startTicking(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  /** Nothing about a plant changes on its own — growth is walking, and only
   *  walking. The tick exists for the three things that ARE time-based: the day
   *  rolling over, fertilizer lapsing, and the gnome doing your walking for you. */
  private tick(): void {
    const g = this.gardener
    if (!g) return
    const now = Date.now()

    if (rollDay(g, now)) {
      this.bus.emit({ type: 'day', data: { dayIndex: g.dayIndex, plantsLeft: plantsLeftToday(g) } })
      this.bus.emit({ type: 'gardener_update', data: g })
    }
    this.runGnome()
    if (expireBoosts(g, now)) this.bus.emit({ type: 'gardener_update', data: g })
    this.scheduleSave()
  }

  // --- reads ---
  async getGarden(): Promise<Garden> { return this.garden }
  async me(): Promise<Gardener | null> { return this.gardener }

  // --- identity ---
  async register(name: string): Promise<Gardener> {
    const seeds: Record<string, number> = {}
    for (const [id, count] of Object.entries(knobs().startingSeeds)) {
      // A starting tray naming a species this catalog dropped falls back to the
      // first species, so a new gardener always has something to plant.
      const speciesId = getSpecies(id) ? id : defaultSpeciesId()
      if (speciesId && count > 0) seeds[speciesId] = (seeds[speciesId] || 0) + Math.floor(count)
    }
    this.gardener = {
      id: `gd-${hashStr(name + Date.now())}`,
      name,
      seeds,
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
    }
    this.bus.emit({ type: 'gardener_update', data: this.gardener })
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.scheduleSave()
    return this.gardener
  }

  // --- core loop ---
  setActiveCell(cellIndex: number | null): void {
    this.garden.activeCell = cellIndex
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.scheduleSave()
  }

  /** One step or tap of growth aimed at a cell. A tend that can't land (empty
   *  cell, or one already in bloom) costs nothing — no throttle, no step. */
  tend(cellIndex: number, source: TendSource = 'tap'): void {
    const g = this.gardener
    if (!g) return
    const cell = this.garden.cells[cellIndex]
    if (!isGrowing(cell?.plant ?? null)) {
      this.maybeNotice(`idle:${cellIndex}`, cell?.plant
        ? 'that one is in full bloom — harvest it to free the bed'
        : 'nothing planted there — sow a seed first', 'info')
      return
    }

    if (!this.meter.tryConsume()) {
      this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: true } })
      return
    }

    const now = Date.now()
    const units = knobs().tendUnits * currentMultiplier(g, now)
    const outcome = tendGarden(this.garden, cellIndex, units)
    if (!outcome.ok) return

    g.totalUnits += outcome.units
    if (source === 'step') g.totalSteps += 1
    this.publishGrowth(outcome.stageUps, outcome.blooms)
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.bus.emit({ type: 'gardener_update', data: g })
    this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: false } })
    this.scheduleSave()
  }

  /** Stage-ups and blooms from one tend, as events — plus the almanac bookkeeping
   *  a first-ever bloom of a species triggers. */
  private publishGrowth(stageUps: Array<{ cellIndex: number; speciesId: string; stage: number }>, blooms: Array<{ cellIndex: number; speciesId: string }>): void {
    const g = this.gardener
    const stages = stageCount()
    for (const s of stageUps) {
      this.bus.emit({ type: 'growth', data: { cellIndex: s.cellIndex, speciesId: s.speciesId, stage: s.stage, stages } })
    }
    for (const b of blooms) {
      const species = getSpecies(b.speciesId)
      const firstOfKind = !!g && !g.discovered.includes(b.speciesId)
      if (g) {
        g.blooms += 1
        if (firstOfKind) g.discovered.push(b.speciesId)
      }
      this.bus.emit({
        type: 'bloom',
        data: { cellIndex: b.cellIndex, speciesId: b.speciesId, speciesName: species?.name ?? b.speciesId, firstOfKind },
      })
    }
  }

  // --- the plot ---
  async plantSeed(cellIndex: number, speciesId: string): Promise<void> {
    const g = this.gardener; if (!g) return
    rollDay(g, Date.now())
    const r = plantSeed(this.garden, g, cellIndex, speciesId, Date.now())
    if (!r.ok) { this.notify({ text: r.reason ?? 'cannot plant there', tone: 'warn' }); return }
    const species = getSpecies(speciesId)
    this.notify({ text: `Sowed ${species?.name ?? speciesId} — ${plantsLeftToday(g)} left today`, tone: 'good' })
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.bus.emit({ type: 'gardener_update', data: g })
    this.scheduleSave()
  }

  async clearCell(cellIndex: number): Promise<void> {
    const cell = this.garden.cells[cellIndex]
    const species = cell?.plant ? getSpecies(cell.plant.speciesId) : undefined
    const r = clearCell(this.garden, cellIndex)
    if (!r.ok) { this.notify({ text: r.reason ?? 'nothing to clear', tone: 'warn' }); return }
    this.notify({ text: `Cleared ${species?.name ?? 'the bed'}`, tone: 'info' })
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.scheduleSave()
  }

  async harvest(cellIndex: number): Promise<void> {
    const g = this.gardener; if (!g) return
    const r = harvestCell(this.garden, g, cellIndex)
    if (!r.ok) { this.notify({ text: r.reason ?? 'nothing to harvest', tone: 'warn' }); return }
    const species = getSpecies(r.speciesId)
    this.bus.emit({
      type: 'harvest',
      data: { cellIndex, speciesId: r.speciesId, speciesName: species?.name ?? r.speciesId, seeds: r.seeds, petals: r.petals },
    })
    this.bus.emit({ type: 'garden_update', data: this.garden })
    this.bus.emit({ type: 'gardener_update', data: g })
    this.scheduleSave()
  }

  // --- potting shed ---
  /** The gnome tends the active bed at the same capped rate a walker would —
   *  it buys comfort, not advantage. */
  private runGnome(): void {
    const g = this.gardener
    if (!g || !isGnomeWorking(g, Date.now())) return
    const cellIndex = this.garden.activeCell
    if (cellIndex == null || !isGrowing(this.garden.cells[cellIndex]?.plant ?? null)) return

    const units = knobs().tendUnits * currentMultiplier(g, Date.now())
    const stageUps: Array<{ cellIndex: number; speciesId: string; stage: number }> = []
    const blooms: Array<{ cellIndex: number; speciesId: string; stage: number }> = []
    let fired = 0
    for (let i = 0; i < GNOME_BURST; i++) {
      if (!isGrowing(this.garden.cells[cellIndex]?.plant ?? null)) break
      if (!this.meter.tryConsume()) break
      const outcome = tendGarden(this.garden, cellIndex, units)
      if (!outcome.ok) break
      g.totalUnits += outcome.units
      stageUps.push(...outcome.stageUps)
      blooms.push(...outcome.blooms)
      fired++
    }
    if (fired > 0) {
      this.publishGrowth(stageUps, blooms)
      this.bus.emit({ type: 'garden_update', data: this.garden })
      this.bus.emit({ type: 'gardener_update', data: g })
      this.bus.emit({ type: 'throttle', data: { remaining: this.meter.remaining(), capacity: this.meter.cap(), blocked: false } })
    }
  }

  async buyItem(itemId: string): Promise<void> {
    const g = this.gardener; if (!g) return
    const item = getShopItem(itemId)
    const r = shopBuy(g, itemId)
    if (!r.ok) { this.notify({ text: r.reason ?? 'cannot buy that', tone: 'warn' }); return }
    if (r.granted) {
      const species = getSpecies(r.granted.speciesId)
      this.notify({ text: `${r.granted.count} × ${species?.name ?? r.granted.speciesId} seeds`, tone: 'good' })
    } else {
      this.notify({ text: `Bought ${item?.label ?? itemId}`, tone: 'good' })
    }
    this.bus.emit({ type: 'gardener_update', data: g })
    this.scheduleSave()
  }

  async useItem(itemId: string): Promise<void> {
    const g = this.gardener; if (!g) return
    const item = getShopItem(itemId)
    const r = shopUse(g, itemId, Date.now())
    this.notify(r.ok ? { text: `Used ${item?.label ?? itemId}`, tone: 'good' } : { text: r.reason ?? 'cannot use that', tone: 'warn' })
    if (r.ok) { this.bus.emit({ type: 'gardener_update', data: g }); this.scheduleSave() }
  }

  // --- notices ---
  private notify(data: { text: string; tone: 'info' | 'good' | 'warn' }): void {
    this.bus.emit({ type: 'notice', data })
  }

  /** Throttled repeat-notice (same key ⇒ at most once per 4s). */
  private maybeNotice(key: string, text: string, tone: 'info' | 'good' | 'warn' = 'warn'): void {
    const now = Date.now()
    if (key !== this.lastNoticeKey || now - this.lastNoticeAt > 4000) {
      this.notify({ text, tone })
      this.lastNoticeKey = key
      this.lastNoticeAt = now
    }
  }

  // --- realtime ---
  on(handler: (e: GameEvent) => void): () => void { return this.bus.on(handler) }
  connectionState(): ConnectionState { return 'connected' }
}
