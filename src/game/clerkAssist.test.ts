import { describe, expect, it } from 'vitest'

import { ClerkAssistTrigger, chooseClerkPlacement, findClerkSwapIndex } from './clerkAssist'

describe('clerk assist hidden event', () => {
  it('offers help only after a failed round reaches NT$100', () => {
    const trigger = new ClerkAssistTrigger()

    expect(trigger.onResult('lost', 90)).toBe(false)
    expect(trigger.onResult('lost', 100)).toBe(true)
    expect(trigger.onResult('lost', 110)).toBe(false)
  })

  it('becomes available again only after a successful prize resets the spend cycle', () => {
    const trigger = new ClerkAssistTrigger()

    trigger.onResult('lost', 100)
    expect(trigger.onResult('won', 110)).toBe(false)
    expect(trigger.onResult('lost', 90)).toBe(false)
    expect(trigger.onResult('lost', 100)).toBe(true)
  })

  it('refuses early manual placement, allows it after NT$100, and consumes only a completed placement', () => {
    const trigger = new ClerkAssistTrigger()
    expect(trigger.canRequestPlacement(90)).toBe(false)
    expect(trigger.onResult('lost', 100)).toBe(true)
    expect(trigger.canRequestPlacement(100)).toBe(true)
    trigger.completePlacement()
    expect(trigger.canRequestPlacement(110)).toBe(false)
    trigger.onResult('won', 110)
    expect(trigger.canRequestPlacement(100)).toBe(true)
  })

  it('chooses another supported spot near the chute when the closest one is occupied', () => {
    const destination = chooseClerkPlacement([{ x: 0.04, z: 0.82 }])

    expect(destination.x).toBeGreaterThan(-0.3)
    expect(destination.z).toBeGreaterThanOrEqual(0)
    expect(Math.hypot(destination.x - 0.04, destination.z - 0.82)).toBeGreaterThan(0.7)
  })

  it('never moves the requested doll to the far side of a crowded cabinet', () => {
    const neighbors = [
      { x: 0.48, z: -0.18 }, { x: -0.2, z: -1.14 }, { x: 1.18, z: -1.12 },
      { x: -0.08, z: 0.53 }, { x: -1.25, z: -0.35 },
    ]
    const destination = chooseClerkPlacement(neighbors)

    expect(destination.x).toBeLessThanOrEqual(0.4)
    expect(destination.z).toBeGreaterThanOrEqual(0)
    expect(Math.min(...neighbors.map((neighbor) =>
      Math.hypot(destination.x - neighbor.x, destination.z - neighbor.z)))).toBeGreaterThan(0.72)
  })

  it('prefers an existing doll by the chute when the requested doll is farther away', () => {
    const positions = [
      { x: 0.9, y: 0.62, z: -0.9 },
      { x: -0.08, y: 0.62, z: 0.53 },
      { x: -1.25, y: 0.62, z: -0.35 },
    ]

    expect(findClerkSwapIndex(0, positions)).toBe(1)
    expect(findClerkSwapIndex(1, positions)).toBeUndefined()
  })

  it('does not swap with a prize that has already fallen below the cabinet floor', () => {
    const positions = [
      { x: 1, y: 0.62, z: -1 },
      { x: -0.08, y: -0.8, z: 0.53 },
    ]

    expect(findClerkSwapIndex(0, positions)).toBeUndefined()
  })
})
