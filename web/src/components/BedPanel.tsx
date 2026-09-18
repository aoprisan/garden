// The chosen bed, up close: which plant is in it, how far along, how much more
// walking it wants, and the things you can do to it (tend by walking, harvest a
// bloom, clear the bed, take the decoration back to the shed).
import type { Cell, Species } from '../types'
import { getDecor, getSpecies, stageCount, bloomUnits } from '../game/catalog'
import { bloomProgress, unitsToBloom } from '../game/growth'
import { isBloomed } from '../game/garden'
import PlantSprite from './PlantSprite'

interface Props {
  cell: Cell | null
  onHarvest: (index: number) => void
  onClear: (index: number) => void
  onRemoveDecor: (index: number, layer: 'ground' | 'decor') => void
}

export default function BedPanel({ cell, onHarvest, onClear, onRemoveDecor }: Props) {
  if (!cell) {
    return (
      <section className="panel bed-panel">
        <div className="panel-head"><span className="panel-label">Bed</span></div>
        <p className="tiny muted">Tap a bed in the garden to choose where your steps go.</p>
      </section>
    )
  }

  const plant = cell.plant
  const species: Species | undefined = plant ? getSpecies(plant.speciesId) : undefined
  const stages = stageCount()
  const ground = getDecor(cell.ground)
  const standing = getDecor(cell.decor)

  return (
    <section className="panel bed-panel">
      <div className="panel-head">
        <span className="panel-label">Bed {cell.x + 1}·{cell.y + 1}</span>
        {plant && <span className="tiny muted">stage {Math.min(plant.stage, stages)}/{stages}</span>}
      </div>

      {!plant && (
        <p className="tiny muted">
          {standing && standing.kind !== 'pot'
            ? `${standing.name} stands here — take it back to the shed to free the bed.`
            : standing?.kind === 'pot'
              ? `An empty ${standing.name.toLowerCase()}. Sow a seed into it from the tray.`
              : 'Empty and ready. Sow a seed from the tray.'}
        </p>
      )}

      {plant && species && (
        <>
          <div className="bed-body">
            <div className="bed-portrait">
              <PlantSprite species={species} stage={plant.stage} stages={stages} seed={cell.index + 1} />
            </div>
            <div className="bed-facts">
              <div className="item-name">{species.name}</div>
              <div className="tiny muted">{species.family} · <span className={`rarity ${species.rarity}`}>{species.rarity}</span></div>
              {species.blurb && <p className="tiny blurb">{species.blurb}</p>}
              <div className="tiny">
                {isBloomed(plant)
                  ? <span className="good">In full bloom — {species.seedYield} seeds + {species.petalYield} petals</span>
                  : <>≈ <b>{Math.ceil(unitsToBloom(plant))}</b> more steps to bloom <span className="muted">· {Math.round(bloomUnits(species))} from seed</span></>}
              </div>
            </div>
          </div>

          <div className="grow-bar" title={`${Math.round(bloomProgress(plant) * 100)}% to bloom`}>
            <span style={{ width: `${Math.round(bloomProgress(plant) * 100)}%`, background: species.petalColor }} />
          </div>

          <div className="bed-actions">
            <button className="mini-btn primary" disabled={!isBloomed(plant)} onClick={() => onHarvest(cell.index)}>harvest</button>
            <button className="mini-btn danger" onClick={() => onClear(cell.index)}>clear bed</button>
          </div>
        </>
      )}

      {(ground || standing) && (
        <div className="bed-decor">
          {ground && (
            <div className="tray-row">
              <span className="seed-dot square" style={{ background: ground.color, borderColor: ground.accent }} />
              <span className="item-name">{ground.name}</span>
              <button className="mini-btn" onClick={() => onRemoveDecor(cell.index, 'ground')}>take back</button>
            </div>
          )}
          {standing && (
            <div className="tray-row">
              <span className="seed-dot square" style={{ background: standing.color, borderColor: standing.accent }} />
              <span className="item-name">{standing.name}</span>
              <button className="mini-btn" onClick={() => onRemoveDecor(cell.index, 'decor')}>take back</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
