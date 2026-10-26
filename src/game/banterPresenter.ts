import type { BanterLine } from './banter'

export interface BanterRender {
  durationMs: number
  line: BanterLine
}

interface ShowOptions {
  interrupt?: boolean
}

export const BANTER_MIN_DISPLAY_MS = 4_500

export class BanterPresenter {
  private current?: BanterLine
  private pending: BanterLine[] = []
  private timeoutId?: ReturnType<typeof setTimeout>

  constructor(
    private readonly render: (render: BanterRender) => void,
    private readonly displayMs = BANTER_MIN_DISPLAY_MS,
    private readonly hide: () => void = () => {},
  ) {}

  show(line: BanterLine, options: ShowOptions = {}): void {
    if (options.interrupt) {
      this.pending = []
      if (sameLine(this.current, line)) return
      this.display(line)
      return
    }

    if (sameLine(this.current, line) || this.pending.some((queued) => sameLine(queued, line))) return

    if (!this.current || this.timeoutId === undefined) {
      this.display(line)
      return
    }

    this.pending.push(line)
  }

  clear(): void {
    if (this.timeoutId !== undefined) clearTimeout(this.timeoutId)
    this.timeoutId = undefined
    this.pending = []
    this.current = undefined
    this.hide()
  }

  private display(line: BanterLine): void {
    if (this.timeoutId !== undefined) clearTimeout(this.timeoutId)
    this.current = line
    this.render({ durationMs: this.displayMs, line })
    this.timeoutId = setTimeout(() => this.advance(), this.displayMs)
  }

  private advance(): void {
    this.timeoutId = undefined
    const next = this.pending.shift()
    if (next) this.display(next)
    else this.hide()
  }
}

function sameLine(a: BanterLine | undefined, b: BanterLine): boolean {
  return a?.speaker === b.speaker && a.text === b.text
}
