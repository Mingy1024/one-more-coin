export interface OrbitState {
  pitch: number
  yaw: number
}

export interface OrbitPositionInput extends OrbitState {
  radius: number
  targetY: number
}

const MIN_YAW = -1.05
const MAX_YAW = 1.05
const MIN_PITCH = 0.18
const MAX_PITCH = 0.72
const DRAG_SENSITIVITY = 0.006

export function dragOrbit(state: OrbitState, deltaX: number, deltaY: number): OrbitState {
  return {
    yaw: clamp(state.yaw - deltaX * DRAG_SENSITIVITY, MIN_YAW, MAX_YAW),
    pitch: clamp(state.pitch - deltaY * DRAG_SENSITIVITY, MIN_PITCH, MAX_PITCH),
  }
}

export function orbitPosition(input: OrbitPositionInput): { x: number; y: number; z: number } {
  const horizontalRadius = Math.cos(input.pitch) * input.radius
  return {
    x: Math.sin(input.yaw) * horizontalRadius,
    y: input.targetY + Math.sin(input.pitch) * input.radius,
    z: Math.cos(input.yaw) * horizontalRadius,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
