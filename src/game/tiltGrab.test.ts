import { describe, expect, it } from 'vitest'

import { canTiltPickup, tiltAmountForPhase, tiltPlanForAim } from './tiltGrab'

describe('side-aimed tilt grab', () => {
  const prize = { x: 0, z: 0 }

  it('offers a tilt only when the claw is aimed near one shoulder', () => {
    expect(tiltPlanForAim({ x: 0.05, z: 0 }, prize)).toBeUndefined()
    expect(tiltPlanForAim({ x: 0.65, z: 0 }, prize)).toBeUndefined()
    expect(tiltPlanForAim({ x: -0.4, z: 0 }, prize)).toEqual({
      directionX: 1,
      directionZ: 0,
      angle: expect.any(Number),
    })
  })

  it('tilts the lower fingers toward the prize and scales the angle with the offset', () => {
    const shallow = tiltPlanForAim({ x: -0.3, z: 0 }, prize)!
    const deep = tiltPlanForAim({ x: -0.48, z: 0 }, prize)!

    expect(shallow.angle).toBeGreaterThan(0.4)
    expect(deep.angle).toBeGreaterThan(shallow.angle)
    expect(deep.angle).toBeLessThan(1.1)
  })

  it('tips during the lower half of descent and straightens during lifting', () => {
    expect(tiltAmountForPhase('lowering', 0.4)).toBe(0)
    expect(tiltAmountForPhase('lowering', 0.8)).toBeGreaterThan(0.6)
    expect(tiltAmountForPhase('closing', 0.5)).toBe(1)
    expect(tiltAmountForPhase('lifting', 0.5)).toBeCloseTo(0.5)
    expect(tiltAmountForPhase('returning', 0)).toBe(0)
  })

  it('requires one high contact and two low supporting pads to latch', () => {
    const prize = { x: 0, y: 0.62, z: 0 }
    const top = { x: 0.34, y: 1.22, z: 0 }
    const lowerLeft = { x: -0.1, y: 0.44, z: -0.32 }
    const lowerRight = { x: -0.1, y: 0.44, z: 0.32 }

    expect(canTiltPickup(prize, [top, lowerLeft, lowerRight])).toBe(true)
    expect(canTiltPickup(prize, [top, lowerLeft, { x: -0.9, y: 0.44, z: 0.32 }])).toBe(false)
    expect(canTiltPickup(prize, [lowerLeft, lowerRight])).toBe(false)
  })

  it('allows a small simulation tolerance at the high pad without accepting a clear miss', () => {
    const prize = { x: 0, y: 0.62, z: 0 }
    const lowerLeft = { x: -0.1, y: 0.44, z: -0.32 }
    const lowerRight = { x: -0.1, y: 0.44, z: 0.32 }

    expect(canTiltPickup(prize, [{ x: 0.545, y: 1.05, z: 0 }, lowerLeft, lowerRight])).toBe(true)
    expect(canTiltPickup(prize, [{ x: 0.57, y: 1.05, z: 0 }, lowerLeft, lowerRight])).toBe(false)
  })
})
