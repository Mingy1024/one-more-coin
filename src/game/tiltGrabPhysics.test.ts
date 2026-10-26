import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ArticulatedClaw } from './ArticulatedClaw'
import { evaluateGrip, PLUSH_HALF_SEGMENT, PLUSH_RADIUS } from './gripMechanics'
import { clawDescentProgress, clawOpeningForPhase } from './clawPose'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { PRIZE_GRIP_OPENING, PRIZE_HALF_HEIGHT } from './prizeInteraction'
import { phaseDurations } from './round'
import { canTiltPickup, TILT_GRIP_OPENING, tiltAmountForPhase, tiltPlanForAim } from './tiltGrab'

beforeAll(async () => { await RAPIER.init() })

describe('tilt-grab physics', () => {
  it('leans the claw and places two pads beside the lower part of a side-aimed doll', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = 1 / 180
    const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.08, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 0.08, 1.5), floor)
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, PRIZE_HALF_HEIGHT + 0.02, 0))
    world.createCollider(RAPIER.ColliderDesc.capsule(PLUSH_HALF_SEGMENT, PLUSH_RADIUS), prize)
    const claw = new ArticulatedClaw(world, new THREE.Scene(), {
      anchorY: MACHINE_DIMENSIONS.ropeAnchorY,
      headY: MACHINE_DIMENSIONS.clawTopY,
      x: 0,
      z: 0.4,
    })
    const plan = tiltPlanForAim({ x: 0, z: 0.4 }, { x: 0, z: 0 })!
    claw.setOpening(0)
    for (let frame = 0; frame < 180; frame += 1) world.step()

    const loweringFrames = Math.round(phaseDurations.lowering! * 180)
    for (let frame = 0; frame <= loweringFrames; frame += 1) {
      const progress = frame / loweringFrames
      const headY = THREE.MathUtils.lerp(
        MACHINE_DIMENSIONS.clawTopY,
        MACHINE_DIMENSIONS.clawLowY,
        clawDescentProgress(progress),
      )
      claw.setCableLength(MACHINE_DIMENSIONS.ropeAnchorY - headY)
      claw.setOpening(clawOpeningForPhase('lowering', progress, false, PRIZE_GRIP_OPENING))
      claw.applyTiltToward(plan.directionX, plan.directionZ, plan.angle * tiltAmountForPhase('lowering', progress), world.timestep)
      world.step()
      claw.stabilizeSwing()
    }
    const closingFrames = Math.round(phaseDurations.closing! * 180)
    for (let frame = 0; frame <= closingFrames; frame += 1) {
      const progress = frame / closingFrames
      claw.setOpening(clawOpeningForPhase('closing', progress, false, TILT_GRIP_OPENING))
      claw.applyTiltToward(plan.directionX, plan.directionZ, plan.angle, world.timestep)
      world.step()
      claw.stabilizeSwing()
    }

    const rotation = claw.getGrabPose().rotation
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(
      rotation.x, rotation.y, rotation.z, rotation.w,
    ))
    const position = prize.translation()
    const tips = claw.getFingerTipPositions()
    expect(up.z).toBeGreaterThan(0.35)
    expect(canTiltPickup(position, tips), JSON.stringify({ prize: position, tips })).toBe(true)
    expect(evaluateGrip({ position, rotation: prize.rotation() }, claw.getGrabPose(), tips, 'tilt')).toBeGreaterThan(0.55)
  })
})
