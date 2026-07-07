import { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PlayerModel, FallbackPlayer } from '../components/Player'
import { soundManager } from '../utils/SoundManager'

const SEGMENT_LENGTH = 20
const MAX_SEGMENTS = 15
const MAX_OBSTACLES = 50
const LANES = [-3, 0, 3]

const dummy = new THREE.Object3D()

function TempleSystem({ playerPosRef, onGameOver, setScore, speedRef }: any) {
  const floorMeshRef = useRef<THREE.InstancedMesh>(null)
  const hurdleMeshRef = useRef<THREE.InstancedMesh>(null)
  const wallMeshRef = useRef<THREE.InstancedMesh>(null)
  const gapMeshRef = useRef<THREE.InstancedMesh>(null)

  const segments = useRef(Array.from({ length: MAX_SEGMENTS }, (_, i) => ({ z: i * SEGMENT_LENGTH })))
  
  const obstacles = useRef(Array.from({ length: MAX_OBSTACLES }, () => ({ 
    active: false, 
    type: 'hurdle', 
    pos: new THREE.Vector3(), 
    size: new THREE.Vector3() 
  })))

  const MAX_COINS = 100
  const coinMeshRef = useRef<THREE.InstancedMesh>(null)
  const coins = useRef(Array.from({ length: MAX_COINS }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    justDied: false
  })))

  const maxZ = useRef((MAX_SEGMENTS - 1) * SEGMENT_LENGTH)
  const timeElapsed = useRef(0)

  useEffect(() => {
    for (let i = 3; i < MAX_SEGMENTS; i++) {
      spawnObstacleForSegment(segments.current[i].z)
    }
  }, [])

  const spawnObstacleForSegment = (z: number) => {
    const count = Math.random() < 0.5 ? 1 : 2
    for (let i = 0; i < count; i++) {
      const obs = obstacles.current.find(o => !o.active)
      if (!obs) break
      
      obs.active = true
      const typeRand = Math.random()
      let type = 'hurdle'
      if (typeRand > 0.6) type = 'wall'
      else if (typeRand > 0.4) type = 'gap'

      const lane = LANES[Math.floor(Math.random() * LANES.length)]
      const zOffset = (Math.random() - 0.5) * (SEGMENT_LENGTH - 4)

      obs.type = type
      if (type === 'hurdle') {
        obs.pos.set(lane, 0.5, z + zOffset)
        obs.size.set(2.8, 1, 1)
      } else if (type === 'wall') {
        obs.pos.set(lane, 2, z + zOffset)
        obs.size.set(2.8, 4, 1)
      } else if (type === 'gap') {
        obs.pos.set(lane, 0.05, z + zOffset)
        obs.size.set(3.2, 0.1, 4)
      }
    }

    if (Math.random() > 0.3) {
      const coinLane = LANES[Math.floor(Math.random() * LANES.length)]
      const coinCount = Math.floor(Math.random() * 3) + 3 
      const startZ = z + (Math.random() - 0.5) * 10
      for (let i = 0; i < coinCount; i++) {
        const c = coins.current.find(c => !c.active && !c.justDied)
        if (c) {
          c.active = true
          c.pos.set(coinLane, 1.0, startZ + i * 2)
        }
      }
    }
  }

  useFrame((_, delta) => {
    timeElapsed.current += delta
    speedRef.current = Math.min(1.5 + timeElapsed.current * 0.02, 4.0)

    dummy.rotation.set(0, 0, 0)

    const pZ = playerPosRef.current.z

    setScore(Math.floor(Math.max(0, pZ)))

    let floorNeedsUpdate = false
    segments.current.forEach((seg, i) => {
      if (pZ - seg.z > SEGMENT_LENGTH) {
        maxZ.current += SEGMENT_LENGTH
        seg.z = maxZ.current
        floorNeedsUpdate = true

        obstacles.current.forEach(obs => {
          if (obs.active && pZ - obs.pos.z > 10) {
            obs.active = false
          }
        })
        spawnObstacleForSegment(seg.z)
      }

      dummy.position.set(0, -0.25, seg.z)
      dummy.scale.set(10, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (floorMeshRef.current) floorMeshRef.current.setMatrixAt(i, dummy.matrix)
    })
    if (floorNeedsUpdate && floorMeshRef.current) floorMeshRef.current.instanceMatrix.needsUpdate = true

    let hurdleNeedsUpdate = false
    let wallNeedsUpdate = false
    let gapNeedsUpdate = false
    
    const hideDummy = () => {
      dummy.position.set(0, -1000, 0)
      dummy.scale.set(0, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
    }

    let hurdleIdx = 0, wallIdx = 0, gapIdx = 0
    obstacles.current.forEach(obs => {
      if (obs.active) {
        const dx = Math.abs(playerPosRef.current.x - obs.pos.x)
        const dz = Math.abs(playerPosRef.current.z - obs.pos.z)
        const dy = playerPosRef.current.y
        
        if (dx < obs.size.x / 2 + 0.4 && dz < obs.size.z / 2 + 0.4) {
          if (obs.type === 'hurdle' && dy < obs.size.y) {
            soundManager.playCrash()
            onGameOver()
          } else if (obs.type === 'wall' && dy < obs.size.y) {
            soundManager.playCrash()
            onGameOver()
          } else if (obs.type === 'gap' && dy <= 0.2) {
            soundManager.playCrash()
            onGameOver()
          }
        }

        dummy.position.copy(obs.pos)
        dummy.scale.copy(obs.size)
        dummy.updateMatrix()
        if (obs.type === 'hurdle') {
          if (hurdleMeshRef.current) hurdleMeshRef.current.setMatrixAt(hurdleIdx++, dummy.matrix)
          hurdleNeedsUpdate = true
        } else if (obs.type === 'wall') {
          if (wallMeshRef.current) wallMeshRef.current.setMatrixAt(wallIdx++, dummy.matrix)
          wallNeedsUpdate = true
        } else if (obs.type === 'gap') {
          if (gapMeshRef.current) gapMeshRef.current.setMatrixAt(gapIdx++, dummy.matrix)
          gapNeedsUpdate = true
        }
      }
    })

    hideDummy()
    for (let i = hurdleIdx; i < MAX_OBSTACLES; i++) if (hurdleMeshRef.current) hurdleMeshRef.current.setMatrixAt(i, dummy.matrix)
    for (let i = wallIdx; i < MAX_OBSTACLES; i++) if (wallMeshRef.current) wallMeshRef.current.setMatrixAt(i, dummy.matrix)
    for (let i = gapIdx; i < MAX_OBSTACLES; i++) if (gapMeshRef.current) gapMeshRef.current.setMatrixAt(i, dummy.matrix)

    if (hurdleNeedsUpdate && hurdleMeshRef.current) hurdleMeshRef.current.instanceMatrix.needsUpdate = true
    if (wallNeedsUpdate && wallMeshRef.current) wallMeshRef.current.instanceMatrix.needsUpdate = true
    if (gapNeedsUpdate && gapMeshRef.current) gapMeshRef.current.instanceMatrix.needsUpdate = true

    let coinNeedsUpdate = false
    coins.current.forEach((c, i) => {
      if (c.active && pZ - c.pos.z > 10) c.active = false
      if (c.active) {
        const dx = Math.abs(playerPosRef.current.x - c.pos.x)
        const dz = Math.abs(playerPosRef.current.z - c.pos.z)
        if (dx < 1.5 && dz < 1.5 && playerPosRef.current.y >= -1.0 && playerPosRef.current.y < 3.0) {
          c.active = false
          c.justDied = true
          setScore((s: number) => s + 50)
          soundManager.playGetXp()
        }
      }

      if (c.active) {
        coinNeedsUpdate = true
        dummy.position.copy(c.pos)
        dummy.rotation.set(0, timeElapsed.current * 3, 0)
        dummy.scale.setScalar(0.5)
        dummy.updateMatrix()
        if (coinMeshRef.current) coinMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (c.justDied) {
        coinNeedsUpdate = true
        c.justDied = false
        hideDummy()
        if (coinMeshRef.current) coinMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        hideDummy()
        if (coinMeshRef.current) coinMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })
    if (coinNeedsUpdate && coinMeshRef.current) coinMeshRef.current.instanceMatrix.needsUpdate = true

    if (playerPosRef.current.x < -6) playerPosRef.current.x = -6
    if (playerPosRef.current.x > 6) playerPosRef.current.x = 6

    if (playerPosRef.current.y < -5) {
      soundManager.playCrash()
      onGameOver()
    }
  })

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      
      <instancedMesh ref={floorMeshRef} args={[null as any, null as any, MAX_SEGMENTS]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#2d8a3a" />
      </instancedMesh>

      <instancedMesh ref={hurdleMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#ff8800" />
      </instancedMesh>

      <instancedMesh ref={wallMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#888888" />
      </instancedMesh>

      <instancedMesh ref={gapMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#000000" />
      </instancedMesh>

      <instancedMesh ref={coinMeshRef} args={[null as any, null as any, MAX_COINS]} castShadow frustumCulled={false}>
        <torusGeometry args={[0.6, 0.15, 8, 16]} />
        <meshLambertMaterial color="gold" />
      </instancedMesh>
    </group>
  )
}

export default function TempleGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing')
  const [gameKey, setGameKey] = useState(0)
  const [score, setScore] = useState(0)
  const playerPosRef = useRef(new THREE.Vector3(0, 5, 0))
  const gameOverRef = useRef(false)
  const useFallback = false // For now, default to false since we aren't using setUseFallback
  const speedRef = useRef(10)

  const handleGameOver = () => {
    if (gameOverRef.current) return
    gameOverRef.current = true
    setGameState('gameover')
  }

  const handleRestart = () => {
    setGameState('playing')
    gameOverRef.current = false
    setScore(0)
    setGameKey(k => k + 1)
    playerPosRef.current.set(0, 5, 0)
  }

  return (
    <div className="game-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ 
        position: 'absolute', top: 20, right: 20, color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', 
        padding: '10px 20px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'sans-serif', pointerEvents: 'none', zIndex: 10
      }}>
        <div>Total Score: {score}</div>
      </div>

      <button onClick={() => { soundManager.stopBGM(); onBack(); }}
        style={{ position: 'absolute', top: 20, left: 20, padding: '10px 20px', fontSize: '1.2rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>
        뒤로 가기
      </button>

      {gameState === 'gameover' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '5rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2rem', margin: '0 0 40px 0', textShadow: '1px 1px 0 #000' }}>최종 점수: {score}</h2>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={handleRestart} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: 'white', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>다시 시작하기</button>
            <button onClick={() => { soundManager.stopBGM(); onBack(); }} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>메인 메뉴로</button>
          </div>
        </div>
      )}

      <Canvas 
        key={gameKey}
        shadows 
        camera={{ position: [0, 5, -10], fov: 60 }}
        style={{ background: '#87CEEB' }}
      >
        <fog attach="fog" args={['#87CEEB', 20, 100]} />
        <TempleSystem 
          playerPosRef={playerPosRef} 
          onGameOver={handleGameOver}
          setScore={setScore}
          speedRef={speedRef}
        />
        
        {!useFallback ? (
          <PlayerModel 
            playerPosRef={playerPosRef}
            gameOverRef={gameOverRef}
            getFloorHeight={() => 0}
            autoForward={true}
            strafeOnly={true}
            speedMultiplier={speedRef.current}
          />
        ) : (
          <FallbackPlayer 
            playerPosRef={playerPosRef}
            gameOverRef={gameOverRef}
            getFloorHeight={() => 0}
            autoForward={true}
            strafeOnly={true}
            speedMultiplier={speedRef.current}
          />
        )}
      </Canvas>
    </div>
  )
}
