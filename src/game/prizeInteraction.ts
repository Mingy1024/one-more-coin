export const PRIZE_GRIP_OPENING = 0.84
export const CHUTE_CAPTURE_Y = -0.52
export const CHUTE_OPENING_HALF_X = 0.68
export const CHUTE_OPENING_HALF_Z = 0.62
export const PRIZE_HALF_DIAGONAL = Math.hypot(0.36, 0.36)

export interface PrizePosition {
  x: number
  y: number
  z: number
}

export interface ChutePosition {
  x: number
  z: number
}

export function isPrizeCaptured(position: PrizePosition, chute: ChutePosition): boolean {
  return Math.abs(position.x - chute.x) < CHUTE_OPENING_HALF_X - 0.08
    && Math.abs(position.z - chute.z) < CHUTE_OPENING_HALF_Z - 0.08
    && position.y < CHUTE_CAPTURE_Y
}
