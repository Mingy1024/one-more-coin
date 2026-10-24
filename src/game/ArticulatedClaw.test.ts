import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ArticulatedClaw } from './ArticulatedClaw'
import { PRIZE_GRIP_OPENING } from './prizeInteraction'

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
      claw.stabilizeSwing()
      const position = claw.getHeadPosition()
      maximumOffset = Math.max(maximumOffset, Math.hypot(position.x, position.z))
    }

    expect(maximumOffset).toBeLessThanOrEqual(0.38)
  })

  it('does not accumulate an unsafe swing during repeated side-to-side movement', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 3.52, headY: 3.05, x: 0, z: 0 },
    )
    world.timestep = 1 / 180

    let anchorX = 0
    let maximumOffset = 0
    let maximumHeadX = -Infinity
    for (let frame = 0; frame < 1800; frame += 1) {
      const direction = Math.floor(frame / 105) % 2 === 0 ? 1 : -1
      anchorX = THREE.MathUtils.clamp(anchorX + direction * (1.9 / 180), -1.28, 1.28)
      claw.setGantryPosition(anchorX, 0)
      world.step()
      claw.stabilizeSwing()

      const position = claw.getHeadPosition()
      maximumOffset = Math.max(
        maximumOffset,
        Math.hypot(position.x - anchorX, position.z),
      )
      maximumHeadX = Math.max(maximumHeadX, position.x)
    }

    expect(maximumOffset).toBeLessThanOrEqual(0.36)
    expect(maximumHeadX).toBeLessThanOrEqual(1.45)
  })

  it('keeps the fingers visibly open throughout a full descent', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )
    world.timestep = 1 / 180

    for (let frame = 0; frame < 360; frame += 1) {
      const progress = frame / 359
      claw.setCableLength(0.55 + 2.25 * progress)
      claw.setOpening(1)
      world.step()
      claw.stabilizeSwing()
    }

    expect(claw.getFingerTipSpread()).toBeGreaterThanOrEqual(0.42)
  })

  it('still closes the fingers after the open descent', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )
    world.timestep = 1 / 180
    claw.setCableLength(2.8)
    claw.setOpening(1)
    for (let frame = 0; frame < 180; frame += 1) world.step()

    claw.setOpening(0)
    for (let frame = 0; frame < 180; frame += 1) world.step()

    expect(claw.getFingerTipSpread()).toBeLessThan(0.3)
  })

  it('holds the prize inside the lower half of the closed fingers', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )

    const head = claw.getHeadPosition()
    const grip = claw.getGrabPosition()

    expect(head.y - grip.y).toBeGreaterThanOrEqual(0.8)
    expect(head.y - grip.y).toBeLessThanOrEqual(0.86)
  })

  it('keeps the finger tips outside the gift box while carrying it', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )
    world.timestep = 1 / 180

    claw.setOpening(PRIZE_GRIP_OPENING)
    for (let frame = 0; frame < 240; frame += 1) world.step()

    expect(claw.getFingerTipSpread()).toBeGreaterThanOrEqual(0.36)
    expect(claw.getFingerTipSpread()).toBeLessThanOrEqual(0.48)
  })

  it('makes the closed grip clearly narrower than the fully open claw', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )
    world.timestep = 1 / 180

    claw.setOpening(1)
    for (let frame = 0; frame < 240; frame += 1) world.step()
    const openSpread = claw.getFingerTipSpread()

    claw.setOpening(PRIZE_GRIP_OPENING)
    for (let frame = 0; frame < 240; frame += 1) world.step()
    const gripSpread = claw.getFingerTipSpread()

    expect(openSpread - gripSpread).toBeGreaterThanOrEqual(0.16)
  })

  it('settles the swinging head over the gantry before release', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    const claw = new ArticulatedClaw(
      world,
      new THREE.Scene(),
      { anchorY: 4.05, headY: 3.5, x: 0, z: 0 },
    )
    world.timestep = 1 / 180
    claw.applyImpulse({ x: 0.065, y: 0, z: 0.03 })
    for (let frame = 0; frame < 90; frame += 1) world.step()

    for (let frame = 0; frame < 180; frame += 1) {
      world.step()
      claw.settleSwing(1 / 180, 10)
    }

    const head = claw.getHeadPosition()
    expect(Math.hypot(head.x, head.z)).toBeLessThan(0.01)
  })
})
