import type { RoundPhase } from './round'
import { MACHINE_DIMENSIONS } from './machineDimensions'

export function clawDescentProgress(progress: number): number {
  const travel = Math.min(1, Math.max(0, (progress - 0.25) / 0.75))
  return travel * travel * (3 - 2 * travel)
}

export function clawHeadHeight(phase: RoundPhase, progress: number, closingHeight: number): number {
  const { clawTopY } = MACHINE_DIMENSIONS
  if (phase === 'lowering') return clawTopY + (closingHeight - clawTopY) * clawDescentProgress(progress)
  if (phase === 'closing') return closingHeight
  if (phase === 'lifting') {
    const lift = progress * progress * (3 - 2 * progress)
    return closingHeight + (clawTopY - closingHeight) * lift
  }
  return clawTopY
}

export function clawOpeningForPhase(
  phase: RoundPhase,
  progress: number,
  carried: boolean,
  gripOpening: number,
  closingStartOpening = 1,
  openedForRelease = true,
): number {
  if (phase === 'ready' || phase === 'aiming') return 0
  if (phase === 'lowering') {
    const opening = Math.min(1, Math.max(0, progress / 0.2))
    return opening * opening * (3 - 2 * opening)
  }
  if (phase === 'closing') {
    const closingProgress = 1 - (1 - progress) ** 2
    return closingStartOpening + (gripOpening - closingStartOpening) * closingProgress
  }
  if (phase === 'lifting' || phase === 'returning') return carried ? gripOpening : 0
  if (phase === 'releasing') {
    return openedForRelease ? gripOpening + (1 - gripOpening) * progress : carried ? gripOpening : 0
  }
  if (phase === 'resetting') {
    const initialOpening = openedForRelease ? 1 : carried ? gripOpening : 0
    return initialOpening * (1 - Math.max(0, (progress - 0.5) * 2))
  }
  return 0
}
