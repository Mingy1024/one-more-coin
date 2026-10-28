import * as THREE from 'three'
import { prizeCollisionVertices } from './prizeCollision'

export type ChuteGuard = 'right' | 'back'
export const CHUTE_GUARD_OUTER_X = -0.4475
export const CHUTE_GUARD_OUTER_Z = 0.1875
const GUARD_HEIGHT = 0.4

/** Lean toward the guard, fitting the feet to the floor and the lower body to its outer face. */
export function clerkLeanPose(model: THREE.Group, guard: ChuteGuard, along: number) {
  // The small three-eyed plush rests on its wide feet at a shallower angle.
  const angle = model.name === 'alien-plush' ? 0.55 : 0.9
  const rotation = new THREE.Quaternion().setFromEuler(
    guard === 'right' ? new THREE.Euler(0, 0, angle) : new THREE.Euler(angle, 0, 0),
  )
  const { parts } = prizeCollisionVertices(model)
  const points: THREE.Vector3[] = []
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 3) points.push(new THREE.Vector3(part[i], part[i + 1], part[i + 2]).applyQuaternion(rotation))
  }
  const bounds = new THREE.Box3().setFromPoints(points)
  const y = -bounds.min.y + 0.008
  // Include a small band above the lip so convex faces crossing its top remain clear.
  const lower = points.filter(point => point.y + y <= GUARD_HEIGHT + 0.06)
  if (lower.length === 0) return undefined
  const position = guard === 'right'
    ? { x: CHUTE_GUARD_OUTER_X - Math.min(...lower.map(point => point.x)) + 0.012, y, z: along }
    : { x: along, y, z: CHUTE_GUARD_OUTER_Z - Math.max(...lower.map(point => point.z)) - 0.012 }
  return { position, rotation, box: bounds.translate(new THREE.Vector3(position.x, y, position.z)) }
}
