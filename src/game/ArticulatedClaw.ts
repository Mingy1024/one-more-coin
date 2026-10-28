import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

import { linkagePose } from './clawLinkage'

const HEAD_RADIUS = 0.15
const HEAD_HALF_HEIGHT = 0.12
const HINGE_RADIUS = 0.1
const HINGE_Y = -0.14
const CLOSED_ANGLE = -0.25
const OPEN_ANGLE = 0.8
const MIN_CABLE_LENGTH = 0.25
const MAX_LATERAL_IMPULSE = 0.065
const MAX_SWING_RADIUS = 0.34
const MAX_SWING_ANGLE = Math.PI / 4
const MAX_HEAD_ANGULAR_SPEED = 2.2
const GRIP_CENTER_Y = -0.82
const FINGER_YAW = Math.PI / 2
const HEAD_BOUNDS = {
  minX: -1.45,
  maxX: 1.45,
  minZ: -1.25,
  maxZ: 1.25,
} as const

const FINGER_PATH = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.24, -0.34, 0),
  new THREE.Vector3(0.32, -0.59, 0),
  new THREE.Vector3(0.31, -0.79, 0),
  new THREE.Vector3(0.22, -0.91, 0),
] as const

const FINGER_VISUAL_PATH = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.17, -0.2, 0),
  new THREE.Vector3(0.29, -0.58, 0),
  new THREE.Vector3(0.285, -0.77, 0),
  new THREE.Vector3(0.19, -0.89, 0),
] as const

interface FingerAssembly {
  body: RAPIER.RigidBody
  joint: RAPIER.RevoluteImpulseJoint
  visual: THREE.Group
}

interface ArticulatedClawOptions {
  anchorY: number
  headY: number
  x: number
  z: number
}

export class ArticulatedClaw {
  private readonly world: RAPIER.World
  private readonly scene: THREE.Scene
  private readonly root = new THREE.Group()
  private readonly gantryBody: RAPIER.RigidBody
  private readonly headBody: RAPIER.RigidBody
  private readonly headVisual: THREE.Group
  private readonly cableVisual: THREE.Mesh
  private readonly sliderVisual: THREE.Group
  private readonly linkageVisuals: THREE.Mesh[] = []
  private readonly fingers: FingerAssembly[] = []
  private cableJoint: RAPIER.ImpulseJoint
  private cableLength: number
  private sliderLocalY = -0.3
  private heldFingerAngles?: number[]

  constructor(
    world: RAPIER.World,
    scene: THREE.Scene,
    options: ArticulatedClawOptions,
  ) {
    this.world = world
    this.scene = scene
    this.cableLength = Number((options.anchorY - options.headY).toFixed(4))

    scene.add(this.root)
    this.gantryBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        options.x,
        options.anchorY,
        options.z,
      ),
    )
    this.headBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(options.x, options.headY, options.z)
        .setAdditionalMass(0.82)
        .setLinearDamping(0.45)
        .setAngularDamping(0.8)
        .setCcdEnabled(true),
    )
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(HEAD_HALF_HEIGHT, HEAD_RADIUS)
        .setCollisionGroups(0x0002ffff).setSolverGroups(0x0002ffff)
        .setDensity(2.2)
        .setFriction(0.55)
        .setRestitution(0.05),
      this.headBody,
    )

    this.cableJoint = this.createCableJoint(this.cableLength)
    this.headVisual = this.createHeadVisual()
    this.root.add(this.headVisual)

    const cableMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b1b21,
      metalness: 0.55,
      roughness: 0.34,
    })
    this.cableVisual = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1, 10),
      cableMaterial,
    )
    this.cableVisual.castShadow = true
    this.root.add(this.cableVisual)

    this.sliderVisual = this.createSliderVisual()
    this.root.add(this.sliderVisual)

    const linkageMaterial = this.createChromeMaterial(0xb8c0ca, 0.19)
    for (let index = 0; index < 3; index += 1) {
      this.fingers.push(this.createFinger(index))
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 1, 12),
        linkageMaterial,
      )
      rod.castShadow = true
      this.linkageVisuals.push(rod)
      this.root.add(rod)
    }

    this.setOpening(1)
    this.updateVisuals()
  }

  getDebugState(): { cableLength: number; fingerBodies: number } {
    return { cableLength: this.cableLength, fingerBodies: this.fingers.length }
  }

  getHeadPosition(): RAPIER.Vector {
    return this.headBody.translation()
  }

  getHeadVelocity(): RAPIER.Vector {
    return this.headBody.linvel()
  }

  getGrabPosition(): RAPIER.Vector {
    const pose = this.getGrabPose()
    return { x: pose.x, y: pose.y, z: pose.z }
  }

  getGrabPose(): { x: number; y: number; z: number; rotation: RAPIER.Rotation } {
    const position = this.headBody.translation()
    const rotation = this.headBody.rotation()
    const offset = new THREE.Vector3(0, GRIP_CENTER_Y, 0).applyQuaternion(
      new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    )
    return {
      x: position.x + offset.x,
      y: position.y + offset.y,
      z: position.z + offset.z,
      rotation,
    }
  }

  getFingerTipSpread(): number {
    const head = this.headBody.translation()
    return Math.max(...this.getFingerTipPositions().map((tip) =>
      Math.hypot(tip.x - head.x, tip.z - head.z)))
  }

  getFingerTipPositions(): RAPIER.Vector[] {
    const tip = FINGER_VISUAL_PATH[FINGER_VISUAL_PATH.length - 1]!
    return this.fingers.map((finger) => {
      const position = finger.body.translation()
      const rotation = finger.body.rotation()
      const worldTip = tip.clone().applyQuaternion(new THREE.Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      ))
      worldTip.add(new THREE.Vector3(position.x, position.y, position.z))
      return { x: worldTip.x, y: worldTip.y, z: worldTip.z }
    })
  }

  getFingerTipDrop(): number {
    const head = this.headBody.translation()
    return Math.max(...this.getFingerTipPositions().map((tip) => head.y - tip.y))
  }

  setGantryPosition(x: number, z: number): void {
    const current = this.gantryBody.translation()
    this.gantryBody.setNextKinematicTranslation({ x, y: current.y, z })
  }

  setCableLength(length: number): void {
    const nextLength = Math.max(MIN_CABLE_LENGTH, length)
    if (Math.abs(nextLength - this.cableLength) < 0.004) return

    this.world.removeImpulseJoint(this.cableJoint, true)
    this.cableLength = nextLength
    this.cableJoint = this.createCableJoint(nextLength)
  }

  setOpening(opening: number): void {
    const amount = THREE.MathUtils.clamp(opening, 0, 1)
    const target = THREE.MathUtils.lerp(CLOSED_ANGLE, OPEN_ANGLE, amount)
    this.sliderLocalY = linkagePose(amount).sliderY - 0.1
    for (const [index, finger] of this.fingers.entries()) {
      const contactAngle = this.heldFingerAngles?.[index]
      finger.joint.configureMotorPosition(contactAngle === undefined ? target : Math.max(target, contactAngle), 520, 34)
      finger.joint.setMotorMaxForce(600)
    }
  }

  holdCurrentGrip(): void {
    const head = this.headBody.rotation()
    const inverseHead = new THREE.Quaternion(head.x, head.y, head.z, head.w).invert()
    this.heldFingerAngles = this.fingers.map((finger, index) => {
      const rotation = finger.body.rotation()
      const local = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
        .premultiply(inverseHead)
        .premultiply(new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), -(FINGER_YAW + index * Math.PI * 2 / 3),
        ))
      return Math.atan2(2 * (local.w * local.z + local.x * local.y), 1 - 2 * (local.y ** 2 + local.z ** 2))
    })
  }

  releaseGrip(): void {
    this.heldFingerAngles = undefined
  }

  applyImpulse(impulse: RAPIER.Vector): void {
    const lateralMagnitude = Math.hypot(impulse.x, impulse.z)
    const scale = lateralMagnitude > MAX_LATERAL_IMPULSE
      ? MAX_LATERAL_IMPULSE / lateralMagnitude
      : 1
    this.headBody.applyImpulse({
      x: impulse.x * scale,
      y: impulse.y,
      z: impulse.z * scale,
    }, true)
  }

  applyTiltToward(directionX: number, directionZ: number, targetAngle: number, deltaSeconds: number): void {
    const directionLength = Math.hypot(directionX, directionZ)
    if (directionLength < 0.001) return
    const dx = directionX / directionLength
    const dz = directionZ / directionLength
    const axis = new THREE.Vector3(-dz, 0, dx)
    const rotation = this.headBody.rotation()
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(
      rotation.x, rotation.y, rotation.z, rotation.w,
    ))
    const currentAngle = Math.atan2(-(up.x * dx + up.z * dz), up.y)
    const angularVelocity = this.headBody.angvel()
    const axisSpeed = angularVelocity.x * axis.x + angularVelocity.z * axis.z
    const torque = THREE.MathUtils.clamp(
      (targetAngle - currentAngle) * 25 - axisSpeed * 7,
      -8,
      8,
    ) * deltaSeconds
    this.headBody.applyTorqueImpulse({ x: axis.x * torque, y: 0, z: axis.z * torque }, true)
  }

  stabilizeSwing(): void {
    const anchor = this.gantryBody.translation()
    const head = this.headBody.translation()
    const offsetX = head.x - anchor.x
    const offsetZ = head.z - anchor.z
    const offsetLength = Math.hypot(offsetX, offsetZ)
    const allowedRadius = Math.min(
      MAX_SWING_RADIUS,
      this.cableLength * Math.sin(MAX_SWING_ANGLE),
    )

    let nextX = head.x
    let nextZ = head.z
    let radialX = 0
    let radialZ = 0
    let radialLimited = false
    if (offsetLength > allowedRadius) {
      radialX = offsetX / offsetLength
      radialZ = offsetZ / offsetLength
      nextX = anchor.x + radialX * allowedRadius
      nextZ = anchor.z + radialZ * allowedRadius
      radialLimited = true
    }

    nextX = THREE.MathUtils.clamp(nextX, HEAD_BOUNDS.minX, HEAD_BOUNDS.maxX)
    nextZ = THREE.MathUtils.clamp(nextZ, HEAD_BOUNDS.minZ, HEAD_BOUNDS.maxZ)
    const correctionX = nextX - head.x
    const correctionZ = nextZ - head.z
    if (Math.abs(correctionX) > 0.0001 || Math.abs(correctionZ) > 0.0001) {
      this.headBody.setTranslation({ x: nextX, y: head.y, z: nextZ }, true)
      for (const finger of this.fingers) {
        const position = finger.body.translation()
        finger.body.setTranslation({
          x: position.x + correctionX,
          y: position.y,
          z: position.z + correctionZ,
        }, true)
      }
    }

    const atMinX = nextX <= HEAD_BOUNDS.minX + 0.0001
    const atMaxX = nextX >= HEAD_BOUNDS.maxX - 0.0001
    const atMinZ = nextZ <= HEAD_BOUNDS.minZ + 0.0001
    const atMaxZ = nextZ >= HEAD_BOUNDS.maxZ - 0.0001
    if (radialLimited || atMinX || atMaxX || atMinZ || atMaxZ) {
      this.limitOutwardVelocity(
        this.headBody,
        radialLimited,
        radialX,
        radialZ,
        atMinX,
        atMaxX,
        atMinZ,
        atMaxZ,
      )
      for (const finger of this.fingers) {
        this.limitOutwardVelocity(
          finger.body,
          radialLimited,
          radialX,
          radialZ,
          atMinX,
          atMaxX,
          atMinZ,
          atMaxZ,
        )
      }
    }

    const angularVelocity = this.headBody.angvel()
    const angularSpeed = Math.hypot(
      angularVelocity.x,
      angularVelocity.y,
      angularVelocity.z,
    )
    if (angularSpeed > MAX_HEAD_ANGULAR_SPEED) {
      const scale = MAX_HEAD_ANGULAR_SPEED / angularSpeed
      this.headBody.setAngvel({
        x: angularVelocity.x * scale,
        y: angularVelocity.y * scale,
        z: angularVelocity.z * scale,
      }, true)
    }
  }

  settleSwing(deltaSeconds: number, strength: number): void {
    const anchor = this.gantryBody.translation()
    const head = this.headBody.translation()
    const blend = 1 - Math.exp(-strength * deltaSeconds)
    const correctionX = (anchor.x - head.x) * blend
    const correctionZ = (anchor.z - head.z) * blend
    this.headBody.setTranslation({
      x: head.x + correctionX,
      y: head.y,
      z: head.z + correctionZ,
    }, true)
    const velocityDamping = Math.exp(-strength * deltaSeconds)
    const headVelocity = this.headBody.linvel()
    this.headBody.setLinvel({
      x: headVelocity.x * velocityDamping,
      y: headVelocity.y,
      z: headVelocity.z * velocityDamping,
    }, true)
    for (const finger of this.fingers) {
      const position = finger.body.translation()
      finger.body.setTranslation({
        x: position.x + correctionX,
        y: position.y,
        z: position.z + correctionZ,
      }, true)
      const velocity = finger.body.linvel()
      finger.body.setLinvel({
        x: velocity.x * velocityDamping,
        y: velocity.y,
        z: velocity.z * velocityDamping,
      }, true)
    }
  }

  private limitOutwardVelocity(
    body: RAPIER.RigidBody,
    radialLimited: boolean,
    radialX: number,
    radialZ: number,
    atMinX: boolean,
    atMaxX: boolean,
    atMinZ: boolean,
    atMaxZ: boolean,
  ): void {
    const velocity = body.linvel()
    let velocityX = velocity.x
    let velocityZ = velocity.z
    if (radialLimited) {
      const outwardSpeed = velocityX * radialX + velocityZ * radialZ
      if (outwardSpeed > 0) {
        velocityX -= outwardSpeed * radialX
        velocityZ -= outwardSpeed * radialZ
      }
    }
    if ((atMinX && velocityX < 0) || (atMaxX && velocityX > 0)) velocityX = 0
    if ((atMinZ && velocityZ < 0) || (atMaxZ && velocityZ > 0)) velocityZ = 0
    body.setLinvel({ x: velocityX, y: velocity.y, z: velocityZ }, true)
  }

  reset(x: number, z: number, cableLength: number): void {
    this.releaseGrip()
    const anchor = this.gantryBody.translation()
    const headY = anchor.y - cableLength
    this.gantryBody.setTranslation({ x, y: anchor.y, z }, true)
    this.setCableLength(cableLength)
    this.headBody.setTranslation({ x, y: headY, z }, true)
    this.headBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.headBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.headBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    this.fingers.forEach((finger, index) => {
      const angle = FINGER_YAW + (index * Math.PI * 2) / 3
      finger.body.setTranslation({
        x: x + HINGE_RADIUS * Math.cos(angle),
        y: headY + HINGE_Y,
        z: z - HINGE_RADIUS * Math.sin(angle),
      }, true)
      finger.body.setRotation(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          angle,
        ),
        true,
      )
      finger.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      finger.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })
    this.updateVisuals()
  }

  updateVisuals(): void {
    const anchor = this.gantryBody.translation()
    const head = this.headBody.translation()
    const headRotation = this.headBody.rotation()
    this.headVisual.position.set(head.x, head.y, head.z)
    this.headVisual.quaternion.set(
      headRotation.x,
      headRotation.y,
      headRotation.z,
      headRotation.w,
    )
    this.positionRod(
      this.cableVisual,
      new THREE.Vector3(anchor.x, anchor.y, anchor.z),
      new THREE.Vector3(head.x, head.y + HEAD_HALF_HEIGHT, head.z),
    )

    const sliderOffset = new THREE.Vector3(0, this.sliderLocalY, 0).applyQuaternion(
      this.headVisual.quaternion,
    )
    this.sliderVisual.position.copy(this.headVisual.position).add(sliderOffset)
    this.sliderVisual.quaternion.copy(this.headVisual.quaternion)

    this.fingers.forEach((finger, index) => {
      const position = finger.body.translation()
      const rotation = finger.body.rotation()
      finger.visual.position.set(position.x, position.y, position.z)
      finger.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)

      const sliderAnchor = new THREE.Vector3(0.07, this.sliderLocalY, 0)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), FINGER_YAW + (index * Math.PI * 2) / 3)
        .applyQuaternion(this.headVisual.quaternion)
        .add(this.headVisual.position)
      const knuckle = new THREE.Vector3(0.17, -0.24, 0)
        .applyQuaternion(finger.visual.quaternion)
        .add(finger.visual.position)
      this.positionRod(this.linkageVisuals[index]!, sliderAnchor, knuckle)
    })
  }

  private createCableJoint(length: number): RAPIER.ImpulseJoint {
    return this.world.createImpulseJoint(
      RAPIER.JointData.rope(
        length,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: HEAD_HALF_HEIGHT, z: 0 },
      ),
      this.gantryBody,
      this.headBody,
      true,
    )
  }

  private createHeadVisual(): THREE.Group {
    const group = new THREE.Group()
    const chrome = this.createChromeMaterial(0xcbd2da, 0.16)
    const brushedChrome = this.createChromeMaterial(0x9ea7b2, 0.28)
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x252a31,
      metalness: 0.88,
      roughness: 0.24,
    })

    const coupler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.044, 0.05, 0.075, 20),
      darkSteel,
    )
    coupler.position.y = 0.145
    group.add(coupler)

    const cableNut = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.056, 0.055, 8),
      brushedChrome,
    )
    cableNut.position.y = 0.095
    group.add(cableNut)

    const upperCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.112, 0.065, 24),
      chrome,
    )
    upperCap.position.y = 0.04
    group.add(upperCap)

    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.112, 0.12, 0.12, 28),
      brushedChrome,
    )
    housing.position.y = -0.055
    group.add(housing)

    const lowerHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.075, 0.08, 24),
      chrome,
    )
    lowerHub.position.y = -0.155
    group.add(lowerHub)

    for (const y of [0, -0.115]) {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(y > -0.05 ? 0.108 : 0.087, 0.009, 8, 28),
        darkSteel,
      )
      collar.rotation.x = Math.PI / 2
      collar.position.y = y
      group.add(collar)
    }

    for (let index = 0; index < 3; index += 1) {
      const angle = FINGER_YAW + (index * Math.PI * 2) / 3
      const bracket = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.07, 0.055),
        chrome,
      )
      bracket.position.set(
        0.095 * Math.cos(angle),
        -0.137,
        -0.095 * Math.sin(angle),
      )
      bracket.rotation.y = angle
      group.add(bracket)

      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.01, 16),
        darkSteel,
      )
      bolt.rotation.z = Math.PI / 2
      bolt.rotation.y = angle
      bolt.position.set(
        0.127 * Math.cos(angle),
        -0.138,
        -0.127 * Math.sin(angle),
      )
      group.add(bolt)
    }

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true
    })
    return group
  }

  private createFinger(index: number): FingerAssembly {
    const angle = FINGER_YAW + (index * Math.PI * 2) / 3
    const radialX = Math.cos(angle)
    const radialZ = -Math.sin(angle)
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          this.headBody.translation().x + HINGE_RADIUS * radialX,
          this.headBody.translation().y + HINGE_Y,
          this.headBody.translation().z + HINGE_RADIUS * radialZ,
        )
        .setRotation(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            angle,
          ),
        )
        .setAdditionalMass(0.12)
        .setLinearDamping(0.32)
        .setAngularDamping(0.65)
        .setCcdEnabled(true),
    )

    for (let segment = 0; segment < FINGER_PATH.length - 1; segment += 1) {
      const from = FINGER_PATH[segment]!
      const to = FINGER_PATH[segment + 1]!
      const delta = to.clone().sub(from)
      const length = delta.length()
      const rotation = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      )
      this.world.createCollider(
        RAPIER.ColliderDesc.capsule(length / 2, segment === 3 ? 0.045 : 0.035)
          .setCollisionGroups(0x0002ffff).setSolverGroups(0x0002ffff)
          .setTranslation(
            (from.x + to.x) / 2,
            (from.y + to.y) / 2,
            (from.z + to.z) / 2,
          )
          .setRotation(rotation)
          .setDensity(0.36)
          .setFriction(0.86)
          .setRestitution(0.02),
        body,
      )
    }

    const tangent = { x: Math.sin(angle), y: 0, z: Math.cos(angle) }
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.revoluteWithAxes(
        { x: HINGE_RADIUS * radialX, y: HINGE_Y, z: HINGE_RADIUS * radialZ },
        { x: 0, y: 0, z: 0 },
        tangent,
        { x: 0, y: 0, z: 1 },
      ),
      this.headBody,
      body,
      true,
    ) as RAPIER.RevoluteImpulseJoint
    joint.setLimits(CLOSED_ANGLE - 0.05, OPEN_ANGLE)
    joint.setContactsEnabled(false)

    const visual = this.createFingerVisual()
    this.root.add(visual)
    return { body, joint, visual }
  }

  private createFingerVisual(): THREE.Group {
    const group = new THREE.Group()
    const chrome = this.createChromeMaterial(0xd5d9df, 0.15)
    const brushedChrome = this.createChromeMaterial(0xaab2bd, 0.27)
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x30353d,
      metalness: 0.85,
      roughness: 0.3,
    })

    const pivot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.062, 0.14, 18),
      darkSteel,
    )
    pivot.rotation.x = Math.PI / 2
    group.add(pivot)

    for (const z of [-0.035, 0.035]) {
      const start = FINGER_VISUAL_PATH[0]!.clone().setZ(z)
      const end = FINGER_VISUAL_PATH[1]!.clone().setZ(z)
      group.add(this.createRod(start, end, 0.016, chrome, 10))
    }

    const bladeCurve = new THREE.CatmullRomCurve3(
      FINGER_VISUAL_PATH.slice(1).map((point) => point.clone()),
      false,
      'centripetal',
    )
    const blade = new THREE.Mesh(
      new THREE.TubeGeometry(bladeCurve, 28, 0.019, 9),
      brushedChrome,
    )
    group.add(blade)

    const shoulder = FINGER_VISUAL_PATH[1]!
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.043, 0.095, 16),
      darkSteel,
    )
    sleeve.rotation.x = Math.PI / 2
    sleeve.position.copy(shoulder)
    group.add(sleeve)

    const bolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.104, 14),
      chrome,
    )
    bolt.rotation.x = Math.PI / 2
    bolt.position.copy(shoulder)
    group.add(bolt)

    const tip = FINGER_VISUAL_PATH[FINGER_VISUAL_PATH.length - 1]!
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, 0.035, 0.072),
      new THREE.MeshStandardMaterial({
        color: 0x343942,
        metalness: 0.22,
        roughness: 0.58,
      }),
    )
    pad.position.copy(tip)
    pad.rotation.z = -0.48
    group.add(pad)

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true
    })
    return group
  }

  private createSliderVisual(): THREE.Group {
    const group = new THREE.Group()
    const chrome = this.createChromeMaterial(0xc7ced7, 0.18)
    const darkSteel = new THREE.MeshStandardMaterial({
      color: 0x282d34,
      metalness: 0.86,
      roughness: 0.26,
    })

    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 0.24, 16),
      chrome,
    )
    piston.position.y = 0.08
    group.add(piston)

    const yoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.095, 0.075, 24),
      chrome,
    )
    yoke.position.y = -0.055
    group.add(yoke)

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.011, 8, 24),
      darkSteel,
    )
    band.rotation.x = Math.PI / 2
    band.position.y = -0.04
    group.add(band)

    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.castShadow = true
    })
    return group
  }

  private createChromeMaterial(color: number, roughness: number): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.94,
      roughness,
      clearcoat: 0.7,
      clearcoatRoughness: 0.12,
    })
  }

  private createRod(
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    radialSegments: number,
  ): THREE.Mesh {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, radialSegments),
      material,
    )
    this.positionRod(rod, start, end)
    return rod
  }

  private positionRod(
    mesh: THREE.Mesh,
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): void {
    const direction = end.clone().sub(start)
    const length = Math.max(direction.length(), 0.001)
    mesh.position.copy(start).add(end).multiplyScalar(0.5)
    mesh.scale.set(1, length, 1)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    )
  }
}
