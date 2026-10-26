import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ArticulatedClaw } from './ArticulatedClaw'
import { PrizeCarryController } from './PrizeCarryController'
import { clawDescentProgress, clawOpeningForPhase } from './clawPose'
import { evaluateGrip, normalGripHeight, PLUSH_HALF_SEGMENT, PLUSH_RADIUS } from './gripMechanics'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { PRIZE_GRIP_OPENING, PRIZE_HALF_HEIGHT } from './prizeInteraction'
import { phaseDurations } from './round'

beforeAll(async () => { await RAPIER.init() })

describe('real claw tip geometry', () => {
  it('can support a centred plush after the actual claw finishes closing', () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = 1 / 180
    const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.08, 0))
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.5, 0.08, 1.5), floor)
    const prize = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, PRIZE_HALF_HEIGHT + 0.02, 0))
    const collider = world.createCollider(RAPIER.ColliderDesc.capsule(PLUSH_HALF_SEGMENT, PLUSH_RADIUS), prize)
    const claw = new ArticulatedClaw(world, new THREE.Scene(), {
      anchorY: MACHINE_DIMENSIONS.ropeAnchorY,
      headY: MACHINE_DIMENSIONS.clawTopY,
      x: 0,
      z: 0,
    })
    claw.setOpening(0)
    for (let frame = 0; frame < 180; frame += 1) world.step()
    const stopHeight = normalGripHeight({ position: prize.translation(), rotation: prize.rotation() })

    const loweringFrames = Math.round(phaseDurations.lowering! * 180)
    for (let frame = 0; frame <= loweringFrames; frame += 1) {
      const progress = frame / loweringFrames
      const headY = THREE.MathUtils.lerp(MACHINE_DIMENSIONS.clawTopY, stopHeight, clawDescentProgress(progress))
      claw.setCableLength(MACHINE_DIMENSIONS.ropeAnchorY - headY)
      claw.setOpening(clawOpeningForPhase('lowering', progress, false, PRIZE_GRIP_OPENING))
      world.step()
      claw.stabilizeSwing()
    }
    const closingFrames = Math.round(phaseDurations.closing! * 180)
    for (let frame = 0; frame <= closingFrames; frame += 1) {
      const progress = frame / closingFrames
      claw.setOpening(clawOpeningForPhase('closing', progress, false, PRIZE_GRIP_OPENING))
      world.step()
      claw.stabilizeSwing()
    }

    const position = prize.translation()
    const tips = claw.getFingerTipPositions()
    const quality = evaluateGrip({ position, rotation: prize.rotation() }, claw.getGrabPose(), tips, 'normal')
    expect(quality, JSON.stringify({ position, tips })).toBeGreaterThan(0.55)
    const carry = new PrizeCarryController(prize, collider)
    claw.holdCurrentGrip()
    carry.capture(claw.getGrabPose())
    for (let frame = 0; frame < 90; frame += 1) {
      claw.setOpening(PRIZE_GRIP_OPENING)
      world.step()
      carry.follow(claw.getGrabPose())
    }
    const heldPosition = prize.translation()
    const rotation = prize.rotation()
    const inverse = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).invert()
    for (const tip of claw.getFingerTipPositions()) {
      const point = new THREE.Vector3(tip.x - heldPosition.x, tip.y - heldPosition.y, tip.z - heldPosition.z).applyQuaternion(inverse)
      const axisY = Math.max(-PLUSH_HALF_SEGMENT, Math.min(PLUSH_HALF_SEGMENT, point.y))
      expect(Math.hypot(point.x, point.y - axisY, point.z)).toBeGreaterThan(PLUSH_RADIUS - 0.07)
    }
  })
})
