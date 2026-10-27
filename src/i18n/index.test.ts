import { afterEach, describe, expect, it } from 'vitest'

import { banterFor } from '../game/banter'
import { CoinLedger } from '../game/coinLedger'
import { getMessages, setLocale } from './index'

afterEach(() => setLocale('zh-Hant'))

describe('language switching', () => {
  it('changes live game replies and prize names', () => {
    setLocale('jp')

    expect(banterFor({ phase: 'aiming', attempts: 2, timeLeft: 18, carried: false }))
      .toMatchObject({ speaker: '友人B', text: 'ここまで来たら、せめて思い出くらい持ち帰ろう。' })
    expect(getMessages().prizes[3]).toBe('ヤドン')
    expect(getMessages().game.status.lowering).toContain('早めに閉じます')
  })

  it('keeps spending progress while title names change with the language', () => {
    const storage = { getItem: () => null, setItem: () => {} }
    const ledger = new CoinLedger(storage)
    ledger.insertCoin()
    expect(ledger.snapshot().title).toBe('試水溫選手')

    setLocale('jp')
    expect(ledger.snapshot()).toMatchObject({ amount: 10, title: 'お試しプレイヤー' })
    expect(ledger.unlockedTitles()[0]?.description).toContain('友人')
  })
})
