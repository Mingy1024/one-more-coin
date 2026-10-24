import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createPrizeModel } from './prizeModel'

describe('three-dimensional doll prize', () => {
  it('builds the recognizable face and body from separate 3D parts', () => {
    const doll = createPrizeModel()

    expect(doll.getObjectByName('doll-head')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-body')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-face')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-mouth')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-bell')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-left-foot')).toBeInstanceOf(THREE.Mesh)
    expect(doll.getObjectByName('doll-right-foot')).toBeInstanceOf(THREE.Mesh)
  })

  it('has real depth instead of using a flat picture plane', () => {
    const doll = createPrizeModel()
    const bounds = new THREE.Box3().setFromObject(doll)
    const size = bounds.getSize(new THREE.Vector3())

    expect(size.x).toBeGreaterThan(1)
    expect(size.y).toBeGreaterThan(1.15)
    expect(size.z).toBeGreaterThan(0.58)
  })

  it('uses rough fabric shading and a visible fiber layer', () => {
    const doll = createPrizeModel()
    const head = doll.getObjectByName('doll-head') as THREE.Mesh
    const material = head.material as THREE.MeshPhysicalMaterial

    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial)
    expect(material.roughness).toBeGreaterThanOrEqual(0.9)
    expect(material.sheen).toBeGreaterThanOrEqual(0.8)
    expect(material.bumpMap).toBeInstanceOf(THREE.Texture)
    expect(doll.getObjectByName('doll-fuzz')).toBeInstanceOf(THREE.Points)
  })

  it('lets the separate eye whites visibly overlap the top of the white face patch', () => {
    const doll = createPrizeModel()
    const face = doll.getObjectByName('doll-face')
    const leftEye = doll.getObjectByName('doll-left-eye')
    const rightEye = doll.getObjectByName('doll-right-eye')

    expect(face).toBeInstanceOf(THREE.Mesh)
    expect(leftEye).toBeInstanceOf(THREE.Mesh)
    expect(rightEye).toBeInstanceOf(THREE.Mesh)

    const faceBounds = new THREE.Box3().setFromObject(face!)
    for (const eye of [leftEye!, rightEye!]) {
      const eyeBounds = new THREE.Box3().setFromObject(eye)

      expect(eyeBounds.max.y).toBeGreaterThan(faceBounds.max.y + 0.045)
      expect(eyeBounds.min.y).toBeLessThan(faceBounds.max.y - 0.035)
    }
  })

  it('wraps the red collar around both the front and back of the neck', () => {
    const collar = createPrizeModel().getObjectByName('doll-collar') as THREE.Mesh
    const positions = collar.geometry.getAttribute('position')
    const depths = Array.from({ length: positions.count }, (_, index) => positions.getZ(index))

    expect(Math.min(...depths)).toBeLessThan(-0.12)
    expect(Math.max(...depths)).toBeGreaterThan(0.12)
  })
})
