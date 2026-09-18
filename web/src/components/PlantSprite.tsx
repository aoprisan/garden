// Every plant in the garden is drawn here — procedurally, from its row in
// plants.csv, at one of the ten growth stages the design calls for. There are no
// per-species art assets: `form` picks the bloom geometry, the two colours tint
// it, and `stage/stages` drives height, foliage and how far the flower has
// opened. A new species is a new CSV row and it draws itself.
//
// The SVG is bottom-anchored (viewBox 0 0 100 130, ground at y=124) so the
// sprite can be planted on a tile and billboarded upright by <GardenField>.
import { useMemo } from 'react'
import type { PlantForm, Species } from '../types'

interface Props {
  species: Species
  /** 0 (seeded soil) .. stages (full bloom). */
  stage: number
  stages: number
  /** stable per-cell variation, so two marigolds aren't identical twins. */
  seed?: number
  className?: string
}

const GROUND = 124

/** Deterministic 0..1 noise — same cell, same plant, every render. */
function rng(seed: number): () => number {
  let s = (seed || 1) >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

/** Growth eases off: the early stages shoot up, the last ones fill out. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 1.8)
}

function shade(hex: string, amount: number): string {
  const v = hex.replace('#', '')
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v
  const n = parseInt(full, 16)
  const to = amount < 0 ? 0 : 255
  const k = Math.abs(amount)
  const mix = (c: number) => Math.round(c + (to - c) * k)
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

export default function PlantSprite({ species, stage, stages, seed = 1, className }: Props) {
  const parts = useMemo(
    () => draw(species, Math.max(0, Math.min(stages, stage)), Math.max(1, stages), seed),
    [species, stage, stages, seed],
  )
  return (
    <svg className={className} viewBox="0 0 100 130" width="100%" height="100%" aria-hidden="true">
      {parts}
    </svg>
  )
}

function draw(species: Species, stage: number, stages: number, seed: number) {
  const rand = rng(seed * 2654435761 + species.id.length * 97)
  const t = stage / stages
  const grown = easeOut(t)
  const leaf = species.leafColor
  const petal = species.petalColor
  const nodes: React.ReactNode[] = []

  // The bed: a mound of turned soil, always there.
  nodes.push(
    <ellipse key="soil" cx="50" cy={GROUND} rx="26" ry="7" fill="#4b3a2a" opacity="0.9" />,
    <ellipse key="soil2" cx="50" cy={GROUND - 2} rx="20" ry="5" fill="#5c4632" />,
  )

  if (stage === 0) {
    // Just sown: a seed sitting in the dark.
    nodes.push(<ellipse key="seed" cx="50" cy={GROUND - 4} rx="3.4" ry="2.4" fill={shade(leaf, -0.45)} />)
    return nodes
  }

  const height = 12 + 84 * grown
  const top = GROUND - 4 - height
  const lean = (rand() - 0.5) * 10 * grown
  const tipX = 50 + lean

  // Stem — a gentle curve so no two plants stand to attention the same way.
  const ctrl = 50 + lean * 0.25
  nodes.push(
    <path
      key="stem"
      d={`M50 ${GROUND - 4} Q ${ctrl} ${GROUND - 4 - height * 0.55} ${tipX} ${top}`}
      stroke={leaf}
      strokeWidth={2 + 2.2 * grown}
      strokeLinecap="round"
      fill="none"
    />,
  )

  // Leaves climb the stem as it grows — one pair every couple of stages.
  const leaves = Math.min(6, Math.floor(t * 7))
  for (let i = 0; i < leaves; i++) {
    const at = 0.18 + (i / Math.max(1, leaves)) * 0.62
    const y = GROUND - 4 - height * at
    const x = 50 + lean * at * 0.4
    const side = i % 2 === 0 ? 1 : -1
    const len = (10 + 9 * grown) * (0.75 + rand() * 0.4)
    nodes.push(
      <path
        key={`leaf${i}`}
        d={`M${x} ${y} Q ${x + side * len * 0.7} ${y - len * 0.5} ${x + side * len} ${y + 1} Q ${x + side * len * 0.55} ${y + len * 0.42} ${x} ${y}`}
        fill={i % 2 === 0 ? leaf : shade(leaf, -0.12)}
      />,
    )
  }

  // The flower: a bud from ~55% grown, opening the rest of the way.
  const openness = t < 0.55 ? 0 : Math.min(1, (t - 0.55) / 0.45)
  if (openness <= 0) {
    const budR = 2.5 + 3 * grown
    nodes.push(
      <ellipse key="bud" cx={tipX} cy={top} rx={budR} ry={budR * 1.35} fill={shade(petal, -0.35)} />,
      <ellipse key="budhl" cx={tipX - budR * 0.3} cy={top - budR * 0.3} rx={budR * 0.4} ry={budR * 0.6} fill={shade(petal, -0.1)} opacity="0.7" />,
    )
    return nodes
  }

  nodes.push(...bloom(species.form, tipX, top, openness, petal, leaf, rand, height))
  return nodes
}

/** Bloom geometry per form. `open` is 0..1 — petals grow into place with it, so
 *  the last three stages visibly finish the flower. */
function bloom(
  form: PlantForm, cx: number, cy: number, open: number,
  petal: string, leaf: string, rand: () => number, height: number,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const r = 6 + 11 * open

  switch (form) {
    case 'daisy': {
      const count = 8 + Math.floor(rand() * 5)
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rand() * 0.05
        nodes.push(
          <ellipse
            key={`p${i}`}
            cx={cx + Math.cos(a) * r * 0.62}
            cy={cy + Math.sin(a) * r * 0.62}
            rx={r * 0.52}
            ry={r * 0.26}
            fill={i % 2 === 0 ? petal : shade(petal, 0.08)}
            transform={`rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * r * 0.62} ${cy + Math.sin(a) * r * 0.62})`}
          />,
        )
      }
      nodes.push(<circle key="eye" cx={cx} cy={cy} r={r * 0.34} fill={shade(petal, -0.5)} />)
      break
    }
    case 'cup': {
      nodes.push(
        <path key="c1" d={`M${cx - r * 0.7} ${cy + r * 0.5} Q ${cx - r * 0.85} ${cy - r} ${cx} ${cy - r * 1.1} Q ${cx + r * 0.85} ${cy - r} ${cx + r * 0.7} ${cy + r * 0.5} Q ${cx} ${cy + r} ${cx - r * 0.7} ${cy + r * 0.5}`} fill={petal} />,
        <path key="c2" d={`M${cx - r * 0.34} ${cy + r * 0.45} Q ${cx - r * 0.5} ${cy - r * 0.8} ${cx} ${cy - r * 0.95} Q ${cx + r * 0.5} ${cy - r * 0.8} ${cx + r * 0.34} ${cy + r * 0.45} Z`} fill={shade(petal, 0.18)} />,
      )
      break
    }
    case 'bell': {
      const bells = 2 + Math.floor(open * 3)
      for (let i = 0; i < bells; i++) {
        const bx = cx + (i - (bells - 1) / 2) * r * 0.85
        const by = cy + i * 1.5 + r * 0.25
        nodes.push(
          <path key={`b${i}`} d={`M${bx - r * 0.34} ${by} Q ${bx - r * 0.42} ${by + r * 0.85} ${bx} ${by + r * 0.95} Q ${bx + r * 0.42} ${by + r * 0.85} ${bx + r * 0.34} ${by} Z`} fill={i % 2 === 0 ? petal : shade(petal, 0.12)} />,
          <line key={`bs${i}`} x1={bx} y1={by - r * 0.35} x2={bx} y2={by} stroke={leaf} strokeWidth="1.4" />,
        )
      }
      break
    }
    case 'spike': {
      const florets = 5 + Math.floor(open * 7)
      for (let i = 0; i < florets; i++) {
        const fy = cy + i * (height * 0.045 + 2)
        const side = i % 2 === 0 ? 1 : -1
        const fr = r * (0.3 + 0.12 * (1 - i / florets))
        nodes.push(
          <ellipse key={`f${i}`} cx={cx + side * fr * 0.9} cy={fy} rx={fr} ry={fr * 0.78} fill={i % 3 === 0 ? shade(petal, 0.14) : petal} />,
        )
      }
      break
    }
    case 'globe': {
      for (let ring = 3; ring >= 1; ring--) {
        const rr = r * (ring / 3)
        const count = ring * 5
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + ring
          nodes.push(
            <ellipse
              key={`g${ring}-${i}`}
              cx={cx + Math.cos(a) * rr * 0.55}
              cy={cy + Math.sin(a) * rr * 0.55}
              rx={rr * 0.42}
              ry={rr * 0.24}
              fill={shade(petal, ring === 3 ? -0.15 : ring === 2 ? 0 : 0.2)}
              transform={`rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * rr * 0.55} ${cy + Math.sin(a) * rr * 0.55})`}
            />,
          )
        }
      }
      break
    }
    case 'vine': {
      const flowers = 3 + Math.floor(open * 4)
      for (let i = 0; i < flowers; i++) {
        const fy = cy + i * (height * 0.09)
        const side = i % 2 === 0 ? -1 : 1
        const fx = cx + side * (4 + r * 0.35)
        const fr = r * 0.42
        nodes.push(
          <circle key={`v${i}`} cx={fx} cy={fy} r={fr} fill={i % 2 === 0 ? petal : shade(petal, 0.15)} />,
          <circle key={`vc${i}`} cx={fx} cy={fy} r={fr * 0.35} fill={shade(petal, 0.45)} />,
          <path key={`vt${i}`} d={`M${cx} ${fy} Q ${(cx + fx) / 2} ${fy - 3} ${fx} ${fy}`} stroke={leaf} strokeWidth="1.2" fill="none" />,
        )
      }
      break
    }
    case 'berry': {
      const berries = 2 + Math.floor(open * 4)
      for (let i = 0; i < berries; i++) {
        const a = (i / berries) * Math.PI * 2
        const bx = cx + Math.cos(a) * r * 0.6
        const by = cy + Math.abs(Math.sin(a)) * r * 0.5
        const br = r * 0.34
        nodes.push(
          <circle key={`br${i}`} cx={bx} cy={by} r={br} fill={petal} />,
          <circle key={`bh${i}`} cx={bx - br * 0.3} cy={by - br * 0.3} r={br * 0.28} fill={shade(petal, 0.35)} opacity="0.8" />,
        )
      }
      break
    }
    case 'herb': {
      // Herbs don't put on a show: dense tips and a modest flower spike.
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const ly = cy + i * 4
        nodes.push(
          <ellipse key={`h${i}`} cx={cx + side * (3 + r * 0.22)} cy={ly} rx={r * 0.38} ry={r * 0.22} fill={i % 2 === 0 ? leaf : shade(leaf, 0.15)} />,
        )
      }
      nodes.push(<ellipse key="tip" cx={cx} cy={cy - 2} rx={r * 0.22} ry={r * 0.5} fill={petal} />)
      break
    }
  }
  return nodes
}
