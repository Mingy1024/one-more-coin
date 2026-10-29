import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createAlienModel } from './alienModel'
import { createLucaModel } from './lucaModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { prizeCollisionVertices } from './prizeCollision'
import { PrizeCarryController } from './PrizeCarryController'

beforeAll(async () => { await RAPIER.init() })

describe('rotated plush collision and release', () => {
  it.each([createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel, createLucaModel].flatMap(factory => [0, 0.8, 1.57, 2.4].map(angle => ({ factory, angle }))))('keeps machine collisions and clears the claw for $factory.name at $angle', ({ factory, angle }) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    try {
      world.timestep = 1 / 120
      const model = factory()
      const { parts, bounds } = prizeCollisionVertices(model)
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setCcdEnabled(true))
      const colliders = parts.map(points => world.createCollider(RAPIER.ColliderDesc.convexHull(points)!, body))
      const collider = colliders[0]!
      const originalGroups = collider.collisionGroups()
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, angle / 2, 0.3))
      body.setRotation(rotation, true)
      const carry = new PrizeCarryController(body, colliders, bounds)
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.05, 3, 3).setTranslation(0.7, 2, 0).setCollisionGroups(0x0001ffff).setSolverGroups(0x0001ffff))
      world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.1, 3).setTranslation(0, -0.1, 0).setCollisionGroups(0x0001ffff).setSolverGroups(0x0001ffff))
      world.createCollider(RAPIER.ColliderDesc.ball(0.3).setTranslation(0, 1.8, 0).setCollisionGroups(0x0002ffff).setSolverGroups(0x0002ffff))
      carry.capture({ x: 0, y: 2, z: 0 })
      for (let frame = 0; frame < 120; frame++) {
        carry.follow({ x: 1, y: 2, z: 0 }, world.timestep)
        world.step()
      }
      expect(collider.isSensor()).toBe(false)
      expect(body.translation().x).toBeLessThan(0.4)
      for (let frame = 0; frame < 120; frame++) {
        carry.follow({ x: 0, y: 2, z: 0 }, world.timestep)
        world.step()
      }
      carry.release(true)
      for (let frame = 0; frame < 240; frame++) {
        world.step()
        carry.updateReleaseClearance(1.5)
      }
      expect(body.translation().y).toBeLessThan(0.9)
      expect(body.translation().y).toBeGreaterThan(0.2)
      expect(collider.collisionGroups()).toBe(originalGroups)
    } finally {
      world.free()
    }
  })
})
