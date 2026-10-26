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
  private slipDistance = 0

  constructor(
    private readonly body: RAPIER.RigidBody,
    collider: RAPIER.Collider | readonly RAPIER.Collider[],
  ) {
    this.colliders = Array.isArray(collider) ? [...collider] : [collider]
  }

  private readonly colliders: RAPIER.Collider[]

  capture(grabPosition: CarryTarget): void {
    this.slipDistance = 0
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
    this.colliders.forEach(collider => collider.setSensor(true))
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

  loosen(distance: number): void {
    const amount = Math.min(Math.max(0, distance), 0.12 - this.slipDistance)
    this.localOffset.y -= amount
    this.slipDistance += amount
  }

  release(): void {
    this.colliders.forEach(collider => collider.setSensor(false))
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.body.setGravityScale(1, true)
  }
}
