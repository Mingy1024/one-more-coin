import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const BLUE = 0x168ac5
const WHITE = 0xf3f1e9
const RED = 0xc92f37
const MOUTH = 0x8d1722
const TONGUE = 0xef5a50
const YELLOW = 0xf0bd22

function createFiberTexture(): THREE.DataTexture {
  const size = 32
  const data = new Uint8Array(size * size)
  let seed = 1907
  for (let index = 0; index < data.length; index += 1) {
    seed = (seed * 16807) % 2147483647
    data[index] = 96 + (seed % 144)
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(5, 5)
  texture.needsUpdate = true
  return texture
}

const FIBER_TEXTURE = createFiberTexture()

function plushMaterial(color: number, roughness = 0.94): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    sheen: 1,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.34),
    sheenRoughness: 0.9,
    bumpMap: FIBER_TEXTURE,
    bumpScale: 0.012,
  })
}

function addPart(
  parent: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const part = new THREE.Mesh(geometry, material)
  part.name = name
  part.position.set(...position)
  part.scale.set(...scale)
  part.castShadow = true
  part.receiveShadow = true
  parent.add(part)
  return part
}

function ellipsoidFront(x: number, y: number, centerY: number, radiusX: number, radiusY: number, radiusZ: number): number {
  const distance = (x / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2
  return radiusZ * Math.sqrt(Math.max(0, 1 - distance))
}

const headFront = (x: number, y: number): number => ellipsoidFront(x, y, 0.105, 0.22, 0.22 * 0.98, 0.22 * 0.82)
const faceFront = (x: number, y: number): number => headFront(x, y) + 0.004
const bodyFront = (x: number, y: number): number => ellipsoidFront(x, y, -0.14, 0.2 * 0.88, 0.2 * 1.04, 0.2 * 0.76)

function createSurfacePatch(
  centerY: number,
  radiusX: number,
  radiusY: number,
  surface: (x: number, y: number) => number,
  offset: number,
): THREE.BufferGeometry {
  const segments = 48
  const rings = 6
  const positions = [0, centerY, surface(0, centerY) + offset]
  const indices: number[] = []

  for (let ring = 1; ring <= rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = segment / segments * Math.PI * 2
      const x = Math.cos(angle) * radiusX * ring / rings
      const y = centerY + Math.sin(angle) * radiusY * ring / rings
      positions.push(x, y, surface(x, y) + offset)

      const next = (segment + 1) % segments
      if (ring === 1) indices.push(0, 1 + segment, 1 + next)
      else {
        const inner = 1 + (ring - 2) * segments + segment
        const outer = 1 + (ring - 1) * segments + segment
        const innerNext = 1 + (ring - 2) * segments + next
        const outerNext = 1 + (ring - 1) * segments + next
        indices.push(inner, outer, outerNext, inner, outerNext, innerNext)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createCollarBand(): THREE.BufferGeometry {
  const segments = 48
  const positions: number[] = []
  const indices: number[] = []
  for (let segment = 0; segment <= segments; segment += 1) {
    const angle = segment / segments * Math.PI * 2
    const x = Math.cos(angle) * 0.164
    const z = Math.sin(angle) * 0.143
    positions.push(x, -0.064, z, x, -0.046, z)
    if (segment < segments) {
      const lower = segment * 2
      indices.push(lower, lower + 1, lower + 2, lower + 1, lower + 3, lower + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function addFuzzLayer(parent: THREE.Group): void {
  const positions: number[] = []
  let seed = 73
  const addEllipsoid = (
    count: number,
    center: THREE.Vector3,
    radii: THREE.Vector3,
  ): void => {
    for (let index = 0; index < count; index += 1) {
      seed = (seed * 48271) % 2147483647
      const u = seed / 2147483647
      seed = (seed * 48271) % 2147483647
      const v = seed / 2147483647
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      positions.push(
        center.x + radii.x * Math.sin(phi) * Math.cos(theta),
        center.y + radii.y * Math.cos(phi),
        center.z + radii.z * Math.sin(phi) * Math.sin(theta),
      )
    }
  }

  addEllipsoid(220, new THREE.Vector3(0, 0.105, 0), new THREE.Vector3(0.224, 0.219, 0.185))
  addEllipsoid(140, new THREE.Vector3(0, -0.14, 0), new THREE.Vector3(0.18, 0.212, 0.156))

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const fuzz = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: BLUE,
      size: 0.008,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  )
  fuzz.name = 'doll-fuzz'
  parent.add(fuzz)
}

export function createPrizeModel(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'doll-prize'

  const doll = new THREE.Group()
  doll.rotation.y = Math.PI / 7
  doll.scale.setScalar(1.77)
  root.add(doll)

  const blue = plushMaterial(BLUE)
  const white = plushMaterial(WHITE, 0.97)
  const red = plushMaterial(RED, 0.92)
  const darkMouth = plushMaterial(MOUTH, 0.96)
  const tongue = plushMaterial(TONGUE, 0.94)
  const yellow = plushMaterial(YELLOW, 0.9)
  const black = plushMaterial(0x242127, 0.98)
  const tear = new THREE.MeshPhysicalMaterial({
    color: 0x8ed8ed,
    roughness: 0.22,
    transmission: 0.12,
    clearcoat: 0.75,
  })

  addPart(doll, 'doll-body', new THREE.SphereGeometry(0.2, 32, 24), blue, [0, -0.14, 0], [0.88, 1.04, 0.76])
  addPart(doll, 'doll-head', new THREE.SphereGeometry(0.22, 36, 28), blue,
    [0, 0.105, 0], [1, 0.98, 0.82])
  addPart(doll, 'doll-face', createSurfacePatch(0.09, 0.172, 0.133, headFront, 0.004), white, [0, 0, 0])
  addPart(doll, 'doll-belly', createSurfacePatch(-0.155, 0.116, 0.135, bodyFront, 0.004), white, [0, 0, 0])

  addPart(doll, 'doll-mouth', createSurfacePatch(0.046, 0.138, 0.078, faceFront, 0.004), darkMouth, [0, 0, 0])
  addPart(doll, 'doll-tongue', createSurfacePatch(0, 0.075, 0.026, faceFront, 0.007), tongue, [0, 0, 0])

  for (const side of [-1, 1] as const) {
    const eye = addPart(doll, side < 0 ? 'doll-left-eye' : 'doll-right-eye',
      new THREE.SphereGeometry(0.055, 28, 20), white,
      [side * 0.043, 0.217, 0.132], [0.78, 1.5, 1.12])
    eye.rotation.x = -0.6
    addPart(doll, side < 0 ? 'doll-left-pupil' : 'doll-right-pupil',
      new THREE.SphereGeometry(0.014, 18, 14), black,
      [side * 0.036, 0.231, 0.19], [0.78, 1.08, 0.5])
  }

  addPart(doll, 'doll-nose', new THREE.SphereGeometry(0.034, 24, 18), red, [0, 0.177, 0.185])
  addPart(doll, 'doll-collar', createCollarBand(), red, [0, 0, 0])
  addPart(doll, 'doll-bell', new THREE.SphereGeometry(0.04, 24, 16), yellow, [0, -0.083, 0.154], [1, 0.86, 0.8])
  addPart(doll, 'doll-bell-slot', new RoundedBoxGeometry(0.035, 0.006, 0.008, 2, 0.003), black, [0, -0.078, 0.186])

  for (const side of [-1, 1] as const) {
    const arm = addPart(doll, side < 0 ? 'doll-left-arm' : 'doll-right-arm',
      new THREE.SphereGeometry(0.09, 24, 18), blue,
      [side * 0.205, -0.035, 0], [0.58, 1.42, 0.62])
    arm.rotation.z = side * -0.55
    addPart(doll, side < 0 ? 'doll-left-hand' : 'doll-right-hand',
      new THREE.SphereGeometry(0.065, 24, 18), white,
      [side * 0.245, 0.052, 0.035], [0.9, 1.05, 0.82])
    addPart(doll, side < 0 ? 'doll-left-foot' : 'doll-right-foot',
      new THREE.SphereGeometry(0.1, 28, 20), white,
      [side * 0.125, -0.29, 0.08], [1.18, 0.72, 0.86])
  }

  const whiskerMaterial = plushMaterial(0x39343a, 0.78)
  for (const side of [-1, 1] as const) {
    for (const [index, y] of [0.15, 0.12, 0.09].entries()) {
      const endX = 0.142 + index * 0.005
      const endY = y + (1 - index) * 0.012
      const points = Array.from({ length: 7 }, (_, point) => {
        const progress = point / 6
        const x = side * (0.065 + (endX - 0.065) * progress)
        const whiskerY = y + (endY - y) * progress
        return new THREE.Vector3(x, whiskerY, faceFront(x, whiskerY) + 0.008)
      })
      addPart(doll, `doll-whisker-${side}-${index}`,
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.0025, 6, false),
        whiskerMaterial, [0, 0, 0])
    }
  }

  const tearDrop = addPart(doll, 'doll-tear',
    new THREE.SphereGeometry(0.035, 22, 16), tear,
    [0.115, 0.17, 0.16], [0.58, 1.22, 0.38])
  tearDrop.rotation.z = -0.55
  addFuzzLayer(doll)

  return root
}
