import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createSnoopyModel } from './snoopyModel'

describe('Snoopy plush prize', () => {
  it('has a substantial seated silhouette that fits the shared prize collider', () => {
    const doll = createSnoopyModel()
    for (const name of ['snoopy-body', 'snoopy-head', 'snoopy-left-ear',
      'snoopy-right-ear', 'snoopy-left-leg', 'snoopy-right-leg', 'snoopy-nose']) {
      expect(doll.getObjectByName(name), name).toBeInstanceOf(THREE.Mesh)
    }
    const size = new THREE.Box3().setFromObject(doll).getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(0.65)
    expect(size.x).toBeLessThan(1.1)
    expect(size.y).toBeGreaterThan(0.8)
    expect(size.y).toBeLessThan(1.3)
  })

  it('uses textured plush surfaces with the facial embroidery painted onto the head', () => {
    const doll = createSnoopyModel()
    const head = doll.getObjectByName('snoopy-head') as THREE.Mesh
    const material = head.material as THREE.MeshPhysicalMaterial
    const map = material.map as THREE.DataTexture
    const pixels = map.image.data!
    let blackPixels = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index]! < 45) blackPixels += 1
    }
    expect(blackPixels).toBeGreaterThan(20)
    expect(material.roughness).toBeGreaterThan(0.9)
    expect(material.bumpMap).toBeInstanceOf(THREE.DataTexture)
    expect(doll.getObjectByName('snoopy-left-eye')).toBeUndefined()
  })

  it('colors both ears and the nose purple while keeping the eyes dark', () => {
    const doll = createSnoopyModel()
    for (const name of ['snoopy-left-ear', 'snoopy-right-ear', 'snoopy-nose']) {
      const mesh = doll.getObjectByName(name) as THREE.Mesh
      const material = mesh.material as THREE.MeshPhysicalMaterial
      const pixels = (material.map as THREE.DataTexture).image.data!
      expect(pixels[2]).toBeGreaterThan(pixels[0]!)
      expect(pixels[0]).toBeGreaterThan(pixels[1]!)
      expect(pixels[0]).toBeLessThan(110)
      expect(pixels[2]).toBeLessThan(150)
    }
  })
})
