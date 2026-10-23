export interface SpendTitle {
  emoji: string
  name: string
  threshold: number
}

export interface SpendSnapshot {
  achievement?: SpendTitle
  amount: number
  title: string
}

const COIN_VALUE = 10

export const spendTitles: SpendTitle[] = [
  { threshold: 10, name: '試水溫選手', emoji: '🪙' },
  { threshold: 30, name: '再一枚就好', emoji: '🤏' },
  { threshold: 50, name: '上好美盤', emoji: '🥏' },
  { threshold: 80, name: '不信邪挑戰者', emoji: '😤' },
  { threshold: 100, name: '無情的投幣機器', emoji: '🦾' },
  { threshold: 150, name: '機台榮譽股東', emoji: '📈' },
  { threshold: 200, name: '老闆看到會敬禮', emoji: '🫡' },
  { threshold: 300, name: '今晚真的不用睡', emoji: '🌙' },
]

export class CoinLedger {
  private amount = 0

  insertCoin(): SpendSnapshot {
    const previousTitle = this.currentTitle()
    this.amount += COIN_VALUE
    const currentTitle = this.currentTitle()

    return {
      amount: this.amount,
      title: currentTitle?.name ?? '尚未入坑',
      achievement: currentTitle !== previousTitle ? currentTitle : undefined,
    }
  }

  snapshot(): SpendSnapshot {
    return {
      amount: this.amount,
      title: this.currentTitle()?.name ?? '尚未入坑',
    }
  }

  settleWin(): SpendSnapshot {
    const settled = this.snapshot()
    this.amount = 0
    return settled
  }

  private currentTitle(): SpendTitle | undefined {
    for (let index = spendTitles.length - 1; index >= 0; index -= 1) {
      const title = spendTitles[index]
      if (title && this.amount >= title.threshold) return title
    }
    return undefined
  }
}
