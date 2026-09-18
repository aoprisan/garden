import { describe, it, expect } from 'vitest'
import {
  DEFAULT_KNOBS, dayLengthMs, formatTuningCsv, parseTuningCsv, stageCost, totalGrowthUnits,
} from './tuning'

describe('stage costs', () => {
  it('spread a species growth_units across every stage', () => {
    expect(totalGrowthUnits(200, DEFAULT_KNOBS)).toBeCloseTo(200, 6)
  })

  it('ramp: later stages cost more than earlier ones', () => {
    const first = stageCost(200, 0, DEFAULT_KNOBS)
    const last = stageCost(200, DEFAULT_KNOBS.stages - 1, DEFAULT_KNOBS)
    expect(last).toBeGreaterThan(first)
    expect(last / first).toBeCloseTo(1 + DEFAULT_KNOBS.growthRamp, 5)
  })

  it('a flat ramp makes every stage identical', () => {
    const knobs = { ...DEFAULT_KNOBS, growthRamp: 0 }
    expect(stageCost(200, 0, knobs)).toBeCloseTo(20, 6)
    expect(stageCost(200, 9, knobs)).toBeCloseTo(20, 6)
  })

  it('growth.scale stretches the whole ladder', () => {
    expect(totalGrowthUnits(200, { ...DEFAULT_KNOBS, growthScale: 2 })).toBeCloseTo(400, 6)
  })
})

describe('tuning.csv', () => {
  it('round-trips the built-in knobs unchanged', () => {
    const { knobs, warnings } = parseTuningCsv(formatTuningCsv(DEFAULT_KNOBS))
    expect(warnings).toEqual([])
    expect(knobs.gardenWidth).toBe(DEFAULT_KNOBS.gardenWidth)
    expect(knobs.stages).toBe(DEFAULT_KNOBS.stages)
    expect(knobs.plantsPerDay).toBe(DEFAULT_KNOBS.plantsPerDay)
    expect(knobs.startingSeeds).toEqual(DEFAULT_KNOBS.startingSeeds)
  })

  it('keeps defaults for omitted keys and warns about unknown ones', () => {
    const { knobs, warnings } = parseTuningCsv('key,value\nday.plants,5\nnot.a.knob,3\n')
    expect(knobs.plantsPerDay).toBe(5)
    expect(knobs.stages).toBe(DEFAULT_KNOBS.stages)
    expect(warnings.some(w => w.includes('not.a.knob'))).toBe(true)
  })

  it('naming one starting seed replaces the whole tray', () => {
    const { knobs } = parseTuningCsv('key,value\nstarting_seeds.poppy,4\n')
    expect(knobs.startingSeeds).toEqual({ poppy: 4 })
  })

  it('clamps knobs that would make an unplayable garden', () => {
    const { knobs, warnings } = parseTuningCsv('key,value\ngarden.width,0\ntend.spread,3\n')
    expect(knobs.gardenWidth).toBe(1)
    expect(knobs.tendSpread).toBe(1)
    expect(warnings.length).toBeGreaterThanOrEqual(2)
  })

  it('reads day length in minutes', () => {
    const { knobs } = parseTuningCsv('key,value\nday.length_minutes,2\n')
    expect(dayLengthMs(knobs)).toBe(120_000)
  })
})
