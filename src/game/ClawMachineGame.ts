import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

import {
  createRound,
  phaseProgress,
  stepRound,
  type RoundPhase,
  type RoundState,
} from './round'
import { dragOrbit, orbitPosition, type OrbitState } from './orbit'
import { banterFor, type BanterLine } from './banter'
import { approachVelocity, type PlanarMotion } from './clawMotion'
import { clawDescentProgress, clawOpeningForPhase } from './clawPose'
import { ArticulatedClaw } from './ArticulatedClaw'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { PrizeCarryController } from './PrizeCarryController'
import {
  canPickupPrize,
  CHUTE_OPENING_HALF_X,
  CHUTE_OPENING_HALF_Z,
  isPrizeCaptured,
  prizeReleaseAngularVelocity,
  PRIZE_GRIP_OPENING,
  PRIZE_HALF_DEPTH,
  PRIZE_HALF_HEIGHT,
  PRIZE_HALF_WIDTH,
} from './prizeInteraction'
import { createPrizeModel } from './prizeModel'
import { createGantryAssembly } from './gantry'
import {
  canTiltPickup,
  TILT_GRIP_OPENING,
  tiltAmountForPhase,
  tiltPlanForAim,
  type TiltPlan,
} from './tiltGrab'

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
  collider: RAPIER.Collider
  mesh: THREE.Group
}

const COLORS = {
  aqua: 0x42c9e8,
  navy: 0x18384c,
  pink: 0xef5f83,
  violet: 0x6f89e8,
  warm: 0xffd65a,
}

const CLAW_TOP_Y = MACHINE_DIMENSIONS.clawTopY
const CLAW_LOW_Y = MACHINE_DIMENSIONS.clawLowY
const CHUTE = { x: -1.2, z: 0.96 }
const PRIZE_START = { x: 0.48, y: 0.62, z: -0.18 }
const ROPE_ANCHOR_Y = MACHINE_DIMENSIONS.ropeAnchorY

export class ClawMachineGame {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  private readonly renderer: THREE.WebGLRenderer
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  private readonly timer = new THREE.Timer()
  private readonly gantry = createGantryAssembly()
  private readonly articulatedClaw: ArticulatedClaw
  private readonly prize: Prize
  private readonly prizeCarry: PrizeCarryController
  private readonly onSnapshot: (snapshot: GameSnapshot) => void
  private readonly resizeObserver: ResizeObserver
  private readonly canvas: HTMLCanvasElement

  private round: RoundState = createRound()
  private movement = { x: 0, z: 0 }
  private clawPosition = { ...CHUTE }
  private cycleStart = { ...CHUTE }
  private driveVelocity: PlanarMotion = { x: 0, z: 0 }
  private carried = false
  private lastGrabSucceeded = false
  private running = false
  private lastPublishedSecond = -1
  private lastPhase: RoundPhase = 'aiming'
  private orbit: OrbitState = { yaw: 0.08, pitch: 0.24 }
  private orbitRadius = 10
  private cameraDrag?: { pointerId: number; x: number; y: number }
  private tiltPlan?: TiltPlan

  private constructor(canvas: HTMLCanvasElement, onSnapshot: (snapshot: GameSnapshot) => void) {
    this.canvas = canvas
    this.onSnapshot = onSnapshot
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3

    this.scene.background = null
    this.scene.fog = new THREE.Fog(COLORS.navy, 13, 23)
    this.camera.position.set(5.9, 4.6, 7.8)
    this.camera.lookAt(0, 1.6, 0)

    this.addLights()
    this.addCabinet()
    this.scene.add(this.gantry.root)
    this.articulatedClaw = new ArticulatedClaw(this.world, this.scene, {
      anchorY: ROPE_ANCHOR_Y,
      headY: CLAW_TOP_Y,
      x: CHUTE.x,
      z: CHUTE.z,
    })
    this.prize = this.createPrize()
    this.prizeCarry = new PrizeCarryController(this.prize.body, this.prize.collider)
    this.addAmbientStars()

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
    this.tiltPlan = tiltPlanForAim(this.clawPosition, this.prize.body.translation())
    this.articulatedClaw.applyImpulse({
      x: this.driveVelocity.x * 0.025,
      y: 0,
      z: this.driveVelocity.z * 0.025,
    })
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
    this.tiltPlan = undefined
    this.clawPosition = { ...CHUTE }
    this.cycleStart = { ...CHUTE }
    this.driveVelocity = { x: 0, z: 0 }
    this.articulatedClaw.reset(CHUTE.x, CHUTE.z, ROPE_ANCHOR_Y - CLAW_TOP_Y)
    this.prizeCarry.release()
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
    else this.driveVelocity = approachVelocity(this.driveVelocity, { x: 0, z: 0 }, delta)
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
    this.driveVelocity = approachVelocity(this.driveVelocity, {
      x: this.movement.x * scale * speed,
      z: this.movement.z * scale * speed,
    }, delta)
    const nextX = THREE.MathUtils.clamp(
      this.clawPosition.x + this.driveVelocity.x * delta,
      -1.28,
      1.28,
    )
    const nextZ = THREE.MathUtils.clamp(
      this.clawPosition.z + this.driveVelocity.z * delta,
      -0.94,
      0.96,
    )
    if (nextX === -1.28 || nextX === 1.28) this.driveVelocity.x = 0
    if (nextZ === -0.94 || nextZ === 0.96) this.driveVelocity.z = 0
    this.clawPosition.x = nextX
    this.clawPosition.z = nextZ
  }

  private updateClawAnimation(): void {
    const phaseFraction = phaseProgress(this.round)
    const progress = smoothStep(phaseFraction)
    const phase = this.round.phase
    let headY: number = CLAW_TOP_Y
    const prongOpen = clawOpeningForPhase(
      phase,
      phase === 'lowering' ? phaseFraction : progress,
      this.carried,
      this.tiltPlan ? TILT_GRIP_OPENING : PRIZE_GRIP_OPENING,
    )

    if (phase === 'lowering') {
      headY = THREE.MathUtils.lerp(CLAW_TOP_Y, CLAW_LOW_Y, clawDescentProgress(phaseFraction))
    } else if (phase === 'closing') {
      headY = CLAW_LOW_Y
    } else if (phase === 'lifting') {
      headY = THREE.MathUtils.lerp(CLAW_LOW_Y, CLAW_TOP_Y, progress)
    } else if (phase === 'returning') {
      this.clawPosition.x = THREE.MathUtils.lerp(this.cycleStart.x, CHUTE.x, progress)
      this.clawPosition.z = THREE.MathUtils.lerp(this.cycleStart.z, CHUTE.z, progress)
    }

    this.gantry.bridge.position.z = this.clawPosition.z
    this.gantry.carriage.position.set(this.clawPosition.x, 0, this.clawPosition.z)
    const ropeLength = ROPE_ANCHOR_Y - headY
    this.articulatedClaw.setGantryPosition(this.clawPosition.x, this.clawPosition.z)
    this.articulatedClaw.setCableLength(ropeLength)
    this.articulatedClaw.setOpening(prongOpen)

  }

  private handlePhaseChange(previous: RoundPhase, next: RoundPhase): void {
    if (previous === 'closing' && next === 'lifting') this.tryPickup()
    if (previous === 'returning' && next === 'releasing') this.releasePrize()
  }

  private tryPickup(): void {
    const position = this.prize.body.translation()
    const grabPosition = this.articulatedClaw.getGrabPose()
    const caught = this.tiltPlan
      ? canTiltPickup(position, this.articulatedClaw.getFingerTipPositions())
      : canPickupPrize(position, grabPosition)
    if (!caught) return

    this.carried = true
    this.lastGrabSucceeded = true
    this.prizeCarry.capture(grabPosition)
  }

  private releasePrize(): void {
    if (!this.carried) return
    this.carried = false
    this.prizeCarry.release()
    this.prize.body.setLinvel({ x: 0, y: -0.25, z: 0 }, true)
    this.prize.body.setAngvel(prizeReleaseAngularVelocity(), true)
  }

  private updatePhysics(delta: number): void {
    const substeps = 3
    this.world.timestep = delta / substeps
    const returnProgress = this.round.phase === 'returning'
      ? smoothStep(phaseProgress(this.round))
      : 0
    const centerStrength = returnProgress > 0 ? 4 + returnProgress * 8 : 0
    for (let step = 0; step < substeps; step += 1) {
      if (this.tiltPlan) {
        this.articulatedClaw.applyTiltToward(
          this.tiltPlan.directionX,
          this.tiltPlan.directionZ,
          this.tiltPlan.angle * tiltAmountForPhase(this.round.phase, phaseProgress(this.round)),
          this.world.timestep,
        )
      }
      this.world.step()
      this.articulatedClaw.stabilizeSwing()
      if (this.carried) {
        if (centerStrength > 0) {
          this.articulatedClaw.settleSwing(this.world.timestep, centerStrength)
        }
        this.prizeCarry.follow(
          this.articulatedClaw.getGrabPose(),
          this.world.timestep,
          centerStrength,
        )
      }
    }
    this.articulatedClaw.updateVisuals()

    const translation = this.prize.body.translation()
    const rotation = this.prize.body.rotation()
    this.prize.mesh.position.set(translation.x, translation.y, translation.z)
    this.prize.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  private checkForWin(): void {
    if (this.carried || this.round.phase === 'won' || this.round.phase === 'lost') return
    if (this.round.phase !== 'releasing' && this.round.phase !== 'resetting') return

    const position = this.prize.body.translation()
    if (isPrizeCaptured(position, CHUTE)) {
      this.round = stepRound(this.round, { type: 'PRIZE_DROPPED' })
      this.publishSnapshot()
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xe7fbff, 0x172b3d, 3.15))

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

    const cabinetFill = new THREE.RectAreaLight(0xfff7eb, 8.5, 4.1, 2.7)
    cabinetFill.position.set(0, 3.42, 0.15)
    cabinetFill.rotation.x = -Math.PI / 2
    this.scene.add(cabinetFill)
  }

  private addCabinet(): void {
    const frameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xfbf9f2,
      emissive: 0x6c7880,
      emissiveIntensity: 0.1,
      roughness: 0.22,
      metalness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
    })
    const baseMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x172e49,
      roughness: 0.3,
      metalness: 0.52,
      clearcoat: 0.42,
      clearcoatRoughness: 0.32,
    })
    const insetMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x17344a,
      roughness: 0.28,
      metalness: 0.38,
      clearcoat: 0.58,
      clearcoatRoughness: 0.24,
    })
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4b7180, roughness: 0.36, metalness: 0.16 })
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf1ffff,
      transparent: true,
      opacity: 0.035,
      roughness: 0.06,
      metalness: 0,
      transmission: 0,
      thickness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      ior: 1.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    const machineHalfX = 1.91
    const machineHalfZ = 1.675
    const openingMinX = CHUTE.x - CHUTE_OPENING_HALF_X
    const openingMaxX = CHUTE.x + CHUTE_OPENING_HALF_X
    const openingMinZ = CHUTE.z - CHUTE_OPENING_HALF_Z
    const openingMaxZ = CHUTE.z + CHUTE_OPENING_HALF_Z
    const openingWidth = CHUTE_OPENING_HALF_X * 2
    const floorPanels: Array<{
      size: [number, number, number]
      position: [number, number, number]
    }> = [
      {
        size: [openingMinX + machineHalfX, 0.16, machineHalfZ * 2],
        position: [(-machineHalfX + openingMinX) / 2, -0.08, 0],
      },
      {
        size: [machineHalfX - openingMaxX, 0.16, machineHalfZ * 2],
        position: [(openingMaxX + machineHalfX) / 2, -0.08, 0],
      },
      {
        size: [openingWidth, 0.16, openingMinZ + machineHalfZ],
        position: [CHUTE.x, -0.08, (-machineHalfZ + openingMinZ) / 2],
      },
      {
        size: [openingWidth, 0.16, machineHalfZ - openingMaxZ],
        position: [CHUTE.x, -0.08, (openingMaxZ + machineHalfZ) / 2],
      },
    ]
    for (const panel of floorPanels) {
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(panel.size[0], panel.size[1], panel.size[2]),
        floorMaterial,
      )
      floor.position.set(panel.position[0], panel.position[1], panel.position[2])
      floor.receiveShadow = true
      this.scene.add(floor)
      this.addStaticCollider(
        { x: panel.size[0] / 2, y: panel.size[1] / 2, z: panel.size[2] / 2 },
        { x: panel.position[0], y: panel.position[1], z: panel.position[2] },
      )
    }

    const roof = new THREE.Mesh(new RoundedBoxGeometry(3.96, 0.22, 3.5, 3, 0.06), frameMaterial)
    roof.position.y = MACHINE_DIMENSIONS.roofY
    this.scene.add(roof)

    for (const x of [-1.89, 1.89]) {
      for (const z of [-1.62, 1.62]) {
        const post = new THREE.Mesh(new RoundedBoxGeometry(0.17, 4.2, 0.17, 3, 0.045), frameMaterial)
        post.position.set(x, 2.08, z)
        this.scene.add(post)
      }
    }

    const addLightStrip = (
      size: [number, number, number],
      position: [number, number, number],
      color: number,
      normal: [number, number, number],
    ): void => {
      const channelSize: [number, number, number] = size.map((value) => value + 0.045) as [number, number, number]
      const glowSize: [number, number, number] = size.map((value) => value < 0.12 ? value * 1.9 : value) as [number, number, number]
      const channel = new THREE.Mesh(
        new RoundedBoxGeometry(...channelSize, 2, 0.025),
        new THREE.MeshStandardMaterial({ color: 0x17212b, roughness: 0.26, metalness: 0.82 }),
      )
      channel.position.set(...position)

      const offsetPosition: [number, number, number] = [
        position[0] + normal[0] * 0.07,
        position[1] + normal[1] * 0.07,
        position[2] + normal[2] * 0.07,
      ]
      const lightColor = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.34)
      const strip = new THREE.Mesh(
        new RoundedBoxGeometry(...size, 3, 0.018),
        new THREE.MeshPhysicalMaterial({
          color: lightColor,
          emissive: color,
          emissiveIntensity: 3.4,
          roughness: 0.18,
          metalness: 0,
          transmission: 0.26,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          toneMapped: false,
        }),
      )
      strip.position.set(...offsetPosition)

      const glow = new THREE.Mesh(
        new RoundedBoxGeometry(...glowSize, 2, 0.02),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      )
      glow.position.set(
        offsetPosition[0] + normal[0] * 0.022,
        offsetPosition[1] + normal[1] * 0.022,
        offsetPosition[2] + normal[2] * 0.022,
      )
      this.scene.add(channel, strip, glow)
    }

    addLightStrip([0.055, 3.84, 0.055], [-1.8, 2.08, 1.705], COLORS.aqua, [0, 0, 1])
    addLightStrip([0.055, 3.84, 0.055], [1.8, 2.08, 1.705], COLORS.pink, [0, 0, 1])
    addLightStrip([0.055, 3.84, 0.055], [-1.8, 2.08, -1.655], COLORS.pink, [0, 0, -1])
    addLightStrip([0.055, 3.84, 0.055], [1.8, 2.08, -1.655], COLORS.aqua, [0, 0, -1])
    addLightStrip([1.7, 0.055, 0.055], [-0.9, 4.14, 1.705], COLORS.pink, [0, 0, 1])
    addLightStrip([1.7, 0.055, 0.055], [0.9, 4.14, 1.705], COLORS.aqua, [0, 0, 1])
    addLightStrip([0.055, 0.055, 3.08], [-1.915, 4.14, 0], COLORS.pink, [-1, 0, 0])
    addLightStrip([0.055, 0.055, 3.08], [1.915, 4.14, 0], COLORS.aqua, [1, 0, 0])
    addLightStrip([1.7, 0.045, 0.055], [-0.9, 0.08, 1.705], COLORS.aqua, [0, 0, 1])
    addLightStrip([1.7, 0.045, 0.055], [0.9, 0.08, 1.705], COLORS.pink, [0, 0, 1])

    const leftGlow = new THREE.PointLight(COLORS.aqua, 10, 3.6)
    leftGlow.position.set(-1.75, 2.25, 2)
    const rightGlow = new THREE.PointLight(COLORS.pink, 10, 3.6)
    rightGlow.position.set(1.75, 2.25, 2)
    this.scene.add(leftGlow, rightGlow)

    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.72, MACHINE_DIMENSIONS.glassHeight), glassMaterial)
    back.position.set(0, 2.05, -1.58)
    this.scene.add(back)

    const left = new THREE.Mesh(new THREE.PlaneGeometry(3.25, MACHINE_DIMENSIONS.glassHeight), glassMaterial)
    left.rotation.y = Math.PI / 2
    left.position.set(-1.86, 2.05, 0)
    this.scene.add(left)

    const right = left.clone()
    right.position.x = 1.86
    this.scene.add(right)

    const chute = new THREE.Mesh(
      new THREE.BoxGeometry(
        CHUTE_OPENING_HALF_X * 2,
        0.025,
        CHUTE_OPENING_HALF_Z * 2,
      ),
      new THREE.MeshStandardMaterial({ color: 0x07121d, roughness: 0.48, metalness: 0.24 }),
    )
    chute.position.set(
      CHUTE.x,
      MACHINE_DIMENSIONS.chuteBottomY + MACHINE_DIMENSIONS.chuteBottomHalfThickness,
      CHUTE.z,
    )
    this.scene.add(chute)

    const chuteWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a1724,
      roughness: 0.42,
      metalness: 0.36,
    })
    const chuteWell: Array<{
      size: [number, number, number]
      position: [number, number, number]
    }> = [
      {
        size: [CHUTE_OPENING_HALF_X * 2, MACHINE_DIMENSIONS.chuteWellDepth, 0.08],
        position: [CHUTE.x, -MACHINE_DIMENSIONS.chuteWellDepth / 2, CHUTE.z - CHUTE_OPENING_HALF_Z - 0.04],
      },
      {
        size: [CHUTE_OPENING_HALF_X * 2, MACHINE_DIMENSIONS.chuteWellDepth, 0.08],
        position: [CHUTE.x, -MACHINE_DIMENSIONS.chuteWellDepth / 2, CHUTE.z + CHUTE_OPENING_HALF_Z + 0.04],
      },
      {
        size: [0.08, MACHINE_DIMENSIONS.chuteWellDepth, CHUTE_OPENING_HALF_Z * 2],
        position: [CHUTE.x - CHUTE_OPENING_HALF_X - 0.04, -MACHINE_DIMENSIONS.chuteWellDepth / 2, CHUTE.z],
      },
      {
        size: [0.08, MACHINE_DIMENSIONS.chuteWellDepth, CHUTE_OPENING_HALF_Z * 2],
        position: [CHUTE.x + CHUTE_OPENING_HALF_X + 0.04, -MACHINE_DIMENSIONS.chuteWellDepth / 2, CHUTE.z],
      },
    ]
    for (const wall of chuteWell) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.size[0], wall.size[1], wall.size[2]),
        chuteWallMaterial,
      )
      mesh.position.set(wall.position[0], wall.position[1], wall.position[2])
      this.scene.add(mesh)
      this.addStaticCollider(
        { x: wall.size[0] / 2, y: wall.size[1] / 2, z: wall.size[2] / 2 },
        { x: wall.position[0], y: wall.position[1], z: wall.position[2] },
      )
    }
    this.addStaticCollider(
      {
        x: CHUTE_OPENING_HALF_X,
        y: MACHINE_DIMENSIONS.chuteBottomHalfThickness,
        z: CHUTE_OPENING_HALF_Z,
      },
      { x: CHUTE.x, y: MACHINE_DIMENSIONS.chuteBottomY, z: CHUTE.z },
    )

    const chuteFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(
        CHUTE_OPENING_HALF_X * 2 + 0.04,
        0.08,
        CHUTE_OPENING_HALF_Z * 2 + 0.04,
      )),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    )
    chuteFrame.position.set(CHUTE.x, 0.05, CHUTE.z)
    this.scene.add(chuteFrame)

    const lowerCabinetCenterY = -0.08 - MACHINE_DIMENSIONS.lowerCabinetHeight / 2
    const plinth = new THREE.Mesh(
      new RoundedBoxGeometry(4.04, MACHINE_DIMENSIONS.lowerCabinetHeight, 3.65, 4, 0.12),
      frameMaterial,
    )
    plinth.position.y = lowerCabinetCenterY
    plinth.castShadow = true
    this.scene.add(plinth)

    const frontPanel = new THREE.Mesh(
      new RoundedBoxGeometry(3.62, MACHINE_DIMENSIONS.lowerCabinetHeight - 0.28, 0.1, 4, 0.07),
      insetMaterial,
    )
    frontPanel.position.set(0, lowerCabinetCenterY, 1.88)
    this.scene.add(frontPanel)

    addLightStrip([1.48, 0.055, 0.04], [-0.82, -0.22, 1.91], COLORS.pink, [0, 0, 1])
    addLightStrip([1.48, 0.055, 0.04], [0.82, -0.22, 1.91], COLORS.aqua, [0, 0, 1])
    addLightStrip([0.045, 1.12, 0.04], [-1.77, lowerCabinetCenterY, 1.94], COLORS.aqua, [0, 0, 1])
    addLightStrip([0.045, 1.12, 0.04], [1.77, lowerCabinetCenterY, 1.94], COLORS.pink, [0, 0, 1])
    addLightStrip([1.48, 0.045, 0.04], [-0.82, -1.47, 1.94], COLORS.pink, [0, 0, 1])
    addLightStrip([1.48, 0.045, 0.04], [0.82, -1.47, 1.94], COLORS.aqua, [0, 0, 1])

    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.025),
      new THREE.MeshStandardMaterial({
        color: COLORS.warm,
        emissive: COLORS.warm,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      }),
    )
    badge.position.set(0.94, lowerCabinetCenterY, 1.915)
    this.scene.add(badge)

    const prizeDoorBezel = new THREE.Mesh(
      new RoundedBoxGeometry(1.34, 0.84, 0.09, 4, 0.07),
      frameMaterial,
    )
    prizeDoorBezel.position.set(-0.92, lowerCabinetCenterY - 0.04, 1.95)
    this.scene.add(prizeDoorBezel)

    const prizeDoorInset = new THREE.Mesh(
      new RoundedBoxGeometry(1.06, 0.56, 0.035, 3, 0.045),
      new THREE.MeshStandardMaterial({
        color: 0x081725,
        emissive: COLORS.aqua,
        emissiveIntensity: 0.2,
        roughness: 0.36,
        metalness: 0.2,
      }),
    )
    prizeDoorInset.position.set(-0.92, lowerCabinetCenterY - 0.04, 2.01)
    this.scene.add(prizeDoorInset)

    const coinPanel = new THREE.Mesh(
      new RoundedBoxGeometry(0.76, 0.86, 0.085, 4, 0.065),
      frameMaterial,
    )
    coinPanel.position.set(0.94, lowerCabinetCenterY - 0.02, 1.95)
    this.scene.add(coinPanel)

    const coinPanelInset = new THREE.Mesh(
      new RoundedBoxGeometry(0.56, 0.66, 0.035, 3, 0.04),
      baseMaterial,
    )
    coinPanelInset.position.set(0.94, lowerCabinetCenterY - 0.02, 2.01)
    this.scene.add(coinPanelInset)

    const coinSlot = new THREE.Mesh(
      new RoundedBoxGeometry(0.3, 0.065, 0.025, 2, 0.02),
      new THREE.MeshStandardMaterial({
        color: COLORS.warm,
        emissive: COLORS.warm,
        emissiveIntensity: 0.5,
        roughness: 0.28,
      }),
    )
    coinSlot.position.set(0.94, lowerCabinetCenterY - 0.18, 2.045)
    this.scene.add(coinSlot)
  }

  private createPrize(): Prize {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(PRIZE_START.x, PRIZE_START.y, PRIZE_START.z)
        .setLinearDamping(0.35)
        .setAngularDamping(3.2),
    )
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(PRIZE_HALF_WIDTH, PRIZE_HALF_HEIGHT, PRIZE_HALF_DEPTH)
        .setRestitution(0.15)
        .setFriction(0.8),
      body,
    )

    const mesh = createPrizeModel()
    const prizeGlow = new THREE.PointLight(COLORS.pink, 2.8, 2.2)
    prizeGlow.position.y = PRIZE_HALF_HEIGHT + 0.07
    mesh.add(prizeGlow)
    this.scene.add(mesh)

    return { body, collider, mesh }
  }

  private addAmbientStars(): void {
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
      status: this.round.phase === 'aiming' && tiltPlanForAim(this.clawPosition, this.prize.body.translation())
        ? '偏側下爪：可試試倒爪！'
        : this.round.phase === 'lowering' && this.tiltPlan
          ? '倒爪中：一爪在上、兩爪往側下方…'
          : statusForPhase(this.round.phase),
      timeLeft: this.round.timeLeft,
    })
  }

  private resize(): void {
    const canvas = this.renderer.domElement
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.orbitRadius = this.camera.aspect < 1
      ? THREE.MathUtils.clamp(7 / this.camera.aspect, 13.2, 15)
      : 11.4
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
    aiming: '移動搖桿，讓夾爪對準娃娃',
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
