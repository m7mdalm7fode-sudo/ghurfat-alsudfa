import {CHARACTERS} from './characters'
import {silhouette, sprite, SW, SH, type View} from './pixel'
import {W, H, FX, FY, HORIZON, FPS, buildSky, canvas, dallah, dither, pickup, rnd, tent, wave} from './stage'

/**
 * The camp for the hidden-role games: up to twelve players sit in a ring around the fire. The ring
 * is rotated so the local player is always in front, seen from behind. Same pixel style and fire
 * lighting as «آخر فنجال»; the mood changes the light (dark night, firelit night, or dawn).
 */
export type CampSeat = {
  id: string; char: string; name: string; present: boolean; alive: boolean; me: boolean; turn: boolean
  cta: string; tag: string; badges: string; color?: string; dim?: boolean
}
export type Theme = 'village' | 'desert'
export type Mood = 'night' | 'dark' | 'day'
type Slot = {x: number; y: number; s: number; view: View}
type Spark = {x: number; y: number; vx: number; vy: number; life: number; col: string}

const CX = FX, CY = 138, RX = 136, RY = 40

/** Slot k of n, counted from the viewer (k=0, front centre) around the ellipse. */
function ring(k: number, n: number): Slot {
  const a = Math.PI / 2 + (k / Math.max(1, n)) * Math.PI * 2
  const x = CX + RX * Math.cos(a) * (n <= 4 ? .78 : 1), y = CY + RY * Math.sin(a)
  const depth = (y - (CY - RY)) / (RY * 2)
  return {x: Math.round(x), y: Math.round(y), s: +(0.95 + depth * 0.6).toFixed(2), view: y > CY + 4 ? 'back' : 'front'}
}

/** Mud-brick houses of an old village, a palm and a well: the setting of «المافيا». */
function village(g: CanvasRenderingContext2D) {
  const house = (x: number, w: number, h: number) => {
    const y = HORIZON - h + 4
    g.fillStyle = '#4a3020'; g.fillRect(x, y, w, h)
    g.fillStyle = '#5c3c28'; g.fillRect(x, y, w, 2)
    for (let i = x; i < x + w; i += 4) { g.fillStyle = '#4a3020'; g.fillRect(i, y - 3, 2, 3) }
    g.fillStyle = '#2a1a10'; g.fillRect(x + (w >> 1) - 2, y + h - 9, 5, 9)
    g.fillStyle = '#1c120c'; for (let i = x + 4; i < x + w - 4; i += 9) g.fillRect(i, y + 5, 3, 3)
    g.fillStyle = '#3a2416'; for (let i = x + 2; i < x + w; i += 7) g.fillRect(i, y + 3, 1, 1)
  }
  house(14, 40, 26); house(56, 30, 20); house(232, 46, 30); house(282, 30, 18)
  // Watchtower.
  g.fillStyle = '#4a3020'; g.fillRect(96, HORIZON - 40, 14, 44); g.fillStyle = '#5c3c28'; g.fillRect(94, HORIZON - 42, 18, 3)
  g.fillStyle = '#1c120c'; g.fillRect(101, HORIZON - 34, 3, 5); g.fillRect(101, HORIZON - 20, 3, 5)
  // Palm trees.
  for (const [px, ph] of [[206, 46], [222, 36], [40, 34]]) {
    for (let j = 0; j < ph; j++) { g.fillStyle = j % 3 ? '#3a2818' : '#2a1c10'; g.fillRect(px + Math.round(Math.sin(j / 9) * 2), HORIZON + 6 - j, 2, 1) }
    const tx = px + Math.round(Math.sin(ph / 9) * 2), ty = HORIZON + 6 - ph
    g.fillStyle = '#1e3a22'
    for (let a = 0; a < 7; a++) { const t = a / 7 * Math.PI * 2 + .3; for (let r = 0; r < 12; r++) g.fillRect(Math.round(tx + Math.cos(t) * r), Math.round(ty + Math.sin(t) * r * .5 + r * r * .04), 2, 1) }
  }
  // Well with a wooden frame.
  g.fillStyle = '#5a4a3a'; g.fillRect(262, 100, 20, 9); g.fillStyle = '#6e5c48'; g.fillRect(262, 100, 20, 2)
  g.fillStyle = '#6b4a2a'; g.fillRect(263, 84, 2, 16); g.fillRect(279, 84, 2, 16); g.fillRect(262, 84, 20, 2)
  g.fillStyle = '#8a6a48'; g.fillRect(271, 86, 1, 8); g.fillStyle = '#5a3a20'; g.fillRect(269, 93, 5, 4)
}

function buildGround(theme: Theme) {
  const {c, g} = canvas()
  let seed = 17
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  g.fillStyle = 'rgb(104,74,46)'; g.fillRect(0, HORIZON, W, H - HORIZON)
  for (let k = 0; k < 700; k++) { const x = Math.floor(r() * W), y = HORIZON + Math.floor(r() * (H - HORIZON)); g.fillStyle = r() < .5 ? 'rgb(90,63,39)' : 'rgb(118,85,53)'; g.fillRect(x, y, 1, 1) }
  g.fillStyle = 'rgb(88,62,38)'
  for (let k = 0; k < 34; k++) { const x = Math.floor(r() * W), y = HORIZON + 4 + Math.floor(r() * (H - HORIZON - 4)); g.fillRect(x, y, 5 + Math.floor(r() * 9), 1) }
  if (theme === 'village') village(g)
  else { pickup(g, 36, 48); tent(g) }
  // Fire pit, stones and the coffee corner.
  g.fillStyle = '#3a2416'; g.fillRect(FX - 8, FY - 1, 16, 2); g.fillRect(FX - 5, FY - 2, 10, 1)
  for (let a = 0; a < 14; a++) {
    const t = a / 14 * Math.PI * 2, x = Math.round(FX + 13 * Math.cos(t)), y = Math.round(FY + 4 * Math.sin(t))
    g.fillStyle = a % 2 ? '#6d625a' : '#55493f'; g.fillRect(x - 1, y - 1, 3, 2)
  }
  dallah(g, 186, 116)
  g.fillStyle = '#7a5230'; g.fillRect(192, 115, 9, 2)
  for (const x of [193, 197]) { g.fillStyle = '#f4ead8'; g.fillRect(x, 112, 3, 3); g.fillStyle = '#c8324a'; g.fillRect(x, 113, 3, 1) }
  // A low majlis rug inside the ring.
  g.fillStyle = '#5e1f2c'; g.fillRect(118, 124, 84, 10)
  g.fillStyle = '#d9a441'; g.fillRect(118, 124, 84, 1); g.fillRect(118, 133, 84, 1)
  for (let x = 121; x < 200; x += 5) g.fillRect(x, 128, 2, 2)
  return c
}

/**
 * A floor seat of the majlis under each player: a sadu mattress, a backrest behind him (when he
 * faces the fire) and a small armrest cushion on each side.
 */
function majlisSeat(g: CanvasRenderingContext2D, sl: Slot, id: string) {
  const s = sl.s, w = Math.round(30 * s), h = Math.max(3, Math.round(5 * s)), x0 = Math.round(sl.x - w / 2), y0 = Math.round(sl.y - h + 2)
  const hue = ['#8a2232', '#6e2a4a', '#2a4a6e', '#7a4a1a'][(parseInt(id.slice(1)) || 0) % 4]
  if (sl.view === 'front') {
    // Backrest (مسند) behind the back, peeking out above the shoulders' sides.
    const bh = Math.round(13 * s), bw = Math.round(26 * s), bx = Math.round(sl.x - bw / 2), by = Math.round(sl.y - SH * s * .62)
    g.fillStyle = '#0a0605'; g.fillRect(bx - 1, by - 1, bw + 2, bh + 2)
    g.fillStyle = hue; g.fillRect(bx, by, bw, bh)
    g.fillStyle = '#efe2c6'; for (let x = bx + 1; x < bx + bw - 1; x += 3) g.fillRect(x, by + 2, 1, 1)
    g.fillStyle = '#e8b84a'; g.fillRect(bx, by, bw, 1)
  }
  g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x0 - 1, sl.y + 2, w + 2, 2)
  g.fillStyle = '#0a0605'; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2)
  g.fillStyle = hue; g.fillRect(x0, y0, w, h)
  g.fillStyle = '#e8b84a'; g.fillRect(x0, y0, w, 1)
  g.fillStyle = '#efe2c6'; for (let x = x0 + 2; x < x0 + w - 1; x += 4) g.fillRect(x, y0 + Math.min(h - 1, 2), 2, 1)
  // Armrests (مركى) on both sides.
  const aw = Math.max(3, Math.round(5 * s)), ah = Math.max(4, Math.round(7 * s))
  for (const ax of [x0 - aw + 2, x0 + w - 2]) {
    g.fillStyle = '#0a0605'; g.fillRect(ax - 1, y0 - ah + 2, aw + 2, ah + 1)
    g.fillStyle = '#5a1a24'; g.fillRect(ax, y0 - ah + 3, aw, ah - 1)
    g.fillStyle = '#e8b84a'; g.fillRect(ax, y0 - ah + 3, aw, 1)
  }
}

export class Camp {
  readonly el: HTMLElement
  private cv: HTMLCanvasElement
  private g: CanvasRenderingContext2D
  private world = canvas()
  private skyNight = buildSky()
  private skyDay = buildSky(true)
  private ground: HTMLCanvasElement
  private fall = new Float32Array(W * H)
  private stars = Array.from({length: 46}, () => ({x: Math.floor(rnd() * W), y: Math.floor(rnd() * 52), p: rnd() * 9, s: .6 + rnd() * 2}))
  private sparks: Spark[] = []
  private buttons = new Map<string, HTMLButtonElement>()
  private seats: CampSeat[] = []
  private slots = new Map<string, Slot>()
  private stamp: HTMLElement
  private active = true
  private lastDraw = 0
  private flash: {t0: number; col: string} | null = null
  mood: Mood = 'night'
  cat = ''
  calm = false

  constructor(host: HTMLElement, theme: Theme, private onSeat?: (id: string) => void) {
    this.ground = buildGround(theme)
    this.el = document.createElement('div')
    this.el.className = 'stage camp'
    this.el.innerHTML = `<div class="world"><canvas width="${W}" height="${H}" aria-label="المجلس حول النار"></canvas><div class="seats"></div></div><div class="stamp"></div>`
    host.appendChild(this.el)
    this.cv = this.el.querySelector('canvas')!
    this.g = this.cv.getContext('2d')!
    this.g.imageSmoothingEnabled = false
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - FX, (y - FY + 4) * 1.35)
      this.fall[y * W + x] = Math.max(0, 1 - d / 215) ** 1.4
    }
    this.stamp = this.el.querySelector('.stamp')!
    const loop = (now: number) => {
      requestAnimationFrame(loop)
      if (!this.active || document.hidden || now - this.lastDraw < 1000 / FPS) return
      this.lastDraw = now
      this.draw(now / 1000)
    }
    requestAnimationFrame(loop)
  }

  setActive(on: boolean) { this.active = on }
  showStamp(text: string, kind: 'win' | 'out') { this.stamp.className = `stamp on ${kind}`; this.stamp.textContent = text }
  hideStamp() { this.stamp.className = 'stamp' }

  /** A burst on a seat: red for a death, gold for a reveal, white for a flash of the whole scene. */
  burst(id: string, kind: 'death' | 'reveal' | 'flash') {
    const sl = this.slots.get(id)
    if (kind === 'flash' || !sl) { this.flash = {t0: performance.now() / 1000, col: 'rgba(255,240,200,.5)'}; return }
    if (this.calm) return
    const top = sl.y - SH * sl.s
    const cols = kind === 'death' ? ['#ff6a5a', '#b8343e', '#2a0a0a'] : ['#ffe08a', '#e8b84a', '#fff4c2']
    for (let i = 0; i < 22; i++) this.sparks.push({x: sl.x, y: top + 10, vx: (rnd() - .5) * 60, vy: -10 - rnd() * 40, life: .5 + rnd() * .6, col: cols[i % 3]})
    if (kind === 'death') { this.el.classList.add('shake'); window.setTimeout(() => this.el.classList.remove('shake'), 420) }
  }

  update(seats: CampSeat[], viewer: string) {
    const ids = seats.map(s => s.id).join()
    const relayout = ids !== this.seats.map(s => s.id).join() || viewer !== this.viewer
    this.seats = seats
    this.viewer = viewer
    if (relayout) this.layout()
    for (const s of seats) {
      const b = this.buttons.get(s.id)!
      b.style.setProperty('--c', s.color || CHARACTERS[s.char]?.color || '#e8b84a')
      b.classList.toggle('empty', !s.present)
      b.classList.toggle('turn', s.turn)
      b.classList.toggle('me', s.me)
      b.classList.toggle('out', !s.alive)
      b.classList.toggle('dim', Boolean(s.dim))
      b.classList.toggle('has-cta', Boolean(s.cta))
      b.disabled = !s.cta
      b.querySelector('.cta')!.innerHTML = s.cta
      b.querySelector('.nm')!.textContent = s.me ? 'أنت' : s.name
      b.querySelector('.tt')!.textContent = s.tag
      b.querySelector<HTMLElement>('.bd')!.innerHTML = s.badges
      b.setAttribute('aria-label', `${s.name}${s.tag ? ` — ${s.tag}` : ''}`)
    }
  }
  private viewer = ''

  private layout() {
    const wrap = this.el.querySelector<HTMLElement>('.seats')!
    const n = this.seats.length, me = Math.max(0, this.seats.findIndex(s => s.id === this.viewer))
    for (const [id, b] of this.buttons) if (!this.seats.some(s => s.id === id)) { b.remove(); this.buttons.delete(id) }
    this.slots.clear()
    this.seats.forEach((s, i) => {
      let b = this.buttons.get(s.id)
      if (!b) {
        b = document.createElement('button')
        b.type = 'button'
        b.className = 'seat'
        b.innerHTML = `<span class="plate"><b class="nm"></b><span class="bd"></span><small class="tt"></small><span class="cta"></span></span>`
        b.addEventListener('click', () => this.onSeat?.(s.id))
        wrap.appendChild(b)
        this.buttons.set(s.id, b)
      }
      const k = (i - me + n) % n, sl = ring(k, n)
      this.slots.set(s.id, sl)
      b.classList.toggle('front', k === 0 && this.viewer === s.id)
      b.classList.toggle('back', sl.view === 'back' && k !== 0)
      const w = SW * sl.s * 1.3, h = SH * sl.s * 1.15
      b.style.left = `${(sl.x - w / 2) / W * 100}%`
      b.style.top = `${(sl.y - h) / H * 100}%`
      b.style.width = `${w / W * 100}%`
      b.style.height = `${h / H * 100}%`
      b.style.zIndex = String(sl.y)
    })
  }

  private draw(t: number) {
    const g = this.g, w = this.world.g
    w.clearRect(0, 0, W, H)
    w.drawImage(this.ground, 0, 0)
    const order = [...this.seats].sort((a, b) => (this.slots.get(a.id)?.y || 0) - (this.slots.get(b.id)?.y || 0))
    for (const s of order) {
      const sl = this.slots.get(s.id)
      if (!sl) continue
      const sw = Math.round(SW * sl.s), sh = Math.round(SH * sl.s), x0 = Math.round(sl.x - sw / 2), y0 = Math.round(sl.y - sh)
      majlisSeat(w, sl, s.id)
      if (s.turn && s.alive) { w.fillStyle = CHARACTERS[s.char]?.color || '#e8b84a'; w.fillRect(x0 - 3, sl.y - 2, sw + 6, 3) }
      if (!s.alive) {
        const drop = Math.round(sh * .12)
        this.outlined(w, sprite(s.char, sl.view, 1, true), silhouette(s.char, sl.view, 1, true), x0, y0 + drop, sw, sh - drop)
      } else {
        const frame = (this.calm ? 0 : Math.floor(t * 1.1 + this.seats.indexOf(s) * .7) % 2) as 0 | 1
        this.outlined(w, sprite(s.char, sl.view, frame), silhouette(s.char, sl.view, frame), x0, y0, sw, sh)
      }
      if (this.cat === s.id) this.blackCat(w, x0 + sw + 1, sl.y - 1, t)
    }
    this.light(t)
    g.drawImage(this.mood === 'day' ? this.skyDay : this.skyNight, 0, 0)
    if (this.mood !== 'day') for (const st of this.stars) if (this.calm || Math.sin(t * st.s + st.p) > -.4) { g.fillStyle = st.s > 2 ? '#fff6d8' : '#a99cc0'; g.fillRect(st.x, st.y, 1, 1) }
    g.drawImage(this.world.c, 0, 0)
    this.fire(t)
    this.effects(t)
  }

  /** Small black cat with yellow eyes sitting beside a player. Base at (x, y). */
  private blackCat(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
    const px = (dx: number, dy: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h) }
    px(0, -7, 5, 7, '#0a0808'); px(1, -10, 4, 4, '#0a0808'); px(1, -11, 1, 1, '#0a0808'); px(4, -11, 1, 1, '#0a0808')
    px(-2, -3 - (Math.floor(t * 2) % 2), 2, 1, '#0a0808'); px(-3, -4 - (Math.floor(t * 2) % 2), 1, 2, '#0a0808')
    if (Math.floor(t * .7) % 5) { px(2, -9, 1, 1, '#ffd23a'); px(4, -9, 1, 1, '#ffd23a') }
  }

  private light(t: number) {
    const img = this.world.g.getImageData(0, 0, W, H), d = img.data
    const day = this.mood === 'day', dark = this.mood === 'dark'
    const flick = this.calm ? 1 : .9 + .07 * Math.sin(t * 11) + .05 * Math.sin(t * 23 + 1)
    const base = day ? .62 : dark ? .16 : .26, gain = day ? .45 : dark ? .8 : .95
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = i * 4
      if (d[p + 3] === 0) continue
      const f = this.fall[i]
      const L = Math.floor((base + flick * f * gain) * 8 + .25 + dither(x, y) * .5) / 8
      d[p] = Math.min(255, d[p] * L * (day ? 1.12 : 1.32))
      d[p + 1] = Math.min(255, d[p + 1] * L * (day ? 1.02 : 1))
      d[p + 2] = Math.min(255, d[p + 2] * (L * (day ? .95 : dark ? .8 : .72) + .09))
    }
    this.world.g.putImageData(img, 0, 0)
  }

  private fire(t: number) {
    const g = this.g, small = this.mood === 'dark' ? .55 : this.mood === 'day' ? .7 : 1
    g.save(); g.globalCompositeOperation = 'lighter'
    const glow = g.createRadialGradient(FX, FY - 6, 2, FX, FY - 6, 46 * small)
    glow.addColorStop(0, 'rgba(255,140,50,.36)'); glow.addColorStop(1, 'rgba(255,100,30,0)')
    g.fillStyle = glow; g.fillRect(FX - 50, FY - 56, 100, 100); g.restore()
    g.fillStyle = '#ff8a3a'; g.fillRect(FX - 9, FY - 2, 18, 1)
    for (let dx = -9; dx <= 9; dx++) {
      const b = (13 - Math.abs(dx) * 1.35) * small
      if (b <= 0) continue
      const h = Math.max(1, Math.round(b * (.7 + .5 * wave(t * (this.calm ? 2 : 9) + dx * 1.7))))
      for (let j = 0; j < h; j++) { const r = j / h; g.fillStyle = r < .3 ? '#fff4c2' : r < .6 ? '#ffc247' : r < .85 ? '#f0682a' : '#9c2a1c'; g.fillRect(FX + dx, FY - 3 - j, 1, 1) }
    }
    if (!this.calm && rnd() < .6 * small) this.sparks.push({x: FX + (rnd() - .5) * 10, y: FY - 12, vx: (rnd() - .5) * 8, vy: -14 - rnd() * 16, life: .8 + rnd() * .8, col: rnd() < .5 ? '#ffb43a' : '#ffe08a'})
  }

  private effects(t: number) {
    const g = this.g, dt = 1 / FPS
    this.sparks = this.sparks.filter(p => (p.life -= dt) > 0)
    for (const p of this.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1) }
    const bob = this.calm ? 0 : Math.round(Math.sin(t * 5))
    for (const s of this.seats) {
      const sl = this.slots.get(s.id)
      if (!sl) continue
      const top = Math.round(sl.y - SH * sl.s)
      if (s.turn && s.alive) { g.fillStyle = CHARACTERS[s.char]?.color || '#e8b84a';[1, 3, 5, 3, 1].forEach((w, j) => g.fillRect(sl.x - (w >> 1), top - 8 + bob + j, w, 1)) }
    }
    if (this.flash && t - this.flash.t0 < .1 && !this.calm) { g.fillStyle = this.flash.col; g.fillRect(0, 0, W, H) }
  }

  private outlined(g: CanvasRenderingContext2D, spr: HTMLCanvasElement, sil: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(sil, x + ox, y + oy, w, h)
    g.drawImage(spr, x, y, w, h)
  }
}
