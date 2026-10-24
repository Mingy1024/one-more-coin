import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { PrizeCarryController } from './PrizeCarryController'

beforeAll(async () => {
  await RAPIER.init()
})

function createPrize(world: RAPIER.World, x = 0.14, z = -0.08) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 0.38, z),
  )
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.36, 0.36, 0.36),
    body,
  )
  return { body, collider }
}

describe('carried prize', () => {
  it('stops pushing against the claw while it is held', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)

    carry.capture({ x: 0, y: 0.38, z: 0 })

    expect(prize.collider.isSensor()).toBe(true)
  })

  it('keeps a small off-centre grip instead of snapping the prize to the middle', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)

    carry.capture({ x: 0, y: 0.38, z: 0 })
    world.step()

    expect(prize.body.translation().x).toBeGreaterThan(0.05)
    expect(prize.body.translation().x).toBeLessThanOrEqual(0.09)
  })

  it('follows the latest claw pose without a one-frame lag', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)
    carry.capture({ x: 0, y: 0.38, z: 0 })
    world.step()

    carry.follow({ x: 0.5, y: 1.2, z: -0.2 })

    const position = prize.body.translation()
    expect(position.x).toBeGreaterThan(0.55)
    expect(position.y).toBeCloseTo(1.2, 5)
    expect(Math.hypot(position.x - 0.5, position.z + 0.2)).toBeLessThanOrEqual(0.09001)
  })

  it('steadies a badly tilted prize instead of carrying it at an awkward angle', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    prize.body.setRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, 0.7, -0.4)),
      true,
    )
    const carry = new PrizeCarryController(prize.body, prize.collider)
    const target = { x: 0, y: 0.38, z: 0 }

    carry.capture(target)
    for (let frame = 0; frame < 120; frame += 1) carry.follow(target, 1 / 180)

    const rotation = prize.body.rotation()
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    ))
    expect(up.angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(0.12)
  })

  it('restores physical collisions when the claw releases the prize', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)
    carry.capture({ x: 0, y: 0.38, z: 0 })

    carry.release()

    expect(prize.collider.isSensor()).toBe(false)
    expect(prize.body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic)
  })
})
