import { describe, it, expect, beforeEach } from 'vitest'
import { simulate, report, findInvariantViolations } from './balanceHarness'
import { resetConfig, knobs } from './config'
import { getSpecies } from './catalog'
import { totalGrowthUnits } from './tuning'

// These specs ARE the "sane bands" for the one number the design leaves TBD —
// how fast plants grow as you walk. The sim is deterministic, so a tuning change
// that makes a day's walk trivial (or pointless) trips a band here.

beforeEach(() => resetConfig())

describe('balance harness — invariants', () => {
  it('never breaks the rules of the plot, across seeds and step counts', () => {
    for (const seed of [1, 2, 7, 42]) {
      for (const stepsPerDay of [2000, 7000, 15000]) {
        const r = simulate({ seed, days: 10, stepsPerDay })
        const problems = findInvariantViolations(r)
        expect(problems, `seed=${seed} steps=${stepsPerDay}: ${problems.slice(0, 3).join('; ')}`).toEqual([])
      }
    }
  })

  it('is deterministic for a given seed', () => {
    const a = simulate({ seed: 5, days: 12 })
    const b = simulate({ seed: 5, days: 12 })
    expect(a.totals).toEqual(b.totals)
    expect(report(a)).toEqual(report(b))
  })

  it('never throttles an ordinary walking cadence', () => {
    // The cap exists to stop machine-speed tapping, not walking. Even a jogger
    // (3 steps/s) must never lose a step to it.
    expect(simulate({ days: 5, stepsPerDay: 12000, cadence: 3 }).throttledSteps).toBe(0)
  })
})

describe('balance harness — sane bands', () => {
  it('an ordinary 7k-steps-a-day walker finishes plants steadily', () => {
    const r = simulate({ seed: 1, days: 14, stepsPerDay: 7000 })
    // Two seeds a day is the design's pacing cap, so a fortnight can bloom at
    // most ~28 plants — a healthy walker should be close to that ceiling.
    expect(r.totals.blooms).toBeGreaterThanOrEqual(14)
    expect(r.totals.blooms).toBeLessThanOrEqual(14 * knobs().plantsPerDay)
    // Blooms pay for the shed.
    expect(r.totals.petals).toBeGreaterThan(50)
  })

  it('a sedentary 2k-steps day still moves the garden, just slower', () => {
    const slow = simulate({ seed: 1, days: 14, stepsPerDay: 2000 })
    const brisk = simulate({ seed: 1, days: 14, stepsPerDay: 7000 })
    expect(slow.totals.blooms).toBeGreaterThan(0)
    expect(slow.totals.blooms).toBeLessThan(brisk.totals.blooms)
  })

  it('a single common flower is a day or two of walking, not a minute', () => {
    const common = getSpecies('marigold')!
    const units = totalGrowthUnits(common.growthUnits, knobs()) / knobs().tendUnits
    expect(units).toBeGreaterThan(500)   // not a minute of tapping
    expect(units).toBeLessThan(20_000)   // not a month of walking
  })

  it('rare species cost meaningfully more walking than common ones', () => {
    const common = getSpecies('marigold')!
    const rare = getSpecies('wisteria')!
    expect(rare.growthUnits).toBeGreaterThan(common.growthUnits * 2)
  })

  it('the daily planting cap, not walking, is what limits a keen player', () => {
    // Walk a marathon a day and the garden still fills at two beds a day.
    const r = simulate({ seed: 3, days: 8, stepsPerDay: 40_000 })
    expect(r.totals.planted).toBeLessThanOrEqual(8 * knobs().plantsPerDay)
    expect(r.history.every(d => d.planted <= knobs().plantsPerDay)).toBe(true)
  })
})
