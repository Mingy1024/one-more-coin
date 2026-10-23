import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

import { linkagePose } from './clawLinkage'

const HEAD_RADIUS = 0.15
const HEAD_HALF_HEIGHT = 0.12
const HINGE_RADIUS = 0.1
const HINGE_Y = -0.14
const CLOSED_ANGLE = -0.25
const OPEN_ANGLE = 0.45
const MIN_CABLE_LENGTH = 0.25
const MAX_LATERAL_IMPULSE = 0.065

const FINGER_PATH = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0.24, -0.4, 0),
  new THREE.Vector3(0.32, -0.7, 0),
  new THREE.Vector3(0.31, -0.94, 0),
  new THREE.Vector3(0.22, -1.08, 0),
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
  private readonly sliderVisual: THREE.Mesh
  private readonly linkageVisuals: THREE.Mesh[] = []
  private readonly fingers: FingerAssembly[] = []
  private cableJoint: RAPIER.ImpulseJoint
  private cableLength: number
  private sliderLocalY = -0.3

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

    this.sliderVisual = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.2, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xcdd4df,
        metalness: 0.9,
        roughness: 0.2,
        clearcoat: 0.7,
      }),
    )
    this.sliderVisual.castShadow = true
    this.root.add(this.sliderVisual)

    for (let index = 0; index < 3; index += 1) {
      this.fingers.push(this.createFinger(index))
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 1, 10),
        cableMaterial,
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

  getGrabPosition(): RAPIER.Vector {
    const position = this.headBody.translation()
    return { x: position.x, y: position.y - 0.9, z: position.z }
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
    for (const finger of this.fingers) {
      finger.joint.configureMotorPosition(target, 34, 4.8)
      finger.joint.setMotorMaxForce(12)
    }
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

  reset(x: number, z: number, cableLength: number): void {
    const anchor = this.gantryBody.translation()
    const headY = anchor.y - cableLength
    this.gantryBody.setTranslation({ x, y: anchor.y, z }, true)
    this.setCableLength(cableLength)
    this.headBody.setTranslation({ x, y: headY, z }, true)
    this.headBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.headBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.headBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
    this.fingers.forEach((finger, index) => {
      const angle = (index * Math.PI * 2) / 3
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
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), (index * Math.PI * 2) / 3)
        .applyQuaternion(this.headVisual.quaternion)
        .add(this.headVisual.position)
      const knuckle = new THREE.Vector3(0.32, -0.42, 0)
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
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xdde3ec,
      metalness: 0.92,
      roughness: 0.16,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    })
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(HEAD_RADIUS, HEAD_RADIUS * 1.08, 0.24, 28),
      chrome,
    )
    cap.castShadow = true
    group.add(cap)

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.026, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0x3d4651,
        metalness: 0.84,
        roughness: 0.26,
      }),
    )
    collar.rotation.x = Math.PI / 2
    collar.position.y = -0.08
    collar.castShadow = true
    group.add(collar)
    return group
  }

  private createFinger(index: number): FingerAssembly {
    const angle = (index * Math.PI * 2) / 3
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
    joint.setLimits(-0.3, 0.5)
    joint.setContactsEnabled(false)

    const visual = this.createFingerVisual()
    this.root.add(visual)
    return { body, joint, visual }
  }

  private createFingerVisual(): THREE.Group {
    const group = new THREE.Group()
    const chrome = new THREE.MeshPhysicalMaterial({
      color: 0xe2e6ed,
      metalness: 0.96,
      roughness: 0.14,
      clearcoat: 0.85,
    })
    const curve = new THREE.CatmullRomCurve3(
      FINGER_PATH.map((point) => point.clone()),
      false,
      'centripetal',
    )
    const blade = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.04, 9), chrome)
    blade.castShadow = true
    group.add(blade)

    const hinge = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), chrome)
    hinge.castShadow = true
    group.add(hinge)

    const tip = FINGER_PATH[FINGER_PATH.length - 1]!
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.055, 0.105),
      new THREE.MeshStandardMaterial({
        color: 0x727984,
        metalness: 0.82,
        roughness: 0.28,
      }),
    )
    pad.position.copy(tip)
    pad.rotation.z = -0.38
    pad.castShadow = true
    group.add(pad)
    return group
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
