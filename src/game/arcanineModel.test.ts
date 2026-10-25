import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createArcanineModel } from './arcanineModel'

describe('Arcanine plush prize', () => {
  it('has the recognizable orange body, cream mane, black stripes and fluffy tail', () => {
    const doll = createArcanineModel()

    for (const part of [
      'arcanine-body', 'arcanine-head', 'arcanine-mane', 'arcanine-tail',
      'arcanine-left-ear', 'arcanine-right-ear', 'arcanine-nose',
      'arcanine-front-left-paw', 'arcanine-front-right-paw',
    ]) {
      expect(doll.getObjectByName(part), part).toBeInstanceOf(THREE.Mesh)
    }
  })

  it('is a substantial 3D plush that fits inside the machine', () => {
    const bounds = new THREE.Box3().setFromObject(createArcanineModel())
    const size = bounds.getSize(new THREE.Vector3())

    expect(size.x).toBeGreaterThan(0.8)
    expect(size.y).toBeGreaterThan(1)
    expect(size.z).toBeGreaterThan(0.65)
    expect(size.x).toBeLessThan(1.25)
    expect(size.y).toBeLessThan(1.45)
  })

  it('uses rough, fiber-textured fabric rather than shiny figurine plastic', () => {
    const doll = createArcanineModel()
    const body = doll.getObjectByName('arcanine-body') as THREE.Mesh
    const material = body.material as THREE.MeshPhysicalMaterial

    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(material.roughness).toBeGreaterThanOrEqual(0.9)
    expect(material.sheen).toBeGreaterThan(0.7)
    expect(material.bumpMap).toBeInstanceOf(THREE.Texture)
    expect(material.map).toBeInstanceOf(THREE.DataTexture)
  })

  it('embeds facial markings and tiger stripes in the cloth instead of floating meshes', () => {
    const doll = createArcanineModel()
    for (const name of ['arcanine-head', 'arcanine-body', 'arcanine-front-left-leg']) {
      const mesh = doll.getObjectByName(name) as THREE.Mesh
      const map = (mesh.material as THREE.MeshPhysicalMaterial).map as THREE.DataTexture
      const data = map.image.data!
      let darkPixels = 0
      for (let i = 0; i < data.length; i += 4) if (data[i]! < 60) darkPixels += 1
      expect(darkPixels, name).toBeGreaterThan(20)
    }
    expect(doll.getObjectByName('arcanine-left-eye')).toBeUndefined()
    expect(doll.getObjectByName('arcanine-left-stripe')).toBeUndefined()
    expect(doll.getObjectByName('arcanine-mouth')).toBeUndefined()
  })
})
