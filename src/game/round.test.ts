import { describe, expect, it } from 'vitest'

import { createRound, stepRound } from './round'

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

  it('runs one full grab cycle and returns control to the player', () => {
    let round = stepRound(createRound(30), { type: 'START' })

    round = stepRound(round, { type: 'GRAB' })
    expect(round.phase).toBe('lowering')

    for (let index = 0; index < 120; index += 1) {
      round = stepRound(round, { type: 'TICK', deltaSeconds: 1 / 30 })
    }

    expect(round.phase).toBe('aiming')
    expect(round.attempts).toBe(1)
    expect(round.timeLeft).toBeLessThan(30)
  })

  it('ignores a second grab while the claw is busy', () => {
    let round = stepRound(createRound(), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })
    round = stepRound(round, { type: 'GRAB' })

    expect(round.phase).toBe('lowering')
    expect(round.attempts).toBe(1)
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
