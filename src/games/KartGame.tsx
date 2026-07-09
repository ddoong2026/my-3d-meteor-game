import { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, Html, Clone, useAnimations } from '@react-three/drei'
import * as THREE from 'three'

// Constants
const KART_ACCEL = 50
const KART_MAX_SPEED = 80
const KART_REVERSE_SPEED = 30
const KART_DRAG = 0.95
const KART_TURN_SPEED = 3.5
const TRACK_WIDTH = 25
const KART_COLLISION_RADIUS = 4

// Define the 3D Track Spline
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 150),
  new THREE.Vector3(100, 10, 100),
  new THREE.Vector3(150, 30, 0), // High hill
  new THREE.Vector3(100, 10, -100),
  new THREE.Vector3(0, 0, -150),
  new THREE.Vector3(-100, -20, -100), // Deep dip
  new THREE.Vector3(-150, -10, 0),
  new THREE.Vector3(-100, 0, 100),
], true);

// Create flat road shape for extrusion
const trackShape = new THREE.Shape();
trackShape.moveTo(-TRACK_WIDTH, 0);
trackShape.lineTo(TRACK_WIDTH, 0);
trackShape.lineTo(TRACK_WIDTH, -2);
trackShape.lineTo(-TRACK_WIDTH, -2);
trackShape.lineTo(-TRACK_WIDTH, 0);

const extrudeSettings = {
  steps: 200,
  bevelEnabled: false,
  extrudePath: curve
};

// Pre-sample points for quick distance checks
const curvePoints = curve.getSpacedPoints(400);

function getClosestPointInfo(pos: THREE.Vector3) {
  let minDist = Infinity;
  let closestPt = curvePoints[0];
  let closestIndex = 0;
  for (let i = 0; i < curvePoints.length; i++) {
    // Check distance in XZ plane
    const d = Math.hypot(pos.x - curvePoints[i].x, pos.z - curvePoints[i].z);
    if (d < minDist) {
      minDist = d;
      closestPt = curvePoints[i];
      closestIndex = i;
    }
  }
  return { pt: closestPt, dist: minDist, index: closestIndex, t: closestIndex / curvePoints.length };
}

// Globals
declare global {
  interface Window { 
    kartBoostGauge: number;
    kartCurrentItem: string | null;
    kartLap: number;
    kartCheckpoint: number;
    kartsInfo: { [id: string]: { pos: THREE.Vector3, velocity: THREE.Vector3, isAI: boolean } };
    hazards: { id: number, type: string, pos: THREE.Vector3 }[];
  }
}
window.kartBoostGauge = 0
window.kartCurrentItem = null
window.kartLap = 0
window.kartCheckpoint = 0
window.kartsInfo = {}
window.hazards = []

let hazardIdCounter = 0;

function checkCollision(pos1: THREE.Vector3, pos2: THREE.Vector3, radius: number = 3) {
  return pos1.distanceTo(pos2) < radius;
}

// KartPlayer Component
function AnimatedPassenger({ playerScene, animations }: { playerScene: any, animations: any[] }) {
  const ref = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, ref)

  useEffect(() => {
    // Try common sitting/idle animation names
    const playAnim = actions['Sit'] || actions['Sitting'] || actions['Driving'] || actions['Idle']
    if (playAnim) {
      playAnim.reset().play()
    }
  }, [actions])

  return (
    <group ref={ref} position={[0, 0.5, 0.2]} rotation={[0, -Math.PI / 2, 0]} scale={1.8}>
      <Clone object={playerScene} />
    </group>
  )
}

function KartPlayer({ id, isAI = false, startT = 0, gridOffset = 0, isActive = true, onUpdateUI }: { id: string, isAI?: boolean, startT?: number, gridOffset?: number, isActive?: boolean, onUpdateUI?: (data: any) => void }) {
  const { scene } = useGLTF('/models/cart.glb')
  const { scene: playerScene, animations: playerAnimations } = useGLTF('/models/player.glb')
  
  const kartRef = useRef<THREE.Group>(null)
  const visualGroupRef = useRef<THREE.Group>(null)
  
  // Physics & State
  const velocity = useRef(0)
  const velocityVec = useRef(new THREE.Vector3())
  const steering = useRef(0)
  const driftState = useRef(false)
  const driftDirection = useRef(0)
  const boostActive = useRef(false)
  const boostTimer = useRef(0)
  const stunTimer = useRef(0)
  
  // AI State
  const aiProgressT = useRef(startT)
  const aiTargetOffset = useRef((Math.random() - 0.5) * (TRACK_WIDTH * 0.6)) // Random lane offset

  // Input state
  const keys = useRef<{ [key: string]: boolean }>({})

  useEffect(() => {
    window.kartsInfo[id] = { pos: new THREE.Vector3(), velocity: new THREE.Vector3(), isAI }
    
    // Initial Positioning
    const initialPt = curve.getPointAt(startT)
    const initialTangent = curve.getTangentAt(startT)
    const normal = new THREE.Vector3(0, 1, 0).cross(initialTangent).normalize()
    
    initialPt.add(normal.clone().multiplyScalar(gridOffset))
    
    kartRef.current?.position.copy(initialPt)
    // Create a lookAt target slightly ahead
    const lookTarget = initialPt.clone().add(initialTangent)
    kartRef.current?.lookAt(lookTarget)

    if (isAI) return

    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isAI, id, startT])

  useFrame((state, delta) => {
    if (!kartRef.current) return

    const kartPos = kartRef.current.position

    // Update global info for collisions
    window.kartsInfo[id].pos.copy(kartPos)
    
    // Handle Kart-to-Kart Collisions
    let bounceVec = new THREE.Vector3()
    let collided = false
    Object.keys(window.kartsInfo).forEach(otherId => {
      if (otherId === id) return
      const otherKart = window.kartsInfo[otherId]
      const dist = kartPos.distanceTo(otherKart.pos)
      if (dist < KART_COLLISION_RADIUS) {
        collided = true
        const pushDir = kartPos.clone().sub(otherKart.pos).normalize()
        bounceVec.add(pushDir.multiplyScalar((KART_COLLISION_RADIUS - dist) * 10)) // Spring force
      }
    })

    if (collided) {
      kartPos.add(bounceVec.multiplyScalar(delta))
      velocity.current *= 0.8 // Lose speed on collision
    }

    if (!isActive) {
      if (!isAI && visualGroupRef.current) {
        const idealOffset = new THREE.Vector3(0, 4, 12)
        const idealLookAt = new THREE.Vector3(0, 2, -15)
        idealOffset.applyQuaternion(kartRef.current.quaternion)
        idealOffset.add(kartPos)
        idealLookAt.applyQuaternion(kartRef.current.quaternion)
        idealLookAt.add(kartPos)
        state.camera.position.lerp(idealOffset, 0.1)
        state.camera.lookAt(idealLookAt)
      }
      return
    }

    if (stunTimer.current > 0) {
      stunTimer.current -= delta
      velocity.current = 0
      if (!isAI && onUpdateUI) {
        onUpdateUI({ boost: window.kartBoostGauge, item: window.kartCurrentItem, lap: window.kartLap, status: 'STUNNED' })
      }
      return
    }

    let forward = false, backward = false, left = false, right = false, drift = false, boost = false, useItem = false

    if (isAI) {
      // Spline based AI Movement
      forward = true
      aiProgressT.current += (KART_MAX_SPEED * 0.7 * delta) / curve.getLength()
      if (aiProgressT.current > 1) aiProgressT.current -= 1

      const targetPt = curve.getPointAt(aiProgressT.current)
      const tangent = curve.getTangentAt(aiProgressT.current)
      
      // Apply offset so AIs don't all drive in a perfect single file
      const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
      targetPt.add(normal.multiplyScalar(aiTargetOffset.current))

      // Move towards targetPt
      const dirToTarget = targetPt.clone().sub(kartPos).normalize()
      velocityVec.current.copy(dirToTarget).multiplyScalar(KART_MAX_SPEED * 0.75)
      
      kartPos.add(velocityVec.current.clone().multiplyScalar(delta))
      
      // Smooth lookAt
      const lookTarget = kartPos.clone().add(velocityVec.current)
      // Interpolate rotation for smoothness
      const currentQuat = kartRef.current.quaternion.clone()
      kartRef.current.lookAt(lookTarget)
      const targetQuat = kartRef.current.quaternion.clone()
      kartRef.current.quaternion.copy(currentQuat).slerp(targetQuat, 0.1)

    } else {
      // Player Input
      forward = keys.current['ArrowUp'] || keys.current['KeyW']
      backward = keys.current['ArrowDown'] || keys.current['KeyS']
      left = keys.current['ArrowLeft'] || keys.current['KeyA']
      right = keys.current['ArrowRight'] || keys.current['KeyD']
      drift = keys.current['ShiftLeft'] || keys.current['ShiftRight']
      boost = keys.current['Space']
      
      if (keys.current['KeyE']) { 
        useItem = true
        keys.current['KeyE'] = false
      }

      // Track constraints & Respawn
      const trackInfo = getClosestPointInfo(kartPos)
      if (trackInfo.dist > TRACK_WIDTH + 5) {
        // Fall off track -> Respawn
        velocity.current = 0
        kartPos.copy(trackInfo.pt)
        kartPos.y += 5 // Drop slightly from above
        const tangent = curve.getTangentAt(trackInfo.t)
        kartRef.current.lookAt(kartPos.clone().add(tangent))
        stunTimer.current = 1.0 // Brief penalty
      } else {
        // Snap Y to track height + smooth pitch
        kartPos.y = THREE.MathUtils.lerp(kartPos.y, trackInfo.pt.y, 0.2)
        // Adjust pitch based on track slope
        const nextPt = curvePoints[(trackInfo.index + 5) % curvePoints.length]
        const slope = Math.atan2(nextPt.y - trackInfo.pt.y, Math.hypot(nextPt.x - trackInfo.pt.x, nextPt.z - trackInfo.pt.z))
        if (visualGroupRef.current) {
           visualGroupRef.current.rotation.x = THREE.MathUtils.lerp(visualGroupRef.current.rotation.x, -slope, 0.1)
        }
      }

      // Checkpoints & Laps
      const t = trackInfo.t
      if (t > 0.75 && window.kartCheckpoint === 0) window.kartCheckpoint = 1
      if (t > 0.5 && t <= 0.75 && window.kartCheckpoint === 1) window.kartCheckpoint = 2
      if (t > 0.25 && t <= 0.5 && window.kartCheckpoint === 2) window.kartCheckpoint = 3
      if (t < 0.25 && window.kartCheckpoint === 3) {
        window.kartLap += 1
        window.kartCheckpoint = 0
      }

      // Boost logic
      if (boost && !boostActive.current && window.kartBoostGauge >= 100) {
        boostActive.current = true
        boostTimer.current = 2.0
        window.kartBoostGauge = 0
      }

      if (boostActive.current) {
        boostTimer.current -= delta
        if (boostTimer.current <= 0) boostActive.current = false
      }

      const currentMaxSpeed = boostActive.current ? KART_MAX_SPEED * 1.5 : KART_MAX_SPEED
      const currentAccel = boostActive.current ? KART_ACCEL * 2 : KART_ACCEL

      // Drift Logic
      if (drift && velocity.current > 20) {
        if (!driftState.current) {
          driftState.current = true
          driftDirection.current = (left ? 1 : 0) - (right ? 1 : 0)
        }
        if (driftDirection.current !== 0) {
          window.kartBoostGauge = Math.min(100, window.kartBoostGauge + 25 * delta)
        }
      } else {
        driftState.current = false
        driftDirection.current = 0
      }

      // Acceleration
      if (forward) velocity.current += currentAccel * delta
      if (backward) velocity.current -= currentAccel * delta
      
      velocity.current *= KART_DRAG
      velocity.current = THREE.MathUtils.clamp(velocity.current, -KART_REVERSE_SPEED, currentMaxSpeed)

      // Steering
      if (Math.abs(velocity.current) > 0.1) {
        // Reversed left/right per user request
        const turnDir = (right ? 1 : 0) - (left ? 1 : 0)
        const sign = Math.sign(velocity.current)
        let turnAmount = turnDir * KART_TURN_SPEED * sign * delta
        
        if (driftState.current) turnAmount = (turnDir * 1.5 + driftDirection.current * 0.5) * KART_TURN_SPEED * sign * delta

        steering.current = turnAmount
        kartRef.current.rotation.y += steering.current
      }

      // Movement
      const moveDir = new THREE.Vector3(0, 0, -1)
      if (driftState.current) {
        moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), driftDirection.current * -0.6)
      }
      const localMove = moveDir.multiplyScalar(velocity.current * delta)
      localMove.applyQuaternion(kartRef.current.quaternion)
      kartRef.current.position.add(localMove)
      velocityVec.current.copy(localMove).divideScalar(delta) // Store for collisions
      
      // Update UI
      if (onUpdateUI) {
        onUpdateUI({ boost: window.kartBoostGauge, item: window.kartCurrentItem, lap: window.kartLap, status: boostActive.current ? 'BOOST' : 'NORMAL' })
      }
    }

    // Use Item Logic
    if (!isAI && useItem && window.kartCurrentItem) {
      const item = window.kartCurrentItem
      window.kartCurrentItem = null
      
      const dropPos = kartPos.clone()
      const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(kartRef.current.quaternion)

      if (item === '바나나') {
        dropPos.add(forwardVec.clone().multiplyScalar(-10))
        window.hazards.push({ id: hazardIdCounter++, type: 'banana', pos: dropPos })
      } else if (item === '물풍선') {
        dropPos.add(forwardVec.clone().multiplyScalar(40))
        window.hazards.push({ id: hazardIdCounter++, type: 'waterballoon', pos: dropPos })
      } else if (item === '물파리') {
        // Target random AI
        const aiIds = Object.keys(window.kartsInfo).filter(k => k !== 'player')
        if (aiIds.length > 0) {
          const targetAI = window.kartsInfo[aiIds[Math.floor(Math.random() * aiIds.length)]]
          window.hazards.push({ id: hazardIdCounter++, type: 'waterfly', pos: targetAI.pos.clone() })
        }
      }
    }

    // Check hazard collisions
    for (let i = window.hazards.length - 1; i >= 0; i--) {
      const hz = window.hazards[i]
      if (checkCollision(kartPos, hz.pos, 4)) {
        stunTimer.current = 1.5
        velocity.current = 0
        window.hazards.splice(i, 1)
      }
    }

    // Camera & Visuals (Player only)
    if (!isAI) {
      const idealOffset = new THREE.Vector3(0, 4, 12)
      const idealLookAt = new THREE.Vector3(0, 2, -15)
      
      idealOffset.applyQuaternion(kartRef.current.quaternion)
      idealOffset.add(kartPos)
      
      idealLookAt.applyQuaternion(kartRef.current.quaternion)
      idealLookAt.add(kartPos)

      state.camera.position.lerp(idealOffset, 0.2)
      state.camera.lookAt(idealLookAt)

      if (visualGroupRef.current) {
        visualGroupRef.current.rotation.z = THREE.MathUtils.lerp(visualGroupRef.current.rotation.z, steering.current * -3, 0.1)
        if (driftState.current) {
          visualGroupRef.current.rotation.y = THREE.MathUtils.lerp(visualGroupRef.current.rotation.y, driftDirection.current * 0.6, 0.15)
        } else {
          visualGroupRef.current.rotation.y = THREE.MathUtils.lerp(visualGroupRef.current.rotation.y, 0, 0.15)
        }
      }
    } else {
      // AI visual banking
      if (visualGroupRef.current) {
         // simple leaning based on rotation diff
         visualGroupRef.current.rotation.y = 0
      }
    }
  })

  const [isDrifting, setIsDrifting] = useState(false)
  
  useFrame(() => {
    if (!isAI) setIsDrifting(driftState.current)
  })

  return (
    <group ref={kartRef}>
      {/* Shadow */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[4, 16]} />
        <meshBasicMaterial color={isAI ? "red" : "black"} transparent opacity={0.4} />
      </mesh>
      
      {/* Scale up cart significantly */}
      <group ref={visualGroupRef} scale={isAI ? 0.9 : 1.0}>
        <group rotation={[0, -Math.PI / 2, 0]}>
          {/* Cart made much bigger */}
          <Clone object={scene} position={[0, 0, 0]} scale={2.8} />
          {/* Player scaled and positioned perfectly on the seat */}
          <AnimatedPassenger playerScene={playerScene} animations={playerAnimations} />
        </group>
      </group>

      {/* Drift Sparks SVG */}
      {isDrifting && (
        <Html position={[0, 1, 3]} center>
          <svg width="80" height="80" viewBox="0 0 100 100" style={{ pointerEvents: 'none' }}>
            <path d="M50 0 Q70 40 100 50 Q70 60 50 100 Q30 60 0 50 Q30 40 50 0" fill="#ff7f00" opacity="0.8">
              <animate attributeName="opacity" values="0.8; 0.2; 0.8" dur="0.2s" repeatCount="indefinite" />
              <animateTransform attributeName="transform" type="scale" values="1; 1.3; 1" dur="0.2s" repeatCount="indefinite" />
            </path>
            <path d="M50 20 Q65 45 80 50 Q65 55 50 80 Q35 55 20 50 Q35 45 50 20" fill="#ffff00" />
          </svg>
        </Html>
      )}
    </group>
  )
}

function Track() {
  const itemBoxes = useRef(Array.from({ length: 8 }, (_, i) => ({
    id: i,
    active: true,
    t: (i + 0.5) / 8,
    respawnTimer: 0
  })))

  useFrame((_state, delta) => {
    itemBoxes.current.forEach(box => {
      if (!box.active) {
        box.respawnTimer -= delta
        if (box.respawnTimer <= 0) box.active = true
        return
      }
      
      const boxPos = curve.getPointAt(box.t)
      boxPos.y += 2 // hover slightly
      
      // Check collision with player
      const playerInfo = window.kartsInfo['player']
      if (playerInfo && checkCollision(playerInfo.pos, boxPos, 5)) {
        box.active = false
        box.respawnTimer = 5.0
        if (!window.kartCurrentItem) {
          const items = ['바나나', '물풍선', '물파리']
          window.kartCurrentItem = items[Math.floor(Math.random() * items.length)]
        }
      }
    })
  })

  return (
    <group>
      {/* Dynamic Spline Track Mesh (Flat Road) */}
      <mesh receiveShadow>
        <extrudeGeometry args={[trackShape, extrudeSettings]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.8} />
      </mesh>
      
      {/* Decorative center line */}
      <mesh receiveShadow position={[0, 0.2, 0]}>
        <tubeGeometry args={[curve, 200, 0.5, 4, true]} />
        <meshStandardMaterial color="#eec900" />
      </mesh>

      {/* Start/Finish Line */}
      <mesh position={curve.getPointAt(0)} rotation={[0, curve.getTangentAt(0).x > 0 ? Math.PI/2 : 0, 0]} receiveShadow>
        <boxGeometry args={[TRACK_WIDTH * 2, 0.2, 4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Item Boxes */}
      {itemBoxes.current.map(box => {
        if (!box.active) return null
        const pos = curve.getPointAt(box.t)
        return (
          <mesh key={box.id} position={[pos.x, pos.y + 2, pos.z]} castShadow>
            <boxGeometry args={[3, 3, 3]} />
            <meshStandardMaterial color="gold" emissive="yellow" emissiveIntensity={0.5} />
          </mesh>
        )
      })}

      <HazardsRenderer />
    </group>
  )
}

function HazardsRenderer() {
  const [, setTick] = useState(0)
  useFrame(() => setTick(t => t + 1))

  return (
    <group>
      {window.hazards.map(hz => (
        <mesh key={hz.id} position={[hz.pos.x, hz.pos.y + 1, hz.pos.z]}>
          {hz.type === 'banana' && <coneGeometry args={[1.5, 3, 4]} />}
          {hz.type === 'waterballoon' && <sphereGeometry args={[2, 16, 16]} />}
          {hz.type === 'waterfly' && <boxGeometry args={[2, 2, 2]} />}
          <meshStandardMaterial color={
            hz.type === 'banana' ? 'yellow' : 
            hz.type === 'waterballoon' ? 'blue' : 'cyan'
          } />
        </mesh>
      ))}
    </group>
  )
}

export default function KartGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'ready' | 'countdown' | 'playing' | 'gameover'>('ready')
  const [countdownNum, setCountdownNum] = useState<number | string>(3)
  const [uiState, setUiState] = useState({ boost: 0, item: null as string | null, lap: 0, status: 'NORMAL' })
  const [startTime, setStartTime] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const startGame = () => {
    window.kartLap = 0; window.kartBoostGauge = 0; window.kartCurrentItem = null; window.kartCheckpoint = 0; window.hazards = []; window.kartsInfo = {};
    setGameState('countdown')
    setCountdownNum(3)
    let cnt = 3
    const intv = setInterval(() => {
      cnt--
      if (cnt > 0) {
        setCountdownNum(cnt)
      } else if (cnt === 0) {
        setCountdownNum('GO!')
      } else {
        clearInterval(intv)
        setGameState('playing')
      }
    }, 1000)
  }

  useEffect(() => {
    let interval: any;
    if (gameState === 'playing') {
      setStartTime(Date.now())
      interval = setInterval(() => setCurrentTime(Date.now()), 50)
    }
    return () => clearInterval(interval)
  }, [gameState])

  const timeStr = gameState === 'playing' ? ((currentTime - startTime) / 1000).toFixed(2) : "0.00"

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#87CEEB', overflow: 'hidden', position: 'relative' }}>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} camera={{ position: [0, 5, 10], fov: 60 }}>
        <fog attach="fog" args={['#87CEEB', 100, 400]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 50, -20]} castShadow intensity={1.5} shadow-mapSize={[2048, 2048]}>
          <orthographicCamera attach="shadow-camera" args={[-200, 200, 200, -200]} />
        </directionalLight>
        <Environment preset="city" />
        
        {(gameState === 'playing' || gameState === 'countdown') && (
          <>
            <KartPlayer id="player" startT={0.015} gridOffset={-4} isActive={gameState === 'playing'} onUpdateUI={setUiState} />
            <KartPlayer id="ai1" isAI={true} startT={0.015} gridOffset={4} isActive={gameState === 'playing'} />
            <KartPlayer id="ai2" isAI={true} startT={0.005} gridOffset={-4} isActive={gameState === 'playing'} />
            <KartPlayer id="ai3" isAI={true} startT={0.005} gridOffset={4} isActive={gameState === 'playing'} />
          </>
        )}
        <Track />
      </Canvas>

      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', fontFamily: 'sans-serif' }}>
        <button onClick={onBack} style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer', zIndex: 10, border: 'none', borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}>
          메뉴로 돌아가기
        </button>
      </div>

      {gameState === 'playing' && (
        <>
          <div style={{ position: 'absolute', top: 20, right: 20, color: 'white', fontSize: '2.5rem', fontWeight: 'bold', textShadow: '3px 3px 0 #000', textAlign: 'right' }}>
            <div>LAP: {uiState.lap + 1} / 3</div>
            <div>TIME: {timeStr}</div>
            {uiState.status === 'STUNNED' && <div style={{ color: '#ff3333' }}>충돌/기절!</div>}
          </div>

          <div style={{ position: 'absolute', bottom: 40, right: 40, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 20 }}>
            <div style={{ width: 120, height: 120, border: '5px solid white', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textShadow: '2px 2px 0 #000', textAlign: 'center' }}>
              {uiState.item ? `${uiState.item}\n(E)` : 'NO ITEM'}
            </div>

            <div style={{ width: 350, height: 45, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 25, overflow: 'hidden', border: '4px solid white', position: 'relative' }}>
              <div style={{ width: `${uiState.boost}%`, height: '100%', backgroundColor: uiState.boost >= 100 ? '#ff3333' : '#00aaff', transition: 'width 0.1s' }} />
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.5rem', textShadow: '2px 2px 0 #000' }}>
                BOOST {uiState.boost >= 100 ? 'READY (SPACE)' : `${Math.floor(uiState.boost)}%`}
              </div>
            </div>
          </div>
        </>
      )}

      {gameState === 'ready' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', zIndex: 20
        }}>
          <h1 style={{ fontSize: '6rem', marginBottom: '10px', textShadow: '5px 5px 0 #000', fontStyle: 'italic' }}>호식카트 3D</h1>
          <p style={{ fontSize: '1.5rem', marginBottom: '40px', color: '#ddd' }}>
            다이나믹 트랙 | 카트 물리 충돌 | 최대 속도 개방
          </p>
          <button onClick={startGame} style={{ padding: '25px 60px', fontSize: '2.5rem', cursor: 'pointer', borderRadius: '30px', border: 'none', backgroundColor: '#ffd700', color: '#111', fontWeight: '900', boxShadow: '0 10px 0 #b8860b' }}>
            게임 시작
          </button>
        </div>
      )}

      {gameState === 'countdown' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          pointerEvents: 'none', zIndex: 15
        }}>
          <h1 style={{ 
            fontSize: '15rem', color: countdownNum === 'GO!' ? '#00ff00' : '#ffcc00', 
            textShadow: '8px 8px 0 #000', fontStyle: 'italic',
            animation: 'pulse 1s infinite'
          }}>
            {countdownNum}
          </h1>
        </div>
      )}
    </div>
  )
}
