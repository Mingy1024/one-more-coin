import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, expect, it } from 'vitest'

import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'
import { ArticulatedClaw } from './ArticulatedClaw'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { createAlienModel } from './alienModel'
import { createLucaModel } from './lucaModel'

import { MACHINE_DIMENSIONS } from './machineDimensions'

beforeAll(async () => { await RAPIER.init() })

it('settles the real prize colliders before display and saves grounded reset poses', () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  const scene = new THREE.Scene()
  type Placement = { position: RAPIER.Vector; rotation: RAPIER.Rotation }
  type Prize = { body: RAPIER.RigidBody; mesh: THREE.Group; start: Placement }
  const game = Object.assign(Object.create(ClawMachineGame.prototype), { world, scene }) as {
    addCabinet(): void
    createPrize(placement: Placement, mesh: THREE.Group, kind?: 'slowpoke'): Prize
    settleInitialPrizes(): void
    articulatedClaw: ArticulatedClaw
    prizes: Prize[]
  }
  game.addCabinet()
  game.articulatedClaw = new ArticulatedClaw(world, scene, {
    anchorY: MACHINE_DIMENSIONS.ropeAnchorY, headY: MACHINE_DIMENSIONS.clawTopY, x: -1.2, z: 0.96,
  })
  game.prizes = INITIAL_PRIZE_PLACEMENTS.map((placement, index) =>
    game.createPrize(placement, [createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel, createLucaModel][index]!()))

  game.settleInitialPrizes()

  for (const prize of game.prizes) {
    expect(prize.body.isSleeping()).toBe(true)
    expect(prize.mesh.position.distanceTo(new THREE.Vector3(...[
      prize.start.position.x, prize.start.position.y, prize.start.position.z,
    ]))).toBeLessThan(0.001)
  }
  const displayedPositions = game.prizes.map((prize) => ({ ...prize.body.translation() }))
  for (let frame = 0; frame < 120; frame += 1) world.step()
  game.prizes.forEach((prize, index) => {
    const before = displayedPositions[index]!
    const after = prize.body.translation()
    expect(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z)).toBeLessThan(0.005)
    expect(prize.start.position).toEqual(before)
  })
  world.free()
})
