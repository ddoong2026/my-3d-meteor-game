import { create } from 'zustand'

export type GameMode = 'Lobby' | 'Race' | 'Survival' | 'Team' | 'Final'
export type PlayerState = {
  id: string
  position: [number, number, number]
  rotation: [number, number, number, number]
  isBot: boolean
  isEliminated: boolean
  color: string
}

interface FallGuysState {
  currentMode: GameMode
  players: Record<string, PlayerState>
  setMode: (mode: GameMode) => void
  addPlayer: (player: PlayerState) => void
  updatePlayer: (id: string, data: Partial<PlayerState>) => void
  removePlayer: (id: string) => void
  eliminatePlayer: (id: string) => void
}

export const useFallGuysStore = create<FallGuysState>((set) => ({
  currentMode: 'Lobby',
  players: {},
  setMode: (mode) => set({ currentMode: mode }),
  addPlayer: (player) =>
    set((state) => ({
      players: { ...state.players, [player.id]: player },
    })),
  updatePlayer: (id, data) =>
    set((state) => ({
      players: {
        ...state.players,
        [id]: { ...state.players[id], ...data },
      },
    })),
  removePlayer: (id) =>
    set((state) => {
      const newPlayers = { ...state.players }
      delete newPlayers[id]
      return { players: newPlayers }
    }),
  eliminatePlayer: (id) =>
    set((state) => ({
      players: {
        ...state.players,
        [id]: { ...state.players[id], isEliminated: true },
      },
    })),
}))
