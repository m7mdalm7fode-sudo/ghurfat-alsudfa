import type {Seat} from '../net/protocol'
import {CHARACTERS} from './characters'

/**
 * Pixel-art sprites for the six seated characters (24×32 px), seated on the sand with knees up
 * like a man resting by a campfire. The face is always a flat dark shadow inside the headwear
 * (front view) or covered by it (back view): no facial features.
 */
export const SW = 24, SH = 32
export type View = 'front' | 'back'
const FACE = '#0c0708'
const SKIN = '#6e4a32'

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + k))))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}
const tones = (c: string) => ({l: shade(c, .16), b: c, d: shade(c, -.28), dd: shade(c, -.5)})

const cache = new Map<string, HTMLCanvasElement>()

export function sprite(seat: Seat, view: View, frame: 0 | 1, out = false): HTMLCanvasElement {
  const key = `${seat}${view}${frame}${out}`
  const hit = cache.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = SW
  cv.height = SH
  const g = cv.getContext('2d')!
  const c = CHARACTERS[seat]
  const px = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h) }
  const robe = tones(c.robe), outer = tones(c.bisht || c.robe), cl = tones(c.cloth)
  /** Headwear cloth with the shemagh check pattern and a shaded right side. */
  const cloth = (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j
      px(X, Y, 1, 1, c.pattern && (X + Y) % 2 === 0 ? c.pattern : X >= 16 ? cl.d : X <= 7 ? cl.l : cl.b)
    }
  }
  const d = frame // breathing: head and shoulders dip one pixel

  // Robe spread on the sand.
  for (let r = 26; r < 32; r++) {
    const w = Math.min(22, 16 + (r - 26) * 2), x0 = 12 - w / 2
    px(x0, r, w, 1, r < 28 ? robe.b : r < 31 ? robe.d : robe.dd)
    px(x0, r, 1, 1, robe.dd); px(x0 + w - 1, r, 1, 1, robe.dd)
  }

  if (view === 'front') {
    // Torso in the cloak, thobe showing down the middle.
    for (let r = 11 + d; r < 24; r++) {
      const w = r < 14 ? 12 : 14, x0 = 12 - w / 2
      px(x0, r, w, 1, outer.b); px(x0, r, 2, 1, outer.l); px(x0 + w - 2, r, 2, 1, outer.d)
    }
    if (c.bisht) { px(10, 12 + d, 4, 12 - d, robe.b); px(9, 12 + d, 1, 12 - d, c.trim!); px(14, 12 + d, 1, 12 - d, c.trim!) }
    else { px(11, 12 + d, 2, 11 - d, robe.d) }
    // Knees drawn up.
    for (const kx of [4, 13]) {
      px(kx + 2, 19, 3, 1, robe.l)
      px(kx + 1, 20, 6, 6, robe.b); px(kx, 21, 8, 5, robe.b)
      px(kx, 21, 1, 5, robe.l); px(kx + 7, 21, 1, 5, robe.d); px(kx + 1, 20, 5, 1, robe.l)
    }
    px(11, 21, 2, 5, robe.dd)
    // Arms resting on the knees, hands loosely joined.
    px(3, 17, 7, 3, outer.b); px(3, 17, 7, 1, outer.l); px(14, 17, 7, 3, outer.d); px(14, 17, 7, 1, outer.b)
    px(10, 18, 4, 2, SKIN); px(10, 18, 4, 1, shade(SKIN, .15))
    px(10, 14 + d, 2, 2, c.color)
  } else {
    // Seen from behind: broad back in the cloak, the hood's tail hanging down.
    for (let r = 11 + d; r < 27; r++) {
      const w = r < 14 ? 12 : r < 22 ? 16 : 18, x0 = 12 - w / 2
      px(x0, r, w, 1, outer.b); px(x0, r, 2, 1, outer.l); px(x0 + w - 2, r, 2, 1, outer.d)
    }
    px(11, 15 + d, 2, 11, outer.d)
    if (c.bisht) { px(3, 25, 18, 1, c.trim!) }
    px(2, 18, 2, 5, outer.d); px(20, 18, 2, 5, outer.dd)
  }

  // Headwear and the faceless head.
  if (c.head === 'shemagh' || c.head === 'ghutra' || c.head === 'litham') {
    cloth(8, d, 8, 2)
    cloth(7, 2 + d, 10, 3)
    cloth(6, 5 + d, 12, 7)
    cloth(4, 9 + d, 4, 8)
    cloth(16, 9 + d, 4, 8)
    if (view === 'front') {
      px(8, 4 + d, 8, 7, FACE); px(9, 11 + d, 6, 1, FACE)
      if (c.head === 'litham') cloth(8, 8 + d, 8, 3)
    } else cloth(7, 10 + d, 10, 7)
    if (c.agal) { px(7, 2 + d, 10, 1, '#121013'); px(7, 3 + d, 10, 1, '#2a2429'); px(6, 4 + d, 1, 1, '#121013'); px(17, 4 + d, 1, 1, '#121013') }
  } else {
    px(8, 4 + d, 8, 8, view === 'front' ? FACE : '#1c130f')
    cloth(7, d, 10, 4)
    px(6, 1 + d, 1, 3, cl.d); px(17, 1 + d, 1, 3, cl.d)
    px(7, 2 + d, 10, 1, cl.d)
    if (c.head === 'massar') { px(17, 4 + d, 2, 6, c.cloth); px(18, 9 + d, 2, 3, c.cloth) }
  }

  // Small props.
  if (c.prop === 'staff') px(1, 2, 1, 29, '#7a5230')
  if (c.prop === 'sword' && view === 'front') { px(20, 14, 1, 12, '#3b2a1d'); px(20, 13, 1, 1, '#e8b84a') }
  if (c.prop === 'lantern') { px(0, 24, 4, 5, '#c87a3a'); px(1, 25, 2, 3, '#ffd27a') }
  if (c.prop === 'dallah') { px(20, 24, 4, 6, '#d9a441'); px(21, 23, 2, 1, '#b7832e'); px(19, 25, 1, 1, '#d9a441') }
  if (c.prop === 'misbaha' && view === 'front') { px(11, 20, 1, 4, '#e8b84a'); px(12, 23, 1, 1, '#e8b84a') }
  if (c.prop === 'khanjar' && view === 'front') { px(9, 16 + d, 6, 1, '#7a5230'); px(11, 17 + d, 2, 3, '#d7d2c4'); px(11, 16 + d, 1, 1, '#e8b84a') }

  if (out) {
    const img = g.getImageData(0, 0, SW, SH)
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (img.data[i] * .3 + img.data[i + 1] * .55 + img.data[i + 2] * .15) * .5
      img.data[i] = v; img.data[i + 1] = v * .95; img.data[i + 2] = v * .92
    }
    g.putImageData(img, 0, 0)
  }
  cache.set(key, cv)
  return cv
}

/** Solid dark copy of a sprite, drawn offset behind it as a 1px outline so figures read clearly. */
export function silhouette(seat: Seat, view: View, frame: 0 | 1, out = false): HTMLCanvasElement {
  const key = `sil${seat}${view}${frame}${out}`
  const hit = cache.get(key)
  if (hit) return hit
  const src = sprite(seat, view, frame, out)
  const cv = document.createElement('canvas')
  cv.width = SW
  cv.height = SH
  const g = cv.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = '#0a0605'
  g.fillRect(0, 0, SW, SH)
  cache.set(key, cv)
  return cv
}

/** A crisp, upscaled portrait image for menus. */
export function portraitURL(seat: Seat, scale = 6): string {
  const s = sprite(seat, 'front', 0)
  const cv = document.createElement('canvas')
  cv.width = SW * scale
  cv.height = SH * scale
  const g = cv.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(s, 0, 0, cv.width, cv.height)
  return cv.toDataURL()
}
