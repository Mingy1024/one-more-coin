import * as THREE from 'three'

const ORANGE = 0xdf7d2d
const CREAM = 0xeee0bd
const DARK = 0x282623
type SurfaceColor = (x: number, y: number, z: number) => number

// Markings use the mesh UVs so they cannot float away from the cloth surface.
function cloth(colorAt: SurfaceColor, width = 512): THREE.MeshPhysicalMaterial {
  const height = width / 2
  const color = new Uint8Array(width * height * 4)
  const fibers = new Uint8Array(width * height)
  let seed = 4217
  for (let row = 0; row < height; row += 1) {
    const theta = (1 - row / (height - 1)) * Math.PI
    for (let column = 0; column < width; column += 1) {
      const phi = column / (width - 1) * Math.PI * 2
      const tint = colorAt(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
      const pixel = row * width + column
      seed = seed * 16807 % 2147483647
      const weave = 0.94 + (seed % 60) / 1000
      color.set([(tint >> 16 & 255) * weave, (tint >> 8 & 255) * weave, (tint & 255) * weave, 255], pixel * 4)
      fibers[pixel] = 90 + seed % 150
    }
  }
  const map = new THREE.DataTexture(color, width, height)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true
  const bump = new THREE.DataTexture(fibers, width, height, THREE.RedFormat)
  bump.needsUpdate = true
  return new THREE.MeshPhysicalMaterial({
    map, roughness: 0.98, metalness: 0, sheen: 1,
    sheenColor: new THREE.Color(0xffffff), sheenColorMap: map, sheenRoughness: 0.95,
    bumpMap: bump, bumpScale: 0.006,
  })
}

function faceColor(x: number, y: number, z: number): number {
  if (z < 0.25) return CREAM
  // The reference has a cream face and forehead, with orange eye sockets.
  const maskInner = 0.18 + 0.35 * Math.max(0, y)
  let tint = Math.abs(x) > maskInner && y > -0.08 + 0.6 * (Math.abs(x) - 0.4) ** 2
    && y < 0.32 + 0.2 * Math.abs(x) ? ORANGE : CREAM
  const side = x < 0 ? -1 : 1
  const eyeX = (Math.abs(x) - 0.43) / 0.19
  const eyeY = (y - (0.13 + (Math.abs(x) - 0.43) * 0.4)) / 0.16
  if (Math.abs(eyeX) < 1 && Math.abs(eyeY) < 1 - Math.abs(eyeX) * 0.65) {
    tint = Math.abs(eyeY) > 0.68 - Math.abs(eyeX) * 0.35 ? DARK : 0xfff8e6
    if (Math.abs(x - side * 0.4) < 0.062) tint = DARK
  }
  if (Math.abs(y + 0.56 - 0.23 * x * x) < 0.014 && Math.abs(x) < 0.55) tint = DARK
  return tint
}

function bodyColor(x: number, y: number, z: number): number {
  if (Math.abs(x) < 0.32) return ORANGE
  const stripe = (z + 0.18 * y + 1.4) * 3.1
  return stripe % 1 < 0.14 + 0.17 * Math.max(0, y) && y > -0.65 ? DARK : ORANGE
}

function legColor(x: number, y: number, z: number): number {
  return y > -0.18 && Math.abs(y - (0.38 - Math.abs(x) * 0.4)) < 0.18 && z > -0.5 ? DARK : ORANGE
}

function oval(parent: THREE.Group, name: string, material: THREE.Material,
  center: [number, number, number], radii: [number, number, number], shape?: 'mane' | 'face' | 'tail' | 'ear-left' | 'ear-right'): THREE.Mesh {
  const sculpted = shape === 'mane' || shape === 'face'
  const geometry = new THREE.SphereGeometry(1, sculpted ? 96 : 48, sculpted ? 64 : 32)
  if (shape) {
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      if (shape === 'mane') {
        const angle = Math.abs(Math.atan2(x, y))
        // Uneven crown, temple and downward cheek tufts share one closed surface.
        const peaks = [[0, 0.5, 0.16], [0.5, 0.18, 0.18], [0.9, 0.2, 0.17],
          [1.35, 0.13, 0.2], [1.72, 0.18, 0.19], [2.1, 0.12, 0.18],
          [2.5, 0.16, 0.2], [Math.PI, 0.35, 0.28]]
        const tuft = peaks.reduce((sum, [at, height, width]) =>
          sum + height! * Math.exp(-(((angle - at!) / width!) ** 2)), 0)
        const edge = 1 - z * z
        const flow = 0.008 * Math.sin(angle * 37 + y * 5 + z * 9) * Math.max(0, z)
        positions.setXYZ(i, x * (1 + tuft * edge),
          y * (1 + tuft * edge) - Math.max(0, angle - 1.3) * 0.06 * edge,
          z + flow)
      } else if (shape === 'face') {
        const front = Math.max(0, z)
        const muzzle = 0.55 * Math.exp(-((x / 0.7) ** 4) - ((y + 0.36) / 0.4) ** 4) * front ** 3
        const sockets = 0.05 * Math.exp(-(((Math.abs(x) - 0.43) / 0.22) ** 2) - ((y - 0.16) / 0.2) ** 2) * front
        const brow = 0.14 * Math.exp(-(((Math.abs(x) - 0.4) / 0.3) ** 2) - ((y - 0.36) / 0.13) ** 2) * front
        const crest = 0.28 * Math.max(0, y) ** 4 * (0.65 + 0.35 * Math.cos(x * 14))
        positions.setXYZ(i, x * (1 - 0.14 * Math.max(0, y)),
          y < -0.6 ? -0.6 + (y + 0.6) * 0.65 : y + crest,
          z > 0 ? 0.84 * z ** 0.65 + muzzle - sockets + brow
            + 0.025 * Math.sin(x * 34 + y * 4) * front * Math.max(0, y) : z)
      } else if (shape === 'tail') {
        const lobes = 1 + 0.12 * Math.max(0, Math.cos(Math.atan2(z, y) * 7)) ** 5
        positions.setXYZ(i, x + 0.45 * Math.max(0, y) ** 2,
          y * lobes, z * lobes - 0.2 * Math.max(0, y))
      } else {
        const taper = 1 - 0.65 * Math.max(0, x * (shape === 'ear-left' ? -1 : 1))
        positions.setXYZ(i, x, y * taper, z * taper)
      }
    }
    geometry.computeVertexNormals()
  }
  const part = new THREE.Mesh(geometry, material)
  part.name = name
  part.position.set(...center)
  part.scale.set(...radii)
  part.castShadow = part.receiveShadow = true
  parent.add(part)
  return part
}

function rootedFur(parent: THREE.Group, surface: THREE.Mesh, count: number, face = false): void {
  surface.updateMatrix()
  const geometry = surface.geometry
  const vertices = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const indices = geometry.index!
  const strands: number[] = []
  let seed = 1973
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.matrix)
  const normals = geometry.getAttribute('normal')
  for (let i = 0; i < count; i += 1) {
    const triangle = Math.floor(random() * (indices.count / 3)) * 3
    const a = indices.getX(triangle)
    const b = indices.getX(triangle + 1)
    const c = indices.getX(triangle + 2)
    const u = Math.sqrt(random())
    const v = random()
    const weights = [1 - u, u * (1 - v), u * v]
    const root = new THREE.Vector3()
    const normal = new THREE.Vector3()
    let textureY = 0
    for (const [corner, index] of [a, b, c].entries()) {
      root.addScaledVector(new THREE.Vector3().fromBufferAttribute(vertices, index), weights[corner]!)
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, index), weights[corner]!)
      textureY += uv.getY(index) * weights[corner]!
    }
    // Keep embroidered eyes and the muzzle clear; fur grows from the forehead.
    if (face && textureY < 0.65) continue
    root.applyMatrix4(surface.matrix)
    normal.applyMatrix3(normalMatrix).normalize()
    const direction = normal.clone().add(new THREE.Vector3(root.x * 0.5, root.y > 0.4 ? 0.45 : -0.65, 0)).normalize()
    const length = (face ? 0.009 : 0.014) + random() * 0.014
    const start = root.clone().addScaledVector(normal, -0.001)
    const end = root.clone().addScaledVector(direction, length)
    strands.push(...start.toArray(), ...end.toArray())
  }
  const fur = new THREE.BufferGeometry()
  fur.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3))
  const fibers = new THREE.LineSegments(fur, new THREE.LineBasicMaterial({color: CREAM, transparent: true, opacity: 0.52}))
  fibers.name = `${surface.name}-rooted-fur`
  parent.add(fibers)
}

export function createArcanineModel(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'arcanine-prize'
  const cream = cloth(() => CREAM)
  const orange = cloth(() => ORANGE)
  const dark = cloth(() => DARK)
  const stripedLeg = cloth(legColor)

  oval(root, 'arcanine-body', cloth(bodyColor), [0, -0.17, -0.08], [0.32, 0.32, 0.29])
  oval(root, 'arcanine-tail', cream, [0.19, 0.015, -0.31], [0.22, 0.44, 0.23], 'tail')

  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'left' : 'right'
    oval(root, `arcanine-back-${label}-paw`, stripedLeg, [side * 0.25, -0.4, -0.14], [0.17, 0.19, 0.19])
    oval(root, `arcanine-front-${label}-leg`, stripedLeg, [side * 0.19, -0.32, 0.18], [0.115, 0.24, 0.13])
    oval(root, `arcanine-front-${label}-paw`, orange, [side * 0.19, -0.5, 0.24], [0.135, 0.1, 0.16])
  }

  const mane = oval(root, 'arcanine-mane', cream, [0, 0.18, 0.005], [0.33, 0.34, 0.265], 'mane')
  const head = oval(root, 'arcanine-head', cloth(faceColor, 1024), [0, 0.255, 0.145], [0.29, 0.245, 0.225], 'face')
  rootedFur(root, mane, 3200)
  rootedFur(root, head, 2000, true)
  const nose = oval(root, 'arcanine-nose', dark, [0, 0.19, 0.452], [0.042, 0.028, 0.022])
  const noseVertices = nose.geometry.getAttribute('position')
  for (let i = 0; i < noseVertices.count; i += 1) {
    noseVertices.setX(i, noseVertices.getX(i) * (0.75 + noseVertices.getY(i) * 0.25))
  }
  nose.geometry.computeVertexNormals()

  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'left' : 'right'
    const ear = cloth((x, y, z) => z > 0.4 && (x / 0.76) ** 2 + (y / 0.7) ** 2 < 1 ? CREAM : ORANGE)
    const outer = oval(root, `arcanine-${label}-ear`, ear, [side * 0.3, 0.4, 0.14], [0.15, 0.09, 0.075], `ear-${label}`)
    outer.rotation.z = side * 0.36
  }
  return root
}
