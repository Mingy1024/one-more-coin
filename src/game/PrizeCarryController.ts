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
  private releaseGroups?: number[]
  private releaseLateralLimit = 0.6
  private supportError = 0

  constructor(
    private readonly body: RAPIER.RigidBody,
    collider: RAPIER.Collider | readonly RAPIER.Collider[],
    private readonly bounds?: THREE.Box3,
  ) {
    this.colliders = Array.isArray(collider) ? [...collider] : [collider]
  }

  private readonly colliders: RAPIER.Collider[]

  capture(grabPosition: CarryTarget): void {
    this.restoreReleaseCollisions()
    this.slipDistance = 0
    this.supportError = 0
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

    this.body.setGravityScale(0, true)
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    this.colliders.forEach(collider => collider.setSensor(false))
  }

  follow(grabPosition: CarryTarget, deltaSeconds = 1 / 60, _centerStrength = 0): void {
    const clawRotation = new THREE.Quaternion(
      grabPosition.rotation?.x ?? 0,
      grabPosition.rotation?.y ?? 0,
      grabPosition.rotation?.z ?? 0,
      grabPosition.rotation?.w ?? 1,
    )
    const target = this.localOffset.clone().applyQuaternion(clawRotation)
      .add(new THREE.Vector3(grabPosition.x, grabPosition.y, grabPosition.z))
    const position = this.body.translation()
    const offsetError = target.sub(new THREE.Vector3(position.x, position.y, position.z))
    this.supportError = offsetError.length()
    const desired = offsetError.multiplyScalar(28).clampLength(0, 5)
    const velocity = this.body.linvel()
    const blend = 1 - Math.exp(-35 * Math.max(0, deltaSeconds))
    this.body.setLinvel({
      x: velocity.x + (desired.x - velocity.x) * blend,
      y: velocity.y + (desired.y - velocity.y) * blend,
      z: velocity.z + (desired.z - velocity.z) * blend,
    }, true)
    const rotation = this.body.rotation()
    const error = clawRotation.multiply(this.localRotation)
      .multiply(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert()).normalize()
    if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w)
    const vector = new THREE.Vector3(error.x, error.y, error.z)
    const sine = vector.length()
    const angular = sine > 1e-6
      ? vector.multiplyScalar(2 * Math.atan2(sine, error.w) * 16 / sine).clampLength(0, 6)
      : vector.set(0, 0, 0)
    const spin = this.body.angvel()
    this.body.setAngvel({
      x: spin.x + (angular.x - spin.x) * blend,
      y: spin.y + (angular.y - spin.y) * blend,
      z: spin.z + (angular.z - spin.z) * blend,
    }, true)
  }

  loosen(distance: number): void {
    const amount = Math.min(Math.max(0, distance), 0.12 - this.slipDistance)
    this.localOffset.y -= amount
    this.slipDistance += amount
  }

  getSupportError(): number { return this.supportError }

  release(clearClaw = false): void {
    this.restoreReleaseCollisions()
    if (clearClaw) {
      const velocity = this.body.linvel()
      this.releaseLateralLimit = Math.max(0.6, Math.hypot(velocity.x, velocity.z) * 1.2)
      this.releaseGroups = this.colliders.map(collider => collider.solverGroups())
      this.colliders.forEach(collider => collider.setSolverGroups(collider.solverGroups() & ~0x0002))
    }
    this.colliders.forEach(collider => collider.setSensor(false))
    this.body.setGravityScale(1, true)
  }

  updateReleaseClearance(lowestClawY: number): void {
    if (!this.releaseGroups) return
    // Removing a loaded contact can leave a one-step solver impulse. Preserve
    // transport momentum while preventing that transient from launching the plush.
    const velocity = this.body.linvel()
    const lateral = Math.hypot(velocity.x, velocity.z)
    if (lateral > this.releaseLateralLimit || velocity.y > 0.25) {
      const scale = Math.min(1, this.releaseLateralLimit / Math.max(lateral, 1e-6))
      this.body.setLinvel({ x: velocity.x * scale, y: Math.min(velocity.y, 0.25), z: velocity.z * scale }, true)
    }
    const spin = this.body.angvel()
    const speed = Math.hypot(spin.x, spin.y, spin.z)
    if (speed > 3) this.body.setAngvel({ x: spin.x * 3 / speed, y: spin.y * 3 / speed, z: spin.z * 3 / speed }, true)
    const rotation = this.body.rotation()
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    let top = 0.9
    if (this.bounds) {
      top = -Infinity
      for (const x of [this.bounds.min.x, this.bounds.max.x]) {
        for (const y of [this.bounds.min.y, this.bounds.max.y]) {
          for (const z of [this.bounds.min.z, this.bounds.max.z]) {
            top = Math.max(top, new THREE.Vector3(x, y, z).applyQuaternion(quaternion).y)
          }
        }
      }
    }
    if (this.body.translation().y + top + 0.05 < lowestClawY) this.restoreReleaseCollisions()
  }

  private restoreReleaseCollisions(): void {
    if (!this.releaseGroups) return
    this.colliders.forEach((collider, index) => collider.setSolverGroups(this.releaseGroups![index]!))
    this.releaseGroups = undefined
  }
}
