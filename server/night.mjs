// «القطوة السوداء»: an online adaptation of the booklet's rules with our own cards and characters.
// Hidden trial cards decide the teams (مسالم / خائن / الشايب). On your turn you draw two cards or
// play cards; seven accusations reveal a trial card. Black cards stop everything: «المؤامرة» passes
// trial cards to the left, «الليل» lets the traitors assassinate. Villagers win when every «خائن»
// card is revealed; traitors win when no peaceful player is left alive.
import {SocialRoom, pick, shuffle} from './social.mjs'

const K = Number(process.env.SOCIAL_SPEED || 1)
const T = Object.fromEntries(Object.entries({dawn: 35000, turn: 50000, kill: 35000, confess: 25000, reveal: 8000, choose: 20000, conspiracy: 7000, over: 30000}).map(([k, v]) => [k, v * K]))
/** Trial cards per player count (from the booklet's table): peaceful, traitor, old man, cards each. */
const TRIAL = {4: [18, 1, 1, 5], 5: [23, 1, 1, 5], 6: [27, 1, 1, 5], 7: [32, 2, 1, 5], 8: [29, 2, 1, 4], 9: [33, 2, 1, 4], 10: [27, 2, 1, 3], 11: [30, 2, 1, 3], 12: [33, 2, 1, 3]}
/** Play cards. colour: green = instant, blue = stays in front of the target, red = accusation. */
export const CARDS = {
  accuse: {name: 'اتهام', color: 'red', n: 30},
  steal: {name: 'سرقة', color: 'green', n: 4},
  peek: {name: 'تحرّي', color: 'green', n: 4},
  help: {name: 'فزعة', color: 'green', n: 4},
  camel: {name: 'ناقة', color: 'green', n: 3, two: true},
  pardon: {name: 'إعفاء', color: 'green', n: 4},
  fort: {name: 'حصن', color: 'blue', n: 3},
  bond: {name: 'ارتباط', color: 'blue', n: 2},
  wind: {name: 'ريح شوي', color: 'blue', n: 3},
  weapon: {name: 'سلاح', color: 'blue', n: 2},
}
/** Character abilities (one per player, dealt at random, shown to everyone). */
export const CHARS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12']
const ACCUSE_LIMIT = c => c === 'p2' ? 9 : 7

let uid = 0
const card = kind => ({id: ++uid, kind})

export class NightRoom extends SocialRoom {
  constructor(id) { super(id, {game: 'night', maxSeats: 12, minPlayers: 4}); this.reset() }
  reset() {
    this.trial = {}; this.traitor = new Set(); this.char = {}; this.hand = {}; this.front = {}; this.accused = {}; this.used = {}
    this.deck = []; this.burn = []; this.turn = ''; this.toDraw = 0; this.played = false; this.cat = ''; this.winner = ''
    this.catVotes = {}; this.killVotes = {}; this.guard = ''; this.guardBy = {}; this.confess = {}; this.pending = null; this.nightNo = 0; this.saved = {}; this.peeks = {}; this.lastNight = null; this.resume = null; this.victim = ''
  }

  // ---------- setup ----------
  start() {
    this.reset(); this.log = []
    const ps = this.players(), n = Math.min(12, Math.max(4, ps.length)), [ok, bad, old, each] = TRIAL[n]
    const pile = shuffle([...Array(ok).fill('ok'), ...Array(bad).fill('traitor'), ...Array(old).fill('old')].map(k => ({id: ++uid, kind: k, open: false})))
    const chars = shuffle([...CHARS])
    ps.forEach((s, i) => {
      this.trial[s] = pile.slice(i * each, i * each + each); this.char[s] = chars[i]
      this.front[s] = []; this.accused[s] = 0; this.used[s] = false; this.peeks[s] = []
    })
    this.updateTeams()
    const deck = []
    for (const [k, c] of Object.entries(CARDS)) for (let i = 0; i < c.n; i++) deck.push(card(k))
    shuffle(deck)
    for (const s of ps) this.hand[s] = deck.splice(0, this.char[s] === 'p11' ? 5 : 3)
    deck.push(card('plot')); shuffle(deck); deck.push(card('night'))
    // Local testing only: bring the black cards near the top of the deck.
    if (process.env.NIGHT_EARLY) { const nt = deck.pop(), pi = deck.findIndex(c => c.kind === 'plot'), pl = deck.splice(pi, 1)[0]; deck.splice(2, 0, pl); deck.splice(5, 0, nt) }
    this.deck = deck
    this.event(`بدأت اللعبة: ${ps.length} لاعبين، بينهم ${bad} ${bad > 1 ? 'خونة' : 'خائن'}`, 'start')
    this.setPhase('dawn', T.dawn, 'الفجر: الخونة يتعارفون ويضعون القطة السوداء أمام أحد اللاعبين…')
    this.event('🌅 الفجر — الخونة يتعارفون', 'night')
  }
  hidden(s) { return this.trial[s].filter(c => !c.open) }
  /** Anyone who has ever held a «خائن» card stays a traitor for the rest of the game. */
  updateTeams() { for (const s of this.players()) if (this.trial[s].some(c => c.kind === 'traitor')) this.traitor.add(s) }
  oldMan() { return this.living().find(s => this.hidden(s).some(c => c.kind === 'old')) || '' }
  traitors() { return this.living().filter(s => this.traitor.has(s)) }
  has(s, kind) { return this.front[s].some(c => c.kind === kind) }

  // ---------- turns ----------
  beginTurn(s) {
    this.turn = s; this.played = false; this.toDraw = 0
    if (this.has(s, 'wind')) {
      this.front[s] = this.front[s].filter(c => { if (c.kind === 'wind') { this.burn.push(c); return false } return true })
      this.event(`🌬️ ${this.name(s)} عليه «ريح شوي» — خسر دوره`, 'skip')
      return this.beginTurn(this.after(s))
    }
    this.setPhase('turn', T.turn, `دور ${this.name(s)}: يسحب ورقتين أو يلعب من يده`)
  }
  after(s) {
    const ps = this.players(), i = ps.indexOf(s)
    for (let k = 1; k <= ps.length; k++) { const n = ps[(i + k) % ps.length]; if (this.seats[n].alive) return n }
    return s
  }
  endTurn() { if (!this.winner) this.beginTurn(this.after(this.turn)) }

  /** Draws the remaining cards of this turn; a black card interrupts and the turn resumes after it. */
  drawOn() {
    const s = this.turn
    while (this.toDraw > 0 && this.phase === 'turn') {
      if (!this.deck.length) this.reshuffle()
      const c = this.deck.shift()
      this.toDraw--
      if (c.kind === 'plot') { this.burn.push(c); return this.conspiracy() }
      if (c.kind === 'night') { this.burn.push(c); return this.startNight() }
      this.hand[s].push(c)
    }
    if (this.phase === 'turn' && this.toDraw === 0) this.endTurn()
  }
  reshuffle() { this.deck = shuffle(this.burn.filter(c => c.kind !== 'night')); const night = this.burn.find(c => c.kind === 'night') || card('night'); this.burn = []; this.deck.push(night) }

  act(seat, m) {
    const me = this.seats[seat]
    if (!me.inGame || !me.alive) return this.err(seat, 'not_ready')
    const t = m.target, tx = this.seats[t], living = tx && tx.inGame && tx.alive
    switch (this.phase) {
      case 'dawn':
        if (m.kind !== 'cat' || !this.traitor.has(seat) || !living) return this.err(seat, 'invalid_target')
        this.catVotes[seat] = t
        if (this.traitors().every(s => this.catVotes[s])) this.placeCat()
        return
      case 'kill':
        if (m.kind === 'kill' && this.traitor.has(seat)) { if (!living) return this.err(seat, 'invalid_target'); this.killVotes[seat] = t }
        else if (m.kind === 'guard' && (seat === this.oldMan() || (this.char[seat] === 'p12' && !this.used[seat]))) {
          if (!living || t === seat) return this.err(seat, 'invalid_target')
          this.guardBy[seat] = t
        } else return this.err(seat, 'invalid_message')
        if (this.killDone()) this.toConfess()
        return
      case 'confess': {
        if (m.kind !== 'confess' || this.exempt(seat)) return this.err(seat, 'invalid_message')
        if (m.card === 'risk') this.confess[seat] = 'risk'
        else { const c = this.hidden(seat).find(c => c.id === Number(m.card)); if (!c) return this.err(seat, 'invalid_target'); this.confess[seat] = c.id }
        if (this.living().filter(s => !this.exempt(s)).every(s => this.confess[s])) this.resolveNight()
        return
      }
      case 'choose': {
        if (m.kind !== 'reveal' || !this.pending || this.pending.who !== seat) return this.err(seat, 'not_ready')
        const c = this.hidden(seat).find(c => c.id === Number(m.card)); if (!c) return this.err(seat, 'invalid_target')
        return this.finishChoice(c)
      }
      case 'turn': return this.turnAct(seat, m)
    }
    this.err(seat, 'not_ready')
  }

  turnAct(seat, m) {
    if (seat !== this.turn) return this.err(seat, 'not_your_turn')
    if (m.kind === 'draw') {
      if (this.played || this.toDraw) return this.err(seat, 'invalid_message')
      this.toDraw = this.char[seat] === 'p3' ? 3 : 2
      this.event(`🃏 ${this.name(seat)} سحب ${this.toDraw === 3 ? 'ثلاث أوراق' : 'ورقتين'}`, 'draw')
      return this.drawOn()
    }
    if (m.kind === 'end') { if (!this.played) return this.err(seat, 'invalid_message'); return this.endTurn() }
    if (m.kind === 'ability') return this.ability(seat, m)
    if (m.kind !== 'play') return this.err(seat, 'invalid_message')
    const i = this.hand[seat].findIndex(c => c.id === Number(m.card)); if (i < 0) return this.err(seat, 'invalid_target')
    const c = this.hand[seat][i], k = c.kind, t = m.target, tx = this.seats[t]
    const ok = s => s && s !== seat && this.seats[s]?.inGame && this.seats[s].alive
    if (!ok(t)) return this.err(seat, 'invalid_target')
    const nm = this.name(t), me = this.name(seat)
    if (k === 'accuse' && this.has(t, 'fort')) return this.err(seat, 'fort')
    if ((k === 'steal' || k === 'peek') && this.char[t] === 'p6') return this.err(seat, 'guarded')
    if (k === 'steal' && !this.hand[t].length) return this.err(seat, 'empty')
    if (k === 'peek' && !this.hidden(t).length) return this.err(seat, 'empty')
    if (k === 'help' && !this.accused[t]) return this.err(seat, 'empty')
    if (k === 'pardon' && !this.front[t].length && this.cat !== t) return this.err(seat, 'empty')
    if (k === 'camel' && (!ok(m.to) || m.to === t)) return this.err(seat, 'invalid_target')
    if (k === 'camel' && !this.front[t].length && !this.accused[t] && this.cat !== t) return this.err(seat, 'empty')
    this.hand[seat].splice(i, 1); this.played = true; this.toDraw = 0
    switch (k) {
      case 'accuse': {
        const n = this.char[seat] === 'p8' ? 2 : 1
        this.accused[t] += n; this.burn.push(c)
        this.event(`🟥 ${me} اتهم ${nm} (${this.accused[t]}/${ACCUSE_LIMIT(this.char[t])})`, 'accuse')
        if (this.accused[t] >= ACCUSE_LIMIT(this.char[t])) this.trialOf(t)
        break
      }
      case 'steal': { const j = Math.floor(Math.random() * this.hand[t].length), got = this.hand[t].splice(j, 1)[0]; this.hand[seat].push(got); this.burn.push(c); this.event(`🖐️ ${me} سرق ورقة من ${nm}`, 'steal'); this.event(`سرقت «${CARDS[got.kind].name}» من ${nm}`, 'info', [seat]); this.event(`${me} سرق منك «${CARDS[got.kind].name}»`, 'bad', [t]); break }
      case 'peek': { const h = pick(this.hidden(t)); this.peeks[seat].push({seat: t, kind: h.kind}); this.burn.push(c); this.event(`🔍 ${me} تحرّى عن ${nm}`, 'peek'); this.event(`🔍 تحرّيك: إحدى أوراق ${nm} المخفية «${TRIAL_NAME[h.kind]}»`, h.kind === 'traitor' ? 'bad' : 'good', [seat]); break }
      case 'help': { const n = Math.min(3, this.accused[t]); this.accused[t] -= n; this.burn.push(c); this.event(`🤝 ${me} فزع لـ${nm} وأزال ${n} اتهامات`, 'help'); break }
      case 'pardon': { this.burn.push(c, ...this.front[t]); this.front[t] = []; if (this.cat === t) this.cat = ''; this.event(`📜 ${me} أعفى ${nm} — احترقت الأوراق التي أمامه`, 'help'); break }
      case 'camel': {
        const to = m.to; this.front[to].push(...this.front[t]); this.front[t] = []; this.accused[to] += this.accused[t]; this.accused[t] = 0
        if (this.cat === t) this.cat = to
        this.burn.push(c); this.event(`🐪 ${me} نقل ما أمام ${nm} إلى ${this.name(to)}`, 'camel')
        this.checkBond(to)
        if (this.accused[to] >= ACCUSE_LIMIT(this.char[to])) this.trialOf(to)
        break
      }
      case 'bond': { this.front[t].push(c); this.event(`🔗 ${me} وضع «ارتباط» على ${nm}`, 'bond'); this.checkBond(t); break }
      default: this.front[t].push(c); this.event(`${k === 'fort' ? '🏰' : k === 'wind' ? '🌬️' : '🗡️'} ${me} وضع «${CARDS[k].name}» على ${nm}`, 'blue')
    }
    this.checkWin()
  }
  /** Two «ارتباط» cards on one player burn; one each on two players binds their fates. */
  checkBond(s) { const b = this.front[s].filter(c => c.kind === 'bond'); if (b.length >= 2) { this.front[s] = this.front[s].filter(c => c.kind !== 'bond'); this.burn.push(...b); this.event(`🔗 اجتمع ارتباطان على ${this.name(s)} فاحترقا`, 'bond') } }
  bonded(s) { if (!this.has(s, 'bond')) return ''; return this.living().find(o => o !== s && this.has(o, 'bond')) || '' }

  ability(seat, m) {
    const c = this.char[seat]
    if (this.used[seat]) return this.err(seat, 'used')
    if (c === 'p1') {
      const t = m.target; if (!t || t === seat || !this.seats[t]?.alive || !this.hidden(t).length) return this.err(seat, 'invalid_target')
      const h = pick(this.hidden(t)); this.peeks[seat].push({seat: t, kind: h.kind}); this.used[seat] = true
      this.event(`🦅 ${this.name(seat)} استخدم «عين الصقر» على ${this.name(t)}`, 'peek')
      this.event(`🦅 إحدى أوراق ${this.name(t)} المخفية «${TRIAL_NAME[h.kind]}»`, h.kind === 'traitor' ? 'bad' : 'good', [seat])
    } else if (c === 'p9') {
      if (!this.accused[seat]) return this.err(seat, 'empty')
      this.event(`📿 ${this.name(seat)} استخدم «صفاء النية» وأحرق ${this.accused[seat]} اتهامات أمامه`, 'help'); this.accused[seat] = 0; this.used[seat] = true
    } else return this.err(seat, 'invalid_message')
  }

  // ---------- reveals and deaths ----------
  /** Seven accusations: a trial card is revealed (الحكيم chooses his own). */
  trialOf(t) {
    this.accused[t] = 0
    this.event(`⚖️ اكتملت الاتهامات على ${this.name(t)} — تنكشف إحدى أوراق محاكمته`, 'trial')
    if (this.char[t] === 'p4' && this.hidden(t).length > 1) return this.choose(t, 'trial', `${this.name(t)} (الحكيم) يختار الورقة التي يكشفها`)
    this.reveal(t, pick(this.hidden(t)))
  }
  choose(who, why, notice) { this.pending = {who, why, back: {phase: this.phase, ends: this.ends}}; this.setPhase('choose', T.choose, notice) }
  finishChoice(c) {
    const p = this.pending; this.pending = null
    this.reveal(p.who, c)
    if (this.winner) return
    if (p.why === 'plot') return this.passCards()
    // Back to the turn that was interrupted.
    this.phase = p.back.phase; this.ends = Date.now() + Math.max(15000, p.back.ends - Date.now())
    if (!this.seats[this.turn]?.alive) this.endTurn()
  }
  reveal(s, c) {
    if (!c) return
    c.open = true
    this.event(`🃏 انكشفت ورقة ${this.name(s)}: «${TRIAL_NAME[c.kind]}»`, c.kind === 'traitor' ? 'good' : 'reveal')
    if (c.kind === 'traitor') this.kill(s, 'انكشف أنه خائن')
    else if (!this.hidden(s).length) this.kill(s, 'انكشفت كل أوراقه')
    this.checkWin()
  }
  kill(s, why) {
    const x = this.seats[s]; if (!x.alive) return
    x.alive = false
    for (const c of this.trial[s]) c.open = true
    this.event(`💀 مات ${this.name(s)} — ${why}`, 'death')
    if (this.char[s] === 'p5' && this.hand[s].length && this.living().length) { const heir = this.after(s); this.hand[heir].push(...this.hand[s]); this.event(`🎁 ورث ${this.name(heir)} أوراق ${this.name(s)} (الكريم)`, 'info') }
    else this.burn.push(...this.hand[s])
    this.hand[s] = []
    const partner = this.bonded(s)
    this.burn.push(...this.front[s]); this.front[s] = []; this.accused[s] = 0
    if (this.cat === s) this.cat = ''
    if (partner) this.kill(partner, `مرتبط بـ${this.name(s)}`)
    if (this.turn === s && this.phase === 'turn') this.endTurn()
  }
  checkWin() {
    if (this.winner) return true
    const all = this.players().flatMap(s => this.trial[s]).filter(c => c.kind === 'traitor')
    if (!this.living().length || this.living().every(s => this.traitor.has(s))) this.winner = 'traitors'
    else if (all.length && all.every(c => c.open)) this.winner = 'village'
    if (!this.winner) return false
    for (const s of this.players()) for (const c of this.trial[s]) c.open = true
    this.notice = this.winner === 'village' ? 'انتصر أهل الديرة! انكشفت كل أوراق الخيانة' : 'انتصر الخونة! لم يبقَ مسالم حيّ'
    this.event(this.winner === 'village' ? '🏆 فاز أهل الديرة' : '🏆 فاز الخونة', 'win')
    this.setPhase('over', T.over); this.turn = ''
    return true
  }

  // ---------- dawn: the black cat ----------
  placeCat() {
    const tally = {}; for (const t of Object.values(this.catVotes)) tally[t] = (tally[t] || 0) + 1
    const best = Math.max(0, ...Object.values(tally)), top = Object.keys(tally).filter(t => tally[t] === best && this.seats[t].alive)
    this.cat = top.length ? pick(top) : pick(this.living())
    this.event(`🐈‍⬛ ظهرت القطة السوداء أمام ${this.name(this.cat)} — يبدأ الدور منه`, 'cat')
    this.beginTurn(this.cat)
  }

  // ---------- black card: conspiracy ----------
  conspiracy() {
    this.event('👁️ «المؤامرة»! كل لاعب يأخذ ورقة محاكمة من جاره', 'plot')
    if (this.cat && this.seats[this.cat].alive && this.hidden(this.cat).length) {
      if (this.hidden(this.cat).length === 1) { this.reveal(this.cat, this.hidden(this.cat)[0]); if (this.winner) return; return this.passCards() }
      return this.choose(this.cat, 'plot', `${this.name(this.cat)} صاحب القطة السوداء يختار ورقة من أوراقه ليكشفها`)
    }
    this.passCards()
  }
  passCards() {
    const ps = this.living(), taken = {}
    // Everyone takes one random hidden card from the player on his left (the previous seat).
    ps.forEach((s, i) => { const left = ps[(i - 1 + ps.length) % ps.length], h = this.hidden(left).filter(c => !Object.values(taken).includes(c)); taken[s] = h.length ? pick(h) : null })
    ps.forEach((s, i) => { const left = ps[(i - 1 + ps.length) % ps.length], c = taken[s]; if (!c) return; this.trial[left] = this.trial[left].filter(x => x !== c); this.trial[s].push(c) })
    const before = new Set(this.traitor); this.updateTeams()
    for (const s of this.traitor) if (!before.has(s)) this.event('👁️ صرت خائنًا! انضممت لفريق الخونة', 'bad', [s])
    this.event('🔄 انتقلت أوراق المحاكمة — راجع أوراقك', 'plot')
    this.setPhase('conspiracy', T.conspiracy, 'المؤامرة: كل واحد يراجع أوراق محاكمته الجديدة…')
  }

  // ---------- black card: night ----------
  startNight() {
    this.nightNo++; this.killVotes = {}; this.guardBy = {}; this.confess = {}
    this.resume = {turn: this.turn, toDraw: this.toDraw}
    this.event(`🌑 «الليل» — الليلة ${this.nightNo}`, 'night')
    this.setPhase('kill', T.kill, 'الليل: الخونة يختارون من يغتالون، والشايب يحمي أحدهم بالدرع…')
  }
  guards() { const g = []; const o = this.oldMan(); if (o) g.push(o); for (const s of this.living()) if (this.char[s] === 'p12' && !this.used[s] && s !== o) g.push(s); return g }
  killDone() { return this.traitors().every(s => this.killVotes[s]) && this.guards().every(s => this.guardBy[s]) }
  exempt(s) { return this.has(s, 'weapon') || Object.values(this.guardBy).includes(s) }
  toConfess() {
    const tally = {}; for (const t of Object.values(this.killVotes)) tally[t] = (tally[t] || 0) + 1
    const best = Math.max(0, ...Object.values(tally)), top = Object.keys(tally).filter(t => tally[t] === best)
    this.victim = top.length ? pick(top) : ''
    for (const [s, t] of Object.entries(this.guardBy)) if (this.char[s] === 'p12' && s !== this.oldMan()) this.used[s] = true
    this.setPhase('confess', T.confess, 'الاعتراف: خاطر… أو اكشف ورقة محاكمة لتحصّن نفسك من الاغتيال')
  }
  resolveNight() {
    const v = this.victim, revealed = []
    for (const s of this.living()) { const id = this.confess[s]; if (id && id !== 'risk') revealed.push([s, this.hidden(s).find(c => c.id === id)]) }
    for (const [s, c] of revealed) if (this.seats[s].alive) this.reveal(s, c)
    let text = ''
    if (this.winner) return
    if (!v) text = 'مرّ الليل… ولم يختر الخونة أحدًا'
    else if (!this.seats[v].alive) text = `اختار الخونة ${this.name(v)}… لكنه كان قد مات`
    else if (this.exempt(v)) text = `حاول الخونة اغتيال ${this.name(v)}… لكنه كان محميًّا`
    else if (this.confess[v] && this.confess[v] !== 'risk') text = `حاول الخونة اغتيال ${this.name(v)}… لكنه تحصّن بالاعتراف`
    else if (this.char[v] === 'p10' && !this.saved[v]) { this.saved[v] = true; text = `نجا ${this.name(v)} (الصيّاد) من محاولة الاغتيال!` }
    else { text = `اغتيل ${this.name(v)} في الليل`; this.kill(v, 'اغتيل في الليل') }
    this.lastNight = {victim: v, text}
    this.event(`🌘 ${text}`, 'night'); this.notice = text
    if (this.checkWin()) return
    this.setPhase('reveal', T.reveal)
  }
  afterNight() {
    // Burned cards go back into the deck; «الليل» goes to the bottom again.
    this.reshuffle()
    const r = this.resume; this.resume = null
    if (r && this.seats[r.turn]?.alive) { this.turn = r.turn; this.toDraw = r.toDraw; this.setPhase('turn', T.turn, `يكمل ${this.name(r.turn)} دوره`); this.drawOn() }
    else this.beginTurn(this.after(r?.turn || this.living()[0]))
  }

  timeout() {
    switch (this.phase) {
      case 'dawn': for (const s of this.traitors()) if (!this.catVotes[s]) this.catVotes[s] = pick(this.living()); return this.placeCat()
      case 'turn': if (this.played) return this.endTurn(); if (!this.toDraw) { this.toDraw = this.char[this.turn] === 'p3' ? 3 : 2; this.event(`⌛ انتهى وقت ${this.name(this.turn)} فسحب تلقائيًّا`, 'draw') } return this.drawOn()
      case 'choose': return this.finishChoice(pick(this.hidden(this.pending.who)))
      case 'conspiracy': this.phase = 'turn'; this.ends = Date.now() + T.turn; if (!this.seats[this.turn]?.alive) return this.endTurn(); return this.drawOn()
      case 'kill': return this.toConfess()
      case 'confess': return this.resolveNight()
      case 'reveal': return this.afterNight()
      case 'over': return this.toLobby()
    }
  }

  // ---------- views ----------
  publicSeat(s, viewer) {
    if (!this.seats[s].inGame) return {}
    const over = this.phase === 'over', mate = viewer && this.traitor.has(viewer) && this.traitor.has(s)
    return {
      char: this.char[s], hand: this.hand[s]?.length || 0, accused: this.accused[s] || 0, limit: ACCUSE_LIMIT(this.char[s]),
      front: (this.front[s] || []).map(c => c.kind), cat: this.cat === s, used: this.used[s],
      trial: this.trial[s].map(c => c.open || s === viewer ? c.kind : ''),
      team: over || mate ? (this.traitor.has(s) ? 'traitor' : 'village') : '',
      done: this.phase === 'confess' ? Boolean(this.confess[s]) || this.exempt(s) : this.phase === 'kill' ? Boolean(this.killVotes[s] || this.guardBy[s]) : this.phase === 'dawn' ? Boolean(this.catVotes[s]) : false,
    }
  }
  publicView() {
    return {turn: this.turn, deck: this.deck.length, burn: this.burn.length, winner: this.winner, night_no: this.nightNo, last_night: this.lastNight,
      choosing: this.pending?.who || '', drawing: this.phase === 'turn' ? this.toDraw : 0, played: this.played}
  }
  privateView(seat) {
    if (!this.seats[seat].inGame) return null
    const traitor = this.traitor.has(seat), old = this.oldMan() === seat
    return {
      hand: (this.hand[seat] || []).map(c => ({id: c.id, kind: c.kind})),
      trial: this.trial[seat].map(c => ({id: c.id, kind: c.kind, open: c.open})),
      team: traitor ? 'traitor' : 'village', old,
      mates: traitor ? this.players().filter(s => this.traitor.has(s) && s !== seat) : [],
      votes: traitor ? (this.phase === 'dawn' ? this.catVotes : this.phase === 'kill' ? this.killVotes : null) : null,
      guard: this.guardBy[seat] || '', can_guard: this.phase === 'kill' && this.guards().includes(seat),
      confess: this.confess[seat] || '', exempt: this.exempt(seat),
      top: this.char[seat] === 'p7' && this.deck[0] ? this.deck[0].kind : '',
      peeks: this.peeks[seat] || [],
    }
  }
  chatAudience(seat) {
    const x = this.seats[seat]
    if ((this.phase === 'kill' || this.phase === 'dawn') && x.inGame && x.alive) return this.traitor.has(seat) ? {to: this.players().filter(s => this.traitor.has(s)), scope: 'team'} : null
    return super.chatAudience(seat)
  }
}
export const TRIAL_NAME = {ok: 'مسالم', traitor: 'خائن', old: 'الشايب'}
