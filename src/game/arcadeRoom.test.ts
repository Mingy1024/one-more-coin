import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createArcadeRoom } from './arcadeRoom'

describe('arcade room backdrop', () => {
  it('provides a floor under the cabinet and walls behind the camera orbit', () => {
    const room = createArcadeRoom()
    const floor = room.getObjectByName('arcade-floor') as THREE.Mesh | undefined
    const wall = room.getObjectByName('arcade-back-wall') as THREE.Mesh | undefined

    expect(floor).toBeInstanceOf(THREE.Mesh)
    expect(floor?.position.y).toBeCloseTo(-1.6, 1)
    expect(floor?.receiveShadow).toBe(true)
    expect(wall).toBeInstanceOf(THREE.Mesh)
    expect(wall?.position.z).toBeLessThan(-8)
  })

  it('places subdued neighboring cabinets outside the playable cabinet', () => {
    const room = createArcadeRoom()
    const left = room.getObjectByName('arcade-neighbor-left')
    const right = room.getObjectByName('arcade-neighbor-right')

    expect(left?.position.x).toBeLessThan(-4)
    expect(right?.position.x).toBeGreaterThan(4)
    expect(left?.position.z).toBeLessThan(-5)
    expect(right?.position.z).toBeLessThan(-5)
  })

  it('keeps the comic detailing on the room and neighboring cabinets', () => {
    const room = createArcadeRoom()
    const halftone = room.getObjectByName('arcade-comic-halftone')
    const rays = room.getObjectByName('arcade-comic-rays')
    const neighbor = room.getObjectByName('arcade-neighbor-left')

    expect(halftone).toBeInstanceOf(THREE.InstancedMesh)
    expect(rays).toBeInstanceOf(THREE.Group)
    expect(neighbor?.getObjectByName('arcade-neighbor-outline')).toBeInstanceOf(THREE.LineSegments)
  })
})
