import { describe, expect, it } from 'vitest'

import { CoinLedger } from './coinLedger'

describe('coin spend ledger', () => {
  it('adds ten dollars for every new round', () => {
    const ledger = new CoinLedger()

    ledger.insertCoin()
    ledger.insertCoin()

    expect(ledger.snapshot()).toMatchObject({ amount: 20, title: '試水溫選手' })
  })

  it('unlocks playful titles at cumulative spend thresholds', () => {
    const ledger = new CoinLedger()
    let latestAchievement

    for (let count = 0; count < 5; count += 1) {
      latestAchievement = ledger.insertCoin().achievement
    }

    expect(ledger.snapshot()).toMatchObject({ amount: 50, title: '上好美盤' })
    expect(latestAchievement).toMatchObject({ name: '上好美盤', threshold: 50 })
  })

  it('only announces a title once when its threshold is reached', () => {
    const ledger = new CoinLedger()

    const firstCoin = ledger.insertCoin()
    const secondCoin = ledger.insertCoin()

    expect(firstCoin.achievement?.name).toBe('試水溫選手')
    expect(secondCoin.achievement).toBeUndefined()
  })

  it('keeps the total across failed rounds and resets after a prize is won', () => {
    const ledger = new CoinLedger()

    for (let count = 0; count < 10; count += 1) ledger.insertCoin()
    const settled = ledger.settleWin()

    expect(settled).toMatchObject({ amount: 100, title: '無情的投幣機器' })
    expect(ledger.snapshot()).toMatchObject({ amount: 0, title: '尚未入坑' })
  })

  it('continues with increasingly absurd titles for determined players', () => {
    const ledger = new CoinLedger()

    for (let count = 0; count < 30; count += 1) ledger.insertCoin()

    expect(ledger.snapshot().title).toBe('今晚真的不用睡')
  })

  it('keeps unlocked titles after a successful grab resets the spend counter', () => {
    const ledger = new CoinLedger()
    for (let count = 0; count < 5; count += 1) ledger.insertCoin()

    ledger.settleWin()

    expect(ledger.snapshot().amount).toBe(0)
    expect(ledger.unlockedTitles().map((title) => title.name)).toEqual([
      '試水溫選手', '再一枚就好', '上好美盤',
    ])
    expect(ledger.unlockedTitles()[2]).toMatchObject({ threshold: 50 })
    expect(ledger.unlockedTitles()[2]?.description).toBeTruthy()
  })

  it('restores earned titles on the same device without restoring the current spend', () => {
    const saved = new Map<string, string>()
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value) },
    }
    const firstSession = new CoinLedger(storage)
    for (let count = 0; count < 3; count += 1) firstSession.insertCoin()

    const nextSession = new CoinLedger(storage)

    expect(nextSession.snapshot().amount).toBe(0)
    expect(nextSession.unlockedTitles().map((title) => title.threshold)).toEqual([10, 30])
  })
})
