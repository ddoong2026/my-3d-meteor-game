import React, { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

function getMeshFromGLTF(gltf: any) {
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((child: any) => {
    if (child.isMesh && !mesh) {
      mesh = child as THREE.Mesh;
      if (mesh.material && (mesh.material as any).map) {
        mesh.material = new THREE.MeshBasicMaterial({ map: (mesh.material as any).map });
      } else {
        mesh.material = new THREE.MeshBasicMaterial({ color: 0x888888 });
      }
    }
  });
  return mesh;
}
import { Joystick } from 'react-joystick-component'
import { soundManager } from '../utils/SoundManager'
import { PlayerModel, FallbackPlayer, mobileControls } from '../components/Player'

const MAX_NORMAL = 20
const MAX_FAST = 10
const MAX_TANK = 5
const MAX_SWARM = 20
const MAX_DASHER = 5
const MAX_WAND = 100
const MAX_SHURIKEN = 50
const MAX_SWORD = 20
const MAX_METEOR = 30
const MAX_LIGHTNING = 50
const MAX_TRAILS = 300
const MAX_GEMS = 300

const dummy = new THREE.Object3D()

const starShape = new THREE.Shape()
for (let i = 0; i < 10; i++) {
  const radius = i % 2 === 0 ? 1.5 : 0.6
  const angle = (i / 10) * Math.PI * 2
  if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
}
starShape.closePath()

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

function HoshikSystem({ playerPosRef, gameStateRef, statsRef, onGameOver, onExpGain, levelRef }: any) {
  const slime1 = useGLTF('/models/Meshy_AI_slime_0709233123_texture_low.glb')
  const slime2 = useGLTF('/models/Meshy_AI_slime_0709233125_texture_low.glb')
  const slime3 = useGLTF('/models/Meshy_AI_slime_0709233126_texture_low.glb')
  const slimeCube = useGLTF('/models/Meshy_AI_Slime_Cube_0709233140_texture_low.glb')
  const slimeRocky = useGLTF('/models/Meshy_AI_Rocky_Slime_0709233151_texture_low.glb')

  const meshNormal = useMemo(() => getMeshFromGLTF(slime1), [slime1])
  const meshFast = useMemo(() => getMeshFromGLTF(slime2), [slime2])
  const meshTank = useMemo(() => getMeshFromGLTF(slimeCube), [slimeCube])
  const meshSwarm = useMemo(() => getMeshFromGLTF(slime3), [slime3])
  const meshDasher = useMemo(() => getMeshFromGLTF(slimeRocky), [slimeRocky])

  const normalMeshRef = useRef<THREE.InstancedMesh>(null)
  const fastMeshRef = useRef<THREE.InstancedMesh>(null)
  const tankMeshRef = useRef<THREE.InstancedMesh>(null)
  const swarmMeshRef = useRef<THREE.InstancedMesh>(null)
  const dasherMeshRef = useRef<THREE.InstancedMesh>(null)
  const dashWarningMeshRef = useRef<THREE.InstancedMesh>(null)
  const wandMeshRef = useRef<THREE.InstancedMesh>(null)
  const shurikenMeshRef = useRef<THREE.InstancedMesh>(null)
  const swordMeshRef = useRef<THREE.InstancedMesh>(null)
  const meteorMeshRef = useRef<THREE.InstancedMesh>(null)
  const lightningMeshRef = useRef<THREE.InstancedMesh>(null)
  const gemMeshRef = useRef<THREE.InstancedMesh>(null)
  const auraRef = useRef<THREE.Mesh>(null)
  const trailMeshRef = useRef<THREE.InstancedMesh>(null)

  const normalEnemies = useRef(Array.from({ length: MAX_NORMAL }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), hp: 10, speed: 2 })))
  const fastEnemies = useRef(Array.from({ length: MAX_FAST }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), hp: 5, speed: 4 })))
  const tankEnemies = useRef(Array.from({ length: MAX_TANK }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), hp: 50, speed: 1 })))
  const swarmEnemies = useRef(Array.from({ length: MAX_SWARM }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), hp: 1, speed: 6 })))
  const dasherEnemies = useRef(Array.from({ length: MAX_DASHER }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), hp: 20, speed: 1.5, state: 0, timer: 3.0, dir: new THREE.Vector3() })))

  const wandProjs = useRef(Array.from({ length: MAX_WAND }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), dir: new THREE.Vector3(), life: 0 })))
  const shurikenProjs = useRef(Array.from({ length: MAX_SHURIKEN }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), dir: new THREE.Vector3(), life: 0, pierce: 0, angle: 0 })))
  const swordProjs = useRef(Array.from({ length: MAX_SWORD }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), dir: new THREE.Vector3(), life: 0, angle: 0 })))
  const meteorProjs = useRef(Array.from({ length: MAX_METEOR }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), target: new THREE.Vector3(), life: 0 })))
  const lightningProjs = useRef(Array.from({ length: MAX_LIGHTNING }, () => ({ active: false, justDied: true, p1: new THREE.Vector3(), p2: new THREE.Vector3(), life: 0, maxLife: 0.2 })))
  
  const trailProjs = useRef(Array.from({ length: MAX_TRAILS }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), color: new THREE.Color(), life: 0, maxLife: 1, scale: 1 })))

  const gems = useRef(Array.from({ length: MAX_GEMS }, () => ({ active: false, justDied: true, pos: new THREE.Vector3(), tracking: false })))

  const timers = useRef({
    spawn: 0,
    wandShoot: 0,
    shurikenShoot: 0,
    swordShoot: 0,
    meteorShoot: 0,
    lightningShoot: 0,
    auraTick: 0
  })
  
  const timeElapsed = useRef(0)

  const damageEnemy = (e: any, damage: number) => {
    e.hp -= damage
    soundManager.playHit()
    if (e.hp <= 0) {
      e.active = false
      e.justDied = true
      soundManager.playEnemyDie()
      const g = gems.current.find(g => !g.active)
      if (g) {
        g.active = true
        g.pos.copy(e.pos).setY(0.2)
        g.tracking = false
      }
    }
  }

  useFrame((_, delta) => {
    if (gameStateRef.current !== 'playing') return

    timeElapsed.current += delta
    const stats = statsRef.current
    const level = levelRef.current

    // Spawn Enemies
    const spawnRate = 0.5 + timeElapsed.current * 0.05
    timers.current.spawn += delta
    if (timers.current.spawn > 1 / spawnRate) {
      timers.current.spawn = 0
      
      const angle = Math.random() * Math.PI * 2
      const dist = 30 + Math.random() * 10
      const spawnPos = new THREE.Vector3(playerPosRef.current.x + Math.cos(angle) * dist, 0.5, playerPosRef.current.z + Math.sin(angle) * dist)
      
      let type = 'normal'
      if (level >= 2 && Math.random() < 0.2) type = 'swarm'
      if (level >= 3 && Math.random() < 0.2) type = 'fast'
      if (level >= 4 && Math.random() < 0.15) type = 'dasher'
      if (level >= 5 && Math.random() < 0.1) type = 'tank'

      if (type === 'swarm') {
         for(let i=0; i<5; i++) {
           const se = swarmEnemies.current.find(en => !en.active)
           if (se) {
             se.active = true
             se.pos.copy(spawnPos).add(new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).multiplyScalar(3))
             se.hp = 1
             se.speed = 4 + Math.random() * 2
           }
         }
      } else if (type === 'dasher') {
         const de = dasherEnemies.current.find(en => !en.active)
         if (de) {
           de.active = true
           de.pos.copy(spawnPos)
           de.hp = 20 + Math.floor(timeElapsed.current / 15) * 5
           de.speed = 2.0
           de.state = 0
           de.timer = 3.0
         }
      } else {
        let pool, hpMultiplier, speedMultiplier
        if (type === 'fast') { pool = fastEnemies.current; hpMultiplier = 0.5; speedMultiplier = 2.0; }
        else if (type === 'tank') { pool = tankEnemies.current; hpMultiplier = 5.0; speedMultiplier = 0.5; }
        else { pool = normalEnemies.current; hpMultiplier = 1.0; speedMultiplier = 1.0; }

        const e = pool.find(en => !en.active)
        if (e) {
          e.active = true
          e.pos.copy(spawnPos)
          if (type === 'tank') e.pos.y = 1.5 // Bigger model
          e.hp = (10 + Math.floor(timeElapsed.current / 15) * 3) * hpMultiplier
          e.speed = (1.5 + Math.random() * 0.5 + timeElapsed.current * 0.01) * speedMultiplier
        }
      }
    }

    // Weapons
    const activeEnemies = [
      ...normalEnemies.current.filter(e => e.active),
      ...fastEnemies.current.filter(e => e.active),
      ...tankEnemies.current.filter(e => e.active),
      ...swarmEnemies.current.filter(e => e.active),
      ...dasherEnemies.current.filter(e => e.active)
    ]

    // 1. Wand
    if (stats.weapons.wand.level > 0) {
      timers.current.wandShoot += delta
      if (timers.current.wandShoot > stats.weapons.wand.fireRate) {
        timers.current.wandShoot = 0
        activeEnemies.sort((a, b) => a.pos.distanceToSquared(playerPosRef.current) - b.pos.distanceToSquared(playerPosRef.current))
        
        for (let i = 0; i < Math.min(stats.weapons.wand.count, activeEnemies.length); i++) {
          const p = wandProjs.current.find(p => !p.active)
          if (p) {
            p.active = true
            p.pos.copy(playerPosRef.current).setY(1)
            p.dir.copy(activeEnemies[i].pos).sub(p.pos).normalize()
            p.life = 2.0
            soundManager.playShoot()
          }
        }
      }
    }

    // 2. Shuriken
    if (stats.weapons.shuriken.level > 0) {
      timers.current.shurikenShoot += delta
      if (timers.current.shurikenShoot > stats.weapons.shuriken.fireRate) {
        timers.current.shurikenShoot = 0
        
        for (let i = 0; i < stats.weapons.shuriken.count; i++) {
          const p = shurikenProjs.current.find(p => !p.active)
          if (p) {
            p.active = true
            p.pos.copy(playerPosRef.current).setY(1)
            const angle = Math.random() * Math.PI * 2
            p.dir.set(Math.cos(angle), 0, Math.sin(angle)).normalize()
            p.life = 3.0
            p.pierce = stats.weapons.shuriken.pierce
            soundManager.playShoot()
          }
        }
      }
    }

    // 3. Aura
    if (stats.weapons.aura.level > 0) {
      if (auraRef.current) {
        auraRef.current.position.copy(playerPosRef.current)
        auraRef.current.scale.setScalar(stats.weapons.aura.radius)
        auraRef.current.visible = true
        auraRef.current.rotation.x = Math.PI / 2
        auraRef.current.rotation.z -= delta * 2 // spin the ring
      }
      timers.current.auraTick += delta
      if (timers.current.auraTick > stats.weapons.aura.tickRate) {
        timers.current.auraTick = 0
        const radiusSq = stats.weapons.aura.radius * stats.weapons.aura.radius
        activeEnemies.forEach(e => {
          if (e.pos.distanceToSquared(playerPosRef.current) < radiusSq) {
            damageEnemy(e, stats.weapons.aura.damage)
          }
        })
      }
    } else {
      if (auraRef.current) auraRef.current.visible = false
    }

    const spawnTrail = (pos: THREE.Vector3, colorHex: number, life: number, scale: number) => {
      const t = trailProjs.current.find(tr => !tr.active)
      if (t) {
        t.active = true; t.pos.copy(pos); t.color.setHex(colorHex); t.life = life; t.maxLife = life; t.scale = scale;
      }
    }

    // 4. Sword
    if (stats.weapons.sword.level > 0) {
      timers.current.swordShoot += delta
      if (timers.current.swordShoot > stats.weapons.sword.fireRate) {
        timers.current.swordShoot = 0
        for (let i = 0; i < stats.weapons.sword.count; i++) {
          const p = swordProjs.current.find(p => !p.active)
          if (p) {
            p.active = true
            p.life = 0.3
            p.angle = (Math.PI * 2 / stats.weapons.sword.count) * i
            soundManager.playShoot()
          }
        }
      }
    }

    // 5. Meteor
    if (stats.weapons.meteor.level > 0) {
      timers.current.meteorShoot += delta
      if (timers.current.meteorShoot > stats.weapons.meteor.fireRate) {
        timers.current.meteorShoot = 0
        for (let i = 0; i < Math.min(stats.weapons.meteor.count, activeEnemies.length); i++) {
          const p = meteorProjs.current.find(p => !p.active)
          if (p) {
            p.active = true
            const e = activeEnemies[Math.floor(Math.random() * activeEnemies.length)]
            p.target.copy(e.pos)
            p.pos.copy(e.pos).setY(20)
            p.life = 1.0
            soundManager.playShoot()
          }
        }
      }
    }

    // Update Projectiles
    let wandNeedsUpdate = false
    wandProjs.current.forEach((p, i) => {
      if (p.active) {
        p.life -= delta
        p.pos.addScaledVector(p.dir, stats.weapons.wand.speed * delta)
        if (p.life <= 0) {
          p.active = false
          p.justDied = true
        } else {
          for (let e of activeEnemies) {
            if (e.active && p.pos.distanceToSquared(e.pos) < 2.0) {
              damageEnemy(e, stats.weapons.wand.damage)
              p.active = false
              p.justDied = true
              break
            }
          }
        }
      }
      if (p.active) {
        spawnTrail(p.pos, 0xffff00, 0.3, 0.3)
        wandNeedsUpdate = true; dummy.position.copy(p.pos); dummy.rotation.x += delta*10; dummy.rotation.y += delta*15; dummy.scale.setScalar(0.4); dummy.updateMatrix()
        if (wandMeshRef.current) wandMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (p.justDied) {
        wandNeedsUpdate = true; p.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (wandMeshRef.current) wandMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })

    let shurikenNeedsUpdate = false
    shurikenProjs.current.forEach((p, i) => {
      if (p.active) {
        p.life -= delta
        p.pos.addScaledVector(p.dir, stats.weapons.shuriken.speed * delta)
        if (p.life <= 0 || p.pierce < 0) {
          p.active = false
          p.justDied = true
        } else {
          // Cooldown per enemy to prevent multiple hits per frame
          for (let e of activeEnemies) {
            if (e.active && p.pos.distanceToSquared(e.pos) < 3.0) {
              // Basic pierce logic (can hit multiple, just decrement pierce)
              damageEnemy(e, stats.weapons.shuriken.damage)
              p.pierce--
              if (p.pierce < 0) {
                p.active = false
                p.justDied = true
                break
              }
            }
          }
        }
      }
      if (p.active) {
        p.angle -= delta * 20
        shurikenNeedsUpdate = true; dummy.position.copy(p.pos); dummy.rotation.set(-Math.PI/2, 0, p.angle); dummy.scale.setScalar(0.8); dummy.updateMatrix()
        if (shurikenMeshRef.current) shurikenMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (p.justDied) {
        shurikenNeedsUpdate = true; p.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (shurikenMeshRef.current) shurikenMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })

    let swordNeedsUpdate = false
    swordProjs.current.forEach((p, i) => {
      if (p.active) {
        p.life -= delta
        if (p.life <= 0) {
          p.active = false
          p.justDied = true
        } else {
          const progress = 1.0 - (p.life / 0.3)
          const currentAngle = p.angle - Math.PI/2 + (progress * Math.PI)
          p.dir.set(Math.cos(currentAngle), 0, Math.sin(currentAngle)).normalize()
          p.pos.copy(playerPosRef.current).addScaledVector(p.dir, 3.0).setY(1.0)
          
          for (let e of activeEnemies) {
            if (e.active && e.pos.distanceToSquared(p.pos) < 6.0) {
              if (Math.random() < 0.2) damageEnemy(e, stats.weapons.sword.damage)
            }
          }
        }
      }
      if (p.active) {
        spawnTrail(p.pos, 0x00ffff, 0.15, 0.5)
        swordNeedsUpdate = true; dummy.position.copy(p.pos); dummy.rotation.x = Math.PI/2; dummy.rotation.z = -Math.atan2(p.dir.z, p.dir.x) - Math.PI/2; dummy.scale.set(0.6, 5.0, 0.1); dummy.updateMatrix()
        if (swordMeshRef.current) swordMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (p.justDied) {
        swordNeedsUpdate = true; p.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (swordMeshRef.current) swordMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })

    let meteorNeedsUpdate = false
    meteorProjs.current.forEach((p, i) => {
      if (p.active) {
        p.life -= delta
        p.pos.y = p.target.y + (p.life / 1.0) * 20
        if (p.life <= 0) {
          p.active = false
          p.justDied = true
          soundManager.playCrash()
          for (let e of activeEnemies) {
            if (e.active && e.pos.distanceToSquared(p.target) < stats.weapons.meteor.radius * stats.weapons.meteor.radius) {
              damageEnemy(e, stats.weapons.meteor.damage)
            }
          }
        }
      }
      if (p.active) {
        spawnTrail(p.pos, 0xff3300, 0.4, 1.5)
        meteorNeedsUpdate = true; dummy.position.copy(p.pos); dummy.rotation.x += delta*5; dummy.rotation.y += delta*3; dummy.scale.setScalar(1.8); dummy.updateMatrix()
        if (meteorMeshRef.current) meteorMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (p.justDied) {
        meteorNeedsUpdate = true; p.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (meteorMeshRef.current) meteorMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })
    // 9. Lightning
    if (stats.weapons.lightning.level > 0) {
      timers.current.lightningShoot += delta
      if (timers.current.lightningShoot > stats.weapons.lightning.fireRate) {
        timers.current.lightningShoot = 0
        let currentPos = new THREE.Vector3().copy(playerPosRef.current)
        const hitEnemies = new Set<any>()
        
        for (let j = 0; j < stats.weapons.lightning.jumps; j++) {
          let closestDist = Infinity
          let closestEnemy: any = null
          
          for (const e of activeEnemies) {
            if (e.active && !hitEnemies.has(e)) {
              const d = e.pos.distanceToSquared(currentPos)
              if (d < stats.weapons.lightning.range * stats.weapons.lightning.range && d < closestDist) {
                closestDist = d
                closestEnemy = e
              }
            }
          }

          if (closestEnemy) {
            // Spawn lightning segment
            const lp = lightningProjs.current.find(l => !l.active)
            if (lp) {
              lp.active = true
              lp.life = lp.maxLife
              lp.p1.copy(currentPos).setY(1.0)
              lp.p2.copy(closestEnemy.pos).setY(1.0)
            }
            
            // Damage enemy
            damageEnemy(closestEnemy, stats.weapons.lightning.damage)
            soundManager.playHit()
            
            hitEnemies.add(closestEnemy)
            currentPos.copy(closestEnemy.pos)
          } else {
            break // No more targets in range
          }
        }
      }
    }

    let lightningNeedsUpdate = false
    lightningProjs.current.forEach((l, i) => {
      if (l.active) {
        l.life -= delta
        if (l.life <= 0) {
          l.active = false
          lightningNeedsUpdate = true; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
          if (lightningMeshRef.current) lightningMeshRef.current.setMatrixAt(i, dummy.matrix)
        } else {
          lightningNeedsUpdate = true
          const midpoint = new THREE.Vector3().addVectors(l.p1, l.p2).multiplyScalar(0.5)
          const dist = l.p1.distanceTo(l.p2)
          const dir = new THREE.Vector3().subVectors(l.p2, l.p1).normalize()
          
          dummy.position.copy(midpoint)
          dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
          
          // Shrink as life decreases
          const thickness = (l.life / l.maxLife) * 0.3
          dummy.scale.set(thickness, dist, thickness)
          dummy.updateMatrix()
          if (lightningMeshRef.current) lightningMeshRef.current.setMatrixAt(i, dummy.matrix)
        }
      } else if (l.justDied) {
        l.justDied = false
        lightningNeedsUpdate = true; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (lightningMeshRef.current) lightningMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })

    // --- ENEMY LOGIC ---
    const updateEnemyMesh = (pool: any[], meshRef: React.RefObject<THREE.InstancedMesh | null>, size: number, animType: 'crawl' | 'charge' | 'jump' | 'wiggle') => {
      let needsUpdate = false
      pool.forEach((e, i) => {
        if (e.active) {
          const dir = new THREE.Vector3().copy(playerPosRef.current).sub(e.pos).normalize()
          e.pos.addScaledVector(dir, e.speed * delta)
          if (e.pos.distanceToSquared(playerPosRef.current) < (size + 1.0) * (size + 1.0)) {
            e.active = false
            e.justDied = true
            stats.hp -= 10
            soundManager.playCrash()
            if (stats.hp <= 0) onGameOver()
          }
        }
        if (e.active) {
          needsUpdate = true; dummy.position.copy(e.pos); 
          
          // Face the player
          const toPlayer = new THREE.Vector3().copy(playerPosRef.current).sub(e.pos).normalize()
          dummy.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)
          dummy.rotation.x = 0;
          dummy.rotation.z = 0;

          const t = Date.now() / 1000 + i;

          if (animType === 'crawl') {
            dummy.scale.set(size, size * (1 + Math.sin(t * 10) * 0.2), size);
            dummy.position.y += Math.abs(Math.sin(t * 10)) * 0.2;
          } else if (animType === 'charge') {
            dummy.scale.setScalar(size);
            dummy.rotation.x = Math.sin(t * 20) * 0.2;
          } else if (animType === 'jump') {
            dummy.scale.set(size, size * (1 - Math.abs(Math.sin(t * 3)) * 0.2), size);
            dummy.position.y += Math.abs(Math.sin(t * 3)) * 2.0;
          } else if (animType === 'wiggle') {
            dummy.scale.setScalar(size);
            dummy.rotation.z = Math.sin(t * 15) * 0.3;
          }

          dummy.updateMatrix()
          if (meshRef.current) meshRef.current.setMatrixAt(i, dummy.matrix)
        } else if (e.justDied) {
          needsUpdate = true; e.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
          if (meshRef.current) meshRef.current.setMatrixAt(i, dummy.matrix)
        }
      })
      if (needsUpdate && meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true
    }

    updateEnemyMesh(normalEnemies.current, normalMeshRef, 1.0, 'crawl')
    updateEnemyMesh(fastEnemies.current, fastMeshRef, 0.7, 'charge')
    updateEnemyMesh(tankEnemies.current, tankMeshRef, 2.5, 'jump')
    updateEnemyMesh(swarmEnemies.current, swarmMeshRef, 0.5, 'wiggle')

    // Update Dasher
    let needsUpdateDasher = false
    dasherEnemies.current.forEach((e, i) => {
      if (e.active) {
        e.timer -= delta
        if (e.state === 0) { // Walk
           const dir = new THREE.Vector3().copy(playerPosRef.current).sub(e.pos).normalize()
           e.pos.addScaledVector(dir, e.speed * delta)
           if (e.timer <= 0) { e.state = 1; e.timer = 1.0; e.dir.copy(dir) } // Prep
        } else if (e.state === 1) { // Prep
           if (e.timer <= 0) { e.state = 2; e.timer = 0.5 } // Dash
        } else if (e.state === 2) { // Dash
           e.pos.addScaledVector(e.dir, e.speed * 8 * delta)
           if (e.timer <= 0) { e.state = 0; e.timer = 3.0 } // Walk
        }

        if (e.pos.distanceToSquared(playerPosRef.current) < 2.0 * 2.0) {
           e.active = false
           e.justDied = true
           stats.hp -= 20
           soundManager.playCrash()
           if (stats.hp <= 0) onGameOver()
        }
      }
      if (e.active) {
         needsUpdateDasher = true; dummy.position.copy(e.pos); dummy.scale.setScalar(1.5); 
         if (e.state === 1) {
           dummy.rotation.y += delta * 20 // shake
         } else {
           dummy.rotation.y = Math.atan2(e.dir.x, e.dir.z)
           if (e.state === 2) {
             dummy.scale.set(1.5, 1.0, 2.5) // stretch when dashing
           } else {
             dummy.position.y += Math.abs(Math.sin((Date.now()/1000+i) * 5)) * 0.5 // small hop
           }
         }
         dummy.rotation.x = Math.PI / 2
         dummy.updateMatrix()
         if (dasherMeshRef.current) dasherMeshRef.current.setMatrixAt(i, dummy.matrix)

         if (e.state === 1 || e.state === 2) {
           dummy.position.copy(e.pos).addScaledVector(e.dir, 10).setY(0.1)
           dummy.rotation.set(0, Math.atan2(e.dir.x, e.dir.z), 0)
           dummy.scale.set(0.5, 0.1, 20)
           dummy.updateMatrix()
           if (dashWarningMeshRef.current) dashWarningMeshRef.current.setMatrixAt(i, dummy.matrix)
         } else {
           dummy.scale.setScalar(0)
           dummy.updateMatrix()
           if (dashWarningMeshRef.current) dashWarningMeshRef.current.setMatrixAt(i, dummy.matrix)
         }
      } else if (e.justDied) {
         needsUpdateDasher = true; e.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
         if (dasherMeshRef.current) dasherMeshRef.current.setMatrixAt(i, dummy.matrix)
         if (dashWarningMeshRef.current) dashWarningMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })
    if (needsUpdateDasher && dasherMeshRef.current) dasherMeshRef.current.instanceMatrix.needsUpdate = true
    if (needsUpdateDasher && dashWarningMeshRef.current) dashWarningMeshRef.current.instanceMatrix.needsUpdate = true

    // Update Gems
    let gemNeedsUpdate = false
    gems.current.forEach((g, i) => {
      if (g.active) {
        const distSq = g.pos.distanceToSquared(playerPosRef.current)
        if (distSq < stats.magnetRadius * stats.magnetRadius) g.tracking = true
        if (g.tracking) {
          const dir = new THREE.Vector3().copy(playerPosRef.current).setY(0.2).sub(g.pos).normalize()
          g.pos.addScaledVector(dir, 15 * delta)

          if (g.pos.distanceToSquared(playerPosRef.current) < 2.0 * 2.0) {
             g.active = false
             g.justDied = true
             onExpGain(10)
             soundManager.playGetXp()
          }
        }
      }
      if (g.active) {
        gemNeedsUpdate = true; dummy.position.copy(g.pos); dummy.rotation.y += delta * 2; dummy.scale.setScalar(0.4); dummy.updateMatrix()
        if (gemMeshRef.current) gemMeshRef.current.setMatrixAt(i, dummy.matrix)
      } else if (g.justDied) {
        gemNeedsUpdate = true; g.justDied = false; dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (gemMeshRef.current) gemMeshRef.current.setMatrixAt(i, dummy.matrix)
      }
    })

    // Update Trails
    let trailNeedsUpdate = false
    trailProjs.current.forEach((t, i) => {
      if (t.active) {
        t.life -= delta
        if (t.life <= 0) {
          t.active = false
          dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
          if (trailMeshRef.current) trailMeshRef.current.setMatrixAt(i, dummy.matrix)
          trailNeedsUpdate = true
        } else {
          const s = t.scale * (t.life / t.maxLife)
          dummy.position.copy(t.pos); dummy.scale.setScalar(s); dummy.rotation.x = 0; dummy.rotation.y = 0; dummy.rotation.z = 0; dummy.updateMatrix()
          if (trailMeshRef.current) {
            trailMeshRef.current.setMatrixAt(i, dummy.matrix)
            trailMeshRef.current.setColorAt(i, t.color)
          }
          trailNeedsUpdate = true
        }
      } else if (t.justDied) {
        t.justDied = false
        dummy.position.set(0, -100, 0); dummy.scale.setScalar(0); dummy.updateMatrix()
        if (trailMeshRef.current) trailMeshRef.current.setMatrixAt(i, dummy.matrix)
        trailNeedsUpdate = true
      }
    })

    if (wandNeedsUpdate && wandMeshRef.current) wandMeshRef.current.instanceMatrix.needsUpdate = true
    if (shurikenNeedsUpdate && shurikenMeshRef.current) shurikenMeshRef.current.instanceMatrix.needsUpdate = true
    if (swordNeedsUpdate && swordMeshRef.current) swordMeshRef.current.instanceMatrix.needsUpdate = true
    if (meteorNeedsUpdate && meteorMeshRef.current) meteorMeshRef.current.instanceMatrix.needsUpdate = true
    if (lightningNeedsUpdate && lightningMeshRef.current) lightningMeshRef.current.instanceMatrix.needsUpdate = true
    if (gemNeedsUpdate && gemMeshRef.current) gemMeshRef.current.instanceMatrix.needsUpdate = true
    if (trailNeedsUpdate && trailMeshRef.current) {
      trailMeshRef.current.instanceMatrix.needsUpdate = true
      if (trailMeshRef.current.instanceColor) trailMeshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <>
      <instancedMesh ref={normalMeshRef} args={[meshNormal?.geometry, meshNormal?.material, MAX_NORMAL]} frustumCulled={false} />

      <instancedMesh ref={fastMeshRef} args={[meshFast?.geometry, meshFast?.material, MAX_FAST]} frustumCulled={false} />

      <instancedMesh ref={tankMeshRef} args={[meshTank?.geometry, meshTank?.material, MAX_TANK]} frustumCulled={false} />

      <instancedMesh ref={swarmMeshRef} args={[meshSwarm?.geometry, meshSwarm?.material, MAX_SWARM]} frustumCulled={false} />

      <instancedMesh ref={dasherMeshRef} args={[meshDasher?.geometry, meshDasher?.material, MAX_DASHER]} frustumCulled={false} />

      <instancedMesh ref={dashWarningMeshRef} args={[null as any, null as any, MAX_DASHER]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} depthWrite={false} />
      </instancedMesh>
      
      <instancedMesh ref={wandMeshRef} args={[null as any, null as any, MAX_WAND]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <instancedMesh ref={shurikenMeshRef} args={[null as any, null as any, MAX_SHURIKEN]} frustumCulled={false}>
        <shapeGeometry args={[starShape]} />
        <meshBasicMaterial color="#ffff00" side={THREE.DoubleSide} />
      </instancedMesh>

      <instancedMesh ref={swordMeshRef} args={[null as any, null as any, MAX_SWORD]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 4]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <instancedMesh ref={meteorMeshRef} args={[null as any, null as any, MAX_METEOR]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ff3300" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <instancedMesh ref={lightningMeshRef} args={[null as any, null as any, MAX_LIGHTNING]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshBasicMaterial color="#ffffaa" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
      </instancedMesh>

      <mesh ref={auraRef} visible={false}>
        <torusGeometry args={[1, 0.15, 8, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <instancedMesh ref={trailMeshRef} args={[null as any, null as any, MAX_TRAILS]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>

      <instancedMesh ref={gemMeshRef} args={[null as any, null as any, MAX_GEMS]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#00ffff" />
      </instancedMesh>
    </>
  )
}

export default function HoshikGame2({ onBack }: { onBack: () => void }) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'levelup' | 'gameover'>('start')
  const [gameKey, setGameKey] = useState(0)
  
  const [hp, setHp] = useState(100)
  const [level, setLevel] = useState(1)
  const [exp, setExp] = useState(0)
  const [expNeeded, setExpNeeded] = useState(50)
  const [time, setTime] = useState(0)
  const [upgradeOptions, setUpgradeOptions] = useState<any[]>([])

  const gameStateRef = useRef(gameState)
  const levelRef = useRef(level)
  useEffect(() => { gameStateRef.current = gameState; levelRef.current = level }, [gameState, level])

  const statsRef = useRef({
    hp: 100, maxHp: 100, magnetRadius: 8, speedMultiplier: 1.2,
    weapons: {
      wand: { level: 1, damage: 15, fireRate: 0.8, count: 2, speed: 15 },
      aura: { level: 0, damage: 5, radius: 4, tickRate: 0.5 },
      shuriken: { level: 0, damage: 25, fireRate: 2.0, count: 1, speed: 10, pierce: 2 },
      sword: { level: 0, damage: 20, fireRate: 3.0, count: 1, radius: 4, speed: 8 },
      meteor: { level: 0, damage: 50, fireRate: 4.0, count: 1, radius: 5 },
      lightning: { level: 0, damage: 20, fireRate: 1.5, jumps: 3, range: 10 }
    }
  })

  const playerPosRef = useRef(new THREE.Vector3())
  const gameOverRef = useRef(true)

  const handleStart = () => {
    setGameState('playing')
    gameOverRef.current = false
    soundManager.init()
    soundManager.playTenseBGM()
  }

  const handleRestart = () => {
    setGameState('playing')
    gameOverRef.current = false
    setHp(100); setLevel(1); setExp(0); setExpNeeded(50); setTime(0)
    statsRef.current = {
      hp: 100, maxHp: 100, magnetRadius: 8, speedMultiplier: 1.2,
      weapons: {
        wand: { level: 1, damage: 15, fireRate: 0.8, count: 2, speed: 15 },
        aura: { level: 0, damage: 5, radius: 4, tickRate: 0.5 },
        shuriken: { level: 0, damage: 25, fireRate: 2.0, count: 1, speed: 10, pierce: 2 },
        sword: { level: 0, damage: 20, fireRate: 3.0, count: 1, radius: 4, speed: 8 },
        meteor: { level: 0, damage: 50, fireRate: 4.0, count: 1, radius: 5 },
        lightning: { level: 0, damage: 20, fireRate: 1.5, jumps: 3, range: 10 }
      }
    }
    setGameKey(k => k + 1)
    soundManager.init()
    soundManager.playTenseBGM()
  }

  const handleGameOver = () => {
    setGameState('gameover')
    gameOverRef.current = true
    soundManager.stopBGM()
  }

  const generateUpgrades = () => {
    const w = statsRef.current.weapons
    const possible = []
    
    if (w.wand.level === 0) possible.push({ name: '신규: 마법 지팡이 획득', apply: () => w.wand.level = 1 })
    else {
      possible.push({ name: '지팡이 피해량 증가', apply: () => w.wand.damage += 10 })
      possible.push({ name: '지팡이 발사체 증가', apply: () => w.wand.count += 1 })
      possible.push({ name: '지팡이 공격 속도 증가', apply: () => w.wand.fireRate *= 0.8 })
    }
    
    if (w.aura.level === 0) possible.push({ name: '신규: 오라 획득', apply: () => { w.aura.level = 1 } })
    else {
      possible.push({ name: '오라 피해량 증가', apply: () => w.aura.damage += 5 })
      possible.push({ name: '오라 범위 증가', apply: () => w.aura.radius += 1.5 })
      possible.push({ name: '오라 타격 속도 증가', apply: () => w.aura.tickRate *= 0.8 })
    }
    
    if (w.shuriken.level === 0) possible.push({ name: '신규: 표창 획득', apply: () => { w.shuriken.level = 1 } })
    else {
      possible.push({ name: '표창 피해량 증가', apply: () => w.shuriken.damage += 15 })
      possible.push({ name: '표창 개수 증가', apply: () => w.shuriken.count += 1 })
      possible.push({ name: '표창 관통력 증가', apply: () => w.shuriken.pierce += 1 })
    }

    if (w.sword.level === 0) possible.push({ name: '신규: 휩쓸기 대검 획득', apply: () => { w.sword.level = 1 } })
    else {
      possible.push({ name: '대검 피해량 증가', apply: () => w.sword.damage += 15 })
      possible.push({ name: '대검 개수 증가', apply: () => w.sword.count += 1 })
      possible.push({ name: '대검 공격 속도 증가', apply: () => w.sword.fireRate *= 0.8 })
    }

    if (statsRef.current.weapons.meteor.level === 0) possible.push({ name: '운석 낙하 획득', apply: () => statsRef.current.weapons.meteor.level = 1 })
    else {
      possible.push({ name: '운석 피해량 증가', apply: () => statsRef.current.weapons.meteor.damage += 25 })
      possible.push({ name: '운석 개수 증가', apply: () => statsRef.current.weapons.meteor.count += 1 })
      possible.push({ name: '운석 낙하 속도 증가', apply: () => statsRef.current.weapons.meteor.fireRate *= 0.85 })
    }

    if (statsRef.current.weapons.lightning.level === 0) possible.push({ name: '번개 지팡이 획득', apply: () => statsRef.current.weapons.lightning.level = 1 })
    else {
      possible.push({ name: '번개 피해량 증가', apply: () => statsRef.current.weapons.lightning.damage += 15 })
      possible.push({ name: '번개 연쇄 횟수 증가', apply: () => statsRef.current.weapons.lightning.jumps += 2 })
      possible.push({ name: '번개 공격 속도 증가', apply: () => statsRef.current.weapons.lightning.fireRate *= 0.8 })
    }

    possible.push({ name: '자석 범위 증가', apply: () => statsRef.current.magnetRadius += 3 })
    possible.push({ name: '최대 체력 회복', apply: () => statsRef.current.hp = statsRef.current.maxHp })
    if (statsRef.current.speedMultiplier < 2.0) {
      possible.push({ name: '이동속도 증가', apply: () => statsRef.current.speedMultiplier += 0.15 })
    }

    // Shuffle and pick 3
    setUpgradeOptions(possible.sort(() => Math.random() - 0.5).slice(0, 3))
  }

  const handleExpGain = (amount: number) => {
    setExp(prev => {
      let next = prev + amount
      if (next >= expNeeded) {
        soundManager.playLevelUp()
        generateUpgrades()
        setGameState('levelup')
        setLevel(l => l + 1)
        setExpNeeded(e => e * 1.2)
        return next - expNeeded
      }
      return next
    })
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (gameStateRef.current === 'playing') {
        setTime(t => t + 0.1)
        setHp(statsRef.current.hp)
      }
    }, 100)
    return () => clearInterval(interval)
  }, [gameKey])

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, overflow: 'hidden', position: 'relative' }}>
      <Canvas key={gameKey} dpr={1} gl={{ antialias: false, powerPreference: "high-performance" }}>
        <color attach="background" args={['#222']} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 20, 10]} intensity={0.5} />
        
        <Suspense fallback={null}>
          <HoshikSystem 
            playerPosRef={playerPosRef} 
            gameStateRef={gameStateRef}
            statsRef={statsRef}
            levelRef={levelRef}
            onGameOver={handleGameOver}
            onExpGain={handleExpGain}
          />
        </Suspense>

        <ErrorBoundary fallback={<FallbackPlayer playerPosRef={playerPosRef} gameOverRef={gameOverRef} speedMultiplier={statsRef.current.speedMultiplier} />}>
          <Suspense fallback={null}>
            <PlayerModel playerPosRef={playerPosRef} gameOverRef={gameOverRef} speedMultiplier={statsRef.current.speedMultiplier} />
          </Suspense>
        </ErrorBoundary>

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[400, 400]} />
          <meshLambertMaterial color="#333" />
        </mesh>
        
        <gridHelper args={[400, 400, 400, 400]} material-color="#555" material-transparent material-opacity={0.2} />
      </Canvas>
      
      {/* 상태 UI */}
      <div style={{ 
        position: 'absolute', top: 20, right: 20, color: 'white', backgroundColor: 'rgba(0,0,0,0.7)', 
        padding: '10px 20px', borderRadius: '8px', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'sans-serif', pointerEvents: 'none', zIndex: 10
      }}>
        <div>생존: {time.toFixed(1)}초</div>
        <div>HP: <span style={{color: hp > 30 ? 'lime' : 'red'}}>{hp}</span> / {statsRef.current.maxHp}</div>
        <div>Lv: {level}</div>
        <div style={{ width: '100%', height: '10px', backgroundColor: '#444', marginTop: '5px', borderRadius: '5px' }}>
          <div style={{ width: `${(exp / expNeeded) * 100}%`, height: '100%', backgroundColor: '#00ffff', borderRadius: '5px' }} />
        </div>
      </div>

      <button onClick={() => { soundManager.stopBGM(); onBack(); }}
        style={{ position: 'absolute', top: 20, left: 20, padding: '10px 20px', fontSize: '1.2rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', zIndex: 10 }}>
        뒤로 가기
      </button>

      {/* 메뉴 / 레벨업 / 게임오버 오버레이 */}
      {gameState === 'start' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '4rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000', color: '#ff8a8a' }}>호식특공대</h1>
          <button onClick={handleStart} style={{ padding: '15px 50px', fontSize: '2rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            게임 시작
          </button>
        </div>
      )}

      {gameState === 'levelup' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 40px 0', color: 'gold' }}>레벨 업!</h1>
          <div style={{ display: 'flex', gap: '20px' }}>
            {upgradeOptions.map((upg, i) => (
              <button key={i} onClick={() => { upg.apply(); setGameState('playing'); }} style={{ padding: '20px', fontSize: '1.5rem', backgroundColor: '#4a4a8e', color: 'white', border: '2px solid #8a8aff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {upg.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'gameover' && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(255,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', zIndex: 20 }}>
          <h1 style={{ fontSize: '5rem', margin: '0 0 20px 0', textShadow: '2px 2px 0 #000' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2rem', margin: '0 0 40px 0', textShadow: '1px 1px 0 #000' }}>생존: {time.toFixed(1)}초 | 레벨: {level}</h2>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={handleRestart} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: 'white', color: 'black', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>다시 시작하기</button>
            <button onClick={() => { soundManager.stopBGM(); onBack(); }} style={{ padding: '15px 40px', fontSize: '1.5rem', backgroundColor: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>메인 메뉴로</button>
          </div>
        </div>
      )}

      <div className="mobile-controls" style={{ position: 'absolute', bottom: 30, left: 30, zIndex: 10 }}>
        <Joystick size={120} baseColor="rgba(255,255,255,0.2)" stickColor="rgba(255,255,255,0.8)" 
          move={(e) => { mobileControls.move.x = (e.x || 0) / 60; mobileControls.move.y = (e.y || 0) / 60 }}
          stop={() => { mobileControls.move.x = 0; mobileControls.move.y = 0 }} />
      </div>

      <div className="mobile-controls" style={{ position: 'absolute', bottom: 30, right: 30, zIndex: 10, display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
        <button 
          onPointerDown={(e) => { e.preventDefault(); mobileControls.run = true }}
          onPointerUp={(e) => { e.preventDefault(); mobileControls.run = false }}
          onPointerLeave={(e) => { e.preventDefault(); mobileControls.run = false }}
          style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1rem', userSelect: 'none', touchAction: 'none' }}>
          RUN
        </button>
        <button 
          onPointerDown={(e) => { e.preventDefault(); mobileControls.jump = true }}
          onPointerUp={(e) => { e.preventDefault(); mobileControls.jump = false }}
          onPointerLeave={(e) => { e.preventDefault(); mobileControls.jump = false }}
          style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.8)', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', userSelect: 'none', touchAction: 'none' }}>
          JUMP
        </button>
      </div>
    </div>
  )
}
