import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type PlayerState } from '../../store/useFallGuysStore'

export default function RemotePlayer({ player }: { player: PlayerState }) {
  const groupRef = useRef<THREE.Group>(null)
  
  // Custom vibrant material
  const material = useMemo(() => new THREE.MeshStandardMaterial({ 
    color: player.color || '#00aaff', 
    roughness: 0.2, 
    metalness: 0.1,
  }), [player.color])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Interpolate position
    const targetPos = new THREE.Vector3(...player.position)
    groupRef.current.position.lerp(targetPos, 15 * delta)

    // Interpolate rotation (Assuming Euler array [x,y,z])
    const [rx, ry] = player.rotation as [number, number, number]
    
    // Smooth rotation lerp for Y axis (heading)
    const currentAngle = groupRef.current.rotation.y
    let diff = ry - currentAngle
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    groupRef.current.rotation.y += diff * 15 * delta

    // X rotation (for diving)
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, rx, 10 * delta)

    // Handle animations via scale squish
    if (player.animation === 'jump') {
      groupRef.current.scale.lerp(new THREE.Vector3(0.8, 1.2, 0.8), 15 * delta)
    } else if (player.animation === 'dive') {
      groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 15 * delta)
    } else {
      groupRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 10 * delta)
    }
  })

  return (
    <group ref={groupRef} position={player.position}>
      {/* Visual Bean */}
      <mesh castShadow receiveShadow material={material}>
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
  )
}
