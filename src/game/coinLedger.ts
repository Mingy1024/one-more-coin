import { getMessages } from '../i18n'

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

export const spendTitles = [
  { threshold: 10, emoji: '🪙' }, { threshold: 30, emoji: '🤏' },
  { threshold: 50, emoji: '🥏' }, { threshold: 80, emoji: '😤' },
  { threshold: 100, emoji: '🦾' }, { threshold: 150, emoji: '📈' },
  { threshold: 200, emoji: '🫡' }, { threshold: 300, emoji: '🌙' },
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
      title: currentTitle?.name ?? getMessages().noTitle,
      achievement: currentTitle?.threshold !== previousTitle?.threshold ? currentTitle : undefined,
    }
  }

  snapshot(): SpendSnapshot {
    return {
      amount: this.amount,
      title: this.currentTitle()?.name ?? getMessages().noTitle,
    }
  }

  settleWin(): SpendSnapshot {
    const settled = this.snapshot()
    this.amount = 0
    return settled
  }

  unlockedTitles(): SpendTitle[] {
    return spendTitles.flatMap((title, index) =>
      this.unlockedThresholds.has(title.threshold) ? [localizedTitle(index)] : [])
  }

  private currentTitle(): SpendTitle | undefined {
    for (let index = spendTitles.length - 1; index >= 0; index -= 1) {
      const title = spendTitles[index]
      if (title && this.amount >= title.threshold) return localizedTitle(index)
    }
    return undefined
  }
}

function localizedTitle(index: number): SpendTitle {
  const meta = spendTitles[index]!
  const copy = getMessages().titles[index]!
  return { ...meta, ...copy }
}

function browserStorage(): TitleStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}
