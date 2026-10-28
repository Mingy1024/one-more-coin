export interface ReturnDisturbance {
  peak: number
  strength: number
  direction: number
}

// Vary the rail vibration itself; pickup and win decisions still use physical support.
export function createReturnDisturbance(random: () => number = Math.random): ReturnDisturbance {
  const sample = (): number => Math.max(0, Math.min(1, random()))
  return {
    peak: 0.38 + sample() * 0.18,
    strength: 0.65 + sample() * 0.55,
    direction: sample() * Math.PI * 2,
  }
}

export function returnDisturbanceAt(profile: ReturnDisturbance | undefined, progress: number): number {
  if (!profile) return 0
  const distance = Math.abs(progress - profile.peak) / 0.18
  if (distance >= 1) return 0
  return (1 + Math.cos(distance * Math.PI)) * 0.5 * profile.strength
}

export function returnTripDuration(distance: number): number {
  return Math.max(1.4, Math.min(2.8, 1.1 + Math.max(0, distance) / 1.8))
}
