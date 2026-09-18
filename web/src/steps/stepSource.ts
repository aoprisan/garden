// The seam between Walk Mode and wherever steps come from. One source ships
// today:
//
// - DeviceMotionStepSource (web/PWA): raw accelerometer → StepDetector. Only
//   works while the page is open and the screen on — browsers stop motion
//   events on lock/background.
//
// The interface is deliberately wider than that: claimBanked() is how an OS
// step counter (a Capacitor wrapper around the platform pedometer) would hand
// over the steps taken while the app was closed, to be drip-fed through the
// same throttle. A native source implements this interface and nothing above it
// changes.
//
// Either way one onStep call = one step = one throttle-capped tend.

export type StepSourceStatus = 'active' | 'denied'

export interface StepSource {
  /** Begin delivering live steps; one onStep call per step, timestamped on the
   *  performance.now() clock. Must be called from a user gesture (permission
   *  prompts). Resolves 'denied' when the OS/browser refuses motion access. */
  start(onStep: (tMs: number) => void): Promise<StepSourceStatus>
  stop(): void
  /** Steps the OS counted since the last claim — i.e. while the game was away.
   *  Advances the claim cursor. Always 0 on the web (no background counting). */
  claimBanked(): Promise<number>
}
