export interface PlanarMotion {
  x: number
  z: number
}

export interface SwingState {
  angleX: number
  angleZ: number
  velocityX: number
  velocityZ: number
}

export const restingSwing = (): SwingState => ({
  angleX: 0,
  angleZ: 0,
  velocityX: 0,
  velocityZ: 0,
})

export function approachVelocity(
  current: PlanarMotion,
  target: PlanarMotion,
  deltaSeconds: number,
): PlanarMotion {
  const blend = 1 - Math.exp(-9 * Math.max(0, deltaSeconds))
  return {
    x: current.x + (target.x - current.x) * blend,
    z: current.z + (target.z - current.z) * blend,
  }
}

export function stepSwing(
  state: SwingState,
  acceleration: PlanarMotion,
  deltaSeconds: number,
): SwingState {
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05)
  const accelerationX = clamp(acceleration.x, -24, 24)
  const accelerationZ = clamp(acceleration.z, -24, 24)
  const stiffness = 18
  const damping = 4.8
  const inertia = 0.15

  const velocityX = state.velocityX
    + (-state.angleX * stiffness - state.velocityX * damping + accelerationZ * inertia) * delta
  const velocityZ = state.velocityZ
    + (-state.angleZ * stiffness - state.velocityZ * damping - accelerationX * inertia) * delta

  return {
    angleX: clamp(state.angleX + velocityX * delta, -0.2, 0.2),
    angleZ: clamp(state.angleZ + velocityZ * delta, -0.2, 0.2),
    velocityX,
    velocityZ,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
