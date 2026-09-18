// The garden itself: "an isometric grid of cells, each cell used by a single
// plant" — and, as the design allows for, the whole field rotates around its Y
// axis. It's a CSS 3D scene rather than a canvas, so a cell is a real button:
// tap to choose the bed your steps feed, drag anywhere to spin the plot.
//
// The ground plane is tilted (rotateX) and spun (rotateZ); each plant undoes
// both rotations on itself so it stands upright however the field is turned —
// the billboard trick, with the maths spelled out below.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Cell, Garden } from '../types'
import { getSpecies, stageCount } from '../game/catalog'
import { bloomProgress, stageProgress } from '../game/growth'
import { isBloomed } from '../game/garden'
import PlantSprite from './PlantSprite'

/** Ground tilt. 58° reads as isometric without flattening the plants. */
const TILT = 58
/** How much of the scene box the plot's longest side takes, in percent. */
const PLOT_FILL = 72

interface Props {
  garden: Garden
  /** cell the last growth landed on — flashes it. */
  pulseCell: number | null
  onSelect: (index: number) => void
}

export default function GardenField({ garden, pulseCell, onSelect }: Props) {
  const [spin, setSpin] = useState(-20)
  const spinRef = useRef(spin)
  spinRef.current = spin
  /** true once a press has travelled far enough to be a spin rather than a tap —
   *  read by the cell buttons so a drag that ends over a bed doesn't select it. */
  const movedRef = useRef(false)

  // Drag-to-spin is wired to the window rather than to the scene, and without
  // setPointerCapture: capture would re-target the follow-up click at the scene
  // and the cell buttons would never see a tap at all.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const startX = e.clientX
    const startSpin = spinRef.current
    movedRef.current = false

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 4) movedRef.current = true
      setSpin(startSpin + dx * 0.4)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [])

  // Arrow keys spin the plot too — a drag isn't available to every player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') setSpin(s => s - 15)
      else if (e.key === 'ArrowRight') setSpin(s => s + 15)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The plot fills PLOT_FILL% of the scene, not all of it: spinning a square
  // widens its projection by up to √2, and grown plants stand well above their
  // beds — both need room inside the scene box.
  const tile = useMemo(() => PLOT_FILL / Math.max(garden.width, garden.height), [garden.width, garden.height])

  return (
    <div className="field-wrap">
      <div
        className="field-scene"
        onPointerDown={onPointerDown}
      >
        <div
          className="field-plane"
          style={{
            // translateY first: drops the plot in the scene so tall plants have
            // headroom. It is a screen-space nudge, applied before the tilt, so
            // it never changes the billboard maths below.
            transform: `translateY(4%) rotateX(${TILT}deg) rotateZ(${spin}deg)`,
            width: `${tile * garden.width}%`,
            height: `${tile * garden.height}%`,
          }}
        >
          {garden.cells.map(cell => (
            <GardenCell
              key={cell.index}
              cell={cell}
              size={100 / garden.width}
              sizeY={100 / garden.height}
              spin={spin}
              active={garden.activeCell === cell.index}
              pulsing={pulseCell === cell.index}
              onSelect={() => { if (!movedRef.current) onSelect(cell.index) }}
            />
          ))}
        </div>
      </div>

      <div className="field-controls">
        <button className="btn-ghost" onClick={() => setSpin(s => s - 45)} title="Rotate left (←)">⟲</button>
        <span className="field-hint">drag to rotate</span>
        <button className="btn-ghost" onClick={() => setSpin(s => s + 45)} title="Rotate right (→)">⟳</button>
      </div>
    </div>
  )
}

interface CellProps {
  cell: Cell
  size: number
  sizeY: number
  spin: number
  active: boolean
  pulsing: boolean
  onSelect: () => void
}

function GardenCell({ cell, size, sizeY, spin, active, pulsing, onSelect }: CellProps) {
  const plant = cell.plant
  const species = plant ? getSpecies(plant.speciesId) : undefined
  const stages = stageCount()
  const bloomed = !!plant && isBloomed(plant)

  // Billboard: the plane is rotateX(TILT)·rotateZ(spin), so a sprite that
  // applies rotateZ(-spin)·rotateX(-TILT) to itself ends up facing the camera,
  // upright, whichever way the plot has been spun.
  const upright = `rotateZ(${-spin}deg) rotateX(${-TILT}deg)`

  return (
    <div
      className={`cell${active ? ' active' : ''}${plant ? ' planted' : ''}${bloomed ? ' bloomed' : ''}${pulsing ? ' pulse' : ''}`}
      style={{ left: `${cell.x * size}%`, top: `${cell.y * sizeY}%`, width: `${size}%`, height: `${sizeY}%` }}
    >
      <button className="cell-hit" onClick={onSelect} aria-label={
        species ? `${species.name}, stage ${plant!.stage} of ${stages}` : `empty bed ${cell.x + 1}, ${cell.y + 1}`
      } />
      {plant && species && (
        <div className="cell-sprite" style={{ transform: upright }}>
          <PlantSprite species={species} stage={plant.stage} stages={stages} seed={cell.index + 1} />
          <div className="cell-bar" title={`${Math.round(bloomProgress(plant) * 100)}% grown`}>
            <span style={{ width: `${Math.round((bloomed ? 1 : stageProgress(plant)) * 100)}%` }} />
          </div>
          {bloomed && <span className="cell-ready">ready</span>}
        </div>
      )}
    </div>
  )
}
