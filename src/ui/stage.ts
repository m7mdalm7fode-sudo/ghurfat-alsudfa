import {SEATS, type Bullet, type Result, type Role, type RoomState, type Seat} from '../net/protocol'
import {CHARACTERS} from './characters'
import {silhouette, sprite, SW, SH, type View} from './pixel'

/**
 * Pixel-art desert camp drawn on a 320×200 canvas and upscaled without smoothing. The fire is the
 * only real light: the world layer is re-lit every frame with a dithered, quantised falloff.
 * The ring of seats is rotated so the local player always sits in front, seen from behind.
 */
export const W = 320, H = 200, FX = 160, FY = 112, HORIZON = 72, FPS = 24
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
export const dither = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]

type Slot = {x: number; y: number; s: number; view: View}
/** Slot k = seats counted from the viewer around the fire; k=0 is the viewer. */
const SLOTS: Slot[] = [
  {x: FX, y: 188, s: 1.8, view: 'back'},
  {x: 58, y: 152, s: 1.5, view: 'back'},
  {x: 96, y: 102, s: 1.16, view: 'front'},
  {x: FX, y: 86, s: 1, view: 'front'},
  {x: 224, y: 102, s: 1.16, view: 'front'},
  {x: 262, y: 152, s: 1.5, view: 'back'},
]
const slotFor = (k: number): Slot => SLOTS[k]

let seed = 11
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
export const wave = (a: number) => (Math.sin(a) * .5 + .5) * .6 + (Math.sin(a * 2.3 + 1) * .5 + .5) * .4

export function canvas(w = W, h = H) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return {c, g}
}

/** Night sky, crescent moon and dunes: never lit by the fire. */
export function buildSky(dawn = false) {
  const {c, g} = canvas()
  // Dark, overcast night with a warm glow low on the horizon.
  const pal = dawn ? [[46, 52, 78], [74, 70, 92], [118, 92, 98], [176, 118, 92], [222, 156, 98]] : [[8, 8, 12], [12, 11, 15], [17, 14, 17], [26, 18, 17], [40, 24, 18]]
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cloud = Math.sin(x / 23 + y / 9) * .35 + Math.sin(x / 11 - y / 5) * .2
    const i = Math.max(0, Math.min(4, Math.floor(y / (HORIZON + 4) * 4 + cloud + dither(x, y) * .6 - .5)))
    img.data.set([...pal[i], 255], (y * W + x) * 4)
  }
  g.putImageData(img, 0, 0)
  // High crescent moon, slightly hazed.
  if (!dawn) for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (x * x + y * y <= 30 && (x + 3) * (x + 3) + (y + 1) * (y + 1) > 20) { g.fillStyle = y < -2 ? '#efe2c2' : '#d8c8a2'; g.fillRect(226 + x, 30 + y, 1, 1) }
  }
  // Far flat-topped jebel range with stepped cliffs, then low dunes.
  for (let x = 0; x < W; x++) {
    const m = x < 150 ? (x > 18 && x < 64 ? 49 + (x < 24 ? 24 - x : 0) + (x > 58 ? (x - 58) * 2 : 0)
      : x > 80 && x < 132 ? 54 + (x < 86 ? (86 - x) * 2 : 0) + (x > 126 ? (x - 126) * 2 : 0) : 62) : 64 + Math.round(2 * Math.sin(x / 17))
    g.fillStyle = '#0f0a0a'; g.fillRect(x, Math.min(m, 66), 1, H)
    if (m < 62) { g.fillStyle = '#1a1210'; g.fillRect(x, m, 1, 1); if (x % 9 === 0) { g.fillStyle = '#140d0b'; g.fillRect(x, m + 4, 1, 6) } }
    const near = Math.round(68 + 2 * Math.sin(x / 29 + 2) + Math.sin(x / 7))
    g.fillStyle = '#160e0b'; g.fillRect(x, near, 1, H - near)
  }
  return c
}

export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  g.fillStyle = col
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1) }
}

/** Sand, pickup truck, goat-hair tent, fire pit, dallah and the rug for the cards. */
function buildGround() {
  const {c, g} = canvas()
  seed = 11
  // Calm sand: one base tone with sparse specks (less noise = clearer picture).
  g.fillStyle = 'rgb(104,74,46)'; g.fillRect(0, HORIZON, W, H - HORIZON)
  for (let k = 0; k < 700; k++) { const x = Math.floor(rnd() * W), y = HORIZON + Math.floor(rnd() * (H - HORIZON)); g.fillStyle = rnd() < .5 ? 'rgb(90,63,39)' : 'rgb(118,85,53)'; g.fillRect(x, y, 1, 1) }
  // Wind ripples.
  g.fillStyle = 'rgb(88,62,38)'
  for (let k = 0; k < 34; k++) { const x = Math.floor(rnd() * W), y = HORIZON + 4 + Math.floor(rnd() * (H - HORIZON - 4)); g.fillRect(x, y, 5 + Math.floor(rnd() * 9), 1) }

  pickup(g, 36, 48)

  tent(g)
  // Majlis rug in front of the tent.
  g.fillStyle = '#7a2030'; g.fillRect(234, 92, 56, 6)
  g.fillStyle = '#d9a441'; for (let x = 236; x < 288; x += 4) g.fillRect(x, 94, 1, 1)

  // Fire pit: logs and a ring of stones.
  g.fillStyle = '#3a2416'; g.fillRect(FX - 8, FY - 1, 16, 2); g.fillRect(FX - 5, FY - 2, 10, 1)
  g.fillStyle = '#2a1a10'; g.fillRect(FX - 7, FY, 3, 1); g.fillRect(FX + 4, FY - 2, 3, 1)
  for (let a = 0; a < 14; a++) {
    const t = a / 14 * Math.PI * 2, x = Math.round(FX + 13 * Math.cos(t)), y = Math.round(FY + 4 * Math.sin(t))
    g.fillStyle = a % 2 ? '#6d625a' : '#55493f'; g.fillRect(x - 1, y - 1, 3, 2)
  }
  dallah(g, 128, 114)
  // Two finjan cups on a small tray.
  g.fillStyle = '#7a5230'; g.fillRect(137, 113, 11, 2)
  for (const x of [138, 143]) { g.fillStyle = '#f4ead8'; g.fillRect(x, 110, 4, 3); g.fillRect(x + 1, 113, 2, 1); g.fillStyle = '#c8324a'; g.fillRect(x, 111, 4, 1) }
  // Rug for the rifle and the bullets.
  g.fillStyle = '#6d2533'; g.fillRect(176, 100, 58, 22)
  g.fillStyle = '#d9a441'; g.fillRect(176, 100, 58, 1); g.fillRect(176, 121, 58, 1); g.fillRect(176, 100, 1, 22); g.fillRect(233, 100, 1, 22)
  for (let x = 179; x < 232; x += 4) { g.fillRect(x, 102, 1, 1); g.fillRect(x, 119, 1, 1) }
  return c
}

/**
 * Old single-cab pickup facing right (original design, no brand): round headlight, short cab,
 * bed with wooden side rails carrying a rolled rug and a water jerrycan. Bed's top-left at (ox, oy).
 */
export function pickup(g: CanvasRenderingContext2D, ox: number, oy: number) {
  const L = 118, base = '#cfc6b2', light = '#e6dfcd', mid = '#aaa08a', dark = '#837a66', deep = '#5c5446', rust = '#8a5a3a'
  const px = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h) }
  // Profile: bed (0–60), cab with roof (62–90), windshield slope (90–98), hood (98–118).
  const top = (x: number) => x < 61 ? 16 : x < 63 ? 4 : x < 89 ? 3 : x < 98 ? Math.round(3 + (x - 89) * 1.4) : x < 116 ? 16 + Math.round((x - 98) / 9) : 18
  for (let x = 0; x < L; x++) {
    const t = top(x)
    for (let y = t; y <= 34; y++) px(x, y, 1, 1, y === t ? light : y === 24 ? mid : y >= 31 ? dark : base)
  }
  px(L - 1, 18, 1, 15, dark); px(0, 16, 1, 17, dark)
  // Rust spots and a faded stripe.
  for (const [x, y] of [[8, 28], [9, 29], [44, 30], [70, 29], [71, 30], [106, 27]]) px(x, y, 2, 1, rust)
  px(2, 21, 56, 1, '#b8ae98')
  // Cab window and door.
  for (let y = 5; y <= 14; y++) px(66, y, Math.min(24, 23 + Math.round((y - 5) * .9)) - 0, 1, '#15100e')
  px(68, 6, 9, 1, '#2e2621'); px(64, 15, 1, 16, deep); px(91, 15, 1, 16, deep); px(68, 18, 4, 1, deep)
  // Front: grille, round headlight, bumper. Rear: tail light, bumper.
  px(L - 3, 20, 3, 8, '#6a6658'); px(L - 4, 19, 3, 3, '#f0dca0'); px(L - 4, 29, 6, 3, '#9a968a')
  px(0, 18, 2, 4, '#9a2a22'); px(-2, 29, 5, 3, '#9a968a')
  // Bed rails: wooden slats.
  px(1, 2, 58, 2, '#7a5634'); px(1, 9, 58, 1, '#6b4a2c')
  for (let x = 1; x < 60; x += 7) px(x, 2, 2, 14, '#6b4a2c')
  // Cargo between the slats: a rolled red rug and a green water jerrycan.
  for (let x = 10; x < 34; x++) { px(x, 10, 1, 6, x % 6 < 1 ? '#e3a94a' : '#8a2232'); px(x, 10, 1, 1, '#a83a40') }
  px(40, 5, 8, 11, '#3f6a3a'); px(40, 5, 8, 1, '#5e8a54'); px(42, 3, 3, 2, '#2c4a28')
  // Wheel arches and wheels.
  for (const cx of [20, 100]) {
    const cy = 35
    for (let y = -11; y <= 0; y++) for (let x = -11; x <= 11; x++) { const r = x * x + y * y; if (r <= 121) px(cx + x, cy + y, 1, 1, r > 100 ? deep : '#100a08') }
    disc(g, ox + cx, oy + cy, 9, '#1a1210')
    disc(g, ox + cx, oy + cy, 5, '#cfc6b2')
    disc(g, ox + cx, oy + cy, 3, '#837a66')
    disc(g, ox + cx, oy + cy, 1, '#2a201a')
  }
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ox + 4, oy + 44, L - 8, 2)
}

/** Brass dallah: crown lid, long crescent beak spout, side handle. Base centre at (cx, by). */
export function dallah(g: CanvasRenderingContext2D, cx: number, by: number) {
  const gold = '#e0aa45', hi = '#f6d27c', mid = '#b8822c', dark = '#7a5418'
  const rows = [1, 1, 3, 5, 5, 3, 3, 4, 8, 9, 10, 11, 11, 11, 11, 10, 10, 9, 8, 10, 12]
  const top = by - rows.length
  rows.forEach((w, j) => {
    const x0 = cx - (w >> 1)
    g.fillStyle = gold; g.fillRect(x0, top + j, w, 1)
    if (w > 2) { g.fillStyle = hi; g.fillRect(x0 + 1, top + j, 1, 1); g.fillStyle = mid; g.fillRect(x0 + w - 2, top + j, 2, 1) }
  })
  g.fillStyle = dark; g.fillRect(cx - 4, top + 8, 8, 1); g.fillRect(cx - 6, top + 19, 12, 1)
  // Beak spout rising to the left.
  const beak = [[-5, 10], [-6, 9], [-7, 8], [-8, 7], [-9, 6], [-10, 5], [-11, 4], [-12, 3]]
  for (const [dx, dy] of beak) { g.fillStyle = gold; g.fillRect(cx + dx, top + dy, 2, 2); g.fillStyle = hi; g.fillRect(cx + dx, top + dy, 1, 1) }
  g.fillStyle = mid; g.fillRect(cx - 13, top + 2, 2, 1)
  // Handle on the right.
  g.fillStyle = mid
  g.fillRect(cx + 5, top + 5, 3, 1); g.fillRect(cx + 7, top + 6, 1, 9); g.fillRect(cx + 5, top + 15, 3, 1)
}

/** Bayt al-sha'r: striped goat-hair roof on three poles, sadu band, open front with cushions. */
export function tent(g: CanvasRenderingContext2D) {
  const L = 212, R = 312, poles = [230, 262, 294]
  for (let x = L; x <= R; x++) {
    // Roof sags between pole peaks.
    const d = Math.min(...poles.map(p => Math.abs(x - p)))
    const topY = Math.round(50 + Math.min(7, d * .45))
    for (let y = topY; y < 66; y++) { g.fillStyle = y === topY ? '#5a3f2c' : (y - topY) % 4 < 2 ? '#2c1e17' : '#3a281e'; g.fillRect(x, y, 1, 1) }
  }
  // Sadu band: red, white and black triangles.
  for (let x = L; x <= R; x++) {
    const k = (x - L) % 6
    g.fillStyle = '#a8202e'; g.fillRect(x, 66, 1, 4)
    g.fillStyle = '#efe2c6'; g.fillRect(x, 67 + Math.abs(k - 3) % 3, 1, 1)
    g.fillStyle = '#120a08'; g.fillRect(x, 69, 1, 1)
  }
  // Walls with an open front.
  g.fillStyle = '#1e1410'; g.fillRect(L, 70, R - L + 1, 22)
  g.fillStyle = '#2c1e17'; for (let x = L; x <= R; x += 5) g.fillRect(x, 70, 1, 22)
  g.fillStyle = '#4a2418'; g.fillRect(244, 70, 38, 22)
  g.fillStyle = '#8a2232'; g.fillRect(246, 84, 34, 6)
  g.fillStyle = '#c84a3a'; g.fillRect(246, 84, 34, 1)
  g.fillStyle = '#e8b84a'; for (let x = 248; x < 280; x += 6) g.fillRect(x, 86, 2, 2)
  g.fillStyle = '#6b4a2a'; for (const p of poles) g.fillRect(p, 50, 1, p === 262 ? 42 : 16)
  // Guy ropes and stakes.
  g.fillStyle = '#8a6a48'
  for (let i = 0; i < 14; i++) { g.fillRect(L - i, 64 + i * 2, 1, 2); g.fillRect(R + i, 64 + i * 2, 1, 2) }
}

export const ITEM_ICON: Record<string, string> = {scope: '🔭', dallah: '☕', rope: '🪢', bukhoor: '💨', double: '💥', steal: '🖐️', eject: '⏏️', flip: '🔄'}
export const ITEM_NAME: Record<string, string> = {scope: 'المنظار', dallah: 'الدلّة', rope: 'الحبل', bukhoor: 'البخور', double: 'طلقة دبل', steal: 'سرقة', eject: 'حذف طلقة', flip: 'تبديل'}
export const ITEM_HINT: Record<string, string> = {scope: 'تعرف الطلقة القادمة', dallah: 'تسترد روحًا', rope: 'تختار لاعبًا يخسر دوره', bukhoor: 'يكشف الباقي للجميع', double: 'الحيّة تأخذ روحين', steal: 'تأخذ أداة من لاعب', eject: 'ترمي الطلقة القادمة', flip: 'الفارغة حيّة والعكس'}

type Spark = {x: number; y: number; vx: number; vy: number; life: number; col: string}

export class Stage {
  readonly el: HTMLElement
  private cv: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private world = canvas()
  private sky = buildSky()
  private ground = buildGround()
  private fall = new Float32Array(W * H)
  private stars = Array.from({length: 46}, () => ({x: Math.floor(rnd() * W), y: Math.floor(rnd() * 52), p: rnd() * 9, s: .6 + rnd() * 2}))
  private sparks: Spark[] = []
  private seats = new Map<Seat, HTMLButtonElement>()
  private reveal: HTMLElement
  private stamp: HTMLElement
  private state: RoomState | null = null
  private role: Role = 'spectator'
  private targets: Seat[] = []
  private slots = {} as Record<Seat, Slot>
  private beam: {from: Seat; to: Seat; t0: number; kind: Bullet} | null = null
  private flash: {kind: Bullet; t0: number} | null = null
  private hit: {seat: Seat; kind: Bullet; t0: number} | null = null
  private armed: Seat | '' = ''
  private timers: number[] = []
  private active = true
  private lastDraw = 0
  calm = false

  constructor(host: HTMLElement, private onSeat?: (seat: Seat) => void) {
    this.el = document.createElement('div')
    this.el.className = 'stage'
    this.el.innerHTML = `<div class="world"><canvas width="${W}" height="${H}" aria-label="مخيم الصحراء حول النار"></canvas><div class="seats"></div></div><div class="reveal" aria-live="polite"><div class="card-3d"><div class="face back"></div><div class="face front"></div></div></div><div class="stamp"></div>`
    host.appendChild(this.el)
    this.cv = this.el.querySelector('canvas')!
    this.g = this.cv.getContext('2d')!
    this.g.imageSmoothingEnabled = false
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - FX, (y - FY + 4) * 1.35)
      this.fall[y * W + x] = Math.max(0, 1 - d / 205) ** 1.5
    }
    const wrap = this.el.querySelector<HTMLElement>('.seats')!
    for (const seat of SEATS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'seat'
      b.style.setProperty('--c', CHARACTERS[seat].color)
      b.innerHTML = `<span class="plate"><b class="nm"></b><span class="hp"></span><small class="tt"></small><span class="cta"></span></span>`
      b.addEventListener('click', () => this.onSeat?.(seat))
      wrap.appendChild(b)
      this.seats.set(seat, b)
    }
    this.reveal = this.el.querySelector('.reveal')!
    this.stamp = this.el.querySelector('.stamp')!
    this.layout()
    const loop = (now: number) => {
      requestAnimationFrame(loop)
      if (!this.active || document.hidden || now - this.lastDraw < 1000 / FPS) return
      this.lastDraw = now
      this.draw(now / 1000)
    }
    requestAnimationFrame(loop)
  }

  setActive(on: boolean) { this.active = on }

  /** Seats are placed relative to the viewer: you are always at the front of the fire. */
  private layout() {
    const me = this.role === 'spectator' ? 0 : SEATS.indexOf(this.role)
    SEATS.forEach((seat, i) => {
      const k = (i - me + 6) % 6
      const sl = this.slots[seat] = slotFor(k)
      const b = this.seats.get(seat)!
      b.classList.toggle('front', k === 0)
      const w = SW * sl.s * 1.3, h = SH * sl.s * 1.15
      b.style.left = `${(sl.x - w / 2) / W * 100}%`
      b.style.top = `${(sl.y - h) / H * 100}%`
      b.style.width = `${w / W * 100}%`
      b.style.height = `${h / H * 100}%`
      b.style.zIndex = String(sl.y)
    })
  }

  /** `labels`: an action button shown above a seat (e.g. «أطلق»); seats without one are not clickable. */
  update(s: RoomState, role: Role, targets: Seat[], labels: Partial<Record<Seat, string>> = {}) {
    const moved = role !== this.role
    this.state = s
    this.role = role
    this.targets = targets
    if (moved) this.layout()
    const live = s.phase === 'live'
    for (const seat of SEATS) {
      const b = this.seats.get(seat)!, st = s.seats[seat], present = Boolean(st?.connected)
      const out = present && !st.alive && (live || s.phase === 'ended')
      b.classList.toggle('empty', !present)
      b.classList.toggle('turn', live && s.turn === seat)
      b.classList.toggle('me', seat === role)
      b.classList.toggle('out', out)
      b.classList.toggle('winner', s.phase === 'ended' && s.winner === seat)
      const label = present ? labels[seat] || '' : ''
      b.classList.toggle('targetable', targets.includes(seat))
      b.classList.toggle('has-cta', Boolean(label))
      b.querySelector('.cta')!.textContent = label
      b.disabled = !label
      b.querySelector('.nm')!.textContent = present ? (seat === role ? 'أنت' : st.name || CHARACTERS[seat].title) : ''
      const max = s.match?.max_lives || 3, lives = Math.max(0, st?.lives || 0)
      const hp = b.querySelector<HTMLElement>('.hp')!
      hp.innerHTML = present && live ? `${'<i>♥</i>'.repeat(Math.min(lives, max))}${'<i class="off">♥</i>'.repeat(Math.max(0, max - lives))}` : ''
      const tags = [st?.double ? '💥×2' : '', st?.skip ? '🪢 مربوط' : ''].filter(Boolean).join(' ')
      b.querySelector('.tt')!.textContent = !present ? '' : s.phase === 'ended' && s.winner === seat ? `فاز بالجولة · ${st.score}★` : out ? 'خرج' : live ? `${tags || CHARACTERS[seat].title} · ${st.score}★` : `${CHARACTERS[seat].title} · ${st.score}★`
      b.setAttribute('aria-label', present ? `${st.name} — ${CHARACTERS[seat].title}` : 'مقعد شاغر')
    }
    if (s.phase === 'waiting' || s.phase === 'countdown') this.hideStamp()
  }

  play(r: Result, calm: boolean) {
    this.clearTimers()
    const now = performance.now() / 1000
    const front = this.reveal.querySelector<HTMLElement>('.front')!
    front.className = `face front ${r.kind}`
    front.innerHTML = r.kind === 'live' ? '<i class="ico shell live"></i><b>حيّة</b>' : '<i class="ico shell blank"></i><b>فارغة</b>'
    this.reveal.classList.remove('show', 'flip')
    // The shooter picks up the rifle and aims; the shot lands after SHOT_DELAY.
    this.armed = r.actor
    this.beam = {from: r.actor, to: r.target, t0: now + this.shotDelay(calm), kind: r.kind}
    const delay = this.shotDelay(calm) * 1000
    this.later(() => {
      const t = performance.now() / 1000
      this.flash = {kind: r.kind, t0: t}
      this.hit = {seat: r.target, kind: r.kind, t0: t}
      void this.reveal.offsetWidth
      this.reveal.classList.add('show', 'flip')
      const sl = this.slots[r.target], top = sl.y - SH * sl.s
      if (r.kind === 'live') {
        if (!calm) {
          for (let i = 0; i < 24; i++) this.sparks.push({x: sl.x, y: top + 8, vx: (rnd() - .5) * 70, vy: -10 - rnd() * 50, life: .4 + rnd() * .5, col: ['#fff0c0', '#ffb43a', '#ff6a2a'][i % 3]})
          this.el.classList.add('shake')
        }
      } else {
        const a = this.slots[r.actor]
        for (let i = 0; i < 10; i++) this.sparks.push({x: a.x + (rnd() - .5) * 4, y: a.y - SH * a.s * .55, vx: (rnd() - .5) * 10, vy: -6 - rnd() * 10, life: .8 + rnd() * .6, col: rnd() < .5 ? '#8a8078' : '#b0a89e'})
      }
    }, delay)
    this.later(() => { this.el.classList.remove('shake'); this.armed = '' }, delay + 600)
    this.later(() => this.reveal.classList.remove('show', 'flip'), delay + (calm ? 900 : 1400))
  }

  /** Seconds between the action and the bang (aim + suspense). */
  shotDelay(calm: boolean) { return calm ? .15 : .9 }

  showStamp(text: string, kind: 'win' | 'out') { this.stamp.className = `stamp on ${kind}`; this.stamp.textContent = text }
  hideStamp() { this.stamp.className = 'stamp' }
  private later(fn: () => void, ms: number) { this.timers.push(window.setTimeout(fn, ms)) }
  private clearTimers() { for (const t of this.timers) clearTimeout(t); this.timers = [] }

  private draw(t: number) {
    const g = this.g, w = this.world.g, s = this.state, live = s?.phase === 'live'
    const flash = this.flash && t - this.flash.t0 < .9 ? this.flash : null
    const fa = flash ? 1 - (t - flash.t0) / .9 : 0

    // ---- World layer (lit by the fire) ----
    w.clearRect(0, 0, W, H)
    w.drawImage(this.ground, 0, 0)
    // The rifle rests on the rug unless someone is holding it; unknown bullets lie beside it.
    if (!this.armed) this.rifle(w, 180, 103)
    const left = live ? s!.chamber.total : 0
    for (let i = 0; i < left; i++) {
      const x = 205 - Math.round(left * 5 / 2) + i * 5
      w.fillStyle = '#0a0605'; w.fillRect(x - 1, 111, 5, 8)
      w.fillStyle = '#d4ac52'; w.fillRect(x, 112, 3, 5)
      w.fillStyle = '#ffe08a'; w.fillRect(x, 112, 1, 4)
      w.fillStyle = '#5a4030'; w.fillRect(x, 117, 3, 1)
    }
    const order = [...SEATS].sort((a, b) => this.slots[a].y - this.slots[b].y)
    for (const seat of order) {
      const sl = this.slots[seat], st = s?.seats[seat], sw = Math.round(SW * sl.s), sh = Math.round(SH * sl.s)
      const x0 = Math.round(sl.x - sw / 2), y0 = Math.round(sl.y - sh)
      w.fillStyle = 'rgba(0,0,0,.45)'; w.fillRect(x0 - 1, sl.y - 2, sw + 2, 3)
      if (!st?.connected) {
        w.fillStyle = '#4a2a3a'; w.fillRect(Math.round(sl.x - 8 * sl.s), Math.round(sl.y - 4 * sl.s), Math.round(16 * sl.s), Math.round(4 * sl.s))
        w.fillStyle = '#6a3a4a'; w.fillRect(Math.round(sl.x - 8 * sl.s), Math.round(sl.y - 4 * sl.s), Math.round(16 * sl.s), 1)
        continue
      }
      if (live && s!.turn === seat) { w.fillStyle = CHARACTERS[seat].color; w.fillRect(x0 - 3, sl.y - 2, sw + 6, 3); w.fillRect(x0 - 1, sl.y + 1, sw + 2, 1) }
      const out = !st.alive && (live || s!.phase === 'ended')
      if (out) {
        // Slumped and greyed: head bowed, sitting lower.
        const drop = Math.round(sh * .12)
        this.outlined(w, sprite(seat, sl.view, 1, true), silhouette(seat, sl.view, 1, true), x0, y0 + drop, sw, sh - drop)
        continue
      }
      const frame = (this.calm ? 0 : Math.floor(t * 1.1 + SEATS.indexOf(seat) * .7) % 2) as 0 | 1
      const hit = this.hit && this.hit.seat === seat && t - this.hit.t0 < .6 && this.hit.kind === 'live'
      const dx = hit && !this.calm ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0
      this.outlined(w, sprite(seat, sl.view, frame), silhouette(seat, sl.view, frame), x0 + dx, y0, sw, sh)
    }
    this.light(t, flash, fa)

    // ---- Composite ----
    g.drawImage(this.sky, 0, 0)
    for (const st of this.stars) if (this.calm || Math.sin(t * st.s + st.p) > -.4) { g.fillStyle = st.s > 2 ? '#fff6d8' : '#a99cc0'; g.fillRect(st.x, st.y, 1, 1) }
    g.drawImage(this.world.c, 0, 0)
    this.fire(t, flash, fa)
    this.effects(t)
  }

  /** Re-lights the world layer: quantised falloff from the fire, ordered dithering, warm tint. */
  private light(t: number, flash: {kind: string} | null, fa: number) {
    const img = this.world.g.getImageData(0, 0, W, H), d = img.data
    const flick = this.calm ? 1 : .9 + .07 * Math.sin(t * 11) + .05 * Math.sin(t * 23 + 1)
    const boost = flash?.kind === 'live' ? 1 + fa * 1.2 : 1
    const red = flash?.kind === 'live' ? 70 * fa : 0, teal = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4
      if (d[p + 3] === 0) continue
      const f = this.fall[i]
      // 8 light levels, soft dither only at band edges: smoother and clearer than heavy checkering.
      const L = Math.floor((.26 + flick * boost * f * .95) * 8 + .25 + dither(x, y) * .5) / 8
      d[p] = Math.min(255, d[p] * L * 1.32 + red * f)
      d[p + 1] = Math.min(255, d[p + 1] * L * 1.0 + teal * f * .8)
      d[p + 2] = Math.min(255, d[p + 2] * (L * .72 + .09) + teal * f)
    }
    this.world.g.putImageData(img, 0, 0)
  }

  private fire(t: number, flash: {kind: string} | null, fa: number) {
    const g = this.g, danger = flash?.kind === 'live', safe = false
    const boost = 1 + (danger ? fa * .9 : 0)
    g.save(); g.globalCompositeOperation = 'lighter'
    const glow = g.createRadialGradient(FX, FY - 6, 2, FX, FY - 6, 46)
    glow.addColorStop(0, danger ? 'rgba(255,60,40,.55)' : 'rgba(255,140,50,.38)'); glow.addColorStop(1, 'rgba(255,100,30,0)')
    g.fillStyle = glow; g.fillRect(FX - 50, FY - 56, 100, 100); g.restore()
    g.fillStyle = '#ff8a3a'; g.fillRect(FX - 9, FY - 2, 18, 1)
    for (let dx = -9; dx <= 9; dx++) {
      const base = 13 - Math.abs(dx) * 1.35
      if (base <= 0) continue
      const h = Math.max(1, Math.round(base * (.7 + .5 * wave(t * (this.calm ? 2 : 9) + dx * 1.7)) * boost))
      for (let j = 0; j < h; j++) {
        const r = j / h
        g.fillStyle = r < .3 ? (danger ? '#ffd0a0' : '#fff4c2') : r < .6 ? (danger ? '#ff6a2a' : '#ffc247') : r < .85 ? (danger ? '#d8281c' : '#f0682a') : safe ? '#4fe0d0' : '#9c2a1c'
        g.fillRect(FX + dx, FY - 3 - j, 1, 1)
      }
    }
    if (!this.calm && rnd() < .7) this.sparks.push({x: FX + (rnd() - .5) * 10, y: FY - 12, vx: (rnd() - .5) * 8, vy: -14 - rnd() * 16, life: .8 + rnd() * .8, col: rnd() < .5 ? '#ffb43a' : '#ffe08a'})
  }

  private effects(t: number) {
    const g = this.g, s = this.state, dt = 1 / FPS
    // Sparks and bursts.
    this.sparks = this.sparks.filter(p => (p.life -= dt) > 0)
    for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1) }
    if (!s) return
    const bob = this.calm ? 0 : Math.round(Math.sin(t * 5))
    const headTop = (seat: Seat) => { const sl = this.slots[seat]; return Math.round(sl.y - SH * sl.s) }
    // Turn marker: a small diamond in the player's colour above the head.
    if (s.phase === 'live' && s.turn) {
      const sl = this.slots[s.turn], y = headTop(s.turn) - 8 + bob
      g.fillStyle = CHARACTERS[s.turn].color
      ;[1, 3, 5, 3, 1].forEach((w, j) => g.fillRect(sl.x - (w >> 1), y + j, w, 1))
    }
    // Targets: red arrows.
    for (const seat of this.targets) {
      const sl = this.slots[seat], y = headTop(seat) - 9 - bob
      g.fillStyle = '#ff4d5e'
      ;[5, 5, 3, 1].forEach((w, j) => g.fillRect(sl.x - (w >> 1), y + j, w, 1))
    }
    // Winner sparkles.
    if (s.phase === 'ended' && s.winner && !this.calm) {
      const sl = this.slots[s.winner]
      for (let i = 0; i < 3; i++) { g.fillStyle = i ? '#ffe08a' : '#e8b84a'; g.fillRect(Math.round(sl.x + (rnd() - .5) * SW * sl.s * 1.4), Math.round(sl.y - rnd() * SH * sl.s * 1.2), 1, 1) }
    }
    // The shooter holds the rifle, aimed at the target (or at himself), then fires.
    if (this.armed && this.beam) {
      const a = this.slots[this.beam.from], b = this.slots[this.beam.to]
      const ax = a.x, ay = Math.round(a.y - SH * a.s * .5)
      const self = this.beam.from === this.beam.to
      let dx = self ? 0 : b.x - ax, dy = self ? -1 : (b.y - SH * b.s * .5) - ay
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      const L = Math.round(10 + 6 * a.s), tipX = ax + dx * L, tipY = ay + dy * L
      for (let i = 0; i <= L; i++) {
        g.fillStyle = i < L * .4 ? '#6b3f22' : i < L * .5 ? '#2a2a2e' : '#4a4a52'
        g.fillRect(Math.round(ax + dx * i), Math.round(ay + dy * i), 2, 2)
      }
      const since = t - this.beam.t0
      if (since >= 0 && since < .12 && this.beam.kind === 'live') {
        // Muzzle flash and a short tracer.
        g.fillStyle = '#fff4c2'
        for (let r = 0; r < 4; r++) g.fillRect(Math.round(tipX - r), Math.round(tipY - r), r * 2 + 2, r * 2 + 2)
        if (!self) {
          g.fillStyle = '#ffe08a'
          const tx = b.x, ty = b.y - SH * b.s * .55
          for (let i = 0; i < 40; i++) { const u = i / 40; g.fillRect(Math.round(tipX + (tx - tipX) * u), Math.round(tipY + (ty - tipY) * u), 1, 1) }
        }
      }
    }
    // White frame flash on a live shot.
    if (this.flash && this.flash.kind === 'live' && t - this.flash.t0 < .08 && !this.calm) { g.fillStyle = 'rgba(255,240,200,.55)'; g.fillRect(0, 0, W, H) }
  }

  /** Draws a sprite with a 1px dark outline so it separates from the sand at any light level. */
  private outlined(g: CanvasRenderingContext2D, spr: HTMLCanvasElement, sil: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(sil, x + ox, y + oy, w, h)
    g.drawImage(spr, x, y, w, h)
  }

  /** A pixel rifle lying on the rug: wooden stock, dark barrel. */
  private rifle(g: CanvasRenderingContext2D, x: number, y: number) {
    const px = (dx: number, dy: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h) }
    // Outline first, then wooden stock, steel receiver, long barrel with a front sight.
    px(-1, 0, 52, 7, '#0a0605')
    px(0, 1, 4, 5, '#5a3218'); px(4, 2, 10, 3, '#6b3f22'); px(1, 1, 12, 1, '#9a6234'); px(0, 5, 3, 1, '#2a1a10')
    px(14, 1, 8, 4, '#3a3a40'); px(14, 1, 8, 1, '#6a6a74'); px(16, 5, 4, 2, '#2a2a2e'); px(17, 5, 2, 1, '#0a0605')
    px(22, 2, 28, 2, '#55555e'); px(22, 2, 28, 1, '#9a9aa6'); px(22, 4, 18, 1, '#3a3a40')
    px(48, 1, 1, 1, '#9a9aa6'); px(26, 4, 8, 1, '#6b3f22')
  }
}
