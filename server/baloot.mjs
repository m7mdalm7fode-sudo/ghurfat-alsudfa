// «بلوت»: four players in two teams (p1+p3 against p2+p4), 32 cards. Bidding on the face-up card
// (حكم / صن / بس, then a second round), eight tricks with follow-suit and trumping rules,
// projects (سرا، خمسين، مية، أربعمية، بلوت) and the buyer's contract. First team to 152 wins.
// Empty seats are filled with bots when the host starts, so even one person can play.
import {SocialRoom, shuffle, BOT_NAMES} from './social.mjs'

const K = Number(process.env.SOCIAL_SPEED || 1)
const ms = v => Math.max(40, Math.round(v * K))
const T = {bid: 25000, play: 30000, trick: 1500, score: 9000, over: 25000, bot: 900}
export const SUITS = ['S', 'H', 'C', 'D']
export const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const SUIT_NAME = {S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريا'}
const RANK_NAME = {A: 'الإكة', K: 'الشايب', Q: 'البنت', J: 'الولد', '10': 'العشرة', '9': 'التسعة', '8': 'الثمانية', '7': 'السبعة'}
const SUN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A']
const HOKM_ORDER = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J']
const SUN_PTS = {A: 11, '10': 10, K: 4, Q: 3, J: 2}
const HOKM_PTS = {J: 20, '9': 14, A: 11, '10': 10, K: 4, Q: 3}
const PROJ = {sira: {name: 'سرا', sun: 4, hokm: 2, rank: 1}, fifty: {name: 'خمسين', sun: 10, hokm: 5, rank: 2}, hundred: {name: 'مية', sun: 20, hokm: 10, rank: 3}, four: {name: 'أربعمية', sun: 40, hokm: 10, rank: 4}}
export const TARGET = 152
const rank = c => c.slice(0, -1), suit = c => c.slice(-1)
export const cardName = c => `${RANK_NAME[rank(c)]} ${SUIT_NAME[suit(c)]}`
const ORDER = ['p1', 'p2', 'p3', 'p4']
const team = s => (s === 'p1' || s === 'p3' ? 'a' : 'b')
const other = t => (t === 'a' ? 'b' : 'a')
const next = s => ORDER[(ORDER.indexOf(s) + 1) % 4]

/** Projects in a hand: sequences of 3+ in one suit and four of a kind (A, K, Q, J, 10). */
export function findProjects(hand, mode) {
  const out = []
  for (const r of ['A', 'K', 'Q', 'J', '10']) if (SUITS.every(x => hand.includes(r + x))) out.push({kind: r === 'A' && mode === 'sun' ? 'four' : 'hundred', top: RANKS.indexOf(r) + 10, cards: SUITS.map(x => r + x)})
  for (const x of SUITS) {
    const have = RANKS.map(r => hand.includes(r + x))
    let i = 0
    while (i < 8) {
      if (!have[i]) { i++; continue }
      let j = i
      while (j + 1 < 8 && have[j + 1]) j++
      const len = j - i + 1
      if (len >= 3) out.push({kind: len >= 5 ? 'hundred' : len === 4 ? 'fifty' : 'sira', top: j, cards: RANKS.slice(i, j + 1).map(r => r + x)})
      i = j + 1
    }
  }
  return out
}

export class BalootRoom extends SocialRoom {
  constructor(id) { super(id, {game: 'baloot', maxSeats: 4, minPlayers: 1}); this.reset() }
  reset() {
    for (const s of this.seatIds) if (this.seats[s].auto) Object.assign(this.seats[s], this.emptySeat())
    this.score = {a: 0, b: 0}; this.dealer = ORDER[Math.floor(Math.random() * 4)]; this.round = 0; this.winner = ''; this.result = null
    this.clearRound()
  }
  clearRound() {
    this.hands = {p1: [], p2: [], p3: [], p4: []}; this.deck = []; this.face = ''; this.bids = {}; this.bidRound = 0; this.hokmBy = ''; this.bidCount = 0
    this.mode = ''; this.trump = ''; this.buyer = ''; this.turn = ''; this.trick = []; this.last = null; this.taken = {a: 0, b: 0}; this.tricks = {a: 0, b: 0}
    this.projects = {}; this.shown = false; this.belote = ''; this.seen = new Set(); this.voids = {p1: new Set(), p2: new Set(), p3: new Set(), p4: new Set()}
  }
  isBot(s) { return Boolean(this.seats[s]?.bot) }

  start() {
    let n = 1
    for (const s of ORDER) {
      const x = this.seats[s]
      if (!x.inGame) { const used = new Set(this.bots().map(b => this.seats[b].name)); Object.assign(x, this.emptySeat(), {token: `bot-${s}-${Date.now()}`, bot: true, auto: true, name: BOT_NAMES.find(b => !used.has(b)) || `بوت ${n++}`}); x.inGame = true; x.alive = true }
    }
    this.score = {a: 0, b: 0}; this.round = 0; this.winner = ''; this.result = null; this.log = []
    this.event(`بدأت البلوت: ${this.name('p1')} و${this.name('p3')} ضد ${this.name('p2')} و${this.name('p4')} — أول فريق يوصل ${TARGET} يفوز`, 'start')
    this.deal()
  }

  /** Five cards each and one face up; bidding starts right after the dealer. */
  deal() {
    this.clearRound(); this.round++
    this.dealer = next(this.dealer)
    this.deck = shuffle(SUITS.flatMap(x => RANKS.map(r => r + x)))
    for (const s of ORDER) this.hands[s] = this.deck.splice(0, 5)
    this.face = this.deck.shift()
    this.bidRound = 1; this.bidCount = 0
    this.setPhase('bid', 0, `الصفقة ${this.round}: الورقة المكشوفة ${cardName(this.face)}`)
    this.setTurn(next(this.dealer))
  }
  setTurn(s) { this.turn = s; this.ends = Date.now() + ms(this.isBot(s) ? T.bot + Math.random() * 500 : this.phase === 'bid' ? T.bid : T.play) }

  act(seat, m) {
    if (this.phase === 'bid' && m.kind === 'bid') return this.bid(seat, m.bid, m.suit)
    if (this.phase === 'play' && m.kind === 'play') return this.play(seat, String(m.card || ''))
    this.err(seat, 'not_ready')
  }

  bid(seat, b, s) {
    if (seat !== this.turn) return this.err(seat, 'not_your_turn')
    const faceSuit = suit(this.face)
    if (b === 'sun') { this.bids[seat] = 'صن'; this.event(`${this.name(seat)}: صن`, 'bid'); return this.buy(seat, 'sun', '') }
    if (b === 'hokm') {
      if (this.bidRound === 1) {
        if (this.hokmBy) return this.err(seat, 'invalid_message')
        this.hokmBy = seat; this.bids[seat] = `حكم ${SUIT_NAME[faceSuit]}`; this.event(`${this.name(seat)}: حكم ${SUIT_NAME[faceSuit]}`, 'bid')
      } else {
        if (!SUITS.includes(s) || s === faceSuit) return this.err(seat, 'invalid_message')
        this.bids[seat] = `حكم ${SUIT_NAME[s]}`; this.event(`${this.name(seat)}: حكم ${SUIT_NAME[s]} (ثاني)`, 'bid')
        return this.buy(seat, 'hokm', s)
      }
    } else if (b === 'pass') { this.bids[seat] = this.hokmBy && this.bidRound === 1 ? 'أشكل' : 'بس'; this.event(`${this.name(seat)}: ${this.bids[seat]}`, 'bid') }
    else return this.err(seat, 'invalid_message')
    this.bidCount++
    if (this.bidCount < 4) return this.setTurn(next(seat))
    if (this.bidRound === 1 && this.hokmBy) return this.buy(this.hokmBy, 'hokm', faceSuit)
    if (this.bidRound === 1) { this.bidRound = 2; this.bidCount = 0; this.bids = {}; this.notice = 'الجولة الثانية من الشراء: صن، أو حكم بلون غير لون الورقة المكشوفة'; this.event('الكل قال بس — جولة شراء ثانية', 'info'); return this.setTurn(next(this.dealer)) }
    this.event('ما أحد اشترى — نعيد التوزيع', 'info')
    this.deal()
  }

  /** The buyer takes the face card plus two, everyone else three; play starts after the dealer. */
  buy(seat, mode, trump) {
    this.mode = mode; this.trump = trump; this.buyer = seat
    this.hands[seat].push(this.face, ...this.deck.splice(0, 2))
    for (const s of ORDER) if (s !== seat) this.hands[s].push(...this.deck.splice(0, 3))
    this.face = ''
    for (const s of ORDER) {
      const list = findProjects(this.hands[s], mode)
      if (list.length) this.projects[s] = list
      if (mode === 'hokm' && this.hands[s].includes('K' + trump) && this.hands[s].includes('Q' + trump)) this.belote = s
    }
    const label = mode === 'sun' ? 'صن' : `حكم ${SUIT_NAME[trump]}`
    this.event(`🃏 ${this.name(seat)} اشترى ${label}`, 'buy')
    this.setPhase('play', 0, `${this.name(seat)} اشترى ${label}`)
    this.setTurn(next(this.dealer))
  }

  power(c, led) {
    if (this.mode === 'hokm' && suit(c) === this.trump) return 100 + HOKM_ORDER.indexOf(rank(c))
    return suit(c) === led ? SUN_ORDER.indexOf(rank(c)) : -1
  }
  points(c) { return (this.mode === 'hokm' && suit(c) === this.trump ? HOKM_PTS : SUN_PTS)[rank(c)] || 0 }
  winning() {
    if (!this.trick.length) return null
    const led = suit(this.trick[0].card)
    return this.trick.reduce((a, b) => (this.power(b.card, led) > this.power(a.card, led) ? b : a))
  }

  /** Cards `seat` may play now: follow suit; in حكم trump when void and over-trump when possible. */
  legal(seat) {
    const hand = this.hands[seat]
    if (!this.trick.length) return [...hand]
    const led = suit(this.trick[0].card), same = hand.filter(c => suit(c) === led), win = this.winning()
    const best = this.power(win.card, led)
    if (same.length) {
      if (this.mode === 'hokm' && led === this.trump) { const up = same.filter(c => this.power(c, led) > best); return up.length ? up : same }
      return same
    }
    if (this.mode !== 'hokm') return [...hand]
    const trumps = hand.filter(c => suit(c) === this.trump)
    if (!trumps.length || team(win.seat) === team(seat)) return [...hand]
    const up = trumps.filter(c => this.power(c, led) > best)
    return up.length ? up : trumps
  }

  play(seat, card) {
    if (seat !== this.turn) return this.err(seat, 'not_your_turn')
    if (!this.legal(seat).includes(card)) return this.err(seat, this.hands[seat].includes(card) ? 'must_follow' : 'invalid_message')
    this.hands[seat].splice(this.hands[seat].indexOf(card), 1)
    if (this.trick.length) {
      const led = suit(this.trick[0].card)
      if (suit(card) !== led) { this.voids[seat].add(led); if (this.mode === 'hokm' && suit(card) !== this.trump && team(this.winning().seat) !== team(seat)) this.voids[seat].add(this.trump) }
    }
    this.seen.add(card)
    this.trick.push({seat, card})
    if (this.trick.length < 4) return this.setTurn(next(seat))
    const w = this.winning()
    this.turn = ''
    this.setPhase('trick', ms(T.trick), `الأكلة لـ${this.name(w.seat)}`)
  }

  /** The trick is collected; after the first one the projects are announced; after the eighth, scoring. */
  collect() {
    const w = this.winning(), t = team(w.seat)
    const pts = this.trick.reduce((n, x) => n + this.points(x.card), 0)
    this.taken[t] += pts; this.tricks[t]++
    this.last = {cards: this.trick, winner: w.seat}
    this.trick = []
    if (!this.shown) {
      this.shown = true
      const list = Object.entries(this.projects).map(([s, ps]) => `${this.name(s)}: ${ps.map(p => PROJ[p.kind].name).join(' + ')}`)
      if (list.length) this.event(`المشاريع — ${list.join(' · ')}`, 'project')
    }
    if (!this.hands[w.seat].length) { this.taken[t] += 10; return this.scoreRound(w.seat) }
    this.setPhase('play', 0, `${this.name(w.seat)} أكل ${pts ? `(${pts})` : ''} ويبدأ`)
    this.setTurn(w.seat)
  }

  /** Only the team holding the best single project scores its projects. */
  projectPoints() {
    let best = null
    for (const s of ORDER) for (const p of this.projects[s] || []) {
      const key = PROJ[p.kind].rank * 100 + p.top
      if (!best || key > best.key) best = {key, team: team(s)}
    }
    const out = {a: 0, b: 0}
    if (!best) return out
    for (const s of ORDER) if (team(s) === best.team) for (const p of this.projects[s] || []) out[best.team] += PROJ[p.kind][this.mode]
    return out
  }

  scoreRound() {
    const bt = team(this.buyer), ot = other(bt), sun = this.mode === 'sun'
    const total = sun ? 26 : 16
    const card = {a: 0, b: 0}
    card.a = sun ? Math.round(this.taken.a / 5) : Math.round(this.taken.a / 10)
    card.b = total - card.a
    const proj = this.projectPoints(), bel = {a: 0, b: 0}
    if (this.belote) bel[team(this.belote)] = 2
    const got = {a: 0, b: 0}
    let verdict
    const kaboot = this.tricks.a === 8 ? 'a' : this.tricks.b === 8 ? 'b' : ''
    if (kaboot) { got[kaboot] = (sun ? 44 : 25) + proj.a + proj.b; verdict = 'kaboot' }
    else if (card[bt] + proj[bt] > card[ot] + proj[ot]) { got.a = card.a + proj.a; got.b = card.b + proj.b; verdict = 'made' }
    else { got[ot] = total + proj.a + proj.b; verdict = 'lost' }
    got.a += bel.a; got.b += bel.b
    this.score.a += got.a; this.score.b += got.b
    this.result = {verdict, buyer: this.buyer, mode: this.mode, trump: this.trump, raw: {...this.taken}, card, proj, bel, got, kaboot}
    const names = t => (t === 'a' ? `${this.name('p1')} و${this.name('p3')}` : `${this.name('p2')} و${this.name('p4')}`)
    const head = verdict === 'kaboot' ? `كبوت! ${names(kaboot)} أكلوا كل الأكلات` : verdict === 'made' ? `${this.name(this.buyer)} نجح في شرائه` : `${this.name(this.buyer)} خسر شراءه — النقاط كلها للخصم`
    this.event(`${head} — فريق ${this.name('p1')} +${got.a} · فريق ${this.name('p2')} +${got.b} (المجموع ${this.score.a} – ${this.score.b})`, verdict === 'lost' ? 'bad' : 'good')
    if (this.score.a >= TARGET || this.score.b >= TARGET) {
      this.winner = this.score.a === this.score.b ? team(this.buyer) : this.score.a > this.score.b ? 'a' : 'b'
      this.setPhase('over', ms(T.over), `🏆 فاز ${names(this.winner)} ${Math.max(this.score.a, this.score.b)} – ${Math.min(this.score.a, this.score.b)}`)
      this.event(this.notice, 'win')
    } else this.setPhase('score', ms(T.score), head)
    this.turn = ''
  }

  timeout() {
    if (this.phase === 'bid') return this.autoBid(this.turn)
    if (this.phase === 'play') return this.play(this.turn, this.autoCard(this.turn))
    if (this.phase === 'trick') return this.collect()
    if (this.phase === 'score') return this.deal()
    if (this.phase === 'over') this.toLobby()
  }

  // ---- bots (and auto-play when a human's timer runs out) ----
  /** Rough number of tricks a hand should take in صن. */
  sunValue(h) {
    let v = 0
    for (const x of SUITS) {
      const has = r => h.includes(r + x), n = h.filter(c => suit(c) === x).length
      if (has('A')) v += 1
      if (has('10')) v += has('A') ? 1 : n >= 2 ? .5 : 0
      if (has('K') && has('A') && has('10')) v += .5
    }
    for (const p of findProjects(h, 'sun')) v += p.kind === 'four' ? 2 : p.kind === 'hundred' ? 1 : p.kind === 'fifty' ? .5 : .25
    return v
  }
  /** Rough strength of a hand in حكم with suit `x` as trump. */
  hokmValue(h, x) {
    const t = h.filter(c => suit(c) === x), has = r => h.includes(r + x)
    if (t.length < 2) return 0
    let v = (has('J') ? 1.6 : 0) + (has('9') ? (has('J') ? 1.1 : .7) : 0) + (has('A') ? .7 : 0) + Math.max(0, t.length - 2) * .5
    for (const y of SUITS) if (y !== x && h.includes('A' + y)) v += .8
    if (h.includes('K' + x) && h.includes('Q' + x)) v += .3
    return v
  }
  autoBid(s) {
    const h = this.hands[s], faceSuit = suit(this.face)
    if (!this.isBot(s)) return this.bid(s, 'pass')
    const sun = this.sunValue([...h, this.face]) - .4
    if (this.bidRound === 1) {
      const hk = this.hokmBy ? 0 : this.hokmValue([...h, this.face], faceSuit)
      const partnerHokm = this.hokmBy && team(this.hokmBy) === team(s)
      if (sun >= 3 && sun >= hk && !(partnerHokm && sun < 3.6)) return this.bid(s, 'sun')
      if (hk >= 3) return this.bid(s, 'hokm')
      return this.bid(s, 'pass')
    }
    const best = SUITS.filter(x => x !== faceSuit).map(x => [x, this.hokmValue(h, x) + .3]).sort((a, b) => b[1] - a[1])[0]
    if (sun >= 2.8 && sun >= best[1]) return this.bid(s, 'sun')
    if (best[1] >= 3.2) return this.bid(s, 'hokm', best[0])
    return this.bid(s, 'pass')
  }

  /** In-suit strength (trump order for the trump suit). */
  inSuit(c) { return (this.mode === 'hokm' && suit(c) === this.trump ? HOKM_ORDER : SUN_ORDER).indexOf(rank(c)) }
  /** Cards `s` cannot see yet: not played and not in its own hand. */
  unseen(s) { const mine = new Set(this.hands[s]); return SUITS.flatMap(x => RANKS.map(r => r + x)).filter(c => !this.seen.has(c) && !mine.has(c)) }
  /** No unseen card of the same suit beats it. */
  isMaster(c, s) { return !this.unseen(s).some(u => suit(u) === suit(c) && this.inSuit(u) > this.inSuit(c)) }

  /** Bot play (and the auto-move for a human whose timer ran out): cash masters, pull trumps, feed the partner, win cheaply. */
  autoCard(s) {
    const L = this.legal(s), hokm = this.mode === 'hokm', trump = this.trump
    const opps = ORDER.filter(x => team(x) !== team(s))
    const low = cards => [...cards].sort((a, b) => this.points(a) - this.points(b) || this.inSuit(a) - this.inSuit(b) || (hokm ? (suit(a) === trump) - (suit(b) === trump) : 0))[0]
    if (!this.trick.length) {
      const myTrumps = L.filter(c => hokm && suit(c) === trump)
      const oppTrumps = hokm && this.unseen(s).some(c => suit(c) === trump) && !opps.every(o => this.voids[o].has(trump))
      if (hokm && team(this.buyer) === team(s) && oppTrumps && myTrumps.length >= 2) { const m = myTrumps.find(c => this.isMaster(c, s)); if (m) return m }
      const safe = c => !hokm || suit(c) === trump || !opps.some(o => this.voids[o].has(suit(c)))
      const masters = L.filter(c => (!hokm || suit(c) !== trump) && this.isMaster(c, s) && safe(c)).sort((a, b) => this.points(b) - this.points(a))
      if (masters.length) return masters[0]
      // Avoid leading a bare 10 or giving away a trump; lead low from the longest side suit.
      const side = L.filter(c => (!hokm || suit(c) !== trump) && !(rank(c) === '10' && !this.isMaster(c, s)))
      const pool = side.length ? side : L
      const len = x => this.hands[s].filter(c => suit(c) === x).length
      return [...pool].sort((a, b) => len(suit(b)) - len(suit(a)) || this.points(a) - this.points(b) || this.inSuit(a) - this.inSuit(b))[0]
    }
    const led = suit(this.trick[0].card), w = this.winning(), last = this.trick.length === 3
    const pts = this.trick.reduce((n, x) => n + this.points(x.card), 0)
    if (team(w.seat) === team(s)) {
      const safeWin = last || (this.isMaster(w.card, s) && (!hokm || suit(w.card) === trump || !opps.some(o => this.voids[o].has(led) && !this.voids[o].has(trump))))
      if (safeWin) {
        const give = L.filter(c => !(hokm && suit(c) === trump && this.points(c) >= 11)).sort((a, b) => this.points(b) - this.points(a) || this.inSuit(a) - this.inSuit(b))
        return give[0] || low(L)
      }
      return low(L)
    }
    const best = this.power(w.card, led), beats = L.filter(c => this.power(c, led) > best).sort((a, b) => this.power(a, led) - this.power(b, led))
    if (beats.length) {
      if (last) return beats[0]
      const sure = beats.find(c => (hokm && suit(c) === trump && led !== trump) ? true : this.isMaster(c, s))
      if (sure) return sure
      if (pts >= 10) return beats[0]
    }
    return low(L)
  }

  publicSeat(s) {
    return {char: s, bot: this.isBot(s), team: team(s), count: this.hands[s]?.length || 0, bid: this.bids[s] || '',
      projects: this.shown ? (this.projects[s] || []).map(p => PROJ[p.kind].name) : [], belote: this.shown && this.belote === s}
  }
  publicView() {
    return {round: this.round, dealer: this.dealer, turn: this.turn, mode: this.mode, trump: this.trump, buyer: this.buyer, face: this.face, bidRound: this.bidRound, hokmBy: this.hokmBy,
      trick: this.trick, last: this.last, taken: this.taken, tricks: this.tricks, score: this.score, target: TARGET, result: this.phase === 'score' || this.phase === 'over' ? this.result : null, winner: this.winner}
  }
  privateView(s) {
    if (!this.hands[s]) return null
    const hand = [...this.hands[s]].sort((a, b) => SUITS.indexOf(suit(a)) - SUITS.indexOf(suit(b)) || (this.mode === 'hokm' && suit(a) === this.trump ? HOKM_ORDER : SUN_ORDER).indexOf(rank(b)) - (this.mode === 'hokm' && suit(a) === this.trump ? HOKM_ORDER : SUN_ORDER).indexOf(rank(a)))
    return {hand, legal: this.phase === 'play' && this.turn === s ? this.legal(s) : [], team: team(s), projects: (this.projects[s] || []).map(p => PROJ[p.kind].name)}
  }
}
