import React, { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { Joystick } from 'react-joystick-component'
import { soundManager } from './utils/SoundManager'

const mobileControls = {
  move: { x: 0, y: 0 },
  jump: false,
  prevJump: false,
  run: false
}

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode, children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

// ==========================================
// 운석 시스템 (Meteorite System)
// ==========================================
const MAX_METEORS = 100
const meteorDummy = new THREE.Object3D()
const warningDummy = new THREE.Object3D()

function MeteoriteSystem({ playerPosRef, gameOverRef, setGameOver, scoreRef }: any) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const warningRef = useRef<THREE.InstancedMesh>(null)
  
  const meteors = useRef(Array.from({ length: MAX_METEORS }, () => ({
    active: false,
    justDied: true, // Initial state needs to be pushed to matrix once
    pos: new THREE.Vector3(),
    speed: 0
  })))
  
  const spawnTimer = useRef(0)
  const timeElapsed = useRef(0)

  useFrame((_, delta) => {
    if (gameOverRef.current) return
    
    timeElapsed.current += delta
    scoreRef.current = timeElapsed.current 
    
    const spawnRate = 1.0 + timeElapsed.current * 0.15 

    spawnTimer.current += delta
    if (spawnTimer.current > 1 / spawnRate) {
      spawnTimer.current = 0
      const m = meteors.current.find(m => !m.active)
      if (m) {
        m.active = true
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * 20
        m.pos.set(playerPosRef.current.x + Math.cos(angle) * dist, 30, playerPosRef.current.z + Math.sin(angle) * dist)
        m.speed = 10 + Math.random() * 10 + timeElapsed.current * 0.5 
        soundManager.playSwoosh()
      }
    }

    let anyActive = false;

    meteors.current.forEach((m, i) => {
      if (m.active) {
        const prevY = m.pos.y
        m.pos.y -= m.speed * delta
        
        if (m.pos.y > 0 && m.pos.y < 2) {
          const dist = Math.hypot(m.pos.x - playerPosRef.current.x, m.pos.z - playerPosRef.current.z)
          if (dist < 1.5) { 
            setGameOver(true)
            gameOverRef.current = true
            soundManager.stopBGM()
            soundManager.playCrash()
          }
        }

        if (prevY >= 0 && m.pos.y < 0) {
          soundManager.playCrash()
        }

        if (m.pos.y < -2) {
          m.active = false
          m.justDied = true
        }
      }
      
      if (m.active) {
        anyActive = true;
        meteorDummy.position.copy(m.pos)
        meteorDummy.rotation.x += delta * 2
        meteorDummy.rotation.y += delta * 2
        meteorDummy.scale.set(1, 1, 1)
        meteorDummy.updateMatrix()
        if (meshRef.current) meshRef.current.setMatrixAt(i, meteorDummy.matrix)
        
        warningDummy.position.set(m.pos.x, 0.05, m.pos.z) 
        warningDummy.rotation.set(-Math.PI / 2, 0, 0)
        const scale = Math.max(0.01, 1 - (m.pos.y / 30)) * 2.5 
        warningDummy.scale.set(scale, scale, scale)
        warningDummy.updateMatrix()
        if (warningRef.current) warningRef.current.setMatrixAt(i, warningDummy.matrix)
      } else if (m.justDied) {
        anyActive = true;
        m.justDied = false;
        meteorDummy.position.set(0, -100, 0)
        meteorDummy.scale.set(0, 0, 0)
        meteorDummy.updateMatrix()
        if (meshRef.current) meshRef.current.setMatrixAt(i, meteorDummy.matrix)
        
        warningDummy.position.set(0, -100, 0)
        warningDummy.scale.set(0, 0, 0)
        warningDummy.updateMatrix()
        if (warningRef.current) warningRef.current.setMatrixAt(i, warningDummy.matrix)
      }
    })
    
    if (anyActive) {
      if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
      if (warningRef.current) warningRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={meshRef} args={[null as any, null as any, MAX_METEORS]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshLambertMaterial color="#444" />
      </instancedMesh>
      
      <instancedMesh ref={warningRef} args={[null as any, null as any, MAX_METEORS]} frustumCulled={false}>
        <ringGeometry args={[0.7, 1, 16]} />
        <meshBasicMaterial color="red" transparent opacity={0.6} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

// ==========================================
// 플레이어 모델
// ==========================================
function PlayerModel({ playerPosRef, gameOverRef }: any) {
  const outerGroup = useRef<THREE.Group>(null)
  const innerGroup = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/models/player.glb')
  const { actions } = useAnimations(animations, innerGroup)
  
  const { camera } = useThree()

  const speed = 0.1
  const runSpeed = 0.2
  const turnSpeed = 3.0
  const jumpForce = 0.3
  const gravity = -0.015
  
  const keys = useRef<{ [key: string]: boolean }>({})
  const prevKeys = useRef<{ [key: string]: boolean }>({})
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const isJumping = useRef(false)
  const jumpCount = useRef(0)
  const stepTimer = useRef(0)
  const flipAngle = useRef(0)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault()
      keys.current[e.code] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!outerGroup.current) return

    // 플레이어의 현재 위치를 매 프레임 업데이트하여 운석 시스템에 전달
    playerPosRef.current.copy(outerGroup.current.position)

    if (gameOverRef.current) {
      // 게임 오버 시 애니메이션 정지 및 입력 무시
      Object.values(actions).forEach(action => {
        if (action?.isRunning()) action?.stop()
      })
      return
    }

    let moveZ = 0
    let rotY = 0
    let isRunning = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || mobileControls.run

    if (keys.current['ArrowUp'] || keys.current['KeyW']) moveZ += 1 
    if (keys.current['ArrowDown'] || keys.current['KeyS']) moveZ -= 1 
    if (keys.current['ArrowLeft'] || keys.current['KeyA']) rotY += 1 
    if (keys.current['ArrowRight'] || keys.current['KeyD']) rotY -= 1 

    // 모바일 조이스틱 입력 합산
    moveZ += mobileControls.move.y
    rotY -= mobileControls.move.x
    
    // 조이스틱을 끝까지 밀면 달리기 판정
    const joyDist = Math.hypot(mobileControls.move.x, mobileControls.move.y)
    if (joyDist > 0.8) isRunning = true

    moveZ = Math.max(-1, Math.min(1, moveZ))
    rotY = Math.max(-1, Math.min(1, rotY))

    outerGroup.current.rotation.y += rotY * turnSpeed * delta
    const isMoving = moveZ !== 0

    const spacePressed = keys.current['Space'] || mobileControls.jump
    const prevSpacePressed = prevKeys.current['Space'] || mobileControls.prevJump
    const jumpTriggered = spacePressed && !prevSpacePressed

    if (jumpTriggered) {
      if (!isJumping.current) {
        velocity.current.y = jumpForce
        isJumping.current = true
        jumpCount.current = 1
        soundManager.playJump()
      } else if (jumpCount.current === 1) {
        velocity.current.y = jumpForce * 1.2
        jumpCount.current = 2
        flipAngle.current = 0
        soundManager.playDoubleJump()
      }
    }

    if (jumpCount.current === 2) {
      flipAngle.current += delta * 15 // Complete 360 in about 0.4s
      if (flipAngle.current >= Math.PI * 2) {
        flipAngle.current = Math.PI * 2
      }
    } else {
      flipAngle.current = 0
    }

    if (innerGroup.current) {
      innerGroup.current.rotation.x = flipAngle.current
    }

    velocity.current.y += gravity
    outerGroup.current.position.y += velocity.current.y

    if (outerGroup.current.position.y <= 0) {
      outerGroup.current.position.y = 0
      velocity.current.y = 0
      isJumping.current = false
      jumpCount.current = 0
      flipAngle.current = 0
    }

    if (isMoving) {
      const animName = isRunning ? 'Running' : 'Walking'
      const otherAnim = isRunning ? 'Walking' : 'Running'
      
      if (actions[animName] && !actions[animName]?.isRunning()) {
        actions[animName]?.reset().play()
      }
      if (actions[otherAnim]?.isRunning()) {
        actions[otherAnim]?.stop()
      }

      if (!isJumping.current) {
        stepTimer.current += delta
        const stepInterval = isRunning ? 0.3 : 0.45
        if (stepTimer.current > stepInterval) {
          stepTimer.current = 0
          soundManager.playStep(isRunning)
        }
      }
    } else {
      stepTimer.current = 0
      Object.values(actions).forEach(action => {
        if (action?.isRunning()) action?.stop()
      })
    }

    const currentSpeed = isRunning ? runSpeed : speed
    if (moveZ !== 0) {
      const direction = new THREE.Vector3(0, 0, Math.sign(moveZ)).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(direction, currentSpeed)
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(outerGroup.current.quaternion).normalize()
    const cameraOffset = new THREE.Vector3()
      .copy(outerGroup.current.position)
      .add(new THREE.Vector3(0, 2.5, 0)) 
      .addScaledVector(forward, -6) 

    camera.position.lerp(cameraOffset, 0.1)
    const lookAtPos = new THREE.Vector3().copy(outerGroup.current.position).add(new THREE.Vector3(0, 1.5, 0))
    camera.lookAt(lookAtPos)

    prevKeys.current['Space'] = !!keys.current['Space']
    mobileControls.prevJump = mobileControls.jump
  })

  return (
    <group ref={outerGroup}>
      <group ref={innerGroup}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

function FallbackPlayer({ playerPosRef, gameOverRef }: any) {
  // player.glb가 없을 때 사용하는 동일한 동작의 박스 모델
  const outerGroup = useRef<THREE.Group>(null)
  const { camera } = useThree()
  
  const speed = 0.1
  const turnSpeed = 3.0
  const gravity = -0.015
  const jumpForce = 0.3
  
  const keys = useRef<{ [key: string]: boolean }>({})
  const prevKeys = useRef<{ [key: string]: boolean }>({})
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const isJumping = useRef(false)
  const jumpCount = useRef(0)
  const flipAngle = useRef(0)
  const innerMesh = useRef<THREE.Mesh>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault()
      keys.current[e.code] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    if (!outerGroup.current) return
    playerPosRef.current.copy(outerGroup.current.position)

    if (gameOverRef.current) return

    let moveZ = 0
    let rotY = 0

    if (keys.current['ArrowUp'] || keys.current['KeyW']) moveZ += 1
    if (keys.current['ArrowDown'] || keys.current['KeyS']) moveZ -= 1
    if (keys.current['ArrowLeft'] || keys.current['KeyA']) rotY += 1
    if (keys.current['ArrowRight'] || keys.current['KeyD']) rotY -= 1

    moveZ += mobileControls.move.y
    rotY -= mobileControls.move.x
    moveZ = Math.max(-1, Math.min(1, moveZ))
    rotY = Math.max(-1, Math.min(1, rotY))

    outerGroup.current.rotation.y += rotY * turnSpeed * delta

    const spacePressed = keys.current['Space'] || mobileControls.jump
    const prevSpacePressed = prevKeys.current['Space'] || mobileControls.prevJump
    const jumpTriggered = spacePressed && !prevSpacePressed

    if (jumpTriggered) {
      if (!isJumping.current) {
        velocity.current.y = jumpForce
        isJumping.current = true
        jumpCount.current = 1
      } else if (jumpCount.current === 1) {
        velocity.current.y = jumpForce * 1.2
        jumpCount.current = 2
        flipAngle.current = 0
      }
    }

    if (jumpCount.current === 2) {
      flipAngle.current += delta * 15
      if (flipAngle.current >= Math.PI * 2) {
        flipAngle.current = Math.PI * 2
      }
    } else {
      flipAngle.current = 0
    }

    if (innerMesh.current) {
      innerMesh.current.rotation.x = flipAngle.current
    }

    velocity.current.y += gravity
    outerGroup.current.position.y += velocity.current.y

    if (outerGroup.current.position.y <= 0) {
      outerGroup.current.position.y = 0
      velocity.current.y = 0
      isJumping.current = false
      jumpCount.current = 0
      flipAngle.current = 0
    }

    if (moveZ !== 0) {
      const direction = new THREE.Vector3(0, 0, Math.sign(moveZ)).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(direction, speed)
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(outerGroup.current.quaternion).normalize()
    const cameraOffset = new THREE.Vector3()
      .copy(outerGroup.current.position)
      .add(new THREE.Vector3(0, 2.5, 0))
      .addScaledVector(forward, -6)

    camera.position.lerp(cameraOffset, 0.1)
    const lookAtPos = new THREE.Vector3().copy(outerGroup.current.position).add(new THREE.Vector3(0, 1.5, 0))
    camera.lookAt(lookAtPos)

    prevKeys.current['Space'] = !!keys.current['Space']
    mobileControls.prevJump = mobileControls.jump
  })

  return (
    <group ref={outerGroup}>
      <mesh ref={innerMesh} position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="hotpink" />
      </mesh>
    </group>
  )
}

// ==========================================
// 메인 App 컴포넌트
// ==========================================
export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start')
  const [gameKey, setGameKey] = useState(0) // 게임 재시작을 위한 키
  
  const gameOverRef = useRef(true)
  const scoreRef = useRef(0)
  const playerPosRef = useRef(new THREE.Vector3())
  const scoreDomRef = useRef<HTMLDivElement>(null)

  const handleStart = () => {
    setGameState('playing')
    gameOverRef.current = false
    soundManager.init()
    soundManager.playTenseBGM()
  }

  const handleRestart = () => {
    setGameState('playing')
    gameOverRef.current = false
    scoreRef.current = 0
    setGameKey(k => k + 1)
    soundManager.init()
    soundManager.playTenseBGM()
  }

  // 매 프레임 점수 DOM 직접 업데이트 (리렌더링 방지)
  useEffect(() => {
    const interval = setInterval(() => {
      if (scoreDomRef.current && !gameOverRef.current) {
        scoreDomRef.current.innerText = `생존 시간: ${scoreRef.current.toFixed(1)}초`
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameKey])

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', position: 'relative' }}>
      <Canvas key={gameKey} dpr={1} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <color attach="background" args={['#87CEEB']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={0.5} />
        
        <MeteoriteSystem 
          playerPosRef={playerPosRef} 
          gameOverRef={gameOverRef} 
          setGameOver={() => setGameState('gameover')} 
          scoreRef={scoreRef} 
        />

        <ErrorBoundary fallback={<FallbackPlayer playerPosRef={playerPosRef} gameOverRef={gameOverRef} />}>
          <Suspense fallback={null}>
            <PlayerModel playerPosRef={playerPosRef} gameOverRef={gameOverRef} />
          </Suspense>
        </ErrorBoundary>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshLambertMaterial color="#32CD32" />
        </mesh>
        
        <gridHelper args={[200, 200]} />
      </Canvas>
      
      {/* 점수 표시 UI */}
      <div 
        ref={scoreDomRef}
        style={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          color: 'white', 
          backgroundColor: 'rgba(0,0,0,0.7)', 
          padding: '10px 20px', 
          borderRadius: '8px', 
          fontSize: '1.5rem',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          pointerEvents: 'none' 
        }}
      >
        생존 시간: 0.0초
      </div>

      {/* 시작 화면 UI */}
      {gameState === 'start' && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
          zIndex: 20
        }}>
          <h1 style={{ fontSize: '4rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>운석 피하기 3D</h1>
          <button 
            onClick={handleStart}
            style={{
              padding: '15px 50px',
              fontSize: '2rem',
              backgroundColor: '#32CD32',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            게임 시작
          </button>
        </div>
      )}

      {/* 게임 오버 화면 UI */}
      {gameState === 'gameover' && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(255,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ fontSize: '5rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2rem', margin: '0 0 40px 0', textShadow: '1px 1px 0 #000' }}>
            최종 생존: {scoreRef.current.toFixed(1)}초
          </h2>
          <button 
            onClick={handleRestart}
            style={{
              padding: '15px 40px',
              fontSize: '1.5rem',
              backgroundColor: 'white',
              color: 'black',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            다시 시작하기
          </button>
        </div>
      )}

      {/* 조작 설명 UI */}
      <div style={{ 
        position: 'absolute', 
        top: 20, 
        left: 20, 
        color: 'white', 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        padding: '15px', 
        borderRadius: '8px', 
        fontFamily: 'sans-serif',
        pointerEvents: 'none' 
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>운석 피하기</h3>
        <p style={{ margin: '5px 0' }}>W/S: 전진 / 후진</p>
        <p style={{ margin: '5px 0' }}>A/D: 좌우 회전</p>
        <p style={{ margin: '5px 0' }}>Space: 점프 (2단 점프 가능)</p>
        <p style={{ margin: '5px 0' }}>Shift: 달리기</p>
      </div>
      {/* 모바일 조이스틱 UI */}
      <div className="mobile-controls" style={{
        position: 'absolute', bottom: 30, left: 30, zIndex: 10
      }}>
        <Joystick 
          size={120} 
          baseColor="rgba(255,255,255,0.2)" 
          stickColor="rgba(255,255,255,0.8)" 
          move={(e) => {
            // size가 120이므로 중심에서 가장자리까지 최대값은 60
            mobileControls.move.x = (e.x || 0) / 60
            mobileControls.move.y = (e.y || 0) / 60
          }}
          stop={() => { 
            mobileControls.move.x = 0
            mobileControls.move.y = 0 
          }}
        />
      </div>

      {/* 모바일 액션 버튼 UI */}
      <div className="mobile-controls" style={{
        position: 'absolute', bottom: 30, right: 30, zIndex: 10, display: 'flex', gap: '15px', alignItems: 'flex-end'
      }}>
        <button 
          onPointerDown={(e) => { e.preventDefault(); mobileControls.run = true }}
          onPointerUp={(e) => { e.preventDefault(); mobileControls.run = false }}
          onPointerLeave={(e) => { e.preventDefault(); mobileControls.run = false }}
          style={{
            width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)',
            border: '3px solid rgba(255,255,255,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1rem',
            userSelect: 'none', touchAction: 'none'
          }}
        >
          RUN
        </button>
        <button 
          onPointerDown={(e) => { e.preventDefault(); mobileControls.jump = true }}
          onPointerUp={(e) => { e.preventDefault(); mobileControls.jump = false }}
          onPointerLeave={(e) => { e.preventDefault(); mobileControls.jump = false }}
          style={{
            width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)',
            border: '3px solid rgba(255,255,255,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
            userSelect: 'none', touchAction: 'none'
          }}
        >
          JUMP
        </button>
      </div>
    </div>
  )
}
