import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createSlowpokeModel } from './slowpokeModel'

describe('Slowpoke plush prize', () => {
  it('has its large face, four paws and upward curved tail in one carryable group', () => {
    const doll = createSlowpokeModel()
    for (const name of ['slowpoke-body', 'slowpoke-head', 'slowpoke-tail',
      'slowpoke-left-ear', 'slowpoke-right-ear', 'slowpoke-front-left-leg',
      'slowpoke-rear-right-leg']) {
      expect(doll.getObjectByName(name), name).toBeInstanceOf(THREE.Mesh)
    }
    const bounds = new THREE.Box3().setFromObject(doll)
    const size = bounds.getSize(new THREE.Vector3())
    expect(size.x).toBeLessThan(1.1)
    expect(size.y).toBeGreaterThan(1)
    expect(size.y).toBeLessThan(1.5)
    expect(bounds.max.y).toBeGreaterThan(0.6)
  })

  it('keeps the muzzle, eyes and smile in the rough woven head material', () => {
    const doll = createSlowpokeModel()
    const head = doll.getObjectByName('slowpoke-head') as THREE.Mesh
    const material = head.material as THREE.MeshPhysicalMaterial
    const data = (material.map as THREE.DataTexture).image.data!
    let pale = 0
    let dark = 0
    for (let index = 0; index < data.length; index += 4) {
      if (data[index]! > 230 && data[index + 1]! > 220) pale += 1
      if (data[index]! < 65) dark += 1
    }
    expect(pale).toBeGreaterThan(100)
    expect(dark).toBeGreaterThan(20)
    expect(material.roughness).toBeGreaterThan(0.9)
    expect(material.bumpMap).toBeInstanceOf(THREE.DataTexture)
    expect(doll.getObjectByName('slowpoke-left-eye')).toBeUndefined()
  })
})
