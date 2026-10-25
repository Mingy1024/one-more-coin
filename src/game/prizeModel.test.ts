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

  it('keeps the two visible eyes close to circular from the front', () => {
    const doll = createPrizeModel()
    for (const side of ['left', 'right']) {
      for (const part of ['eye', 'pupil']) {
        const mesh = doll.getObjectByName(`doll-${side}-${part}`) as THREE.Mesh
        mesh.updateWorldMatrix(true, false)
        const positions = mesh.geometry.getAttribute('position')
        const vertices = Array.from({ length: positions.count }, (_, index) =>
          new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld))
        const width = Math.max(...vertices.map((vertex) => vertex.x)) - Math.min(...vertices.map((vertex) => vertex.x))
        const height = Math.max(...vertices.map((vertex) => vertex.y)) - Math.min(...vertices.map((vertex) => vertex.y))

        expect(height / width, `${side} ${part}`).toBeLessThan(1.3)
      }
    }
  })

  it('keeps the rounded eye whites close to the blue head shell', () => {
    const doll = createPrizeModel()
    for (const side of ['left', 'right']) {
      const eye = doll.getObjectByName(`doll-${side}-eye`) as THREE.Mesh
      eye.updateMatrix()
      const positions = eye.geometry.getAttribute('position')
      const protrusions = Array.from({ length: positions.count }, (_, index) => {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(eye.matrix)
        const shellDepth = 0.22 * 0.82 * Math.sqrt(Math.max(0,
          1 - (vertex.x / 0.22) ** 2 - ((vertex.y - 0.105) / (0.22 * 0.98)) ** 2))
        return vertex.z - shellDepth
      })

      expect(Math.max(...protrusions), `${side} eye`).toBeLessThan(0.045)
    }
  })

  it('shapes the tear with a narrow upper tip and keeps it close to the head surface', () => {
    const tear = createPrizeModel().getObjectByName('doll-tear') as THREE.Mesh
    tear.updateMatrix()
    const positions = tear.geometry.getAttribute('position')
    const vertices = Array.from({ length: positions.count }, (_, index) =>
      new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(tear.matrix))
    const minY = Math.min(...vertices.map((vertex) => vertex.y))
    const height = Math.max(...vertices.map((vertex) => vertex.y)) - minY
    const width = Math.max(...vertices.map((vertex) => vertex.x)) - Math.min(...vertices.map((vertex) => vertex.x))
    const widthAt = (lower: number, upper: number): number => {
      const band = vertices.filter((vertex) => vertex.y >= minY + height * lower && vertex.y <= minY + height * upper)
      return Math.max(...band.map((vertex) => vertex.x)) - Math.min(...band.map((vertex) => vertex.x))
    }

    expect(height / width).toBeGreaterThan(1.5)
    expect(widthAt(0.15, 0.35)).toBeGreaterThan(widthAt(0.65, 0.85) * 1.25)
    for (const vertex of vertices) {
      const normalizedRadius = (vertex.x / 0.22) ** 2 + ((vertex.y - 0.105) / (0.22 * 0.98)) ** 2 + (vertex.z / (0.22 * 0.82)) ** 2
      expect(normalizedRadius).toBeLessThan(1.23)
    }
  })
})
