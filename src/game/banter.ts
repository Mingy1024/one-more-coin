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

  if (phase === 'lowering' || phase === 'closing') {
    return line('朋友群', '👀', '有喔有喔，感覺要夾到了！')
  }

  if (phase === 'lifting' || phase === 'returning' || phase === 'releasing') {
    return carried
      ? line('朋友 A', '🤫', '有有有！先不要叫，還沒進洞！')
      : line('機台', '✨', '感謝使用「摸一下就走」服務。')
  }

  if (phase === 'resetting') {
    return carried
      ? line('朋友 A', '🤫', '有有有！先不要叫，還沒進洞！')
      : line('機台', '✨', '感謝使用「摸一下就走」服務。')
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
