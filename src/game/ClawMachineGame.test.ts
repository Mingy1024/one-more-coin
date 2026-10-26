import { describe, expect, it, vi } from 'vitest'

import { ClawMachineGame } from './ClawMachineGame'
import { clawHeadHeight } from './clawPose'
import { MACHINE_DIMENSIONS } from './machineDimensions'
import { createRound, phaseProgress, stepRound, type RoundState } from './round'

describe('claw machine session', () => {
  it('keeps every prize position, rotation and momentum when a new paid round begins', () => {
    const changedPosition = { x: 0.82, y: 0.61, z: 0.43 }
    const changedRotation = { x: 0, y: 0.22, z: 0, w: 0.975 }
    const body = {
      translation: () => changedPosition,
      rotation: () => changedRotation,
      setTranslation: vi.fn(),
      setRotation: vi.fn(),
      setLinvel: vi.fn(),
      setAngvel: vi.fn(),
    }
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round: createRound(),
      articulatedClaw: { reset: vi.fn() },
      prizes: [{
        body,
        carry: { release: vi.fn() },
      }],
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    game.restart()

    expect(body.translation()).toEqual(changedPosition)
    expect(body.rotation()).toEqual(changedRotation)
    expect(body.setTranslation).not.toHaveBeenCalled()
    expect(body.setRotation).not.toHaveBeenCalled()
    expect(body.setLinvel).not.toHaveBeenCalled()
    expect(body.setAngvel).not.toHaveBeenCalled()
  })

  it('uses the current descent height for the second-stage close', () => {
    let round = stepRound(createRound(), { type: 'START' })
    round = stepRound(round, { type: 'GRAB' })
    round = stepRound(round, { type: 'TICK', deltaSeconds: 1.1 })
    const expectedHeight = clawHeadHeight('lowering', phaseProgress(round), MACHINE_DIMENSIONS.clawLowY)
    const game = Object.assign(Object.create(ClawMachineGame.prototype), {
      round,
      closingHeight: MACHINE_DIMENSIONS.clawLowY,
      publishSnapshot: vi.fn(),
    }) as ClawMachineGame

    game.grab()

    const state = game as unknown as { round: RoundState; closingHeight: number }
    expect(state.round.phase).toBe('closing')
    expect(state.round.attempts).toBe(1)
    expect(state.closingHeight).toBeCloseTo(expectedHeight)
    expect(state.closingHeight).toBeGreaterThan(MACHINE_DIMENSIONS.clawLowY)
  })
})
