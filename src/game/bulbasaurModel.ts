import * as THREE from 'three'

import { fleece, fusedSurface, type Ellipsoid } from './slowpokeModel'

const TEAL = 0x76cdbc
const SPOT = 0x338e75
const RED = 0xb52635
const WHITE = 0xf6f2e8
const INK = 0x27434b
const MOUTH = 0x76506f
const TONGUE = 0xb9759d
const LEAF = 0x62b84f
const VEIN = 0x348d48

function headColor(x: number, y: number, z: number): number {
  if (z < 0.12) return TEAL
  const eyeX = (Math.abs(x) - 0.55) / 0.18
  const eyeY = (y - 0.09 + 0.07 * Math.abs(x)) / 0.29
  const eye = eyeX * eyeX + eyeY * eyeY
  if (eye < 1.08) {
    if (eye > 0.96) return INK
    const iris = ((Math.abs(x) - 0.57) / 0.12) ** 2 + ((y + 0.005) / 0.25) ** 2
    if (iris < 1) {
      if (((Math.abs(x) - 0.52) / 0.04) ** 2 + ((y - 0.15) / 0.095) ** 2 < 1) return WHITE
      return RED
    }
    return WHITE
  }
  const forehead = Math.abs(x + 0.03) < (y - 0.36) * 0.66 && y > 0.36 && y < 0.85
  const sideMark = x > 0.15 && x < 0.46 && y > 0.36 && y < 0.56 && x - y * 0.38 < 0.24
  if (forehead || sideMark) return SPOT
  if (Math.abs(Math.abs(x) - 0.17) < 0.023 && Math.abs(y + 0.28) < 0.035) return INK
  const width = 0.79
  const top = -0.37 + 0.16 * (Math.abs(x) / width) ** 2
  const bottom = -0.7 + 0.43 * (Math.abs(x) / width) ** 2
  if (Math.abs(x) < width && y < top && y > bottom) {
    const fang = Math.abs(Math.abs(x) - 0.62) < 0.05 && y > top - 0.115
    if (fang) return WHITE
    if (Math.abs(y - top) < 0.025 || Math.abs(y - bottom) < 0.025) return INK
    if (y < -0.6 && Math.abs(x) < 0.39) return TONGUE
    return MOUTH
  }
  if (Math.abs(x) < width && (Math.abs(y - top) < 0.025 || Math.abs(y - bottom) < 0.023)) return INK
  return TEAL
}

function bodyColor(x: number, y: number, z: number): number {
  const flank = Math.abs(x) > 0.48
  const spotA = ((z + 0.3) / 0.24) ** 2 + ((y - 0.3) / 0.22) ** 2
  const spotB = ((z - 0.52) / 0.21) ** 2 + ((y - 0.12) / 0.18) ** 2
  if (flank && (spotA < 1 || spotB < 1)) return SPOT
  if (y < -0.52 && Math.abs(x) > 0.32 && z > 0.35) return WHITE
  return TEAL
}

function bulbColor(x: number, y: number, z: number): number {
  const angle = Math.atan2(z, x)
  const seam = Math.abs(Math.sin(angle * 3 + 0.28 * y))
  const panel = Math.cos(angle * 3 + 0.28 * y)
  if (y > -0.85 && seam < 0.08) return VEIN
  return panel > 0.4 ? LEAF : 0x70c75a
}

function addFuzz(parent: THREE.Group, surface: THREE.Mesh, color: number, count: number): void {
  const geometry = surface.geometry
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const strands: number[] = []
  let seed = 7447
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  for (let index = 0; index < count; index += 1) {
    const triangle = Math.floor(random() * positions.count / 3) * 3
    const u = Math.sqrt(random())
    const v = random()
    const weights = [1 - u, u * (1 - v), u * v]
    const root = new THREE.Vector3()
    const normal = new THREE.Vector3()
    weights.forEach((weight, corner) => {
      root.addScaledVector(new THREE.Vector3().fromBufferAttribute(positions, triangle + corner), weight)
      normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, triangle + corner), weight)
    })
    if (surface.name === 'bulbasaur-head' && root.z > 0.28) continue
    const tip = root.clone().addScaledVector(normal.normalize(), 0.008 + random() * 0.009)
    tip.y -= 0.004
    strands.push(...root.toArray(), ...tip.toArray())
  }
  const nap = new THREE.BufferGeometry()
  nap.setAttribute('position', new THREE.Float32BufferAttribute(strands, 3))
  const lines = new THREE.LineSegments(nap,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }))
  lines.name = `${surface.name}-nap`
  parent.add(lines)
}

export function createBulbasaurModel(): THREE.Group {
  const doll = new THREE.Group()
  doll.name = 'bulbasaur-prize'
  const bodyCore: Ellipsoid = { center: [0, -0.2, -0.16], radii: [0.33, 0.25, 0.37] }
  const bodyParts: Ellipsoid[] = [bodyCore]
  for (const side of [-1, 1]) {
    bodyParts.push(
      { center: [side * 0.245, -0.39, 0.22], radii: [0.145, 0.18, 0.16] },
      { center: [side * 0.245, -0.38, -0.4], radii: [0.15, 0.18, 0.16] },
    )
  }
  const body = fusedSurface(doll, 'bulbasaur-body', fleece(bodyColor), bodyParts, 0.11,
    { min: [-0.55, -0.69, -0.78], max: [0.55, 0.2, 0.58] }, bodyCore)
  addFuzz(doll, body, TEAL, 1500)

  const bulbCore: Ellipsoid = { center: [0, 0.16, -0.38], radii: [0.36, 0.33, 0.43] }
  const bulb = fusedSurface(doll, 'bulbasaur-bulb', fleece(bulbColor), [
    bulbCore,
    { center: [0, 0.39, -0.52], radii: [0.29, 0.25, 0.36] },
    { center: [0.02, 0.57, -0.69], radii: [0.13, 0.15, 0.18] },
  ], 0.13, { min: [-0.49, -0.24, -0.98], max: [0.49, 0.78, 0.15] }, bulbCore)
  addFuzz(doll, bulb, LEAF, 1200)

  const headCore: Ellipsoid = { center: [0, 0.015, 0.27], radii: [0.38, 0.24, 0.32] }
  const head = fusedSurface(doll, 'bulbasaur-head', fleece(headColor), [
    headCore,
    { center: [0, -0.09, 0.46], radii: [0.34, 0.13, 0.2] },
    { center: [-0.29, 0.23, 0.16], radii: [0.13, 0.17, 0.13] },
    { center: [0.29, 0.23, 0.16], radii: [0.13, 0.17, 0.13] },
  ], 0.1, { min: [-0.56, -0.3, -0.1], max: [0.56, 0.49, 0.73] }, headCore, 0.03)
  addFuzz(doll, head, TEAL, 1700)
  return doll
}
