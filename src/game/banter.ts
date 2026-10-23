import type { RoundPhase } from './round'

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

  if (phase === 'ready') {
    return line('朋友群', '👀', '大家先安靜，他又在研究角度了。')
  }

  if (phase === 'aiming') {
    if (timeLeft <= 5) return line('朋友 A', '⏱', '最後五秒，尊嚴不要了，直接下！')
    if (timeLeft <= 10) return line('本人', '😤', '這裡不夾出來，晚上睡不著。')
    if (attempts >= 2) return line('朋友 B', '🧾', '都夾這麼多了，盤要盤得有價值。')
    if (attempts === 1) return line('朋友 A', '🤔', '剛剛那次不算，手感才剛熱。')
    return line('本人', '😎', '夾了啦，哪次不夾。')
  }

  if (phase === 'lowering') {
    return line('朋友群', '👀', '有喔有喔，感覺要夾到了！')
  }

  if (phase === 'closing') {
    return line('夾爪', '🤏', '我先意思一下，大家不要有壓力。')
  }

  if (phase === 'lifting') {
    return carried
      ? line('朋友 A', '🤫', '有有有！先不要叫，還沒進洞！')
      : line('機台', '✨', '感謝使用「摸一下就走」服務。')
  }

  if (phase === 'returning') {
    return carried
      ? line('全場', '🚨', '不要晃！不要晃！今天可以睡了！')
      : line('本人', '🧠', '位置其實對了，是爪子沒有配合。')
  }

  if (phase === 'releasing') {
    return line('本人', '😤', '這裡不夾出來，晚上睡不著。')
  }

  if (phase === 'resetting') {
    return line('朋友 B', '🧾', '都夾這麼多了，盤要盤得有價值。')
  }

  if (phase === 'won') {
    return attempts <= 1
      ? line('朋友 A', '😳', '欸不是，你真的一次就夾到了。')
      : line('朋友群', '🎉', '花多少先不要問，至少真的夾到了。')
  }

  return line('機台', '🫡', '歡迎下次繼續證明自己。')
}

function line(speaker: string, emoji: string, text: string): BanterLine {
  return { emoji, speaker, text }
}
