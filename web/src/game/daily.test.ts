import { describe, it, expect, beforeEach } from 'vitest'
import { dayIndexAt, msUntilNextDay, plantsLeftToday, rollDay } from './daily'
import { applyConfig, resetConfig, knobs } from './config'
import { dayLengthMs } from './tuning'
import { makeGardener } from './testUtils'

describe('the day clock', () => {
  beforeEach(() => resetConfig())

  it('slices real time into days of the configured length', () => {
    const len = dayLengthMs(knobs())
    expect(dayIndexAt(0)).toBe(0)
    expect(dayIndexAt(len - 1)).toBe(0)
    expect(dayIndexAt(len)).toBe(1)
    expect(msUntilNextDay(len * 3 + 1000)).toBe(len - 1000)
  })

  it('refreshes the planting allowance when the day turns', () => {
    const gardener = makeGardener({ dayIndex: dayIndexAt(0), plantedToday: 2 })
    expect(plantsLeftToday(gardener)).toBe(0)
    expect(rollDay(gardener, 0)).toBe(false)

    const len = dayLengthMs(knobs())
    expect(rollDay(gardener, len)).toBe(true)
    expect(gardener.plantedToday).toBe(0)
    expect(plantsLeftToday(gardener)).toBe(knobs().plantsPerDay)
    expect(rollDay(gardener, len + 5)).toBe(false) // same day now
  })

  it('follows a shortened test day', () => {
    applyConfig({ tuningCsv: 'key,value\nday.length_minutes,1\nday.plants,3\n' }, { persist: false })
    try {
      const gardener = makeGardener({ dayIndex: dayIndexAt(0), plantedToday: 3 })
      expect(plantsLeftToday(gardener)).toBe(0)
      expect(rollDay(gardener, 60_000)).toBe(true)
      expect(plantsLeftToday(gardener)).toBe(3)
    } finally {
      resetConfig()
    }
  })
})
