// The potting shed: petals in, seeds and help out. Every price is paid in petals
// harvested from blooms, so nothing here skips the walking — a fertilizer makes
// a walk count for more, a gnome walks a little for you at the same capped rate,
// and a packet is the only source of species you have never grown. The
// decoration aisle is the one thing here that does nothing to growth at all.
import { useState } from 'react'
import type { Gardener } from '../types'
import { SHOP_ITEMS, currentMultiplier, decorShopItems, isGnomeWorking, type ShopKind } from '../game/shop'

interface Props {
  gardener: Gardener
  now: number
  onBuy: (itemId: string) => void
  onUse: (itemId: string) => void
}

const GROUPS: Array<{ kind: ShopKind; label: string }> = [
  { kind: 'seed_packet', label: 'Seed packets' },
  { kind: 'fertilizer', label: 'Fertilizer' },
  { kind: 'gnome', label: 'Help' },
  { kind: 'decor', label: 'Decoration' },
]

export default function ShedPanel({ gardener, now, onBuy, onUse }: Props) {
  const [open, setOpen] = useState(false)
  const multiplier = currentMultiplier(gardener, now)
  const gnome = isGnomeWorking(gardener, now)
  // Decor stock is derived from the live decor.csv on every render rather than
  // held in a module constant — an uploaded config restocks the aisle.
  const stock = [...SHOP_ITEMS, ...decorShopItems()]

  return (
    <section className="panel shed-panel">
      <button className="panel-head as-button" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="panel-label">Potting shed</span>
        <span className="tiny"><b className="accent">{gardener.petals}</b> petals {open ? '▾' : '▸'}</span>
      </button>

      {(multiplier > 1 || gnome) && (
        <div className="tiny good active-boosts">
          {multiplier > 1 && <span>🌱 {multiplier}× for {remaining(gardener.boost?.expiresAt, now)}</span>}
          {gnome && <span>🧙 gnome for {remaining(gardener.gnomeUntil ?? undefined, now)}</span>}
        </div>
      )}

      {open && (
        <div className="scroll-y shed-list">
          {GROUPS.map(group => (
            <div key={group.kind} className="shed-group">
              <span className="panel-label tiny">{group.label}</span>
              {stock.filter(i => i.kind === group.kind).map(item => {
                const owned = gardener.items[item.id] || 0
                return (
                  <div key={item.id} className="shed-row">
                    <div className="shed-item">
                      <span className="item-name">{item.label}</span>
                      <span className="tiny muted">
                        {item.blurb}
                        {/* decoration has nothing to "use", so what you already
                            own is said here rather than on a button */}
                        {item.kind === 'decor' && owned > 0 && ` · ×${owned} in the shed`}
                      </span>
                    </div>
                    <div className="shed-buttons">
                      <button
                        className="mini-btn primary"
                        disabled={gardener.petals < item.petals}
                        onClick={() => onBuy(item.id)}
                      >
                        {item.petals}✿
                      </button>
                      {item.kind !== 'seed_packet' && item.kind !== 'decor' && (
                        <button className="mini-btn" disabled={owned <= 0} onClick={() => onUse(item.id)}>
                          use{owned > 0 ? ` (${owned})` : ''}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function remaining(expiresAt: number | undefined, now: number): string {
  if (!expiresAt) return '—'
  const s = Math.max(0, Math.round((expiresAt - now) / 1000))
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
}
