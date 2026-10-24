import type { RoundPhase } from './round'

export function clawOpeningForPhase(
  phase: RoundPhase,
  progress: number,
  carried: boolean,
  gripOpening: number,
): number {
  if (phase === 'ready' || phase === 'aiming') return 0
  if (phase === 'lowering') return progress
  if (phase === 'closing') return 1 + (gripOpening - 1) * progress
  if (phase === 'lifting' || phase === 'returning') return carried ? gripOpening : 0
  if (phase === 'releasing') return gripOpening + (1 - gripOpening) * progress
  return 1
}
