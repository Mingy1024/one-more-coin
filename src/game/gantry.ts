import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export interface GantryAssembly {
  root: THREE.Group
  bridge: THREE.Group
  carriage: THREE.Group
}

export function createGantryAssembly(): GantryAssembly {
  const root = new THREE.Group()
  const bridge = new THREE.Group()
  const carriage = new THREE.Group()
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x263347, roughness: 0.22, metalness: 0.88 })

  for (const x of [-1.55, 1.55]) {
    const depthRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 3.15), darkMetal)
    depthRail.position.set(x, 4.09, 0)
    root.add(depthRail)
  }

  const crossRail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), darkMetal)
  crossRail.position.y = 4.03
  bridge.add(crossRail)
  root.add(bridge)

  const carriageBody = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.2, 0.46, 3, 0.045), darkMetal)
  carriageBody.position.y = 3.99
  carriageBody.castShadow = true
  carriage.add(carriageBody)
  root.add(carriage)

  return { root, bridge, carriage }
}
