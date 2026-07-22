import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'

import { useFallGuysStore } from '../../store/useFallGuysStore'
import { supabase } from '../../utils/supabase'

const SPEED = 8
const JUMP_FORCE = 12
const DIVE_FORCE = 15

export default function PlayerController() {
  const rigidBody = useRef<RapierRigidBody>(null)
  const groupRef = useRef<THREE.Group>(null)
  const [, get] = useKeyboardControls()
  const { camera } = useThree()
  
  const [isJumping, setIsJumping] = useState(false)
  const [isDiving, setIsDiving] = useState(false)

  const { gameState, myId } = useFallGuysStore()
  const lastBroadcast = useRef(0)

  // References for camera calculation
  const cameraTarget = useRef(new THREE.Vector3())
  const currentCameraPos = useRef(new THREE.Vector3())

  useFrame((_, delta) => {
    if (!rigidBody.current || !groupRef.current) return

    const { forward, backward, left, right, jump, dive } = get()
    
    // Get current velocity
    const linvel = rigidBody.current.linvel()
    
    const canMove = gameState === 'LOBBY' || gameState === 'PLAYING' || gameState === 'ROUND_END'

    // Movement logic
    const moveDir = new THREE.Vector3(0, 0, 0)
    if (canMove) {
      if (forward) moveDir.z -= 1
      if (backward) moveDir.z += 1
      if (left) moveDir.x -= 1
      if (right) moveDir.x += 1
    }

    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(SPEED)
      
      // Calculate rotation towards movement direction
      const angle = Math.atan2(moveDir.x, moveDir.z)
      // Smoothly interpolate rotation
      const currentRotation = groupRef.current.rotation.y
      // Handle the 360 degree wrap around for smooth rotation
      let diff = angle - currentRotation
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      groupRef.current.rotation.y += diff * 10 * delta

      rigidBody.current.setLinvel({ x: moveDir.x, y: linvel.y, z: moveDir.z }, true)
    } else {
      // Add damping when stopping
      rigidBody.current.setLinvel({ x: linvel.x * 0.8, y: linvel.y, z: linvel.z * 0.8 }, true)
    }

    // Ground check
    const isGrounded = Math.abs(linvel.y) < 0.1
    const translation = rigidBody.current.translation()

    // Jump
    if (jump && canMove && isGrounded && !isJumping) {
      setIsJumping(true)
      rigidBody.current.setLinvel({ x: linvel.x, y: JUMP_FORCE, z: linvel.z }, true)
      groupRef.current.scale.set(0.8, 1.2, 0.8)
      setTimeout(() => setIsJumping(false), 500)
    }

    // Dive
    if (dive && canMove && !isDiving) {
      setIsDiving(true)
      const diveVector = moveDir.clone().normalize().multiplyScalar(DIVE_FORCE)
      if (diveVector.length() === 0) diveVector.z = -DIVE_FORCE // Default dive forward if no input
      rigidBody.current.setLinvel({ x: diveVector.x, y: JUMP_FORCE * 0.6, z: diveVector.z }, true)
      groupRef.current.rotation.x = -Math.PI / 3
      setTimeout(() => {
        setIsDiving(false)
        if(groupRef.current) groupRef.current.rotation.x = 0
      }, 1200)
    }

    // Recover scale smoothly
    groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 10 * delta)

    // Camera follow (Smooth 3rd person)
    cameraTarget.current.set(translation.x, translation.y + 1, translation.z)
    
    const idealCameraPos = new THREE.Vector3(translation.x, translation.y + 7, translation.z + 12)
    currentCameraPos.current.lerp(idealCameraPos, 5 * delta)
    
    camera.position.copy(currentCameraPos.current)
    camera.lookAt(cameraTarget.current)

    // Broadcast position to Supabase (approx 15 times a second to save bandwidth)
    const now = Date.now()
    if (now - lastBroadcast.current > 66 && myId && supabase) {
      lastBroadcast.current = now
      
      let currentAnimation = 'idle'
      if (isDiving) currentAnimation = 'dive'
      else if (isJumping) currentAnimation = 'jump'
      else if (moveDir.length() > 0) currentAnimation = 'run'

      // We need to access the channel. The GameManager already created it.
      const channel = supabase.channel('room:fallguys')
      if (channel.state === 'joined') {
        channel.send({
          type: 'broadcast',
          event: 'player_move',
          payload: {
            id: myId,
            position: [translation.x, translation.y, translation.z],
            rotation: [
              groupRef.current.rotation.x,
              groupRef.current.rotation.y,
              groupRef.current.rotation.z
            ],
            animation: currentAnimation
          }
        })
      }
    }
  })

  // Vibrant custom material
  const playerMaterial = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: '#ff00aa', 
    roughness: 0.2, 
    metalness: 0.1,
  }), [])

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={2}
      type="dynamic"
      position={[0, 5, 0]}
      enabledRotations={[false, false, false]} // Lock all rotations on rigid body, we rotate the mesh visually
      friction={0} // No friction on sides to prevent sticking
      linearDamping={1}
    >
      <CapsuleCollider args={[0.5, 0.5]} />
      
      <group ref={groupRef}>
        {/* Visual Bean */}
        <mesh castShadow receiveShadow material={playerMaterial}>
          <capsuleGeometry args={[0.5, 1, 16, 32]} />
        </mesh>
        
        {/* Cute Face Plate */}
        <mesh position={[0, 0.2, -0.48]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.1} />
        </mesh>
        {/* Eyes */}
        <mesh position={[0.15, 0.25, -0.52]}>
          <sphereGeometry args={[0.06]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh position={[-0.15, 0.25, -0.52]}>
          <sphereGeometry args={[0.06]} />
          <meshBasicMaterial color="black" />
        </mesh>
      </group>
    </RigidBody>
  )
}
