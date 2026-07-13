import { RigidBody } from '@react-three/rapier'
import PlayerController from '../PlayerController'

export default function FallGuysLobby() {
  return (
    <>
      {/* Ground */}
      <RigidBody type="fixed" friction={1}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[50, 1, 50]} />
          <meshStandardMaterial color="#88ccff" />
        </mesh>
      </RigidBody>

      {/* Walls */}
      <RigidBody type="fixed">
        <mesh receiveShadow position={[0, 2, -25]}>
          <boxGeometry args={[50, 5, 1]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed">
        <mesh receiveShadow position={[0, 2, 25]}>
          <boxGeometry args={[50, 5, 1]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed">
        <mesh receiveShadow position={[-25, 2, 0]}>
          <boxGeometry args={[1, 5, 50]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed">
        <mesh receiveShadow position={[25, 2, 0]}>
          <boxGeometry args={[1, 5, 50]} />
          <meshStandardMaterial color="#ff88cc" />
        </mesh>
      </RigidBody>

      {/* Player */}
      <PlayerController />
    </>
  )
}
