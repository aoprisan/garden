import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { game } from './client'
import { useGameClient } from './hooks/useGameClient'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { useWalkMode, walkModeSupported } from './hooks/useWalkMode'
import { haptic, playBloomSound } from './sound'
import type { Garden, Gardener } from './types'
import { getSpecies } from './game/catalog'
import { knobs } from './game/config'
import { gardenStats, isGrowing } from './game/garden'
import { msUntilNextDay, plantsLeftToday } from './game/daily'
import { currentMultiplier, isGnomeWorking } from './game/shop'
import GardenField from './components/GardenField'
import SeedTray from './components/SeedTray'
import BedPanel from './components/BedPanel'
import ShedPanel from './components/ShedPanel'
import WaterButton from './components/WaterButton'
import Almanac from './components/Almanac'
import Onboarding from './components/Onboarding'
import Tutorial from './components/Tutorial'
import ToastSystem from './components/ToastSystem'
import type { Toast } from './components/ToastSystem'
import ConfigPanel from './components/ConfigPanel'
import PwaPrompts from './components/PwaPrompts'

export default function App() {
  const [garden, setGarden] = useState<Garden | null>(null)
  const [gardener, setGardener] = useState<Gardener | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [meter, setMeter] = useState(1)
  const [blocked, setBlocked] = useState(false)
  const [pulseCell, setPulseCell] = useState<number | null>(null)
  const [booted, setBooted] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [almanacOpen, setAlmanacOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const toastSeq = useRef(0)
  const lastGrowthToast = useRef(0)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pwa = usePwaUpdate()

  // A slow clock so boost countdowns and the day timer tick in the UI.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const pushToast = useCallback((tag: string, text: string, tone: Toast['tone']) => {
    const id = ++toastSeq.current
    setToasts(prev => [...prev.slice(-6), { id, tag, text, tone }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200)
  }, [])

  // initial load
  useEffect(() => {
    let alive = true
    Promise.all([game.getGarden(), game.me()]).then(([g, me]) => {
      if (!alive) return
      setGarden({ ...g })
      setGardener(me)
      setBooted(true)
    })
    return () => { alive = false }
  }, [])

  const flashCell = useCallback((index: number) => {
    setPulseCell(index)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulseCell(null), 450)
  }, [])

  useGameClient({
    // The client mutates its own garden object in place, so copy on the way in —
    // React needs a new reference to re-render the field.
    onGardenUpdate: g => setGarden({ ...g, cells: g.cells.map(c => ({ ...c })) }),
    onGardenerUpdate: g => setGardener({ ...g }),
    onThrottle: t => {
      setMeter(t.capacity > 0 ? t.remaining / t.capacity : 0)
      if (t.blocked) { setBlocked(true); setTimeout(() => setBlocked(false), 1500) }
    },
    onGrowth: g => {
      flashCell(g.cellIndex)
      // One toast per stage is too many when a gnome is working; rate-limit them.
      const t = Date.now()
      if (t - lastGrowthToast.current < 1200) return
      lastGrowthToast.current = t
      const species = getSpecies(g.speciesId)
      pushToast('GROWTH', `${species?.name ?? g.speciesId} → stage ${g.stage}/${g.stages}`, 'growth')
    },
    onBloom: b => {
      playBloomSound()
      haptic(30)
      pushToast('BLOOM', b.firstOfKind
        ? `${b.speciesName} — new in your almanac!`
        : `${b.speciesName} is in full bloom`, 'bloom')
    },
    onHarvest: h => pushToast('HARVEST', `${h.speciesName}: +${h.seeds} seeds, +${h.petals} petals`, 'good'),
    onDay: d => pushToast('DAY', `A new day — ${d.plantsLeft} ${d.plantsLeft === 1 ? 'seed' : 'seeds'} to plant`, 'info'),
    onNotice: n => pushToast(n.tone === 'warn' ? 'WAIT' : 'NOTE', n.text, n.tone === 'warn' ? 'warn' : 'info'),
    // The garden was dug up (config swap or a manual reset): drop everything
    // cached and re-read the client.
    onWorldReset: r => {
      setGardener(null)
      setAlmanacOpen(false)
      game.getGarden().then(g => setGarden({ ...g }))
      pushToast('GARDEN', `${r.reason} — starting over`, 'warn')
    },
  })

  /** The bed a tend lands on: the chosen one while it still has growing to do,
   *  otherwise the first bed that does — a walk should never be wasted. */
  const tendTarget = useMemo(() => {
    if (!garden) return null
    const active = garden.activeCell
    if (active != null && isGrowing(garden.cells[active]?.plant ?? null)) return active
    return garden.cells.find(c => isGrowing(c.plant))?.index ?? null
  }, [garden])

  const selectedCell = useMemo(() => {
    if (!garden || garden.activeCell == null) return null
    return garden.cells[garden.activeCell] ?? null
  }, [garden])

  const handleTend = useCallback((source: 'tap' | 'step') => {
    if (tendTarget == null) return
    game.tend(tendTarget, source)
  }, [tendTarget])

  // Walk Mode: each detected step is an ordinary tend on the chosen bed — the
  // same throttle, the same growth. A soft buzz confirms each step hands-free.
  const walkStep = useCallback(() => {
    haptic(6)
    handleTend('step')
  }, [handleTend])
  const walkMode = useWalkMode(walkStep)
  const handleWalkToggle = useCallback(() => {
    void walkMode.toggle().then(({ status, banked }) => {
      if (status === 'denied') pushToast('WALK', 'Motion access denied — allow it in settings', 'warn')
      else if (banked > 0) pushToast('WALK', `${banked.toLocaleString()} steps banked while away — growing them in`, 'good')
      else if (status === 'active') pushToast('WALK', 'Walk Mode on — your steps now grow the garden', 'good')
    })
  }, [walkMode.toggle, pushToast])

  const handleRegister = useCallback((name: string) => {
    game.register(name).then(g => {
      setGardener(g)
      pushToast('GARDEN', 'Ground broken — sow your first seed', 'good')
    })
  }, [pushToast])

  const multiplier = gardener ? currentMultiplier(gardener, now) : 1
  const gnome = gardener ? isGnomeWorking(gardener, now) : false
  const stats = garden ? gardenStats(garden) : null
  const targetSpecies = tendTarget != null && garden
    ? getSpecies(garden.cells[tendTarget]?.plant?.speciesId ?? '')
    : undefined

  return (
    <>
      <header className="topbar">
        <div className="logo">
          <span className="logo-main">GARDEN</span>
          <span className="logo-sub">{gardener ? gardener.name : 'walk to grow'}</span>
        </div>
        <div className="topbar-actions">
          {gardener && (
            <span className="counters tiny">
              <span title="petals"><b className="accent">{gardener.petals}</b>✿</span>
              <span title="blooms grown"><b>{gardener.blooms}</b>🌸</span>
              <span title="steps walked in game"><b>{gardener.totalSteps.toLocaleString()}</b>👣</span>
            </span>
          )}
          {gardener && <button className="btn-ghost" onClick={() => setAlmanacOpen(true)}>📖 Almanac</button>}
          {booted && <button className="btn-ghost" onClick={() => setConfigOpen(true)} title="Load game-data CSVs">⚙ Data</button>}
        </div>
      </header>

      {garden && (
        <main className="stage">
          <GardenField
            garden={garden}
            pulseCell={pulseCell}
            onSelect={i => game.setActiveCell(i)}
          />
          {stats && (
            <div className="field-readout tiny">
              <span><b>{stats.planted}</b>/{garden.cells.length} beds</span>
              <span className="muted">{stats.growing} growing</span>
              <span className="good">{stats.blooming} in bloom</span>
              {gardener && <span className="muted">{plantsLeftToday(gardener)} to sow today</span>}
            </div>
          )}
        </main>
      )}

      {garden && gardener && (
        <>
          <aside className="left-stack">
            <SeedTray
              gardener={gardener}
              targetCell={garden.activeCell}
              targetEmpty={garden.activeCell != null && !garden.cells[garden.activeCell]?.plant}
              msToNextDay={msUntilNextDay(now)}
              onPlant={id => garden.activeCell != null && game.plantSeed(garden.activeCell, id)}
            />
            <Tutorial garden={garden} gardener={gardener} />
          </aside>

          <aside className="right-stack">
            <BedPanel
              cell={selectedCell}
              onHarvest={i => game.harvest(i)}
              onClear={i => game.clearCell(i)}
            />
            <ShedPanel
              gardener={gardener}
              now={now}
              onBuy={id => game.buyItem(id)}
              onUse={id => game.useItem(id)}
            />
          </aside>

          <WaterButton
            onTend={() => handleTend('tap')}
            targetName={targetSpecies?.name ?? 'nothing growing'}
            unitsPerTend={knobs().tendUnits * multiplier}
            totalUnits={gardener.totalUnits}
            meter={meter}
            blocked={blocked}
            multiplier={multiplier}
            gnome={gnome}
            idle={tendTarget == null}
          walk={walkModeSupported()
            ? { active: walkMode.status === 'active', steps: walkMode.steps, activity: walkMode.activity, onToggle: handleWalkToggle }
            : undefined}
          />
        </>
      )}

      {almanacOpen && gardener && <Almanac gardener={gardener} onClose={() => setAlmanacOpen(false)} />}
      {configOpen && <ConfigPanel onClose={() => setConfigOpen(false)} onResetGame={() => game.resetGame('garden reset')} />}

      <ToastSystem toasts={toasts} />
      <PwaPrompts pwa={pwa} />

      {booted && !gardener && <Onboarding onRegister={handleRegister} />}
      {!booted && <div className="boot-screen">PLANTING…</div>}
    </>
  )
}
