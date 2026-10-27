const LEGACY_AUDIO_ENABLED_KEY = 'one-more-coin:audio-enabled'
const MUSIC_ENABLED_KEY = 'one-more-coin:music-enabled'
const EFFECTS_ENABLED_KEY = 'one-more-coin:effects-enabled'

type EffectName = 'clawDrop' | 'clawClose' | 'prizeRattle' | 'coinInsert'
  | 'titleUnlock' | 'participation' | 'memorial' | 'clerkCall' | 'clerkArrival' | 'clerkJudgment'

const EFFECT_SOURCES: Record<EffectName, string> = {
  clawDrop: '/audio/claw-drop-soft.wav',
  clawClose: '/audio/claw-close-soft.wav',
  prizeRattle: '/audio/prize-rattle-soft.wav',
  coinInsert: '/audio/coin-insert-soft.wav',
  titleUnlock: '/audio/title-unlock-soft.wav',
  participation: '/audio/participation-soft.wav',
  memorial: '/audio/memorial-soft.wav',
  clerkCall: '/audio/clerk-call-soft.wav',
  clerkArrival: '/audio/clerk-arrival-soft.wav',
  clerkJudgment: '/audio/clerk-judgment-soft.wav',
}

const EFFECT_VOLUMES: Partial<Record<EffectName, number>> = {
  coinInsert: 0.65,
  titleUnlock: 0.3,
  participation: 0.28,
  memorial: 0.32,
  clerkCall: 0.7,
  clerkArrival: 0.38,
  clerkJudgment: 0.38,
}

function loadAudioPreference(key: string): boolean {
  try {
    return (window.localStorage.getItem(key) ?? window.localStorage.getItem(LEGACY_AUDIO_ENABLED_KEY)) !== 'false'
  } catch {
    return true
  }
}

export class GameAudio {
  private musicEnabled = loadAudioPreference(MUSIC_ENABLED_KEY)
  private effectsEnabled = loadAudioPreference(EFFECTS_ENABLED_KEY)
  private started = false
  private paused = false
  private context?: AudioContext
  private motorGain?: GainNode
  private motorOscillator?: OscillatorNode
  private readonly activeEffects = new Set<HTMLAudioElement>()
  private readonly music = new Audio('/audio/flowerbed-fields-06.mp3')
  private readonly effects: Record<EffectName, HTMLAudioElement> = {
    clawDrop: new Audio(EFFECT_SOURCES.clawDrop),
    clawClose: new Audio(EFFECT_SOURCES.clawClose),
    prizeRattle: new Audio(EFFECT_SOURCES.prizeRattle),
    coinInsert: new Audio(EFFECT_SOURCES.coinInsert),
    titleUnlock: new Audio(EFFECT_SOURCES.titleUnlock),
    participation: new Audio(EFFECT_SOURCES.participation),
    memorial: new Audio(EFFECT_SOURCES.memorial),
    clerkCall: new Audio(EFFECT_SOURCES.clerkCall),
    clerkArrival: new Audio(EFFECT_SOURCES.clerkArrival),
    clerkJudgment: new Audio(EFFECT_SOURCES.clerkJudgment),
  }

  constructor() {
    this.music.loop = true
    // The music file is already attenuated; iOS Safari ignores media element volume.
    this.music.preload = 'none'
    for (const [name, effect] of Object.entries(this.effects) as [EffectName, HTMLAudioElement][]) {
      effect.preload = 'auto'
      effect.volume = EFFECT_VOLUMES[name] ?? 0.42
    }
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled
  }

  isEffectsEnabled(): boolean {
    return this.effectsEnabled
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled
    try {
      window.localStorage.setItem(MUSIC_ENABLED_KEY, String(enabled))
    } catch { /* Audio preferences are optional. */ }
    if (enabled && this.started) this.startGameAudio()
    else if (!enabled) this.music.pause()
  }

  setEffectsEnabled(enabled: boolean): void {
    this.effectsEnabled = enabled
    try {
      window.localStorage.setItem(EFFECTS_ENABLED_KEY, String(enabled))
    } catch { /* Audio preferences are optional. */ }
    if (enabled && this.started) void this.unlockAudio()
    else if (!enabled) {
      this.setMovement(0)
      for (const effect of this.activeEffects) effect.pause()
      this.activeEffects.clear()
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (paused) {
      this.music.pause()
      this.setMovement(0)
    } else if (this.started) {
      this.startGameAudio()
    }
  }

  startGameAudio(): void {
    this.started = true
    if (this.effectsEnabled) void this.unlockAudio()
    if (this.musicEnabled && !this.paused && document.visibilityState === 'visible' && this.music.paused) {
      void this.music.play().catch(() => undefined)
    }
  }

  playEffect(name: EffectName): void {
    if (!this.effectsEnabled || document.visibilityState !== 'visible') return
    const source = this.effects[name]
    const effect = source.cloneNode() as HTMLAudioElement
    effect.volume = source.volume
    this.activeEffects.add(effect)
    effect.addEventListener('ended', () => this.activeEffects.delete(effect), { once: true })
    void effect.play().catch(() => this.activeEffects.delete(effect))
  }

  setMovement(strength: number): void {
    const gain = this.motorGain
    const oscillator = this.motorOscillator
    if (!gain || !oscillator) return

    const activeStrength = this.effectsEnabled && this.started && !this.paused && document.visibilityState === 'visible'
      ? Math.min(1, Math.max(0, strength))
      : 0
    const now = this.context?.currentTime ?? 0
    gain.gain.cancelScheduledValues(now)
    gain.gain.setTargetAtTime(activeStrength * 0.0135, now, 0.045)
    oscillator.frequency.setTargetAtTime(72 + activeStrength * 48, now, 0.06)
  }

  private async unlockAudio(): Promise<void> {
    try {
      if (!this.context && typeof window.AudioContext !== 'undefined') {
        this.context = new AudioContext()
        this.motorGain = this.context.createGain()
        const filter = this.context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 260
        this.motorOscillator = this.context.createOscillator()
        this.motorOscillator.type = 'sawtooth'
        this.motorGain.gain.value = 0
        this.motorOscillator.connect(filter)
        filter.connect(this.motorGain)
        this.motorGain.connect(this.context.destination)
        this.motorOscillator.start()
      }
      if (this.context?.state === 'suspended') await this.context.resume()
    } catch {
      // Audio is an enhancement; devices that cannot initialize Web Audio still get the media effects.
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.music.pause()
      this.setMovement(0)
      return
    }
    if (this.started && !this.paused) this.startGameAudio()
  }
}
