import { useState } from 'react'
import { allSpecies } from '../game/catalog'
import { knobs } from '../game/config'
import PlantSprite from './PlantSprite'

interface Props {
  onRegister: (name: string) => void
}

/** First run: name the garden and see what's in the starting tray. There is no
 *  account and no server — the name is just what the HUD calls the plot. */
export default function Onboarding({ onRegister }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const starting = Object.entries(knobs().startingSeeds)
  const byId = new Map(allSpecies().map(s => [s.id, s]))

  function submit() {
    if (name.trim().length < 2) { setError('Give the garden a name'); return }
    onRegister(name.trim())
  }

  return (
    <div className="overlay onboard">
      <div className="modal panel onboard-card">
        <div className="onboard-title">A patch of ground</div>
        <p className="onboard-sub">
          Plant seeds, then <b>walk</b>. Every step you take grows what is in the ground — tapping
          works too, at exactly the same capped pace. You may sow <b>{Math.floor(knobs().plantsPerDay)} seeds a day</b>;
          clearing a bed is free and unlimited.
        </p>

        <div className="starting-tray">
          {starting.map(([id, count]) => {
            const s = byId.get(id)
            if (!s) return null
            return (
              <div key={id} className="starting-seed" title={`${s.name} ×${count}`}>
                <PlantSprite species={s} stage={10} stages={10} seed={id.length} />
                <span className="tiny">{s.name} ×{count}</span>
              </div>
            )
          })}
        </div>

        <input
          className="field"
          autoFocus
          placeholder="Name your garden"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {error && <div className="form-error">{error}</div>}
        <button className="btn" onClick={submit}>Break ground</button>
      </div>
    </div>
  )
}
