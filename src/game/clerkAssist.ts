export class ClerkAssistTrigger {
  private offeredThisCycle = false
  private placedThisCycle = false

  onResult(result: 'won' | 'lost', amount: number): boolean {
    if (result === 'won') {
      this.offeredThisCycle = false
      this.placedThisCycle = false
      return false
    }
    if (amount < 100 || this.offeredThisCycle) return false
    this.offeredThisCycle = true
    return true
  }

  canRequestPlacement(amount: number): boolean {
    return amount >= 100 && !this.placedThisCycle
  }

  completePlacement(): void {
    this.placedThisCycle = true
  }
}

interface DollPosition { x: number; y: number; z: number }

function distanceFromChuteLip(position: DollPosition): number {
  const xGap = Math.max(0, -1.9 - position.x, position.x + 0.5)
  const zGap = Math.max(0, 0.24 - position.z, position.z - 1.68)
  return Math.hypot(xGap, zGap)
}

export function findClerkSwapIndex(
  selectedIndex: number,
  positions: ReadonlyArray<DollPosition | undefined>,
): number | undefined {
  const selected = positions[selectedIndex]
  if (!selected || distanceFromChuteLip(selected) <= 0.65) return undefined

  let nearestIndex: number | undefined
  let nearestDistance = Infinity
  positions.forEach((position, index) => {
    if (index === selectedIndex || !position || position.y < 0.4) return
    const distance = distanceFromChuteLip(position)
    if (distance > 0.65 || distance < 0.05 || distance >= nearestDistance) return
    nearestDistance = distance
    nearestIndex = index
  })
  return nearestIndex
}

export function chooseClerkPlacement(otherPositions: ReadonlyArray<{ x: number; z: number }>): { x: number; y: number; z: number } {
  const candidates = [
    { x: 0.08, z: 1.16 },
    { x: 0.38, z: 1.15 },
    { x: -0.04, z: 0.05 },
    { x: 0.36, z: 0.05 },
  ]
  let best = candidates[0]!
  let bestScore = -Infinity
  candidates.forEach((candidate, index) => {
    const clearance = Math.min(...otherPositions.map((position) =>
      Math.hypot(candidate.x - position.x, candidate.z - position.z)))
    const score = clearance === Infinity ? -index : clearance - index * 0.1
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  })
  return { ...best, y: 0.62 }
}
