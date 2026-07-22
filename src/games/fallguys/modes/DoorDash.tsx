import { RigidBody } from '@react-three/rapier'
import PlayerController from '../PlayerController'
import BotController from '../BotController'
import { useMemo } from 'react'

const COURSE_LENGTH = 100
const COURSE_WIDTH = 30
const DOOR_ROWS = 5
const DOORS_PER_ROW = 5

export default function DoorDash() {
  // Generate random true/false for doors. Each row must have at least one true door.
  const doorConfig = useMemo(() => {
    const config = []
    for (let r = 0; r < DOOR_ROWS; r++) {
      const row = Array(DOORS_PER_ROW).fill(false)
      // Randomly pick 1 to 3 real doors
      const numReal = Math.floor(Math.random() * 3) + 1
      for (let i = 0; i < numReal; i++) {
        let idx
        do {
          idx = Math.floor(Math.random() * DOORS_PER_ROW)
        } while (row[idx])
        row[idx] = true
      }
      config.push(row)
    }
    return config
  }, [])

  return (
    <>
      {/* Ground */}
      <RigidBody type="fixed" friction={1}>
        <mesh receiveShadow position={[0, -0.5, -COURSE_LENGTH / 2 + 10]}>
          <boxGeometry args={[COURSE_WIDTH, 1, COURSE_LENGTH]} />
          <meshStandardMaterial color="#88ff88" />
        </mesh>
      </RigidBody>

      {/* Walls */}
      <RigidBody type="fixed">
        <mesh receiveShadow position={[-COURSE_WIDTH / 2 - 0.5, 2, -COURSE_LENGTH / 2 + 10]}>
          <boxGeometry args={[1, 5, COURSE_LENGTH]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed">
        <mesh receiveShadow position={[COURSE_WIDTH / 2 + 0.5, 2, -COURSE_LENGTH / 2 + 10]}>
          <boxGeometry args={[1, 5, COURSE_LENGTH]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>
      
      {/* Start Line */}
      <mesh receiveShadow position={[0, 0.01, 5]}>
        <planeGeometry args={[COURSE_WIDTH, 2]} />
        <meshStandardMaterial color="white" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} />
      </mesh>

      {/* Finish Line */}
      <mesh receiveShadow position={[0, 0.01, -COURSE_LENGTH + 20]}>
        <planeGeometry args={[COURSE_WIDTH, 5]} />
        <meshStandardMaterial color="yellow" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} />
      </mesh>

      {/* Doors */}
      {doorConfig.map((row, rIndex) => {
        const zPos = -10 - (rIndex * 15) // spacing between rows
        const doorWidth = (COURSE_WIDTH - 2) / DOORS_PER_ROW
        
        return row.map((isReal, dIndex) => {
          const xPos = -COURSE_WIDTH / 2 + 1 + (doorWidth / 2) + (dIndex * doorWidth)
          
          return (
            <group key={`${rIndex}-${dIndex}`}>
              {/* Door Frame (Fixed) */}
              <RigidBody type="fixed">
                <mesh position={[xPos - doorWidth/2, 2.5, zPos]}>
                  <boxGeometry args={[0.5, 5, 0.5]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
              </RigidBody>
              
              {/* The Door Itself */}
              <RigidBody 
                type={isReal ? 'dynamic' : 'fixed'} 
                mass={isReal ? 2 : undefined}
                position={[xPos, 2.5, zPos]}
              >
                <mesh castShadow receiveShadow>
                  <boxGeometry args={[doorWidth - 0.5, 5, 0.5]} />
                  <meshStandardMaterial color="#ff5555" />
                </mesh>
              </RigidBody>
            </group>
          )
        })
      })}

      {/* Bots */}
      {Array.from({ length: 10 }).map((_, i) => (
        <BotController 
          key={`bot-${i}`} 
          startPosition={[(Math.random() - 0.5) * 20, 5, 10 + Math.random() * 5]} 
          color={`hsl(${Math.random() * 360}, 80%, 60%)`} 
        />
      ))}

      {/* Player */}
      <PlayerController />
    </>
  )
}

