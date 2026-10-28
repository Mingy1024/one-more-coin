import * as THREE from 'three'

import { canTiltPickup } from './tiltGrab'
import { MACHINE_DIMENSIONS } from './machineDimensions'

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface PrizePose {
  position: Point3
  rotation: { x: number; y: number; z: number; w: number }
}

export interface TransportLoad {
  quality: number
  mass: number
  acceleration: number
  swing: number
  disturbance?: number
}

export const DROP_STRENGTH = 0.18
export const CAPTURE_QUALITY = 0.55
export const PLUSH_RADIUS = 0.38
export const PLUSH_HALF_SEGMENT = 0.22

export const GRIP_LEVELS = [1.06, 0.9752, 0.8904, 0.8056] as const

export function chooseGripLevel(random: () => number = Math.random): number {
  const sample = Math.max(0, Math.min(0.999999, random()))
  return GRIP_LEVELS[Math.floor(sample * GRIP_LEVELS.length)]!
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export function normalGripHeight(prize: PrizePose): number {
  const { x, z } = prize.rotation
  const verticalAxis = Math.abs(1 - 2 * (x * x + z * z))
  return Math.max(MACHINE_DIMENSIONS.clawLowY, prize.position.y + PLUSH_RADIUS + PLUSH_HALF_SEGMENT * verticalAxis + 0.5)
}

export function evaluateGrip(prize: PrizePose, grab: Point3, tips: Point3[], kind: 'normal' | 'tilt'): number {
  if (kind === 'tilt') {
    if (!canTiltPickup(prize.position, tips)) return 0
    const supports = tips.filter((tip) => tip.y < prize.position.y - 0.08)
    const depth = clamp01((prize.position.y - Math.max(...supports.map((tip) => tip.y)) - 0.08) / 0.3)
    const span = Math.hypot(supports[0]!.x - supports[1]!.x, supports[0]!.z - supports[1]!.z)
    const alignment = clamp01(1 - Math.hypot(grab.x - prize.position.x, grab.z - prize.position.z) / 0.5)
    return clamp01(0.6 + 0.2 * depth + 0.1 * clamp01(span / 0.55) + 0.1 * alignment)
  }

  const inverseRotation = new THREE.Quaternion(
    prize.rotation.x, prize.rotation.y, prize.rotation.z, prize.rotation.w,
  ).invert()
  const contacts = tips.flatMap((tip) => {
    const relativeY = tip.y - prize.position.y
    const radius = Math.hypot(tip.x - prize.position.x, tip.z - prize.position.z)
    if (relativeY < -0.52 || relativeY > 0.15 || radius < 0.12) return []
    const local = new THREE.Vector3(
      tip.x - prize.position.x, relativeY, tip.z - prize.position.z,
    ).applyQuaternion(inverseRotation)
    const axisY = Math.max(-PLUSH_HALF_SEGMENT, Math.min(PLUSH_HALF_SEGMENT, local.y))
    const surface = Math.hypot(local.x, local.y - axisY, local.z) / PLUSH_RADIUS
    if (surface < 0.55 || surface > 1.3) return []
    return [{ tip, radius, fit: clamp01(1 - Math.abs(surface - 0.95) / 0.55) }]
  })
  if (contacts.length < 2) return 0

  let widestAngle = 0
  for (let first = 0; first < contacts.length; first += 1) {
    for (let second = first + 1; second < contacts.length; second += 1) {
      const a = contacts[first]!
      const b = contacts[second]!
      const dot = ((a.tip.x - prize.position.x) * (b.tip.x - prize.position.x)
        + (a.tip.z - prize.position.z) * (b.tip.z - prize.position.z)) / (a.radius * b.radius)
      widestAngle = Math.max(widestAngle, Math.acos(Math.max(-1, Math.min(1, dot))))
    }
  }
  if (widestAngle < 1.6) return 0

  const depth = clamp01((prize.position.y - contacts.reduce((sum, contact) => sum + contact.tip.y, 0) / contacts.length + 0.05) / 0.5)
  const fit = contacts.reduce((sum, contact) => sum + contact.fit, 0) / contacts.length
  const alignment = clamp01(1 - Math.hypot(grab.x - prize.position.x, grab.z - prize.position.z) / 0.45)
  return clamp01(0.25 * clamp01(contacts.length / 3) + 0.25 * depth
    + 0.2 * clamp01(widestAngle / 2.1) + 0.2 * fit + 0.1 * alignment)
}

export function transportStress(load: TransportLoad): number {
  return 0.05 + 0.085 * clamp01(load.acceleration) + 0.065 * clamp01(load.swing)
    + 0.05 * clamp01(load.mass) + 0.10 * (1 - clamp01(load.quality))
    + 0.16 * Math.max(0, Math.min(1.2, load.disturbance ?? 0))
}

export function nextGripStrength(current: number, delta: number, stress: number): number {
  return Math.max(0, current - Math.max(0, delta) * Math.max(0, stress))
}
