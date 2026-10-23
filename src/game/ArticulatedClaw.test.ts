import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ArticulatedClaw } from './ArticulatedClaw'

beforeAll(async () => {
  await RAPIER.init()
})

describe('articulated claw physics', () => {
  it('builds three independently simulated fingers under one suspended head', () => {
    const claw = new ArticulatedClaw(
      new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
      new THREE.Scene(),
      { anchorY: 3.52, headY: 3.05, x: 0, z: 0 },
    )

    expect(claw.getDebugState()).toEqual({ cableLength: 0.47, fingerBodies: 3 })
  })

  it('rebuilds the suspension constraint at a new cable length', () => {
    const claw = new ArticulatedClaw(
      new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
      new THREE.Scene(),
      { anchorY: 3.52, headY: 3.05, x: 0, z: 0 },
    )

    claw.setCableLength(1.4)

    expect(claw.getDebugState().cableLength).toBeCloseTo(1.4)
  })

  it('responds to a lateral impulse with real rigid-body movement', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 3.52, headY: 3.05, x: 0, z: 0 },
    )
    const initialX = claw.getHeadPosition().x

    claw.applyImpulse({ x: 0.8, y: 0, z: 0.2 })
    world.timestep = 1 / 60
    for (let frame = 0; frame < 12; frame += 1) world.step()

    expect(claw.getHeadPosition().x).toBeGreaterThan(initialX + 0.02)
  })

  it('keeps a strong lateral input inside a restrained pendulum arc', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 3.52, headY: 3.05, x: 0, z: 0 },
    )
    claw.applyImpulse({ x: 3, y: 0, z: -2 })
    world.timestep = 1 / 180

    let maximumOffset = 0
    for (let frame = 0; frame < 360; frame += 1) {
      const loweringProgress = Math.min(1, frame / 225)
      claw.setCableLength(0.47 + (2.1 - 0.47) * loweringProgress)
      world.step()
      const position = claw.getHeadPosition()
      maximumOffset = Math.max(maximumOffset, Math.hypot(position.x, position.z))
    }

    expect(maximumOffset).toBeLessThanOrEqual(0.38)
  })
})
