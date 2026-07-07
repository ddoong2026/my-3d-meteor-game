import React, { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { soundManager } from '../utils/SoundManager'

export const mobileControls = {
  move: { x: 0, y: 0 },
  jump: false,
  prevJump: false,
  run: false
}

export function PlayerModel({ playerPosRef, gameOverRef }: any) {
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

    playerPosRef.current.copy(outerGroup.current.position)

    if (gameOverRef.current) {
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

    moveZ += mobileControls.move.y
    rotY -= mobileControls.move.x
    
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

export function FallbackPlayer({ playerPosRef, gameOverRef }: any) {
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
