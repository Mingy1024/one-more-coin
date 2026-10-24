export const MACHINE_DIMENSIONS = {
  glassHeight: 4.05,
  lowerCabinetHeight: 1.52,
  chuteBottomY: -1.55,
  chuteBottomHalfThickness: 0.04,
  chuteWellDepth: 1.5,
  roofY: 4.28,
  clawTopY: 3.55,
  clawLowY: 1.28,
  ropeAnchorY: 4.05,
} as const

export function clawTravelDistance(): number {
  return MACHINE_DIMENSIONS.clawTopY - MACHINE_DIMENSIONS.clawLowY
}

export function lowerCabinetRatio(): number {
  return MACHINE_DIMENSIONS.lowerCabinetHeight / MACHINE_DIMENSIONS.glassHeight
}

export function chuteRestingPrizeTopY(prizeHalfHeight: number): number {
  return MACHINE_DIMENSIONS.chuteBottomY
    + MACHINE_DIMENSIONS.chuteBottomHalfThickness
    + prizeHalfHeight * 2
}
