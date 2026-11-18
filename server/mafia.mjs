// «المافيا»: hidden roles around the fire. At night the mafia choose a victim, the doctor protects
// someone and the detective questions someone; by day everyone talks and votes one player out.
import {SocialRoom, pick, shuffle} from './social.mjs'

const K = Number(process.env.SOCIAL_SPEED || 1)
const T = Object.fromEntries(Object.entries({night: 45000, dawn: 7000, day: 120000, vote: 45000, verdict: 7000, over: 25000}).map(([k, v]) => [k, v * K]))
export const ROLE_NAME = {mafia: 'مافيا', doctor: 'الطبيب', detective: 'المحقق', citizen: 'مواطن'}

export function rolesFor(n) {
  const mafia = n <= 5 ? 1 : n <= 8 ? 2 : 3
  const list = [...Array(mafia).fill('mafia'), 'detective']
  if (n >= 5) list.push('doctor')
  while (list.length < n) list.push('citizen')
  return shuffle(list)
}

export class MafiaRoom extends SocialRoom {
  constructor(id) { super(id, {game: 'mafia', maxSeats: 10, minPlayers: 4}); this.reset() }
  reset() { this.role = {}; this.night = 0; this.kills = {}; this.save = ''; this.check = ''; this.checks = {}; this.ready = new Set(); this.votes = {}; this.winner = ''; this.lastSave = ''; this.counts = null }

  start() {
    this.reset()
    const ps = this.players(), roles = rolesFor(ps.length)
    ps.forEach((s, i) => { this.role[s] = roles[i]; this.checks[s] = [] })
    this.counts = {mafia: roles.filter(r => r === 'mafia').length, doctor: roles.includes('doctor') ? 1 : 0, detective: 1, citizen: roles.filter(r => r === 'citizen').length}
    this.log = []
    this.event(`بدأت اللعبة: ${ps.length} لاعبين، بينهم ${this.counts.mafia} مافيا`, 'start')
    this.toNight()
  }
  alive(role) { return this.living().filter(s => this.role[s] === role) }
  toNight() {
    this.night++; this.kills = {}; this.save = ''; this.check = ''
    this.setPhase('night', T.night, `الليلة ${this.night}: المدينة نائمة… المافيا تختار، والطبيب يحمي، والمحقق يحقق`)
    this.event(`🌙 الليلة ${this.night}`, 'night')
  }
  /** Night ends early once every living mafia, doctor and detective has chosen. */
  nightDone() {
    return this.alive('mafia').every(s => this.kills[s]) && (!this.alive('doctor').length || this.save) && (!this.alive('detective').length || this.check)
  }
  act(seat, m) {
    const me = this.seats[seat], r = this.role[seat], t = m.target, target = this.seats[t]
    if (!me.inGame || !me.alive) return this.err(seat, 'not_ready')
    const living = target && target.inGame && target.alive
    if (this.phase === 'night') {
      if (m.kind === 'kill' && r === 'mafia') { if (!living || this.role[t] === 'mafia') return this.err(seat, 'invalid_target'); this.kills[seat] = t }
      else if (m.kind === 'save' && r === 'doctor') { if (!living) return this.err(seat, 'invalid_target'); if (t === this.lastSave) return this.err(seat, 'same_save'); this.save = t }
      else if (m.kind === 'check' && r === 'detective') {
        if (this.check) return this.err(seat, 'already')
        if (!living || t === seat) return this.err(seat, 'invalid_target')
        this.check = t; const bad = this.role[t] === 'mafia'; this.checks[seat].push({seat: t, mafia: bad})
        this.event(`🔎 تحقيقك: ${this.name(t)} ${bad ? 'من المافيا!' : 'ليس من المافيا'}`, bad ? 'bad' : 'good', [seat])
      } else return this.err(seat, 'invalid_message')
      if (this.nightDone()) this.resolveNight()
    } else if (this.phase === 'day' && m.kind === 'ready') {
      if (this.ready.has(seat)) this.ready.delete(seat); else this.ready.add(seat)
      if (this.living().every(s => this.ready.has(s))) this.toVote()
    } else if (this.phase === 'vote' && m.kind === 'vote') {
      if (t !== 'skip' && (!living || t === seat)) return this.err(seat, 'invalid_target')
      this.votes[seat] = t
      if (this.living().every(s => this.votes[s])) this.resolveVote()
    } else this.err(seat, 'not_ready')
  }
  resolveNight() {
    const tally = {}
    for (const t of Object.values(this.kills)) tally[t] = (tally[t] || 0) + 1
    const best = Math.max(0, ...Object.values(tally)), top = Object.keys(tally).filter(t => tally[t] === best)
    const victim = top.length ? pick(top) : ''
    this.lastSave = this.save
    if (!victim) { this.notice = 'مرّت الليلة بسلام… لم تختر المافيا أحدًا'; this.event('☀️ لم يمت أحد الليلة', 'safe') }
    else if (victim === this.save) { this.notice = `حاولت المافيا قتل أحدهم… لكن الطبيب أنقذه!`; this.event('☀️ الطبيب أنقذ ضحية المافيا — لم يمت أحد', 'safe') }
    else { this.seats[victim].alive = false; this.notice = `وُجد ${this.name(victim)} مقتولًا عند الفجر — كان ${ROLE_NAME[this.role[victim]]}`; this.event(`💀 قُتل ${this.name(victim)} (${ROLE_NAME[this.role[victim]]})`, 'death') }
    this.setPhase('dawn', T.dawn)
  }
  toDay() { this.ready = new Set(); this.setPhase('day', T.day, 'النهار: تناقشوا… من تشكّون فيه؟ اضغطوا «جاهز للتصويت» متى ما انتهيتم'); this.event('☀️ النهار — نقاش', 'day') }
  toVote() { this.votes = {}; this.setPhase('vote', T.vote, 'التصويت: اختر من تطرده من المجلس، أو امتنع'); this.event('🗳️ بدأ التصويت', 'vote') }
  resolveVote() {
    const tally = {}
    for (const s of this.living()) { const t = this.votes[s] || 'skip'; tally[t] = (tally[t] || 0) + 1 }
    const best = Math.max(...Object.values(tally)), top = Object.keys(tally).filter(t => tally[t] === best)
    if (top.length !== 1 || top[0] === 'skip') { this.notice = top.length !== 1 ? 'تعادلت الأصوات — لم يُطرد أحد' : 'أغلب المجلس امتنع — لم يُطرد أحد'; this.event(`⚖️ ${this.notice}`, 'safe') }
    else { const out = top[0]; this.seats[out].alive = false; this.notice = `طرد المجلس ${this.name(out)} بـ${best} أصوات — كان ${ROLE_NAME[this.role[out]]}`; this.event(`🚪 طُرد ${this.name(out)} (${ROLE_NAME[this.role[out]]})`, this.role[out] === 'mafia' ? 'good' : 'death') }
    this.setPhase('verdict', T.verdict)
  }
  checkWin() {
    const m = this.alive('mafia').length, rest = this.living().length - m
    if (!m) this.winner = 'town'; else if (m >= rest) this.winner = 'mafia'
    if (!this.winner) return false
    this.notice = this.winner === 'town' ? 'انتصر أهل المدينة! كُشفت المافيا كلها' : 'انتصرت المافيا! سيطروا على المجلس'
    this.event(this.winner === 'town' ? '🏆 فاز أهل المدينة' : '🏆 فازت المافيا', 'win')
    this.setPhase('over', T.over); return true
  }
  timeout() {
    if (this.phase === 'night') this.resolveNight()
    else if (this.phase === 'dawn') { if (!this.checkWin()) this.toDay() }
    else if (this.phase === 'day') this.toVote()
    else if (this.phase === 'vote') this.resolveVote()
    else if (this.phase === 'verdict') { if (!this.checkWin()) this.toNight() }
    else if (this.phase === 'over') this.toLobby()
  }
  chatAudience(seat) {
    const x = this.seats[seat]
    if (this.phase === 'night' && x.inGame && x.alive) return this.role[seat] === 'mafia' ? {to: this.players().filter(s => this.role[s] === 'mafia'), scope: 'team'} : null
    return super.chatAudience(seat)
  }
  publicSeat(s, viewer) {
    const x = this.seats[s], over = this.phase === 'over'
    const team = viewer && this.role[viewer] === 'mafia' && this.role[s] === 'mafia'
    return {
      role: x.inGame && (over || !x.alive || s === viewer || team) ? this.role[s] || '' : '',
      ready: this.phase === 'day' && this.ready.has(s),
      vote: this.phase === 'vote' || this.phase === 'verdict' ? this.votes[s] || '' : '',
    }
  }
  publicView() { return {night: this.night, winner: this.winner, counts: this.counts} }
  privateView(seat) {
    const r = this.role[seat] || ''
    return {role: r, kill: r === 'mafia' ? this.kills : null, save: r === 'doctor' ? this.save : '', last_save: r === 'doctor' ? this.lastSave : '', check: r === 'detective' ? this.check : '', checks: this.checks[seat] || []}
  }
}
