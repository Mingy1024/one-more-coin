import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

export interface CarryTarget {
  x: number
  y: number
  z: number
}

export class PrizeCarryController {
  private readonly lateralOffset = new THREE.Vector2()
  private readonly carriedRotation = new THREE.Quaternion()
  private readonly uprightRotation = new THREE.Quaternion()

  constructor(
    private readonly body: RAPIER.RigidBody,
    private readonly collider: RAPIER.Collider,
  ) {}

  capture(grabPosition: CarryTarget): void {
    const position = this.body.translation()
    this.lateralOffset.set(
      position.x - grabPosition.x,
      position.z - grabPosition.z,
    ).clampLength(0, 0.09)

    const rotation = this.body.rotation()
    this.carriedRotation.set(rotation.x, rotation.y, rotation.z, rotation.w)
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.carriedRotation)
    const yaw = Math.atan2(forward.x, forward.z)
    this.uprightRotation.setFromEuler(new THREE.Euler(0, yaw, 0))

    this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
    this.body.setGravityScale(0, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.collider.setSensor(true)
    this.follow(grabPosition)
  }

  follow(grabPosition: CarryTarget, deltaSeconds = 1 / 60): void {
    this.body.setTranslation({
      x: grabPosition.x + this.lateralOffset.x,
      y: grabPosition.y,
      z: grabPosition.z + this.lateralOffset.y,
    }, true)
    const rotationBlend = 1 - Math.exp(-12 * deltaSeconds)
    this.carriedRotation.slerp(this.uprightRotation, rotationBlend)
    this.body.setRotation(this.carriedRotation, true)
  }

  release(): void {
    this.collider.setSensor(false)
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.body.setGravityScale(1, true)
  }
}
