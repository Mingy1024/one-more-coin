import { describe, expect, it } from 'vitest'

import { createRound, phaseDurations, stepRound } from './round'

const fullCycleSeconds = Object.values(phaseDurations).reduce((sum, duration) => sum + duration, 0)

describe('claw machine round', () => {
  it('keeps the timer and claw locked until the player starts the round', () => {
    let round = createRound(30)

    round = stepRound(round, { type: 'TICK', deltaSeconds: 5 })
    round = stepRound(round, { type: 'GRAB' })

    expect(round.phase).toBe('ready')
    expect(round.timeLeft).toBe(30)
    expect(round.attempts).toBe(0)

    round = stepRound(round, { type: 'START' })
    expect(round.phase).toBe('aiming')
  })

  it('ends the paid round after one full grab cycle, even when time remains', () => {
    let round = stepRound(createRound(30), { type: 'START' })

    round = stepRound(round, { type: 'GRAB' })
    expect(round.phase).toBe('lowering')

    for (let index = 0; index < Math.ceil((fullCycleSeconds + 0.1) * 30); index += 1) {
      round = stepRound(round, { type: 'TICK', deltaSeconds: 1 / 30 })
    }

    expect(round.phase).toBe('lost')
    expect(round.attempts).toBe(1)
    expect(round.timeLeft).toBeGreaterThan(0)
  })

  it('leaves enough breathing room for the player to follow the grab sequence', () => {
    let round = stepRound(createRound(30), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })

    round = stepRound(round, { type: 'TICK', deltaSeconds: 4 })
    expect(round.phase).not.toBe('aiming')

    round = stepRound(round, { type: 'TICK', deltaSeconds: fullCycleSeconds - 4 + 0.1 })
    expect(round.phase).toBe('lost')
  })

  it('leaves enough time to watch the prize fall into the chute', () => {
    const dropWindow = (phaseDurations.releasing ?? 0) + (phaseDurations.resetting ?? 0)

    expect(dropWindow).toBeGreaterThanOrEqual(1.6)
  })

  it('ignores a second grab while the claw is busy', () => {
    let round = stepRound(createRound(), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })
    round = stepRound(round, { type: 'GRAB' })

    expect(round.phase).toBe('lowering')
    expect(round.attempts).toBe(1)
  })

  it('closes early on a second press during descent without spending another attempt', () => {
    let round = stepRound(createRound(), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })
    round = stepRound(round, { type: 'TICK', deltaSeconds: 0.9 })

    round = stepRound(round, { type: 'SECOND_GRAB' })

    expect(round.phase).toBe('closing')
    expect(round.phaseElapsed).toBe(0)
    expect(round.attempts).toBe(1)
    expect(stepRound(round, { type: 'SECOND_GRAB' })).toBe(round)
  })

  it('ignores the second-stage command before the first press', () => {
    const round = stepRound(createRound(), { type: 'START' })
    expect(stepRound(round, { type: 'SECOND_GRAB' })).toBe(round)
  })

  it('finishes immediately after a successful drop', () => {
    const started = stepRound(createRound(), { type: 'START' })
    const round = stepRound(started, { type: 'PRIZE_DROPPED' })

    expect(round.phase).toBe('won')
  })

  it('finishes when the timer reaches zero', () => {
    const started = stepRound(createRound(0.1), { type: 'START' })
    const round = stepRound(started, {
      type: 'TICK',
      deltaSeconds: 0.2,
    })

    expect(round.phase).toBe('lost')
    expect(round.timeLeft).toBe(0)
  })
})
