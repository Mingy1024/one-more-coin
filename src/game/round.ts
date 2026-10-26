export type RoundPhase =
  | 'ready'
  | 'aiming'
  | 'lowering'
  | 'closing'
  | 'lifting'
  | 'returning'
  | 'releasing'
  | 'resetting'
  | 'won'
  | 'lost'

export interface RoundState {
  phase: RoundPhase
  phaseElapsed: number
  timeLeft: number
  attempts: number
}

export type RoundAction =
  | { type: 'START' }
  | { type: 'GRAB' }
  | { type: 'SECOND_GRAB' }
  | { type: 'TICK'; deltaSeconds: number }
  | { type: 'PRIZE_DROPPED' }
  | { type: 'CLERK_RESCUE' }

export const phaseDurations: Partial<Record<RoundPhase, number>> = {
  lowering: 1.75,
  closing: 1,
  lifting: 1.25,
  returning: 1.4,
  releasing: 0.65,
  resetting: 1.15,
}

export function phaseProgress(state: RoundState): number {
  const duration = phaseDurations[state.phase]
  if (duration === undefined) return 0
  return Math.min(1, state.phaseElapsed / duration)
}

const nextPhase: Partial<Record<RoundPhase, RoundPhase>> = {
  lowering: 'closing',
  closing: 'lifting',
  lifting: 'returning',
  returning: 'releasing',
  releasing: 'resetting',
  resetting: 'lost',
}

export function createRound(durationSeconds = 30): RoundState {
  return {
    phase: 'ready',
    phaseElapsed: 0,
    timeLeft: durationSeconds,
    attempts: 0,
  }
}

export function stepRound(state: RoundState, action: RoundAction): RoundState {
  if (action.type === 'CLERK_RESCUE') {
    return state.phase === 'lost' ? { ...state, phase: 'won', phaseElapsed: 0 } : state
  }
  if (state.phase === 'won' || state.phase === 'lost') return state

  if (action.type === 'START') {
    if (state.phase !== 'ready') return state
    return { ...state, phase: 'aiming', phaseElapsed: 0 }
  }

  if (state.phase === 'ready') return state

  if (action.type === 'PRIZE_DROPPED') {
    return { ...state, phase: 'won', phaseElapsed: 0 }
  }

  if (action.type === 'GRAB') {
    if (state.phase !== 'aiming') return state
    return {
      ...state,
      phase: 'lowering',
      phaseElapsed: 0,
      attempts: state.attempts + 1,
    }
  }

  if (action.type === 'SECOND_GRAB') {
    if (state.phase !== 'lowering') return state
    return { ...state, phase: 'closing', phaseElapsed: 0 }
  }

  const timeLeft = Math.max(0, state.timeLeft - action.deltaSeconds)
  if (timeLeft === 0) {
    return { ...state, phase: 'lost', phaseElapsed: 0, timeLeft }
  }

  let phase: RoundPhase = state.phase
  let phaseElapsed = state.phaseElapsed + action.deltaSeconds

  while (phase !== 'aiming' && phase !== 'ready') {
    const duration = phaseDurations[phase]
    if (duration === undefined || phaseElapsed < duration) break
    phaseElapsed -= duration
    phase = nextPhase[phase] ?? 'aiming'
  }

  return { ...state, phase, phaseElapsed, timeLeft }
}
