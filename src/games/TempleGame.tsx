import { useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PlayerModel, FallbackPlayer } from '../components/Player'
import { soundManager } from '../utils/SoundManager'

const SEGMENT_LENGTH = 20
const MAX_SEGMENTS = 15
const MAX_OBSTACLES = 50
const LANES = [-3, 0, 3]
const MAX_WIND = 150
const MAX_DECORATIONS = 100

const dummy = new THREE.Object3D()

function TempleSystem({ playerPosRef, onGameOver, setDistance, setCoins, speedRef }: any) {
  const floorMeshRef = useRef<THREE.InstancedMesh>(null)
  const sidewalkMeshRef = useRef<THREE.InstancedMesh>(null)
  const lineMeshRef = useRef<THREE.InstancedMesh>(null)
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null)
  const treeLeavesRef = useRef<THREE.InstancedMesh>(null)
  const poleRef = useRef<THREE.InstancedMesh>(null)
  const lampRef = useRef<THREE.InstancedMesh>(null)
  const hurdleMeshRef = useRef<THREE.InstancedMesh>(null)
  const wallMeshRef = useRef<THREE.InstancedMesh>(null)
  const gapMeshRef = useRef<THREE.InstancedMesh>(null)
  const windMeshRef = useRef<THREE.InstancedMesh>(null)

  const isShiftRef = useRef(false)
  
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isShiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') isShiftRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const segments = useRef(Array.from({ length: MAX_SEGMENTS }, (_, i) => ({ z: i * SEGMENT_LENGTH })))
  
  const obstacles = useRef(Array.from({ length: MAX_OBSTACLES }, () => ({ 
    active: false, 
    type: 'hurdle', 
    pos: new THREE.Vector3(), 
    size: new THREE.Vector3() 
  })))

  const coinMeshRef = useRef<THREE.InstancedMesh>(null)
  const coins = useRef(Array.from({ length: 50 }, () => ({
    active: false,
    justDied: true,
    pos: new THREE.Vector3()
  })))

  const windLines = useRef(Array.from({ length: MAX_WIND }, () => ({
    pos: new THREE.Vector3((Math.random() - 0.5) * 40, Math.random() * 15, Math.random() * 100),
    speed: 60 + Math.random() * 60
  })))

  const decorations = useRef(Array.from({ length: MAX_DECORATIONS }, () => ({
    active: false,
    type: 'tree' as 'tree' | 'light',
    pos: new THREE.Vector3(),
    scale: 1
  })))

  const maxZ = useRef((MAX_SEGMENTS - 1) * SEGMENT_LENGTH)
  const timeElapsed = useRef(0)

  useEffect(() => {
    for (let i = 3; i < MAX_SEGMENTS; i++) {
      spawnObstacleForSegment(segments.current[i].z)
    }
  }, [])

  const spawnObstacleForSegment = (z: number) => {
    let count = 0
    const time = timeElapsed.current
    
    if (time < 5) {
      count = Math.random() < 0.2 ? 1 : 0
    } else if (time < 15) {
      count = Math.random() < 0.8 ? 1 : 0
    } else if (time < 30) {
      count = Math.random() < 0.6 ? 2 : 1
    } else {
      count = Math.random() < 0.2 ? 3 : 2
    }

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
        obs.pos.set(lane, 1.5, z + zOffset)
        obs.size.set(2.8, 3, 5)
      } else if (type === 'gap') {
        obs.pos.set(lane, 0.05, z + zOffset)
        obs.size.set(2.5, 0.1, 2.5)
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

    const sideCount = Math.random() < 0.5 ? 1 : 2
    for (let i = 0; i < sideCount; i++) {
      const dec = decorations.current.find(d => !d.active)
      if (dec) {
        dec.active = true
        dec.type = Math.random() > 0.5 ? 'tree' : 'light'
        const sideX = Math.random() > 0.5 ? -8 : 8
        const zOffset = (Math.random() - 0.5) * SEGMENT_LENGTH
        dec.pos.set(sideX, 0, z + zOffset)
        dec.scale = 0.8 + Math.random() * 0.4
      }
    }
  }

  useFrame((_, delta) => {
    timeElapsed.current += delta
    const baseSpeed = Math.min(2.5 + timeElapsed.current * 0.03, 15.0)
    speedRef.current = isShiftRef.current ? baseSpeed * 1.5 : baseSpeed

    dummy.rotation.set(0, 0, 0)

    const pZ = playerPosRef.current.z

    setDistance(Math.floor(Math.max(0, pZ)))

    let floorNeedsUpdate = false
    let lineIdx = 0
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
        decorations.current.forEach(dec => {
          if (dec.active && pZ - dec.pos.z > 20) {
            dec.active = false
          }
        })
        spawnObstacleForSegment(seg.z)
      }

      dummy.position.set(0, -0.25, seg.z)
      dummy.scale.set(10, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (floorMeshRef.current) floorMeshRef.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(-10, -0.25, seg.z)
      dummy.scale.set(10, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (sidewalkMeshRef.current) sidewalkMeshRef.current.setMatrixAt(i * 2, dummy.matrix)

      dummy.position.set(10, -0.25, seg.z)
      dummy.scale.set(10, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (sidewalkMeshRef.current) sidewalkMeshRef.current.setMatrixAt(i * 2 + 1, dummy.matrix)

      dummy.position.set(-1.5, -0.24, seg.z)
      dummy.scale.set(0.1, 0.5, 4)
      dummy.updateMatrix()
      if (lineMeshRef.current) lineMeshRef.current.setMatrixAt(lineIdx++, dummy.matrix)

      dummy.position.set(1.5, -0.24, seg.z)
      dummy.scale.set(0.1, 0.5, 4)
      dummy.updateMatrix()
      if (lineMeshRef.current) lineMeshRef.current.setMatrixAt(lineIdx++, dummy.matrix)

      dummy.position.set(-4.5, -0.24, seg.z)
      dummy.scale.set(0.2, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (lineMeshRef.current) lineMeshRef.current.setMatrixAt(lineIdx++, dummy.matrix)

      dummy.position.set(4.5, -0.24, seg.z)
      dummy.scale.set(0.2, 0.5, SEGMENT_LENGTH)
      dummy.updateMatrix()
      if (lineMeshRef.current) lineMeshRef.current.setMatrixAt(lineIdx++, dummy.matrix)
    })
    if (floorNeedsUpdate && floorMeshRef.current) floorMeshRef.current.instanceMatrix.needsUpdate = true
    if (floorNeedsUpdate && sidewalkMeshRef.current) sidewalkMeshRef.current.instanceMatrix.needsUpdate = true
    if (lineMeshRef.current) lineMeshRef.current.instanceMatrix.needsUpdate = true

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
        
        if (dx < obs.size.x / 2 + 0.1 && dz < obs.size.z / 2 + 0.1) {
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

    let trunkIdx = 0, leavesIdx = 0, poleIdx = 0, lampIdx = 0
    decorations.current.forEach(dec => {
      if (dec.active) {
        if (dec.type === 'tree') {
          dummy.position.set(dec.pos.x, 1 * dec.scale, dec.pos.z)
          dummy.scale.set(dec.scale, dec.scale, dec.scale)
          dummy.rotation.set(0,0,0)
          dummy.updateMatrix()
          if (treeTrunkRef.current) treeTrunkRef.current.setMatrixAt(trunkIdx++, dummy.matrix)
          
          dummy.position.set(dec.pos.x, 3.5 * dec.scale, dec.pos.z)
          dummy.scale.set(dec.scale, dec.scale, dec.scale)
          dummy.updateMatrix()
          if (treeLeavesRef.current) treeLeavesRef.current.setMatrixAt(leavesIdx++, dummy.matrix)
        } else {
          dummy.position.set(dec.pos.x, 3 * dec.scale, dec.pos.z)
          dummy.scale.set(dec.scale, dec.scale, dec.scale)
          dummy.rotation.set(0,0,0)
          dummy.updateMatrix()
          if (poleRef.current) poleRef.current.setMatrixAt(poleIdx++, dummy.matrix)
          
          const lampOffsetX = dec.pos.x < 0 ? 0.8 : -0.8
          dummy.position.set(dec.pos.x + lampOffsetX * dec.scale, 5.8 * dec.scale, dec.pos.z)
          dummy.scale.set(dec.scale, dec.scale, dec.scale)
          dummy.updateMatrix()
          if (lampRef.current) lampRef.current.setMatrixAt(lampIdx++, dummy.matrix)
        }
      }
    })

    hideDummy()
    for (let i = trunkIdx; i < MAX_DECORATIONS; i++) if (treeTrunkRef.current) treeTrunkRef.current.setMatrixAt(i, dummy.matrix)
    for (let i = leavesIdx; i < MAX_DECORATIONS; i++) if (treeLeavesRef.current) treeLeavesRef.current.setMatrixAt(i, dummy.matrix)
    for (let i = poleIdx; i < MAX_DECORATIONS; i++) if (poleRef.current) poleRef.current.setMatrixAt(i, dummy.matrix)
    for (let i = lampIdx; i < MAX_DECORATIONS; i++) if (lampRef.current) lampRef.current.setMatrixAt(i, dummy.matrix)

    if (treeTrunkRef.current) treeTrunkRef.current.instanceMatrix.needsUpdate = true
    if (treeLeavesRef.current) treeLeavesRef.current.instanceMatrix.needsUpdate = true
    if (poleRef.current) poleRef.current.instanceMatrix.needsUpdate = true
    if (lampRef.current) lampRef.current.instanceMatrix.needsUpdate = true

    let coinNeedsUpdate = false
    coins.current.forEach((c, i) => {
      if (c.active && pZ - c.pos.z > 10) c.active = false
      if (c.active) {
        const dx = Math.abs(playerPosRef.current.x - c.pos.x)
        const dz = Math.abs(playerPosRef.current.z - c.pos.z)
        if (dx < 2.5 && dz < 2.5 && playerPosRef.current.y >= -1.0 && playerPosRef.current.y < 3.0) {
          c.active = false
          c.justDied = true
          setCoins((s: number) => s + 1)
          soundManager.playCoin()
        }
      }

      if (c.active) {
        dummy.position.copy(c.pos)
        dummy.rotation.x = Math.PI / 2; dummy.rotation.y = timeElapsed.current * 5; dummy.rotation.z = 0;
        dummy.scale.setScalar(0.4)
        dummy.updateMatrix()
        if (coinMeshRef.current) coinMeshRef.current.setMatrixAt(i, dummy.matrix)
        coinNeedsUpdate = true
      } else if (c.justDied) {
        c.justDied = false
        dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (coinMeshRef.current) coinMeshRef.current.setMatrixAt(i, dummy.matrix)
        coinNeedsUpdate = true
      }
    })
    if (coinNeedsUpdate && coinMeshRef.current) coinMeshRef.current.instanceMatrix.needsUpdate = true

    let windNeedsUpdate = false
    windLines.current.forEach((w, i) => {
      w.pos.z -= w.speed * delta
      if (w.pos.z < pZ - 10) {
        w.pos.set((Math.random() - 0.5) * 40, Math.random() * 15, pZ + 80 + Math.random() * 50)
      }
      dummy.position.copy(w.pos)
      dummy.scale.set(0.05, 0.05, isShiftRef.current ? 24 : 8)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      if (windMeshRef.current) windMeshRef.current.setMatrixAt(i, dummy.matrix)
      windNeedsUpdate = true
    })
    if (windNeedsUpdate && windMeshRef.current) windMeshRef.current.instanceMatrix.needsUpdate = true

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
        <meshLambertMaterial color="#888888" />
      </instancedMesh>

      <instancedMesh ref={sidewalkMeshRef} args={[null as any, null as any, MAX_SEGMENTS * 2]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#999999" />
      </instancedMesh>

      <instancedMesh ref={lineMeshRef} args={[null as any, null as any, MAX_SEGMENTS * 4]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#ffffff" />
      </instancedMesh>

      <instancedMesh ref={treeTrunkRef} args={[null as any, null as any, MAX_DECORATIONS]} castShadow receiveShadow frustumCulled={false}>
        <cylinderGeometry args={[0.3, 0.4, 2, 8]} />
        <meshLambertMaterial color="#8B4513" />
      </instancedMesh>

      <instancedMesh ref={treeLeavesRef} args={[null as any, null as any, MAX_DECORATIONS]} castShadow receiveShadow frustumCulled={false}>
        <coneGeometry args={[1.5, 4, 8]} />
        <meshLambertMaterial color="#2d8a3a" />
      </instancedMesh>

      <instancedMesh ref={poleRef} args={[null as any, null as any, MAX_DECORATIONS]} castShadow receiveShadow frustumCulled={false}>
        <cylinderGeometry args={[0.1, 0.1, 6, 8]} />
        <meshLambertMaterial color="#999999" />
      </instancedMesh>

      <instancedMesh ref={lampRef} args={[null as any, null as any, MAX_DECORATIONS]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1.2, 0.3, 0.5]} />
        <meshBasicMaterial color="#ffffaa" />
      </instancedMesh>

      <instancedMesh ref={hurdleMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#ff5500" />
      </instancedMesh>

      <instancedMesh ref={wallMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#3355cc" />
      </instancedMesh>

      <instancedMesh ref={gapMeshRef} args={[null as any, null as any, MAX_OBSTACLES]} receiveShadow frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshBasicMaterial color="#111111" />
      </instancedMesh>

      <instancedMesh ref={coinMeshRef} args={[null as any, null as any, 50]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 0.2, 16]} />
        <meshLambertMaterial color="#ffd700" />
      </instancedMesh>

      <instancedMesh ref={windMeshRef} args={[null as any, null as any, MAX_WIND]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}

export default function TempleGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing')
  const [gameKey, setGameKey] = useState(0)
  const [distance, setDistance] = useState(0)
  const [coins, setCoins] = useState(0)
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
    setDistance(0)
    setCoins(0)
    setGameKey(k => k + 1)
    playerPosRef.current.set(0, 5, 0)
  }

  return (
    <div className="game-container" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ 
        position: 'absolute', top: 20, right: 20, color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', 
        padding: '10px 20px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'sans-serif', pointerEvents: 'none', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '5px'
      }}>
        <div>거리(Distance): {distance}m</div>
        <div>코인(Coins): {coins}</div>
      </div>

      <button onClick={() => { soundManager.stopBGM(); onBack(); }}
        style={{ position: 'absolute', top: 20, left: 20, padding: '10px 20px', fontSize: '1.2rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>
        뒤로 가기
      </button>

      {gameState === 'gameover' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '5rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0', textShadow: '1px 1px 0 #000' }}>이동 거리: {distance}m</h2>
          <h2 style={{ fontSize: '2rem', margin: '0 0 40px 0', textShadow: '1px 1px 0 #000', color: '#ffd700' }}>획득 코인: {coins}개</h2>
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
          setDistance={setDistance}
          setCoins={setCoins}
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
