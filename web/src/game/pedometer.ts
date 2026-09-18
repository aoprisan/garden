// Step detection — the engine of the whole game: "plants and flowers grow when
// players walk". Raw accelerometer samples become discrete steps, and each step
// is fed through the SAME throttle-capped tend path as the WATER button, so
// tapping stays a fallback rather than a shortcut.
//
// The algorithm is a classic orientation-free pedometer: take the magnitude of
// accelerationIncludingGravity (so it works with the phone in a hand, pocket or
// armband), track a slow exponential-moving-average baseline (~gravity), and
// fire a step when the deviation spikes above a threshold — with hysteresis
// (must dip back down before re-arming) and a refractory window (no plausible
// human cadence exceeds ~3.5 steps/s) so vibration jitter doesn't count.

export interface StepDetectorOptions {
  /** m/s² above the baseline that counts as a step impact. */
  threshold?: number
  /** deviation must fall back below this before the next step can fire. */
  resetBelow?: number
  /** refractory window between steps, ms (caps cadence, kills jitter). */
  minStepMs?: number
  /** EMA smoothing factor for the gravity baseline (per sample, ~60Hz). */
  baselineAlpha?: number
}

export class StepDetector {
  private readonly threshold: number
  private readonly resetBelow: number
  private readonly minStepMs: number
  private readonly alpha: number
  private baseline: number | null = null
  private armed = true
  private lastStepAt = -Infinity

  constructor(opts: StepDetectorOptions = {}) {
    this.threshold = opts.threshold ?? 1.5
    this.resetBelow = opts.resetBelow ?? 0.6
    this.minStepMs = opts.minStepMs ?? 280
    this.alpha = opts.baselineAlpha ?? 0.02
  }

  /** Feed one accelerometer sample; returns true when a step is detected. */
  sample(tMs: number, x: number, y: number, z: number): boolean {
    const mag = Math.sqrt(x * x + y * y + z * z)
    if (this.baseline == null) {
      this.baseline = mag
      return false
    }
    const deviation = mag - this.baseline
    this.baseline += this.alpha * (mag - this.baseline)

    if (this.armed && deviation > this.threshold && tMs - this.lastStepAt >= this.minStepMs) {
      this.armed = false
      this.lastStepAt = tMs
      return true
    }
    if (!this.armed && deviation < this.resetBelow) this.armed = true
    return false
  }
}

// --- activity classification -------------------------------------------------
// Fitness trackers distinguish walking from jogging; so does the garden — from
// ONE toggle, by cadence, no separate button per activity. The label is purely
// informative plus flavor: a jogger grows more only because they take more
// steps (still throttle-capped). Activity NEVER grants a growth multiplier —
// multipliers come from fertilizer, which is earned by harvesting.

export type Activity = 'idle' | 'walking' | 'jogging'

/** Trailing cadence window, ms. ~6s balances responsiveness vs stability. */
const CADENCE_WINDOW_MS = 6000
/** No step for this long → idle (standing still with the toggle on). */
const IDLE_AFTER_MS = 3000
/** Jogging cadence floor, steps/min. Walking tops out ~120; jogging ~150+. */
const JOGGING_SPM = 140

export class ActivityMeter {
  private stepTimes: number[] = []

  recordStep(tMs: number): void {
    this.stepTimes.push(tMs)
    const cutoff = tMs - CADENCE_WINDOW_MS
    while (this.stepTimes.length > 0 && this.stepTimes[0] < cutoff) this.stepTimes.shift()
  }

  /** Steps per minute over the trailing window. */
  cadence(nowMs: number): number {
    const cutoff = nowMs - CADENCE_WINDOW_MS
    const recent = this.stepTimes.filter(t => t >= cutoff)
    return (recent.length / CADENCE_WINDOW_MS) * 60_000
  }

  activity(nowMs: number): Activity {
    const last = this.stepTimes[this.stepTimes.length - 1]
    if (last == null || nowMs - last > IDLE_AFTER_MS) return 'idle'
    return this.cadence(nowMs) >= JOGGING_SPM ? 'jogging' : 'walking'
  }
}
