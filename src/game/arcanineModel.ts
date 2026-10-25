import * as THREE from 'three'

const ORANGE = 0xe98735
const CREAM = 0xf1e5c7
const DARK = 0x242326
const INNER_EAR = 0xd4a880

function fiberTexture(): THREE.DataTexture {
  const size = 32
  const data = new Uint8Array(size * size)
  let seed = 4217
  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 16807) % 2147483647
    data[index] = 92 + (seed % 150)
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 5)
  texture.needsUpdate = true
  return texture
}

const FIBER = fiberTexture()
const SPHERE = new THREE.SphereGeometry(1, 24, 18)

function fabric(color: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.96,
    sheen: 1,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.3),
    sheenRoughness: 0.93,
    bumpMap: FIBER,
    bumpScale: 0.011,
  })
}

function ellipsoid(
  parent: THREE.Group,
  name: string,
  material: THREE.Material,
  position: [number, number, number],
  radii: [number, number, number],
): THREE.Mesh {
  const part = new THREE.Mesh(SPHERE, material)
  part.name = name
  part.position.set(...position)
  part.scale.set(...radii)
  part.castShadow = true
  part.receiveShadow = true
  parent.add(part)
  return part
}

function tuft(
  parent: THREE.Group,
  name: string,
  material: THREE.Material,
  base: [number, number, number],
  tip: [number, number, number],
  width: number,
): THREE.Mesh {
  const start = new THREE.Vector3(...base)
  const end = new THREE.Vector3(...tip)
  const direction = end.clone().sub(start)
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(width, direction.length(), 10, 4), material)
  mesh.name = name
  mesh.position.copy(start).addScaledVector(direction, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function stripePatch(side: -1 | 1, zCenter: number): THREE.BufferGeometry {
  const levels = 8
  const positions: number[] = []
  const indices: number[] = []
  for (let level = 0; level <= levels; level += 1) {
    const progress = level / levels
    const y = 0.01 - progress * 0.28
    const centerZ = zCenter + progress * 0.11
    const halfWidth = 0.055 * (1 - progress) + 0.004
    for (const edge of [-1, 1]) {
      const z = centerZ + edge * halfWidth
      const normalized = ((y + 0.12) / 0.3) ** 2 + ((z + 0.08) / 0.3) ** 2
      const x = side * (0.36 * Math.sqrt(Math.max(0.04, 1 - normalized)) + 0.006)
      positions.push(x, y, z)
    }
    if (level < levels) {
      const start = level * 2
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function addFuzz(parent: THREE.Group, color: number, name: string, center: [number, number, number], radii: [number, number, number], count: number): void {
  const positions: number[] = []
  let seed = count * 27 + 103
  for (let index = 0; index < count; index += 1) {
    seed = (seed * 48271) % 2147483647
    const azimuth = seed / 2147483647 * Math.PI * 2
    seed = (seed * 48271) % 2147483647
    const vertical = seed / 2147483647 * 2 - 1
    const around = Math.sqrt(1 - vertical * vertical)
    positions.push(
      center[0] + radii[0] * around * Math.cos(azimuth),
      center[1] + radii[1] * vertical,
      center[2] + radii[2] * around * Math.sin(azimuth),
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const fuzz = new THREE.Points(geometry, new THREE.PointsMaterial({
    color, size: 0.008, opacity: 0.55, transparent: true, depthWrite: false,
  }))
  fuzz.name = name
  parent.add(fuzz)
}

export function createArcanineModel(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'arcanine-prize'

  const orange = fabric(ORANGE)
  const cream = fabric(CREAM)
  const dark = fabric(DARK)
  const earLining = fabric(INNER_EAR)

  ellipsoid(root, 'arcanine-body', orange, [0, -0.12, -0.08], [0.36, 0.3, 0.3])
  ellipsoid(root, 'arcanine-mane', cream, [0, 0.22, 0.04], [0.39, 0.4, 0.31])
  ellipsoid(root, 'arcanine-head', orange, [0, 0.25, 0.19], [0.3, 0.29, 0.26])
  ellipsoid(root, 'arcanine-chest', cream, [0, -0.14, 0.24], [0.27, 0.29, 0.15])

  for (const side of [-1, 1] as const) {
    tuft(root, `arcanine-${side < 0 ? 'left' : 'right'}-ear`, orange,
      [side * 0.25, 0.41, 0.19], [side * 0.48, 0.55, 0.24], 0.12)
    const inner = ellipsoid(root, `arcanine-${side < 0 ? 'left' : 'right'}-ear-inner`, earLining,
      [side * 0.35, 0.46, 0.265], [0.095, 0.045, 0.014])
    inner.rotation.z = -side * 0.35

    ellipsoid(root, `arcanine-${side < 0 ? 'left' : 'right'}-eye-white`, cream,
      [side * 0.125, 0.29, 0.421], [0.075, 0.057, 0.026])
    ellipsoid(root, `arcanine-${side < 0 ? 'left' : 'right'}-eye`, dark,
      [side * 0.12, 0.285, 0.445], [0.026, 0.041, 0.014])

    for (const [index, z] of [-0.2, 0.03].entries()) {
      const stripe = new THREE.Mesh(stripePatch(side, z), dark)
      stripe.name = `arcanine-${side < 0 ? 'left' : 'right'}-stripe${index || ''}`
      stripe.material.side = THREE.DoubleSide
      stripe.castShadow = true
      root.add(stripe)
    }

    for (const [name, z] of [['front', 0.17], ['back', -0.28]] as const) {
      ellipsoid(root, `arcanine-${name}-${side < 0 ? 'left' : 'right'}-paw`, orange,
        [side * 0.235, -0.48, z], [0.135, 0.13, 0.16])
      for (let toe = -1; toe <= 1; toe += 1) {
        ellipsoid(root, `arcanine-${name}-${side}-toe-${toe}`, cream,
          [side * 0.235 + toe * 0.042, -0.56, z + 0.135], [0.014, 0.008, 0.01])
      }
    }
  }

  ellipsoid(root, 'arcanine-muzzle', cream, [0, 0.16, 0.43], [0.19, 0.105, 0.09])
  ellipsoid(root, 'arcanine-nose', dark, [0, 0.195, 0.512], [0.052, 0.03, 0.023])
  ellipsoid(root, 'arcanine-mouth', dark, [0, 0.115, 0.503], [0.1, 0.007, 0.006])

  for (const side of [-1, 1] as const) {
    for (let index = 0; index < 3; index += 1) {
      const baseX = side * (0.17 + index * 0.065)
      tuft(root, `arcanine-mane-side-${side}-${index}`, cream,
        [baseX, 0.1 - index * 0.075, 0.14],
        [baseX + side * 0.1, -0.08 - index * 0.075, 0.18], 0.09)
    }
  }
  for (let index = -2; index <= 2; index += 1) {
    tuft(root, `arcanine-mane-crown-${index}`, cream,
      [index * 0.1, 0.47, 0.08], [index * 0.115, 0.67 - Math.abs(index) * 0.05, 0.13], 0.11)
    tuft(root, `arcanine-mane-bib-${index}`, cream,
      [index * 0.09, -0.21, 0.29], [index * 0.105, -0.43, 0.32], 0.08)
  }

  ellipsoid(root, 'arcanine-tail', cream, [0.22, 0.03, -0.42], [0.21, 0.25, 0.23])
  tuft(root, 'arcanine-tail-tip', cream, [0.23, 0.13, -0.48], [0.34, 0.45, -0.56], 0.17)
  tuft(root, 'arcanine-tail-upper', cream, [0.16, 0.11, -0.48], [0.12, 0.35, -0.53], 0.12)

  addFuzz(root, ORANGE, 'arcanine-fuzz', [0, -0.12, -0.08], [0.365, 0.304, 0.305], 320)
  addFuzz(root, CREAM, 'arcanine-mane-fuzz', [0, 0.22, 0.04], [0.395, 0.405, 0.315], 280)
  return root
}
