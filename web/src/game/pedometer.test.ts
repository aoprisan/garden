import { describe, it, expect } from 'vitest'
import { StepDetector, ActivityMeter } from './pedometer'

const G = 9.81
const HZ = 60

/** Feed `seconds` of a synthetic vertical-bounce walking signal at `cadenceHz`
 *  steps per second and return how many steps the detector counted. */
function walk(det: StepDetector, seconds: number, cadenceHz: number, amplitude = 2.5): number {
  let steps = 0
  for (let i = 0; i < seconds * HZ; i++) {
    const t = (i / HZ) * 1000
    const bounce = amplitude * Math.sin(2 * Math.PI * cadenceHz * (i / HZ))
    if (det.sample(t, 0, 0, G + bounce)) steps++
  }
  return steps
}

describe('StepDetector', () => {
  it('counts steps from a walking-cadence signal', () => {
    // 2 steps/s for 5s → 10 impacts; allow edge effects at the boundaries.
    const steps = walk(new StepDetector(), 5, 2)
    expect(steps).toBeGreaterThanOrEqual(8)
    expect(steps).toBeLessThanOrEqual(11)
  })

  it('ignores a stationary phone with sensor noise', () => {
    const det = new StepDetector()
    let steps = 0
    for (let i = 0; i < 10 * HZ; i++) {
      const noise = 0.3 * Math.sin(i * 1.7) // sub-threshold jitter
      if (det.sample((i / HZ) * 1000, 0.1, 0.1, G + noise)) steps++
    }
    expect(steps).toBe(0)
  })

  it('is orientation-independent (phone on its side)', () => {
    const det = new StepDetector()
    let steps = 0
    for (let i = 0; i < 5 * HZ; i++) {
      const bounce = 2.5 * Math.sin(2 * Math.PI * 2 * (i / HZ))
      if (det.sample((i / HZ) * 1000, G + bounce, 0, 0)) steps++ // gravity along x
    }
    expect(steps).toBeGreaterThanOrEqual(8)
  })

  it('refuses implausible cadence — two spikes inside the refractory window count once', () => {
    const det = new StepDetector()
    let steps = 0
    // settle the baseline first
    for (let i = 0; i < HZ; i++) det.sample((i / HZ) * 1000, 0, 0, G)
    const spike = (at: number) => {
      for (let i = 0; i < 6; i++) {
        const t = at + i * (1000 / HZ)
        const v = i === 2 ? 3 : 0 // one sharp impact, then quiet
        if (det.sample(t, 0, 0, G + v)) steps++
      }
    }
    spike(1000)
    spike(1100) // 100ms later — inside the 280ms refractory window
    expect(steps).toBe(1)
    spike(1500) // 400ms later — a plausible next step
    expect(steps).toBe(2)
  })

  it('requires the signal to dip before re-arming (hysteresis)', () => {
    const det = new StepDetector()
    for (let i = 0; i < HZ; i++) det.sample((i / HZ) * 1000, 0, 0, G)
    let steps = 0
    // a long plateau above threshold is one step, not one per sample
    for (let i = 0; i < HZ; i++) {
      if (det.sample(1000 + i * (1000 / HZ), 0, 0, G + 3)) steps++
    }
    expect(steps).toBe(1)
  })
})

/** Record steps at a steady cadence (steps/min) for `seconds`, return the meter. */
function stride(spm: number, seconds: number): ActivityMeter {
  const meter = new ActivityMeter()
  const gap = 60_000 / spm
  for (let t = 0; t <= seconds * 1000; t += gap) meter.recordStep(t)
  return meter
}

describe('ActivityMeter', () => {
  it('classifies a walking cadence as walking', () => {
    const meter = stride(105, 20)
    expect(meter.activity(20_000)).toBe('walking')
  })

  it('classifies a jogging cadence as jogging', () => {
    const meter = stride(165, 20)
    expect(meter.activity(20_000)).toBe('jogging')
  })

  it('reports cadence from the trailing window', () => {
    const meter = stride(120, 20)
    expect(meter.cadence(20_000)).toBeGreaterThan(105)
    expect(meter.cadence(20_000)).toBeLessThan(135)
  })

  it('drops to idle when the steps stop', () => {
    const meter = stride(165, 20)
    expect(meter.activity(20_000)).toBe('jogging')
    expect(meter.activity(24_000)).toBe('idle')
  })

  it('starts idle before any step', () => {
    expect(new ActivityMeter().activity(0)).toBe('idle')
  })
})
