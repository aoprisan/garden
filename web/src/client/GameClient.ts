import type { Garden, Gardener, GameEvent } from '../types'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

/** Where a unit of tending came from. Steps are the point of the game; taps are
 *  the accessible fallback. They are worth exactly the same and pass through the
 *  same throttle — the distinction only feeds the counters. */
export type TendSource = 'tap' | 'step' | 'gnome'

/**
 * The single seam between the UI and the garden. Today only LocalGameClient
 * exists (in-browser, no server). If gardens ever become shared, a
 * LiveGameClient wrapping fetch + WebSocket implements this same interface and
 * the UI does not change. See src/client/index.ts for selection.
 */
export interface GameClient {
  // --- reads ---
  getGarden(): Promise<Garden>
  me(): Promise<Gardener | null>

  // --- identity ---
  register(name: string): Promise<Gardener>

  // --- the core loop ---
  /** Spend one step (or tap) of growth on a cell. Emits garden_update plus
   *  throttle; a dropped tend (rate cap) emits throttle only. */
  tend(cellIndex: number, source?: TendSource): void

  /** Aim tending — and any working gnome — at a cell. Selecting a bed in the UI
   *  must call this, or the gnome keeps tending whatever was chosen last. */
  setActiveCell(cellIndex: number | null): void

  // --- the plot ---
  /** Sow one seed from the tray (costs one of the day's planting slots). */
  plantSeed(cellIndex: number, speciesId: string): Promise<void>
  /** Pull a plant out. Unlimited per day; a plant not yet in bloom is lost. */
  clearCell(cellIndex: number): Promise<void>
  /** Collect a bloom: seeds back, petals earned, cell freed. */
  harvest(cellIndex: number): Promise<void>

  // --- potting shed ---
  /** Spend petals (seed packet, fertilizer, gnome). */
  buyItem(itemId: string): Promise<void>
  /** Activate an owned fertilizer or gnome. */
  useItem(itemId: string): Promise<void>

  // --- admin ---
  /** Dig the whole thing up and start over: the plot, the gardener and the
   *  persisted save are gone. Used by the Config panel (new species or a new
   *  grid size make the old plot meaningless) and by "reset garden" on its own.
   *  Emits world_reset, which the UI treats as "drop everything you cached". */
  resetGame(reason?: string): Promise<void>

  // --- realtime ---
  on(handler: (e: GameEvent) => void): () => void
  connectionState(): ConnectionState
}

/** Minimal synchronous pub/sub used by the local client and event hooks. */
export class EventBus {
  private handlers = new Set<(e: GameEvent) => void>()

  on(handler: (e: GameEvent) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(e: GameEvent): void {
    for (const h of this.handlers) {
      try { h(e) } catch { /* never let one listener break the loop */ }
    }
  }
}
