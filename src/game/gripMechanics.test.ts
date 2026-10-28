import { describe, expect, it } from 'vitest'

import { chooseGripLevel, GRIP_LEVELS, evaluateGrip, nextGripStrength, transportStress, DROP_STRENGTH } from './gripMechanics'

const prize = {
  position: { x: 0, y: 0.62, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
}
const grab = { x: 0, y: 0.46, z: 0 }
const supportedTips = [
  { x: 0.34, y: 0.34, z: 0 },
  { x: -0.17, y: 0.34, z: 0.294 },
  { x: -0.17, y: 0.34, z: -0.294 },
]

describe('claw grip levels', () => {
  it('selects each level with equal intervals and raises every grip level by 6 percent', () => {
    expect([0, 0.25, 0.5, 0.75].map(value => chooseGripLevel(() => value))).toEqual(GRIP_LEVELS)
    expect(chooseGripLevel(() => 0.999)).toBe(0.8056)
    expect(Math.max(...GRIP_LEVELS)).toBe(1.06)
  })
})

describe('claw grip quality', () => {
  it('requires opposed finger support rather than a centre-only overlap', () => {
    expect(evaluateGrip(prize, grab, supportedTips, 'normal')).toBeGreaterThan(0.55)
    expect(evaluateGrip(prize, grab, [supportedTips[0]!], 'normal')).toBe(0)
    expect(evaluateGrip(prize, grab, [
      { x: 0.32, y: 0.34, z: 0.05 },
      { x: 0.32, y: 0.34, z: -0.05 },
    ], 'normal')).toBe(0)
  })

  it('rejects fingers that are above the doll or pass through its centre', () => {
    expect(evaluateGrip(prize, grab, supportedTips.map((tip) => ({ ...tip, y: 1.05 })), 'normal')).toBe(0)
    expect(evaluateGrip(prize, grab, supportedTips.map((tip) => ({ ...tip, x: tip.x * 0.2, z: tip.z * 0.2 })), 'normal')).toBe(0)
  })

  it('gives a shallower off-centre grasp less holding strength', () => {
    const strong = evaluateGrip(prize, grab, supportedTips, 'normal')
    const weak = evaluateGrip(prize, { ...grab, x: 0.24 }, supportedTips.map((tip) => ({ ...tip, y: 0.48 })), 'normal')
    expect(weak).toBeGreaterThan(0.55)
    expect(weak).toBeLessThan(strong)
  })

  it('lets a supported tilt grab catch without requiring a centred grip', () => {
    const tips = [
      { x: 0, y: 1.13, z: 0.2 },
      { x: -0.22, y: 0.38, z: 0.28 },
      { x: 0.22, y: 0.38, z: 0.28 },
    ]
    expect(evaluateGrip(prize, { x: 0, y: 0.5, z: 0.4 }, tips, 'tilt')).toBeGreaterThan(0.55)
    expect(evaluateGrip(prize, { x: 0, y: 0.5, z: 0.4 }, tips.slice(0, 2), 'tilt')).toBe(0)
  })
})

describe('carried-doll stability', () => {
  it('keeps a secure grip through a normal return trip', () => {
    let strength = 0.83
    for (let frame = 0; frame < 160; frame += 1) {
      strength = nextGripStrength(strength, 1 / 60, transportStress({
        quality: 0.88, mass: 0.45, acceleration: 0.5, swing: 0.2,
      }))
    }
    expect(strength).toBeGreaterThan(DROP_STRENGTH)
  })

  it('drops a marginal heavy grip during the trip, not instantly on pickup', () => {
    let strength = 0.54
    const stress = transportStress({ quality: 0.63, mass: 0.85, acceleration: 0.7, swing: 0.65 })
    strength = nextGripStrength(strength, 0.2, stress)
    expect(strength).toBeGreaterThan(DROP_STRENGTH)
    for (let frame = 0; frame < 110; frame += 1) strength = nextGripStrength(strength, 1 / 60, stress)
    expect(strength).toBeLessThanOrEqual(DROP_STRENGTH)
  })
})
