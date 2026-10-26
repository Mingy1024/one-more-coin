import { describe, expect, it } from 'vitest'

import { clawDescentProgress, clawHeadHeight, clawOpeningForPhase } from './clawPose'
import { MACHINE_DIMENSIONS } from './machineDimensions'

const gripOpening = 0.55

describe('claw pose by round phase', () => {
  it('keeps the claw closed before the player presses grab', () => {
    expect(clawOpeningForPhase('ready', 0, false, gripOpening)).toBe(0)
    expect(clawOpeningForPhase('aiming', 0, false, gripOpening)).toBe(0)
  })

  it('opens fully before the head starts descending', () => {
    expect(clawOpeningForPhase('lowering', 0, false, gripOpening)).toBe(0)
    expect(clawOpeningForPhase('lowering', 0.2, false, gripOpening)).toBe(1)
    expect(clawDescentProgress(0.2)).toBe(0)
    expect(clawDescentProgress(0.3)).toBeGreaterThan(0)
    expect(clawOpeningForPhase('lowering', 0.5, false, gripOpening)).toBe(1)
    expect(clawOpeningForPhase('lowering', 1, false, gripOpening)).toBe(1)
    expect(clawDescentProgress(1)).toBe(1)
  })

  it('closes from fully open to the carrying grip at the bottom', () => {
    expect(clawOpeningForPhase('closing', 0, false, gripOpening)).toBe(1)
    expect(clawOpeningForPhase('closing', 1, false, gripOpening)).toBe(gripOpening)
  })

  it('holds the current height for an early second grab and lifts from there', () => {
    const midairHeight = clawHeadHeight('lowering', 0.7, MACHINE_DIMENSIONS.clawLowY)
    expect(midairHeight).toBeGreaterThan(MACHINE_DIMENSIONS.clawLowY)
    expect(midairHeight).toBeLessThan(MACHINE_DIMENSIONS.clawTopY)
    expect(clawHeadHeight('closing', 0.5, midairHeight)).toBe(midairHeight)
    expect(clawHeadHeight('lifting', 0, midairHeight)).toBe(midairHeight)
    expect(clawHeadHeight('lifting', 1, midairHeight)).toBe(MACHINE_DIMENSIONS.clawTopY)
  })

  it('stops the descent at the selected plush shoulder height', () => {
    expect(clawHeadHeight('lowering', 1, 1.7)).toBe(1.7)
  })
})
