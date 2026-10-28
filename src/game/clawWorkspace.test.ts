import { describe, expect, it } from 'vitest'
import { CLAW_TRAVEL_BOUNDS as bounds, travelEdge } from './clawWorkspace'
import { INITIAL_PRIZE_PLACEMENTS } from './ClawMachineGame'

describe('aiming workspace', () => {
  it('gives every starting doll room for a direct aim on both rows', () => {
    for (const { position } of INITIAL_PRIZE_PLACEMENTS) {
      expect(position.x).toBeGreaterThan(bounds.minX + 0.15)
      expect(position.x).toBeLessThan(bounds.maxX - 0.15)
      expect(position.z).toBeGreaterThan(bounds.minZ + 0.1)
      expect(position.z).toBeLessThan(bounds.maxZ - 0.1)
    }
  })
  it('identifies the front and rear stop from gantry position, regardless of viewing angle', () => {
    expect(travelEdge({ x: 0, z: bounds.maxZ })).toBe('front')
    expect(travelEdge({ x: 0, z: bounds.minZ })).toBe('back')
    expect(travelEdge({ x: bounds.maxX, z: 0 })).toBe('side')
    expect(travelEdge({ x: 0, z: 0 })).toBeUndefined()
  })
})
