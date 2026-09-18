// Soft tend throttle with a visible meter: tending is capped at a max rate,
// shown as a refilling watering can so the cap "feels like a rule, not a bug".
// Steps and taps go through the SAME meter, which is what keeps walking an
// alternative input rather than a faster one. The cap is data-driven — tune
// tend.capacity / tend.refill_per_sec in the tuning CSV. A meter reads the knobs
// when it's constructed, so a config swap takes effect on the next reset (which
// is when the client rebuilds it).
import { knobs } from './config'

export class RateMeter {
  private tokens: number
  private last: number
  constructor(
    private capacity = knobs().tendCapacity,
    private refillPerSec = knobs().tendRefillPerSec,
    private clock: () => number = () => performance.now(),
  ) {
    this.tokens = capacity
    this.last = this.clock()
  }

  private refill(): void {
    const now = this.clock()
    const dt = Math.max(0, (now - this.last) / 1000)
    this.tokens = Math.min(this.capacity, this.tokens + dt * this.refillPerSec)
    this.last = now
  }

  /** Try to spend one tend. Returns whether it was allowed. */
  tryConsume(): boolean {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }
    return false
  }

  remaining(): number {
    this.refill()
    return Math.floor(this.tokens)
  }

  cap(): number { return this.capacity }
}
