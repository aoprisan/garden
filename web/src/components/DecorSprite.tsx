// Every ornament in the garden is drawn here — procedurally, from its row in
// decor.csv, exactly as PlantSprite draws a plant from plants.csv. No art
// assets: `form` picks the geometry and the row's two colours tint it, so a new
// fence is a new CSV row.
//
// Two shapes of sprite, decided by the form rather than by the kind:
//
//   flat     (path, gravel, grass, water) — viewBox 0 0 100 100, painted into
//            the tile, left lying in the ground plane
//   standing (everything else) — viewBox 0 0 100 130 with the ground at y=124,
//            bottom-anchored so <GardenField> can billboard it upright like a
//            plant
import { useMemo } from 'react'
import type { Decor } from '../types'
import { isFlatForm } from '../game/decor'
import { rng, shade } from './spriteKit'

interface Props {
  decor: Decor
  /** stable per-cell variation, so two boulders aren't identical twins. */
  seed?: number
  className?: string
}

const GROUND = 124

export default function DecorSprite({ decor, seed = 1, className }: Props) {
  const flat = isFlatForm(decor.form)
  const parts = useMemo(() => draw(decor, seed), [decor, seed])
  return (
    <svg
      className={className}
      viewBox={flat ? '0 0 100 100' : '0 0 100 130'}
      width="100%"
      height="100%"
      aria-hidden="true"
      preserveAspectRatio={flat ? 'none' : 'xMidYMax meet'}
    >
      {parts}
    </svg>
  )
}

function draw(decor: Decor, seed: number) {
  const rand = rng(seed * 2246822519 + decor.id.length * 131)
  const { color, accent } = decor
  const nodes: React.ReactNode[] = []

  switch (decor.form) {
    // --- flat: painted into the tile --------------------------------------
    case 'path': {
      nodes.push(<rect key="bed" x="0" y="0" width="100" height="100" fill={accent} />)
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * 50 + 4
        const y = Math.floor(i / 2) * 50 + 4
        nodes.push(
          <rect
            key={`stone${i}`}
            x={x + rand() * 3}
            y={y + rand() * 3}
            width={38 + rand() * 6}
            height={38 + rand() * 6}
            rx="7"
            fill={shade(color, rand() * 0.14 - 0.05)}
          />,
        )
      }
      return nodes
    }

    case 'gravel': {
      nodes.push(<rect key="bed" x="0" y="0" width="100" height="100" fill={accent} />)
      for (let i = 0; i < 46; i++) {
        nodes.push(
          <circle
            key={`g${i}`}
            cx={rand() * 100}
            cy={rand() * 100}
            r={1.4 + rand() * 2.2}
            fill={shade(color, rand() * 0.3 - 0.12)}
          />,
        )
      }
      return nodes
    }

    case 'grass': {
      nodes.push(<rect key="bed" x="0" y="0" width="100" height="100" fill={color} />)
      for (let i = 0; i < 34; i++) {
        const x = rand() * 100
        const y = rand() * 100
        const h = 4 + rand() * 5
        nodes.push(
          <path
            key={`t${i}`}
            d={`M${x} ${y + h} Q ${x + 1} ${y + h / 2} ${x + (rand() - 0.5) * 4} ${y}`}
            stroke={shade(accent, rand() * 0.25)}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          />,
        )
      }
      return nodes
    }

    case 'water': {
      // No full-tile fill: the bed shows at the corners, so a pond reads as dug
      // into the plot rather than as a blue square dropped on it.
      nodes.push(
        <ellipse key="bank" cx="50" cy="50" rx="48" ry="46" fill={shade(accent, -0.4)} />,
        <ellipse key="pool" cx="50" cy="50" rx="44" ry="42" fill={accent} />,
        <ellipse key="pool2" cx="50" cy="50" rx="39" ry="37" fill={color} />,
        <ellipse key="shine" cx="38" cy="36" rx="14" ry="7" fill={shade(color, 0.35)} opacity="0.65" />,
        <ellipse key="shine2" cx="62" cy="64" rx="9" ry="4" fill={shade(color, 0.28)} opacity="0.5" />,
        // a lily pad and whatever is moving underneath it
        <ellipse key="pad" cx="64" cy="38" rx="11" ry="9" fill={shade('#4f7a3a', 0.05)} />,
        <path key="padcut" d="M64 38 L73 34 L72 42 Z" fill={color} opacity="0.9" />,
        <ellipse key="fish" cx="40" cy="60" rx="6" ry="3" fill="#e08a3c" opacity="0.75" />,
      )
      return nodes
    }

    // --- standing: billboarded like a plant --------------------------------
    case 'fence': {
      nodes.push(shadow(30))
      const rail = shade(accent, -0.05)
      nodes.push(
        <rect key="rail1" x="6" y={GROUND - 30} width="88" height="6" rx="2" fill={rail} />,
        <rect key="rail2" x="6" y={GROUND - 14} width="88" height="6" rx="2" fill={rail} />,
      )
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 20
        const top = GROUND - 46 - rand() * 3
        nodes.push(
          <path
            key={`p${i}`}
            d={`M${x} ${GROUND - 2} L${x} ${top + 7} L${x + 7} ${top} L${x + 14} ${top + 7} L${x + 14} ${GROUND - 2} Z`}
            fill={color}
            stroke={shade(accent, -0.15)}
            strokeWidth="0.8"
          />,
        )
      }
      return nodes
    }

    case 'rock': {
      nodes.push(
        shadow(34),
        <path
          key="main"
          d={`M22 ${GROUND - 2} Q 16 ${GROUND - 26} 38 ${GROUND - 40} Q 62 ${GROUND - 50} 74 ${GROUND - 28} Q 82 ${GROUND - 10} 72 ${GROUND - 2} Z`}
          fill={color}
        />,
        <path
          key="shade"
          d={`M52 ${GROUND - 2} Q 70 ${GROUND - 14} 74 ${GROUND - 28} Q 82 ${GROUND - 10} 72 ${GROUND - 2} Z`}
          fill={accent}
          opacity="0.85"
        />,
        <ellipse key="small" cx="28" cy={GROUND - 8} rx="14" ry="9" fill={shade(color, -0.08)} />,
        <ellipse key="lichen" cx="46" cy={GROUND - 34} rx="7" ry="4" fill={shade(color, 0.22)} opacity="0.6" />,
      )
      return nodes
    }

    case 'bench': {
      const wood = color
      const dark = shade(accent, -0.05)
      nodes.push(
        shadow(32),
        <rect key="leg1" x="16" y={GROUND - 26} width="7" height="24" fill={dark} />,
        <rect key="leg2" x="77" y={GROUND - 26} width="7" height="24" fill={dark} />,
        <rect key="seat" x="10" y={GROUND - 32} width="80" height="8" rx="2" fill={wood} />,
        <rect key="back1" x="14" y={GROUND - 56} width="72" height="7" rx="2" fill={wood} />,
        <rect key="back2" x="14" y={GROUND - 46} width="72" height="7" rx="2" fill={shade(wood, -0.08)} />,
        <rect key="post1" x="16" y={GROUND - 58} width="6" height="28" fill={dark} />,
        <rect key="post2" x="78" y={GROUND - 58} width="6" height="28" fill={dark} />,
      )
      return nodes
    }

    case 'lantern': {
      const stone = color
      nodes.push(
        shadow(26),
        <ellipse key="foot" cx="50" cy={GROUND - 3} rx="20" ry="6" fill={accent} />,
        <rect key="post" x="42" y={GROUND - 44} width="16" height="42" fill={stone} />,
        <rect key="box" x="32" y={GROUND - 66} width="36" height="24" rx="3" fill={shade(stone, 0.08)} />,
        <rect key="light" x="40" y={GROUND - 60} width="20" height="13" rx="2" fill="#f2c53d" opacity="0.85" />,
        <path key="cap" d={`M26 ${GROUND - 66} L50 ${GROUND - 80} L74 ${GROUND - 66} Z`} fill={accent} />,
        <circle key="finial" cx="50" cy={GROUND - 83} r="3.5" fill={shade(stone, 0.1)} />,
      )
      return nodes
    }

    case 'birdbath': {
      nodes.push(
        shadow(26),
        <ellipse key="foot" cx="50" cy={GROUND - 3} rx="19" ry="6" fill={accent} />,
        <path key="stem" d={`M42 ${GROUND - 4} Q 46 ${GROUND - 34} 43 ${GROUND - 52} L57 ${GROUND - 52} Q 54 ${GROUND - 34} 58 ${GROUND - 4} Z`} fill={color} />,
        <ellipse key="bowl" cx="50" cy={GROUND - 54} rx="28" ry="9" fill={shade(color, 0.1)} />,
        <ellipse key="water" cx="50" cy={GROUND - 55} rx="22" ry="6" fill="#6fa6c9" opacity="0.85" />,
        <path key="rim" d={`M22 ${GROUND - 54} Q 50 ${GROUND - 44} 78 ${GROUND - 54}`} stroke={accent} strokeWidth="3" fill="none" />,
      )
      return nodes
    }

    case 'arch': {
      const wood = color
      nodes.push(
        shadow(36),
        <rect key="post1" x="14" y={GROUND - 78} width="9" height="76" fill={wood} />,
        <rect key="post2" x="77" y={GROUND - 78} width="9" height="76" fill={wood} />,
        <path
          key="arc"
          d={`M18 ${GROUND - 76} Q 50 ${GROUND - 118} 82 ${GROUND - 76}`}
          stroke={wood}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
        />,
        <path
          key="vine"
          d={`M18 ${GROUND - 60} Q 34 ${GROUND - 96} 50 ${GROUND - 100} Q 68 ${GROUND - 96} 82 ${GROUND - 62}`}
          stroke={shade(accent, -0.1)}
          strokeWidth="3"
          fill="none"
        />,
      )
      for (let i = 0; i < 7; i++) {
        const t = i / 6
        const x = 20 + t * 60
        const y = GROUND - 74 - Math.sin(t * Math.PI) * 34 - rand() * 4
        nodes.push(<circle key={`rose${i}`} cx={x} cy={y} r={2.6 + rand() * 1.6} fill={shade(accent, 0.45)} />)
      }
      return nodes
    }

    case 'pot': {
      // Drawn IN FRONT of the plant by GardenField, so the stem rises from
      // behind the rim instead of over it.
      nodes.push(
        shadow(22),
        <path
          key="body"
          d={`M28 ${GROUND - 16} L34 ${GROUND + 4} L66 ${GROUND + 4} L72 ${GROUND - 16} Z`}
          fill={color}
        />,
        <ellipse key="rim" cx="50" cy={GROUND - 16} rx="22" ry="6" fill={shade(color, 0.12)} />,
        <path key="lip" d={`M27 ${GROUND - 18} L73 ${GROUND - 18} L72 ${GROUND - 11} L28 ${GROUND - 11} Z`} fill={accent} opacity="0.55" />,
        <path key="shade" d={`M58 ${GROUND - 14} L62 ${GROUND + 4} L66 ${GROUND + 4} L72 ${GROUND - 16} Z`} fill={accent} opacity="0.5" />,
      )
      return nodes
    }

    case 'trough': {
      nodes.push(
        shadow(30),
        <rect key="body" x="20" y={GROUND - 20} width="60" height="24" rx="3" fill={color} />,
        <rect key="rim" x="17" y={GROUND - 23} width="66" height="7" rx="2" fill={shade(color, 0.12)} />,
        <rect key="shade" x="64" y={GROUND - 20} width="16" height="24" fill={accent} opacity="0.45" />,
        <rect key="soil" x="24" y={GROUND - 19} width="52" height="5" fill="#4b3a2a" opacity="0.8" />,
      )
      return nodes
    }
  }

  return nodes
}

/** The soft patch of shade a standing ornament casts on its bed. */
function shadow(width: number) {
  return <ellipse key="shadow" cx="50" cy={GROUND} rx={width} ry={width * 0.22} fill="rgba(0,0,0,0.32)" />
}
