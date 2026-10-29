const ACHIEVEMENT_STORAGE_KEY = 'one-more-coin:full-machine-achievement'
const BASE_PRIZE_COUNT = 6
const LUCA_STORAGE_KEY = 'one-more-coin:luca-unlocked'
const LUCA_REVEAL_KEY = 'one-more-coin:luca-reveal-seen'

interface CollectionStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Tracks the current machine's prizes; only the completed achievement persists. */
export class PrizeCollection {
  private readonly collected = new Set<number>()
  private readonly storage?: CollectionStorage
  private unlocked = false
  private lucaUnlocked = false
  private revealSeen = false

  constructor(storage?: CollectionStorage) {
    try {
      this.storage = storage ?? (typeof window === 'undefined' ? undefined : window.localStorage)
      this.unlocked = this.storage?.getItem(ACHIEVEMENT_STORAGE_KEY) === 'true'
      // Existing title holders have already met the condition; migrate their unlock as well.
      this.lucaUnlocked = this.unlocked || this.storage?.getItem(LUCA_STORAGE_KEY) === 'true'
      this.revealSeen = this.storage?.getItem(LUCA_REVEAL_KEY) === 'true'
      if (this.lucaUnlocked) this.storage?.setItem(LUCA_STORAGE_KEY, 'true')
    } catch {
      // Keep the achievement in memory when browser storage is unavailable.
    }
  }

  record(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= (this.lucaUnlocked ? BASE_PRIZE_COUNT + 1 : BASE_PRIZE_COUNT) || this.collected.has(index)) return false
    this.collected.add(index)
    if (this.unlocked || this.collected.size !== BASE_PRIZE_COUNT) return false
    this.unlocked = true
    this.lucaUnlocked = true
    try { this.storage?.setItem(ACHIEVEMENT_STORAGE_KEY, 'true'); this.storage?.setItem(LUCA_STORAGE_KEY, 'true') } catch { /* Storage is optional. */ }
    return true
  }

  reset(): void { this.collected.clear() }

  isLucaUnlocked(): boolean { return this.lucaUnlocked }

  needsLucaReveal(): boolean { return this.lucaUnlocked && !this.revealSeen }

  acknowledgeLucaReveal(): void {
    this.revealSeen = true
    try { this.storage?.setItem(LUCA_REVEAL_KEY, 'true') } catch { /* Storage is optional. */ }
  }

  isComplete(): boolean { return this.unlocked }
}
