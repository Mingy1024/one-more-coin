import { describe, expect, it } from 'vitest'

import { approachVelocity } from './clawMotion'

describe('claw motion', () => {
  it('accelerates toward the requested direction instead of moving instantly', () => {
    const velocity = approachVelocity({ x: 0, z: 0 }, { x: 1.9, z: 0 }, 1 / 60)

    expect(velocity.x).toBeGreaterThan(0)
    expect(velocity.x).toBeLessThan(0.18)
  })
})
