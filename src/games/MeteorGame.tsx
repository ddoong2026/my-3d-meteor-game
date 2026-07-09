import React, { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Joystick } from 'react-joystick-component'
import { soundManager } from '../utils/SoundManager'
import { PlayerModel, FallbackPlayer, mobileControls } from '../components/Player'

const MAX_METEORS = 100
const meteorDummy = new THREE.Object3D()
const warningDummy = new THREE.Object3D()

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

function MeteoriteSystem({ playerPosRef, gameOverRef, setGameOver, scoreRef }: any) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const warningRef = useRef<THREE.InstancedMesh>(null)
  
  const meteors = useRef(Array.from({ length: MAX_METEORS }, () => ({
    active: false,
    justDied: true,
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

export default function MeteorGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start')
  const [gameKey, setGameKey] = useState(0)
  
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
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        생존 시간: 0.0초
      </div>

      <button
        onClick={() => {
          soundManager.stopBGM()
          onBack()
        }}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          padding: '10px 20px',
          fontSize: '1.2rem',
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          zIndex: 10
        }}
      >
        뒤로 가기
      </button>

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
          <h1 style={{ fontSize: '4rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>똥피하는 호식이</h1>
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
          fontFamily: 'sans-serif',
          zIndex: 20
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
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              marginBottom: '20px'
            }}
          >
            다시 시작하기
          </button>
          <button 
            onClick={() => {
              soundManager.stopBGM()
              onBack()
            }}
            style={{
              padding: '10px 30px',
              fontSize: '1.2rem',
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            메인 메뉴로
          </button>
        </div>
      )}

      <div className="mobile-controls" style={{
        position: 'absolute', bottom: 30, left: 30, zIndex: 10
      }}>
        <Joystick 
          size={120} 
          baseColor="rgba(255,255,255,0.2)" 
          stickColor="rgba(255,255,255,0.8)" 
          move={(e) => {
            mobileControls.move.x = (e.x || 0) / 60
            mobileControls.move.y = (e.y || 0) / 60
          }}
          stop={() => { 
            mobileControls.move.x = 0
            mobileControls.move.y = 0 
          }}
        />
      </div>

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
