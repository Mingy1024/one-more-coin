import * as THREE from 'three'

/** A compact convex plush envelope includes ears, bulbs and tails at every orientation. */
export function prizeCollisionVertices(model: THREE.Group): { vertices: Float32Array; parts: Float32Array[]; bounds: THREE.Box3 } {
  model.updateWorldMatrix(true, true)
  const inverseRoot = model.matrixWorld.clone().invert()
  const points: number[] = []
  const parts: Float32Array[] = []
  const bounds = new THREE.Box3()
  const vertex = new THREE.Vector3()
  model.traverse(part => {
    if (!(part instanceof THREE.Mesh)) return
    const positions = part.geometry.getAttribute('position')
    if (!positions) return
    const transform = inverseRoot.clone().multiply(part.matrixWorld)
    const partPoints: number[] = []
    const partBounds = new THREE.Box3()
    const stride = Math.max(1, Math.floor(positions.count / 256))
    for (let index = 0; index < positions.count; index++) {
      vertex.fromBufferAttribute(positions, index).applyMatrix4(transform)
      bounds.expandByPoint(vertex)
      partBounds.expandByPoint(vertex)
      if (index % stride === 0) partPoints.push(vertex.x, vertex.y, vertex.z)
    }
    const size = partBounds.getSize(new THREE.Vector3())
    if (Math.max(size.x, size.y, size.z) > 0.15 && Math.min(size.x, size.y, size.z) > 0.025) {
      parts.push(new Float32Array(partPoints))
      points.push(...partPoints)
    }
  })
  return { vertices: new Float32Array(points), parts, bounds }
}
