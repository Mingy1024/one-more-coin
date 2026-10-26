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
  { text: '超濃起司', lines: ['超濃起司'], side: 'left', z: -0.92, y: -0.62, width: 1.3, height: 0.66, angle: 0.12, paper: '#ffe18a', ink: '#653226', accent: '#ed794a' },
  { text: '佐藤巧', lines: ['佐藤巧'], side: 'left', z: 0.82, y: -0.62, width: 1.13, height: 0.63, angle: -0.16, paper: '#ffd8e5', ink: '#792d56', accent: '#ea7197' },
  { text: '金近廉', lines: ['金近廉'], side: 'right', z: 0.9, y: -0.69, width: 1.16, height: 0.64, angle: -0.11, paper: '#beeef0', ink: '#1c5362', accent: '#55b9c7' },
  { text: '海的另一端有的，是敵人', lines: ['海的另一端', '有的，是敵人'], side: 'right', z: -0.7, y: -0.61, width: 1.65, height: 0.84, angle: 0.075, paper: '#d9e6ff', ink: '#263963', accent: '#677fce' },
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
  context.fillStyle = sticker.paper
  context.fill()
  context.lineWidth = 18
  context.strokeStyle = sticker.accent
  context.stroke()
  roundedRect(context, 34, 34, width - 68, height - 68, 20)
  context.lineWidth = 3
  context.strokeStyle = sticker.ink
  context.setLineDash([13, 11])
  context.stroke()
  context.setLineDash([])

  context.fillStyle = sticker.ink
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 31px "Hiragino Sans", "PingFang TC", sans-serif'
  context.fillText('旅 途 限 定 · SECRET STICKER', width / 2, 65, width - 105)

  context.font = `900 ${sticker.lines.length === 1 ? 152 : 110}px "Hiragino Sans", "PingFang TC", sans-serif`
  if (sticker.lines.length === 1) {
    context.fillText(sticker.lines[0]!, width / 2, height * 0.64, width - 100)
  } else {
    context.fillText(sticker.lines[0]!, width / 2, height * 0.49, width - 100)
    context.fillText(sticker.lines[1]!, width / 2, height * 0.76, width - 100)
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
      new THREE.MeshBasicMaterial({ color: 0x244157, transparent: true, opacity: 0.62, depthWrite: false }),
    )
    backing.position.set(0.025, -0.025, -0.004)
    tilted.add(backing)

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(spec.width, spec.height),
      new THREE.MeshBasicMaterial({ color: 0xffffff, map: stickerTexture(spec), transparent: true, depthWrite: false }),
    )
    face.position.z = 0.003
    tilted.add(face)
    sticker.add(tilted)
    stickers.add(sticker)
  }

  return stickers
}
