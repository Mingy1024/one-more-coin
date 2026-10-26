import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { ClawMachineGame, INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'
import { PRIZE_HALF_DEPTH, PRIZE_HALF_HEIGHT, PRIZE_HALF_WIDTH } from './prizeInteraction'

beforeAll(async () => { await RAPIER.init() })

function cabinet() {
  const scene = new THREE.Scene()
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  const game = Object.assign(Object.create(ClawMachineGame.prototype), { scene, world }) as ClawMachineGame
  ;(game as unknown as { addCabinet(): void }).addCabinet()
  return { scene, world }
}

describe('cabinet containment and chute', () => {
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
    for (const placement of INITIAL_PRIZE_PLACEMENTS) {
      const overlaps: RAPIER.Collider[] = []
      world.intersectionsWithShape(
        placement.position,
        placement.rotation,
        new RAPIER.Cuboid(PRIZE_HALF_WIDTH, PRIZE_HALF_HEIGHT, PRIZE_HALF_DEPTH),
        collider => { if (guards.includes(collider)) overlaps.push(collider); return true },
      )
      expect(overlaps).toHaveLength(0)
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

  it('gives Slowpoke’s projecting tail its own collision volume', () => {
    const { scene, world } = cabinet()
    const game = Object.assign(Object.create(ClawMachineGame.prototype), { scene, world }) as ClawMachineGame
    const placement = { position: { x: -0.38, y: 0.68, z: 0.55 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }
    const prize = (game as unknown as {
      createPrize(start: typeof placement, mesh: THREE.Group, color: number, glow: number, kind: string): {
        body: RAPIER.RigidBody
      }
    }).createPrize(placement, new THREE.Group(), 0xffffff, 0, 'slowpoke')
    expect(prize.body.numColliders()).toBeGreaterThan(1)
    const tail = prize.body.collider(1)
    expect(tail.translation().z).toBeLessThan(placement.position.z - 0.35)
  })
})
