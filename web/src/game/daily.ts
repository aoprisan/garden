// The day clock. A game day gates how many seeds may be planted (design: two a
// day); clearing and tending are never gated. Day length is a knob, so a test
// (or a demo) can set it to a minute and watch the allowance come back.
import type { Gardener } from '../types'
import { knobs } from './config'
import { dayLengthMs } from './tuning'

/** Which game day `now` falls in. Days are counted from the epoch so the index
 *  is stable across reloads and devices, and a day-length change just re-slices
 *  the same timeline. */
export function dayIndexAt(now: number): number {
  return Math.floor(now / dayLengthMs(knobs()))
}

/** Seeds the gardener may still plant today. */
export function plantsLeftToday(gardener: Gardener): number {
  const perDay = Math.max(0, Math.floor(knobs().plantsPerDay))
  return Math.max(0, perDay - gardener.plantedToday)
}

/** Roll the gardener onto the current day if it has moved on, refreshing the
 *  planting allowance. Returns true when a new day actually started. */
export function rollDay(gardener: Gardener, now: number): boolean {
  const today = dayIndexAt(now)
  if (today === gardener.dayIndex) return false
  gardener.dayIndex = today
  gardener.plantedToday = 0
  return true
}

/** ms until the planting allowance refreshes — for the HUD countdown. */
export function msUntilNextDay(now: number): number {
  const len = dayLengthMs(knobs())
  return len - (now % len)
}
