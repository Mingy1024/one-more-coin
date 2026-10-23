import './style.css'

import { ClawMachineGame, type GameSnapshot } from './game/ClawMachineGame'

const canvas = requireElement<HTMLCanvasElement>('game-canvas')
const timeValue = requireElement<HTMLElement>('time-value')
const attemptValue = requireElement<HTMLElement>('attempt-value')
const statusText = requireElement<HTMLElement>('status-text')
const grabButton = requireElement<HTMLButtonElement>('grab-button')
const startButton = requireElement<HTMLButtonElement>('start-button')
const startPanel = requireElement<HTMLElement>('start-panel')
const gameControls = requireElement<HTMLElement>('game-controls')
const restartButton = requireElement<HTMLButtonElement>('restart-button')
const resultModal = requireElement<HTMLElement>('result-modal')
const resultIcon = requireElement<HTMLElement>('result-icon')
const resultTitle = requireElement<HTMLElement>('result-title')
const resultCopy = requireElement<HTMLElement>('result-copy')

const game = await ClawMachineGame.create(canvas, updateHud)

const keyboard = new Set<string>()
const joystickAxis = { x: 0, z: 0 }

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
startButton.addEventListener('click', () => {
  game.startRound()
  grabButton.focus({ preventScroll: true })
})
restartButton.addEventListener('click', () => {
  resultModal.hidden = true
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
  startPanel.hidden = !snapshot.isReady
  gameControls.classList.toggle('is-locked', snapshot.isReady)
  gameControls.setAttribute('aria-disabled', String(snapshot.isReady))

  if (snapshot.result) {
    resultModal.hidden = false
    const won = snapshot.result === 'won'
    resultIcon.textContent = won ? '★' : '↻'
    resultTitle.textContent = won ? '成功夾到了！' : '差一點點！'
    resultCopy.textContent = won
      ? '禮物已安全抵達取物口。'
      : '時間到了，調整角度再試一次。'
  }
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}
