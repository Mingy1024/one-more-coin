export interface SpendTitle {
  description: string
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
const TITLES_STORAGE_KEY = 'one-more-coin:unlocked-titles'

interface TitleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const spendTitles: SpendTitle[] = [
  { threshold: 10, name: '試水溫選手', emoji: '🪙', description: '第一枚硬幣落下，朋友已經開始看戲。' },
  { threshold: 30, name: '再一枚就好', emoji: '🤏', description: '每次都說最後一次，機台都記得。' },
  { threshold: 50, name: '上好美盤', emoji: '🥏', description: '盤得很有自信，至少姿勢要漂亮。' },
  { threshold: 80, name: '不信邪挑戰者', emoji: '😤', description: '角度沒問題，一定是剛剛風比較大。' },
  { threshold: 100, name: '無情的投幣機器', emoji: '🦾', description: '手比腦快，十元硬幣自動上膛。' },
  { threshold: 150, name: '機台榮譽股東', emoji: '📈', description: '投入這麼多，差點想參加股東會。' },
  { threshold: 200, name: '老闆看到會敬禮', emoji: '🫡', description: '老闆遠遠看見你，先把燈打亮。' },
  { threshold: 300, name: '今晚真的不用睡', emoji: '🌙', description: '娃娃還沒出來，睡意已經先走了。' },
]

export class CoinLedger {
  private amount = 0
  private readonly unlockedThresholds = new Set<number>()
  private readonly storage?: TitleStorage

  constructor(storage?: TitleStorage) {
    this.storage = storage ?? browserStorage()
    try {
      const saved = JSON.parse(this.storage?.getItem(TITLES_STORAGE_KEY) ?? '[]')
      if (Array.isArray(saved)) {
        for (const threshold of saved) {
          if (spendTitles.some((title) => title.threshold === threshold)) {
            this.unlockedThresholds.add(threshold)
          }
        }
      }
    } catch {
      // Storage may be unavailable; titles still work for this session.
    }
  }

  insertCoin(): SpendSnapshot {
    const previousTitle = this.currentTitle()
    this.amount += COIN_VALUE
    const currentTitle = this.currentTitle()
    if (currentTitle && !this.unlockedThresholds.has(currentTitle.threshold)) {
      this.unlockedThresholds.add(currentTitle.threshold)
      try {
        this.storage?.setItem(TITLES_STORAGE_KEY, JSON.stringify([...this.unlockedThresholds]))
      } catch {
        // Keep the in-memory collection if storage is blocked.
      }
    }

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

  unlockedTitles(): SpendTitle[] {
    return spendTitles.filter((title) => this.unlockedThresholds.has(title.threshold))
  }

  private currentTitle(): SpendTitle | undefined {
    for (let index = spendTitles.length - 1; index >= 0; index -= 1) {
      const title = spendTitles[index]
      if (title && this.amount >= title.threshold) return title
    }
    return undefined
  }
}

function browserStorage(): TitleStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
