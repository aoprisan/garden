// The almanac: every species in the catalog, and which of them have bloomed
// here. It is the collection the game is played for — seeds of a kind you have
// never grown only come out of the shed's packets, so the list doubles as the
// long-term goal.
import { useMemo, useState } from 'react'
import type { Gardener } from '../types'
import { allSpecies } from '../game/catalog'
import PlantSprite from './PlantSprite'

export default function Almanac({ gardener, onClose }: { gardener: Gardener; onClose: () => void }) {
  const [filter, setFilter] = useState('')
  const species = allSpecies()
  const found = useMemo(() => new Set(gardener.discovered), [gardener.discovered])
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return species.filter(s => !q || s.name.toLowerCase().includes(q) || s.family.toLowerCase().includes(q))
  }, [species, filter])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal panel" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="panel-label">Almanac <span className="muted">· {found.size}/{species.length} grown</span></span>
          <button className="close-btn" onClick={onClose}>close ✕</button>
        </div>
        <input className="field" placeholder="Search a plant or family…" value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="scroll-y almanac-grid">
          {rows.map(s => {
            const known = found.has(s.id)
            const held = gardener.seeds[s.id] || 0
            return (
              <div key={s.id} className={`almanac-card${known ? '' : ' unknown'}`}>
                <div className="almanac-art">
                  <PlantSprite species={s} stage={known ? 10 : 3} stages={10} seed={s.id.length + 7} />
                </div>
                <div className="item-name">{known ? s.name : '???'}</div>
                <div className="tiny muted">{s.family} · <span className={`rarity ${s.rarity}`}>{s.rarity}</span></div>
                {known && <p className="tiny blurb">{s.blurb}</p>}
                <div className="tiny muted">{held > 0 ? `${held} seed${held === 1 ? '' : 's'} in the tray` : 'no seeds'}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
