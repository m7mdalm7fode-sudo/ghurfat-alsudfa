import {SEATS, type Result, type Role, type RoomState, type Seat} from '../net/protocol'
import {CHARACTERS} from './characters'
import {sprite, SW, SH, type View} from './pixel'

/**
 * Pixel-art desert camp drawn on a 320×200 canvas and upscaled without smoothing. The fire is the
 * only real light: the world layer is re-lit every frame with a dithered, quantised falloff.
 * The ring of seats is rotated so the local player always sits in front, seen from behind.
 */
const W = 320, H = 200, FX = 160, FY = 112, HORIZON = 72, FPS = 24
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16)
const dither = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]

type Slot = {x: number; y: number; s: number; view: View}
/** Slot k = seats counted from the viewer around the fire; k=0 is the viewer. */
const SLOTS: Slot[] = [
  {x: FX, y: 188, s: 2.4, view: 'back'},
  {x: 58, y: 152, s: 2, view: 'back'},
  {x: 96, y: 100, s: 1.55, view: 'front'},
  {x: FX, y: 80, s: 1.3, view: 'front'},
  {x: 224, y: 100, s: 1.55, view: 'front'},
  {x: 262, y: 152, s: 2, view: 'back'},
]
const slotFor = (k: number): Slot => SLOTS[k]

let seed = 11
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const wave = (a: number) => (Math.sin(a) * .5 + .5) * .6 + (Math.sin(a * 2.3 + 1) * .5 + .5) * .4

function canvas(w = W, h = H) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return {c, g}
}

/** Night sky, crescent moon and dunes: never lit by the fire. */
function buildSky() {
  const {c, g} = canvas()
  const pal = [[4, 3, 10], [10, 7, 22], [20, 12, 30], [32, 18, 31], [44, 26, 28]]
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.max(0, Math.min(4, Math.floor(y / (HORIZON + 6) * 4 + dither(x, y) - .3)))
    const p = (y * W + x) * 4
    img.data.set([...pal[i], 255], p)
  }
  g.putImageData(img, 0, 0)
  // Crescent.
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
    if (x * x + y * y <= 30 && (x - 3) * (x - 3) + (y + 1) * (y + 1) > 22) { g.fillStyle = '#efe2c2'; g.fillRect(44 + x, 20 + y, 1, 1) }
  }
  for (let x = 0; x < W; x++) {
    const far = Math.round(58 + 5 * Math.sin(x / 37) + 3 * Math.sin(x / 13 + 1))
    g.fillStyle = '#1a1019'; g.fillRect(x, far, 1, H - far)
    const near = Math.round(66 + 4 * Math.sin(x / 29 + 2) + 2 * Math.sin(x / 7))
    g.fillStyle = '#241510'; g.fillRect(x, near, 1, H - near)
  }
  return c
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  g.fillStyle = col
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, w * 2 + 1, 1) }
}

/** Sand, pickup truck, goat-hair tent, fire pit, dallah and the rug for the cards. */
function buildGround() {
  const {c, g} = canvas()
  seed = 11
  const sand = [[94, 66, 41], [101, 71, 44], [108, 76, 47], [116, 83, 51]]
  const img = g.createImageData(W, H)
  for (let y = HORIZON; y < H; y++) for (let x = 0; x < W; x++) {
    const r = rnd()
    const i = r < .08 ? 0 : r < .5 ? 1 : r < .9 ? 2 : 3
    img.data.set([...sand[i], 255], (y * W + x) * 4)
  }
  g.putImageData(img, 0, 0)
  // Wind ripples.
  g.fillStyle = 'rgb(76,52,32)'
  for (let k = 0; k < 40; k++) { const x = Math.floor(rnd() * W), y = HORIZON + 4 + Math.floor(rnd() * (H - HORIZON - 4)); g.fillRect(x, y, 4 + Math.floor(rnd() * 8), 1) }

  // Pickup truck (generic, no brand), parked behind the camp on the left.
  const body = '#c49a6c', dark = '#8f6b47', win = '#120c0a'
  g.fillStyle = body; g.fillRect(8, 66, 56, 20); g.fillRect(64, 50, 40, 36); g.fillRect(104, 64, 18, 22)
  g.fillStyle = dark; g.fillRect(8, 64, 56, 2); g.fillRect(8, 84, 114, 3); g.fillRect(84, 52, 1, 32); g.fillRect(104, 64, 1, 20); g.fillRect(120, 70, 2, 6)
  g.fillStyle = win; g.fillRect(67, 53, 15, 12); g.fillRect(87, 53, 14, 12)
  g.fillStyle = '#d9b47e'; g.fillRect(64, 50, 40, 1); g.fillRect(104, 64, 18, 1)
  for (const wx of [30, 100]) { disc(g, wx, 88, 9, '#16100d'); disc(g, wx, 88, 4, '#6b5a4a'); disc(g, wx, 88, 1, '#16100d') }
  g.fillStyle = '#e8c27a'; g.fillRect(120, 66, 2, 3)

  // Bayt al-sha'r: black goat-hair tent on the right.
  for (let y = 54; y < 92; y++) {
    const roof = y < 64, half = roof ? 30 + (y - 54) * 1.8 : 48
    g.fillStyle = (y - 54) % 5 === 0 ? '#4a3326' : '#2a1d17'
    g.fillRect(Math.round(262 - half), y, Math.round(half * 2), 1)
  }
  g.fillStyle = '#0b0705'; g.fillRect(250, 68, 22, 24)
  g.fillStyle = '#5a3a26'; g.fillRect(232, 50, 1, 42); g.fillRect(292, 50, 1, 42)
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
  // Dallah and two finjan cups.
  g.fillStyle = '#d9a441'; g.fillRect(133, 101, 5, 8); g.fillRect(134, 99, 3, 2); g.fillRect(135, 97, 1, 2); g.fillRect(130, 100, 3, 1); g.fillRect(129, 99, 1, 1)
  g.fillStyle = '#b7832e'; g.fillRect(137, 102, 1, 7); g.fillRect(138, 103, 1, 4)
  g.fillStyle = '#f0e6d2'; g.fillRect(140, 108, 2, 2); g.fillRect(143, 109, 2, 2)
  // Rug for the face-down shells.
  g.fillStyle = '#6d2533'; g.fillRect(184, 110, 40, 8)
  g.fillStyle = '#d9a441'; g.fillRect(184, 110, 40, 1); g.fillRect(184, 117, 40, 1)
  return c
}

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
  private beam: {from: Seat; to: Seat; t0: number} | null = null
  private flash: {kind: 'safe' | 'danger'; t0: number} | null = null
  private hit: {seat: Seat; kind: 'safe' | 'danger'; t0: number} | null = null
  private timers: number[] = []
  private active = true
  private lastDraw = 0
  calm = false

  constructor(host: HTMLElement, private onSeat?: (seat: Seat) => void) {
    this.el = document.createElement('div')
    this.el.className = 'stage'
    this.el.innerHTML = `<canvas width="${W}" height="${H}" aria-label="مخيم الصحراء حول النار"></canvas><div class="seats"></div><div class="reveal" aria-live="polite"><div class="card-3d"><div class="face back"></div><div class="face front"></div></div></div><div class="stamp"></div>`
    host.appendChild(this.el)
    this.cv = this.el.querySelector('canvas')!
    this.g = this.cv.getContext('2d')!
    this.g.imageSmoothingEnabled = false
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - FX, (y - FY + 4) * 1.35)
      this.fall[y * W + x] = Math.max(0, 1 - d / 175) ** 1.7
    }
    const wrap = this.el.querySelector<HTMLElement>('.seats')!
    for (const seat of SEATS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'seat'
      b.style.setProperty('--c', CHARACTERS[seat].color)
      b.innerHTML = `<span class="plate"><b class="nm"></b><small class="tt"></small></span>`
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

  update(s: RoomState, role: Role, targets: Seat[]) {
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
      b.classList.toggle('targetable', targets.includes(seat))
      b.disabled = !targets.includes(seat)
      b.querySelector('.nm')!.textContent = present ? (seat === role ? 'أنت' : st.name || CHARACTERS[seat].title) : ''
      b.querySelector('.tt')!.textContent = !present ? '' : s.phase === 'ended' && s.winner === seat ? 'الفائز' : out ? 'خرج' : `${CHARACTERS[seat].title} · ${st.score}★`
      b.setAttribute('aria-label', present ? `${st.name} — ${CHARACTERS[seat].title}` : 'مقعد شاغر')
    }
    if (s.phase === 'waiting' || s.phase === 'countdown') this.hideStamp()
  }

  play(r: Result, calm: boolean) {
    this.clearTimers()
    const now = performance.now() / 1000
    const front = this.reveal.querySelector<HTMLElement>('.front')!
    front.className = `face front ${r.kind}`
    front.innerHTML = r.kind === 'danger' ? '<i class="ico">✦</i><b>خطرة</b>' : '<i class="ico">☾</i><b>آمنة</b>'
    this.reveal.classList.remove('show', 'flip')
    void this.reveal.offsetWidth
    this.reveal.classList.add('show')
    this.later(() => this.reveal.classList.add('flip'), calm ? 50 : 380)
    this.later(() => this.reveal.classList.remove('show', 'flip'), calm ? 1500 : 2100)
    if (r.actor !== r.target) this.beam = {from: r.actor, to: r.target, t0: now}
    const delay = calm ? .1 : .7
    this.later(() => {
      const t = performance.now() / 1000
      this.flash = {kind: r.kind, t0: t}
      this.hit = {seat: r.target, kind: r.kind, t0: t}
      if (!calm) {
        const sl = this.slots[r.target], top = sl.y - SH * sl.s
        const col = r.kind === 'danger' ? ['#ff4d4d', '#ffb43a', '#fff0c0'] : ['#4fe0d0', '#bff6ee']
        for (let i = 0; i < (r.kind === 'danger' ? 26 : 14); i++) this.sparks.push({x: sl.x, y: top + 6, vx: (rnd() - .5) * 60, vy: -20 - rnd() * 50, life: .6 + rnd() * .5, col: col[i % col.length]})
        if (r.kind === 'danger') this.el.classList.add('shake')
      }
    }, delay * 1000)
    this.later(() => this.el.classList.remove('shake'), delay * 1000 + 500)
  }

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
    const cards = live ? s!.chamber.total : 0
    for (let i = 0; i < cards; i++) {
      const x = 204 - Math.round(cards * 5 / 2) + i * 5
      w.fillStyle = '#e8b84a'; w.fillRect(x, 105, 4, 6)
      w.fillStyle = '#3a2160'; w.fillRect(x + 1, 106, 2, 4)
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
        w.drawImage(sprite(seat, sl.view, 1, true), x0, y0 + drop, sw, sh - drop)
        continue
      }
      const frame = (this.calm ? 0 : Math.floor(t * 1.1 + SEATS.indexOf(seat) * .7) % 2) as 0 | 1
      const hit = this.hit && this.hit.seat === seat && t - this.hit.t0 < .6 && this.hit.kind === 'danger'
      const dx = hit && !this.calm ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0
      w.drawImage(sprite(seat, sl.view, frame), x0 + dx, y0, sw, sh)
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
    const boost = flash?.kind === 'danger' ? 1 + fa * .5 : 1
    const red = flash?.kind === 'danger' ? 90 * fa : 0, teal = flash?.kind === 'safe' ? 50 * fa : 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4
      if (d[p + 3] === 0) continue
      const f = this.fall[i]
      const L = Math.floor((.14 + flick * boost * f) * 6 + dither(x, y)) / 6
      d[p] = Math.min(255, d[p] * L * 1.32 + red * f)
      d[p + 1] = Math.min(255, d[p + 1] * L * 1.0 + teal * f * .8)
      d[p + 2] = Math.min(255, d[p + 2] * (L * .72 + .09) + teal * f)
    }
    this.world.g.putImageData(img, 0, 0)
  }

  private fire(t: number, flash: {kind: string} | null, fa: number) {
    const g = this.g, danger = flash?.kind === 'danger', safe = flash?.kind === 'safe'
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
    // Challenge beam: dashed pixel arc from actor to target.
    if (this.beam && t - this.beam.t0 < 1.3) {
      const a = this.slots[this.beam.from], b = this.slots[this.beam.to]
      const ax = a.x, ay = headTop(this.beam.from) + 4, bx = b.x, by = headTop(this.beam.to) + 4
      const cx = (ax + bx) / 2, cy = Math.min(ay, by) - 40
      g.fillStyle = CHARACTERS[this.beam.from].color
      const shift = Math.floor(t * 30)
      for (let i = 0; i <= 80; i++) {
        if (((i + shift) >> 2) % 2) continue
        const u = i / 80, x = (1 - u) ** 2 * ax + 2 * (1 - u) * u * cx + u * u * bx, y = (1 - u) ** 2 * ay + 2 * (1 - u) * u * cy + u * u * by
        g.fillRect(Math.round(x), Math.round(y), 1, 1)
      }
    }
  }
}
