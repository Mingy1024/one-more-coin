import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BanterPresenter, type BanterRender } from './banterPresenter'

const firstLine = { emoji: '😎', speaker: '本人', text: '夾了啦，哪次不夾。' }
const secondLine = { emoji: '👀', speaker: '朋友群', text: '有喔有喔，感覺要夾到了！' }
const thirdLine = { emoji: '✨', speaker: '機台', text: '感謝使用「摸一下就走」服務。' }

describe('banter presenter', () => {
  let rendered: BanterRender[]

  beforeEach(() => {
    vi.useFakeTimers()
    rendered = []
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps each line visible for its full reading time', () => {
    const presenter = new BanterPresenter((render) => rendered.push(render))

    presenter.show(firstLine)
    presenter.show(secondLine)
    vi.advanceTimersByTime(4_499)

    expect(rendered.at(-1)?.line).toEqual(firstLine)

    vi.advanceTimersByTime(1)
    expect(rendered.at(-1)?.line).toEqual(secondLine)
  })

  it('plays rapid phase messages in order instead of replacing them', () => {
    const presenter = new BanterPresenter((render) => rendered.push(render))

    presenter.show(firstLine)
    presenter.show(secondLine)
    presenter.show(thirdLine)
    vi.advanceTimersByTime(9_000)

    expect(rendered.map(({ line }) => line.text)).toEqual([
      firstLine.text,
      secondLine.text,
      thirdLine.text,
    ])
  })

  it('interrupts queued chatter for a round result', () => {
    const presenter = new BanterPresenter((render) => rendered.push(render))
    const resultLine = { emoji: '🎉', speaker: '朋友群', text: '至少真的夾到了。' }

    presenter.show(firstLine)
    presenter.show(secondLine)
    presenter.show(resultLine, { interrupt: true })
    vi.advanceTimersByTime(6_000)

    expect(rendered.at(-1)?.line).toEqual(resultLine)
    expect(rendered.map(({ line }) => line.text)).not.toContain(secondLine.text)
  })

  it('does not queue the same line more than once', () => {
    const presenter = new BanterPresenter((render) => rendered.push(render))

    presenter.show(firstLine)
    presenter.show(secondLine)
    presenter.show(secondLine)
    vi.advanceTimersByTime(9_000)

    expect(rendered.map(({ line }) => line.text)).toEqual([firstLine.text, secondLine.text])
  })

  it('hides a line after reading time when no more chatter is queued', () => {
    const hide = vi.fn()
    const presenter = new BanterPresenter((render) => rendered.push(render), undefined, hide)

    presenter.show(firstLine)
    vi.advanceTimersByTime(4_499)
    expect(hide).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(hide).toHaveBeenCalledOnce()
  })

  it('keeps the overlay visible while the next line is queued', () => {
    const hide = vi.fn()
    const presenter = new BanterPresenter((render) => rendered.push(render), undefined, hide)

    presenter.show(firstLine)
    presenter.show(secondLine)
    vi.advanceTimersByTime(4_500)

    expect(rendered.at(-1)?.line).toEqual(secondLine)
    expect(hide).not.toHaveBeenCalled()
  })

  it('can clear a covered line so it is shown anew after another overlay closes', () => {
    const hide = vi.fn()
    const presenter = new BanterPresenter((render) => rendered.push(render), undefined, hide)

    presenter.show(firstLine)
    presenter.clear()
    vi.advanceTimersByTime(4_500)
    expect(hide).toHaveBeenCalledOnce()

    presenter.show(firstLine)
    expect(rendered.map(({ line }) => line.text)).toEqual([firstLine.text, firstLine.text])
  })
})
