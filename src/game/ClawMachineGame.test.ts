import { describe, expect, it, vi } from 'vitest'

import { ClawMachineGame } from './ClawMachineGame'
import { createRound } from './round'

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
        start: { x: -1, y: 0.62, z: -1 },
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
})
