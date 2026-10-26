import * as THREE from 'three'

import { fleece, fusedSurface, type Ellipsoid } from './slowpokeModel'

const LIME = 0xd9e96d
const CYAN = 0x16a8c8
const BLUE = 0x0759b6
const LILAC = 0xb991d5
const WHITE = 0xf9fbf4
const INK = 0x171d25
const MOUTH = 0x426b24

function plushOval(
  parent: THREE.Group, name: string, material: THREE.Material,
  center: [number, number, number], radii: [number, number, number],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material)
  mesh.name = name
  mesh.position.set(...center)
  mesh.scale.set(...radii)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addFuzz(parent: THREE.Group, surface: THREE.Mesh, color: number, count: number): void {
  const vertices = surface.geometry.getAttribute('position')
  const normals = surface.geometry.getAttribute('normal')
  const lines: number[] = []
  let seed = 2473
  const random = (): number => { seed = seed * 16807 % 2147483647; return seed / 2147483647 }
  for (let index = 0; index < count; index += 1) {
    const vertex = Math.floor(random() * vertices.count)
    const root = new THREE.Vector3().fromBufferAttribute(vertices, vertex)
    const normal = new THREE.Vector3().fromBufferAttribute(normals, vertex)
    const tip = root.clone().addScaledVector(normal, 0.009 + random() * 0.011)
    tip.y -= 0.003
    lines.push(...root.toArray(), ...tip.toArray())
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  const fuzz = new THREE.LineSegments(geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.33 }))
  fuzz.name = `${surface.name}-fuzz`
  parent.add(fuzz)
}

function headColor(x: number, y: number, z: number): number {
  if (z > 0.55 && Math.abs(x) < 0.69) {
    const smile = y + 0.48 - 0.13 * Math.abs(x)
    if ((x / 0.21) ** 2 + ((y + 0.47) / 0.12) ** 2 < 1) return MOUTH
    if (Math.abs(smile) < 0.018 && Math.abs(x) > 0.17) return MOUTH
    if (Math.abs(Math.abs(x) - 0.68) < 0.022 && y > -0.52 && y < -0.4) return MOUTH
  }
  return LIME
}

function eyeColor(x: number, y: number, z: number): number {
  if (z > 0.72 && ((x + 0.08) / 0.27) ** 2 + ((y - 0.08) / 0.27) ** 2 < 1) return INK
  return WHITE
}

export function createAlienModel(): THREE.Group {
  const doll = new THREE.Group()
  doll.name = 'alien-plush'

  const head: Ellipsoid = { center: [0, 0.17, 0.01], radii: [0.37, 0.33, 0.295] }
  const headParts: Ellipsoid[] = [head,
    { center: [-0.4, 0.19, 0], radii: [0.145, 0.095, 0.09] },
    { center: [-0.525, 0.255, 0], radii: [0.105, 0.075, 0.06] },
    { center: [0.4, 0.19, 0], radii: [0.145, 0.095, 0.09] },
    { center: [0.525, 0.255, 0], radii: [0.105, 0.075, 0.06] },
    { center: [0, 0.48, 0], radii: [0.055, 0.15, 0.06] },
    { center: [0, 0.64, 0], radii: [0.075, 0.07, 0.072] },
  ]
  const headMesh = fusedSurface(doll, 'alien-head', fleece(headColor), headParts, 0.04,
    { min: [-0.68, -0.21, -0.35], max: [0.68, 0.76, 0.37] }, head, 0.036)
  addFuzz(doll, headMesh, LIME, 1600)

  const eyeFabric = fleece(eyeColor)
  plushOval(doll, 'alien-eye-1', eyeFabric, [-0.18, 0.26, 0.27], [0.083, 0.091, 0.045])
  plushOval(doll, 'alien-eye-2', eyeFabric, [0, 0.33, 0.29], [0.087, 0.094, 0.045])
  plushOval(doll, 'alien-eye-3', eyeFabric, [0.18, 0.26, 0.27], [0.083, 0.091, 0.045])

  const torso: Ellipsoid = { center: [0, -0.29, 0], radii: [0.34, 0.29, 0.27] }
  const suitMesh = fusedSurface(doll, 'alien-suit', fleece(() => CYAN), [torso,
    { center: [0, -0.075, 0], radii: [0.16, 0.13, 0.15] },
    { center: [-0.34, -0.27, 0], radii: [0.19, 0.085, 0.105] },
    { center: [0.34, -0.27, 0], radii: [0.19, 0.085, 0.105] },
    { center: [-0.13, -0.49, 0.02], radii: [0.135, 0.12, 0.16] },
    { center: [0.13, -0.49, 0.02], radii: [0.135, 0.12, 0.16] },
  ], 0.055, { min: [-0.6, -0.66, -0.31], max: [0.6, 0.04, 0.32] }, torso, 0.043)
  addFuzz(doll, suitMesh, CYAN, 1200)

  const handFabric = fleece(() => LIME)
  for (const sign of [-1, 1] as const) {
    const hand: Ellipsoid = { center: [sign * 0.525, -0.255, 0.015], radii: [0.105, 0.075, 0.063] }
    fusedSurface(doll, sign < 0 ? 'alien-left-hand' : 'alien-right-hand', handFabric,
      [hand,
        { center: [sign * 0.615, -0.2, -0.045], radii: [0.055, 0.09, 0.045] },
        { center: [sign * 0.64, -0.25, 0.015], radii: [0.075, 0.046, 0.038] },
        { center: [sign * 0.61, -0.305, 0.067], radii: [0.06, 0.045, 0.038] },
      ], 0.038,
      { min: sign < 0 ? [-0.76, -0.38, -0.14] : [0.4, -0.38, -0.14],
        max: sign < 0 ? [-0.4, -0.07, 0.13] : [0.76, -0.07, 0.13] }, hand, 0.022)
  }

  const lilac = fleece(() => LILAC)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.218, 0.034, 12, 48), lilac)
  collar.name = 'alien-collar'
  collar.rotation.x = Math.PI / 2
  collar.position.y = -0.105
  collar.castShadow = true
  doll.add(collar)

  const blueFabric = fleece(() => BLUE)
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.075, 48, 1, true), blueFabric)
  belt.name = 'alien-belt'
  belt.position.y = -0.395
  belt.scale.z = 0.79
  belt.castShadow = true
  doll.add(belt)
  plushOval(doll, 'alien-left-foot', blueFabric, [-0.15, -0.565, 0.09], [0.168, 0.07, 0.192])
  plushOval(doll, 'alien-right-foot', blueFabric, [0.15, -0.565, 0.09], [0.168, 0.07, 0.192])

  doll.scale.setScalar(0.94)
  return doll
}
