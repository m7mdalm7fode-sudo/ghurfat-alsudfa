import type {Seat} from '../net/protocol'
import {CHARACTERS} from './characters'

/**
 * Pixel-art sprites for the six seated characters (18×24 px). The face is always a flat dark
 * shadow inside the headwear (front view) or covered by it (back view): no facial features.
 */
export const SW = 18, SH = 24
export type View = 'front' | 'back'
const FACE = '#0d0709'

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + k))))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

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
  const clothDark = shade(c.cloth, -.16)
  const cloth = (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const X = x + i, Y = y + j
      px(X, Y, 1, 1, c.pattern && (X + Y) % 2 === 0 ? c.pattern : X >= 11 ? clothDark : c.cloth)
    }
  }
  const robe = c.robe, robeD = c.robeShade, outer = c.bisht || c.robe, outerD = shade(outer, -.28)
  const d = frame

  // Seated, legs crossed.
  px(1, 19, 16, 3, robeD)
  px(0, 21, 18, 3, shade(robeD, -.22))
  // Torso widening towards the lap.
  for (let r = 10; r < 20; r++) {
    const w = Math.min(14, 10 + Math.floor((r - 10) / 3) * 2), x0 = 9 - w / 2
    px(x0, r, w, 1, outer)
    px(x0 + w - 2, r, 2, 1, outerD)
  }
  if (view === 'front') {
    if (c.bisht) { px(7, 10, 4, 10, robe); px(6, 10, 1, 10, c.trim!); px(11, 10, 1, 10, c.trim!) }
    else px(9, 11, 1, 6, robeD)
    px(8, 13, 2, 2, c.color)
    if (c.prop === 'khanjar') { px(7, 16, 4, 1, '#7a5230'); px(9, 17, 1, 2, '#d7d2c4'); px(8, 16, 1, 1, '#e8b84a') }
  } else if (c.bisht) {
    px(4, 18, 10, 1, c.trim!)
  }
  // Sleeves and hands resting on the knees.
  px(2, 11, 2, 7, outer); px(14, 11, 2, 7, outerD)
  px(3, 18, 3, 1, robeD); px(12, 18, 3, 1, robeD)
  // Collar.
  px(6, 8, 6, 2, view === 'front' ? robe : outer)

  // Headwear.
  if (c.head === 'shemagh' || c.head === 'ghutra' || c.head === 'litham') {
    cloth(5, d, 8, 2)
    cloth(4, 2 + d, 10, 6)
    cloth(3, 6 + d, 3, 6)
    cloth(12, 6 + d, 3, 6)
    if (view === 'front') {
      px(6, 3 + d, 6, 5, FACE)
      if (c.head === 'litham') cloth(6, 6 + d, 6, 2)
    } else cloth(5, 7 + d, 8, 5)
    if (c.agal) { px(4, 2 + d, 10, 1, '#141016'); px(5, 1 + d, 8, 1, '#2a2228') }
  } else {
    px(6, 3 + d, 6, 5, view === 'front' ? FACE : '#1c130f')
    cloth(5, d, 8, 3)
    px(4, 1 + d, 1, 2, clothDark); px(13, 1 + d, 1, 2, clothDark)
    px(5, 2 + d, 8, 1, clothDark)
    if (c.head === 'massar') { px(13, 3 + d, 1, 5, c.cloth); px(14, 6 + d, 1, 2, c.cloth) }
  }

  // Small props.
  if (c.prop === 'staff') px(0, 1, 1, 23, '#7a5230')
  if (c.prop === 'sword') { px(16, 12, 1, 9, '#3b2a1d'); px(16, 11, 1, 1, '#e8b84a') }
  if (c.prop === 'lantern') { px(15, 16, 3, 4, '#c87a3a'); px(16, 17, 1, 2, '#ffd27a') }
  if (c.prop === 'dallah') { px(15, 17, 3, 4, '#d9a441'); px(16, 16, 1, 1, '#b7832e'); px(14, 17, 1, 1, '#d9a441') }
  if (c.prop === 'misbaha') { px(4, 17, 1, 3, '#e8b84a'); px(5, 19, 1, 1, '#e8b84a') }

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
