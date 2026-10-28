import { describe, expect, it } from 'vitest'
import { createReturnDisturbance, returnDisturbanceAt, returnTripDuration } from './returnMotion'
import { DROP_STRENGTH, nextGripStrength, transportStress } from './gripMechanics'

function finishTrip(quality: number, retention: number, mass: number, roughness: number, distance = 2): number {
  let grip = quality * retention
  const disturbance = createReturnDisturbance(() => roughness)
  for (const [duration, returning] of [[1.25, false], [returnTripDuration(distance), true]] as const) {
    const steps = Math.ceil(duration * 120)
    for (let frame = 0; frame < steps; frame += 1) {
      const progress = (frame + 0.5) / steps
      grip = nextGripStrength(grip, (returning ? 1.4 : duration) / steps, transportStress({
        quality, mass, acceleration: Math.abs(1 - 2 * progress) * (returning ? 1 : 0.9),
        swing: 0.2, disturbance: returning ? returnDisturbanceAt(disturbance, progress) : 0,
      }))
    }
  }
  return grip
}

describe('return trip balance', () => {
  it('gives long trips more time instead of moving the rear dolls at excessive speed', () => {
    expect(returnTripDuration(3)).toBeGreaterThan(returnTripDuration(0.5))
    expect(returnTripDuration(0)).toBeGreaterThanOrEqual(1.4)
    expect(returnTripDuration(8)).toBeLessThanOrEqual(2.8)
  })

  it('ramps the rail jolt in and out without a position jump at either end', () => {
    for (const sample of [0, 0.5, 1]) {
      const profile = createReturnDisturbance(() => sample)
      expect(returnDisturbanceAt(profile, 0)).toBe(0)
      expect(returnDisturbanceAt(profile, 1)).toBe(0)
      expect(returnDisturbanceAt(profile, profile.peak)).toBeCloseTo(profile.strength)
      expect(returnDisturbanceAt(profile, profile.peak - 0.18)).toBeCloseTo(0)
    }
  })

  it('lets rail variation decide a borderline hold while a secure grasp survives both trips', () => {
    expect(finishTrip(0.72, 0.9, 0.6, 0)).toBeGreaterThan(DROP_STRENGTH)
    expect(finishTrip(0.72, 0.9, 0.6, 1)).toBeLessThan(DROP_STRENGTH)
    expect(finishTrip(0.93, 0.94, 0.45, 0)).toBeGreaterThan(DROP_STRENGTH)
    expect(finishTrip(0.93, 0.94, 0.45, 1)).toBeGreaterThan(DROP_STRENGTH)
    expect(finishTrip(0.62, 0.84, 0.8, 0)).toBeLessThan(DROP_STRENGTH)
  })

})
