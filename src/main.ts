import './style.css'

import { ClawMachineGame, type GameSnapshot } from './game/ClawMachineGame'
import { BanterPresenter, type BanterRender } from './game/banterPresenter'
import { CoinLedger, spendTitles, type SpendSnapshot, type SpendTitle } from './game/coinLedger'

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
const banterPresenter = new BanterPresenter(renderBanter)
const coinLedger = new CoinLedger()

const game = await ClawMachineGame.create(canvas, updateHud)

const keyboard = new Set<string>()
const joystickAxis = { x: 0, z: 0 }
let lastResult: GameSnapshot['result']
let achievementTimeout: ReturnType<typeof setTimeout> | undefined

window.addEventListener('keydown', (event) => {
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
  timeValue.textContent = String(Math.ceil(snapshot.timeLeft))
  attemptValue.textContent = String(snapshot.attempts)
  statusText.textContent = snapshot.status
  grabButton.disabled = !snapshot.canGrab
  resetButton.disabled = !snapshot.isReady
  grabLabel.textContent = snapshot.grabLabel
  startPanel.hidden = !snapshot.isReady
  gameControls.classList.toggle('is-locked', snapshot.isReady)
  gameControls.setAttribute('aria-disabled', String(snapshot.isReady))

  banterPresenter.show(snapshot.banter, {
    interrupt: snapshot.isReady
      || snapshot.result !== undefined
      || (snapshot.attempts === 0 && snapshot.canGrab),
  })

  if (snapshot.result) {
    resultModal.hidden = false
    const won = snapshot.result === 'won'
    if (snapshot.result !== lastResult) {
      const spend = won ? coinLedger.settleWin() : coinLedger.snapshot()
      resultSpend.textContent = won
        ? `這份獎品共投入 NT$${spend.amount} · ${spend.title}`
        : `目前已投入 NT$${spend.amount} · ${spend.title}`
      lastResult = snapshot.result
      requestAnimationFrame(() => restartButton.focus({ preventScroll: true }))
    }
    resultIcon.textContent = won ? '★' : '↻'
    resultTitle.textContent = won ? '成功夾到了！' : '差一點點！'
    resultCopy.textContent = snapshot.banter.text
  }
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
  }, 3_200)
}

function renderBanter({ durationMs, line }: BanterRender): void {
  banterEmoji.textContent = line.emoji
  banterSpeaker.textContent = line.speaker
  banterText.textContent = line.text
  banterCard.style.setProperty('--banter-duration', `${durationMs}ms`)
  banterCard.classList.remove('is-entering')
  requestAnimationFrame(() => banterCard.classList.add('is-entering'))
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}
