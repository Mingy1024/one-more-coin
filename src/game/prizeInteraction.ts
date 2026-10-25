export const PRIZE_GRIP_OPENING = 0.55
export const PRIZE_HALF_WIDTH = 0.4
export const PRIZE_HALF_HEIGHT = 0.6
export const PRIZE_HALF_DEPTH = 0.39
export const CHUTE_CAPTURE_Y = -PRIZE_HALF_HEIGHT - 0.05
export const CHUTE_OPENING_HALF_X = 0.7
export const CHUTE_OPENING_HALF_Z = 0.72
export const PRIZE_HALF_DIAGONAL = Math.hypot(PRIZE_HALF_WIDTH, PRIZE_HALF_DEPTH)
const PICKUP_RADIUS = 0.26
const PICKUP_MAX_CENTER_Y = PRIZE_HALF_HEIGHT + 0.15

export interface PrizePosition {
  x: number
  y: number
  z: number
}

export interface ChutePosition {
  x: number
  z: number
}

export function prizeReleaseAngularVelocity(): { x: number; y: number; z: number } {
  return { x: 0, y: 0.35, z: 0 }
}

export function canPickupPrize(position: PrizePosition, grabPosition: PrizePosition): boolean {
  const distance = Math.hypot(position.x - grabPosition.x, position.z - grabPosition.z)
  return distance <= PICKUP_RADIUS && position.y <= PICKUP_MAX_CENTER_Y
}

export function isPrizeCaptured(position: PrizePosition, chute: ChutePosition): boolean {
  return Math.abs(position.x - chute.x) < CHUTE_OPENING_HALF_X - 0.08
    && Math.abs(position.z - chute.z) < CHUTE_OPENING_HALF_Z - 0.08
    && position.y < CHUTE_CAPTURE_Y
}
