import { describe, expect, it } from 'vitest'

import {
  alignPrizeWithChute,
  canPickupPrize,
  CHUTE_OPENING_HALF_X,
  CHUTE_OPENING_HALF_Z,
  isPrizeCaptured,
  prizeReleaseAngularVelocity,
  PRIZE_HALF_DIAGONAL,
  PRIZE_HALF_DEPTH,
  PRIZE_HALF_HEIGHT,
  PRIZE_HALF_WIDTH,
} from './prizeInteraction'

const chute = { x: -1.2, z: 0.96 }

describe('prize drop', () => {
  it('releases the doll upright without a rim-catching tumble', () => {
    expect(prizeReleaseAngularVelocity()).toEqual({ x: 0, y: 0.35, z: 0 })
  })

  it('centers a carried doll over the chute before release', () => {
    expect(alignPrizeWithChute({ x: -0.9, y: 1.4, z: 0.7 }, chute)).toEqual({
      x: -1.2,
      y: 1.4,
      z: 0.96,
    })
  })

  it('does not report a win while the prize is still above the cabinet floor', () => {
    expect(isPrizeCaptured({ x: -1.2, y: 0.2, z: 0.96 }, chute)).toBe(false)
  })

  it('waits until the enlarged doll is fully below the cabinet floor', () => {
    expect(isPrizeCaptured({ x: -1.2, y: -0.55, z: 0.96 }, chute)).toBe(false)
    expect(isPrizeCaptured({ x: -1.2, y: -0.72, z: 0.96 }, chute)).toBe(true)
  })

  it('does not report a protruding doll as captured', () => {
    expect(isPrizeCaptured({ x: -1.2, y: -0.42, z: 0.96 }, chute)).toBe(false)
  })

  it('does not report a win when the prize falls outside the chute', () => {
    expect(isPrizeCaptured({ x: -0.4, y: -0.55, z: 0.96 }, chute)).toBe(false)
  })

  it('leaves clearance for the gift box even when it is rotated', () => {
    expect(CHUTE_OPENING_HALF_X - PRIZE_HALF_DIAGONAL).toBeGreaterThan(0.16)
    expect(CHUTE_OPENING_HALF_Z - PRIZE_HALF_DIAGONAL).toBeGreaterThan(0.1)
  })
})

describe('prize pickup', () => {
  const grabPosition = { x: 0, y: 0.1, z: 0 }

  it('accepts a prize centered inside the claw', () => {
    expect(canPickupPrize({ x: 0.35, y: 0.2, z: 0 }, grabPosition)).toBe(true)
  })

  it('accepts the enlarged doll at its resting height', () => {
    expect(canPickupPrize({ x: 0, y: 0.72, z: 0 }, grabPosition)).toBe(true)
  })

  it('rejects a prize that only brushes the outside of the claw', () => {
    expect(canPickupPrize({ x: 0.6, y: 0.2, z: 0 }, grabPosition)).toBe(false)
  })

  it('keeps the enlarged doll inside the widened chute', () => {
    expect(PRIZE_HALF_WIDTH).toBeGreaterThanOrEqual(0.39)
    expect(PRIZE_HALF_WIDTH).toBeLessThanOrEqual(0.4)
  })

  it('uses a tall, shallow collider that matches the doll silhouette', () => {
    expect(PRIZE_HALF_HEIGHT).toBeGreaterThanOrEqual(0.59)
    expect(PRIZE_HALF_HEIGHT).toBeLessThanOrEqual(0.61)
    expect(PRIZE_HALF_DEPTH).toBeLessThanOrEqual(0.31)
  })
})
