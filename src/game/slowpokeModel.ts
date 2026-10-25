import * as THREE from 'three'

const PINK = 0xe99aaf
const CREAM = 0xf4e8b3
const WHITE = 0xf8f5ed
const INK = 0x29282b

type Paint = (x: number, y: number, z: number) => number

export function fleece(paint: Paint): THREE.MeshPhysicalMaterial {
  const width = 512
  const height = 256
  const colors = new Uint8Array(width * height * 4)
  const fibers = new Uint8Array(width * height)
  let seed = 8197
  for (let row = 0; row < height; row += 1) {
    const theta = (1 - row / (height - 1)) * Math.PI
    for (let column = 0; column < width; column += 1) {
      const phi = column / (width - 1) * Math.PI * 2
      const x = -Math.cos(phi) * Math.sin(theta)
      const y = Math.cos(theta)
      const z = Math.sin(phi) * Math.sin(theta)
      const tint = paint(x, y, z)
      const pixel = row * width + column
      seed = seed * 16807 % 2147483647
      const variation = 0.93 + seed % 70 / 1000
      colors.set([
        (tint >> 16 & 255) * variation,
        (tint >> 8 & 255) * variation,
        (tint & 255) * variation,
        255,
      ], pixel * 4)
      fibers[pixel] = 95 + seed % 135
    }
  }
  const map = new THREE.DataTexture(colors, width, height)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  const bump = new THREE.DataTexture(fibers, width, height, THREE.RedFormat)
  bump.needsUpdate = true
  return new THREE.MeshPhysicalMaterial({
    map, roughness: 0.99, metalness: 0, sheen: 1,
    sheenColorMap: map, sheenRoughness: 0.96,
    bumpMap: bump, bumpScale: 0.009,
  })
}

function headPaint(x: number, y: number, z: number): number {
  if (z < 0.12) return PINK
  const cream = (x / 0.94) ** 4 + ((y + 0.45) / 0.53) ** 4 < 1.35
  if (cream) {
    const mouth = y + 0.56 - 0.12 * x * x
    if (Math.abs(x) < 0.9 && Math.abs(mouth) < 0.014) return INK
    if (Math.abs(Math.abs(x) - 0.27) < 0.027 && Math.abs(y + 0.25 + 0.1 * Math.abs(x)) < 0.027) return INK
    if (Math.abs(Math.abs(x) - 0.61) < 0.037 && y < -0.54 && y > -0.67) return WHITE
    return CREAM
  }
  const eyeX = (Math.abs(x) - 0.49) / 0.21
  const eyeY = (y - 0.25) / 0.32
  if (eyeX * eyeX + eyeY * eyeY < 1) {
    if (((Math.abs(x) - 0.49) / 0.052) ** 2 + ((y - 0.25) / 0.067) ** 2 < 1) return INK
    return WHITE
  }
  return PINK
}

export type Ellipsoid = { center: [number, number, number]; radii: [number, number, number] }

// A rounded union gives the ears and four paws volume without visible sphere seams.
export function fusedSurface(
  parent: THREE.Group, name: string, material: THREE.Material,
  parts: Ellipsoid[], blend: number,
  bounds: { min: [number, number, number]; max: [number, number, number] },
  uvBody: Ellipsoid,
  step = 0.04,
): THREE.Mesh {
  const distance = (point: THREE.Vector3): number => {
    let result = Infinity
    for (const part of parts) {
      const [cx, cy, cz] = part.center
      const [rx, ry, rz] = part.radii
      const dx = (point.x - cx) / rx
      const dy = (point.y - cy) / ry
      const dz = (point.z - cz) / rz
      const next = (Math.hypot(dx, dy, dz) - 1) * Math.min(rx, ry, rz)
      if (result === Infinity) { result = next; continue }
      const h = Math.max(0, blend - Math.abs(result - next)) / blend
      result = Math.min(result, next) - h * h * blend * 0.25
    }
    return result
  }
  const normalAt = (point: THREE.Vector3): THREE.Vector3 => {
    const e = 0.003
    return new THREE.Vector3(
      distance(new THREE.Vector3(point.x + e, point.y, point.z)) - distance(new THREE.Vector3(point.x - e, point.y, point.z)),
      distance(new THREE.Vector3(point.x, point.y + e, point.z)) - distance(new THREE.Vector3(point.x, point.y - e, point.z)),
      distance(new THREE.Vector3(point.x, point.y, point.z + e)) - distance(new THREE.Vector3(point.x, point.y, point.z - e)),
    ).normalize()
  }
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const corners = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
    [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]]
  const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
  const counts = bounds.min.map((low, axis) => Math.ceil((bounds.max[axis]! - low) / step))
  for (let ix = 0; ix < counts[0]!; ix += 1) {
    for (let iy = 0; iy < counts[1]!; iy += 1) {
      for (let iz = 0; iz < counts[2]!; iz += 1) {
        const points = corners.map(([dx, dy, dz]) => new THREE.Vector3(
          bounds.min[0] + (ix + dx!) * step,
          bounds.min[1] + (iy + dy!) * step,
          bounds.min[2] + (iz + dz!) * step,
        ))
        const values = points.map(distance)
        if (values.every(value => value > 0) || values.every(value => value <= 0)) continue
        for (const tetra of tetrahedra) {
          const crossings: THREE.Vector3[] = []
          for (const [a, b] of edges) {
            const first = tetra[a!]!
            const second = tetra[b!]!
            const va = values[first]!
            const vb = values[second]!
            if ((va <= 0) === (vb <= 0)) continue
            crossings.push(points[first]!.clone().lerp(points[second]!, va / (va - vb)))
          }
          if (crossings.length < 3) continue
          const center = crossings.reduce((sum, point) => sum.add(point), new THREE.Vector3())
            .multiplyScalar(1 / crossings.length)
          const faceNormal = normalAt(center)
          const tangent = crossings[0]!.clone().sub(center).normalize()
          const bitangent = new THREE.Vector3().crossVectors(faceNormal, tangent).normalize()
          crossings.sort((a, b) => {
            const pa = a.clone().sub(center)
            const pb = b.clone().sub(center)
            return Math.atan2(pa.dot(bitangent), pa.dot(tangent))
              - Math.atan2(pb.dot(bitangent), pb.dot(tangent))
          })
          for (let index = 1; index < crossings.length - 1; index += 1) {
            const triangle = [crossings[0]!, crossings[index]!, crossings[index + 1]!]
            const triangleUvs = triangle.map(point => {
              const unit = new THREE.Vector3(
                (point.x - uvBody.center[0]) / uvBody.radii[0],
                (point.y - uvBody.center[1]) / uvBody.radii[1],
                (point.z - uvBody.center[2]) / uvBody.radii[2],
              ).normalize()
              const phi = (Math.atan2(unit.z, -unit.x) + Math.PI * 2) % (Math.PI * 2)
              return [phi / (Math.PI * 2), 1 - Math.acos(THREE.MathUtils.clamp(unit.y, -1, 1)) / Math.PI]
            })
            const seam = Math.max(...triangleUvs.map(uv => uv[0]!)) - Math.min(...triangleUvs.map(uv => uv[0]!)) > 0.5
            triangle.forEach((point, corner) => {
              positions.push(...point.toArray())
              normals.push(...normalAt(point).toArray())
              const [u, v] = triangleUvs[corner]!
              uvs.push(seam && u! < 0.5 ? u! + 1 : u!, v!)
            })
          }
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addNap(parent: THREE.Group, surface: THREE.Mesh, count: number): void {
  surface.updateMatrix()
  const geometry = surface.geometry
  const vertices = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const indices = geometry.index
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.matrix)
  const strands: number[] = []
  let seed = 4861
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  for (let strand = 0; strand < count; strand += 1) {
    const triangle = Math.floor(random() * (indices?.count ?? vertices.count) / 3) * 3
    const corners = indices
      ? [indices.getX(triangle), indices.getX(triangle + 1), indices.getX(triangle + 2)]
      : [triangle, triangle + 1, triangle + 2]
    const u = Math.sqrt(random())
    const v = random()
    const weights = [1 - u, u * (1 - v), u * v]
    const root = new THREE.Vector3()
    const normal = new THREE.Vector3()
    corners.forEach((corner, index) => {
      root.addScaledVector(new THREE.Vector3().fromBufferAttribute(vertices, corner), weights[index]!)
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, corner), weights[index]!)
    })
    // Keep the embroidered expression and cream muzzle free of pink fibers.
    if (surface.name === 'slowpoke-head' && root.z > 0.15 && root.y < 0.6) continue
    root.applyMatrix4(surface.matrix)
    normal.applyMatrix3(normalMatrix).normalize()
    const end = root.clone().addScaledVector(normal, 0.008 + random() * 0.008)
    end.y -= 0.004
    strands.push(...root.toArray(), ...end.toArray())
  }
  const fuzz = new THREE.BufferGeometry()
  fuzz.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3))
  const lines = new THREE.LineSegments(fuzz,
    new THREE.LineBasicMaterial({ color: PINK, transparent: true, opacity: 0.3 }))
  lines.name = `${surface.name}-nap`
  parent.add(lines)
}

function curvedTail(parent: THREE.Group, pinkBump: THREE.Texture): THREE.Mesh {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.14, -0.16, -0.43),
    new THREE.Vector3(0.22, 0.06, -0.52),
    new THREE.Vector3(0.29, 0.35, -0.61),
    new THREE.Vector3(0.36, 0.62, -0.6),
    new THREE.Vector3(0.37, 0.72, -0.45),
    new THREE.Vector3(0.25, 0.68, -0.34),
  ])
  const rings = 40
  const sides = 16
  const frames = path.computeFrenetFrames(rings, false)
  const positions: number[] = []
  const colors: number[] = []
  const uv: number[] = []
  const indices: number[] = []
  const pink = new THREE.Color(PINK)
  const cream = new THREE.Color(WHITE)
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings
    const point = path.getPoint(t)
    const side = frames.normals[ring]!
    const up = frames.binormals[ring]!
    const radius = (0.12 - 0.045 * t) * Math.min(1, (1 - t) * 16 + 0.04)
    const pale = THREE.MathUtils.smoothstep(t, 0.72, 0.86)
    const tint = pink.clone().lerp(cream, pale)
    for (let angle = 0; angle <= sides; angle += 1) {
      const around = angle / sides * Math.PI * 2
      const vertex = point.clone().addScaledVector(side, Math.cos(around) * radius)
        .addScaledVector(up, Math.sin(around) * radius)
      positions.push(...vertex.toArray())
      colors.push(tint.r, tint.g, tint.b)
      uv.push(angle / sides, t)
      if (ring < rings && angle < sides) {
        const a = ring * (sides + 1) + angle
        indices.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const tail = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.99, metalness: 0, sheen: 1, sheenRoughness: 0.96,
    bumpMap: pinkBump, bumpScale: 0.008, side: THREE.DoubleSide,
  }))
  tail.name = 'slowpoke-tail'
  tail.castShadow = tail.receiveShadow = true
  parent.add(tail)
  return tail
}

export function createSlowpokeModel(): THREE.Group {
  const doll = new THREE.Group()
  doll.name = 'slowpoke-prize'
  const pink = fleece(() => PINK)
  const bodyFabric = fleece((x, y, z) =>
    y < -0.65 && Math.abs(x) > 0.3 && Math.abs(z) > 0.4 ? WHITE : PINK)

  const bodyCore: Ellipsoid = { center: [0, -0.2, -0.16], radii: [0.34, 0.29, 0.39] }
  const bodyParts: Ellipsoid[] = [bodyCore]
  for (const side of [-1, 1]) {
    bodyParts.push(
      { center: [side * 0.24, -0.39, 0.28], radii: [0.145, 0.2, 0.18] },
      { center: [side * 0.24, -0.38, -0.38], radii: [0.15, 0.19, 0.18] },
    )
  }
  const body = fusedSurface(doll, 'slowpoke-body', bodyFabric, bodyParts, 0.12,
    { min: [-0.55, -0.7, -0.8], max: [0.55, 0.25, 0.6] }, bodyCore)
  addNap(doll, body, 1600)
  curvedTail(doll, pink.bumpMap!)
  const headCore: Ellipsoid = { center: [0, 0.1, 0.24], radii: [0.325, 0.27, 0.29] }
  const head = fusedSurface(doll, 'slowpoke-head', fleece(headPaint), [
    headCore,
    { center: [0, -0.035, 0.43], radii: [0.29, 0.145, 0.19] },
    { center: [-0.265, 0.4, 0.19], radii: [0.115, 0.13, 0.1] },
    { center: [0.265, 0.4, 0.19], radii: [0.115, 0.13, 0.1] },
  ], 0.08, { min: [-0.52, -0.27, -0.11], max: [0.52, 0.59, 0.72] }, headCore, 0.032)
  addNap(doll, head, 1800)
  return doll
}
