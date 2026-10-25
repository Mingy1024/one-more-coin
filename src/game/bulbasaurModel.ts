import * as THREE from 'three'

import { fleece, fusedSurface, type Ellipsoid } from './slowpokeModel'

const TEAL = 0x76cdbc
const SPOT = 0x338e75
const RED = 0xb52635
const WHITE = 0xf6f2e8
const INK = 0x27434b
const LEAF = 0x62b84f
const VEIN = 0x348d48

function headColor(x: number, y: number, z: number): number {
  if (z < 0.16) return TEAL
  const eyeX = (Math.abs(x) - 0.5) / 0.22
  const eyeY = (y + 0.06 + 0.13 * Math.abs(x)) / 0.32
  if (eyeX * eyeX + eyeY * eyeY < 1) {
    if (((Math.abs(x) - 0.56) / 0.075) ** 2 + ((y - 0.055) / 0.18) ** 2 < 1) return WHITE
    return RED
  }
  const spotOne = ((x + 0.12) / 0.26) ** 2 + ((y - 0.7) / 0.12) ** 2
  const spotTwo = ((x - 0.36) / 0.12) ** 2 + ((y - 0.53) / 0.1) ** 2
  if (spotOne < 1 || spotTwo < 1) return SPOT
  if (Math.abs(Math.abs(x) - 0.22) < 0.028 && Math.abs(y + 0.51) < 0.045) return INK
  const smile = y + 0.71 - 0.1 * Math.abs(x) + 0.07 * Math.exp(-((x / 0.2) ** 2))
  if (Math.abs(x) < 0.89 && Math.abs(smile) < 0.015) return INK
  return TEAL
}

function bodyColor(x: number, y: number, z: number): number {
  const flank = Math.abs(x) > 0.48
  const spotA = ((z + 0.3) / 0.24) ** 2 + ((y - 0.3) / 0.22) ** 2
  const spotB = ((z - 0.52) / 0.21) ** 2 + ((y - 0.12) / 0.18) ** 2
  if (flank && (spotA < 1 || spotB < 1)) return SPOT
  if (y < -0.7 && Math.abs(x) > 0.31 && Math.abs(z) > 0.37) return WHITE
  return TEAL
}

function bulbColor(x: number, y: number, z: number): number {
  const angle = Math.atan2(z, x)
  const seam = Math.abs(Math.sin(angle * 4 + 0.12 * y))
  return y > -0.86 && seam < 0.09 ? VEIN : LEAF
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

  const bulbCore: Ellipsoid = { center: [0, 0.2, -0.35], radii: [0.36, 0.34, 0.35] }
  const bulb = fusedSurface(doll, 'bulbasaur-bulb', fleece(bulbColor), [
    bulbCore,
    { center: [-0.11, 0.46, -0.36], radii: [0.15, 0.12, 0.15] },
    { center: [0.11, 0.46, -0.36], radii: [0.15, 0.12, 0.15] },
  ], 0.1, { min: [-0.48, -0.22, -0.8], max: [0.48, 0.72, 0.1] }, bulbCore)
  addFuzz(doll, bulb, LEAF, 1200)

  const headCore: Ellipsoid = { center: [0, 0.035, 0.26], radii: [0.34, 0.26, 0.3] }
  const head = fusedSurface(doll, 'bulbasaur-head', fleece(headColor), [
    headCore,
    { center: [0, -0.085, 0.44], radii: [0.3, 0.15, 0.18] },
    { center: [-0.275, 0.275, 0.17], radii: [0.13, 0.13, 0.12] },
    { center: [0.275, 0.275, 0.17], radii: [0.13, 0.13, 0.12] },
  ], 0.09, { min: [-0.55, -0.31, -0.08], max: [0.55, 0.54, 0.73] }, headCore, 0.032)
  addFuzz(doll, head, TEAL, 1700)
  return doll
}
