// The seed tray: what's in the inventory and what may still go in the ground
// today. Planting is the one action the day gates (design: "players can plant
// e.g. 2 seeds a day"), so the allowance and the countdown to the next day live
// here rather than buried in a menu.
import { useMemo } from 'react'
import type { Gardener } from '../types'
import { getSpecies } from '../game/catalog'
import { plantsLeftToday } from '../game/daily'
import { heldSpecies, totalSeeds } from '../game/inventory'

interface Props {
  gardener: Gardener
  /** the bed a seed would go into; null when nothing is selected. */
  targetCell: number | null
  /** true when that bed is free. */
  targetEmpty: boolean
  msToNextDay: number
  onPlant: (speciesId: string) => void
}

export default function SeedTray({ gardener, targetCell, targetEmpty, msToNextDay, onPlant }: Props) {
  const left = plantsLeftToday(gardener)
  const held = useMemo(
    () => heldSpecies(gardener)
      .map(id => ({ id, species: getSpecies(id), count: gardener.seeds[id] }))
      .filter((s): s is { id: string; species: NonNullable<ReturnType<typeof getSpecies>>; count: number } => !!s.species)
      .sort((a, b) => a.species.name.localeCompare(b.species.name)),
    [gardener],
  )

  const canPlant = left > 0 && targetCell != null && targetEmpty

  return (
    <section className="panel seed-tray">
      <div className="panel-head">
        <span className="panel-label">Seed tray</span>
        <span className="tiny muted">{totalSeeds(gardener)} seeds</span>
      </div>

      <div className={`day-allowance${left === 0 ? ' spent' : ''}`}>
        <b>{left}</b> {left === 1 ? 'seed' : 'seeds'} to plant today
        {left === 0 && <span className="tiny muted"> · next in {formatCountdown(msToNextDay)}</span>}
      </div>

      <p className="tiny muted plant-hint">
        {targetCell == null
          ? 'Pick a bed in the garden, then sow into it.'
          : targetEmpty
            ? 'Sow one of these into the chosen bed.'
            : 'That bed is taken — clear or harvest it first.'}
      </p>

      <div className="scroll-y tray-list">
        {held.length === 0 && <p className="tiny muted">The tray is empty. Harvest a bloom, or buy a packet in the shed.</p>}
        {held.map(({ id, species, count }) => (
          <div key={id} className="tray-row">
            <span className="seed-dot" style={{ background: species.petalColor }} />
            <span className="item-name">{species.name}</span>
            <span className={`rarity ${species.rarity}`}>{species.rarity}</span>
            <span className="tiny muted">×{count}</span>
            <button className="mini-btn primary" disabled={!canPlant} onClick={() => onPlant(id)}>sow</button>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
