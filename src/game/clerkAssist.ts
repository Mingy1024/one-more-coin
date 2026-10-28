export class ClerkAssistTrigger {
  private offeredThisCycle = false
  private lastPlacementAmount: number | undefined

  onResult(result: 'won' | 'lost', amount: number): boolean {
    if (result === 'won') {
      this.offeredThisCycle = false
      this.lastPlacementAmount = undefined
      return false
    }
    if (amount < 100 || this.offeredThisCycle) return false
    this.offeredThisCycle = true
    return true
  }

  canRequestPlacement(amount: number): boolean {
    return this.lastPlacementAmount === undefined
      ? amount >= 100
      : amount - this.lastPlacementAmount >= 50
  }

  hasPlacedThisCycle(): boolean {
    return this.lastPlacementAmount !== undefined
  }

  completePlacement(amount: number): void {
    this.lastPlacementAmount = amount
  }
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
