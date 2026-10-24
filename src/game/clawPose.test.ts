import { describe, expect, it } from 'vitest'

import { clawOpeningForPhase } from './clawPose'

const gripOpening = 0.55

describe('claw pose by round phase', () => {
  it('keeps the claw closed before the player presses grab', () => {
    expect(clawOpeningForPhase('ready', 0, false, gripOpening)).toBe(0)
    expect(clawOpeningForPhase('aiming', 0, false, gripOpening)).toBe(0)
  })

  it('opens the claw only after the descent starts', () => {
    expect(clawOpeningForPhase('lowering', 0, false, gripOpening)).toBe(0)
    expect(clawOpeningForPhase('lowering', 0.5, false, gripOpening)).toBeCloseTo(0.5)
    expect(clawOpeningForPhase('lowering', 1, false, gripOpening)).toBe(1)
  })

  it('closes from fully open to the carrying grip at the bottom', () => {
    expect(clawOpeningForPhase('closing', 0, false, gripOpening)).toBe(1)
    expect(clawOpeningForPhase('closing', 1, false, gripOpening)).toBe(gripOpening)
  })
})
