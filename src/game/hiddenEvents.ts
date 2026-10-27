export type HiddenResultEvent = 'participation' | 'memorial'

export class HiddenEventSequence {
  private consecutiveLosses = 0

  onLoss(): HiddenResultEvent | undefined {
    this.consecutiveLosses += 1
    if (this.consecutiveLosses === 3) return 'participation'
    if (this.consecutiveLosses === 6) return 'memorial'
    return undefined
  }

  onWin(): void {
    this.consecutiveLosses = 0
  }
}
