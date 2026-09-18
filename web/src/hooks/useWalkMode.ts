// Walk Mode — the game's headline input: "plants and flowers grow when players
// walk". It is OPT-IN (motion sensors need permission) and never replaces the
// WATER button; both stay available. While the toggle is on, a StepSource
// delivers steps, and every step fires the same onStep the button would, which
// routes through the same RateMeter throttle — so tapping can never out-pace
// walking. A cadence meter classifies the activity (walking vs jogging, one
// toggle for both, like a fitness tracker); jogging grows more only via more
// steps — activity never multiplies growth, multipliers are fertilizer.
//
// Where the OS keeps counting while the game is closed (a native wrapper), those
// BANKED steps are claimed on toggle-on and on each return to the foreground,
// then drip-fed as ordinary tends at walking pace — the same throttle path, so a
// 10k-step day is queued work, not an instant windfall.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityMeter } from '../game/pedometer'
import type { Activity } from '../game/pedometer'
import { selectStepSource } from '../steps'
import type { StepSource } from '../steps'

export type WalkModeStatus = 'idle' | 'active' | 'denied'
export type { Activity }
export { stepSourceSupported as walkModeSupported } from '../steps'

/** Banked steps kept per claim — a generous full day's walk. Bounds how much
 *  away-time converts to growth. */
const BANK_MAX = 12_000
/** Drip pace for banked steps, ms per step (~4/s — brisk-walk cadence, and
 *  comfortably under the tend throttle's refill so live steps still fit). */
const BANK_DRIP_MS = 250

export function useWalkMode(onStep: () => void) {
  const [status, setStatus] = useState<WalkModeStatus>('idle')
  const [steps, setSteps] = useState(0)
  const [activity, setActivity] = useState<Activity>('idle')
  const [banked, setBanked] = useState(0)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  const sourceRef = useRef<StepSource | null>(null)
  const activeRef = useRef(false)
  const bankRef = useRef(0)
  const timersRef = useRef<Array<ReturnType<typeof setInterval>>>([])

  const stop = useCallback(() => {
    activeRef.current = false
    sourceRef.current?.stop()
    for (const t of timersRef.current) clearInterval(t)
    timersRef.current = []
    setActivity('idle')
    setStatus('idle')
  }, [])

  useEffect(() => stop, [stop]) // detach on unmount

  // Returning to the foreground while walk mode is on: claim what the OS
  // counted in the meantime (native only — the web source claims 0).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !activeRef.current) return
      void sourceRef.current?.claimBanked().then(n => {
        if (n > 0) {
          bankRef.current = Math.min(BANK_MAX, bankRef.current + n)
          setBanked(bankRef.current)
        }
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  /** Toggle walk mode. Resolves to the resulting status (plus any steps banked
   *  while away) so the caller can surface both. Must be called from a user
   *  gesture — permission prompts only show then. */
  const toggle = useCallback(async (): Promise<{ status: WalkModeStatus; banked: number }> => {
    if (activeRef.current) {
      stop()
      return { status: 'idle', banked: 0 }
    }
    const source = (sourceRef.current ??= selectStepSource())
    const meter = new ActivityMeter()
    const result = await source.start(tMs => {
      meter.recordStep(tMs)
      setActivity(meter.activity(tMs))
      setSteps(s => s + 1)
      stepRef.current()
    })
    if (result !== 'active') {
      setStatus('denied')
      return { status: 'denied', banked: 0 }
    }
    activeRef.current = true
    setSteps(0)
    setActivity('idle')
    setStatus('active')

    const claimed = Math.min(BANK_MAX, await source.claimBanked())
    bankRef.current = claimed
    setBanked(claimed)

    // Live cadence can only rise on steps — a slow timer lets the activity fall
    // back to idle when the player stands still (same performance.now clock).
    timersRef.current.push(setInterval(() => {
      setActivity(meter.activity(performance.now()))
    }, 1000))
    // Drip banked steps through the ordinary tend path at walking pace.
    timersRef.current.push(setInterval(() => {
      if (bankRef.current <= 0) return
      bankRef.current -= 1
      setBanked(bankRef.current)
      setSteps(s => s + 1)
      stepRef.current()
    }, BANK_DRIP_MS))

    return { status: 'active', banked: claimed }
  }, [stop])

  return { status, steps, activity, banked, toggle }
}
