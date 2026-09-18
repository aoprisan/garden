import { describe, it, expect } from 'vitest'
import { RateMeter } from './throttle'

describe('RateMeter', () => {
  it('caps the burst then refills over time', () => {
    let now = 0
    const meter = new RateMeter(5, 5, () => now) // 5 burst, 5/sec
    for (let i = 0; i < 5; i++) expect(meter.tryConsume()).toBe(true)
    expect(meter.tryConsume()).toBe(false) // bucket empty
    now += 1000 // one second → +5 tokens
    expect(meter.tryConsume()).toBe(true)
    expect(meter.remaining()).toBeGreaterThanOrEqual(3)
  })
})
