import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { soundManager } from '../utils/SoundManager'

export const mobileControls = {
  move: { x: 0, y: 0 },
  jump: false,
  prevJump: false,
  run: false,
  boop: false
}

export function PlayerModel({ playerPosRef, gameOverRef, getFloorHeight, externalForceRef, onRespawn, autoForward, strafeOnly, speedMultiplier = 1, fixedCamera = false, customGravity = -0.015, customJumpForce = 0.3 }: any) {
  const outerGroup = useRef<THREE.Group>(null)
  const innerGroup = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/models/player.glb')
  const { actions } = useAnimations(animations, innerGroup)
  
  const { camera } = useThree()

  const speed = 0.1
  const runSpeed = 0.2
  const turnSpeed = 3.0
  const jumpForce = customJumpForce
  const gravity = customGravity
  
  const keys = useRef<{ [key: string]: boolean }>({})
  const prevKeys = useRef<{ [key: string]: boolean }>({})
  const velocity = useRef(new THREE.Vector3(0, 0, 0))
  const isJumping = useRef(false)
  const jumpCount = useRef(0)
  const stepTimer = useRef(0)
  const flipAngle = useRef(0)
  const targetLane = useRef(0)
  const prevLeft = useRef(false)
  const prevRight = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault()
      keys.current[e.code] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false)
    
    const handleRespawnEvent = (e: any) => {
      if (e.detail && outerGroup.current) {
        outerGroup.current.position.set(e.detail.x, e.detail.y, e.detail.z)
        velocity.current.set(0, 0, 0)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('player_respawn', handleRespawnEvent)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('player_respawn', handleRespawnEvent)
    }
  }, [])

  useFrame((_, delta) => {
    if (!outerGroup.current) return

    playerPosRef.current.copy(outerGroup.current.position)

    if (gameOverRef?.current) {
      Object.values(actions).forEach(action => {
        if (action?.isRunning()) action?.stop()
      })
      return
    }

    let moveZ = 0
    let rotY = 0
    let isRunning = (keys.current['ShiftLeft'] || keys.current['ShiftRight'] || mobileControls.run) || autoForward

    let moveX = 0

    if (keys.current['ArrowUp'] || keys.current['KeyW'] || autoForward) moveZ += 1 
    if (keys.current['ArrowDown'] || keys.current['KeyS']) moveZ -= 1 

    if (!strafeOnly) {
      if (keys.current['ArrowLeft'] || keys.current['KeyA']) rotY += 1 
      if (keys.current['ArrowRight'] || keys.current['KeyD']) rotY -= 1 
    }

    moveZ += mobileControls.move.y
    if (!strafeOnly) rotY -= mobileControls.move.x
    
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
      flipAngle.current += delta * 15 
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

    if (externalForceRef?.current) {
      outerGroup.current.position.add(externalForceRef.current)
      externalForceRef.current.multiplyScalar(0.9)
      if (externalForceRef.current.lengthSq() < 0.001) {
        externalForceRef.current.set(0, 0, 0)
      }
    }

    const floorHeight = getFloorHeight ? getFloorHeight(outerGroup.current.position.x, outerGroup.current.position.y, outerGroup.current.position.z) : 0

    if (outerGroup.current.position.y <= floorHeight && velocity.current.y <= 0) {
      outerGroup.current.position.y = floorHeight
      velocity.current.y = 0
      isJumping.current = false
      jumpCount.current = 0
      flipAngle.current = 0
    }

    if (outerGroup.current.position.y < -30) {
      if (onRespawn) onRespawn()
      else {
        outerGroup.current.position.set(0, 5, 0)
        velocity.current.set(0, 0, 0)
      }
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

    const currentSpeed = (isRunning ? runSpeed : speed) * speedMultiplier
    if (moveZ !== 0) {
      const direction = new THREE.Vector3(0, 0, Math.sign(moveZ)).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(direction, currentSpeed)
    }
    if (strafeOnly) {
      const leftPressed = keys.current['ArrowLeft'] || keys.current['KeyA']
      const rightPressed = keys.current['ArrowRight'] || keys.current['KeyD']
      if (leftPressed && !prevLeft.current) targetLane.current = Math.min(1, targetLane.current + 1)
      if (rightPressed && !prevRight.current) targetLane.current = Math.max(-1, targetLane.current - 1)
      prevLeft.current = !!leftPressed
      prevRight.current = !!rightPressed

      outerGroup.current.position.x = THREE.MathUtils.lerp(outerGroup.current.position.x, targetLane.current * 3, 0.15)
    } else if (moveX !== 0) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(right, Math.sign(moveX) * currentSpeed * 1.5)
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(outerGroup.current.quaternion).normalize()
    const cameraOffset = new THREE.Vector3()
      .copy(outerGroup.current.position)
      .add(new THREE.Vector3(0, 2.5, 0)) 
      .addScaledVector(forward, -6) 

    if (fixedCamera) {
      camera.position.copy(cameraOffset)
    } else {
      camera.position.lerp(cameraOffset, 0.1)
    }
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

export function FallbackPlayer({ playerPosRef, gameOverRef, getFloorHeight, externalForceRef, onRespawn, autoForward, strafeOnly, speedMultiplier = 1, fixedCamera = false, customGravity = -0.015, customJumpForce = 0.3 }: any) {
  const outerGroup = useRef<THREE.Group>(null)
  const { camera } = useThree()
  
  const speed = 0.1
  const turnSpeed = 3.0
  const gravity = customGravity
  const jumpForce = customJumpForce
  
  const keys = useRef<{ [key: string]: boolean }>({})
  const prevKeys = useRef<{ [key: string]: boolean }>({})
  const targetLane = useRef(0)
  const prevLeft = useRef(false)
  const prevRight = useRef(false)
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

    if (gameOverRef?.current) return

    let moveZ = 0
    let rotY = 0
    let moveX = 0

    if (keys.current['ArrowUp'] || keys.current['KeyW'] || autoForward) moveZ += 1 
    if (keys.current['ArrowDown'] || keys.current['KeyS']) moveZ -= 1
    if (strafeOnly) {
      if (keys.current['ArrowLeft'] || keys.current['KeyA']) moveX += 1 
      if (keys.current['ArrowRight'] || keys.current['KeyD']) moveX -= 1
    } else {
      if (keys.current['ArrowLeft'] || keys.current['KeyA']) rotY += 1 
      if (keys.current['ArrowRight'] || keys.current['KeyD']) rotY -= 1 
    }

    moveZ += mobileControls.move.y
    if (strafeOnly) moveX -= mobileControls.move.x
    else rotY -= mobileControls.move.x
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

    if (externalForceRef?.current) {
      outerGroup.current.position.add(externalForceRef.current)
      externalForceRef.current.multiplyScalar(0.9)
      if (externalForceRef.current.lengthSq() < 0.001) {
        externalForceRef.current.set(0, 0, 0)
      }
    }

    const floorHeight = getFloorHeight ? getFloorHeight(outerGroup.current.position.x, outerGroup.current.position.y, outerGroup.current.position.z) : 0

    if (outerGroup.current.position.y <= floorHeight && velocity.current.y <= 0) {
      outerGroup.current.position.y = floorHeight
      velocity.current.y = 0
      isJumping.current = false
      jumpCount.current = 0
      flipAngle.current = 0
    }

    if (outerGroup.current.position.y < -30) {
      if (onRespawn) onRespawn()
      else {
        outerGroup.current.position.set(0, 5, 0)
        velocity.current.set(0, 0, 0)
      }
    }

    const currentSpeed = speed * speedMultiplier
    if (moveZ !== 0) {
      const direction = new THREE.Vector3(0, 0, Math.sign(moveZ)).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(direction, currentSpeed)
    }
    if (strafeOnly) {
      const leftPressed = keys.current['ArrowLeft'] || keys.current['KeyA']
      const rightPressed = keys.current['ArrowRight'] || keys.current['KeyD']
      if (leftPressed && !prevLeft.current) targetLane.current = Math.min(1, targetLane.current + 1)
      if (rightPressed && !prevRight.current) targetLane.current = Math.max(-1, targetLane.current - 1)
      prevLeft.current = !!leftPressed
      prevRight.current = !!rightPressed

      outerGroup.current.position.x = THREE.MathUtils.lerp(outerGroup.current.position.x, targetLane.current * 3, 0.15)
    } else if (moveX !== 0) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(outerGroup.current.quaternion)
      outerGroup.current.position.addScaledVector(right, Math.sign(moveX) * currentSpeed * 1.5)
    }

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(outerGroup.current.quaternion).normalize()
    const cameraOffset = new THREE.Vector3()
      .copy(outerGroup.current.position)
      .add(new THREE.Vector3(0, 2.5, 0))
      .addScaledVector(forward, -6)

    if (fixedCamera) {
      camera.position.copy(cameraOffset)
    } else {
      camera.position.lerp(cameraOffset, 0.1)
    }
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
