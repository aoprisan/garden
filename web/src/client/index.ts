// The app talks to one shared GameClient. Today it's the in-browser local
// client; swap this for a LiveGameClient (fetch + WebSocket) if gardens ever
// become shared.
import { LocalGameClient } from './LocalGameClient'
import type { GameClient } from './GameClient'

export type { GameClient, ConnectionState, TendSource } from './GameClient'

export const game: GameClient = new LocalGameClient()
