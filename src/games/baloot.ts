import {cardFace, suitSVG} from '../ui/cardface'
import {portraitURL} from '../ui/pixel'
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
  void x
  return cardFace(c, cls)
}
const modeText = (mode: string, trump: string) => mode === 'sun' ? 'صن ☀' : mode === 'hokm' ? `حكم ${suitSVG(trump, 'ins')}` : ''

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

  seat(id) { return {char: id} },

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

  dock: () => '',

  /** The whole table, seen from above: you at the bottom, your partner across, play goes to your right. */
  scene(c) {
    const s = c.state, me = c.me, mine = s.mine
    const at = (id: string) => ['b', 'r', 't', 'l'][(ORDER.indexOf(id) - ORDER.indexOf(me) + 4) % 4]
    const live = s.phase === 'bid' || s.phase === 'play'
    const t = teamOf(me), o = t === 'a' ? 'b' : 'a'
    const player = (id: string) => {
      const p = s.seats[id], pos = at(id)
      if (!p) return `<div class="pl ${pos} empty"><span class="av"></span><span class="nm">فاضي</span></div>`
      const turn = live && s.turn === id, ours = teamOf(id) === t
      const bid = s.phase === 'bid' && p.bid ? `<i class="bub">${esc(p.bid)}</i>` : ''
      const buy = s.buyer === id && s.mode && s.phase !== 'bid' ? `<i class="buy">${modeText(s.mode, s.trump)}</i>` : ''
      const proj = [...(p.projects || []), ...(p.belote ? ['بلوت'] : [])].map((x: string) => `<i class="proj">${x}</i>`).join('')
      const backs = pos !== 'b' && p.count ? `<span class="backs">${Array.from({length: p.count}, () => '<i></i>').join('')}</span>` : ''
      const tag = id === me ? 'أنت' : id === partner(me) ? 'خويك' : ''
      return `<div class="pl ${pos} ${turn ? 'turn' : ''} ${ours ? 'ours' : 'theirs'}">
        <span class="av"><img src="${portraitURL(id)}" alt=""></span>
        <span class="nm">${esc(p.name)}${tag ? `<small>${tag}</small>` : ''}</span>
        <span class="tags">${bid}${buy}${proj}</span>${backs}</div>`
    }
    let center = ''
    if (s.phase === 'bid' && s.face) center = `<div class="upcard">${cardFace(s.face)}<small>${s.bidRound === 2 ? 'الشراء الثاني' : 'الورقة المكشوفة'}</small></div>`
    else if (s.phase === 'play' || s.phase === 'trick') {
      const win = s.phase === 'trick' && s.trick.length === 4 ? winner(s) : ''
      center = s.trick.map((x: {seat: string; card: string}) => `<div class="tk ${at(x.seat)}">${cardFace(x.card, x.seat === win ? 'win' : '')}</div>`).join('') + (win ? `<div class="cap">${trickText(c)}</div>` : '')
    } else if ((s.phase === 'score' || s.phase === 'over') && s.result) {
      const r = s.result
      const head = s.phase === 'over' ? (s.winner === t ? '🏆 فزتم باللعبة!' : 'فازوا باللعبة') : r.verdict === 'kaboot' ? (r.kaboot === t ? 'كبوت! أكلتوا كل الأكلات' : 'كبوت عليكم!') : r.verdict === 'made' ? `${teamOf(r.buyer) === t ? 'نجحتوا' : 'نجحوا'} في الشراء` : `${teamOf(r.buyer) === t ? 'خسرتوا' : 'خسروا'} الشراء`
      const row = (label: string, a: number, b: number) => `<tr><td>${label}</td><td>${a}</td><td>${b}</td></tr>`
      center = `<div class="bscore"><b>${head}</b><table><tr><th></th><th>لنا</th><th>لهم</th></tr>${row('الأكل', r.raw[t], r.raw[o])}${row('النقاط', r.card[t], r.card[o])}${r.proj[t] || r.proj[o] ? row('المشاريع', r.proj[t], r.proj[o]) : ''}${r.bel[t] || r.bel[o] ? row('بلوت', r.bel[t], r.bel[o]) : ''}${row('هالصفقة', r.got[t], r.got[o])}<tr class="tot"><td>المجموع</td><td>${s.score[t]}</td><td>${s.score[o]}</td></tr></table></div>`
    }
    // Your hand, fanned; playable cards lift up when it's your turn.
    let hand = '', bids = ''
    if (mine?.hand?.length && s.phase !== 'lobby') {
      const myTurn = s.phase === 'play' && s.turn === me, legal = new Set<string>(mine.legal || []), n = mine.hand.length
      hand = (mine.hand as string[]).map((card, i) => {
        const ok = myTurn && legal.has(card)
        return `<button class="hc ${ok ? 'ok' : myTurn ? 'no' : ''}" style="--i:${i - (n - 1) / 2}" data-card="${card}" ${ok ? '' : 'disabled'} aria-label="${card}">${cardFace(card)}</button>`
      }).join('')
    }
    if (s.phase === 'bid' && s.turn === me) {
      const face = s.face ? suit(s.face) : ''
      bids = s.bidRound === 1
        ? `${!s.hokmBy ? `<button class="bb hokm" data-pick="bid" data-bid="hokm">حكم ${suitSVG(face, 'ins')}</button>` : ''}<button class="bb sun" data-pick="bid" data-bid="sun">صن</button><button class="bb pass" data-pick="bid" data-bid="pass">${s.hokmBy ? 'أشكل' : 'بس'}</button>`
        : `<button class="bb sun" data-pick="bid" data-bid="sun">صن</button>${Object.keys(SUIT).filter(x => x !== face).map(x => `<button class="bb hokm" data-pick="bid" data-bid="hokm" data-suit="${x}">حكم ${suitSVG(x, 'ins')}</button>`).join('')}<button class="bb pass" data-pick="bid" data-bid="pass">بس</button>`
    }
    const score = s.score ? `<div class="sb"><div class="us"><small>لنا</small><b>${s.score[t]}</b></div><div class="them"><small>لهم</small><b>${s.score[o]}</b></div><span class="tgt">إلى ${s.target}</span>${s.mode && s.phase !== 'bid' ? `<span class="md">${modeText(s.mode, s.trump)}</span>` : ''}</div>` : ''
    return `<div class="bt"><div class="felt"></div>${score}${ORDER.map(player).join('')}<div class="tmid">${center}</div>${bids ? `<div class="bids">${bids}</div>` : ''}<div class="hand">${hand}</div></div>`
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
