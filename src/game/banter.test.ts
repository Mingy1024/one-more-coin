import { describe, expect, it } from 'vitest'

import { banterFor } from './banter'

describe('contextual banter', () => {
  it('opens with the player acting confident', () => {
    const line = banterFor({ phase: 'aiming', attempts: 0, timeLeft: 30, carried: false })

    expect(line).toMatchObject({ speaker: '本人', text: '夾了啦，哪次不夾。' })
  })

  it('makes the friends react while the claw is lowering', () => {
    const line = banterFor({ phase: 'lowering', attempts: 1, timeLeft: 25, carried: false })

    expect(line.text).toBe('有喔有喔，感覺要夾到了！')
  })

  it('escalates the joke when time is running out', () => {
    const line = banterFor({ phase: 'aiming', attempts: 2, timeLeft: 8, carried: false })

    expect(line.text).toBe('這裡不夾出來，晚上睡不著。')
  })

  it('turns repeated attempts into a sunk-cost joke', () => {
    const line = banterFor({ phase: 'aiming', attempts: 2, timeLeft: 18, carried: false })

    expect(line.text).toBe('都夾這麼多了，盤要盤得有價值。')
  })

  it('celebrates the ending without asking what it cost', () => {
    const line = banterFor({ phase: 'won', attempts: 3, timeLeft: 4, carried: false })

    expect(line.text).toBe('花多少先不要問，至少真的夾到了。')
  })
})
