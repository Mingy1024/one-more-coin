import * as THREE from 'three'

interface SideSticker {
  text: string
  lines: string[]
  side: 'left' | 'right'
  z: number
  y: number
  width: number
  height: number
  angle: number
  paper: string
  ink: string
  accent: string
}

const STICKERS: SideSticker[] = [
  { text: '超濃起司', lines: ['超濃起司'], side: 'left', z: -0.92, y: -0.62, width: 1.4, height: 0.75, angle: 0.12, paper: '#ffd43a', ink: '#432222', accent: '#ff5726' },
  { text: '佐藤巧', lines: ['佐藤巧'], side: 'left', z: 0.82, y: -0.62, width: 1.24, height: 0.72, angle: -0.16, paper: '#ff9ac6', ink: '#47203f', accent: '#f92389' },
  { text: '金近廉', lines: ['金近廉'], side: 'right', z: 0.9, y: -0.69, width: 1.25, height: 0.73, angle: -0.11, paper: '#64e5ef', ink: '#183947', accent: '#00b5d2' },
  { text: '海的另一端有的，是敵人', lines: ['海的另一端', '有的，是敵人'], side: 'right', z: -0.7, y: -0.61, width: 1.65, height: 0.84, angle: 0.075, paper: '#adbaff', ink: '#202747', accent: '#684dff' },
]

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}

function drawSparkle(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath()
  context.moveTo(x, y - radius)
  context.quadraticCurveTo(x + radius * 0.18, y - radius * 0.18, x + radius, y)
  context.quadraticCurveTo(x + radius * 0.18, y + radius * 0.18, x, y + radius)
  context.quadraticCurveTo(x - radius * 0.18, y + radius * 0.18, x - radius, y)
  context.quadraticCurveTo(x - radius * 0.18, y - radius * 0.18, x, y - radius)
  context.closePath()
  context.fillStyle = '#fffdf3'
  context.strokeStyle = '#ffffff'
  context.lineWidth = 5
  context.fill()
  context.stroke()
}

function drawComicBackground(context: CanvasRenderingContext2D, sticker: SideSticker, width: number, height: number): void {
  const centerX = width / 2
  const centerY = height / 2
  const background = context.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#ffffff')
  background.addColorStop(0.12, sticker.paper)
  background.addColorStop(1, sticker.accent)
  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  // Long triangular speed lines keep the tiny sticker lively at machine scale.
  for (let index = 0; index < 32; index++) {
    const angle = index * Math.PI / 16
    const spread = index % 2 === 0 ? 0.085 : 0.045
    context.beginPath()
    context.moveTo(centerX, centerY)
    context.lineTo(centerX + Math.cos(angle - spread) * 900, centerY + Math.sin(angle - spread) * 900)
    context.lineTo(centerX + Math.cos(angle + spread) * 900, centerY + Math.sin(angle + spread) * 900)
    context.closePath()
    context.fillStyle = index % 2 === 0 ? '#ffffff66' : `${sticker.ink}24`
    context.fill()
  }

  // Offset halftone dots in the corners echo printed manga panels.
  context.fillStyle = `${sticker.ink}5c`
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 9; column++) {
      const radius = 2 + (row + column) * 0.38
      for (const x of [56 + column * 20, width - 56 - column * 20]) {
        const y = 42 + row * 19 + (column % 2) * 9
        for (const dotY of [y, height - y]) {
          context.beginPath()
          context.arc(x, dotY, radius, 0, Math.PI * 2)
          context.fill()
        }
      }
    }
  }

  context.beginPath()
  for (let point = 0; point < 32; point++) {
    const angle = point * Math.PI / 16 - Math.PI / 2
    const radius = point % 2 === 0 ? 1 : 0.82
    const x = centerX + Math.cos(angle) * width * 0.43 * radius
    const y = centerY + Math.sin(angle) * height * 0.42 * radius
    if (point === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  }
  context.closePath()
  context.fillStyle = '#fffdf1'
  context.strokeStyle = sticker.ink
  context.lineJoin = 'round'
  context.lineWidth = 11
  context.fill()
  context.stroke()
  context.strokeStyle = sticker.accent
  context.lineWidth = 5
  context.stroke()

  drawSparkle(context, 98, 80, 34)
  drawSparkle(context, width - 94, height - 76, 29)
  drawSparkle(context, width - 119, 65, 13)
  drawSparkle(context, 110, height - 69, 11)
}

function stickerTexture(sticker: SideSticker): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = Math.round(768 * sticker.height / sticker.width)
  const context = canvas.getContext('2d')
  if (!context) return undefined

  const { width, height } = canvas
  const margin = 9
  roundedRect(context, margin, margin, width - margin * 2, height - margin * 2, 34)
  context.save()
  context.clip()
  drawComicBackground(context, sticker, width, height)
  context.restore()

  roundedRect(context, margin + 7, margin + 7, width - (margin + 7) * 2, height - (margin + 7) * 2, 29)
  context.lineWidth = 25
  context.strokeStyle = sticker.ink
  context.stroke()
  context.lineWidth = 6
  context.strokeStyle = '#fffdf3'
  context.stroke()

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  context.font = `900 ${sticker.lines.length === 1 ? 165 : 110}px "Hiragino Sans", "PingFang TC", sans-serif`
  const lineYs = sticker.lines.length === 1 ? [height * 0.52] : [height * 0.38, height * 0.67]
  for (const [index, line] of sticker.lines.entries()) {
    const y = lineYs[index]!
    context.lineWidth = 20
    context.strokeStyle = sticker.ink
    context.strokeText(line, width / 2 + 6, y + 7, width - 140)
    context.fillStyle = sticker.ink
    context.fillText(line, width / 2 + 6, y + 7, width - 140)
    context.lineWidth = 15
    context.strokeStyle = '#ffffff'
    context.strokeText(line, width / 2, y, width - 140)
    context.fillStyle = sticker.ink
    context.fillText(line, width / 2, y, width - 140)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createSideStickers(): THREE.Group {
  const stickers = new THREE.Group()
  stickers.name = 'cabinet-side-stickers'

  for (const spec of STICKERS) {
    const sticker = new THREE.Group()
    sticker.name = `sticker-${spec.text}`
    sticker.userData = { text: spec.text, side: spec.side, width: spec.width, height: spec.height, angle: spec.angle }
    sticker.position.set(spec.side === 'left' ? -2.045 : 2.045, spec.y, spec.z)
    sticker.rotation.y = spec.side === 'left' ? -Math.PI / 2 : Math.PI / 2

    const tilted = new THREE.Group()
    tilted.rotation.z = spec.angle
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width + 0.045, spec.height + 0.045),
      new THREE.MeshBasicMaterial({ color: 0x244157, toneMapped: false }),
    )
    backing.position.set(0.025, -0.025, -0.004)
    tilted.add(backing)

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width, spec.height),
      new THREE.MeshBasicMaterial({ color: 0xffffff, map: stickerTexture(spec), alphaTest: 0.1, toneMapped: false }),
    )
    face.position.z = 0.003
    tilted.add(face)
    sticker.add(tilted)
    stickers.add(sticker)
  }

  return stickers
}
