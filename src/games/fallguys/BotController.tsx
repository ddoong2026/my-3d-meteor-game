import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'

const SPEED = 4.5 // slightly slower than player (5)
const JUMP_FORCE = 8

export default function BotController({ startPosition, color }: { startPosition: [number, number, number], color: string }) {
  const rigidBody = useRef<RapierRigidBody>(null)
  
  const [isJumping, setIsJumping] = useState(false)
  
  // Basic AI state
  const targetZ = -100 // Example finish line Z
  const moveDir = useRef(new THREE.Vector3(0, 0, -1))

  useFrame(() => {
    if (!rigidBody.current) return

    const linvel = rigidBody.current.linvel()
    const translation = rigidBody.current.translation()

    // Are we at the finish line?
    if (translation.z <= targetZ) {
      rigidBody.current.setLinvel({ x: 0, y: linvel.y, z: 0 }, true)
      return
    }

    // Always try to move forward (-z)
    // Add some random wobble or strafe to find doors
    if (Math.random() < 0.05) {
      // Randomly change X direction occasionally to explore
      moveDir.current.x = (Math.random() - 0.5) * 2
    }

    const currentMove = moveDir.current.clone().normalize().multiplyScalar(SPEED)

    // Apply movement
    rigidBody.current.setLinvel({ x: currentMove.x, y: linvel.y, z: currentMove.z }, true)

    // Jump if stuck (Z velocity is very low despite moving forward)
    if (Math.abs(linvel.z) < 0.5 && Math.abs(linvel.y) < 0.1 && !isJumping) {
      rigidBody.current.setLinvel({ x: linvel.x, y: JUMP_FORCE, z: linvel.z }, true)
      setIsJumping(true)
      setTimeout(() => setIsJumping(false), 800)
    }
  })

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={1}
      type="dynamic"
      position={startPosition}
      enabledRotations={[false, true, false]}
      friction={0.5}
    >
      <CapsuleCollider args={[0.5, 0.5]} />
      {/* Visual Bean for Bot */}
      <mesh castShadow>
        <capsuleGeometry args={[0.5, 1, 4, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      
      {/* Eyes */}
      <mesh position={[0.2, 0.3, -0.45]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[-0.2, 0.3, -0.45]}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="black" />
      </mesh>
    </RigidBody>
  )
}
