import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { PrizeCarryController } from './PrizeCarryController'

beforeAll(async () => {
  await RAPIER.init()
})

function createPrize(world: RAPIER.World, x = 0.14, z = -0.08, y = 0.38) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z),
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

  it('disables every protruding-part collider while held and restores them on release', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const tail = world.createCollider(
      RAPIER.ColliderDesc.ball(0.14).setTranslation(0.2, 0.24, -0.5),
      prize.body,
    )
    const carry = new PrizeCarryController(prize.body, [prize.collider, tail])

    carry.capture({ x: 0, y: 0.38, z: 0 })
    expect(prize.collider.isSensor()).toBe(true)
    expect(tail.isSensor()).toBe(true)

    carry.release()
    expect(prize.collider.isSensor()).toBe(false)
    expect(tail.isSensor()).toBe(false)
  })

  it('does not snap the prize toward the claw centre or down when capture begins', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world, 0.24, -0.08, 0.62)
    const carry = new PrizeCarryController(prize.body, prize.collider)

    carry.capture({ x: 0, y: 0.46, z: 0 })

    expect(prize.body.translation().x).toBeCloseTo(0.24)
    expect(prize.body.translation().y).toBeCloseTo(0.62)
  })

  it('follows the latest claw pose without a one-frame lag', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)
    carry.capture({ x: 0, y: 0.38, z: 0 })
    world.step()

    carry.follow({ x: 0.5, y: 1.2, z: -0.2 })

    const position = prize.body.translation()
    expect(position.x).toBeCloseTo(0.64)
    expect(position.y).toBeCloseTo(1.2, 5)
    expect(Math.hypot(position.x - 0.5, position.z + 0.2)).toBeGreaterThan(0.1)
  })

  it('keeps the doll fixed relative to a swinging claw instead of forcing it upright', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    prize.body.setRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, 0.7, -0.4)),
      true,
    )
    const carry = new PrizeCarryController(prize.body, prize.collider)
    const target = { x: 0, y: 0.38, z: 0 }

    carry.capture(target)
    const tilted = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.4)
    for (let frame = 0; frame < 120; frame += 1) {
      carry.follow({ ...target, rotation: tilted }, 1 / 180)
    }

    const rotation = prize.body.rotation()
    const actual = new THREE.Quaternion(
      rotation.x,
      rotation.y,
      rotation.z,
      rotation.w,
    )
    const initial = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.48, 0.7, -0.4))
    expect(actual.angleTo(tilted.multiply(initial))).toBeLessThan(0.02)
  })

  it('retains a supported off-centre grip while returning to the chute', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)
    const target = { x: -1.2, y: 2.8, z: 0.96 }
    carry.capture({ x: 0, y: 0.38, z: 0 })

    for (let frame = 0; frame < 180; frame += 1) {
      carry.follow(target, 1 / 180, 10)
    }

    const position = prize.body.translation()
    expect(Math.hypot(position.x - target.x, position.z - target.z)).toBeGreaterThan(0.1)
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

  it('shows a weakening grip slipping down before returning to physical falling', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const prize = createPrize(world)
    const carry = new PrizeCarryController(prize.body, prize.collider)
    const target = { x: 0, y: 1.4, z: 0 }
    carry.capture({ x: 0, y: 0.38, z: 0 })
    carry.follow(target)
    const heldY = prize.body.translation().y
    carry.loosen(0.06)
    carry.follow(target)
    expect(prize.body.translation().y).toBeCloseTo(heldY - 0.06)
    carry.release()
    for (let frame = 0; frame < 30; frame += 1) world.step()
    expect(prize.body.translation().y).toBeLessThan(heldY - 0.2)
  })
})
