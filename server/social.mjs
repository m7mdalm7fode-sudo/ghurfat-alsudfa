// Shared room plumbing for the table games with hidden roles («الذيابة» and «القطوة السوداء»):
// seats and resume tokens, a host who starts the game from the lobby, chat, a public event log,
// and a per-player view (each socket only ever receives what that player is allowed to know).
import {randomBytes} from 'node:crypto'
import {WebSocket} from 'ws'

export const MARKER = 'chamber6-v3'
const RECONNECT_MS = 90000, MAX_SPECTATORS = 8, CHAT_GAP_MS = 600
export const token = () => randomBytes(18).toString('base64url')
export const isOpen = s => s?.socket?.readyState === WebSocket.OPEN
export const pick = a => a[Math.floor(Math.random() * a.length)]
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export function sendTo(ws, p) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)) }
const cleanText = v => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 140)

export class SocialRoom {
  constructor(id, {game, maxSeats, minPlayers}) {
    this.id = id; this.game = game; this.min = minPlayers; this.last = Date.now(); this.seq = 0; this.eventId = 0
    this.seatIds = Array.from({length: maxSeats}, (_, i) => `p${i + 1}`)
    this.seats = Object.fromEntries(this.seatIds.map(s => [s, this.emptySeat()]))
    this.watchers = new Set(); this.phase = 'lobby'; this.ends = 0; this.log = []; this.notice = ''
  }
  emptySeat() { return {token: '', socket: null, disconnectedAt: 0, name: '', inGame: false, alive: false, lastChat: 0} }
  connected() { return this.seatIds.filter(s => isOpen(this.seats[s])) }
  players() { return this.seatIds.filter(s => this.seats[s].inGame) }
  living() { return this.players().filter(s => this.seats[s].alive) }
  host() { return this.connected()[0] || '' }
  name(s) { return this.seats[s]?.name || '' }

  claim(ws, resume, name) {
    let role = 'spectator'
    for (const s of this.seatIds) {
      const x = this.seats[s]
      if (resume && x.token === resume) { role = s; x.socket = ws; x.disconnectedAt = 0; if (name) x.name = name; break }
    }
    if (role === 'spectator') {
      const free = this.seatIds.find(s => !this.seats[s].token)
      if (free) { role = free; const x = this.seats[free]; Object.assign(x, this.emptySeat(), {token: token(), socket: ws, name: name || `ضيف ${this.seatIds.indexOf(free) + 1}`}) }
      else { if (this.watchers.size >= MAX_SPECTATORS) { ws.close(1013); return } this.watchers.add(ws) }
    }
    ws.room = this; ws.role = role; this.last = Date.now()
    sendTo(ws, {type: 'welcome', marker: MARKER, room: this.id, game: this.game, role, resume_token: role === 'spectator' ? '' : this.seats[role].token})
    if (role !== 'spectator') this.event(`${this.name(role)} ${this.phase === 'lobby' ? 'جلس في المجلس' : 'دخل المجلس'}`, 'join')
    this.broadcast()
  }

  release(ws) {
    const s = ws.role && this.seats[ws.role]
    if (s && s.socket === ws) { s.socket = null; s.disconnectedAt = Date.now(); this.event(`${s.name} غادر المجلس`, 'leave') }
    else this.watchers.delete(ws)
    this.broadcast()
  }

  message(ws, m) {
    const seat = ws.role
    if (seat === 'spectator' || !this.seats[seat]) return
    this.last = Date.now()
    if (m.type === 'start') {
      if (this.phase !== 'lobby') return this.err(seat, 'not_ready')
      if (seat !== this.host()) return this.err(seat, 'not_host')
      if (this.connected().length < this.min) return this.err(seat, 'need_players')
      for (const s of this.seatIds) { const x = this.seats[s]; x.inGame = isOpen(x); x.alive = x.inGame }
      this.start(); this.broadcast(); return
    }
    if (m.type === 'chat') return this.chat(seat, cleanText(m.text))
    if (m.type === 'act') { this.act(seat, m); this.broadcast() }
  }

  /** Who may read a chat line from `seat` right now (overridden for team/night chat). */
  chatAudience(seat) { const x = this.seats[seat]; if (this.phase === 'lobby' || this.phase === 'over' || !x.inGame) return {to: null, scope: 'all'}; return x.alive ? {to: null, scope: 'all'} : {to: this.players().filter(s => !this.seats[s].alive), scope: 'dead'} }
  chat(seat, text) {
    const x = this.seats[seat], now = Date.now()
    if (!text || now - x.lastChat < CHAT_GAP_MS) return
    const a = this.chatAudience(seat)
    if (!a) return this.err(seat, 'quiet')
    x.lastChat = now
    const p = {type: 'chat', marker: MARKER, room: this.id, from: seat, name: x.name, text, scope: a.scope}
    const to = a.to ? new Set([...a.to, seat]) : null
    for (const s of this.seatIds) if (isOpen(this.seats[s]) && (!to || to.has(s))) sendTo(this.seats[s].socket, p)
    if (!to) for (const w of this.watchers) sendTo(w, p)
  }

  event(text, kind = 'info', to = null) { this.log.push({id: ++this.eventId, text, kind, to}); if (this.log.length > 60) this.log.shift() }
  err(seat, code) { sendTo(this.seats[seat]?.socket, {type: 'error', marker: MARKER, room: this.id, code}) }
  setPhase(phase, ms, notice = '') { this.phase = phase; this.ends = ms ? Date.now() + ms : 0; if (notice) this.notice = notice }

  view(seat) {
    const seats = {}
    for (const s of this.seatIds) {
      const x = this.seats[s]
      if (!x.token) continue
      seats[s] = {name: x.name, connected: isOpen(x), inGame: x.inGame, alive: x.alive, ...this.publicSeat(s, seat)}
    }
    const log = this.log.filter(e => !e.to || (seat && e.to.includes(seat))).slice(-30).map(({id, text, kind}) => ({id, text, kind}))
    return {type: 'state', marker: MARKER, room: this.id, game: this.game, seq: ++this.seq, phase: this.phase, ends_in: this.ends ? Math.max(0, this.ends - Date.now()) : 0,
      host: this.host(), min: this.min, max: this.seatIds.length, notice: this.notice, seats, log, ...this.publicView(seat), mine: seat ? this.privateView(seat) : null}
  }
  broadcast() {
    for (const s of this.seatIds) if (isOpen(this.seats[s])) sendTo(this.seats[s].socket, this.view(s))
    if (this.watchers.size) { const v = this.view(null); for (const w of this.watchers) sendTo(w, v) }
  }

  tick() {
    const now = Date.now()
    for (const s of this.seatIds) {
      const x = this.seats[s]
      if (x.token && x.disconnectedAt && now - x.disconnectedAt > RECONNECT_MS && !(x.inGame && x.alive && this.phase !== 'lobby' && this.phase !== 'over')) { Object.assign(x, this.emptySeat()); this.broadcast() }
    }
    if (this.phase !== 'lobby' && this.ends && now >= this.ends) { this.ends = 0; this.timeout(); this.broadcast() }
    // Everyone left mid-game: back to the lobby.
    if (this.phase !== 'lobby' && !this.connected().length) this.toLobby()
  }
  toLobby() { for (const s of this.seatIds) { this.seats[s].inGame = false; this.seats[s].alive = false } this.setPhase('lobby', 0, 'بانتظار المضيف ليبدأ'); this.reset?.() }

  // ---- overridden by each game ----
  start() {}
  act() {}
  timeout() {}
  publicSeat() { return {} }
  publicView() { return {} }
  privateView() { return {} }
}
