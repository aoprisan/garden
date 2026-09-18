// The design tray: what's in the shed to put in the garden. The brief asks for
// gardens players "design and grow" — the seed tray is the growing half, this is
// the designing half.
//
// Arming a piece here is what turns a tap on a bed into placing rather than
// choosing; it stays armed so a path can be laid one tile after another, and
// disarms itself when the last one leaves the shed.
import { useMemo } from 'react'
import type { Decor, Gardener } from '../types'
import { getDecor } from '../game/catalog'
import { decorIdOf } from '../game/shop'

interface Props {
  gardener: Gardener
  /** the decor id a tap on a bed would place, if any. */
  placing: string | null
  onArm: (decorId: string | null) => void
}

const KIND_LABEL: Record<Decor['kind'], string> = {
  ground: 'under a plant',
  object: 'takes the bed',
  pot: 'holds a plant',
}

export default function DecorTray({ gardener, placing, onArm }: Props) {
  const held = useMemo(
    () => Object.entries(gardener.items)
      .map(([itemId, count]) => ({ decor: getDecor(decorIdOf(itemId)), count }))
      .filter((row): row is { decor: Decor; count: number } => !!row.decor && row.count > 0)
      .sort((a, b) => a.decor.kind.localeCompare(b.decor.kind) || a.decor.name.localeCompare(b.decor.name)),
    [gardener],
  )

  return (
    <section className="panel decor-tray">
      <div className="panel-head">
        <span className="panel-label">Design tray</span>
        {placing && <button className="mini-btn" onClick={() => onArm(null)}>done</button>}
      </div>

      <p className="tiny muted plant-hint">
        {placing
          ? 'Tap the beds you want it on. Tap “done” when the path is laid.'
          : held.length > 0
            ? 'Pick a piece, then tap a bed. Nothing here changes how fast anything grows.'
            : 'Nothing in the shed yet — buy paths, pots and ornaments with petals.'}
      </p>

      {held.length > 0 && (
        <div className="scroll-y tray-list">
          {held.map(({ decor, count }) => (
            <div key={decor.id} className={`tray-row${placing === decor.id ? ' armed' : ''}`}>
              <span className="seed-dot square" style={{ background: decor.color, borderColor: decor.accent }} />
              {/* name over its rule, so a long one isn't cut down to "Terrac…" */}
              <span className="shed-item">
                <span className="item-name">{decor.name}</span>
                <span className="tiny muted">{KIND_LABEL[decor.kind]}</span>
              </span>
              <span className="tiny muted">×{count}</span>
              <button
                className={`mini-btn${placing === decor.id ? '' : ' primary'}`}
                onClick={() => onArm(placing === decor.id ? null : decor.id)}
              >
                {placing === decor.id ? 'placing' : 'place'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
