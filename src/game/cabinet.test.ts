import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'
import { PRIZE_HALF_DEPTH, PRIZE_HALF_HEIGHT, PRIZE_HALF_WIDTH } from './prizeInteraction'
import { ArticulatedClaw } from './ArticulatedClaw'
import { createPrizeModel } from './prizeModel'
import { createArcanineModel } from './arcanineModel'
import { createSnoopyModel } from './snoopyModel'
import { createSlowpokeModel } from './slowpokeModel'
import { createBulbasaurModel } from './bulbasaurModel'
import { createAlienModel } from './alienModel'

import { prizeCollisionVertices } from './prizeCollision'
import { CLAW_TRAVEL_BOUNDS } from './clawWorkspace'
import { MACHINE_DIMENSIONS } from './machineDimensions'

beforeAll(async () => { await RAPIER.init() })

function cabinet() {
  const scene = new THREE.Scene()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  const game = Object.assign(Object.create(ClawMachineGame.prototype), { scene, world }) as ClawMachineGame
  ;(game as unknown as { addCabinet(): void }).addCabinet()
  return { scene, world }
}

describe('cabinet containment and chute', () => {
  it('keeps both rows inside direct aiming reach after the real bodies settle together', () => {
    const { world, scene } = cabinet()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), { scene, world }) as ClawMachineGame
    const internals = game as unknown as {
      createPrize(placement: typeof INITIAL_PRIZE_PLACEMENTS[number], mesh: THREE.Group, kind?: 'slowpoke'): { body: RAPIER.RigidBody }
      settleInitialPrizes(): void
    }
    const prizes = INITIAL_PRIZE_PLACEMENTS.map((placement, index) => internals.createPrize(placement, [createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel][index]!()))
    Object.assign(game, {
      prizes,
      articulatedClaw: new ArticulatedClaw(world, scene, {
        anchorY: MACHINE_DIMENSIONS.ropeAnchorY, headY: MACHINE_DIMENSIONS.clawTopY, x: -1.2, z: 0.96,
      }),
    })
    internals.settleInitialPrizes()
    const layout = JSON.stringify(prizes.map(prize => prize.body.translation()))
    for (const [index, prize] of prizes.entries()) {
      const p = prize.body.translation()
      const detail = `prize ${index}; settled layout: ${layout}`
      expect(p.x, detail).toBeGreaterThan(CLAW_TRAVEL_BOUNDS.minX + 0.04)
      expect(p.x, detail).toBeLessThan(CLAW_TRAVEL_BOUNDS.maxX - 0.04)
      expect(p.z, detail).toBeGreaterThan(CLAW_TRAVEL_BOUNDS.minZ + 0.04)
      expect(p.z, detail).toBeLessThan(CLAW_TRAVEL_BOUNDS.maxZ - 0.04)
    }
    world.free()
  })
  it('displays four unique trip-quote stickers across both side panels without overlap', () => {
    const { scene } = cabinet()
    const stickers = scene.getObjectByName('cabinet-side-stickers') as THREE.Group | undefined
    expect(stickers).toBeDefined()
    expect(stickers!.children).toHaveLength(4)
    expect(stickers!.children.map(sticker => sticker.userData.text)).toEqual([
      '超濃起司', '佐藤巧', '金近廉', '海的另一端有的，是敵人',
    ])

    const sides = { left: 0, right: 0 }
    for (const sticker of stickers!.children) {
      const { side, width, height, angle } = sticker.userData as {
        side: 'left' | 'right'; width: number; height: number; angle: number
      }
      sides[side] += 1
      const halfZ = Math.abs(Math.cos(angle)) * width / 2 + Math.abs(Math.sin(angle)) * height / 2
      const halfY = Math.abs(Math.sin(angle)) * width / 2 + Math.abs(Math.cos(angle)) * height / 2
      expect(Math.abs(sticker.position.z) + halfZ).toBeLessThan(1.82)
      expect(sticker.position.y + halfY).toBeLessThan(-0.08)
      expect(sticker.position.y - halfY).toBeGreaterThan(-1.6)
    }
    expect(sides).toEqual({ left: 2, right: 2 })

    for (const side of ['left', 'right']) {
      const pair = stickers!.children.filter(sticker => sticker.userData.side === side)
      const bounds = pair.map(sticker => {
        const { width, height, angle } = sticker.userData as { width: number; height: number; angle: number }
        const halfZ = Math.abs(Math.cos(angle)) * width / 2 + Math.abs(Math.sin(angle)) * height / 2
        const halfY = Math.abs(Math.sin(angle)) * width / 2 + Math.abs(Math.cos(angle)) * height / 2
        return { minZ: sticker.position.z - halfZ, maxZ: sticker.position.z + halfZ, minY: sticker.position.y - halfY, maxY: sticker.position.y + halfY }
      })
      expect(bounds[0]!.maxZ < bounds[1]!.minZ || bounds[1]!.maxZ < bounds[0]!.minZ
        || bounds[0]!.maxY < bounds[1]!.minY || bounds[1]!.maxY < bounds[0]!.minY).toBe(true)
    }
  })

  it('has a raised control deck with a visible stick and grab button on the front', () => {
    const { scene } = cabinet()
    const deck = scene.getObjectByName('machine-control-deck')!
    const stick = deck.getObjectByName('machine-joystick')!
    const button = deck.getObjectByName('machine-grab-button')!
    const shelf = deck.getObjectByName('machine-control-shelf')!
    scene.updateMatrixWorld(true)

    expect(deck).toBeDefined()
    expect(stick).toBeDefined()
    expect(button).toBeDefined()
    expect(shelf).toBeDefined()
    expect(stick.position.x).toBeLessThan(button.position.x)
    expect(stick.position.z).toBeGreaterThan(1.8)
    expect(button.position.z).toBeGreaterThan(1.8)
    const front = new THREE.Box3().setFromObject(deck)
    expect(front.max.z).toBeGreaterThan(2.1)
  })

  it('has physical walls on all four sides of the prize chamber', () => {
    const { world } = cabinet()
    const walls: THREE.Vector3[] = []
    world.colliders.forEach(collider => {
      const { x, y, z } = collider.translation()
      if (y > 1.4 && y < 2.7) walls.push(new THREE.Vector3(x, y, z))
    })
    expect(walls.some(wall => wall.x < -1.7)).toBe(true)
    expect(walls.some(wall => wall.x > 1.7)).toBe(true)
    expect(walls.some(wall => wall.z < -1.4)).toBe(true)
    expect(walls.some(wall => wall.z > 1.4)).toBe(true)
  })

  it('leaves the chute aperture open through the white cabinet shell', () => {
    const { scene } = cabinet()
    const shell = scene.getObjectByName('cabinet-shell')!
    scene.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(new THREE.Vector3(-1.2, 0.8, 0.96), new THREE.Vector3(0, -1, 0))
    const hits = ray.intersectObject(shell, true)
    expect(hits.some(hit => hit.point.y > -1.35)).toBe(false)
  })

  it('shows four inset well walls without a patterned floor or coplanar flicker', () => {
    const { scene } = cabinet()
    const interior = scene.getObjectByName('chute-interior')!
    const shell = scene.getObjectByName('cabinet-shell')!
    scene.updateMatrixWorld(true)

    expect(interior.children.filter(child => child instanceof THREE.Mesh)).toHaveLength(4)
    const ray = new THREE.Raycaster(
      new THREE.Vector3(-1.2, -0.75, 0.96),
      new THREE.Vector3(0, 0, -1),
    )
    const wallHit = ray.intersectObject(interior, true)[0]
    const shellHit = ray.intersectObject(shell, true)[0]
    expect(wallHit).toBeDefined()
    expect(shellHit).toBeDefined()
    expect(shellHit!.distance - wallHit!.distance).toBeGreaterThan(0.005)
  })

  it('uses transparent guards about one third as tall as a doll', () => {
    const { scene, world } = cabinet()
    const lip = scene.getObjectByName('chute-lip') as THREE.Group
    expect(lip.children).toHaveLength(2)
    const guardHeight = PRIZE_HALF_HEIGHT * 2 / 3
    for (const panel of lip.children) {
      const mesh = panel as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>
      mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox!.max.y - mesh.geometry.boundingBox!.min.y).toBeCloseTo(guardHeight)
      expect(mesh.material.transparent).toBe(true)
      expect(mesh.material.opacity).toBeLessThan(0.6)
    }
    const heights: number[] = []
    world.colliders.forEach(collider => {
      const { x, y, z } = collider.translation()
      if (y > 0 && y < 0.3 && (Math.abs(x + 0.5) < 0.15 || Math.abs(z - 0.24) < 0.15)) {
        const cuboid = collider.shape as RAPIER.Cuboid
        heights.push(cuboid.halfExtents.y * 2)
      }
    })
    expect(heights).toHaveLength(2)
    heights.forEach(height => expect(height).toBeCloseTo(guardHeight))
  })

  it('starts every doll clear of the chute guards', () => {
    const { world } = cabinet()
    world.step()
    const guards: RAPIER.Collider[] = []
    world.colliders.forEach(collider => {
      const { x, y, z } = collider.translation()
      if (y > 0 && y < 0.3 && (Math.abs(x + 0.5) < 0.15 || Math.abs(z - 0.24) < 0.15)) guards.push(collider)
    })
    for (const [index, placement] of INITIAL_PRIZE_PLACEMENTS.entries()) {
      const model = [createPrizeModel, createArcanineModel, createSnoopyModel, createSlowpokeModel, createBulbasaurModel, createAlienModel][index]!()
      const { vertices } = prizeCollisionVertices(model)
      const overlaps: RAPIER.Collider[] = []
      world.intersectionsWithShape(
        placement.position,
        placement.rotation,
        new RAPIER.ConvexPolyhedron(vertices),
        collider => { if (guards.includes(collider)) overlaps.push(collider); return true },
      )
      expect(overlaps, `prize ${index}`).toHaveLength(0)
    }

    const slowpoke = INITIAL_PRIZE_PLACEMENTS[3]
    const rotation = new THREE.Quaternion(
      slowpoke.rotation.x, slowpoke.rotation.y, slowpoke.rotation.z, slowpoke.rotation.w,
    )
    for (const part of [
      { radius: 0.17, center: [0.29, 0.36, -0.56] },
      { radius: 0.11, center: [0.36, 0.62, -0.5] },
      { radius: 0.31, center: [0, 0.12, 0.39] },
    ]) {
      const center = new THREE.Vector3(part.center[0]!, part.center[1]!, part.center[2]!).applyQuaternion(rotation)
        .add(new THREE.Vector3(slowpoke.position.x, slowpoke.position.y, slowpoke.position.z))
      const overlaps: RAPIER.Collider[] = []
      world.intersectionsWithShape(
        center,
        { x: 0, y: 0, z: 0, w: 1 },
        new RAPIER.Ball(part.radius),
        collider => { if (guards.includes(collider)) overlaps.push(collider); return true },
      )
      expect(overlaps).toHaveLength(0)
    }
  })

  it('includes Slowpoke’s projecting tail in its collision envelope', () => {
    const { scene, world } = cabinet()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), { scene, world }) as ClawMachineGame
    const placement = { position: { x: -0.38, y: 0.68, z: 0.55 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }
    const prize = (game as unknown as {
      createPrize(start: typeof placement, mesh: THREE.Group, kind: 'slowpoke'): {
        body: RAPIER.RigidBody
      }
    }).createPrize(placement, createSlowpokeModel(), 'slowpoke')
    expect(prize.body.numColliders()).toBeGreaterThan(1)
    const vertices = Array.from({ length: prize.body.numColliders() }, (_, i) =>
      Array.from((prize.body.collider(i).shape as RAPIER.ConvexPolyhedron).vertices))
    expect(vertices.some(points => points.some((value, index) => index % 3 === 2 && value < -0.56))).toBe(true)
  })
})
