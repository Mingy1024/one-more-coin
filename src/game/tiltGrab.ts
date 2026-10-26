import { PRIZE_HALF_DEPTH } from './prizeInteraction'
import type { RoundPhase } from './round'

export interface TiltPlan {
  directionX: number
  directionZ: number
  angle: number
}

export const TILT_GRIP_OPENING = 0.2

interface Point3 {
  x: number
  y: number
  z: number
}

export function canTiltPickup(prize: Point3, tips: Point3[]): boolean {
  const topContact = tips.some((tip) =>
    tip.y >= prize.y + 0.3
      && tip.y <= prize.y + 0.75
      && Math.hypot(tip.x - prize.x, tip.z - prize.z) <= 0.54)
  if (!topContact) return false

  const supports = tips.filter((tip) =>
    tip.y <= prize.y - 0.08
      && tip.y >= prize.y - 0.38
      && Math.abs(tip.x - prize.x) <= 0.48
      && Math.abs(tip.z - prize.z) <= PRIZE_HALF_DEPTH + 0.04)
  return supports.length >= 2 && Math.hypot(
    supports[0]!.x - supports[1]!.x,
    supports[0]!.z - supports[1]!.z,
  ) >= 0.3
}

export function tiltPlanForAim(
  claw: { x: number; z: number },
  prize: { x: number; z: number },
): TiltPlan | undefined {
  const deltaX = prize.x - claw.x
  const deltaZ = prize.z - claw.z
  const distance = Math.hypot(deltaX, deltaZ)
  if (distance < 0.26 || distance > 0.53) return undefined

  return {
    directionX: deltaX / distance,
    directionZ: deltaZ / distance,
    angle: Math.asin(distance / 0.82) + 0.12,
  }
}

export function tiltAmountForPhase(phase: RoundPhase, progress: number): number {
  const smooth = (value: number): number => {
    const clamped = Math.min(1, Math.max(0, value))
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase === 'lowering') return smooth((progress - 0.55) / 0.35)
  if (phase === 'closing') return 1
  if (phase === 'lifting') return 1 - smooth(progress)
  return 0
}
