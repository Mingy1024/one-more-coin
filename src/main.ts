import './style.css'

import { ClawMachineGame, type GameSnapshot } from './game/ClawMachineGame'
import { BanterPresenter, type BanterRender } from './game/banterPresenter'
import { CoinLedger, spendTitles, type SpendSnapshot, type SpendTitle } from './game/coinLedger'
import { ClerkAssistTrigger } from './game/clerkAssist'

const loadingScreen = requireElement<HTMLElement>('loading-screen')
const loadingCopy = requireElement<HTMLElement>('loading-copy')
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
const clerkChoices = requireElement<HTMLElement>('clerk-choices')
const clerkDecline = requireElement<HTMLButtonElement>('clerk-decline')
const clerkCallButton = requireElement<HTMLButtonElement>('clerk-call-button')
const resultClerkButton = requireElement<HTMLButtonElement>('result-clerk-button')
const clerkCallDialog = requireElement<HTMLDialogElement>('clerk-call-dialog')
const clerkCallClose = requireElement<HTMLButtonElement>('clerk-call-close')
const clerkRescueButton = requireElement<HTMLButtonElement>('clerk-rescue-button')
const clerkPlacementButton = requireElement<HTMLButtonElement>('clerk-placement-button')
const clerkCallFeedback = requireElement<HTMLElement>('clerk-call-feedback')
const startPanel = requireElement<HTMLElement>('start-panel')
const gameControls = requireElement<HTMLElement>('game-controls')
const banterCard = requireElement<HTMLElement>('banter-card')
const banterEmoji = requireElement<HTMLElement>('banter-emoji')
const banterSpeaker = requireElement<HTMLElement>('banter-speaker')
const banterText = requireElement<HTMLElement>('banter-text')
const restartButton = requireElement<HTMLButtonElement>('restart-button')
const resultModal = requireElement<HTMLElement>('result-modal')
const resultIcon = requireElement<HTMLElement>('result-icon')
const resultTitle = requireElement<HTMLElement>('result-title')
const resultCopy = requireElement<HTMLElement>('result-copy')
const resultSpend = requireElement<HTMLElement>('result-spend')
const achievementToast = requireElement<HTMLElement>('achievement-toast')
const achievementIcon = requireElement<HTMLElement>('achievement-icon')
const achievementTitle = requireElement<HTMLElement>('achievement-title')
const achievementCopy = requireElement<HTMLElement>('achievement-copy')
const banterPresenter = new BanterPresenter(renderBanter, undefined, hideBanter)
const coinLedger = new CoinLedger()
const clerkAssist = new ClerkAssistTrigger()
let currentSnapshot: GameSnapshot | undefined
let contextLost = false

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

let game: ClawMachineGame
try {
  game = await ClawMachineGame.create(canvas, updateHud)
} catch (error) {
  loadingCopy.textContent = '機台暫時無法啟動，請重新整理再試一次。'
  throw error
}

canvas.addEventListener('webglcontextlost', () => {
  contextLost = true
  showLoading('機台畫面中斷，正在重新連接…')
})
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false
  showLoading('正在重新點亮機台…')
  game.onNextRenderedFrame(hideLoading)
})

const keyboard = new Set<string>()
const joystickAxis = { x: 0, z: 0 }
let lastResult: GameSnapshot['result']
let achievementTimeout: ReturnType<typeof setTimeout> | undefined

window.addEventListener('keydown', (event) => {
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

grabButton.addEventListener('click', () => game.grab())
resetButton.addEventListener('click', () => {
  game.resetPrizes()
  statusText.textContent = '娃娃已補回並重新擺放'
})
titlesButton.addEventListener('click', () => {
  renderTitleGallery()
  game.setPaused(true)
  titlesDialog.showModal()
  titlesClose.focus({ preventScroll: true })
})
titlesClose.addEventListener('click', () => titlesDialog.close())
titlesDialog.addEventListener('close', () => {
  game.setPaused(false)
  titlesButton.focus({ preventScroll: true })
})
titlesDialog.addEventListener('click', (event) => {
  if (event.target === titlesDialog) titlesDialog.close()
})
clerkDecline.addEventListener('click', () => clerkDialog.close())
const openClerkCall = (): void => {
  if (clerkCallDialog.open || clerkDialog.open) return
  clerkCallFeedback.hidden = true
  clerkCallFeedback.textContent = ''
  game.setPaused(true)
  clerkCallDialog.showModal()
  clerkRescueButton.focus({ preventScroll: true })
}
clerkCallButton.addEventListener('click', openClerkCall)
resultClerkButton.addEventListener('click', openClerkCall)
clerkCallClose.addEventListener('click', () => clerkCallDialog.close())
clerkCallDialog.addEventListener('close', () => {
  if (!clerkDialog.open) {
    game.setPaused(false)
    if (!resultModal.hidden) resultClerkButton.focus({ preventScroll: true })
    else clerkCallButton.focus({ preventScroll: true })
  }
})
clerkRescueButton.addEventListener('click', () => {
  const rescued = game.rescueStuckPrizeForClerk()
  clerkCallFeedback.textContent = rescued
    ? `店員把${rescued}撈出來：「牠是來給你夾，還是來洞口租房子？好啦，這局算你夾到！」`
    : '店員探頭看了看：「卡住的目前只有你的期待。娃娃沒卡在洞口啦。」'
  clerkCallFeedback.hidden = false
})
clerkPlacementButton.addEventListener('click', () => {
  const amount = coinLedger.snapshot().amount
  if (!currentSnapshot?.isReady && currentSnapshot?.result !== 'lost') {
    clerkCallFeedback.textContent = '店員指著忙碌的夾爪：「現在進去喬位置？我有上班，不是有九條命欸。」'
    clerkCallFeedback.hidden = false
    return
  }
  if (!clerkAssist.canRequestPlacement(amount)) {
    clerkCallFeedback.textContent = amount < 100
      ? '店員看你一眼：「我們才剛認識，你就要我幫你喬娃娃？先跟機台培養感情啦。」'
      : '店員雙手一攤：「剛剛不是才幫過？這裡是夾娃娃機，不是娃娃搬家公司欸。」'
    clerkCallFeedback.hidden = false
    return
  }
  clerkCallDialog.close()
  resultModal.hidden = true
  showClerkAssist()
})
clerkDialog.addEventListener('close', () => {
  clerkDialog.removeAttribute('data-phase')
  game.setPaused(false)
  game.restart()
  lastResult = undefined
  startButton.focus({ preventScroll: true })
})
startButton.addEventListener('click', () => {
  const spend = coinLedger.insertCoin()
  renderSpend(spend)
  if (spend.achievement) showAchievement(spend.achievement, spend.amount)
  game.startRound()
  grabButton.focus({ preventScroll: true })
})
restartButton.addEventListener('click', () => {
  resultModal.hidden = true
  if (lastResult === 'won') renderSpend(coinLedger.snapshot())
  lastResult = undefined
  game.restart()
  startButton.focus({ preventScroll: true })
})

setupJoystick()
game.onNextRenderedFrame(hideLoading)
game.start()

function setupJoystick(): void {
  const joystick = requireElement<HTMLElement>('joystick')
  const knob = requireElement<HTMLElement>('joystick-knob')
  const maxDistance = 34

  const move = (event: PointerEvent): void => {
    const bounds = joystick.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const rawX = event.clientX - centerX
    const rawY = event.clientY - centerY
    const distance = Math.hypot(rawX, rawY)
    const scale = distance > maxDistance ? maxDistance / distance : 1
    const x = rawX * scale
    const y = rawY * scale

    knob.style.transform = `translate(${x}px, ${y}px)`
    joystickAxis.x = x / maxDistance
    joystickAxis.z = y / maxDistance
    updateMovement()
  }

  const stop = (event: PointerEvent): void => {
    if (joystick.hasPointerCapture(event.pointerId)) {
      joystick.releasePointerCapture(event.pointerId)
    }
    knob.style.transform = 'translate(0, 0)'
    joystickAxis.x = 0
    joystickAxis.z = 0
    updateMovement()
  }

  joystick.addEventListener('pointerdown', (event) => {
    joystick.setPointerCapture(event.pointerId)
    move(event)
  })
  joystick.addEventListener('pointermove', (event) => {
    if (joystick.hasPointerCapture(event.pointerId)) move(event)
  })
  joystick.addEventListener('pointerup', stop)
  joystick.addEventListener('pointercancel', stop)
}

function updateMovement(): void {
  const keyboardX = Number(keyboard.has('ArrowRight') || keyboard.has('KeyD'))
    - Number(keyboard.has('ArrowLeft') || keyboard.has('KeyA'))
  const keyboardZ = Number(keyboard.has('ArrowDown') || keyboard.has('KeyS'))
    - Number(keyboard.has('ArrowUp') || keyboard.has('KeyW'))

  game.setMovement(
    Math.max(-1, Math.min(1, joystickAxis.x + keyboardX)),
    Math.max(-1, Math.min(1, joystickAxis.z + keyboardZ)),
  )
}

function updateHud(snapshot: GameSnapshot): void {
  currentSnapshot = snapshot
  timeValue.textContent = String(Math.ceil(snapshot.timeLeft))
  attemptValue.textContent = String(snapshot.attempts)
  statusText.textContent = snapshot.status
  grabButton.disabled = !snapshot.canGrab
  resetButton.disabled = !snapshot.isReady
  grabLabel.textContent = snapshot.grabLabel
  startPanel.hidden = !snapshot.isReady
  gameControls.classList.toggle('is-locked', snapshot.isReady)
  gameControls.setAttribute('aria-disabled', String(snapshot.isReady))

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
      const shouldOfferHelp = snapshot.result === 'lost' && game.hasStuckPrizeAtChute()
        ? false
        : clerkAssist.onResult(snapshot.result, spend.amount)
      if (shouldOfferHelp && game.availablePrizesForClerk().length > 0) {
        lastResult = snapshot.result
        resultModal.hidden = true
        showClerkAssist()
        return
      }
      resultSpend.textContent = won
        ? `這份獎品共投入 NT$${spend.amount} · ${spend.title}`
        : `目前已投入 NT$${spend.amount} · ${spend.title}`
      lastResult = snapshot.result
      if (!clerkCallDialog.open) requestAnimationFrame(() => restartButton.focus({ preventScroll: true }))
    }
    if (clerkDialog.open) return
    resultModal.hidden = false
    resultIcon.textContent = won ? '★' : '↻'
    resultTitle.textContent = won ? '成功夾到了！' : '差一點點！'
    resultCopy.textContent = !won && game.hasStuckPrizeAtChute()
      ? '娃娃好像卡在洞口了？呼叫店員確認，就不必白白再投一枚。'
      : snapshot.banter.text
    resultClerkButton.hidden = won
  }
}

function showClerkAssist(): void {
  clerkDialog.removeAttribute('data-phase')
  clerkSound.textContent = '欸！'
  clerkCopy.textContent = '店員盯著你和機台看了很久，終於嘆了口氣：「好啦，這局我當你場外教練。想喬哪一隻？」'
  clerkDecline.textContent = '不用，我自己來'
  clerkChoices.replaceChildren(...game.availablePrizesForClerk().map(({ index, name }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'clerk-choice'
    button.setAttribute('aria-label', `請店員移動${name}`)
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
      clerkSound.textContent = placement.type === 'swapped' ? '對調！' : '咻！'
      clerkCopy.textContent = placement.type === 'swapped'
        ? `店員把${name}和洞口旁的${placement.displaced}對調：「位置喬好了，運氣我可沒辦法喬。」`
        : `店員把${name}擺到洞口旁：「都送到門口了，再夾不到我也只能幫你鼓掌。」`
      for (const choice of clerkChoices.querySelectorAll('button')) choice.disabled = true
      clerkDecline.textContent = '完成擺位，繼續玩'
      clerkDecline.focus({ preventScroll: true })
    })
    return button
  }))
  game.setPaused(true)
  clerkDialog.showModal()
  clerkChoices.querySelector('button')?.focus({ preventScroll: true })
}

function renderSpend(spend: SpendSnapshot): void {
  spendValue.textContent = String(spend.amount)
  spendTitle.textContent = spend.title
}

function renderTitleGallery(): void {
  const unlocked = coinLedger.unlockedTitles()
  titlesCount.textContent = `已獲得 ${unlocked.length} / ${spendTitles.length}`
  titlesEmpty.hidden = unlocked.length > 0
  titlesList.replaceChildren(...unlocked.map((title) => {
    const item = document.createElement('li')
    item.className = 'title-entry'

    const icon = document.createElement('span')
    icon.className = 'title-entry-icon'
    icon.textContent = title.emoji
    icon.setAttribute('aria-hidden', 'true')

    const copy = document.createElement('div')
    copy.className = 'title-entry-copy'
    const name = document.createElement('strong')
    name.textContent = title.name
    const detail = document.createElement('p')
    detail.textContent = title.description
    const requirement = document.createElement('small')
    requirement.textContent = `單次夾出前累計投入 NT$${title.threshold} 達成`
    copy.append(name, detail, requirement)
    item.append(icon, copy)
    return item
  }))
}

function showAchievement(title: SpendTitle, amount: number): void {
  if (achievementTimeout !== undefined) clearTimeout(achievementTimeout)
  banterPresenter.clear()
  achievementIcon.textContent = title.emoji
  achievementTitle.textContent = title.name
  achievementCopy.textContent = `累計投入 NT$${amount}`
  achievementToast.hidden = false
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
    if (currentSnapshot && !currentSnapshot.isReady && !currentSnapshot.result) {
      banterPresenter.show(currentSnapshot.banter)
    }
  }, 3_200)
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
