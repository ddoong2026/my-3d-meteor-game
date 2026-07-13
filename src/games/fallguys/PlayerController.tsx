import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'

const SPEED = 5
const JUMP_FORCE = 8
const DIVE_FORCE = 10

export default function PlayerController() {
  const rigidBody = useRef<RapierRigidBody>(null)
  const [, get] = useKeyboardControls()
  const { camera } = useThree()
  
  const [isJumping, setIsJumping] = useState(false)
  const [isDiving, setIsDiving] = useState(false)

  // References for camera calculation
  const cameraTarget = useRef(new THREE.Vector3())
  const cameraPosition = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!rigidBody.current) return

    const { forward, backward, left, right, jump, dive } = get()
    
    // Get current velocity
    const linvel = rigidBody.current.linvel()
    
    // Movement logic
    const moveDir = new THREE.Vector3(0, 0, 0)
    if (forward) moveDir.z -= 1
    if (backward) moveDir.z += 1
    if (left) moveDir.x -= 1
    if (right) moveDir.x += 1

    moveDir.normalize().multiplyScalar(SPEED)

    // Apply movement while keeping y velocity
    rigidBody.current.setLinvel({ x: moveDir.x, y: linvel.y, z: moveDir.z }, true)

    // Jump logic
    if (jump && Math.abs(linvel.y) < 0.1 && !isJumping) {
      rigidBody.current.setLinvel({ x: linvel.x, y: JUMP_FORCE, z: linvel.z }, true)
      setIsJumping(true)
      setTimeout(() => setIsJumping(false), 500) // basic cooldown
    }

    // Dive logic
    if (dive && !isDiving) {
      const diveVector = moveDir.clone().normalize().multiplyScalar(DIVE_FORCE)
      rigidBody.current.setLinvel({ x: diveVector.x, y: JUMP_FORCE * 0.8, z: diveVector.z }, true)
      setIsDiving(true)
      setTimeout(() => setIsDiving(false), 1500) // recovery time
    }

    // Camera follow
    const translation = rigidBody.current.translation()
    cameraTarget.current.set(translation.x, translation.y, translation.z)
    
    // Simple 3rd person camera
    cameraPosition.current.set(translation.x, translation.y + 5, translation.z + 10)
    camera.position.lerp(cameraPosition.current, 0.1)
    camera.lookAt(cameraTarget.current)
  })

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 5, 0]}
      enabledRotations={[false, true, false]}
      friction={0.5}
    >
      <CapsuleCollider args={[0.5, 0.5]} />
      {/* Visual Bean */}
      <mesh castShadow>
        <capsuleGeometry args={[0.5, 1, 4, 16]} />
        <meshStandardMaterial color={isDiving ? 'orange' : 'hotpink'} />
      </mesh>
      
      {/* Eyes to know orientation */}
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
