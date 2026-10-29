import * as THREE from 'three'
import { fleece, fusedSurface, type Ellipsoid } from './slowpokeModel'

const SKIN = 0x61cbb0
const FIN = 0x39bfae
const HAIR = 0x4c65bd
const INK = 0x182531

/** Embroidery lives on the curved head, including the eyes and scalloped teeth. */
function face(x: number, y: number, z: number): number {
  if (z < 0.35) return SKIN
  for (const sign of [-1, 1]) {
    const eyeX = (x - sign * 0.47) / 0.285
    const eyeY = (y - 0.19 + sign * (x - sign * 0.47) * 0.22) / 0.37
    const oval = eyeX ** 2 + eyeY ** 2
    if (oval < 1) {
      if (oval > 0.8) return INK
      if (((eyeX + sign * 0.04) / 0.58) ** 2 + ((eyeY + 0.12) / 0.73) ** 2 < 1) return 0x44283f
      return 0xf3dd84
    }
  }
  if (((Math.abs(x) - 0.13) / 0.035) ** 2 + ((y + 0.12) / 0.045) ** 2 < 1) return 0x269b97
  const mouthY = y + 0.45 - 0.17 * (x / 0.55) ** 2
  if ((x / 0.57) ** 2 + (mouthY / 0.25) ** 2 < 1) {
    const tooth = Math.abs(((x + 0.6) % 0.19) - 0.095) / 0.095
    if (mouthY > 0.055 + 0.065 * tooth) return 0xfff8df
    if (((x + 0.16) / 0.3) ** 2 + ((mouthY + 0.17) / 0.11) ** 2 < 1) return 0x39ab9f
    return INK
  }
  return SKIN
}

function fuzz(parent: THREE.Group, surface: THREE.Mesh, color: number, count: number, length: number): void {
  const positions = surface.geometry.getAttribute('position')
  const normals = surface.geometry.getAttribute('normal')
  const lines: number[] = []
  let seed = 2897
  for (let i = 0; i < count; i++) {
    seed = seed * 16807 % 2147483647
    const index = Math.floor(seed / 2147483647 * positions.count)
    const root = new THREE.Vector3().fromBufferAttribute(positions, index)
    const tip = root.clone().addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, index), length)
    lines.push(...root.toArray(), ...tip.toArray())
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  const fibers = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 }))
  fibers.name = `${surface.name}-fuzz`
  parent.add(fibers)
}

export function createLucaModel(): THREE.Group {
  const doll = new THREE.Group()
  doll.name = 'luca-plush'
  const head: Ellipsoid = { center: [0, 0.24, 0.025], radii: [0.355, 0.36, 0.29] }
  const ears: Ellipsoid[] = []
  for (const sign of [-1, 1]) {
    // A broad, connected web with three rounded tips; the root disappears into the cheek.
    ears.push({ center: [sign * 0.355, 0.22, -0.015], radii: [0.17, 0.145, 0.065] })
    for (const [height, reach] of [[0.36, 0.46], [0.22, 0.51], [0.08, 0.46]] as const) {
      ears.push({ center: [sign * reach, height, -0.023], radii: [0.065, 0.026, 0.032] })
    }
  }
  fusedSurface(doll, 'luca-head-and-ear-fins', fleece(face), [head, ...ears], 0.035,
    { min: [-0.6, -0.15, -0.31], max: [0.6, 0.63, 0.36] }, head, 0.025)

  const scalp: Ellipsoid = { center: [0, 0.33, -0.07], radii: [0.37, 0.36, 0.285] }
  const curls: Ellipsoid[] = [scalp]
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI * i / 8
    curls.push({ center: [Math.cos(angle) * 0.32, 0.34 + Math.sin(angle) * 0.33, -0.015],
      radii: [0.098, 0.135, 0.12] })
  }
  // Rear curls grow from the same fleece cap, so the silhouette also reads as plush from behind.
  for (const x of [-0.23, 0, 0.23]) for (const y of [0.17, 0.39, 0.56]) {
    curls.push({ center: [x, y, -0.27], radii: [0.13, 0.13, 0.09] })
  }
  const hairFabric = fleece(() => HAIR)
  // Tiny loop-shaped pile gives the hair a curly terrycloth finish without extra meshes.
  const pile = new Uint8Array(128 * 128)
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x + (Math.floor(y / 12) % 2) * 6) % 12 - 6
    const v = y % 12 - 6
    const ring = Math.exp(-((Math.hypot(u, v) - 3.3) ** 2) / 1.5)
    pile[y * 128 + x] = Math.round(65 + 180 * ring)
  }
  const pileMap = new THREE.DataTexture(pile, 128, 128, THREE.RedFormat)
  pileMap.wrapS = pileMap.wrapT = THREE.RepeatWrapping
  pileMap.repeat.set(3, 2)
  pileMap.needsUpdate = true
  hairFabric.bumpMap?.dispose()
  hairFabric.bumpMap = pileMap
  hairFabric.bumpScale = 0.014
  const hair = fusedSurface(doll, 'luca-curly-hair', hairFabric, curls, 0.025,
    { min: [-0.45, -0.07, -0.4], max: [0.45, 0.85, 0.15] }, scalp, 0.028)
  fuzz(doll, hair, 0x687dc9, 1800, 0.018)

  const body: Ellipsoid = { center: [0, -0.27, 0], radii: [0.205, 0.255, 0.175] }
  const bodyParts: Ellipsoid[] = [body, { center: [0, -0.03, 0], radii: [0.13, 0.16, 0.13] }]
  for (const sign of [-1, 1]) {
    bodyParts.push(
      { center: [sign * 0.22, -0.22, 0], radii: [0.105, 0.16, 0.105] },
      { center: [sign * 0.29, -0.38, 0.025], radii: [0.085, 0.17, 0.085] },
      { center: [sign * 0.31, -0.5, 0.05], radii: [0.105, 0.085, 0.09] },
    )
  }
  const torso = fusedSurface(doll, 'luca-body-and-arms', fleece((x, y, z) => {
    if (z > 0.7 && y > -0.45 && y < 0.65) {
      const row = Math.round(y / 0.36)
      const u = x - (row % 2) * 0.18
      const v = y - row * 0.36
      if (Math.abs(Math.sqrt((u / 0.22) ** 2 + (v / 0.18) ** 2) - 1) < 0.09 && v < 0) return FIN
    }
    return SKIN
  }), bodyParts, 0.045, { min: [-0.46, -0.65, -0.23], max: [0.46, 0.17, 0.23] }, body, 0.033)
  fuzz(doll, torso, SKIN, 700, 0.007)

  const shorts: Ellipsoid = { center: [0, -0.48, -0.005], radii: [0.215, 0.17, 0.185] }
  fusedSurface(doll, 'luca-navy-shorts', fleece(() => 0x203143), [shorts,
    { center: [-0.115, -0.62, 0], radii: [0.106, 0.16, 0.14] },
    { center: [0.115, -0.62, 0], radii: [0.106, 0.16, 0.14] },
  ], 0.025, { min: [-0.26, -0.81, -0.21], max: [0.26, -0.28, 0.21] }, shorts, 0.032)
  for (const sign of [-1, 1]) {
    const foot: Ellipsoid = { center: [sign * 0.115, -0.76, 0.055], radii: [0.105, 0.075, 0.15] }
    fusedSurface(doll, `luca-foot-${sign}`, fleece(() => SKIN), [foot], 0,
      { min: [sign * 0.115 - 0.13, -0.85, -0.12], max: [sign * 0.115 + 0.13, -0.66, 0.23] }, foot, 0.025)
  }
  // Bake size into vertices so rendering and Rapier's local collision hulls agree.
  doll.traverse(part => {
    if (part instanceof THREE.Mesh || part instanceof THREE.LineSegments) part.geometry.scale(0.78, 0.78, 0.78)
  })
  return doll
}
