export interface LinkagePose {
  fingerAngle: number
  knuckleRadius: number
  knuckleY: number
  sliderY: number
  tipRadius: number
  tipY: number
}

const CLOSED_ANGLE = -0.32
const OPEN_ANGLE = 0.18
const HUB_RADIUS = 0.1
const UPPER_ANCHOR_RADIUS = 0.16
const UPPER_ANCHOR_Y = -0.03
const KNUCKLE = { radius: 0.32, y: -0.42 }
const TIP = { radius: 0.18, y: -0.98 }
const LINK_LENGTH = 0.62

export function linkagePose(opening: number): LinkagePose {
  const amount = clamp(opening, 0, 1)
  const fingerAngle = CLOSED_ANGLE + (OPEN_ANGLE - CLOSED_ANGLE) * amount
  const knuckle = rotatePoint(KNUCKLE, fingerAngle)
  const tip = rotatePoint(TIP, fingerAngle)
  const knuckleRadius = HUB_RADIUS + knuckle.radius
  const horizontalGap = knuckleRadius - UPPER_ANCHOR_RADIUS
  const verticalGap = Math.sqrt(Math.max(0, LINK_LENGTH ** 2 - horizontalGap ** 2))

  return {
    fingerAngle,
    knuckleRadius,
    knuckleY: knuckle.y,
    sliderY: UPPER_ANCHOR_Y - verticalGap - knuckle.y,
    tipRadius: HUB_RADIUS + tip.radius,
    tipY: -tip.y,
  }
}

function rotatePoint(point: { radius: number; y: number }, angle: number): { radius: number; y: number } {
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  return {
    radius: point.radius * cosine - point.y * sine,
    y: point.radius * sine + point.y * cosine,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
