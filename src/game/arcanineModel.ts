import * as THREE from 'three'

const ORANGE = 0xdf7d2d
const CREAM = 0xeee0bd
const DARK = 0x282623
type SurfaceColor = (x: number, y: number, z: number) => number

// Markings use the mesh UVs so they cannot float away from the cloth surface.
function cloth(colorAt: SurfaceColor): THREE.MeshPhysicalMaterial {
  const width = 512
  const height = 256
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
  if (z < 0.25) return ORANGE
  let tint = (x / 0.92) ** 2 + ((y + 0.55) / 0.72) ** 2 < 1
    || (y > 0.14 && Math.abs(x) < 0.12 + 0.3 * y) ? CREAM : ORANGE
  const side = x < 0 ? -1 : 1
  const eyeX = (Math.abs(x) - 0.43) / 0.22
  const eyeY = (y - (0.13 + (Math.abs(x) - 0.43) * 0.45)) / 0.17
  if (Math.abs(eyeX) < 1 && Math.abs(eyeY) < 1 - Math.abs(eyeX) * 0.65) {
    tint = Math.abs(eyeY) > 0.68 - Math.abs(eyeX) * 0.35 ? DARK : 0xfff8e6
    if (Math.abs(x - side * 0.4) < 0.062) tint = DARK
  }
  if (Math.abs(y + 0.56 - 0.15 * x * x) < 0.018 && Math.abs(x) < 0.47) tint = DARK
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
  const geometry = new THREE.SphereGeometry(1, 48, 32)
  if (shape) {
    const positions = geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i)
      const y = positions.getY(i)
      const z = positions.getZ(i)
      if (shape === 'mane') {
        const angle = Math.atan2(x, y)
        const lobes = 1 + 0.16 * Math.max(0, Math.cos(angle * 9)) ** 6 * (1 - z * z)
        positions.setXYZ(i, x * lobes, y * lobes, z)
      } else if (shape === 'face') {
        const muzzle = 0.43 * Math.exp(-x * x / 0.4 - ((y + 0.4) / 0.5) ** 2) * Math.max(0, z) ** 3
        positions.setXYZ(i, x, y, z + muzzle)
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

  oval(root, 'arcanine-mane', cream, [0, 0.15, 0.015], [0.36, 0.44, 0.285], 'mane')
  oval(root, 'arcanine-head', cloth(faceColor), [0, 0.265, 0.155], [0.29, 0.235, 0.225], 'face')
  oval(root, 'arcanine-nose', dark, [0, 0.19, 0.438], [0.043, 0.026, 0.019])

  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'left' : 'right'
    const ear = cloth((x, y, z) => z > 0.4 && (x / 0.76) ** 2 + (y / 0.7) ** 2 < 1 ? CREAM : ORANGE)
    const outer = oval(root, `arcanine-${label}-ear`, ear, [side * 0.3, 0.4, 0.14], [0.15, 0.09, 0.075], `ear-${label}`)
    outer.rotation.z = side * 0.36
  }
  return root
}
