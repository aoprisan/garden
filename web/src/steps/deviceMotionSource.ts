// Web step source: DeviceMotion accelerometer → StepDetector. Foreground-only
// by browser design; claimBanked is always 0 here.
import { StepDetector } from '../game/pedometer'
import type { StepSource, StepSourceStatus } from './stepSource'

/** iOS Safari 13+ gates motion events behind a permission prompt that must be
 *  triggered from a user gesture; other browsers just fire the events. */
interface MotionEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

export function deviceMotionSupported(): boolean {
  return typeof window !== 'undefined'
    && typeof DeviceMotionEvent !== 'undefined'
    && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
}

export class DeviceMotionStepSource implements StepSource {
  private listener: ((e: DeviceMotionEvent) => void) | null = null

  async start(onStep: (tMs: number) => void): Promise<StepSourceStatus> {
    const ctor = DeviceMotionEvent as unknown as MotionEventCtor
    if (typeof ctor.requestPermission === 'function') {
      try {
        if (await ctor.requestPermission() !== 'granted') return 'denied'
      } catch {
        return 'denied'
      }
    }
    const detector = new StepDetector()
    this.listener = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity
      if (!a || a.x == null || a.y == null || a.z == null) return
      // event.timeStamp shares the performance.now() time origin
      if (detector.sample(e.timeStamp, a.x, a.y, a.z)) onStep(e.timeStamp)
    }
    window.addEventListener('devicemotion', this.listener)
    return 'active'
  }

  stop(): void {
    if (this.listener) {
      window.removeEventListener('devicemotion', this.listener)
      this.listener = null
    }
  }

  async claimBanked(): Promise<number> { return 0 }
}
