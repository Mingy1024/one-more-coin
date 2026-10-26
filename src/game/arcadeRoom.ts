import * as THREE from 'three'

export function createArcadeRoom(): THREE.Group {
  const room = new THREE.Group()
  room.name = 'arcade-room'

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 42),
    new THREE.MeshStandardMaterial({ color: 0x354b52, roughness: 0.86, metalness: 0.06 }),
  )
  floor.name = 'arcade-floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1.605
  floor.receiveShadow = true
  room.add(floor)

  const seams: THREE.Vector3[] = []
  for (let line = -20; line <= 20; line += 2) {
    seams.push(new THREE.Vector3(line, -1.597, -20), new THREE.Vector3(line, -1.597, 20))
    seams.push(new THREE.Vector3(-20, -1.597, line), new THREE.Vector3(20, -1.597, line))
  }
  room.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(seams),
    new THREE.LineBasicMaterial({ color: 0x203840, transparent: true, opacity: 0.2 }),
  ))

  const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x5a7379, side: THREE.DoubleSide })
  const lowerWallMaterial = new THREE.MeshBasicMaterial({ color: 0x304c5a, side: THREE.DoubleSide })
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(42, 20), wallMaterial)
  backWall.name = 'arcade-back-wall'
  backWall.position.set(0, 5.9, -16)
  room.add(backWall)

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(42, 20), wallMaterial)
    wall.rotation.y = Math.PI / 2
    wall.position.set(side * 20, 5.9, 0)
    room.add(wall)
  }

  const lowerWall = new THREE.Mesh(new THREE.PlaneGeometry(42, 2.7), lowerWallMaterial)
  lowerWall.position.set(0, -0.23, -15.97)
  room.add(lowerWall)

  const trimMaterial = new THREE.MeshBasicMaterial({ color: 0x91aaa8 })
  const trim = new THREE.Mesh(new THREE.BoxGeometry(42, 0.12, 0.08), trimMaterial)
  trim.position.set(0, 1.17, -15.9)
  room.add(trim)
  for (let x = -18; x <= 18; x += 4) {
    const panelJoint = new THREE.Mesh(new THREE.BoxGeometry(0.055, 4.7, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x4a6971 }))
    panelJoint.position.set(x, 3.6, -15.9)
    room.add(panelJoint)
  }
  addComicWallDetails(room)

  const ceilingBand = new THREE.Mesh(
    new THREE.BoxGeometry(42, 0.42, 0.35),
    new THREE.MeshBasicMaterial({ color: 0x2c4858 }),
  )
  ceilingBand.position.set(0, 7.45, -15.7)
  room.add(ceilingBand)
  for (const x of [-8, 0, 8]) {
    const lightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.14, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xc5d6ca }),
    )
    lightPanel.position.set(x, 7.4, -15.43)
    room.add(lightPanel)
  }

  room.add(createNeighborCabinet(-6.2, 0x89d9d6, 'arcade-neighbor-left'))
  room.add(createNeighborCabinet(6.2, 0xe9aab5, 'arcade-neighbor-right'))
  return room
}

function addComicWallDetails(room: THREE.Group): void {
  const rays = new THREE.Group()
  rays.name = 'arcade-comic-rays'
  const rayMaterial = new THREE.MeshBasicMaterial({
    color: 0xa3cbc5,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const rayVertices: Array<[number, number, number, number, number, number]> = [
    [-18, 7.3, -14.8, 7.3, -3.5, -1.4],
    [-9.8, 7.3, -8.2, 7.3, -1.5, -1.4],
    [8.6, 7.3, 10.5, 7.3, 1.3, -1.4],
    [16.2, 7.3, 18, 7.3, 4.2, -1.4],
  ]
  for (const vertices of rayVertices) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      vertices[0], vertices[1], -15.9,
      vertices[2], vertices[3], -15.9,
      vertices[4], vertices[5], -15.9,
    ], 3))
    rays.add(new THREE.Mesh(geometry, rayMaterial))
  }
  room.add(rays)

  const dots: Array<[number, number, number]> = []
  for (let y = 0.3; y < 7.1; y += 0.54) {
    for (let x = -18; x < 18; x += 0.54) {
      const left = Math.hypot(x + 10.2, y - 3.5)
      const right = Math.hypot(x - 10.2, y - 3.5)
      const distance = Math.min(left, right)
      if (distance > 6.5) continue
      dots.push([x, y, 0.045 + (1 - distance / 6.5) * 0.085])
    }
  }
  const halftone = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 8),
    new THREE.MeshBasicMaterial({ color: 0x183b4a, transparent: true, opacity: 0.32, depthWrite: false }),
    dots.length,
  )
  halftone.name = 'arcade-comic-halftone'
  const dot = new THREE.Object3D()
  dots.forEach(([x, y, radius], index) => {
    dot.position.set(x, y, -15.81)
    dot.scale.setScalar(radius)
    dot.updateMatrix()
    halftone.setMatrixAt(index, dot.matrix)
  })
  halftone.instanceMatrix.needsUpdate = true
  room.add(halftone)
}

function addInkOutline(cabinet: THREE.Group, mesh: THREE.Mesh, name?: string): void {
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x1a3544, transparent: true, opacity: 0.88 }),
  )
  if (name) outline.name = name
  outline.position.copy(mesh.position)
  outline.rotation.copy(mesh.rotation)
  outline.scale.copy(mesh.scale)
  cabinet.add(outline)
}

function createNeighborCabinet(x: number, accent: number, name: string): THREE.Group {
  const cabinet = new THREE.Group()
  cabinet.name = name
  cabinet.position.set(x, 0, -8.4)

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(3.45, 5.4, 1.18),
    new THREE.MeshBasicMaterial({ color: 0x8b9fa2 }),
  )
  shell.position.y = 1.1
  cabinet.add(shell)
  addInkOutline(cabinet, shell, 'arcade-neighbor-outline')

  const display = new THREE.Mesh(
    new THREE.BoxGeometry(2.95, 3.25, 0.055),
    new THREE.MeshBasicMaterial({ color: 0x2c4b59 }),
  )
  display.position.set(0, 1.93, 0.62)
  cabinet.add(display)
  addInkOutline(cabinet, display)

  const bottom = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.28, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x254053 }),
  )
  bottom.position.set(0, -0.86, 0.63)
  cabinet.add(bottom)
  addInkOutline(cabinet, bottom)

  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.46, 0.08),
    new THREE.MeshBasicMaterial({ color: accent }),
  )
  marquee.position.set(0, 3.48, 0.64)
  cabinet.add(marquee)
  addInkOutline(cabinet, marquee)

  const lightMaterial = new THREE.MeshBasicMaterial({ color: accent })
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 3.35, 0.065), lightMaterial)
    strip.position.set(side * 1.53, 1.92, 0.66)
    cabinet.add(strip)
  }

  const prizes = [
    { x: -0.84, y: 0.89, scale: 0.92, color: 0xc7a998 },
    { x: 0.05, y: 1.12, scale: 1.12, color: 0xa8b8b8 },
    { x: 0.91, y: 0.78, scale: 0.8, color: 0xb6a1ad },
  ]
  for (const plush of prizes) {
    const prize = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 8),
      new THREE.MeshBasicMaterial({ color: plush.color }),
    )
    prize.scale.set(plush.scale, plush.scale * 1.1, 0.6)
    prize.position.set(plush.x, plush.y, 0.69)
    cabinet.add(prize)
  }

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.95, 3.25),
    new THREE.MeshBasicMaterial({ color: 0x163444, transparent: true, opacity: 0.4, depthWrite: false }),
  )
  glass.position.set(0, 1.93, 0.77)
  cabinet.add(glass)

  return cabinet
}
