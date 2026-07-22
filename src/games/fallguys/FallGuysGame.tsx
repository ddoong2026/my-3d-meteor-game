import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Sky, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import { useFallGuysStore, type GameMode } from '../../store/useFallGuysStore'
import FallGuysLobby from './modes/FallGuysLobby'
import DoorDash from './modes/DoorDash'
import HexAGone from './modes/HexAGone'
import FallBall from './modes/FallBall'
import FallMountain from './modes/FallMountain'
import GameManager from './GameManager'
import RemotePlayer from './RemotePlayer'

export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'dive', keys: ['ShiftLeft', 'ShiftRight'] },
]

export default function FallGuysGame({ onBack }: { onBack: () => void }) {
  const { currentMode, setMode, gameState, countdownTime, players } = useFallGuysStore()

  const modes: GameMode[] = ['Lobby', 'Race', 'Survival', 'Team', 'Final']

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <GameManager />
      
      <button 
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 100,
          padding: '12px 24px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          fontSize: '16px',
          fontWeight: '600',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      >
        ← Back to Menu
      </button>

      {/* Game State Overlay (Countdown / Game Over) */}
      {gameState === 'COUNTDOWN' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, pointerEvents: 'none'
        }}>
          <h1 style={{
            fontSize: '120px', color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 900,
            textShadow: '0 5px 20px rgba(255,0,170,0.8), 0 0 40px #00d4ff', margin: 0,
            animation: 'pulse 1s infinite'
          }}>
            {countdownTime > 0 ? countdownTime : 'GO!'}
          </h1>
        </div>
      )}

      {gameState === 'GAME_OVER' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 60
        }}>
          <h1 style={{ fontSize: '80px', color: '#ffd700', textShadow: '0 5px 20px rgba(0,0,0,0.5)', margin: 0 }}>MATCH FINISHED!</h1>
          <p style={{ color: 'white', fontSize: '24px' }}>Returning to lobby soon...</p>
        </div>
      )}

      {/* Premium UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '15px'
      }}>
        <div style={{
          color: 'white',
          fontFamily: "'Inter', sans-serif",
          fontSize: '28px',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textShadow: '0 2px 10px rgba(0,0,0,0.5), 0 0 20px #ff00aa',
          background: 'linear-gradient(45deg, #ff00aa, #00d4ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.5))'
        }}>
          {currentMode}
        </div>
        
        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          {modes.map(m => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                useFallGuysStore.getState().setGameState('MATCHMAKING')
              }}
              style={{
                padding: '8px 16px',
                background: currentMode === m ? 'linear-gradient(45deg, #ff00aa, #ff5500)' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
                boxShadow: currentMode === m ? '0 4px 15px rgba(255, 0, 170, 0.4)' : 'none'
              }}
              onMouseEnter={e => { if(currentMode !== m) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={e => { if(currentMode !== m) e.currentTarget.style.background = 'transparent' }}
            >
              {m}
            </button>
          ))}
        </div>
        <div style={{ color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: '8px' }}>
          Players connected: {Object.keys(players).length + 1}
        </div>
      </div>

      <KeyboardControls map={keyboardMap}>
        <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ position: [0, 10, 15], fov: 45 }}>
          <color attach="background" args={['#87CEEB']} />
          <Suspense fallback={null}>
            <Sky sunPosition={[100, 50, 100]} turbidity={0.1} rayleigh={0.5} />
            <Environment preset="sunset" />
            <ambientLight intensity={0.6} />
            <directionalLight 
              castShadow 
              position={[50, 50, 20]} 
              intensity={2} 
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-50}
              shadow-camera-right={50}
              shadow-camera-top={50}
              shadow-camera-bottom={-50}
              shadow-bias={-0.0001}
            />
            
            <Physics debug={false} timeStep="vary">
              {currentMode === 'Lobby' && <FallGuysLobby />}
              {currentMode === 'Race' && <DoorDash />}
              {currentMode === 'Survival' && <HexAGone />}
              {currentMode === 'Team' && <FallBall />}
              {currentMode === 'Final' && <FallMountain />}

              {/* Render Remote Players */}
              {Object.values(players).map(p => (
                <RemotePlayer key={p.id} player={p} />
              ))}
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  )
}

