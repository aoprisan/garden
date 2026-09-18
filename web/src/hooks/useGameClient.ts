import { useEffect, useRef, useState } from 'react'
import { game } from '../client'
import type { ConnectionState } from '../client'
import type {
  Garden, Gardener, GrowthEvent, BloomEvent, HarvestEvent, DayEvent, ThrottleState,
  NoticeEvent, WorldResetEvent,
} from '../types'

export type { ConnectionState }

export interface GameClientHandlers {
  onGardenUpdate?: (g: Garden) => void
  onGardenerUpdate?: (g: Gardener) => void
  onGrowth?: (g: GrowthEvent) => void
  onBloom?: (b: BloomEvent) => void
  onHarvest?: (h: HarvestEvent) => void
  onDay?: (d: DayEvent) => void
  onThrottle?: (t: ThrottleState) => void
  onNotice?: (n: NoticeEvent) => void
  /** the garden was dug up — every cached cell and counter is stale. */
  onWorldReset?: (r: WorldResetEvent) => void
}

/** Subscribes to the shared GameClient event stream and routes each event to
 *  the matching callback (local client today, a server later). */
export function useGameClient(handlers: GameClientHandlers) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(game.connectionState())
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const unsubscribe = game.on(e => {
      const h = ref.current
      switch (e.type) {
        case 'garden_update': h.onGardenUpdate?.(e.data); break
        case 'gardener_update': h.onGardenerUpdate?.(e.data); break
        case 'growth': h.onGrowth?.(e.data); break
        case 'bloom': h.onBloom?.(e.data); break
        case 'harvest': h.onHarvest?.(e.data); break
        case 'day': h.onDay?.(e.data); break
        case 'throttle': h.onThrottle?.(e.data); break
        case 'notice': h.onNotice?.(e.data); break
        case 'world_reset': h.onWorldReset?.(e.data); break
      }
    })
    setConnectionState(game.connectionState())
    return unsubscribe
  }, [])

  return { connectionState }
}
