import { create } from 'zustand'

export type GameMode = 'Lobby' | 'Race' | 'Survival' | 'Team' | 'Final'
export type GameState = 'LOBBY' | 'MATCHMAKING' | 'COUNTDOWN' | 'PLAYING' | 'ROUND_END' | 'GAME_OVER'

export type PlayerState = {
  id: string
  position: [number, number, number]
  rotation: [number, number, number, number] | [number, number, number] // Support Euler or Quaternion
  isBot: boolean
  isEliminated: boolean
  color: string
  animation?: 'idle' | 'run' | 'jump' | 'dive'
}

interface FallGuysState {
  myId: string
  currentMode: GameMode
  gameState: GameState
  countdownTime: number
  players: Record<string, PlayerState>
  setMyId: (id: string) => void
  setMode: (mode: GameMode) => void
  setGameState: (state: GameState) => void
  setCountdownTime: (time: number) => void
  addPlayer: (player: PlayerState) => void
  updatePlayer: (id: string, data: Partial<PlayerState>) => void
  removePlayer: (id: string) => void
  eliminatePlayer: (id: string) => void
  resetPlayers: () => void
}

export const useFallGuysStore = create<FallGuysState>((set) => ({
  myId: '',
  currentMode: 'Lobby',
  gameState: 'LOBBY',
  countdownTime: 3,
  players: {},
  setMyId: (id) => set({ myId: id }),
  setMode: (mode) => set({ currentMode: mode }),
  setGameState: (state) => set({ gameState: state }),
  setCountdownTime: (time) => set({ countdownTime: time }),
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
  resetPlayers: () => set({ players: {} }),
}))
