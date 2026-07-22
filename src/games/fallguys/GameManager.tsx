import { useEffect, useRef } from 'react'
import { useFallGuysStore } from '../../store/useFallGuysStore'
import { supabase } from '../../utils/supabase'

export default function GameManager() {
  const { gameState, setGameState, countdownTime, setCountdownTime, currentMode, setMode } = useFallGuysStore()
  const channelRef = useRef<any>(null)

  // Game Loop State Machine
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useFallGuysStore.getState()
      
      if (state.gameState === 'MATCHMAKING') {
        // Trigger countdown after a short wait
        // We'll just transition immediately for simplicity to avoid complex timer state
        useFallGuysStore.getState().setGameState('COUNTDOWN')
        useFallGuysStore.getState().setCountdownTime(3)
      } 
      else if (state.gameState === 'COUNTDOWN') {
        if (state.countdownTime > 0) {
          useFallGuysStore.getState().setCountdownTime(state.countdownTime - 1)
        } else {
          useFallGuysStore.getState().setGameState('PLAYING')
        }
      }
      else if (state.gameState === 'ROUND_END') {
        // Simple logic: go to Game Over
        useFallGuysStore.getState().setGameState('GAME_OVER')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Supabase Realtime Setup
  useEffect(() => {
    // Generate random player ID if not exists
    const myId = useFallGuysStore.getState().myId || `player_${Math.random().toString(36).substr(2, 9)}`
    useFallGuysStore.getState().setMyId(myId)

    // Setup channel
    const channel = supabase.channel('room:fallguys', {
      config: {
        broadcast: { ack: false },
        presence: { key: myId },
      },
    })
    
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // We could sync player list here
        console.log('Presence sync:', state)
      })
      .on('broadcast', { event: 'player_move' }, (payload) => {
        if (payload.payload.id !== myId) {
          useFallGuysStore.getState().updatePlayer(payload.payload.id, {
            position: payload.payload.position,
            rotation: payload.payload.rotation,
            animation: payload.payload.animation
          })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ id: myId, isReady: true })
        }
      })

    return () => {
      channel.unsubscribe()
      useFallGuysStore.getState().resetPlayers()
    }
  }, [])

  return null // This is a logic-only component
}
