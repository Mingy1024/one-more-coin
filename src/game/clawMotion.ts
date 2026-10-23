export interface PlanarMotion {
  x: number
  z: number
}

export function approachVelocity(
  current: PlanarMotion,
  target: PlanarMotion,
  deltaSeconds: number,
): PlanarMotion {
  const blend = 1 - Math.exp(-5 * Math.max(0, deltaSeconds))
  return {
    x: current.x + (target.x - current.x) * blend,
    z: current.z + (target.z - current.z) * blend,
  }
}
