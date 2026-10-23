import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

import {
  createRound,
  phaseProgress,
  stepRound,
  type RoundPhase,
  type RoundState,
} from './round'
import { dragOrbit, orbitPosition, type OrbitState } from './orbit'
import { banterFor, type BanterLine } from './banter'

export interface GameSnapshot {
  attempts: number
  banter: BanterLine
  canGrab: boolean
  isReady: boolean
  result?: 'won' | 'lost'
  status: string
  timeLeft: number
}

interface Prize {
  body: RAPIER.RigidBody
  mesh: THREE.Group
}

const COLORS = {
  aqua: 0x42c9e8,
  navy: 0x18384c,
  pink: 0xef5f83,
  violet: 0x6f89e8,
  warm: 0xffd65a,
}

const CLAW_TOP_Y = 3.05
const CLAW_LOW_Y = 0.88
const CHUTE = { x: -1.42, z: 0.96 }
const PRIZE_START = { x: 0.58, y: 0.34, z: -0.18 }

export class ClawMachineGame {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  private readonly renderer: THREE.WebGLRenderer
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  private readonly timer = new THREE.Timer()
  private readonly clawRoot = new THREE.Group()
  private readonly head = new THREE.Group()
  private readonly rope: THREE.Mesh
  private readonly prongs: THREE.Group[] = []
  private readonly prize: Prize
  private readonly onSnapshot: (snapshot: GameSnapshot) => void
  private readonly resizeObserver: ResizeObserver
  private readonly canvas: HTMLCanvasElement

  private round: RoundState = createRound()
  private movement = { x: 0, z: 0 }
  private clawPosition = { x: 0, z: 0.05 }
  private cycleStart = { x: 0, z: 0 }
  private carried = false
  private lastGrabSucceeded = false
  private running = false
  private lastPublishedSecond = -1
  private lastPhase: RoundPhase = 'aiming'
  private orbit: OrbitState = { yaw: 0.68, pitch: 0.3 }
  private orbitRadius = 10
  private cameraDrag?: { pointerId: number; x: number; y: number }

  private constructor(canvas: HTMLCanvasElement, onSnapshot: (snapshot: GameSnapshot) => void) {
    this.canvas = canvas
    this.onSnapshot = onSnapshot
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.18

    this.scene.background = null
    this.scene.fog = new THREE.Fog(COLORS.navy, 8, 15)
    this.camera.position.set(5.9, 4.6, 7.8)
    this.camera.lookAt(0, 1.6, 0)

    this.addLights()
    this.addCabinet()
    this.rope = this.createClaw()
    this.prize = this.createPrize()
    this.addDecorations()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.setupCameraDrag()
    this.timer.connect(document)
    this.resize()
    this.publishSnapshot()
  }

  static async create(
    canvas: HTMLCanvasElement,
    onSnapshot: (snapshot: GameSnapshot) => void,
  ): Promise<ClawMachineGame> {
    await RAPIER.init()
    return new ClawMachineGame(canvas, onSnapshot)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer.reset()
    this.renderer.setAnimationLoop(() => this.update())
  }

  setMovement(x: number, z: number): void {
    this.movement.x = x
    this.movement.z = z
  }

  grab(): void {
    if (this.round.phase !== 'aiming') return
    this.lastGrabSucceeded = false
    this.cycleStart = { ...this.clawPosition }
    this.round = stepRound(this.round, { type: 'GRAB' })
    this.lastPhase = 'aiming'
    this.publishSnapshot()
  }

  startRound(): void {
    if (this.round.phase !== 'ready') return
    this.round = stepRound(this.round, { type: 'START' })
    this.timer.reset()
    this.publishSnapshot()
  }

  restart(): void {
    this.round = createRound()
    this.lastPhase = 'aiming'
    this.carried = false
    this.lastGrabSucceeded = false
    this.clawPosition = { x: 0, z: 0.05 }
    this.prize.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.prize.body.setGravityScale(1, true)
    this.prize.body.setTranslation(PRIZE_START, true)
    this.prize.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    this.prize.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.prize.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.publishSnapshot()
  }

  private update(): void {
    this.timer.update()
    const delta = Math.min(this.timer.getDelta(), 1 / 20)
    const previousPhase = this.round.phase

    this.round = stepRound(this.round, { type: 'TICK', deltaSeconds: delta })
    if (this.round.phase !== previousPhase) this.handlePhaseChange(previousPhase, this.round.phase)

    if (this.round.phase === 'aiming') this.updatePlayerMovement(delta)
    this.updateClawAnimation()
    this.updatePhysics(delta)
    this.checkForWin()

    const displayedSecond = Math.ceil(this.round.timeLeft)
    if (displayedSecond !== this.lastPublishedSecond || this.round.phase !== this.lastPhase) {
      this.publishSnapshot()
      this.lastPublishedSecond = displayedSecond
      this.lastPhase = this.round.phase
    }

    this.renderer.render(this.scene, this.camera)
  }

  private updatePlayerMovement(delta: number): void {
    const length = Math.hypot(this.movement.x, this.movement.z)
    const scale = length > 1 ? 1 / length : 1
    const speed = 1.9
    this.clawPosition.x = THREE.MathUtils.clamp(
      this.clawPosition.x + this.movement.x * scale * speed * delta,
      -1.7,
      1.7,
    )
    this.clawPosition.z = THREE.MathUtils.clamp(
      this.clawPosition.z + this.movement.z * scale * speed * delta,
      -1.08,
      1.1,
    )
  }

  private updateClawAnimation(): void {
    const progress = smoothStep(phaseProgress(this.round))
    const phase = this.round.phase
    let headY = CLAW_TOP_Y
    let prongOpen = 1

    if (phase === 'lowering') {
      headY = THREE.MathUtils.lerp(CLAW_TOP_Y, CLAW_LOW_Y, progress)
    } else if (phase === 'closing') {
      headY = CLAW_LOW_Y
      prongOpen = 1 - progress
    } else if (phase === 'lifting') {
      headY = THREE.MathUtils.lerp(CLAW_LOW_Y, CLAW_TOP_Y, progress)
      prongOpen = 0
    } else if (phase === 'returning') {
      this.clawPosition.x = THREE.MathUtils.lerp(this.cycleStart.x, CHUTE.x, progress)
      this.clawPosition.z = THREE.MathUtils.lerp(this.cycleStart.z, CHUTE.z, progress)
      prongOpen = 0
    } else if (phase === 'releasing') {
      prongOpen = progress
    }

    this.clawRoot.position.set(this.clawPosition.x, 0, this.clawPosition.z)
    this.head.position.y = headY
    this.rope.position.y = (3.55 + headY) / 2
    this.rope.scale.y = 3.55 - headY

    for (const [index, prong] of this.prongs.entries()) {
      prong.rotation.z = THREE.MathUtils.lerp(-0.2, -0.62, prongOpen)
      prong.rotation.y = (index / 3) * Math.PI * 2
    }

    if (this.carried) {
      this.prize.body.setNextKinematicTranslation({
        x: this.clawPosition.x,
        y: headY - 0.52,
        z: this.clawPosition.z,
      })
    }
  }

  private handlePhaseChange(previous: RoundPhase, next: RoundPhase): void {
    if (previous === 'closing' && next === 'lifting') this.tryPickup()
    if (previous === 'returning' && next === 'releasing') this.releasePrize()
  }

  private tryPickup(): void {
    const position = this.prize.body.translation()
    const distance = Math.hypot(position.x - this.clawPosition.x, position.z - this.clawPosition.z)
    if (distance > 0.75 || position.y > 0.7) return

    this.carried = true
    this.lastGrabSucceeded = true
    this.prize.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
    this.prize.body.setGravityScale(0, true)
  }

  private releasePrize(): void {
    if (!this.carried) return
    this.carried = false
    this.prize.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.prize.body.setGravityScale(1, true)
    this.prize.body.setLinvel({ x: 0, y: -0.25, z: 0 }, true)
    this.prize.body.setAngvel({ x: 0.8, y: 0.4, z: -0.5 }, true)
  }

  private updatePhysics(delta: number): void {
    this.world.timestep = delta
    this.world.step()

    const translation = this.prize.body.translation()
    const rotation = this.prize.body.rotation()
    this.prize.mesh.position.set(translation.x, translation.y, translation.z)
    this.prize.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  private checkForWin(): void {
    if (this.carried || this.round.phase === 'won' || this.round.phase === 'lost') return
    if (this.round.phase !== 'releasing' && this.round.phase !== 'resetting') return

    const position = this.prize.body.translation()
    const insideChute = Math.abs(position.x - CHUTE.x) < 0.5
      && Math.abs(position.z - CHUTE.z) < 0.44
      && position.y < 0.42

    if (insideChute) {
      this.round = stepRound(this.round, { type: 'PRIZE_DROPPED' })
      this.publishSnapshot()
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x101c30, 2.55))

    const key = new THREE.DirectionalLight(0xffffff, 3.2)
    key.position.set(3, 7, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    this.scene.add(key)

    const pink = new THREE.PointLight(COLORS.pink, 35, 8)
    pink.position.set(-2.6, 2.7, 1.9)
    this.scene.add(pink)

    const aqua = new THREE.PointLight(COLORS.aqua, 28, 7)
    aqua.position.set(2.5, 3.2, -1.5)
    this.scene.add(aqua)
  }

  private addCabinet(): void {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f1e9,
      emissive: 0x182b38,
      emissiveIntensity: 0.12,
      roughness: 0.24,
      metalness: 0.38,
    })
    const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x172e49, roughness: 0.28, metalness: 0.56 })
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x315f70, roughness: 0.38, metalness: 0.18 })
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc8f4f2,
      transparent: true,
      opacity: 0.1,
      roughness: 0.08,
      metalness: 0,
      transmission: 0.35,
      side: THREE.DoubleSide,
    })

    const floor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 3.35), floorMaterial)
    floor.position.y = -0.08
    floor.receiveShadow = true
    this.scene.add(floor)
    this.addStaticCollider({ x: 2.3, y: 0.08, z: 1.675 }, { x: 0, y: -0.08, z: 0 })

    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.22, 3.5), frameMaterial)
    roof.position.y = 3.75
    this.scene.add(roof)

    for (const x of [-2.28, 2.28]) {
      for (const z of [-1.62, 1.62]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.7, 0.14), frameMaterial)
        post.position.set(x, 1.83, z)
        this.scene.add(post)
      }
    }

    const addLightStrip = (
      size: [number, number, number],
      position: [number, number, number],
      color: number,
    ): void => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 4.5,
          roughness: 0.16,
          metalness: 0.08,
          toneMapped: false,
        }),
      )
      strip.position.set(...position)
      this.scene.add(strip)
    }

    addLightStrip([0.055, 3.34, 0.055], [-2.18, 1.84, 1.705], COLORS.aqua)
    addLightStrip([0.055, 3.34, 0.055], [2.18, 1.84, 1.705], COLORS.pink)
    addLightStrip([0.055, 3.34, 0.055], [-2.18, 1.84, -1.655], COLORS.pink)
    addLightStrip([0.055, 3.34, 0.055], [2.18, 1.84, -1.655], COLORS.aqua)
    addLightStrip([2.08, 0.055, 0.055], [-1.08, 3.62, 1.705], COLORS.pink)
    addLightStrip([2.08, 0.055, 0.055], [1.08, 3.62, 1.705], COLORS.aqua)
    addLightStrip([0.055, 0.055, 3.08], [-2.305, 3.62, 0], COLORS.pink)
    addLightStrip([0.055, 0.055, 3.08], [2.305, 3.62, 0], COLORS.aqua)
    addLightStrip([2.08, 0.045, 0.055], [-1.08, 0.08, 1.705], COLORS.aqua)
    addLightStrip([2.08, 0.045, 0.055], [1.08, 0.08, 1.705], COLORS.pink)

    const leftGlow = new THREE.PointLight(COLORS.aqua, 12, 3.6)
    leftGlow.position.set(-2.12, 2, 2)
    const rightGlow = new THREE.PointLight(COLORS.pink, 12, 3.6)
    rightGlow.position.set(2.12, 2, 2)
    this.scene.add(leftGlow, rightGlow)

    const back = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.55), glassMaterial)
    back.position.set(0, 1.82, -1.58)
    this.scene.add(back)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 3.55), glassMaterial)
    left.rotation.y = Math.PI / 2
    left.position.set(-2.24, 1.82, 0)
    this.scene.add(left)

    const right = left.clone()
    right.position.x = 2.24
    this.scene.add(right)

    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(1.14, 0.025, 1.02),
      new THREE.MeshStandardMaterial({ color: COLORS.aqua, emissive: COLORS.aqua, emissiveIntensity: 1.4 }),
    )
    chute.position.set(CHUTE.x, 0.015, CHUTE.z)
    this.scene.add(chute)

    const chuteFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.18, 0.08, 1.06)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    )
    chuteFrame.position.set(CHUTE.x, 0.05, CHUTE.z)
    this.scene.add(chuteFrame)

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.68, 3.65), baseMaterial)
    plinth.position.y = -0.5
    plinth.castShadow = true
    this.scene.add(plinth)

    const frontPanel = new THREE.Mesh(
      new THREE.BoxGeometry(4.35, 0.42, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x284961, roughness: 0.32, metalness: 0.42 }),
    )
    frontPanel.position.set(0, -0.48, 1.86)
    this.scene.add(frontPanel)

    addLightStrip([1.82, 0.055, 0.04], [-1.02, -0.32, 1.91], COLORS.pink)
    addLightStrip([1.82, 0.055, 0.04], [1.02, -0.32, 1.91], COLORS.aqua)

    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.025),
      new THREE.MeshStandardMaterial({
        color: COLORS.warm,
        emissive: COLORS.warm,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      }),
    )
    badge.position.set(0, -0.53, 1.915)
    this.scene.add(badge)
  }

  private createClaw(): THREE.Mesh {
    const metal = new THREE.MeshStandardMaterial({ color: 0xdbeeff, roughness: 0.18, metalness: 0.92 })
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x394967, roughness: 0.25, metalness: 0.8 })

    const railX = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 0.1), darkMetal)
    railX.position.y = 3.56
    this.scene.add(railX)

    const railZ = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.8), darkMetal)
    railZ.position.y = 3.5
    this.clawRoot.add(railZ)

    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.42), metal)
    carriage.position.y = 3.46
    carriage.castShadow = true
    this.clawRoot.add(carriage)

    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 10), metal)
    rope.geometry.translate(0, -0.5, 0)
    rope.position.y = 3.52
    this.clawRoot.add(rope)

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 12), metal)
    cap.castShadow = true
    this.head.add(cap)

    for (let index = 0; index < 3; index += 1) {
      const pivot = new THREE.Group()
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.48, 6, 10), metal)
      arm.position.y = -0.3
      arm.rotation.z = -0.58
      arm.castShadow = true
      pivot.add(arm)
      this.head.add(pivot)
      this.prongs.push(pivot)
    }

    this.head.position.y = CLAW_TOP_Y
    this.clawRoot.add(this.head)
    this.scene.add(this.clawRoot)
    return rope
  }

  private createPrize(): Prize {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(PRIZE_START.x, PRIZE_START.y, PRIZE_START.z)
        .setLinearDamping(0.35)
        .setAngularDamping(0.6),
    )
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.28, 0.28, 0.28).setRestitution(0.15).setFriction(0.8),
      body,
    )

    const mesh = new THREE.Group()
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.56, 0.56),
      new THREE.MeshStandardMaterial({ color: COLORS.pink, roughness: 0.36, metalness: 0.08 }),
    )
    box.castShadow = true
    box.receiveShadow = true
    mesh.add(box)

    const ribbonMaterial = new THREE.MeshStandardMaterial({ color: COLORS.warm, roughness: 0.3, metalness: 0.35 })
    const ribbonX = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.08, 0.15), ribbonMaterial)
    const ribbonZ = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.59), ribbonMaterial)
    ribbonX.position.y = 0.27
    ribbonZ.position.y = 0.27
    mesh.add(ribbonX, ribbonZ)
    this.scene.add(mesh)

    return { body, mesh }
  }

  private addDecorations(): void {
    const colors = [COLORS.aqua, COLORS.violet, COLORS.warm, 0x75ff9f]
    const positions = [
      [-0.55, -0.72],
      [1.34, 0.58],
      [-0.72, 0.2],
      [0.95, -0.78],
    ]

    for (const [index, position] of positions.entries()) {
      const gem = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.22 + (index % 2) * 0.05, 1),
        new THREE.MeshStandardMaterial({
          color: colors[index],
          emissive: colors[index],
          emissiveIntensity: 0.22,
          roughness: 0.24,
          metalness: 0.35,
        }),
      )
      gem.position.set(position[0] ?? 0, 0.22, position[1] ?? 0)
      gem.rotation.set(index, index * 0.6, index * 0.3)
      gem.castShadow = true
      this.scene.add(gem)
    }

    const stars = new THREE.BufferGeometry()
    const points: number[] = []
    for (let index = 0; index < 120; index += 1) {
      points.push((Math.random() - 0.5) * 14, Math.random() * 6, (Math.random() - 0.5) * 11 - 2)
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    this.scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x8fdcff, size: 0.035 })))
  }

  private addStaticCollider(halfExtents: RAPIER.Vector3, position: RAPIER.Vector3): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    )
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z),
      body,
    )
  }

  private publishSnapshot(): void {
    this.onSnapshot({
      attempts: this.round.attempts,
      banter: banterFor({
        attempts: this.round.attempts,
        carried: this.carried || this.lastGrabSucceeded,
        phase: this.round.phase,
        timeLeft: this.round.timeLeft,
      }),
      canGrab: this.round.phase === 'aiming',
      isReady: this.round.phase === 'ready',
      result: this.round.phase === 'won' || this.round.phase === 'lost' ? this.round.phase : undefined,
      status: statusForPhase(this.round.phase),
      timeLeft: this.round.timeLeft,
    })
  }

  private resize(): void {
    const canvas = this.renderer.domElement
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.orbitRadius = height > width ? 12 : 10.2
    this.applyCameraOrbit()
    this.camera.updateProjectionMatrix()
  }

  private setupCameraDrag(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      this.cameraDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
      this.canvas.setPointerCapture(event.pointerId)
      this.canvas.classList.add('is-dragging')
    })

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.cameraDrag || this.cameraDrag.pointerId !== event.pointerId) return

      this.orbit = dragOrbit(
        this.orbit,
        event.clientX - this.cameraDrag.x,
        event.clientY - this.cameraDrag.y,
      )
      this.cameraDrag.x = event.clientX
      this.cameraDrag.y = event.clientY
      this.applyCameraOrbit()
    })

    const stopDragging = (event: PointerEvent): void => {
      if (!this.cameraDrag || this.cameraDrag.pointerId !== event.pointerId) return
      if (this.canvas.hasPointerCapture(event.pointerId)) {
        this.canvas.releasePointerCapture(event.pointerId)
      }
      this.cameraDrag = undefined
      this.canvas.classList.remove('is-dragging')
    }

    this.canvas.addEventListener('pointerup', stopDragging)
    this.canvas.addEventListener('pointercancel', stopDragging)
  }

  private applyCameraOrbit(): void {
    const position = orbitPosition({
      ...this.orbit,
      radius: this.orbitRadius,
      targetY: 1.55,
    })
    this.camera.position.set(position.x, position.y, position.z)
    this.camera.lookAt(0, 1.55, 0)
  }
}

function statusForPhase(phase: RoundPhase): string {
  const messages: Record<RoundPhase, string> = {
    ready: '先拖曳畫面確認目標，準備好再開始',
    aiming: '移動搖桿，讓夾爪對準粉紅禮物',
    lowering: '夾爪下降中…',
    closing: '正在夾取！',
    lifting: '穩住，慢慢升起…',
    returning: '送往發光的取物口',
    releasing: '放開禮物！',
    resetting: '夾爪準備歸位',
    won: '成功！禮物到手了',
    lost: '本局結束，請重新投幣再挑戰',
  }
  return messages[phase]
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}
