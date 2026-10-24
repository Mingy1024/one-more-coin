export const PRIZE_GRIP_OPENING = 0.55
export const PRIZE_HALF_WIDTH = 0.31
export const PRIZE_HALF_HEIGHT = 0.4
export const PRIZE_HALF_DEPTH = 0.25
export const CHUTE_CAPTURE_Y = -0.52
export const CHUTE_OPENING_HALF_X = 0.68
export const CHUTE_OPENING_HALF_Z = 0.62
export const PRIZE_HALF_DIAGONAL = Math.hypot(PRIZE_HALF_WIDTH, PRIZE_HALF_DEPTH)
const PICKUP_RADIUS = 0.55

export interface PrizePosition {
  x: number
  y: number
  z: number
}

export interface ChutePosition {
  x: number
  z: number
}

export function canPickupPrize(position: PrizePosition, grabPosition: PrizePosition): boolean {
  const distance = Math.hypot(position.x - grabPosition.x, position.z - grabPosition.z)
  return distance <= PICKUP_RADIUS && position.y <= 0.7
}

export function isPrizeCaptured(position: PrizePosition, chute: ChutePosition): boolean {
  return Math.abs(position.x - chute.x) < CHUTE_OPENING_HALF_X - 0.08
    && Math.abs(position.z - chute.z) < CHUTE_OPENING_HALF_Z - 0.08
    && position.y < CHUTE_CAPTURE_Y
}
