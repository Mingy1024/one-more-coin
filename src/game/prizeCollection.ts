const ACHIEVEMENT_STORAGE_KEY = 'one-more-coin:full-machine-achievement'
const PRIZE_COUNT = 6

interface CollectionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Tracks the current machine's prizes; only the completed achievement persists. */
export class PrizeCollection {
  private readonly collected = new Set<number>()
  private readonly storage?: CollectionStorage
  private unlocked = false

  constructor(storage?: CollectionStorage) {
    try {
      this.storage = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)
      this.unlocked = this.storage?.getItem(ACHIEVEMENT_STORAGE_KEY) === 'true'
    } catch {
      // Keep the achievement in memory when browser storage is unavailable.
    }
  }

  record(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= PRIZE_COUNT || this.collected.has(index)) return false
    this.collected.add(index)
    if (this.unlocked || this.collected.size !== PRIZE_COUNT) return false
    this.unlocked = true
    try { this.storage?.setItem(ACHIEVEMENT_STORAGE_KEY, 'true') } catch { /* Storage is optional. */ }
    return true
  }

  reset(): void { this.collected.clear() }

  isComplete(): boolean { return this.unlocked }
}
