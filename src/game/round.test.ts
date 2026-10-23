import { describe, expect, it } from 'vitest'

import { createRound, stepRound } from './round'

describe('claw machine round', () => {
  it('runs one full grab cycle and returns control to the player', () => {
    let round = createRound(30)

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
    let round = stepRound(createRound(), { type: 'GRAB' })
    round = stepRound(round, { type: 'GRAB' })

    expect(round.phase).toBe('lowering')
    expect(round.attempts).toBe(1)
  })

  it('finishes immediately after a successful drop', () => {
    const round = stepRound(createRound(), { type: 'PRIZE_DROPPED' })

    expect(round.phase).toBe('won')
  })

  it('finishes when the timer reaches zero', () => {
    const round = stepRound(createRound(0.1), {
      type: 'TICK',
      deltaSeconds: 0.2,
    })

    expect(round.phase).toBe('lost')
    expect(round.timeLeft).toBe(0)
  })
})
