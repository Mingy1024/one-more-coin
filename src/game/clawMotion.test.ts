import { describe, expect, it } from 'vitest'

import { approachVelocity, restingSwing, stepSwing } from './clawMotion'

describe('claw motion', () => {
  it('accelerates toward the requested direction instead of moving instantly', () => {
    const velocity = approachVelocity({ x: 0, z: 0 }, { x: 1.9, z: 0 }, 1 / 60)

    expect(velocity.x).toBeGreaterThan(0)
    expect(velocity.x).toBeLessThan(1.9)
  })

  it('makes the suspended claw lag behind a horizontal acceleration', () => {
    const swing = stepSwing(restingSwing(), { x: 18, z: 0 }, 1 / 30)

    expect(swing.angleZ).toBeLessThan(0)
    expect(swing.angleX).toBe(0)
  })

  it('settles back toward the center after the movement stops', () => {
    let swing = { angleX: 0, angleZ: 0.16, velocityX: 0, velocityZ: 0 }
    for (let frame = 0; frame < 180; frame += 1) {
      swing = stepSwing(swing, { x: 0, z: 0 }, 1 / 60)
    }

    expect(Math.abs(swing.angleZ)).toBeLessThan(0.01)
  })
})
