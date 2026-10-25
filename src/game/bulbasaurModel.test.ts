import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createBulbasaurModel } from './bulbasaurModel'

describe('Bulbasaur plush prize', () => {
  it('has fused ears and four paws with a substantial bulb attached to its back', () => {
    const doll = createBulbasaurModel()
    for (const name of ['bulbasaur-body', 'bulbasaur-head', 'bulbasaur-bulb']) {
      expect(doll.getObjectByName(name), name).toBeInstanceOf(THREE.Mesh)
    }
    expect(doll.children.filter(child => child instanceof THREE.Mesh)).toHaveLength(3)
    const size = new THREE.Box3().setFromObject(doll).getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(0.7)
    expect(size.x).toBeLessThan(1.1)
    expect(size.y).toBeGreaterThan(0.95)
    expect(size.y).toBeLessThan(1.45)
    const bulb = doll.getObjectByName('bulbasaur-bulb') as THREE.Mesh
    const bulbBounds = new THREE.Box3().setFromObject(bulb)
    expect(bulbBounds.max.y).toBeGreaterThan(0.65)
    expect(bulbBounds.min.z).toBeLessThan(-0.85)
  })

  it('embroiders red eyes, an open purple smile, and green spots into plush', () => {
    const doll = createBulbasaurModel()
    const head = doll.getObjectByName('bulbasaur-head') as THREE.Mesh
    const material = head.material as THREE.MeshPhysicalMaterial
    const data = (material.map as THREE.DataTexture).image.data!
    let redPixels = 0
    let darkPixels = 0
    let mouthPixels = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! > 90 && data[index + 1]! < 90 && data[index + 2]! < 110) redPixels += 1
      if (data[index + 1]! < 150 && data[index + 2]! < 160) darkPixels += 1
      if (data[index]! > 80 && data[index]! < 160 && data[index + 1]! < 115
        && data[index + 2]! > 55 && data[index + 2]! < 150) mouthPixels += 1
    }
    expect(redPixels).toBeGreaterThan(100)
    expect(darkPixels).toBeGreaterThan(100)
    expect(mouthPixels).toBeGreaterThan(300)
    expect(material.roughness).toBeGreaterThan(0.9)
    expect(material.bumpMap).toBeInstanceOf(THREE.DataTexture)
    expect(doll.getObjectByName('bulbasaur-left-eye')).toBeUndefined()
  })
})
