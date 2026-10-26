import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

import {
  createRound,
  phaseDurations,
  phaseProgress,
  stepRound,
  type RoundPhase,
  type RoundState,
} from './round'
import { dragOrbit, orbitPosition, type OrbitState } from './orbit'
import { banterFor, type BanterLine } from './banter'
import { approachVelocity, type PlanarMotion } from './clawMotion'
import { clawHeadHeight, clawOpeningForPhase } from './clawPose'
import { ArticulatedClaw } from './ArticulatedClaw'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { PrizeCarryController } from './PrizeCarryController'
import {
  CAPTURE_QUALITY, DROP_STRENGTH, evaluateGrip, nextGripStrength, normalGripHeight,
  PLUSH_HALF_SEGMENT, PLUSH_RADIUS, transportStress,
} from './gripMechanics'
import {
  CHUTE_OPENING_HALF_X,
  CHUTE_OPENING_HALF_Z,
  isPrizeCaptured,
  isPrizeEnteringChute,
  isPrizeStuckAtChute,
  prizeReleaseAngularVelocity,
  PRIZE_GRIP_OPENING,
  PRIZE_HALF_HEIGHT,
} from './prizeInteraction'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { createAlienModel } from './alienModel'
import { selectPrizeForAim } from './prizeSelection'
import { createGantryAssembly } from './gantry'
import { createArcadeRoom } from './arcadeRoom'
import { createSideStickers } from './sideStickers'
import { chooseClerkPlacement, findClerkSwapIndex } from './clerkAssist'
import {
  TILT_GRIP_OPENING,
  tiltAmountForPhase,
  tiltPlanForAim,
  type TiltPlan,
} from './tiltGrab'

export interface GameSnapshot {
  attempts: number
  banter: BanterLine
  canGrab: boolean
  grabLabel: '出爪' | '二收'
  isReady: boolean
  result?: 'won' | 'lost'
  status: string
  timeLeft: number
}

interface Prize {
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  colliders: RAPIER.Collider[]
  mesh: THREE.Group
  carry: PrizeCarryController
  start: PrizePlacement
  claimed: boolean
}

interface PrizePlacement {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
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
const PRIZE_EXIT_Y = -1.05
const PRIZE_EXIT_MIN_SECONDS = 0.18
const PRIZE_EXIT_MAX_SECONDS = 0.65
const CHUTE_GUARD_HEIGHT = PRIZE_HALF_HEIGHT * 2 / 3
function prizePlacement(
  x: number, y: number, z: number,
  tiltX = 0, yaw = 0, tiltZ = 0,
): PrizePlacement {
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, tiltZ))
  return { position: { x, y, z }, rotation }
}

export const INITIAL_PRIZE_PLACEMENTS = [
  prizePlacement(0.48, 0.62, -0.18),
  prizePlacement(-0.2, 0.62, -1.14, 0, 0.3),
  prizePlacement(1.18, 0.43, -1.12, 0, 0, Math.PI / 2),
  prizePlacement(0.15, 0.68, 0.8, 0.2, 0.5),
  prizePlacement(1.12, 0.62, 0.68, 0, 0.22),
  prizePlacement(-1.25, 0.62, -0.35, 0, -0.32),
] as const
export const PRIZE_NAMES = ['哆啦A夢', '風速狗', '史努比', '呆呆獸', '妙蛙種子', '三眼怪'] as const
// Round, bulky plushes retain less grip; these tune difficulty without rolling a win probability.
const PRIZE_GRIP_PROFILES = [
  { retention: 0.92, mass: 0.55 },
  { retention: 0.9, mass: 0.6 },
  { retention: 0.98, mass: 0.35 },
  { retention: 0.84, mass: 0.8 },
  { retention: 0.82, mass: 0.75 },
  { retention: 0.94, mass: 0.45 },
] as const
const ROPE_ANCHOR_Y = MACHINE_DIMENSIONS.ropeAnchorY
const PHYSICS_STEP = 1 / 120
const MAX_PHYSICS_STEPS = 6

export class ClawMachineGame {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  private readonly renderer: THREE.WebGLRenderer
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  private readonly timer = new THREE.Timer()
  private readonly gantry = createGantryAssembly()
  private readonly articulatedClaw: ArticulatedClaw
  private readonly prizes: Prize[]
  private readonly onSnapshot: (snapshot: GameSnapshot) => void
  private readonly resizeObserver: ResizeObserver
  private readonly canvas: HTMLCanvasElement
  private readonly compactDisplay: boolean
  private prizePortraits?: string[]
  private frameCallbacks: Array<() => void> = []

  private round: RoundState = createRound()
  private movement = { x: 0, z: 0 }
  private clawPosition = { ...CHUTE }
  private cycleStart = { ...CHUTE }
  private closingHeight: number = CLAW_LOW_Y
  private driveVelocity: PlanarMotion = { x: 0, z: 0 }
  private carried = false
  private lastGrabSucceeded = false
  private enteredChute = false
  private running = false
  private paused = false
  private lastPublishedSecond = -1
  private lastPhase: RoundPhase = 'aiming'
  private orbit: OrbitState = { yaw: 0.08, pitch: 0.24 }
  private orbitRadius = 10
  private cameraDrag?: { pointerId: number; x: number; y: number }
  private tiltPlan?: TiltPlan
  private activePrize?: Prize
  private pendingPrizeExit?: { prize: Prize; elapsed: number }
  private stalePrizes = new Set<Prize>()
  private gripQuality = 0
  private gripStrength = 0
  private gripMass = 0.5
  private slipped = false
  private physicsRemainder = 0

  private constructor(canvas: HTMLCanvasElement, onSnapshot: (snapshot: GameSnapshot) => void) {
    this.canvas = canvas
    this.onSnapshot = onSnapshot
    this.compactDisplay = Math.min(window.innerWidth, window.innerHeight) <= 600
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.compactDisplay ? 1.5 : 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.3

    this.scene.background = new THREE.Color(0x536e77)
    this.camera.position.set(5.9, 4.6, 7.8)
    this.camera.lookAt(0, 1.6, 0)

    this.addLights()
    this.scene.add(createArcadeRoom())
    this.addCabinet()
    this.scene.add(this.gantry.root)
    this.articulatedClaw = new ArticulatedClaw(this.world, this.scene, {
      anchorY: ROPE_ANCHOR_Y,
      headY: CLAW_TOP_Y,
      x: CHUTE.x,
      z: CHUTE.z,
    })
    this.prizes = [
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[0], createPrizeModel(), COLORS.pink),
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[1], createArcanineModel(), COLORS.warm, 0.35),
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[2], createSnoopyModel(), COLORS.aqua, 0.35),
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[3], createSlowpokeModel(), COLORS.warm, 0.25, 'slowpoke'),
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[4], createBulbasaurModel(), COLORS.aqua, 0.3),
      this.createPrize(INITIAL_PRIZE_PLACEMENTS[5], createAlienModel(), COLORS.warm, 0.25),
    ]
    this.settleInitialPrizes()

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

  private settleInitialPrizes(): void {
    // Resolve gravity, floor contact and neighboring plushes before the first visible frame.
    this.articulatedClaw.setOpening(0)
    this.world.timestep = 1 / 60
    for (let step = 0; step < 600; step += 1) {
      this.world.step()
      this.articulatedClaw.stabilizeSwing()
      if (this.prizes.every((prize) => prize.body.isSleeping())) break
    }
    for (const prize of this.prizes) {
      const position = prize.body.translation()
      const rotation = prize.body.rotation()
      prize.start = { position: { ...position }, rotation: { ...rotation } }
      prize.mesh.position.set(position.x, position.y, position.z)
      prize.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }
    this.articulatedClaw.updateVisuals()
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.timer.reset()
    this.renderer.setAnimationLoop(() => this.update())
  }

  onNextRenderedFrame(callback: () => void): void {
    this.frameCallbacks ??= []
    this.frameCallbacks.push(callback)
  }

  setPaused(paused: boolean): void {
    this.paused = paused
  }

  setMovement(x: number, z: number): void {
    this.movement.x = x
    this.movement.z = z
  }

  grab(): void {
    if (this.round.phase === 'lowering') {
      this.closingHeight = clawHeadHeight('lowering', phaseProgress(this.round), this.closingHeight)
      this.round = stepRound(this.round, { type: 'SECOND_GRAB' })
      this.publishSnapshot()
      return
    }
    if (this.round.phase !== 'aiming') return
    this.closingHeight = CLAW_LOW_Y
    this.lastGrabSucceeded = false
    this.enteredChute = false
    this.slipped = false
    this.gripStrength = 0
    this.cycleStart = { ...this.clawPosition }
    const prizeIndex = selectPrizeForAim(
      this.clawPosition,
      this.prizes.map((prize) => prize.claimed || this.stalePrizes.has(prize)
        ? undefined : prize.body.translation()),
    )
    this.activePrize = prizeIndex === undefined ? undefined : this.prizes[prizeIndex]
    this.tiltPlan = this.activePrize
      ? tiltPlanForAim(this.clawPosition, this.activePrize.body.translation())
      : undefined
    if (this.activePrize && !this.tiltPlan) {
      this.closingHeight = normalGripHeight({
        position: this.activePrize.body.translation(), rotation: this.activePrize.body.rotation(),
      })
    }
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
    this.advancePrizeExit(PRIZE_EXIT_MAX_SECONDS)
    if (this.activePrize && !this.activePrize.claimed) {
      this.stalePrizes ??= new Set()
      this.stalePrizes.add(this.activePrize)
    }
    this.slipped = false
    this.gripStrength = 0
    this.round = createRound()
    this.lastPhase = 'aiming'
    this.carried = false
    this.lastGrabSucceeded = false
    this.enteredChute = false
    this.tiltPlan = undefined
    this.activePrize = undefined
    this.clawPosition = { ...CHUTE }
    this.cycleStart = { ...CHUTE }
    this.closingHeight = CLAW_LOW_Y
    this.driveVelocity = { x: 0, z: 0 }
    this.articulatedClaw.reset(CHUTE.x, CHUTE.z, ROPE_ANCHOR_Y - CLAW_TOP_Y)
    for (const prize of this.prizes) {
      prize.carry.release()
    }
    this.publishSnapshot()
  }

  resetPrizes(): void {
    if (this.round.phase !== 'ready') return
    this.pendingPrizeExit = undefined
    this.stalePrizes?.clear()
    for (const prize of this.prizes) {
      prize.claimed = false
      prize.mesh.visible = true
      prize.body.setEnabled(true)
      prize.carry.release()
      prize.body.setTranslation(prize.start.position, true)
      prize.body.setRotation(prize.start.rotation, true)
      prize.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      prize.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      prize.mesh.position.set(
        prize.start.position.x, prize.start.position.y, prize.start.position.z,
      )
      prize.mesh.quaternion.set(
        prize.start.rotation.x, prize.start.rotation.y, prize.start.rotation.z, prize.start.rotation.w,
      )
    }
    this.publishSnapshot()
  }

  availablePrizesForClerk(): Array<{ index: number; name: string }> {
    return this.prizes.flatMap((prize, index) =>
      prize.claimed ? [] : [{ index, name: PRIZE_NAMES[index]! }])
  }

  prizePortrait(index: number): string {
    if (!this.prizePortraits) this.prizePortraits = this.renderPrizePortraits()
    return this.prizePortraits[index] ?? ''
  }

  private renderPrizePortraits(): string[] {
    const size = 160
    const target = new THREE.WebGLRenderTarget(size, size)
    const pixels = new Uint8Array(size * size * 4)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')!
    const image = context.createImageData(size, size)
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 2.1))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(-2, 4, 5)
    scene.add(keyLight)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20)
    camera.position.set(0.3, 0.2, 6)
    camera.lookAt(0, 0, 0)
    const previousTarget = this.renderer.getRenderTarget()
    const previousColor = this.renderer.getClearColor(new THREE.Color())
    const previousAlpha = this.renderer.getClearAlpha()
    const portraits: string[] = []

    try {
      this.renderer.setClearColor(0x000000, 0)
      this.renderer.setRenderTarget(target)
      for (const prize of this.prizes) {
        const model = prize.mesh.clone(true)
        model.position.set(0, 0, 0)
        model.quaternion.identity()
        model.traverse((part) => { if (part instanceof THREE.Light) part.visible = false })
        const bounds = new THREE.Box3().setFromObject(model)
        const center = bounds.getCenter(new THREE.Vector3())
        const extent = bounds.getSize(new THREE.Vector3())
        const scale = 1.7 / Math.max(extent.x, extent.y)
        const frame = new THREE.Group()
        model.position.sub(center)
        frame.scale.setScalar(scale)
        frame.add(model)
        scene.add(frame)
        this.renderer.render(scene, camera)
        this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels)
        for (let y = 0; y < size; y += 1) {
          const source = (size - 1 - y) * size * 4
          image.data.set(pixels.subarray(source, source + size * 4), y * size * 4)
        }
        context.putImageData(image, 0, 0)
        portraits.push(canvas.toDataURL('image/png'))
        scene.remove(frame)
      }
    } finally {
      this.renderer.setRenderTarget(previousTarget)
      this.renderer.setClearColor(previousColor, previousAlpha)
      target.dispose()
    }

    return portraits
  }

  placePrizeForClerk(index: number): { type: 'swapped'; displaced: string } | { type: 'placed' } | undefined {
    const prize = this.prizes[index]
    if ((this.round.phase !== 'lost' && this.round.phase !== 'ready') || !prize || prize.claimed) return undefined
    const positions = this.prizes.map((entry) => entry.claimed ? undefined : entry.body.translation())
    const swapIndex = findClerkSwapIndex(index, positions)
    if (swapIndex !== undefined) {
      const neighbor = this.prizes[swapIndex]!
      const selectedPose = { position: { ...prize.body.translation() }, rotation: { ...prize.body.rotation() } }
      const neighborPose = { position: { ...neighbor.body.translation() }, rotation: { ...neighbor.body.rotation() } }
      this.setPrizePose(prize, neighborPose.position, neighborPose.rotation)
      this.setPrizePose(neighbor, selectedPose.position, selectedPose.rotation)
      return { type: 'swapped', displaced: PRIZE_NAMES[swapIndex]! }
    }
    const neighbors = this.prizes.filter((other) => other !== prize && !other.claimed)
      .map((other) => other.body.translation())
    const destination = chooseClerkPlacement(neighbors)
    const upright = { x: 0, y: 0, z: 0, w: 1 }

    this.setPrizePose(prize, destination, upright)
    return { type: 'placed' }
  }

  rescueStuckPrizeForClerk(): string | undefined {
    if (!this.hasStuckPrizeAtChute() || !this.activePrize) return undefined
    const prize = this.activePrize
    if (!isPrizeStuckAtChute(prize.body.translation(), prize.body.linvel(), CHUTE)) return undefined
    prize.claimed = true
    prize.carry.release()
    this.setPrizeSensor(prize, true)
    prize.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    prize.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    prize.body.setEnabled(false)
    prize.mesh.visible = false
    this.round = stepRound(this.round, { type: 'CLERK_RESCUE' })
    this.publishSnapshot()
    return PRIZE_NAMES[this.prizes.indexOf(prize)]
  }

  hasStuckPrizeAtChute(): boolean {
    return this.round.phase === 'lost' && this.lastGrabSucceeded
      && !!this.activePrize && !this.activePrize.claimed
      && isPrizeStuckAtChute(this.activePrize.body.translation(), this.activePrize.body.linvel(), CHUTE)
  }

  private setPrizePose(
    prize: Prize,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number; w: number },
  ): void {
    prize.carry.release()
    prize.body.setTranslation(position, true)
    prize.body.setRotation(rotation, true)
    prize.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    prize.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    prize.mesh.position.set(position.x, position.y, position.z)
    prize.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
  }

  private update(): void {
    this.timer.update()
    const delta = Math.min(this.timer.getDelta(), 1 / 20)
    if (this.paused) {
      this.renderFrame()
      return
    }
    const previousPhase = this.round.phase

    this.round = stepRound(this.round, { type: 'TICK', deltaSeconds: delta })
    const pickupFrame = previousPhase === 'closing' && this.round.phase === 'lifting'
    if (this.round.phase !== previousPhase) this.handlePhaseChange(previousPhase, this.round.phase)

    if (this.round.phase === 'aiming') this.updatePlayerMovement(delta)
    else this.driveVelocity = approachVelocity(this.driveVelocity, { x: 0, z: 0 }, delta)
    this.updateClawAnimation(pickupFrame)
    this.updatePhysics(delta, pickupFrame)
    if (pickupFrame) this.tryPickup()
    this.advanceGrip(delta)
    this.clearStaleChutePrizes()
    this.checkForWin()
    this.advancePrizeExit(delta)

    const displayedSecond = Math.ceil(this.round.timeLeft)
    if (displayedSecond !== this.lastPublishedSecond || this.round.phase !== this.lastPhase) {
      this.publishSnapshot()
      this.lastPublishedSecond = displayedSecond
      this.lastPhase = this.round.phase
    }

    this.renderFrame()
  }

  private renderFrame(): void {
    this.renderer.render(this.scene, this.camera)
    if (this.frameCallbacks?.length) {
      for (const callback of this.frameCallbacks.splice(0)) callback()
    }
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

  private updateClawAnimation(pickupFrame = false): void {
    const phaseFraction = pickupFrame ? 1 : phaseProgress(this.round)
    const progress = smoothStep(phaseFraction)
    const phase = pickupFrame ? 'closing' : this.round.phase
    const headY = clawHeadHeight(phase, phaseFraction, this.closingHeight)
    const holdingOpening = (this.tiltPlan ? TILT_GRIP_OPENING : PRIZE_GRIP_OPENING)
      + (this.carried ? Math.max(0, 0.4 - this.gripStrength) * 0.25 : 0)
    const prongOpen = clawOpeningForPhase(
      phase,
      phase === 'lowering' ? phaseFraction : progress,
      this.carried || this.slipped,
      this.slipped ? 0.72 : holdingOpening,
    )

    if (phase === 'returning') {
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
    if (previous === 'returning' && next === 'releasing') this.releasePrize()
  }

  private tryPickup(): void {
    const grabPosition = this.articulatedClaw.getGrabPose()
    const tips = this.articulatedClaw.getFingerTipPositions()
    let selected: Prize | undefined
    let bestQuality = 0
    for (const prize of this.prizes) {
      if (prize.claimed || this.stalePrizes?.has(prize)) continue
      const quality = evaluateGrip(
        { position: prize.body.translation(), rotation: prize.body.rotation() },
        grabPosition, tips, prize === this.activePrize && this.tiltPlan ? 'tilt' : 'normal',
      )
      if (quality > bestQuality) {
        selected = prize
        bestQuality = quality
      }
    }
    if (!selected || bestQuality < CAPTURE_QUALITY) return
    if (selected !== this.activePrize) this.tiltPlan = undefined
    this.activePrize = selected
    const profile = PRIZE_GRIP_PROFILES[this.prizes.indexOf(selected)] ?? PRIZE_GRIP_PROFILES[0]
    this.gripQuality = bestQuality
    this.gripStrength = bestQuality * profile.retention
    this.gripMass = profile.mass

    this.carried = true
    this.lastGrabSucceeded = true
    this.articulatedClaw.holdCurrentGrip()
    selected.carry.capture(grabPosition)
  }

  private advanceGrip(delta: number): void {
    if (!this.carried || !this.activePrize
      || (this.round.phase !== 'lifting' && this.round.phase !== 'returning')) return
    const progress = phaseProgress(this.round)
    const head = this.articulatedClaw.getHeadPosition()
    const returning = this.round.phase === 'returning'
    const travel = returning ? Math.hypot(CHUTE.x - this.cycleStart.x, CHUTE.z - this.cycleStart.z) / 2.4 : 0.9
    this.gripStrength = nextGripStrength(this.gripStrength, delta, transportStress({
      quality: this.gripQuality,
      mass: this.gripMass,
      acceleration: Math.abs(1 - 2 * progress) * travel,
      swing: Math.hypot(head.x - this.clawPosition.x, head.z - this.clawPosition.z) / 0.34,
    }))
    this.activePrize.carry.loosen(delta * Math.max(0, 0.4 - this.gripStrength) * 0.45)
    if (this.gripStrength > DROP_STRENGTH) return

    this.carried = false
    this.slipped = true
    this.articulatedClaw.releaseGrip()
    this.activePrize.carry.release()
    // Carry the travel momentum into the fall, so a late slip can still reach the chute.
    const speed = returning ? 6 * progress * (1 - progress) / phaseDurations.returning! : 0
    this.activePrize.body.setLinvel({
      x: (CHUTE.x - this.cycleStart.x) * speed,
      y: -0.15,
      z: (CHUTE.z - this.cycleStart.z) * speed,
    }, true)
    this.activePrize.body.setAngvel({ x: 0.25, y: 0.35, z: -0.2 }, true)
    this.publishSnapshot()
  }

  private releasePrize(): void {
    if (!this.carried || !this.activePrize) return
    this.carried = false
    this.articulatedClaw.releaseGrip()
    this.activePrize.carry.release()
    this.enteredChute = false
    this.activePrize.body.setLinvel({ x: 0, y: -0.25, z: 0 }, true)
    this.activePrize.body.setAngvel(prizeReleaseAngularVelocity(), true)
  }

  private updatePhysics(delta: number, forceStep = false): void {
    this.physicsRemainder = Math.min((this.physicsRemainder ?? 0) + delta, PHYSICS_STEP * MAX_PHYSICS_STEPS)
    this.world.timestep = PHYSICS_STEP
    const steps = Math.max(forceStep ? 1 : 0, Math.floor((this.physicsRemainder + 1e-9) / PHYSICS_STEP))
    this.physicsRemainder = Math.max(0, this.physicsRemainder - steps * PHYSICS_STEP)
    const returnProgress = this.round.phase === 'returning'
      ? smoothStep(phaseProgress(this.round))
      : 0
    const centerStrength = returnProgress > 0 ? 4 + returnProgress * 8 : 0
    for (let step = 0; step < steps; step += 1) {
      if (this.tiltPlan) {
        this.articulatedClaw.applyTiltToward(
          this.tiltPlan.directionX,
          this.tiltPlan.directionZ,
          this.tiltPlan.angle * tiltAmountForPhase(this.round.phase, phaseProgress(this.round)),
          this.world.timestep,
        )
      }
      this.world.step()
      if (!this.carried && this.lastGrabSucceeded && this.activePrize && !this.enteredChute
        && (this.round.phase === 'releasing' || this.round.phase === 'resetting' || this.slipped)
        && isPrizeEnteringChute(this.activePrize.body.translation(), CHUTE)) {
        this.setPrizeSensor(this.activePrize, true)
        this.enteredChute = true
      }
      this.articulatedClaw.stabilizeSwing()
      if (this.carried && this.activePrize) {
        if (centerStrength > 0) {
          this.articulatedClaw.settleSwing(this.world.timestep, centerStrength)
        }
        this.activePrize.carry.follow(
          this.articulatedClaw.getGrabPose(),
          this.world.timestep,
          centerStrength,
        )
      }
    }
    this.articulatedClaw.updateVisuals()

    for (const prize of this.prizes) {
      const translation = prize.body.translation()
      const rotation = prize.body.rotation()
      prize.mesh.position.set(translation.x, translation.y, translation.z)
      prize.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }
  }

  private checkForWin(): void {
    if (this.carried || this.round.phase === 'won' || this.round.phase === 'lost') return
    if (this.round.phase !== 'releasing' && this.round.phase !== 'resetting' && !this.slipped) return

    if (this.activePrize && !this.stalePrizes?.has(this.activePrize)
      && isPrizeCaptured(this.activePrize.body.translation(), CHUTE)) {
      this.activePrize.claimed = true
      // Leave the prize non-colliding while it visibly falls into the chute.
      this.setPrizeSensor(this.activePrize, true)
      this.pendingPrizeExit = { prize: this.activePrize, elapsed: 0 }
      this.round = stepRound(this.round, { type: 'PRIZE_DROPPED' })
      this.publishSnapshot()
    }
  }

  private clearStaleChutePrizes(): void {
    for (const prize of this.stalePrizes ?? []) {
      const position = prize.body.translation()
      if (isPrizeCaptured(position, CHUTE)) {
        prize.claimed = true
        prize.carry.release()
        prize.mesh.visible = false
        prize.body.setEnabled(false)
        this.stalePrizes.delete(prize)
      } else if (position.y < 0.95 && !isPrizeEnteringChute(position, CHUTE)) {
        const velocity = prize.body.linvel()
        if (Math.hypot(velocity.x, velocity.y, velocity.z) < 0.25) {
          this.stalePrizes.delete(prize)
        }
      }
    }
  }

  private advancePrizeExit(delta: number): void {
    const pending = this.pendingPrizeExit
    if (!pending) return
    pending.elapsed += delta
    if (pending.elapsed < PRIZE_EXIT_MIN_SECONDS) return
    if (pending.prize.body.translation().y > PRIZE_EXIT_Y
      && pending.elapsed < PRIZE_EXIT_MAX_SECONDS) return

    pending.prize.mesh.visible = false
    pending.prize.body.setEnabled(false)
    this.pendingPrizeExit = undefined
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xe7fbff, 0x172b3d, 3.15))

    const key = new THREE.DirectionalLight(0xffffff, 3.2)
    key.position.set(3, 7, 4)
    key.castShadow = true
    key.shadow.mapSize.set(this.compactDisplay ? 512 : 1024, this.compactDisplay ? 512 : 1024)
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
      opacity: 0.075,
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

    const front = new THREE.Mesh(new THREE.PlaneGeometry(3.72, MACHINE_DIMENSIONS.glassHeight), glassMaterial)
    front.position.set(0, 2.05, 1.72)
    this.scene.add(front)

    const paneEdgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8bb6c7,
      transparent: true,
      opacity: 0.5,
      roughness: 0.18,
      metalness: 0.55,
    })
    for (const edge of [
      { size: [3.72, 0.018, 0.018] as const, position: [0, 0.19, -1.585] as const },
      { size: [3.72, 0.018, 0.018] as const, position: [0, 0.19, 1.725] as const },
      { size: [0.018, 0.018, 3.25] as const, position: [-1.865, 0.19, 0] as const },
      { size: [0.018, 0.018, 3.25] as const, position: [1.865, 0.19, 0] as const },
    ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(edge.size[0], edge.size[1], edge.size[2]), paneEdgeMaterial)
      rail.position.set(edge.position[0], edge.position[1], edge.position[2])
      this.scene.add(rail)
    }

    // The panes are nearly invisible, but the physical chamber must still keep loose prizes inside.
    for (const wall of [
      { half: { x: 0.035, y: 1.98, z: 1.72 }, center: { x: -1.875, y: 1.98, z: 0 } },
      { half: { x: 0.035, y: 1.98, z: 1.72 }, center: { x: 1.875, y: 1.98, z: 0 } },
      { half: { x: 1.875, y: 1.98, z: 0.035 }, center: { x: 0, y: 1.98, z: -1.615 } },
      { half: { x: 1.875, y: 1.98, z: 0.035 }, center: { x: 0, y: 1.98, z: 1.715 } },
    ]) this.addStaticCollider(wall.half, wall.center)

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

    const chuteInterior = new THREE.Group()
    chuteInterior.name = 'chute-interior'
    const chuteWallMaterial = new THREE.MeshStandardMaterial({
      color: 0x142c3c,
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
    // Thin inset faces show the well's depth without sharing a plane with the cabinet shell.
    for (const face of [
      { width: openingWidth, x: CHUTE.x, z: openingMinZ + 0.012, yaw: 0 },
      { width: openingWidth, x: CHUTE.x, z: openingMaxZ - 0.012, yaw: Math.PI },
      { width: CHUTE_OPENING_HALF_Z * 2, x: openingMinX + 0.012, z: CHUTE.z, yaw: Math.PI / 2 },
      { width: CHUTE_OPENING_HALF_Z * 2, x: openingMaxX - 0.012, z: CHUTE.z, yaw: -Math.PI / 2 },
    ]) {
      const wallFace = new THREE.Mesh(
        new THREE.PlaneGeometry(face.width, MACHINE_DIMENSIONS.chuteWellDepth),
        chuteWallMaterial,
      )
      wallFace.position.set(face.x, -MACHINE_DIMENSIONS.chuteWellDepth / 2, face.z)
      wallFace.rotation.y = face.yaw
      chuteInterior.add(wallFace)
    }
    const wellLight = new THREE.PointLight(COLORS.aqua, 1.1, 2.1)
    wellLight.position.set(CHUTE.x, -0.9, CHUTE.z)
    chuteInterior.add(wellLight)
    this.scene.add(chuteInterior)

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

    // Clear acrylic panels are tall enough to make nudging a prize over the edge meaningful.
    const chuteLip = new THREE.Group()
    chuteLip.name = 'chute-lip'
    const acrylic = new THREE.MeshPhysicalMaterial({
      color: 0x9dd9ea,
      transparent: true,
      opacity: 0.32,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    for (const lip of [
      { size: [openingWidth + 0.06, CHUTE_GUARD_HEIGHT, 0.055] as const, position: [CHUTE.x, CHUTE_GUARD_HEIGHT / 2, openingMinZ - 0.025] as const },
      { size: [0.055, CHUTE_GUARD_HEIGHT, CHUTE_OPENING_HALF_Z * 2 + 0.06] as const, position: [openingMaxX + 0.025, CHUTE_GUARD_HEIGHT / 2, CHUTE.z] as const },
    ]) {
      const guard = new THREE.Mesh(new RoundedBoxGeometry(...lip.size, 3, 0.018), acrylic)
      guard.position.set(...lip.position)
      chuteLip.add(guard)
      this.addStaticCollider(
        { x: lip.size[0] / 2, y: lip.size[1] / 2, z: lip.size[2] / 2 },
        { x: lip.position[0], y: lip.position[1], z: lip.position[2] },
      )
    }
    this.scene.add(chuteLip)

    const lowerCabinetCenterY = -0.08 - MACHINE_DIMENSIONS.lowerCabinetHeight / 2
    const shell = new THREE.Group()
    shell.name = 'cabinet-shell'
    const shellPanels = [
      { minX: -2.02, maxX: openingMinX, minZ: -1.825, maxZ: 1.825 },
      { minX: openingMaxX, maxX: 2.02, minZ: -1.825, maxZ: 1.825 },
      { minX: openingMinX, maxX: openingMaxX, minZ: -1.825, maxZ: openingMinZ },
      { minX: openingMinX, maxX: openingMaxX, minZ: openingMaxZ, maxZ: 1.825 },
    ]
    for (const panel of shellPanels) {
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(panel.maxX - panel.minX, MACHINE_DIMENSIONS.lowerCabinetHeight, panel.maxZ - panel.minZ),
        frameMaterial,
      )
      block.position.set((panel.minX + panel.maxX) / 2, lowerCabinetCenterY, (panel.minZ + panel.maxZ) / 2)
      block.castShadow = true
      shell.add(block)
    }
    this.scene.add(shell)
    this.scene.add(createSideStickers())

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

    // A shallow physical console mirrors the touchscreen controls without stealing their input.
    const controlDeck = new THREE.Group()
    controlDeck.name = 'machine-control-deck'
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(2.96, 0.15, 0.62, 4, 0.05), frameMaterial)
    shelf.name = 'machine-control-shelf'
    shelf.position.set(0, -0.32, 2.035)
    shelf.castShadow = true
    controlDeck.add(shelf)

    const deckTop = new THREE.Mesh(new RoundedBoxGeometry(2.78, 0.035, 0.5, 3, 0.017), baseMaterial)
    deckTop.position.set(0, -0.225, 2.04)
    controlDeck.add(deckTop)

    const metal = new THREE.MeshStandardMaterial({ color: 0xa7bac7, roughness: 0.26, metalness: 0.8 })
    const rubber = new THREE.MeshStandardMaterial({ color: 0x122338, roughness: 0.78 })
    const joystick = new THREE.Group()
    joystick.name = 'machine-joystick'
    joystick.position.set(-0.82, -0.19, 2.08)
    const stickBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 32), metal)
    const stickBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.19, 0.085, 24), rubber)
    stickBoot.position.y = 0.06
    const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 16), metal)
    stickShaft.position.y = 0.19
    const stickKnob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), new THREE.MeshPhysicalMaterial({
      color: COLORS.aqua, roughness: 0.18, metalness: 0.1, clearcoat: 1,
    }))
    stickKnob.position.y = 0.32
    joystick.add(stickBezel, stickBoot, stickShaft, stickKnob)
    controlDeck.add(joystick)

    const grabControl = new THREE.Group()
    grabControl.name = 'machine-grab-button'
    grabControl.position.set(0.78, -0.18, 2.08)
    const buttonBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.045, 36), metal)
    const buttonRim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.055, 36), rubber)
    buttonRim.position.y = 0.04
    const buttonCap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.09, 36), new THREE.MeshPhysicalMaterial({
      color: COLORS.pink, emissive: COLORS.pink, emissiveIntensity: 0.28,
      roughness: 0.2, metalness: 0.05, clearcoat: 1,
    }))
    buttonCap.position.y = 0.095
    grabControl.add(buttonBezel, buttonRim, buttonCap)
    controlDeck.add(grabControl)
    this.scene.add(controlDeck)
  }

  private createPrize(
    placement: PrizePlacement,
    mesh: THREE.Group,
    glowColor: number,
    glowIntensity = 2.8,
    kind?: 'slowpoke',
  ): Prize {
    const start: PrizePlacement = {
      position: { ...placement.position },
      rotation: {
        x: placement.rotation.x,
        y: placement.rotation.y,
        z: placement.rotation.z,
        w: placement.rotation.w,
      },
    }
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.position.x, start.position.y, start.position.z)
        .setRotation(start.rotation)
        .setLinearDamping(0.35)
        .setAngularDamping(3.2),
    )
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PLUSH_HALF_SEGMENT, PLUSH_RADIUS)
        .setRestitution(0.15)
        .setFriction(0.8),
      body,
    )
    const colliders = [collider]
    if (kind === 'slowpoke') {
      for (const part of [
        { radius: 0.17, x: 0.29, y: 0.36, z: -0.56 },
        { radius: 0.11, x: 0.36, y: 0.62, z: -0.5 },
        { radius: 0.31, x: 0, y: 0.12, z: 0.39 },
      ]) {
        colliders.push(this.world.createCollider(
          RAPIER.ColliderDesc.ball(part.radius)
            .setTranslation(part.x, part.y, part.z)
            .setRestitution(0.15)
            .setFriction(0.8),
          body,
        ))
      }
    }

    const prizeGlow = new THREE.PointLight(glowColor, glowIntensity, 2.2)
    prizeGlow.position.y = PRIZE_HALF_HEIGHT + 0.07
    mesh.add(prizeGlow)
    this.scene.add(mesh)

    return { body, collider, colliders, mesh, carry: new PrizeCarryController(body, colliders), start, claimed: false }
  }

  private setPrizeSensor(prize: Prize, enabled: boolean): void {
    for (const collider of prize.colliders ?? [prize.collider]) collider.setSensor(enabled)
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
    const showingSlip = this.slipped && (this.round.phase === 'lifting' || this.round.phase === 'returning'
      || this.round.phase === 'releasing' || this.round.phase === 'resetting')
    this.onSnapshot({
      attempts: this.round.attempts,
      banter: banterFor({
        attempts: this.round.attempts,
        carried: this.carried || (this.lastGrabSucceeded && !this.slipped),
        phase: this.round.phase,
        timeLeft: this.round.timeLeft,
      }),
      canGrab: this.round.phase === 'aiming' || this.round.phase === 'lowering',
      grabLabel: this.round.phase === 'lowering' ? '二收' : '出爪',
      isReady: this.round.phase === 'ready',
      result: this.round.phase === 'won' || this.round.phase === 'lost' ? this.round.phase : undefined,
      status: showingSlip ? '滑了滑了！娃娃說它還沒下班。'
        : this.round.phase === 'aiming' && this.prizes.some((prize) =>
        tiltPlanForAim(this.clawPosition, prize.body.translation()))
        ? '偏側下爪：可試試倒爪！'
        : this.round.phase === 'lowering' && this.tiltPlan
          ? '倒爪中：再按二收可提早夾住！'
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
    lowering: '夾爪下降中，再按二收可提早收爪',
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
