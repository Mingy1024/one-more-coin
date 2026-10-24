import { describe, expect, it } from 'vitest'

import {
  CHUTE_OPENING_HALF_X,
  CHUTE_OPENING_HALF_Z,
  isPrizeCaptured,
  PRIZE_HALF_DIAGONAL,
} from './prizeInteraction'

const chute = { x: -1.2, z: 0.96 }

describe('prize drop', () => {
  it('does not report a win while the prize is still above the cabinet floor', () => {
    expect(isPrizeCaptured({ x: -1.2, y: 0.2, z: 0.96 }, chute)).toBe(false)
  })

  it('reports a win only after the prize visibly falls through the chute', () => {
    expect(isPrizeCaptured({ x: -1.2, y: -0.55, z: 0.96 }, chute)).toBe(true)
  })

  it('does not report a win when the prize falls outside the chute', () => {
    expect(isPrizeCaptured({ x: -0.4, y: -0.55, z: 0.96 }, chute)).toBe(false)
  })

  it('leaves clearance for the gift box even when it is rotated', () => {
    expect(CHUTE_OPENING_HALF_X - PRIZE_HALF_DIAGONAL).toBeGreaterThan(0.16)
    expect(CHUTE_OPENING_HALF_Z - PRIZE_HALF_DIAGONAL).toBeGreaterThan(0.1)
  })
})
