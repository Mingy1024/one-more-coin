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

    expect(size.x).toBeGreaterThan(0.65)
    expect(size.y).toBeGreaterThan(0.76)
    expect(size.z).toBeGreaterThan(0.38)
  })
})
