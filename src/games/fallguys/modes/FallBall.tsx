import { RigidBody } from '@react-three/rapier'
import PlayerController from '../PlayerController'
import BotController from '../BotController'


const FIELD_WIDTH = 40
const FIELD_LENGTH = 80


export default function FallBall() {
  return (
    <>
      {/* Field */}
      <RigidBody type="fixed" friction={1}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[FIELD_WIDTH, 1, FIELD_LENGTH]} />
          <meshStandardMaterial color="#44cc44" />
        </mesh>
      </RigidBody>

      {/* Walls */}
      <RigidBody type="fixed">
        <mesh receiveShadow position={[-FIELD_WIDTH / 2 - 0.5, 5, 0]}>
          <boxGeometry args={[1, 10, FIELD_LENGTH]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh receiveShadow position={[FIELD_WIDTH / 2 + 0.5, 5, 0]}>
          <boxGeometry args={[1, 10, FIELD_LENGTH]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        
        {/* End Walls with Goals */}
        {/* Blue Team Goal */}
        <mesh receiveShadow position={[0, 5, -FIELD_LENGTH / 2 - 0.5]}>
          <boxGeometry args={[FIELD_WIDTH, 10, 1]} />
          <meshStandardMaterial color="blue" transparent opacity={0.3} />
        </mesh>
        {/* Yellow Team Goal */}
        <mesh receiveShadow position={[0, 5, FIELD_LENGTH / 2 + 0.5]}>
          <boxGeometry args={[FIELD_WIDTH, 10, 1]} />
          <meshStandardMaterial color="yellow" transparent opacity={0.3} />
        </mesh>
      </RigidBody>
      
      {/* Center Line */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_WIDTH, 1]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Giant Balls */}
      <RigidBody type="dynamic" mass={5} position={[-5, 5, 0]} colliders="ball" restitution={0.8} linearDamping={0.5}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[2, 32, 32]} />
          <meshStandardMaterial color="#ff4444" roughness={0.2} metalness={0.1} />
        </mesh>
      </RigidBody>
      
      <RigidBody type="dynamic" mass={5} position={[5, 5, 0]} colliders="ball" restitution={0.8} linearDamping={0.5}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[2, 32, 32]} />
          <meshStandardMaterial color="#ff4444" roughness={0.2} metalness={0.1} />
        </mesh>
      </RigidBody>

      {/* Bots (Blue Team) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <BotController 
          key={`bot-blue-${i}`} 
          startPosition={[(Math.random() - 0.5) * 20, 5, -20 + Math.random() * 5]} 
          color="#4444ff" 
        />
      ))}
      
      {/* Bots (Yellow Team) */}
      {Array.from({ length: 4 }).map((_, i) => (
        <BotController 
          key={`bot-yellow-${i}`} 
          startPosition={[(Math.random() - 0.5) * 20, 5, 20 - Math.random() * 5]} 
          color="#ffff44" 
        />
      ))}

      {/* Player (Blue Team) */}
      <PlayerController />
    </>
  )
}
