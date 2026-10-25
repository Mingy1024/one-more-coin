import type { RoundPhase } from './round'

export function clawDescentProgress(progress: number): number {
  const travel = Math.min(1, Math.max(0, (progress - 0.25) / 0.75))
  return travel * travel * (3 - 2 * travel)
}

export function clawOpeningForPhase(
  phase: RoundPhase,
  progress: number,
  carried: boolean,
  gripOpening: number,
): number {
  if (phase === 'ready' || phase === 'aiming') return 0
  if (phase === 'lowering') {
    const opening = Math.min(1, Math.max(0, progress / 0.2))
    return opening * opening * (3 - 2 * opening)
  }
  if (phase === 'closing') return 1 + (gripOpening - 1) * progress
  if (phase === 'lifting' || phase === 'returning') return carried ? gripOpening : 0
  if (phase === 'releasing') return gripOpening + (1 - gripOpening) * progress
  return 1
}
