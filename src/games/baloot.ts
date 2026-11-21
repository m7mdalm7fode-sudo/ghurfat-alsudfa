import {cardURL} from '../ui/cards'
import {icon} from '../ui/icons'
import {esc, mountSocial, type Ctx, type GameDef} from './social'

/**
 * «بلوت»: four seats around the brazier in an istiraha, you and your partner facing each other.
 * The hand sits in the bottom dock; the face-up card, the current trick and the round summary
 * show in the middle of the table.
 */
const SUIT: Record<string, {sym: string; name: string; red: boolean}> = {
  S: {sym: '♠', name: 'سبيت', red: false}, H: {sym: '♥', name: 'هاص', red: true}, C: {sym: '♣', name: 'شريا', red: false}, D: {sym: '♦', name: 'ديمن', red: true},
}
const ORDER = ['p1', 'p2', 'p3', 'p4']
const TOTAL: Record<string, number> = {bid: 25000, play: 30000, trick: 1500, score: 9000, over: 25000}
const rank = (c: string) => c.slice(0, -1), suit = (c: string) => c.slice(-1)
const teamOf = (s: string) => (s === 'p1' || s === 'p3' ? 'a' : 'b')
const partner = (s: string) => ORDER[(ORDER.indexOf(s) + 2) % 4]

export function cardHTML(c: string, cls = '') {
  const x = SUIT[suit(c)]
  return `<img class="bcard ${cls}" src="${cardURL(c)}" alt="${rank(c)} ${x.name}" draggable="false">`
}
const modeText = (mode: string, trump: string) => mode === 'sun' ? 'صن ☀' : mode === 'hokm' ? `حكم ${SUIT[trump].sym} ${SUIT[trump].name}` : ''

const rules = `<h4>الفكرة</h4><ul>
<li>أربعة لاعبين في فريقين: أنت وخويك اللي قدامك، ضد اللي على يمينك ويسارك. أول فريق يوصل <b>١٥٢</b> يفوز.</li>
<li>ما عندكم أربعة؟ ابدأ عادي — <b>البوت</b> يلعب في المقاعد الفاضية.</li></ul>
<h4>الشراء</h4><ul>
<li>كل لاعب ياخذ ٥ أوراق وتنكشف ورقة في النص. بالدور كل واحد يقول: <b>حكم</b> (لون الورقة المكشوفة يصير الحكم)، أو <b>صن</b> (بدون حكم)، أو <b>بس</b>.</li>
<li>الصن يغلب الحكم. إذا الكل قال بس، فيه جولة ثانية تقدر تختار فيها حكم بلون ثاني.</li>
<li>المشتري ياخذ الورقة المكشوفة + ورقتين، والباقين ٣ أوراق — كل واحد يصير عنده ٨.</li></ul>
<h4>اللعب</h4><ul>
<li>لازم تلعب من نفس اللون اللي نزل أول. إذا ما عندك وفي حكم، لازم تدق بالحكم (إلا إذا خويك ماسك الأكلة)، وإذا تقدر تكبّر لازم تكبّر.</li>
<li>أعلى ورقة تاخذ الأكلة. الترتيب في الصن: A ثم 10 ثم K Q J 9 8 7. في الحكم: J ثم 9 ثم A 10 K Q 8 7.</li></ul>
<h4>الحساب</h4><ul>
<li>الأوراق: A=11، 10=10، K=4، Q=3، J=2. في الحكم: الولد J=20 والتسعة=14. آخر أكلة +10.</li>
<li>المشاريع تنحسب لحالها: سرا (٣ ورا بعض)، خمسين (٤)، مية (٥ أو أربع صور)، أربعمية (أربع إكك في الصن)، وبلوت (الشايب والبنت من الحكم).</li>
<li>إذا المشتري ما جاب أكثر من خصمه، يخسر وكل النقاط تروح للخصم. وإذا فريق أكل كل الأكلات = <b>كبوت</b>.</li></ul>`

const def: GameDef = {
  id: 'baloot', title: 'بلوت', titleHTML: '<em>بلوت</em>', theme: 'istiraha',
  eyebrow: 'لعبة ورق جماعية · ٤ لاعبين في فريقين · البوت يكمّل الناقص',
  tagline: 'ليلة استراحة، أنوار ملونة وفريقين متقابلين. اشترِ صن أو حكم، العب أكلاتك صح، وخلّ خويك يفهمك بدون كلام.',
  rules, lineup: ORDER, ccw: true, lobbyNote: 'البلوت لازم أربعة: أي مقعد فاضي يكمّله بوت تلقائيًا عند البدء',
  timerTotal: p => TOTAL[p] || 30000,
  mood: () => 'night',

  seat(id, p, c) {
    const s = c.state, me = c.me, inGame = s.phase !== 'lobby' && p.inGame
    if (!inGame) return {char: id, tag: p.bot ? 'بوت' : ''}
    const rel = id === me ? '' : id === partner(me) ? 'خويك' : 'خصم'
    const bid = s.phase === 'bid' && p.bid ? `<i class="bid">${esc(p.bid)}</i>` : ''
    const buyer = s.buyer === id && s.mode ? `<i class="bid buy">${modeText(s.mode, s.trump)}</i>` : ''
    const proj = (p.projects || []).length ? `<i class="ok">${(p.projects as string[]).join(' + ')}</i>` : ''
    const bel = p.belote ? '<i class="ok">بلوت</i>' : ''
    const turn = s.turn === id
    return {char: id, turn, badges: `${bid}${buyer}${proj}${bel}${p.count && id !== me ? `<i class="muted">${icon('card')}${p.count}</i>` : ''}`,
      tag: turn ? (id === me ? '▶ دورك' : '▶ يلعب الآن') : `${rel}${p.bot ? (rel ? ' · بوت' : 'بوت') : ''}`,
      color: teamOf(id) === teamOf(me) ? '#e8b84a' : '#6fb3ff'}
  },

  phaseText(c) {
    const s = c.state, name = (id: string) => (id === c.me ? 'أنت' : s.seats[id]?.name || '')
    if (s.phase === 'bid') return s.turn === c.me ? 'دورك — تشتري؟' : `${name(s.turn)} يقرر يشتري…`
    if (s.phase === 'play') return s.turn === c.me ? 'دورك — العب ورقة' : `دور ${name(s.turn)}`
    if (s.phase === 'trick') return trickText(c)
    if (s.phase === 'score') return 'نهاية الصفقة'
    if (s.phase === 'over') return s.winner === teamOf(c.me) ? 'فزتم 🏆' : 'خسرتم هالمرة'
    return 'بانتظار اللاعبين'
  },

  roleChip(c) {
    const s = c.state, t = teamOf(c.me), o = t === 'a' ? 'b' : 'a'
    if (!s.score) return ''
    return `<b><span class="ok">لنا ${s.score[t]}</span> · <span class="bad">لهم ${s.score[o]}</span></b><small>من ${s.target}${s.mode ? ` · ${modeText(s.mode, s.trump)} — اشتراه ${esc(s.buyer === c.me ? 'أنت' : s.seats[s.buyer]?.name || '')}` : ''}</small>`
  },

  center(c) {
    const s = c.state, me = c.me
    const pos = (id: string) => ['b', 'r', 't', 'l'][(ORDER.indexOf(id) - ORDER.indexOf(me) + 4) % 4]
    if (s.phase === 'bid' && s.face) return `<div class="btable"><div class="face">${cardHTML(s.face, 'big')}<small>الورقة المكشوفة</small></div></div>`
    if (s.phase === 'play' || s.phase === 'trick') {
      const win = s.phase === 'trick' && s.trick.length === 4 ? winner(s) : ''
      return `<div class="btable">${s.trick.map((t: {seat: string; card: string}) => `<div class="slot ${pos(t.seat)}">${cardHTML(t.card, t.seat === win ? 'win' : '')}</div>`).join('')}
        <div class="mode">${modeText(s.mode, s.trump)}</div></div>`
    }
    if ((s.phase === 'score' || s.phase === 'over') && s.result) {
      const r = s.result, t = teamOf(me), o = t === 'a' ? 'b' : 'a'
      const head = r.verdict === 'kaboot' ? (r.kaboot === t ? 'كبوت! أكلتوا كل الأكلات' : 'كبوت عليكم!') : r.verdict === 'made' ? `${teamOf(r.buyer) === t ? 'نجحتوا' : 'نجحوا'} في الشراء` : `${teamOf(r.buyer) === t ? 'خسرتوا' : 'خسروا'} الشراء`
      const row = (label: string, a: number, b: number) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td></tr>`
      return `<div class="bscore chip"><b>${s.phase === 'over' ? (s.winner === t ? '🏆 فزتم باللعبة!' : 'فازوا باللعبة') : head}</b>
        <table><tr><th></th><th>لنا</th><th>لهم</th></tr>${row('الأكل', r.raw[t], r.raw[o])}${row('النقاط', r.card[t], r.card[o])}${r.proj[t] || r.proj[o] ? row('المشاريع', r.proj[t], r.proj[o]) : ''}${r.bel[t] || r.bel[o] ? row('بلوت', r.bel[t], r.bel[o]) : ''}${row('لكم هالصفقة', r.got[t], r.got[o])}<tr class="tot"><td>المجموع</td><td>${s.score[t]}</td><td>${s.score[o]}</td></tr></table></div>`
    }
    return ''
  },

  dock(c) {
    const s = c.state, mine = s.mine, me = s.seats[c.me]
    if (!mine || !me?.inGame) return ''
    const myTurn = s.turn === c.me
    const legal = new Set<string>(mine.legal || [])
    const hand = (mine.hand as string[]).map(card => {
      const ok = s.phase === 'play' && myTurn && legal.has(card)
      return `<button class="bbtn ${ok ? 'ok' : myTurn && s.phase === 'play' ? 'no' : ''}" data-card="${card}" ${ok ? '' : 'disabled'} aria-label="${card}">${cardHTML(card)}</button>`
    }).join('')
    let acts = ''
    if (s.phase === 'bid' && myTurn) {
      const face = s.face ? suit(s.face) : ''
      acts = s.bidRound === 1
        ? `${!s.hokmBy ? `<button class="ghost go" data-pick="bid" data-bid="hokm">حكم ${SUIT[face].sym}</button>` : ''}<button class="ghost go" data-pick="bid" data-bid="sun">صن ☀</button><button class="ghost" data-pick="bid" data-bid="pass">${s.hokmBy ? 'أشكل' : 'بس'}</button>`
        : `<button class="ghost go" data-pick="bid" data-bid="sun">صن ☀</button>${Object.keys(SUIT).filter(x => x !== face).map(x => `<button class="ghost" data-pick="bid" data-bid="hokm" data-suit="${x}">حكم ${SUIT[x].sym}</button>`).join('')}<button class="ghost" data-pick="bid" data-bid="pass">بس</button>`
    }
    const proj = mine.projects?.length && s.phase === 'play' && !s.seats[c.me].projects?.length ? `<span class="pill">مشاريعك: ${mine.projects.join(' + ')}</span>` : ''
    return `<div class="bhand">${hand}</div><div class="acts">${acts}${proj}</div>`
  },

  onSeat() {},
  onAction(el, c) {
    if (el.dataset.card) c.send({kind: 'play', card: el.dataset.card})
    if (el.dataset.pick === 'bid') c.send({kind: 'bid', bid: el.dataset.bid, suit: el.dataset.suit})
  },
  changed(prev, c) {
    const s = c.state
    if (!prev) return
    if (prev.phase !== 'trick' && s.phase === 'trick') c.sfx('click')
    if (prev.phase !== s.phase && s.phase === 'score') c.sfx(s.result && (s.result.got[teamOf(c.me)] > s.result.got[teamOf(c.me) === 'a' ? 'b' : 'a']) ? 'heal' : 'hit')
    if (prev.phase !== s.phase && s.phase === 'over') c.sfx(s.winner === teamOf(c.me) ? 'win' : 'lose')
  },
}

function trickText(c: Ctx) {
  const s = c.state
  if (s.trick.length < 4) return ''
  const w = winner(s)
  return w === c.me ? 'الأكلة لك 👏' : w === partner(c.me) ? 'الأكلة لخويك 👏' : `الأكلة لـ${s.seats[w]?.name || ''}`
}

/** Winner of a full trick (mirrors the server's ranking). */
function winner(s: Ctx['state']): string {
  const SUN = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'], HOKM = ['7', '8', 'Q', 'K', '10', 'A', '9', 'J']
  const led = suit(s.trick[0].card)
  const pow = (c: string) => (s.mode === 'hokm' && suit(c) === s.trump ? 100 + HOKM.indexOf(rank(c)) : suit(c) === led ? SUN.indexOf(rank(c)) : -1)
  return s.trick.reduce((a: {seat: string; card: string}, b: {seat: string; card: string}) => (pow(b.card) > pow(a.card) ? b : a)).seat
}

export function mountBaloot() { mountSocial(def) }
