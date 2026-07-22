import { useState, useRef, useEffect, useMemo } from 'react'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'

import PlayerController from '../PlayerController'
import BotController from '../BotController'

const LAYERS = 3
const RADIUS = 10
const TILE_RADIUS = 1.5

function HexTile({ position, color, onStep }: { position: [number, number, number], color: string, onStep: () => void }) {
  const [stepped, setStepped] = useState(false)
  const [visible, setVisible] = useState(true)
  const rigidBody = useRef<RapierRigidBody>(null)
  
  useEffect(() => {
    if (stepped) {
      const timer1 = setTimeout(() => {
        setVisible(false)
        if (rigidBody.current) {
           // Move out of the way or disable collisions by setting translation
           rigidBody.current.setTranslation({ x: 0, y: -100, z: 0 }, true)
        }
      }, 500) // Disappear after 0.5s
      return () => clearTimeout(timer1)
    }
  }, [stepped])

  if (!visible) return null

  return (
    <RigidBody
      ref={rigidBody}
      type="fixed"
      position={position}
      onCollisionEnter={() => {
        // When player or bot steps on it
        if (!stepped) {
          setStepped(true)
          onStep()
        }
      }}
    >
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[TILE_RADIUS, TILE_RADIUS, 0.5, 6]} />
        <meshStandardMaterial color={stepped ? 'white' : color} roughness={0.1} metalness={0.2} />
      </mesh>
    </RigidBody>
  )
}

export default function HexAGone() {
  const layerColors = ['#ffcc00', '#00ccff', '#ff00aa']
  
  // Generate Hex Grid
  const tiles = useMemo(() => {
    const tileList = []
    for (let l = 0; l < LAYERS; l++) {
      const y = 15 - l * 5
      const color = layerColors[l]
      
      // Simple concentric circles for hexagon placement
      for (let r = 0; r <= RADIUS; r += TILE_RADIUS * 1.8) {
        const numHexes = Math.max(1, Math.floor(Math.PI * r / TILE_RADIUS))
        for (let i = 0; i < numHexes; i++) {
          const angle = (i / numHexes) * Math.PI * 2
          const x = Math.cos(angle) * r
          const z = Math.sin(angle) * r
          tileList.push({ id: `tile-${l}-${r}-${i}`, position: [x, y, z] as [number, number, number], color })
        }
      }
    }
    return tileList
  }, [])

  return (
    <>
      {/* Death Zone */}
      <mesh position={[0, -5, 0]}>
        <boxGeometry args={[100, 1, 100]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      
      {/* Hex Tiles */}
      {tiles.map(tile => (
        <HexTile key={tile.id} position={tile.position} color={tile.color} onStep={() => {}} />
      ))}

      {/* Bots */}
      {Array.from({ length: 5 }).map((_, i) => (
        <BotController 
          key={`bot-${i}`} 
          startPosition={[(Math.random() - 0.5) * 10, 20, (Math.random() - 0.5) * 10]} 
          color={`hsl(${Math.random() * 360}, 80%, 60%)`} 
        />
      ))}

      {/* Player */}
      <PlayerController />
    </>
  )
}
