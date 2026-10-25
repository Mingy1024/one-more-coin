import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

export interface CarryTarget {
  x: number
  y: number
  z: number
  rotation?: { x: number; y: number; z: number; w: number }
}

export class PrizeCarryController {
  private readonly localOffset = new THREE.Vector3()
  private readonly localRotation = new THREE.Quaternion()

  constructor(
    private readonly body: RAPIER.RigidBody,
    private readonly collider: RAPIER.Collider,
  ) {}

  capture(grabPosition: CarryTarget): void {
    const position = this.body.translation()
    const clawRotation = new THREE.Quaternion(
      grabPosition.rotation?.x ?? 0,
      grabPosition.rotation?.y ?? 0,
      grabPosition.rotation?.z ?? 0,
      grabPosition.rotation?.w ?? 1,
    )
    const inverseClawRotation = clawRotation.clone().invert()
    this.localOffset.set(
      position.x - grabPosition.x,
      position.y - grabPosition.y,
      position.z - grabPosition.z,
    ).applyQuaternion(inverseClawRotation)

    const rotation = this.body.rotation()
    this.localRotation.set(rotation.x, rotation.y, rotation.z, rotation.w)
      .premultiply(inverseClawRotation)

    this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
    this.body.setGravityScale(0, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.collider.setSensor(true)
  }

  follow(grabPosition: CarryTarget, _deltaSeconds = 1 / 60, _centerStrength = 0): void {
    const clawRotation = new THREE.Quaternion(
      grabPosition.rotation?.x ?? 0,
      grabPosition.rotation?.y ?? 0,
      grabPosition.rotation?.z ?? 0,
      grabPosition.rotation?.w ?? 1,
    )
    const offset = this.localOffset.clone().applyQuaternion(clawRotation)
    this.body.setTranslation({
      x: grabPosition.x + offset.x,
      y: grabPosition.y + offset.y,
      z: grabPosition.z + offset.z,
    }, true)
    this.body.setRotation(clawRotation.multiply(this.localRotation), true)
  }

  release(): void {
    this.collider.setSensor(false)
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.body.setGravityScale(1, true)
  }
}
