import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { Joystick } from 'react-joystick-component'
import { soundManager } from '../utils/SoundManager'
import { PlayerModel, FallbackPlayer, mobileControls } from '../components/Player'

const PITCH_W = 120
const PITCH_L = 180
const GOAL_W = 32
const GOAL_D = 4
const BALL_R = 1.5

function getMeshFromGLTF(gltf: any): any {
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((child: any) => {
    if (child.isMesh && !mesh) {
      mesh = child as THREE.Mesh;
    }
  });
  return mesh;
}

const dummy = new THREE.Object3D()

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode, children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const GoalStructure = ({ isBlue, isNeon }: { isBlue: boolean, isNeon: boolean }) => {
  const color = isBlue ? '#4444ff' : '#ff4444'
  const netColor = isNeon ? color : '#ffffff'
  const zSign = isBlue ? 1 : -1
  return (
    <group>
       <mesh position={[-GOAL_W/2, 2, 0]}><cylinderGeometry args={[0.3, 0.3, 4]} /><meshStandardMaterial color={color} emissive={isNeon ? color : '#000'} emissiveIntensity={isNeon ? 2 : 0} /></mesh>
       <mesh position={[GOAL_W/2, 2, 0]}><cylinderGeometry args={[0.3, 0.3, 4]} /><meshStandardMaterial color={color} emissive={isNeon ? color : '#000'} emissiveIntensity={isNeon ? 2 : 0} /></mesh>
       <mesh position={[0, 4, 0]} rotation={[0, 0, Math.PI/2]}><cylinderGeometry args={[0.3, 0.3, GOAL_W]} /><meshStandardMaterial color={color} emissive={isNeon ? color : '#000'} emissiveIntensity={isNeon ? 2 : 0} /></mesh>
       
       <mesh position={[0, 2, zSign * GOAL_D]}><planeGeometry args={[GOAL_W, 4]} /><meshBasicMaterial color={netColor} wireframe transparent opacity={0.4} side={THREE.DoubleSide}/></mesh>
       <mesh position={[-GOAL_W/2, 2, zSign * GOAL_D/2]} rotation={[0, Math.PI/2, 0]}><planeGeometry args={[GOAL_D, 4]} /><meshBasicMaterial color={netColor} wireframe transparent opacity={0.4} side={THREE.DoubleSide}/></mesh>
       <mesh position={[GOAL_W/2, 2, zSign * GOAL_D/2]} rotation={[0, Math.PI/2, 0]}><planeGeometry args={[GOAL_D, 4]} /><meshBasicMaterial color={netColor} wireframe transparent opacity={0.4} side={THREE.DoubleSide}/></mesh>
       <mesh position={[0, 4, zSign * GOAL_D/2]} rotation={[Math.PI/2, 0, 0]}><planeGeometry args={[GOAL_W, GOAL_D]} /><meshBasicMaterial color={netColor} wireframe transparent opacity={0.4} side={THREE.DoubleSide}/></mesh>
    </group>
  )
}

function SoccerSystem({ mapType, playerPosRef, gameStateRef, scoreRef, onGoal, chargeUIRef, chargeBarRef }: any) {
  const slimeModel = useGLTF('/models/Meshy_AI_slime_0709233123_texture_low.glb')
  
  const meshAlly = useMemo(() => {
    const m = getMeshFromGLTF(slimeModel)
    if (m) {
      const clone = m.clone()
      clone.material = new THREE.MeshLambertMaterial({ color: '#4444ff' })
      return clone
    }
    return null
  }, [slimeModel])

  const meshEnemy = useMemo(() => {
    const m = getMeshFromGLTF(slimeModel)
    if (m) {
      const clone = m.clone()
      clone.material = new THREE.MeshLambertMaterial({ color: '#ff4444' })
      return clone
    }
    return null
  }, [slimeModel])

  const allyMeshRef = useRef<THREE.InstancedMesh>(null)
  const enemyMeshRef = useRef<THREE.InstancedMesh>(null)
  const ballRef = useRef<THREE.Mesh>(null)
  const boopWaveRef = useRef<THREE.Mesh>(null)

  const ballPos = useRef(new THREE.Vector3(0, BALL_R, 0))
  const ballVel = useRef(new THREE.Vector3(0, 0, 0))
  const ballPossessor = useRef<string | null>(null)
  const isGoalScored = useRef(false)
  const goalTimer = useRef(0)

  const boopTimer = useRef(0)
  const boopVisualTimer = useRef(0)

  const playerPrevPosRef = useRef(new THREE.Vector3(0, 5, 20))
  const playerFacingRef = useRef(new THREE.Vector3(0, 0, -1))
  
  const isCharging = useRef(false)
  const chargeLevel = useRef(0)
  const chargeDir = useRef(1)

  const allies = useRef(Array.from({ length: 4 }, (_, i) => ({
    pos: new THREE.Vector3(-10 + i*5, 0.5, 10),
    vel: new THREE.Vector3(),
    speed: 0.35 + Math.random()*0.1,
    role: i === 0 ? 'gk' : i === 1 ? 'df' : 'fw',
    facing: new THREE.Vector3(0, 0, -1)
  })))

  const enemies = useRef(Array.from({ length: 5 }, (_, i) => ({
    pos: new THREE.Vector3(-10 + i*5, 0.5, -10),
    vel: new THREE.Vector3(),
    speed: 0.35 + Math.random()*0.1,
    role: i === 0 ? 'gk' : i < 3 ? 'df' : 'fw',
    facing: new THREE.Vector3(0, 0, 1)
  })))

  const keys = useRef<{ [key: string]: boolean }>({})
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const resetPositions = () => {
    ballPos.current.set(0, BALL_R, 0)
    ballVel.current.set(0, 0, 0)
    ballPossessor.current = null

    
    if (playerPosRef.current) {
        window.dispatchEvent(new CustomEvent('player_respawn', { detail: { x: 0, y: 5, z: 20 } }))
    }

    allies.current.forEach((a, i) => a.pos.set(-10 + i*5, 0.5, 10))
    enemies.current.forEach((e, i) => e.pos.set(-10 + i*4, 0.5, -10))
  }

  useFrame((_, delta) => {
    if (gameStateRef.current !== 'playing') return

    if (playerPosRef.current) {
        const moveVec = new THREE.Vector3().copy(playerPosRef.current).sub(playerPrevPosRef.current)
        moveVec.y = 0
        if (moveVec.lengthSq() > 0.001) {
            playerFacingRef.current.copy(moveVec).normalize()
        }
        playerPrevPosRef.current.copy(playerPosRef.current)

        if (playerPosRef.current.x > PITCH_W/2 - 1) playerPosRef.current.x = PITCH_W/2 - 1
        if (playerPosRef.current.x < -PITCH_W/2 + 1) playerPosRef.current.x = -PITCH_W/2 + 1
        if (playerPosRef.current.z > PITCH_L/2 - 1) playerPosRef.current.z = PITCH_L/2 - 1
        if (playerPosRef.current.z < -PITCH_L/2 + 1) playerPosRef.current.z = -PITCH_L/2 + 1
    }

    if (isGoalScored.current) {
      goalTimer.current -= delta
      if (goalTimer.current <= 0) {
        isGoalScored.current = false
        resetPositions()
      }
      return
    }

    if (boopTimer.current > 0) boopTimer.current -= delta
    if (boopVisualTimer.current > 0) boopVisualTimer.current -= delta

    const doBoop = keys.current['KeyE'] || mobileControls.boop
    
    if (doBoop) {
        if (!isCharging.current && boopTimer.current <= 0) {
            isCharging.current = true
            chargeLevel.current = 0
            chargeDir.current = 1
        } else if (isCharging.current) {
            chargeLevel.current += chargeDir.current * delta * 1.5
            if (chargeLevel.current >= 1.0) {
                chargeLevel.current = 1.0
                chargeDir.current = -1
            } else if (chargeLevel.current <= 0.0 && chargeDir.current === -1) {
                isCharging.current = false
                chargeLevel.current = 0
            }
        }
    } else {
        if (isCharging.current) {
            if (chargeLevel.current > 0 && boopTimer.current <= 0) {
                boopTimer.current = 1.5
                boopVisualTimer.current = 0.3
                soundManager.playShoot()
                
                const distToBall = playerPosRef.current.distanceTo(ballPos.current)
                if (distToBall < 18) {
                    soundManager.playCrash()
                    ballPossessor.current = null
                    
                    const forceDir = new THREE.Vector3().copy(ballPos.current).sub(playerPosRef.current)
                    if (forceDir.lengthSq() < 0.001) forceDir.set(0, 0, 1)
                    forceDir.normalize()
                    forceDir.y = 0.3
                    
                    const forceMagn = 2.0 + (chargeLevel.current * 7.0)
                    ballVel.current.add(forceDir.multiplyScalar(forceMagn))
                }
            }
            isCharging.current = false
            chargeLevel.current = 0
        }
    }

    if (chargeUIRef.current && chargeBarRef.current) {
        chargeUIRef.current.style.opacity = isCharging.current ? '1' : '0'
        chargeBarRef.current.style.width = `${chargeLevel.current * 100}%`
        const r = Math.floor(chargeLevel.current * 255)
        const g = Math.floor((1 - chargeLevel.current) * 255)
        chargeBarRef.current.style.backgroundColor = `rgb(${r}, ${g}, 0)`
    }

    if (boopWaveRef.current) {
      if (boopVisualTimer.current > 0) {
        boopWaveRef.current.visible = true
        const scale = 1.0 + (0.3 - boopVisualTimer.current) * 40
        boopWaveRef.current.scale.setScalar(scale)
        boopWaveRef.current.position.copy(playerPosRef.current)
        boopWaveRef.current.position.y = 0.5
        const mat = boopWaveRef.current.material as THREE.MeshBasicMaterial
        mat.opacity = boopVisualTimer.current / 0.3
      } else {
        boopWaveRef.current.visible = false
      }
    }

    if (!ballPossessor.current && playerPosRef.current && playerPosRef.current.distanceTo(ballPos.current) < BALL_R + 2.0) {
        ballPossessor.current = 'player'
    }

    if (ballPossessor.current) {
        let possessorPos = null
        let pDir = new THREE.Vector3(0, 0, 1)
        if (ballPossessor.current === 'player') {
            possessorPos = playerPosRef.current
            pDir.copy(playerFacingRef.current)
        } else if (ballPossessor.current.startsWith('ally_')) {
            const idx = parseInt(ballPossessor.current.split('_')[1])
            possessorPos = allies.current[idx].pos
            pDir.copy(allies.current[idx].facing)
        } else if (ballPossessor.current.startsWith('enemy_')) {
            const idx = parseInt(ballPossessor.current.split('_')[1])
            possessorPos = enemies.current[idx].pos
            pDir.copy(enemies.current[idx].facing)
        }
        
        if (possessorPos) {
            if (pDir.lengthSq() < 0.001) pDir.set(0, 0, 1)
            pDir.normalize()
            
            ballPos.current.copy(possessorPos).add(pDir.multiplyScalar(BALL_R + 1.5))
            ballPos.current.y = BALL_R
            ballVel.current.set(0, 0, 0)
        } else {
            ballPossessor.current = null
        }
    } else {
        ballVel.current.y -= 0.02
        ballPos.current.add(ballVel.current)
        ballVel.current.x *= 0.98
        ballVel.current.z *= 0.98

        if (ballPos.current.y < BALL_R) {
          ballPos.current.y = BALL_R
          ballVel.current.y *= -0.6
          if (Math.abs(ballVel.current.y) < 0.05) ballVel.current.y = 0
        }
    }

    if (ballVel.current.lengthSq() > 9.0) {
      ballVel.current.normalize().multiplyScalar(3.0)
    }

    if (isNaN(ballPos.current.x) || ballPos.current.y < -10 || ballPos.current.y > 100 || Math.abs(ballPos.current.x) > PITCH_W * 2 || Math.abs(ballPos.current.z) > PITCH_L * 2) {
      console.warn("Ball safety reset");
      resetPositions();
      return;
    }

    const halfW = PITCH_W / 2 - BALL_R
    const halfL = PITCH_L / 2 - BALL_R
    
    const inGoalX = Math.abs(ballPos.current.x) < GOAL_W / 2
    if (Math.abs(ballPos.current.z) > halfL) {
      if (inGoalX) {
        if (ballPos.current.z > halfL + GOAL_D) {
            ballPos.current.z = halfL + GOAL_D
            ballVel.current.z *= -0.5
        } else if (ballPos.current.z < -halfL - GOAL_D) {
            ballPos.current.z = -halfL - GOAL_D
            ballVel.current.z *= -0.5
        } else {
            if (!isGoalScored.current && Math.abs(ballPos.current.z) > halfL + BALL_R) {
                isGoalScored.current = true
                goalTimer.current = 2.0
                soundManager.playLevelUp()
                if (ballPos.current.z < 0) {
                    scoreRef.current.blue += 1
                    onGoal('blue')
                } else {
                    scoreRef.current.red += 1
                    onGoal('red')
                }
            }
        }
      } else {
        if (ballPos.current.z > halfL) { ballPos.current.z = halfL; ballVel.current.z *= -0.8; }
        if (ballPos.current.z < -halfL) { ballPos.current.z = -halfL; ballVel.current.z *= -0.8; }
      }
    }

    if (ballPos.current.x > halfW) { ballPos.current.x = halfW; ballVel.current.x *= -0.8; }
    if (ballPos.current.x < -halfW) { ballPos.current.x = -halfW; ballVel.current.x *= -0.8; }

    if (ballRef.current) {
      ballRef.current.position.copy(ballPos.current)
      ballRef.current.rotation.x += ballVel.current.z * 0.5
      ballRef.current.rotation.z -= ballVel.current.x * 0.5
    }

    const updateBots = (bots: any[], isEnemy: boolean, meshRef: any) => {
        let needsUpdate = false
        const targetGoalZ = isEnemy ? PITCH_L/2 : -PITCH_L/2 
        const defendGoalZ = isEnemy ? -PITCH_L/2 : PITCH_L/2 
        
        // Find nearest bot to ball for pressing
        let nearestBotIdx = -1
        let minBotDist = Infinity
        bots.forEach((b, i) => {
           if (b.role === 'gk') return
           const d = b.pos.distanceTo(ballPos.current)
           if (d < minBotDist) {
              minBotDist = d
              nearestBotIdx = i
           }
        })
        
        bots.forEach((b, i) => {
            const idealPos = new THREE.Vector3()
            const iHaveBall = ballPossessor.current === (isEnemy ? `enemy_${i}` : `ally_${i}`)
            
            if (iHaveBall) {
                idealPos.set(0, 0.5, targetGoalZ)
                if (Math.abs(b.pos.z - targetGoalZ) < 50) { // Shoot
                    ballPossessor.current = null
                    const kickDir = new THREE.Vector3(0, 0, targetGoalZ).sub(b.pos)
                    if (kickDir.lengthSq() > 0.001) kickDir.normalize()
                    else kickDir.set(0, 0, isEnemy ? 1 : -1)
                    kickDir.y = 0.2
                    ballVel.current.add(kickDir.multiplyScalar(3.0))
                }
            } else if (b.role === 'gk') {
                const gkX = Math.max(-GOAL_W/2 + 2, Math.min(GOAL_W/2 - 2, ballPos.current.x))
                idealPos.set(gkX, 0.5, defendGoalZ + (isEnemy ? 3 : -3))
                if (ballPos.current.distanceTo(b.pos) < 15) {
                    idealPos.copy(ballPos.current)
                }
            } else {
                const isNearest = i === nearestBotIdx
                if (isNearest) {
                    const dirToGoal = new THREE.Vector3(0, 0, targetGoalZ).sub(ballPos.current)
                    if (dirToGoal.lengthSq() > 0.001) dirToGoal.normalize()
                    else dirToGoal.set(0, 0, isEnemy ? 1 : -1)
                    idealPos.copy(ballPos.current).sub(dirToGoal.multiplyScalar(BALL_R + 2.5))
                } else if (b.role === 'df') {
                    const side = i % 2 === 0 ? 1 : -1
                    const zPos = defendGoalZ + (isEnemy ? 25 : -25)
                    const xPos = ballPos.current.x * 0.5 + side * 15
                    idealPos.set(xPos, 0.5, zPos)
                } else if (b.role === 'fw') {
                    const side = i % 2 === 0 ? 1 : -1
                    const zPos = targetGoalZ * 0.5
                    idealPos.set(side * 25, 0.5, zPos)
                    if (Math.abs(ballPos.current.z - targetGoalZ) < 60) {
                       idealPos.set(ballPos.current.x + side * 15, 0.5, ballPos.current.z + (isEnemy ? -10 : 10))
                    }
                }
            }
            idealPos.y = 0.5
            
            // Clamp idealPos so bots don't try to run outside the pitch to get behind the ball
            idealPos.x = Math.max(-PITCH_W/2 + 2, Math.min(PITCH_W/2 - 2, idealPos.x))
            idealPos.z = Math.max(-PITCH_L/2 + 2, Math.min(PITCH_L/2 - 2, idealPos.z))

            let moveDir = new THREE.Vector3().copy(idealPos).sub(b.pos)
            const distToIdeal = moveDir.length()
            
            if (distToIdeal > 1.0) {
                if (moveDir.lengthSq() > 0.001) moveDir.normalize()
            } else {
                moveDir = new THREE.Vector3().copy(ballPos.current).setY(0.5).sub(b.pos)
                if (moveDir.lengthSq() > 0.001) moveDir.normalize()
                else moveDir.set(0, 0, isEnemy ? 1 : -1)
            }
            
            // Wall avoidance
            if (b.pos.x > PITCH_W/2 - 2 && moveDir.x > 0) moveDir.x = -1
            if (b.pos.x < -PITCH_W/2 + 2 && moveDir.x < 0) moveDir.x = 1
            if (b.pos.z > PITCH_L/2 - 2 && moveDir.z > 0) moveDir.z = -1
            if (b.pos.z < -PITCH_L/2 + 2 && moveDir.z < 0) moveDir.z = 1
            
            if (moveDir.lengthSq() > 0.001) moveDir.normalize()
            
            b.pos.addScaledVector(moveDir, b.speed * delta * 60)
            b.facing.copy(moveDir)
            
            const dist = b.pos.distanceTo(ballPos.current)
            if (!ballPossessor.current && dist < BALL_R + 1.5) {
                if (b.role === 'gk') {
                    const kickDir = new THREE.Vector3().copy(ballPos.current).sub(b.pos)
                    if (kickDir.lengthSq() > 0.001) kickDir.normalize()
                    else kickDir.set(0, 0, isEnemy ? 1 : -1)
                    kickDir.y = 0.2
                    ballVel.current.add(kickDir.multiplyScalar(0.4))
                } else {
                    ballPossessor.current = isEnemy ? `enemy_${i}` : `ally_${i}`
                }
            } else if (ballPossessor.current && dist < BALL_R + 2.0) {
                const possessorIsEnemy = ballPossessor.current.startsWith(isEnemy ? 'ally_' : 'enemy_') || (isEnemy && ballPossessor.current === 'player')
                if (possessorIsEnemy) {
                    if (b.role === 'gk') {
                        ballPossessor.current = null
                        soundManager.playCrash()
                        const kickDir = new THREE.Vector3().copy(ballPos.current).sub(b.pos)
                        if (kickDir.lengthSq() > 0.001) kickDir.normalize()
                        else kickDir.set(0, 0, isEnemy ? 1 : -1)
                        kickDir.y = 0.2
                        ballVel.current.add(kickDir.multiplyScalar(0.5))
                    } else {
                        ballPossessor.current = isEnemy ? `enemy_${i}` : `ally_${i}`
                        soundManager.playCrash()
                    }
                }
            }

            if (b.pos.x > PITCH_W/2 - 1) b.pos.x = PITCH_W/2 - 1
            if (b.pos.x < -PITCH_W/2 + 1) b.pos.x = -PITCH_W/2 + 1
            if (b.pos.z > PITCH_L/2 - 1) b.pos.z = PITCH_L/2 - 1
            if (b.pos.z < -PITCH_L/2 + 1) b.pos.z = -PITCH_L/2 + 1

            if (playerPosRef.current) {
                const pd = b.pos.distanceTo(playerPosRef.current)
                if (pd < 1.5) {
                    const push = new THREE.Vector3().copy(b.pos).sub(playerPosRef.current).normalize().multiplyScalar(0.1)
                    b.pos.add(push)
                }
            }

            needsUpdate = true
            dummy.position.copy(b.pos)
            dummy.rotation.y = Math.atan2(moveDir.x, moveDir.z)
            dummy.scale.setScalar(1.0 + Math.sin(Date.now() * 0.01 + i) * 0.1)
            dummy.updateMatrix()
            if (meshRef.current) meshRef.current.setMatrixAt(i, dummy.matrix)
        })
        if (needsUpdate && meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
    }

    updateBots(allies.current, false, allyMeshRef)
    updateBots(enemies.current, true, enemyMeshRef)

    if (playerPosRef.current && !ballPossessor.current) {
        const pDist = playerPosRef.current.distanceTo(ballPos.current)
        if (pDist < BALL_R + 1.5) {
            ballPossessor.current = 'player'
        }
    }
  })

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PITCH_W, PITCH_L]} />
        <meshStandardMaterial color={mapType === 'grass' ? "#2e7d32" : "#0f0f1a"} roughness={0.8} />
      </mesh>
      
      {mapType === 'grass' && (
         <group position={[0, 0.02, 0]}>
           <mesh rotation={[-Math.PI/2, 0, 0]}><planeGeometry args={[PITCH_W, 0.4]} /><meshBasicMaterial color="white" /></mesh>
           <mesh rotation={[-Math.PI/2, 0, 0]}><ringGeometry args={[15.6, 16.4, 32]} /><meshBasicMaterial color="white" /></mesh>
           <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, PITCH_L/2 - 16]}><ringGeometry args={[15.6, 16.4, 4, 1, 0, Math.PI]} /><meshBasicMaterial color="white" side={THREE.DoubleSide} /></mesh>
           <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, -PITCH_L/2 + 16]}><ringGeometry args={[15.6, 16.4, 4, 1, Math.PI, Math.PI]} /><meshBasicMaterial color="white" side={THREE.DoubleSide} /></mesh>
         </group>
      )}
      {mapType === 'neon' && (
         <gridHelper args={[PITCH_L, 90, 0x00ffff, 0xff00ff]} position={[0, 0.01, 0]} />
      )}

      <mesh position={[PITCH_W/2 + 0.5, 2, 0]} visible={false}>
         <boxGeometry args={[1, 4, PITCH_L]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#0ff"} emissive={mapType === 'neon' ? "#0ff" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>
      <mesh position={[-PITCH_W/2 - 0.5, 2, 0]} visible={false}>
         <boxGeometry args={[1, 4, PITCH_L]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#0ff"} emissive={mapType === 'neon' ? "#0ff" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>
      
      <mesh position={[-(PITCH_W/2 + GOAL_W/2)/2, 2, -PITCH_L/2]} visible={false}>
         <boxGeometry args={[(PITCH_W - GOAL_W)/2, 4, 1]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#ff0"} emissive={mapType === 'neon' ? "#ff0" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>
      <mesh position={[(PITCH_W/2 + GOAL_W/2)/2, 2, -PITCH_L/2]} visible={false}>
         <boxGeometry args={[(PITCH_W - GOAL_W)/2, 4, 1]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#ff0"} emissive={mapType === 'neon' ? "#ff0" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>

      <mesh position={[-(PITCH_W/2 + GOAL_W/2)/2, 2, PITCH_L/2]} visible={false}>
         <boxGeometry args={[(PITCH_W - GOAL_W)/2, 4, 1]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#ff0"} emissive={mapType === 'neon' ? "#ff0" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>
      <mesh position={[(PITCH_W/2 + GOAL_W/2)/2, 2, PITCH_L/2]} visible={false}>
         <boxGeometry args={[(PITCH_W - GOAL_W)/2, 4, 1]} />
         <meshStandardMaterial color={mapType === 'grass' ? "#888" : "#ff0"} emissive={mapType === 'neon' ? "#ff0" : "#000"} emissiveIntensity={0.2} transparent opacity={mapType === 'neon' ? 0.3 : 1} />
      </mesh>

      <group position={[0, 0, -PITCH_L/2]}>
         <GoalStructure isBlue={false} isNeon={mapType === 'neon'} />
      </group>
      <group position={[0, 0, PITCH_L/2]}>
         <GoalStructure isBlue={true} isNeon={mapType === 'neon'} />
      </group>

      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[BALL_R, 32, 32]} />
        <meshStandardMaterial color={mapType === 'neon' ? "#ffff00" : "#ffffff"} roughness={0.2} metalness={mapType === 'neon' ? 0.8 : 0.1} emissive={mapType === 'neon' ? "#555500" : "#000000"} />
      </mesh>

      <mesh ref={boopWaveRef} visible={false} rotation={[-Math.PI/2, 0, 0]}>
         <ringGeometry args={[0.8, 1, 32]} />
         <meshBasicMaterial color="#00ffff" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      <instancedMesh ref={allyMeshRef} args={[meshAlly?.geometry, meshAlly?.material, 4]} frustumCulled={false} />
      <instancedMesh ref={enemyMeshRef} args={[meshEnemy?.geometry, meshEnemy?.material, 5]} frustumCulled={false} />
    </>
  )
}

export default function HosikSoccerGame({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'map_select' | 'playing' | 'gameover'>('map_select')
  const [mapType, setMapType] = useState<'grass' | 'neon'>('grass')
  const [gameKey, setGameKey] = useState(0)
  
  const [score, setScore] = useState({ blue: 0, red: 0 })
  const [winMsg, setWinMsg] = useState('')
  const [goalFanfare, setGoalFanfare] = useState<{show: boolean, team: string}>({show: false, team: ''})

  const gameStateRef = useRef(gameState)
  const scoreRef = useRef(score)
  useEffect(() => { gameStateRef.current = gameState; scoreRef.current = score }, [gameState, score])

  const playerPosRef = useRef(new THREE.Vector3(0, 5, 20))
  const gameOverRef = useRef(false)

  const chargeUIRef = useRef<HTMLDivElement>(null)
  const chargeBarRef = useRef<HTMLDivElement>(null)

  const handleStart = (selectedMap: 'grass' | 'neon') => {
    setMapType(selectedMap)
    setGameState('playing')
    gameOverRef.current = false
    setScore({ blue: 0, red: 0 })
    setGameKey(k => k + 1)
    soundManager.init()
    soundManager.playTenseBGM()
  }

  const handleGoal = (teamScored: string) => {
     setScore({ ...scoreRef.current })
     setGoalFanfare({ show: true, team: teamScored })
     setTimeout(() => setGoalFanfare({ show: false, team: '' }), 2000)

     if (scoreRef.current.blue >= 3) {
         setWinMsg('BLUE TEAM WINS!')
         setGameState('gameover')
         gameOverRef.current = true
     } else if (scoreRef.current.red >= 3) {
         setWinMsg('RED TEAM WINS!')
         setGameState('gameover')
         gameOverRef.current = true
     }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', position: 'relative' }}>
      {gameState !== 'map_select' && (
        <Canvas key={gameKey} dpr={1} gl={{ antialias: false }}>
          <color attach="background" args={[mapType === 'neon' ? '#000' : '#87CEEB']} />
          <ambientLight intensity={mapType === 'neon' ? 0.3 : 0.8} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
          
          <Suspense fallback={null}>
            <SoccerSystem 
              mapType={mapType}
              playerPosRef={playerPosRef} 
              gameStateRef={gameStateRef}
              scoreRef={scoreRef}
              onGoal={handleGoal}
              chargeUIRef={chargeUIRef}
              chargeBarRef={chargeBarRef}
            />
          </Suspense>

          <ErrorBoundary fallback={<FallbackPlayer playerPosRef={playerPosRef} gameOverRef={gameOverRef} speedMultiplier={2.5} />}>
            <Suspense fallback={null}>
              <PlayerModel playerPosRef={playerPosRef} gameOverRef={gameOverRef} speedMultiplier={2.5} />
            </Suspense>
          </ErrorBoundary>
          
          {mapType === 'neon' && (
            <EffectComposer>
              <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} />
            </EffectComposer>
          )}
        </Canvas>
      )}
      
      {gameState === 'playing' && (
        <div style={{ 
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', 
          color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', 
          padding: '10px 40px', borderRadius: '16px', fontSize: '2rem', fontWeight: 'bold', 
          fontFamily: 'sans-serif', pointerEvents: 'none', zIndex: 10,
          display: 'flex', gap: '20px', alignItems: 'center'
        }}>
          <span style={{ color: '#4444ff' }}>{score.blue}</span>
          <span style={{ fontSize: '1.2rem', color: '#aaa' }}>VS</span>
          <span style={{ color: '#ff4444' }}>{score.red}</span>
        </div>
      )}

      {goalFanfare.show && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          <style>
            {`
              @keyframes popIn {
                0% { transform: scale(0); opacity: 0; }
                60% { transform: scale(1.2); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes confettiFall {
                0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
                100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
              }
            `}
          </style>
          <h1 style={{ fontSize: '8rem', color: goalFanfare.team === 'blue' ? '#4444ff' : '#ff4444', textShadow: '4px 4px 0 #fff, -4px -4px 0 #fff, 4px -4px 0 #fff, -4px 4px 0 #fff', margin: 0, animation: 'popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
            GOAL~!!
          </h1>
          <h2 style={{ fontSize: '3rem', color: 'white', textShadow: '2px 2px 0 #000', margin: '20px 0 0 0', animation: 'popIn 0.5s 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) both' }}>
            {goalFanfare.team === 'blue' ? '청팀 득점!' : '홍팀 득점!'}
          </h2>
          
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: '-10%',
              fontSize: `${Math.random() * 2 + 1}rem`,
              animation: `confettiFall ${Math.random() * 1.5 + 1.5}s linear forwards`,
              animationDelay: `${Math.random() * 0.5}s`
            }}>
              {['🎉', '⚽', '✨', '🎊', '💙', '❤️'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}

      {/* Charge UI Overlay */}
      <div ref={chargeUIRef} style={{
        position: 'absolute', top: '70%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '200px', height: '20px', backgroundColor: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '10px',
        opacity: 0, pointerEvents: 'none', transition: 'opacity 0.1s', zIndex: 40, overflow: 'hidden'
      }}>
        <div ref={chargeBarRef} style={{ width: '0%', height: '100%', backgroundColor: 'rgb(0,255,0)' }}></div>
      </div>

      <button onClick={() => { soundManager.stopBGM(); onBack(); }}
        style={{ position: 'absolute', top: 20, left: 20, padding: '10px 20px', fontSize: '1.2rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>
        뒤로 가기
      </button>

      {gameState === 'map_select' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#1a1a2e', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '4rem', margin: '0 0 40px 0', textShadow: '2px 2px 0 #000', color: '#8aff8a' }}>⚽ 호식이 축구게임 ⚽</h1>
          <h2 style={{ marginBottom: '30px' }}>경기장을 선택하세요 (3점 선내기)</h2>
          <div style={{ display: 'flex', gap: '40px' }}>
             <button onClick={() => handleStart('grass')} style={{ padding: '30px 50px', fontSize: '1.5rem', backgroundColor: '#2e7d32', color: 'white', border: '4px solid #4caf50', borderRadius: '16px', cursor: 'pointer', fontWeight: 'bold' }}>
               잔디 구장
             </button>
             <button onClick={() => handleStart('neon')} style={{ padding: '30px 50px', fontSize: '1.5rem', backgroundColor: '#4a0082', color: '#00ffff', border: '4px solid #00ffff', borderRadius: '16px', cursor: 'pointer', fontWeight: 'bold', textShadow: '0 0 5px #00ffff' }}>
               네온 사이버펑크
             </button>
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '5rem', margin: '0 0 20px 0', color: winMsg.includes('BLUE') ? '#4444ff' : '#ff4444', textShadow: '2px 2px 0 #fff' }}>
            {winMsg}
          </h1>
          <h2 style={{ fontSize: '3rem', margin: '0 0 40px 0' }}>{score.blue} : {score.red}</h2>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={() => setGameState('map_select')} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: 'white', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>맵 선택으로</button>
            <button onClick={() => { soundManager.stopBGM(); onBack(); }} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>메인 메뉴로</button>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
          <>
            <div className="mobile-controls" style={{ position: 'absolute', bottom: 30, left: 30, zIndex: 10 }}>
                <Joystick size={120} baseColor="rgba(255,255,255,0.2)" stickColor="rgba(255,255,255,0.8)" 
                move={(e) => { mobileControls.move.x = (e.x || 0) / 60; mobileControls.move.y = (e.y || 0) / 60 }}
                stop={() => { mobileControls.move.x = 0; mobileControls.move.y = 0 }} />
            </div>

            <div className="mobile-controls" style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 10, display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                <button 
                onPointerDown={(e) => { e.preventDefault(); mobileControls.boop = true }}
                onPointerUp={(e) => { e.preventDefault(); mobileControls.boop = false }}
                onPointerLeave={(e) => { e.preventDefault(); mobileControls.boop = false }}
                style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,100,0,0.5)', border: '3px solid rgba(255,150,0,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', userSelect: 'none', touchAction: 'none', boxShadow: '0 0 10px #ff8800' }}>
                BOOP! (E)
                </button>

                <button 
                onPointerDown={(e) => { e.preventDefault(); mobileControls.jump = true }}
                onPointerUp={(e) => { e.preventDefault(); mobileControls.jump = false }}
                onPointerLeave={(e) => { e.preventDefault(); mobileControls.jump = false }}
                style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', userSelect: 'none', touchAction: 'none' }}>
                JUMP
                </button>
            </div>
          </>
      )}
    </div>
  )
}
