// The input dial. Walking is the game's engine — this button is the same input
// by hand, for when the phone is on a desk (or the device has no motion sensor),
// and it draws from the same throttle bucket, so tapping can never out-pace
// walking. The meter under the dial is that bucket refilling.
import { useState, useCallback } from 'react'
import { playTendSound, haptic } from '../sound'

interface Particle { id: number; dx: number; dy: number }

interface WaterButtonProps {
  onTend: () => void
  /** what the tend is aimed at, for the label over the dial. */
  targetName: string
  /** growth units one tend is worth right now (fertilizer included). */
  unitsPerTend: number
  totalUnits: number
  /** throttle meter 0..1; 1 = a full watering can. */
  meter: number
  blocked: boolean
  /** active fertilizer multiplier (1 = none). */
  multiplier: number
  /** a gnome is tending for you. */
  gnome: boolean
  /** no growing plant is selected — the dial has nothing to water. */
  idle: boolean
  /** Walk Mode — omitted on devices without motion sensors. */
  walk?: { active: boolean; steps: number; activity: 'idle' | 'walking' | 'jogging'; onToggle: () => void }
}

const WALK_LABELS = {
  idle: '🚶 WALK MODE ON',
  walking: '🚶 WALKING',
  jogging: '🏃 JOGGING',
} as const

export default function WaterButton({
  onTend, targetName, unitsPerTend, totalUnits, meter, blocked, multiplier, gnome, idle, walk,
}: WaterButtonProps) {
  const [pressing, setPressing] = useState(false)
  const [drops, setDrops] = useState<Particle[]>([])

  const handleTend = useCallback(() => {
    playTendSound(multiplier > 1 ? 1.2 : 1)
    haptic(multiplier > 1 ? 16 : 10)
    setPressing(true)
    setTimeout(() => setPressing(false), 100)

    const id = Date.now()
    const made: Particle[] = Array.from({ length: 6 }, (_, i) => {
      const angle = ((360 / 6) * i + Math.random() * 30 - 15) * (Math.PI / 180)
      const dist = 38 + Math.random() * 18
      return { id: id + i, dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
    })
    setDrops(prev => [...prev, ...made])
    setTimeout(() => setDrops(prev => prev.filter(p => !made.some(m => m.id === p.id))), 500)
    onTend()
  }, [onTend, multiplier])

  return (
    <div className={`water-area${multiplier > 1 ? ' boosted' : ''}`}>
      <span className="water-target">
        {idle ? 'no bed chosen' : targetName}
        {multiplier > 1 && <span className="accent"> · 🌱{multiplier}×</span>}
        {gnome && <span className="good"> · 🧙</span>}
      </span>

      <div className="dial">
        <div className="dial-ring" />
        {drops.map(p => (
          <div key={p.id} className="drop" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` } as React.CSSProperties} />
        ))}
        <button className={`water-btn${pressing ? ' pressing' : ''}`} onClick={handleTend} disabled={idle}>
          WATER
          <span className="per-tend">+{round(unitsPerTend)}</span>
        </button>
      </div>

      <div className={`throttle-meter${meter < 0.15 ? ' hot' : ''}`} title="tend rate">
        <span style={{ width: `${Math.round(meter * 100)}%` }} />
      </div>

      <span className="tend-count">{Math.round(totalUnits).toLocaleString()} growth</span>

      {walk && (
        <button
          className={`walk-toggle${walk.active ? ` on ${walk.activity}` : ''}`}
          onClick={walk.onToggle}
          aria-pressed={walk.active}
          title="Turn your steps into growth — the same rate cap as tapping"
        >
          {walk.active ? `${WALK_LABELS[walk.activity]} · ${walk.steps}` : '🚶 GROW BY WALKING'}
        </button>
      )}
      {blocked && <span className="rate-warn">Easy — the soil needs a moment</span>}
    </div>
  )
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
