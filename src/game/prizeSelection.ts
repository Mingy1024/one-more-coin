interface PlanarPoint {
  x: number
  z: number
}

const MAX_AIM_DISTANCE = 0.55

export function selectPrizeForAim(claw: PlanarPoint, prizes: (PlanarPoint | undefined)[]): number | undefined {
  let selected: number | undefined
  let nearest = MAX_AIM_DISTANCE
  prizes.forEach((prize, index) => {
    if (!prize) return
    const distance = Math.hypot(prize.x - claw.x, prize.z - claw.z)
    if (distance < nearest) {
      nearest = distance
      selected = index
    }
  })
  return selected
}
