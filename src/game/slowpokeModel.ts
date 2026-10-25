import * as THREE from 'three'

const PINK = 0xe99aaf
const CREAM = 0xf4e8b3
const WHITE = 0xf8f5ed
const INK = 0x29282b

type Paint = (x: number, y: number, z: number) => number

function fleece(paint: Paint): THREE.MeshPhysicalMaterial {
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

function oval(
  parent: THREE.Group, name: string, material: THREE.Material,
  center: [number, number, number], radii: [number, number, number],
  sculpt?: (x: number, y: number, z: number) => [number, number, number],
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, sculpt ? 80 : 48, sculpt ? 56 : 32)
  if (sculpt) {
    const positions = geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index += 1) {
      positions.setXYZ(index, ...sculpt(positions.getX(index), positions.getY(index), positions.getZ(index)))
    }
    geometry.computeVertexNormals()
  }
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(...center)
  mesh.scale.set(...radii)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function sculptHead(x: number, y: number, z: number): [number, number, number] {
  const front = Math.max(0, z)
  const muzzle = Math.exp(-(((y + 0.43) / 0.56) ** 4))
  return [x * (1 + 0.1 * muzzle * front), y - 0.03 * muzzle * front,
    z + 0.24 * front ** 0.8 * muzzle]
}

function addNap(parent: THREE.Group, surface: THREE.Mesh, count: number): void {
  surface.updateMatrix()
  const geometry = surface.geometry
  const vertices = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const indices = geometry.index!
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.matrix)
  const strands: number[] = []
  let seed = 4861
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  for (let strand = 0; strand < count; strand += 1) {
    const triangle = Math.floor(random() * indices.count / 3) * 3
    const corners = [indices.getX(triangle), indices.getX(triangle + 1), indices.getX(triangle + 2)]
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
  const feet = fleece((_x, y, z) => y < -0.58 && z > 0.24 ? WHITE : PINK)

  const body = oval(doll, 'slowpoke-body', pink, [0, -0.2, -0.16], [0.34, 0.29, 0.39])
  addNap(doll, body, 1600)
  curvedTail(doll, pink.bumpMap!)
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right'
    oval(doll, `slowpoke-front-${label}-leg`, feet,
      [side * 0.24, -0.37, 0.28], [0.135, 0.19, 0.18])
    oval(doll, `slowpoke-rear-${label}-leg`, feet,
      [side * 0.24, -0.36, -0.38], [0.15, 0.19, 0.18])
  }
  const head = oval(doll, 'slowpoke-head', fleece(headPaint),
    [0, 0.1, 0.24], [0.325, 0.27, 0.29], sculptHead)
  addNap(doll, head, 1800)
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right'
    oval(doll, `slowpoke-${label}-ear`, pink,
      [side * 0.25, 0.34, 0.19], [0.11, 0.12, 0.09])
  }
  return doll
}
