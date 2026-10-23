import { describe, expect, it } from 'vitest'

import { dragOrbit, orbitPosition, type OrbitState } from './orbit'

describe('camera orbit', () => {
  it('turns horizontal and vertical drag distance into a new viewing angle', () => {
    const initial: OrbitState = { yaw: 0.6, pitch: 0.35 }

    const result = dragOrbit(initial, 40, -20)

    expect(result.yaw).toBeCloseTo(0.36)
    expect(result.pitch).toBeCloseTo(0.47)
  })

  it('keeps the camera inside a useful front-facing range', () => {
    const result = dragOrbit({ yaw: 0, pitch: 0.4 }, 10_000, 10_000)

    expect(result.yaw).toBe(-1.05)
    expect(result.pitch).toBe(0.18)
  })

  it('places the camera on the requested orbit radius around its target', () => {
    const position = orbitPosition({ yaw: 0, pitch: 0, radius: 10, targetY: 1.5 })

    expect(position).toEqual({ x: 0, y: 1.5, z: 10 })
  })
})
