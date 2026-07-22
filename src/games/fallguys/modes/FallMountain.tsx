import { RigidBody, CylinderCollider } from '@react-three/rapier'
import PlayerController from '../PlayerController'
import BotController from '../BotController'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COURSE_LENGTH = 120
const COURSE_WIDTH = 40
const HEIGHT = 30

function Crown() {
  const crownRef = useRef<THREE.Group>(null)
  
  useFrame((_, delta) => {
    if (crownRef.current) {
      crownRef.current.rotation.y += delta
      crownRef.current.position.y = HEIGHT + 2 + Math.sin(Date.now() / 500) * 0.5
    }
  })

  return (
    <RigidBody type="fixed" position={[0, HEIGHT + 2, -COURSE_LENGTH + 10]} sensor onIntersectionEnter={() => alert('Winner!')}>
      <group ref={crownRef}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1, 1.5, 2, 8]} />
          <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={0.8} />
        </mesh>
      </group>
      <CylinderCollider args={[1, 1.5]} sensor />
    </RigidBody>
  )
}

function Bouncer({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} restitution={2}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.5, 1, 16]} />
        <meshStandardMaterial color="#ff00ff" />
      </mesh>
    </RigidBody>
  )
}

export default function FallMountain() {
  const bouncers = useMemo(() => {
    const list = []
    for (let i = 0; i < 30; i++) {
      const z = -20 - Math.random() * (COURSE_LENGTH - 40)
      const x = (Math.random() - 0.5) * (COURSE_WIDTH - 10)
      // Map z to y to follow the slope
      const y = (Math.abs(z) / COURSE_LENGTH) * HEIGHT + 0.5
      list.push([x, y, z] as [number, number, number])
    }
    return list
  }, [])

  return (
    <>
      {/* Mountain Slope */}
      <RigidBody type="fixed" friction={0.5}>
        <mesh receiveShadow position={[0, HEIGHT / 2 - 1, -COURSE_LENGTH / 2]} rotation={[Math.atan2(HEIGHT, COURSE_LENGTH), 0, 0]}>
          <boxGeometry args={[COURSE_WIDTH, 2, Math.sqrt(COURSE_LENGTH**2 + HEIGHT**2)]} />
          <meshStandardMaterial color="#ffaa00" />
        </mesh>
      </RigidBody>

      {/* Start Platform */}
      <RigidBody type="fixed">
        <mesh receiveShadow position={[0, -0.5, 5]}>
          <boxGeometry args={[COURSE_WIDTH, 1, 20]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </RigidBody>

      {/* Bouncers */}
      {bouncers.map((pos, i) => (
        <Bouncer key={i} position={pos} />
      ))}

      {/* Crown */}
      <Crown />

      {/* Bots */}
      {Array.from({ length: 8 }).map((_, i) => (
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
