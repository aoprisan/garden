// First-session coach card: sow → choose a bed → walk → harvest. It advances on
// real progress rather than timers, and is never shown again once finished or
// skipped. The one thing that isn't obvious cold is that growth comes from
// steps, so that is where it spends its words.
import { useEffect, useState } from 'react'
import type { Garden, Gardener } from '../types'
import { isBloomed } from '../game/garden'

const DONE_KEY = 'gd.tutorial.v1'

interface Step {
  tag: string
  text: string
  done: (garden: Garden, gardener: Gardener) => boolean
}

const STEPS: Step[] = [
  {
    tag: 'STEP 1 · SOW',
    text: 'Pick a bed in the garden, then sow a seed from the tray. Two seeds a day — choose them well.',
    done: garden => garden.cells.some(c => c.plant),
  },
  {
    tag: 'STEP 2 · WALK',
    text: 'Turn on GROW BY WALKING and take a walk: every step feeds the bed you chose, and a quarter of it spreads to everything else still growing. No sensors? WATER taps at the same capped rate.',
    done: (_g, gardener) => gardener.totalUnits > 0,
  },
  {
    tag: 'STEP 3 · HARVEST',
    text: 'Ten stages from seed to bloom. A bloom you harvest gives its seeds back plus petals — petals buy new kinds in the potting shed, and that is how the almanac fills out.',
    done: (garden, gardener) => gardener.harvests > 0 || garden.cells.some(c => c.plant && isBloomed(c.plant)),
  },
]

export default function Tutorial({ garden, gardener }: { garden: Garden; gardener: Gardener }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DONE_KEY) === '1' } catch { return false }
  })

  const stepIndex = STEPS.findIndex(s => !s.done(garden, gardener))

  useEffect(() => {
    if (stepIndex === -1 && !dismissed) {
      try { localStorage.setItem(DONE_KEY, '1') } catch { /* storage off — fine */ }
    }
  }, [stepIndex, dismissed])

  if (dismissed || stepIndex === -1) return null
  const step = STEPS[stepIndex]

  function finish() {
    try { localStorage.setItem(DONE_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="panel tutorial-card">
      <div className="tutorial-head">
        <span className="panel-label">{step.tag}</span>
        <span className="tiny muted">{stepIndex + 1}/{STEPS.length}</span>
        <button className="close-btn" onClick={finish} title="dismiss">skip ✕</button>
      </div>
      <p className="tiny">{step.text}</p>
    </div>
  )
}
