import './style.css'

import { ClawMachineGame, type GameSnapshot } from './game/ClawMachineGame'
import { BanterPresenter, type BanterRender } from './game/banterPresenter'
import { PrizeCollection } from './game/prizeCollection'
import { CoinLedger, spendTitles, type SpendSnapshot } from './game/coinLedger'
import { ClerkAssistTrigger } from './game/clerkAssist'
import { HiddenEventSequence, type HiddenResultEvent } from './game/hiddenEvents'
import { GameAudio } from './game/audio'
import { applyStaticTranslations, format, getLocale, getMessages, loadLocale, setLocale, type Locale } from './i18n'

setLocale(loadLocale())
applyStaticTranslations()

// iOS Safari can ignore the viewport zoom restriction during a pinch gesture.
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false })
document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false })

const loadingScreen = requireElement<HTMLElement>('loading-screen')
const loadingCopy = requireElement<HTMLElement>('loading-copy')
const introScreen = requireElement<HTMLElement>('intro-screen')
const introEnter = requireElement<HTMLButtonElement>('intro-enter')
const introHelpButton = requireElement<HTMLButtonElement>('intro-help-button')
const topbar = requireElement<HTMLElement>('topbar')
const topbarMenuButton = requireElement<HTMLButtonElement>('topbar-menu-button')
const topbarActions = requireElement<HTMLElement>('topbar-actions')
const compactTopbar = window.matchMedia('(max-width: 860px)')
const introLocaleOptions = [...introScreen.querySelectorAll<HTMLButtonElement>('button[data-intro-locale]')]
const canvas = requireElement<HTMLCanvasElement>('game-canvas')
const timeValue = requireElement<HTMLElement>('time-value')
const attemptValue = requireElement<HTMLElement>('attempt-value')
const spendValue = requireElement<HTMLElement>('spend-value')
const spendTitle = requireElement<HTMLElement>('spend-title')
const statusText = requireElement<HTMLElement>('status-text')
const grabButton = requireElement<HTMLButtonElement>('grab-button')
const grabLabel = requireElement<HTMLElement>('grab-label')
const startButton = requireElement<HTMLButtonElement>('start-button')
const resetButton = requireElement<HTMLButtonElement>('reset-button')
const titlesButton = requireElement<HTMLButtonElement>('titles-button')
const titlesDialog = requireElement<HTMLDialogElement>('titles-dialog')
const titlesClose = requireElement<HTMLButtonElement>('titles-close')
const titlesCount = requireElement<HTMLElement>('titles-count')
const titlesList = requireElement<HTMLOListElement>('titles-list')
const titlesEmpty = requireElement<HTMLElement>('titles-empty')
const clerkDialog = requireElement<HTMLDialogElement>('clerk-dialog')
const clerkCopy = requireElement<HTMLElement>('clerk-dialog-copy')
const clerkSound = requireElement<HTMLElement>('clerk-sound')
const clerkJudgment = requireElement<HTMLElement>('clerk-judgment')
const clerkJudgmentTitle = requireElement<HTMLElement>('clerk-judgment-title')
const clerkJudgmentCopy = requireElement<HTMLElement>('clerk-judgment-copy')
const clerkChoices = requireElement<HTMLElement>('clerk-choices')
const clerkDecline = requireElement<HTMLButtonElement>('clerk-decline')
const clerkCallButton = requireElement<HTMLButtonElement>('clerk-call-button')
const musicToggleButton = requireElement<HTMLButtonElement>('music-toggle-button')
const musicToggleLabel = requireElement<HTMLElement>('music-toggle-label')
const effectsToggleButton = requireElement<HTMLButtonElement>('effects-toggle-button')
const effectsToggleLabel = requireElement<HTMLElement>('effects-toggle-label')
const resultClerkButton = requireElement<HTMLButtonElement>('result-clerk-button')
const clerkCallDialog = requireElement<HTMLDialogElement>('clerk-call-dialog')
const clerkCallClose = requireElement<HTMLButtonElement>('clerk-call-close')
const clerkRescueButton = requireElement<HTMLButtonElement>('clerk-rescue-button')
const clerkPlacementButton = requireElement<HTMLButtonElement>('clerk-placement-button')
const clerkCallFeedback = requireElement<HTMLElement>('clerk-call-feedback')
const startPanel = requireElement<HTMLElement>('start-panel')
const gameControls = requireElement<HTMLElement>('game-controls')
// Fallback for browsers that still try to zoom during a game gesture. Leave touchstart
// alone so a second finger can press the grab button while the joystick is held.
gameControls.addEventListener('touchmove', (event) => {
  if (event.touches.length > 1 && event.cancelable) event.preventDefault()
}, { passive: false })
const joystick = requireElement<HTMLElement>('joystick')
const localeButton = requireElement<HTMLButtonElement>('locale-button')
const localeButtonLabel = requireElement<HTMLElement>('locale-button-label')
const localeMenu = requireElement<HTMLElement>('locale-menu')
const localeOptions = [...localeMenu.querySelectorAll<HTMLButtonElement>('button[data-locale]')]
const banterCard = requireElement<HTMLElement>('banter-card')
const banterEmoji = requireElement<HTMLElement>('banter-emoji')
const banterSpeaker = requireElement<HTMLElement>('banter-speaker')
const banterText = requireElement<HTMLElement>('banter-text')
const restartButton = requireElement<HTMLButtonElement>('restart-button')
const resultModal = requireElement<HTMLElement>('result-modal')
const resultIcon = requireElement<HTMLElement>('result-icon')
const resultTitle = requireElement<HTMLElement>('result-title')
const resultPrize = requireElement<HTMLElement>('result-prize')
const resultPrizePortrait = requireElement<HTMLImageElement>('result-prize-portrait')
const resultPrizeName = requireElement<HTMLElement>('result-prize-name')
const resultCopy = requireElement<HTMLElement>('result-copy')
const resultSpend = requireElement<HTMLElement>('result-spend')
const hiddenResultEvent = requireElement<HTMLElement>('hidden-result-event')
const hiddenEventIcon = requireElement<HTMLImageElement>('hidden-event-icon')
const hiddenEventTitle = requireElement<HTMLElement>('hidden-event-title')
const hiddenEventCopy = requireElement<HTMLElement>('hidden-event-copy')
const achievementToast = requireElement<HTMLElement>('achievement-toast')
const achievementIcon = requireElement<HTMLImageElement>('achievement-icon')
const achievementTitle = requireElement<HTMLElement>('achievement-title')
const achievementCopy = requireElement<HTMLElement>('achievement-copy')
const banterPresenter = new BanterPresenter(renderBanter, undefined, hideBanter)
const coinLedger = new CoinLedger()
const prizeCollection = new PrizeCollection()
const clerkAssist = new ClerkAssistTrigger()
const hiddenEvents = new HiddenEventSequence()
const gameAudio = new GameAudio()
const INTRO_COMPLETED_KEY = 'one-more-coin:intro-completed'
let currentSnapshot: GameSnapshot | undefined
let lastAudioPhase: GameSnapshot['phase'] | undefined
let contextLost = false
let lastResultSpend: SpendSnapshot | undefined
let activeAchievement: { threshold: number; amount: number } | undefined
let activeHiddenResultEvent: HiddenResultEvent | undefined
let hasEnteredGame = (() => {
  try {
    return window.localStorage.getItem(INTRO_COMPLETED_KEY) === 'true'
  } catch {
    return false
  }
})()
let introReturnFocus: HTMLElement | undefined

function syncLocaleControl(): void {
  const locale = getLocale()
  for (const option of localeOptions) {
    const selected = option.dataset.locale === locale
    option.setAttribute('aria-pressed', String(selected))
    if (selected) localeButtonLabel.textContent = option.textContent
  }
  for (const option of introLocaleOptions) {
    option.setAttribute('aria-pressed', String(option.dataset.introLocale === locale))
  }
}

function closeLocaleMenu(): void {
  localeMenu.hidden = true
  localeButton.setAttribute('aria-expanded', 'false')
}

function closeActionMenu(): void {
  if (!topbarActions.classList.contains('is-open')) return
  closeLocaleMenu()
  topbarActions.classList.remove('is-open')
  topbar.classList.remove('menu-open')
  topbarMenuButton.setAttribute('aria-expanded', 'false')
  setGamePaused(false)
}

function focusTopbarAction(button: HTMLButtonElement): void {
  (compactTopbar.matches ? topbarMenuButton : button).focus({ preventScroll: true })
}

syncLocaleControl()
renderSpend(coinLedger.snapshot())
renderAudioControls()
musicToggleButton.addEventListener('click', () => {
  gameAudio.setMusicEnabled(!gameAudio.isMusicEnabled())
  renderAudioControls()
})
effectsToggleButton.addEventListener('click', () => {
  gameAudio.setEffectsEnabled(!gameAudio.isEffectsEnabled())
  renderAudioControls()
  updateMovement()
})

function showLoading(message: string): void {
  loadingCopy.textContent = message
  document.body.dataset.loading = ''
  loadingScreen.hidden = false
}

function hideLoading(): void {
  if (contextLost) return
  loadingScreen.hidden = true
  document.body.removeAttribute('data-loading')
}

function finishLoading(): void {
  if (contextLost) return
  if (!hasEnteredGame) {
    introScreen.hidden = false
    document.body.dataset.intro = ''
  }
  hideLoading()
  if (!hasEnteredGame) introEnter.focus({ preventScroll: true })
}

let game: ClawMachineGame
try {
  game = await ClawMachineGame.create(canvas, updateHud)
} catch (error) {
  loadingCopy.textContent = getMessages().dynamic.loadingFailed
  throw error
}

canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault()
  contextLost = true
  showLoading(getMessages().dynamic.contextLost)
})
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false
  showLoading(getMessages().dynamic.contextRestored)
  game.onNextRenderedFrame(finishLoading)
})

function changeLocale(locale: Locale): void {
  setLocale(locale)
  syncLocaleControl()
  renderAudioControls()
  closeLocaleMenu()
  applyStaticTranslations()
  renderSpend(lastResultSpend ?? coinLedger.snapshot())
  if (activeAchievement) renderAchievement(activeAchievement.threshold, activeAchievement.amount)
  renderHiddenResultEvent()
  banterPresenter.clear()
  game.refreshLocale()
}

topbarMenuButton.addEventListener('click', () => {
  if (topbarActions.classList.contains('is-open')) {
    closeActionMenu()
    return
  }
  closeLocaleMenu()
  topbarActions.classList.add('is-open')
  topbar.classList.add('menu-open')
  topbarMenuButton.setAttribute('aria-expanded', 'true')
  setGamePaused(true)
})
topbarActions.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('.locale-switch, .audio-toggle-button')) return
  if (!(event.target as HTMLElement).closest('button')) return
  closeActionMenu()
  if (compactTopbar.matches) topbarMenuButton.focus({ preventScroll: true })
}, true)
window.addEventListener('resize', () => {
  if (compactTopbar.matches) {
    if (topbarActions.contains(document.activeElement) && !topbarActions.classList.contains('is-open')) topbarMenuButton.focus({ preventScroll: true })
    return
  }
  const menuWasFocused = document.activeElement === topbarMenuButton
  closeActionMenu()
  if (menuWasFocused) introHelpButton.focus({ preventScroll: true })
})

localeButton.addEventListener('click', () => {
  const opening = localeMenu.hidden
  localeMenu.hidden = !opening
  localeButton.setAttribute('aria-expanded', String(opening))
  if (opening) localeOptions.find((option) => option.dataset.locale === getLocale())?.focus({ preventScroll: true })
})
localeMenu.addEventListener('click', (event) => {
  const option = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-locale]')
  if (!option) return
  changeLocale(option.dataset.locale as Locale)
  if (compactTopbar.matches) {
    closeActionMenu()
    topbarMenuButton.focus({ preventScroll: true })
  } else {
    localeButton.focus({ preventScroll: true })
  }
})
introScreen.addEventListener('click', (event) => {
  const option = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-intro-locale]')
  if (!option) return
  changeLocale(option.dataset.introLocale as Locale)
  option.focus({ preventScroll: true })
})
introHelpButton.addEventListener('click', () => {
  closeLocaleMenu()
  introReturnFocus = introHelpButton
  setGamePaused(true)
  introScreen.hidden = false
  document.body.dataset.intro = ''
  introEnter.focus({ preventScroll: true })
})
introEnter.addEventListener('click', () => {
  hasEnteredGame = true
  try {
    window.localStorage.setItem(INTRO_COMPLETED_KEY, 'true')
  } catch {
    // The introduction still works when browser storage is unavailable.
  }
  introScreen.hidden = true
  document.body.removeAttribute('data-intro')
  setGamePaused(false)
  const returnToHelp = introReturnFocus === introHelpButton
  introReturnFocus = undefined
  if (returnToHelp) focusTopbarAction(introHelpButton)
  else startButton.focus({ preventScroll: true })
})
document.addEventListener('pointerdown', (event) => {
  if (!localeButton.parentElement?.contains(event.target as Node)) closeLocaleMenu()
  if (!topbarMenuButton.contains(event.target as Node) && !topbarActions.contains(event.target as Node)) closeActionMenu()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !localeMenu.hidden) {
    closeLocaleMenu()
    localeButton.focus({ preventScroll: true })
    return
  }
  if (event.key === 'Escape' && topbarActions.classList.contains('is-open')) {
    closeActionMenu()
    topbarMenuButton.focus({ preventScroll: true })
    return
  }
})

const keyboard = new Set<string>()
const joystickAxis = { x: 0, z: 0 }
let lastResult: GameSnapshot['result']
let achievementTimeout: ReturnType<typeof setTimeout> | undefined

window.addEventListener('keydown', (event) => {
  if (!hasEnteredGame) return
  if (!introScreen.hidden || topbarActions.classList.contains('is-open')) return
  if (event.code === 'Space' && event.target instanceof HTMLElement && (event.target === topbarMenuButton || topbarActions.contains(event.target))) return
  if (titlesDialog.open || clerkDialog.open || clerkCallDialog.open || !resultModal.hidden) return
  keyboard.add(event.code)
  if (event.code === 'Space') {
    event.preventDefault()
    if (!event.repeat) game.grab()
  }
  updateMovement()
})

window.addEventListener('keyup', (event) => {
  keyboard.delete(event.code)
  updateMovement()
})

window.addEventListener('blur', () => {
  keyboard.clear()
  joystickAxis.x = 0
  joystickAxis.z = 0
  updateMovement()
})

let lastGrabPointerPress = -Infinity
grabButton.addEventListener('pointerdown', event => {
  if (grabButton.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
  lastGrabPointerPress = performance.now()
  event.preventDefault()
  game.grab()
})
grabButton.addEventListener('keydown', () => { lastGrabPointerPress = -Infinity })
grabButton.addEventListener('click', event => {
  const followsPointerPress = performance.now() - lastGrabPointerPress < 1000
  lastGrabPointerPress = -Infinity
  if (!followsPointerPress && event.detail === 0) game.grab()
})
resetButton.addEventListener('click', () => {
  if (!currentSnapshot?.isReady) return
  game.resetPrizes()
  prizeCollection.reset()
  statusText.textContent = getMessages().dynamic.prizesReset
})
titlesButton.addEventListener('click', () => {
  renderTitleGallery()
  setGamePaused(true)
  titlesDialog.showModal()
  titlesClose.focus({ preventScroll: true })
})
titlesClose.addEventListener('click', () => titlesDialog.close())
titlesDialog.addEventListener('close', () => {
  setGamePaused(false)
  focusTopbarAction(titlesButton)
})
titlesDialog.addEventListener('click', (event) => {
  if (event.target === titlesDialog) titlesDialog.close()
})
clerkDecline.addEventListener('click', () => clerkDialog.close())
const openClerkCall = (): void => {
  if (clerkCallDialog.open || clerkDialog.open) return
  clerkCallFeedback.hidden = true
  clerkCallFeedback.textContent = ''
  setGamePaused(true)
  clerkCallDialog.showModal()
  gameAudio.playEffect('clerkCall')
  clerkRescueButton.focus({ preventScroll: true })
}
clerkCallButton.addEventListener('click', openClerkCall)
resultClerkButton.addEventListener('click', openClerkCall)
clerkCallClose.addEventListener('click', () => clerkCallDialog.close())
clerkCallDialog.addEventListener('close', () => {
  if (!clerkDialog.open) {
    setGamePaused(false)
    if (!resultModal.hidden) resultClerkButton.focus({ preventScroll: true })
    else focusTopbarAction(clerkCallButton)
  }
})
clerkRescueButton.addEventListener('click', () => {
  const rescued = game.rescueStuckPrizeForClerk()
  const copy = getMessages().dynamic
  clerkCallFeedback.textContent = rescued
    ? format(copy.rescued, { name: rescued })
    : copy.rescueMissed
  clerkCallFeedback.hidden = false
})
clerkPlacementButton.addEventListener('click', () => {
  const copy = getMessages().dynamic
  const amount = coinLedger.snapshot().amount
  if (!currentSnapshot?.isReady && currentSnapshot?.result !== 'lost') {
    clerkCallFeedback.textContent = copy.placementBusy
    clerkCallFeedback.hidden = false
    return
  }
  if (!clerkAssist.canRequestPlacement(amount)) {
    clerkCallFeedback.textContent = amount < 100 ? copy.placementTooSoon : copy.placementUsed
    clerkCallFeedback.hidden = false
    return
  }
  clerkCallDialog.close()
  resultModal.hidden = true
  showClerkAssist()
})
clerkDialog.addEventListener('close', () => {
  clerkDialog.removeAttribute('data-phase')
  clerkJudgment.hidden = true
  setGamePaused(false)
  game.restart()
  lastResult = undefined
  lastResultSpend = undefined
  startButton.focus({ preventScroll: true })
})
startButton.addEventListener('click', () => {
  gameAudio.startGameAudio()
  gameAudio.playEffect('coinInsert')
  const spend = coinLedger.insertCoin()
  renderSpend(spend)
  if (spend.achievement) showAchievement(spend.achievement.threshold, spend.amount)
  game.startRound()
  grabButton.focus({ preventScroll: true })
})
restartButton.addEventListener('click', () => {
  const machineCleared = game.isMachineCleared()
  resultModal.hidden = true
  activeHiddenResultEvent = undefined
  renderHiddenResultEvent()
  if (lastResult === 'won') renderSpend(coinLedger.snapshot())
  lastResult = undefined
  lastResultSpend = undefined
  game.restart()
  if (machineCleared) {
    game.resetPrizes()
    prizeCollection.reset()
  }
  startButton.focus({ preventScroll: true })
})

preventRapidTouchZoom(canvas)
setupJoystick()
game.setPaused(!hasEnteredGame)
game.onNextRenderedFrame(finishLoading)
game.start()

function preventRapidTouchZoom(element: HTMLElement): void {
  let lastTouchEnd = 0
  // WebKit can still smart-zoom some game surfaces despite touch-action: none.
  element.addEventListener('touchend', (event) => {
    if (event.touches.length !== 0 || event.changedTouches.length !== 1) return
    const now = performance.now()
    if (lastTouchEnd > 0 && now - lastTouchEnd < 300 && event.cancelable) event.preventDefault()
    lastTouchEnd = now
  }, { passive: false })
}

function setupJoystick(): void {
  const joystick = requireElement<HTMLElement>('joystick')
  const knob = requireElement<HTMLElement>('joystick-knob')
  let activePointerId: number | undefined
  let centerX = 0
  let centerY = 0
  let maxDistance = 1

  const move = (event: PointerEvent): void => {
    const rawX = event.clientX - centerX
    const rawY = event.clientY - centerY
    const distance = Math.hypot(rawX, rawY)
    const scale = distance > maxDistance ? maxDistance / distance : 1
    const x = rawX * scale
    const y = rawY * scale

    knob.style.transform = `translate(${x}px, ${y}px)`
    const magnitude = Math.min(1, distance / maxDistance)
    const response = magnitude < 0.08 ? 0 : (magnitude - 0.08) / 0.92
    joystickAxis.x = distance > 0 ? rawX / distance * response : 0
    joystickAxis.z = distance > 0 ? rawY / distance * response : 0
    updateMovement()
  }

  const reset = (): void => {
    if (activePointerId === undefined) return
    const pointerId = activePointerId
    activePointerId = undefined
    if (joystick.hasPointerCapture(pointerId)) joystick.releasePointerCapture(pointerId)
    joystick.classList.remove('is-dragging')
    knob.style.transform = 'translate(0, 0)'
    joystickAxis.x = 0
    joystickAxis.z = 0
    updateMovement()
  }
  const stop = (event: PointerEvent): void => {
    if (event.pointerId === activePointerId) reset()
  }

  joystick.addEventListener('pointerdown', (event) => {
    if (activePointerId !== undefined || (event.pointerType === 'mouse' && event.button !== 0) || currentSnapshot?.phase !== 'aiming') return
    if (event.cancelable) event.preventDefault()
    const bounds = joystick.getBoundingClientRect()
    centerX = bounds.left + bounds.width / 2
    centerY = bounds.top + bounds.height / 2
    maxDistance = Math.max(1, (bounds.width - knob.offsetWidth) / 2 - 4)
    activePointerId = event.pointerId
    joystick.classList.add('is-dragging')
    joystick.setPointerCapture(event.pointerId)
    move(event)
  })
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === activePointerId) move(event)
  })
  joystick.addEventListener('pointerup', stop)
  joystick.addEventListener('pointercancel', stop)
  joystick.addEventListener('lostpointercapture', stop)
  preventRapidTouchZoom(joystick)
  window.addEventListener('blur', reset)
  window.addEventListener('resize', reset)
}

function updateMovement(): void {
  const keyboardX = Number(keyboard.has('ArrowRight') || keyboard.has('KeyD'))
    - Number(keyboard.has('ArrowLeft') || keyboard.has('KeyA'))
  const keyboardZ = Number(keyboard.has('ArrowDown') || keyboard.has('KeyS'))
    - Number(keyboard.has('ArrowUp') || keyboard.has('KeyW'))

  const x = Math.max(-1, Math.min(1, joystickAxis.x + keyboardX))
  const z = Math.max(-1, Math.min(1, joystickAxis.z + keyboardZ))
  game.setMovement(x, z)
  gameAudio.setMovement(currentSnapshot?.phase === 'aiming' ? Math.min(1, Math.hypot(x, z)) : 0)
}

function updateHud(snapshot: GameSnapshot): void {
  currentSnapshot = snapshot
  if (snapshot.phase !== lastAudioPhase) {
    if (snapshot.phase === 'lowering') gameAudio.playEffect('clawDrop')
    else if (snapshot.phase === 'closing') gameAudio.playEffect('clawClose')
    else if (snapshot.phase === 'won') gameAudio.playEffect('prizeRattle')
    lastAudioPhase = snapshot.phase
    if (snapshot.phase !== 'aiming') gameAudio.setMovement(0)
  }
  timeValue.textContent = String(Math.ceil(snapshot.timeLeft))
  attemptValue.textContent = String(snapshot.attempts)
  statusText.textContent = snapshot.status
  grabButton.disabled = !snapshot.canGrab
  resetButton.disabled = !snapshot.isReady
  grabLabel.textContent = snapshot.grabLabel
  startPanel.hidden = !snapshot.isReady
  gameControls.classList.toggle('is-locked', snapshot.isReady)
  joystick.setAttribute('aria-disabled', String(snapshot.phase !== 'aiming'))

  if (achievementToast.hidden) {
    banterPresenter.show(snapshot.banter, {
      interrupt: snapshot.isReady
        || snapshot.result !== undefined
        || (snapshot.attempts === 0 && snapshot.canGrab),
    })
  }
  if (snapshot.isReady || snapshot.result) hideBanter()

  if (snapshot.result) {
    const won = snapshot.result === 'won'
    if (snapshot.result !== lastResult) {
      const spend = won ? coinLedger.settleWin() : coinLedger.snapshot()
      const stuckAtChute = !won && game.hasStuckPrizeForClerk()
      if (won) {
        hiddenEvents.onWin()
        if (snapshot.wonPrizeIndex !== undefined && prizeCollection.record(snapshot.wonPrizeIndex)) {
          showAchievement(-1, 0)
        }
      }
      activeHiddenResultEvent = won || stuckAtChute ? undefined : hiddenEvents.onLoss()
      renderHiddenResultEvent()
      const shouldOfferHelp = stuckAtChute
        ? false
        : clerkAssist.onResult(snapshot.result, spend.amount)
      if (shouldOfferHelp && game.availablePrizesForClerk().length > 0) {
        lastResult = snapshot.result
        resultModal.hidden = true
        showClerkAssist()
        return
      }
      if (activeHiddenResultEvent) gameAudio.playEffect(activeHiddenResultEvent)
      lastResultSpend = spend
      lastResult = snapshot.result
      if (!clerkCallDialog.open) requestAnimationFrame(() => restartButton.focus({ preventScroll: true }))
    }
    if (clerkDialog.open) return
    resultModal.hidden = false
    resultIcon.textContent = won ? '★' : '↻'
    const copy = getMessages().dynamic
    const spend = lastResultSpend ?? coinLedger.snapshot()
    resultSpend.textContent = format(won ? copy.spendWon : copy.spendLost, {
      amount: spend.amount, title: titleForAmount(spend.amount),
    })
    const machineCleared = game.isMachineCleared()
    restartButton.textContent = machineCleared ? getMessages().ui.restartMachine : getMessages().ui.playAgain
    resultTitle.textContent = machineCleared ? copy.machineCleared : won ? copy.resultWon : copy.resultLost
    const prizeIndex = snapshot.wonPrizeIndex
    resultPrize.hidden = !won || prizeIndex === undefined || prizeIndex < 0
    if (!resultPrize.hidden) {
      resultPrizePortrait.src = game.prizePortrait(prizeIndex!)
      resultPrizeName.textContent = getMessages().prizes[prizeIndex!] ?? ''
    }
    resultCopy.textContent = !won && game.hasStuckPrizeForClerk()
      ? copy.stuckAtChute
      : snapshot.banter.text
    resultClerkButton.hidden = won
  }
}

function showClerkAssist(): void {
  gameAudio.playEffect('clerkArrival')
  const copy = getMessages().dynamic
  clerkDialog.removeAttribute('data-phase')
  clerkJudgment.hidden = true
  clerkSound.textContent = copy.clerkSound
  clerkCopy.textContent = copy.clerkIntro
  clerkDecline.textContent = copy.clerkDecline
  clerkChoices.replaceChildren(...game.availablePrizesForClerk().map(({ index, name }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'clerk-choice'
    button.setAttribute('aria-label', format(copy.movePrizeAria, { name }))
    const icon = document.createElement('img')
    icon.className = 'clerk-choice-portrait'
    icon.src = game.prizePortrait(index)
    icon.alt = ''
    icon.width = 48
    icon.height = 48
    const label = document.createElement('span')
    label.textContent = name
    button.append(icon, label)
    button.addEventListener('click', () => {
      const placement = game.placePrizeForClerk(index)
      if (!placement) return
      clerkAssist.completePlacement()
      clerkDialog.dataset.phase = 'placing'
      clerkSound.textContent = placement.type === 'swapped' ? copy.swappedSound : copy.placedSound
      clerkCopy.textContent = placement.type === 'swapped'
        ? format(copy.swapped, { name, displaced: placement.displaced })
        : format(copy.placed, { name })
      clerkJudgmentTitle.textContent = copy.judgmentTitle
      clerkJudgmentCopy.textContent = copy.judgmentCopy
      clerkJudgment.hidden = false
      gameAudio.playEffect('clerkJudgment')
      for (const choice of clerkChoices.querySelectorAll('button')) choice.disabled = true
      clerkDecline.textContent = copy.placementDone
      clerkDecline.focus({ preventScroll: true })
    })
    return button
  }))
  setGamePaused(true)
  clerkDialog.showModal()
  clerkChoices.querySelector('button')?.focus({ preventScroll: true })
}

function renderHiddenResultEvent(): void {
  hiddenResultEvent.hidden = !activeHiddenResultEvent
  if (!activeHiddenResultEvent) {
    resultModal.removeAttribute('data-hidden-event')
    return
  }
  resultModal.dataset.hiddenEvent = activeHiddenResultEvent
  const copy = getMessages().dynamic
  const isParticipation = activeHiddenResultEvent === 'participation'
  hiddenEventIcon.src = `/images/events/${activeHiddenResultEvent}.webp`
  hiddenEventTitle.textContent = isParticipation ? copy.participationTitle : copy.memorialTitle
  hiddenEventCopy.textContent = isParticipation ? copy.participationCopy : copy.memorialCopy
}

function renderSpend(spend: SpendSnapshot): void {
  spendValue.textContent = String(spend.amount)
  spendTitle.textContent = titleForAmount(spend.amount)
}

function titleForAmount(amount: number): string {
  for (let index = spendTitles.length - 1; index >= 0; index -= 1) {
    if (amount >= spendTitles[index]!.threshold) return getMessages().titles[index]!.name
  }
  return getMessages().noTitle
}

function renderTitleGallery(): void {
  const unlocked = coinLedger.unlockedTitles()
  const collectionComplete = prizeCollection.isComplete()
  titlesCount.textContent = format(getMessages().dynamic.titlesCount, {
    count: unlocked.length + Number(collectionComplete), total: spendTitles.length + 1,
  })
  titlesEmpty.hidden = unlocked.length > 0 || collectionComplete
  titlesList.replaceChildren(...unlocked.map((title) => {
    const item = document.createElement('li')
    item.className = 'title-entry'

    const icon = document.createElement('img')
    icon.className = 'title-entry-icon'
    icon.src = `/images/titles/title-${title.threshold}.webp`
    icon.alt = ''
    icon.width = 56
    icon.height = 56
    icon.decoding = 'async'

    const copy = document.createElement('div')
    copy.className = 'title-entry-copy'
    const name = document.createElement('strong')
    name.textContent = title.name
    const detail = document.createElement('p')
    detail.textContent = title.description
    const requirement = document.createElement('small')
    requirement.textContent = format(getMessages().dynamic.titleRequirement, { amount: title.threshold })
    copy.append(name, detail, requirement)
    item.append(icon, copy)
    return item
  }))
  if (collectionComplete) {
    const item = document.createElement('li')
    item.className = 'title-entry'
    const icon = document.createElement('img')
    icon.className = 'title-entry-icon'
    icon.src = '/images/titles/title-collection.png'
    icon.alt = ''
    icon.width = 56
    icon.height = 56
    icon.decoding = 'async'
    const copy = document.createElement('div')
    copy.className = 'title-entry-copy'
    const name = document.createElement('strong')
    name.textContent = getMessages().dynamic.collectionTitle
    const detail = document.createElement('p')
    detail.textContent = getMessages().dynamic.collectionDescription
    const requirement = document.createElement('small')
    requirement.textContent = getMessages().dynamic.collectionRequirement
    copy.append(name, detail, requirement)
    item.append(icon, copy)
    titlesList.append(item)
  }
}

function showAchievement(threshold: number, amount: number): void {
  if (achievementTimeout !== undefined) clearTimeout(achievementTimeout)
  window.setTimeout(() => gameAudio.playEffect('titleUnlock'), 280)
  banterPresenter.clear()
  activeAchievement = { threshold, amount }
  renderAchievement(threshold, amount)
  achievementToast.hidden = false
  achievementToast.classList.toggle('is-collection', threshold === -1)
  achievementToast.classList.remove('is-showing')
  document.querySelector('.game-shell')?.classList.remove('is-achievement')

  requestAnimationFrame(() => {
    achievementToast.classList.add('is-showing')
    document.querySelector('.game-shell')?.classList.add('is-achievement')
  })

  achievementTimeout = setTimeout(() => {
    achievementToast.hidden = true
    achievementToast.classList.remove('is-showing')
    document.querySelector('.game-shell')?.classList.remove('is-achievement')
    achievementTimeout = undefined
    activeAchievement = undefined
    if (currentSnapshot && !currentSnapshot.isReady && !currentSnapshot.result) {
      banterPresenter.show(currentSnapshot.banter)
    }
  }, threshold === -1 ? 6_000 : 3_200)
}

function renderAchievement(threshold: number, amount: number): void {
  if (threshold === -1) {
    achievementIcon.src = '/images/titles/title-collection.png'
    achievementTitle.textContent = getMessages().dynamic.collectionTitle
    achievementCopy.textContent = getMessages().dynamic.collectionRequirement
    return
  }
  const index = spendTitles.findIndex((title) => title.threshold === threshold)
  if (index < 0) return
  achievementIcon.src = `/images/titles/title-${threshold}.webp`
  achievementTitle.textContent = getMessages().titles[index]!.name
  achievementCopy.textContent = format(getMessages().dynamic.achievementSpend, { amount })
}

function renderBanter({ durationMs, line }: BanterRender): void {
  if (currentSnapshot?.isReady || currentSnapshot?.result) return
  banterEmoji.textContent = line.emoji
  banterSpeaker.textContent = line.speaker
  banterText.textContent = line.text
  banterCard.style.setProperty('--banter-duration', `${durationMs}ms`)
  banterCard.hidden = false
  banterCard.classList.remove('is-entering')
  requestAnimationFrame(() => banterCard.classList.add('is-entering'))
}

function hideBanter(): void {
  banterCard.hidden = true
  banterCard.classList.remove('is-entering')
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

function renderAudioControls(): void {
  const ui = getMessages().ui
  const musicEnabled = gameAudio.isMusicEnabled()
  const effectsEnabled = gameAudio.isEffectsEnabled()
  musicToggleButton.setAttribute('aria-pressed', String(musicEnabled))
  musicToggleButton.setAttribute('aria-label', musicEnabled ? ui.musicMute : ui.musicEnable)
  musicToggleButton.title = musicEnabled ? ui.musicMute : ui.musicEnable
  musicToggleLabel.textContent = musicEnabled ? ui.musicOn : ui.musicOff
  effectsToggleButton.setAttribute('aria-pressed', String(effectsEnabled))
  effectsToggleButton.setAttribute('aria-label', effectsEnabled ? ui.effectsMute : ui.effectsEnable)
  effectsToggleButton.title = effectsEnabled ? ui.effectsMute : ui.effectsEnable
  effectsToggleLabel.textContent = effectsEnabled ? ui.effectsOn : ui.effectsOff
}

function setGamePaused(paused: boolean): void {
  game.setPaused(paused)
  gameAudio.setPaused(paused)
  if (!paused) updateMovement()
}
