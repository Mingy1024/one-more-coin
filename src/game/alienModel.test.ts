import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createAlienModel } from './alienModel'

describe('three-eyed alien plush', () => {
  it('has a continuous head, ears and antenna and fits the prize collider', () => {
    const doll = createAlienModel()
    expect(doll.name).toBe('alien-plush')
    const head = doll.getObjectByName('alien-head') as THREE.Mesh
    expect(head).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('alien-left-ear')).toBeUndefined()
    expect(doll.getObjectByName('alien-antenna')).toBeUndefined()
    const size = new THREE.Box3().setFromObject(doll).getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(0.85)
    expect(size.x).toBeLessThan(1.4)
    expect(size.y).toBeGreaterThan(1.05)
    expect(size.y).toBeLessThan(1.6)
    expect(size.z).toBeLessThan(1)
  })

  it('has exactly three raised fabric eyes and attached three-finger hands', () => {
    const doll = createAlienModel()
    const eyes = doll.children.filter(child => /^alien-eye-[123]$/.test(child.name))
    expect(eyes).toHaveLength(3)
    expect(doll.getObjectByName('alien-left-hand')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('alien-right-hand')).toBeInstanceOf(THREE.Mesh)
    const headMaterial = (doll.getObjectByName('alien-head') as THREE.Mesh).material as THREE.MeshPhysicalMaterial
    expect(headMaterial.roughness).toBeGreaterThan(0.9)
    expect(headMaterial.bumpMap).toBeInstanceOf(THREE.DataTexture)
  })

  it('includes the purple collar, cyan suit and dark blue belt', () => {
    const doll = createAlienModel()
    for (const name of ['alien-collar', 'alien-suit', 'alien-belt', 'alien-left-foot', 'alien-right-foot']) {
      expect(doll.getObjectByName(name), name).toBeInstanceOf(THREE.Mesh)
    }
  })
})
