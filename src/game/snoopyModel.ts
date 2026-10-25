import * as THREE from 'three'

const IVORY = 0xf1ede3
const BLACK = 0x17191c
const RED = 0xa92b30

function fabric(paint?: (x: number, y: number, z: number) => number): THREE.MeshPhysicalMaterial {
  const width = 512
  const height = 256
  const pixels = new Uint8Array(width * height * 4)
  const nap = new Uint8Array(width * height)
  let seed = 1922
  for (let row = 0; row < height; row += 1) {
    const theta = (1 - row / (height - 1)) * Math.PI
    for (let column = 0; column < width; column += 1) {
      const phi = column / (width - 1) * Math.PI * 2
      const x = -Math.cos(phi) * Math.sin(theta)
      const y = Math.cos(theta)
      const z = Math.sin(phi) * Math.sin(theta)
      const color = paint?.(x, y, z) ?? IVORY
      const offset = (row * width + column) * 4
      seed = seed * 16807 % 2147483647
      const variation = 0.93 + seed % 70 / 1000
      pixels[offset] = (color >> 16 & 255) * variation
      pixels[offset + 1] = (color >> 8 & 255) * variation
      pixels[offset + 2] = (color & 255) * variation
      pixels[offset + 3] = 255
      nap[row * width + column] = 80 + seed % 145
    }
  }
  const map = new THREE.DataTexture(pixels, width, height)
  map.colorSpace = THREE.SRGBColorSpace
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  const bump = new THREE.DataTexture(nap, width, height, THREE.RedFormat)
  bump.needsUpdate = true
  return new THREE.MeshPhysicalMaterial({
    map, roughness: 0.98, metalness: 0, sheen: 1,
    sheenColorMap: map, sheenRoughness: 0.95,
    bumpMap: bump, bumpScale: 0.008,
  })
}

function faceColor(x: number, y: number, z: number): number {
  if (z < 0.2) return IVORY
  // Embroidered, sleepy eyes and the small smile follow the head's own UVs.
  const eyeX = (Math.abs(x) - 0.42) / 0.13
  const eyeY = (y - 0.31 + (Math.abs(x) - 0.42) * 0.4) / 0.048
  if (eyeX * eyeX + eyeY * eyeY < 1) return BLACK
  const browX = (Math.abs(x) - 0.43) / 0.09
  const browY = (y - 0.56 + (Math.abs(x) - 0.43) * 0.55) / 0.012
  if (browX * browX + browY * browY < 1) return BLACK
  const smile = y + 0.53 + 0.25 * (Math.abs(x) - 0.65) ** 2
  if (Math.abs(x) > 0.54 && Math.abs(x) < 0.83 && Math.abs(smile) < 0.012) return 0x48413a
  return IVORY
}

function plushPart(
  parent: THREE.Group,
  name: string,
  material: THREE.Material,
  center: [number, number, number],
  radii: [number, number, number],
  sculpt?: (x: number, y: number, z: number) => [number, number, number],
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, sculpt ? 80 : 40, sculpt ? 56 : 28)
  if (sculpt) {
    const vertices = geometry.getAttribute('position')
    for (let index = 0; index < vertices.count; index += 1) {
      const next = sculpt(vertices.getX(index), vertices.getY(index), vertices.getZ(index))
      vertices.setXYZ(index, ...next)
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

function muzzleHead(x: number, y: number, z: number): [number, number, number] {
  const front = Math.max(0, z)
  const snout = Math.exp(-(((y + 0.43) / 0.55) ** 4))
  const bridge = Math.exp(-(((y + 0.1) / 0.65) ** 4))
  const noseSlope = Math.max(0, 1 - Math.abs(x) * 0.1)
  return [
    x * (1 + 0.1 * snout * front),
    y - 0.07 * snout * front,
    z + front ** 0.7 * (0.47 * snout + 0.1 * bridge) * noseSlope,
  ]
}

function shortNap(parent: THREE.Group, surface: THREE.Mesh, color: number, count: number): void {
  surface.updateMatrix()
  const vertices = surface.geometry.getAttribute('position')
  const normals = surface.geometry.getAttribute('normal')
  const indices = surface.geometry.index!
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.matrix)
  const segments: number[] = []
  let seed = 6721
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  for (let strand = 0; strand < count; strand += 1) {
    const triangle = Math.floor(random() * indices.count / 3) * 3
    const a = indices.getX(triangle)
    const b = indices.getX(triangle + 1)
    const c = indices.getX(triangle + 2)
    const sample = Math.sqrt(random())
    const blend = random()
    const weights = [1 - sample, sample * (1 - blend), sample * blend]
    const root = new THREE.Vector3()
    const normal = new THREE.Vector3()
    for (const [corner, index] of [a, b, c].entries()) {
      root.addScaledVector(new THREE.Vector3().fromBufferAttribute(vertices, index), weights[corner]!)
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, index), weights[corner]!)
    }
    root.applyMatrix4(surface.matrix)
    normal.applyMatrix3(normalMatrix).normalize()
    const tip = root.clone().addScaledVector(normal, 0.008 + random() * 0.009)
    tip.y -= 0.004
    segments.push(...root.toArray(), ...tip.toArray())
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
  const nap = new THREE.LineSegments(geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.36 }))
  nap.name = `${surface.name}-nap`
  parent.add(nap)
}

function floppyEar(side: number): (x: number, y: number, z: number) => [number, number, number] {
  return (x, y, z) => {
    const lower = Math.max(0, -y)
    return [x * (1 + 0.09 * lower), y - 0.13 * lower ** 2,
      z + 0.18 * Math.sin((y + 1) * Math.PI * 0.5) - 0.08 * lower * side * x]
  }
}

export function createSnoopyModel(): THREE.Group {
  const doll = new THREE.Group()
  doll.name = 'snoopy-prize'
  const white = fabric()
  const dark = fabric(() => BLACK)

  const body = plushPart(doll, 'snoopy-body', white, [0, -0.25, -0.1], [0.28, 0.32, 0.28])
  shortNap(doll, body, IVORY, 1400)
  plushPart(doll, 'snoopy-tail', white, [0, -0.26, -0.39], [0.12, 0.14, 0.14])
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right'
    plushPart(doll, `snoopy-${label}-arm`, white,
      [side * 0.265, -0.28, 0.06], [0.14, 0.22, 0.16])
    plushPart(doll, `snoopy-${label}-leg`, white,
      [side * 0.18, -0.48, 0.2], [0.16, 0.17, 0.26])
  }

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.009, 8, 64),
    fabric(() => RED),
  )
  collar.name = 'snoopy-collar'
  collar.rotation.x = Math.PI / 2
  collar.position.set(0, -0.035, 0.015)
  collar.scale.y = 0.9
  doll.add(collar)

  const head = plushPart(doll, 'snoopy-head', fabric(faceColor),
    [0, 0.25, 0.14], [0.315, 0.31, 0.29], muzzleHead)
  shortNap(doll, head, IVORY, 2100)
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'left' : 'right'
    const ear = plushPart(doll, `snoopy-${label}-ear`, dark,
      [side * 0.305, 0.195, 0.115], [0.115, 0.245, 0.09], floppyEar(side))
    shortNap(doll, ear, 0x343438, 500)
  }
  plushPart(doll, 'snoopy-nose', dark,
    [0, 0.105, 0.59], [0.065, 0.056, 0.058])
  return doll
}
