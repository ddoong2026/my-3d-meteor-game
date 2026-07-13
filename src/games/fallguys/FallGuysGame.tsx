import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls, Sky, Environment } from '@react-three/drei'
import { Suspense } from 'react'
import * as THREE from 'three'
import { useFallGuysStore, type GameMode } from '../../store/useFallGuysStore'
import FallGuysLobby from './modes/FallGuysLobby'

export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'right', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'dive', keys: ['ShiftLeft', 'ShiftRight'] },
]

export default function FallGuysGame({ onBack }: { onBack: () => void }) {
  const { currentMode, setMode } = useFallGuysStore()

  const modes: GameMode[] = ['Lobby', 'Race', 'Survival', 'Team', 'Final']

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <button 
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 100,
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '16px'
        }}
      >
        ← Back to Menu
      </button>

      {/* Basic UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '10px'
      }}>
        <div style={{
          color: 'white',
          fontFamily: 'sans-serif',
          fontSize: '24px',
          fontWeight: 'bold',
          textShadow: '2px 2px 0 #000'
        }}>
          Mode: {currentMode}
        </div>
        
        {/* Mode Selector */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {modes.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '5px 10px',
                background: currentMode === m ? '#ff0088' : 'rgba(0,0,0,0.5)',
                color: 'white',
                border: '1px solid white',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <KeyboardControls map={keyboardMap}>
        <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 5, 10], fov: 50 }}>
          <Suspense fallback={null}>
            <Sky sunPosition={[100, 20, 100]} />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <directionalLight 
              castShadow 
              position={[10, 20, 10]} 
              intensity={1.5} 
              shadow-mapSize={[2048, 2048]}
            />
            
            <Physics debug={false}>
              {currentMode === 'Lobby' && <FallGuysLobby />}
              {/* Add placeholders for other modes to prevent empty screen if selected */}
              {currentMode !== 'Lobby' && (
                 <mesh position={[0, 0, 0]}>
                   <boxGeometry args={[20, 1, 20]} />
                   <meshStandardMaterial color="#444" />
                 </mesh>
              )}
              {currentMode !== 'Lobby' && <FallGuysLobby />} 
              {/* Temporarily render Lobby for all modes so the player doesn't fall endlessly while I implement them */}
            </Physics>
          </Suspense>
        </Canvas>
      </KeyboardControls>
    </div>
  )
}

