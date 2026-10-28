export const CLAW_TRAVEL_BOUNDS = {
  minX: -1.28, maxX: 1.28,
  minZ: -0.94, maxZ: 0.96,
} as const

export type TravelEdge = 'front' | 'back' | 'side'

export function travelEdge(position: { x: number; z: number }): TravelEdge | undefined {
  const b = CLAW_TRAVEL_BOUNDS
  if (position.z >= b.maxZ - 0.025) return 'front'
  if (position.z <= b.minZ + 0.025) return 'back'
  if (position.x <= b.minX + 0.025 || position.x >= b.maxX - 0.025) return 'side'
  return undefined
}
