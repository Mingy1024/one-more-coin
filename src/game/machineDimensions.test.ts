import { describe, expect, it } from 'vitest'

import {
  clawTravelDistance,
  lowerCabinetRatio,
  MACHINE_DIMENSIONS,
} from './machineDimensions'

describe('machine proportions', () => {
  it('gives the claw a long drop through the display chamber', () => {
    expect(clawTravelDistance()).toBeGreaterThanOrEqual(2.2)
    expect(MACHINE_DIMENSIONS.ropeAnchorY - MACHINE_DIMENSIONS.clawTopY)
      .toBeGreaterThanOrEqual(0.45)
  })

  it('includes a full lower cabinet instead of a shallow pedestal', () => {
    expect(lowerCabinetRatio()).toBeGreaterThanOrEqual(0.35)
  })
})
