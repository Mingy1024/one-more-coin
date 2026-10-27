import type { RoundPhase } from './round'
import { getMessages } from '../i18n'

export interface BanterContext {
  attempts: number
  carried: boolean
  phase: RoundPhase
  timeLeft: number
}

export interface BanterLine {
  emoji: string
  speaker: string
  text: string
}

export function banterFor(context: BanterContext): BanterLine {
  const { attempts, carried, phase, timeLeft } = context
  const b = getMessages().banter

  if (phase === 'ready') {
    return line(b.friends, '👀', b.ready)
  }

  if (phase === 'aiming') {
    if (timeLeft <= 5) return line(b.friendA, '⏱', b.lastFive)
    if (timeLeft <= 10) return line(b.friendB, '😤', b.lastTen)
    if (attempts >= 2) return line(b.friendB, '🧾', b.repeated)
    if (attempts === 1) return line(b.friendA, '🤔', b.firstTry)
    return line(b.friendB, '😎', b.confident)
  }

  if (phase === 'lowering' || phase === 'closing') {
    return line(b.friends, '👀', b.lowering)
  }

  if (phase === 'lifting' || phase === 'returning' || phase === 'releasing') {
    return carried
      ? line(b.friendA, '🤫', b.carried)
      : line(b.machine, '✨', b.missed)
  }

  if (phase === 'resetting') {
    return carried
      ? line(b.friendA, '🤫', b.carried)
      : line(b.machine, '✨', b.missed)
  }

  if (phase === 'won') {
    return attempts <= 1
      ? line(b.friendA, '😳', b.firstWin)
      : line(b.friends, '🎉', b.win)
  }

  return line(b.machine, '🫡', b.lost)
}

function line(speaker: string, emoji: string, text: string): BanterLine {
  return { emoji, speaker, text }
}
