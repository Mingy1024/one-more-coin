import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, expect, it } from 'vitest'
import { clerkLeanPose, CHUTE_GUARD_OUTER_X, CHUTE_GUARD_OUTER_Z } from './clerkLean'
import { prizeCollisionVertices } from './prizeCollision'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { createAlienModel } from './alienModel'
import { createLucaModel } from './lucaModel'

beforeAll(async () => { await RAPIER.init() })

it.each([createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel, createLucaModel])('keeps $name leaning against the real guard after gravity settles', factory => {
  for (const guard of ['right', 'back'] as const) {
    const model = factory()
    const pose = clerkLeanPose(model, guard, guard === 'right' ? 0.65 : -1.02)!
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    try {
      world.timestep = 1 / 120
      // Floor is only outside the chute, matching the two supporting faces.
      if (guard === 'right') world.createCollider(RAPIER.ColliderDesc.cuboid(2, 0.08, 3).setTranslation(1.5, -0.08, 0))
      else world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.08, 2).setTranslation(0, -0.08, -1.76))
      const lip = world.createCollider(guard === 'right'
        ? RAPIER.ColliderDesc.cuboid(0.0275, 0.2, 0.75).setTranslation(-0.475, 0.2, 0.96)
        : RAPIER.ColliderDesc.cuboid(0.73, 0.2, 0.0275).setTranslation(-1.2, 0.2, 0.215))
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pose.position.x, pose.position.y, pose.position.z).setRotation(pose.rotation).setAngularDamping(3.2).setCcdEnabled(true))
      const { parts } = prizeCollisionVertices(model)
      const colliders = parts.map(points => world.createCollider(RAPIER.ColliderDesc.convexHull(points)!.setFriction(0.65), body))
      for (let frame = 0; frame < 360; frame++) world.step()
      const rotation = body.rotation()
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
      expect(Math.acos(THREE.MathUtils.clamp(up.y, -1, 1)), `${factory.name} ${guard}`).toBeGreaterThan(0.15)
      expect(body.translation().y).toBeGreaterThan(0.15)
      let gap = Infinity
      for (const collider of colliders) {
        const contact = collider.contactCollider(lip, 0.06)
        if (contact) gap = Math.min(gap, contact.distance)
      }
      expect(gap, `${factory.name} ${guard} guard gap`).toBeLessThan(0.06)
      expect(gap, `${factory.name} ${guard} penetration`).toBeGreaterThan(-0.025)
    } finally { world.free() }
  }
})
