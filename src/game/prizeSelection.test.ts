import { describe, expect, it } from 'vitest'

import { selectPrizeForAim } from './prizeSelection'

describe('selectPrizeForAim', () => {
  const prizes = [{ x: 0.48, z: -0.18 }, { x: -0.72, z: -0.42 }]

  it('targets the closest doll at the drop location', () => {
    expect(selectPrizeForAim({ x: 0.43, z: -0.17 }, prizes)).toBe(0)
    expect(selectPrizeForAim({ x: -0.7, z: -0.4 }, prizes)).toBe(1)
  })

  it('allows an offset shoulder aim for a tilt grab', () => {
    expect(selectPrizeForAim({ x: -0.72, z: 0.02 }, prizes)).toBe(1)
  })

  it('does not select a doll when the claw drops in empty space', () => {
    expect(selectPrizeForAim({ x: -1.2, z: 0.96 }, prizes)).toBeUndefined()
  })

  it('skips a collected doll even when it is closest to the claw', () => {
    expect(selectPrizeForAim({ x: 0.4, z: -0.18 }, [undefined, { x: 0.5, z: -0.18 }])).toBe(1)
  })
})
