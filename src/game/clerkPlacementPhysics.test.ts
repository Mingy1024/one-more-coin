import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, expect, it } from 'vitest'
import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'
import { createRound } from './round'
import { ArticulatedClaw } from './ArticulatedClaw'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { createAlienModel } from './alienModel'
import { createLucaModel } from './lucaModel'

beforeAll(async () => { await RAPIER.init() })
const factories = [createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel, createLucaModel]
it.each(factories.map((factory, index) => ({ factory, index })))('can swap $factory.name to a leaning guard pose in the complete cabinet', ({ index }) => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  try {
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      world, scene: new THREE.Scene(), round: { ...createRound(), phase: 'lost' },
    }) as any
    game.addCabinet()
    game.articulatedClaw = new ArticulatedClaw(world, game.scene, { anchorY: MACHINE_DIMENSIONS.ropeAnchorY, headY: MACHINE_DIMENSIONS.clawTopY, x: -1.2, z: 0.96 })
    game.prizes = INITIAL_PRIZE_PLACEMENTS.map((placement, i) => game.createPrize(placement, factories[i]!()))
    game.settleInitialPrizes()
    const result = game.placePrizeForClerk(index)
    expect(result).toBeDefined()
    world.timestep = 1 / 120
    for (let frame = 0; frame < 360; frame++) world.step()
    const pose = game.prizes[index].body.rotation()
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(pose.x, pose.y, pose.z, pose.w))
    expect(Math.acos(up.y)).toBeGreaterThan(0.15)
  } finally { world.free() }
})
