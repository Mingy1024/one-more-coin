import { describe, expect, it } from 'vitest'

import { linkagePose } from './clawLinkage'

describe('articulated claw linkage', () => {
  it('spreads the finger tips outward when opening', () => {
    const closed = linkagePose(0)
    const open = linkagePose(1)

    expect(open.tipRadius).toBeGreaterThan(closed.tipRadius + 0.25)
    expect(open.tipY).toBeGreaterThan(0.75)
  })

  it('moves the central slider as the fingers close', () => {
    const closed = linkagePose(0)
    const open = linkagePose(1)

    expect(closed.sliderY).not.toBeCloseTo(open.sliderY)
    expect(closed.fingerAngle).toBeLessThan(open.fingerAngle)
  })

  it('clamps linkage input to a valid opening range', () => {
    expect(linkagePose(-1)).toEqual(linkagePose(0))
    expect(linkagePose(2)).toEqual(linkagePose(1))
  })
})
