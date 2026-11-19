import {CHARACTERS} from '../ui/characters'
import {icon} from '../ui/icons'
import {esc, mountSocial, type Ctx, type GameDef, type SeatPub} from './social'

export const CARD: Record<string, {name: string; icon: string; color: string; hint: string}> = {
  accuse: {name: 'اتهام', icon: '🟥', color: 'red', hint: 'اتهام على لاعب. عند ٧ اتهامات تنكشف إحدى أوراق محاكمته'},
  steal: {name: 'سرقة', icon: '🖐️', color: 'green', hint: 'تأخذ ورقة عشوائية من يد لاعب'},
  peek: {name: 'تحرّي', icon: '🔍', color: 'green', hint: 'ترى سرًّا إحدى أوراق محاكمة لاعب المخفية'},
  help: {name: 'فزعة', icon: '🤝', color: 'green', hint: 'تزيل حتى ٣ اتهامات عن لاعب'},
  camel: {name: 'ناقة', icon: '🐪', color: 'green', hint: 'تنقل كل ما أمام لاعب (اتهامات وأوراق زرقاء والقطة) إلى لاعب آخر'},
  pardon: {name: 'إعفاء', icon: '📜', color: 'green', hint: 'تحرق كل الأوراق الزرقاء والقطة السوداء أمام لاعب'},
  fort: {name: 'حصن', icon: '🏰', color: 'blue', hint: 'تبقى أمامه: الاتهامات لا تُلعب عليه مباشرة'},
  bond: {name: 'ارتباط', icon: '🔗', color: 'blue', hint: 'لاعبان عليهما ارتباط: إن مات أحدهما مات الآخر. ارتباطان على نفس اللاعب يحترقان'},
  wind: {name: 'ريح شوي', icon: '🌬️', color: 'blue', hint: 'يخسر دوره القادم ثم تحترق'},
  weapon: {name: 'سلاح', icon: '🗡️', color: 'blue', hint: 'يحميه من الاغتيال في الليل'},
}
export const ABILITY: Record<string, string> = {
  p1: 'عين الصقر: مرة في اللعبة، في دورك، ترى إحدى أوراق محاكمة لاعب سرًّا',
  p2: 'ثابت: يحتاج ٩ اتهامات بدل ٧',
  p3: 'زاد الطريق: يسحب ٣ أوراق بدل ورقتين',
  p4: 'يختار كلمته: إذا اكتملت الاتهامات عليه يختار هو الورقة التي تنكشف',
  p5: 'الكرم: إذا مات تذهب أوراق يده للاعب الذي بعده',
  p6: 'لا يُمس: لا تُلعب عليه «سرقة» ولا «تحرّي»',
  p7: 'يقرأ الأثر: يرى دائمًا الورقة التي في أعلى الكومة',
  p8: 'كلمته ثقيلة: اتهامه يُحسب اتهامين',
  p9: 'صفاء النية: مرة في اللعبة، في دوره، يحرق كل الاتهامات التي أمامه',
  p10: 'يقظ: ينجو من أول محاولة اغتيال',
  p11: 'بضاعة: يبدأ اللعبة بـ٥ أوراق',
  p12: 'حارس الغنم: مرة في اللعبة يحمي لاعبًا بالدرع في الليل',
}
const TRIAL: Record<string, string> = {ok: 'مسالم', traitor: 'خائن', old: 'الشايب'}
const TOTAL: Record<string, number> = {dawn: 35000, turn: 50000, kill: 35000, confess: 25000, reveal: 8000, choose: 20000, conspiracy: 7000, over: 30000}

const rules = `<h4>الفريقان</h4><ul>
<li>كل لاعب يأخذ أوراق <b>محاكمة</b> مخفية: <b class="ok">مسالم</b>، أو <b class="bad">خائن</b>، أو <b>الشايب</b>. من عنده ورقة «خائن» صار من الخونة ويبقى خائنًا طول اللعبة.</li>
<li>الخونة يعرفون بعضهم من الفجر الأول، ويضعون <b>القطة السوداء</b> 🐈‍⬛ أمام أحد اللاعبين — ويبدأ الدور منه.</li>
<li>كل لاعب يأخذ شخصية من أهل الديرة لها قدرة خاصة تظهر للجميع.</li></ul>
<h4>دورك</h4><ul>
<li>إما <b>تسحب ورقتين</b> وينتهي دورك، أو <b>تلعب</b> ورقة أو أكثر من يدك ثم تنهي دورك.</li>
<li>🟥 الأحمر اتهام: إذا اكتملت ٧ اتهامات على لاعب تنكشف إحدى أوراق محاكمته. 🟩 الأخضر يُنفّذ فورًا. 🟦 الأزرق يبقى أمام اللاعب.</li>
<li>لا تلعب أي ورقة على نفسك.</li></ul>
<h4>الأوراق السوداء</h4><ul>
<li>👁️ <b>المؤامرة</b>: صاحب القطة يكشف ورقة من أوراقه، ثم كل لاعب يأخذ ورقة محاكمة مخفية من جاره. ممكن تصير خائنًا!</li>
<li>🌑 <b>الليل</b>: الخونة يختارون من يغتالون، والشايب يحمي لاعبًا بالدرع. ثم كل لاعب يختار: يخاطر، أو يكشف ورقة محاكمة ليتحصن.</li></ul>
<h4>الموت والفوز</h4><ul>
<li>يموت اللاعب إذا انكشفت ورقة «خائن» عنده، أو انكشفت كل أوراقه، أو اغتيل بالليل.</li>
<li><b class="ok">أهل الديرة</b> يفوزون إذا انكشفت كل أوراق «خائن». <b class="bad">الخونة</b> يفوزون إذا لم يبقَ مسالم حي.</li>
<li>من ٤ إلى ١٢ لاعبًا. الخادم يدير الفجر والليل — لا تحتاجون قائدًا.</li></ul>
<h4>القطع</h4><ul>${Object.entries(CARD).map(([k, c]) => `<li>${icon(k)} <b>${c.name}</b>: ${c.hint}</li>`).join('')}</ul>
<h4>أهل الديرة</h4><ul>${Object.entries(ABILITY).map(([k, a]) => `<li><b style="color:${CHARACTERS[k].color}">${CHARACTERS[k].title}</b> — ${a}</li>`).join('')}</ul>`

const hiddenCount = (p: SeatPub) => (p.trial || []).filter((k: string) => !k).length
const alive = (p?: SeatPub) => Boolean(p?.inGame && p.alive)
const myTurn = (c: Ctx) => c.state.phase === 'turn' && c.state.turn === c.me && !c.state.drawing

/** Can the selected card (or ability) be aimed at this player? */
function aimable(id: string, p: SeatPub, c: Ctx): string {
  const sel = c.sel
  if (id === c.me || !alive(p)) return ''
  if (sel.ability) return hiddenCount(p) ? icon('falcon') : ''
  const k = sel.kind
  if (!k) return ''
  if (k === 'camel') return sel.from ? (id === sel.from ? '' : icon('camel')) : (p.front?.length || p.accused || p.cat ? icon('camel') : '')
  if (k === 'accuse' && p.front?.includes('fort')) return ''
  if ((k === 'steal' || k === 'peek') && p.char === 'p6') return ''
  if (k === 'steal' && !p.hand) return ''
  if (k === 'help' && !p.accused) return ''
  if (k === 'pardon' && !p.front?.length && !p.cat) return ''
  return icon(k)
}

const def: GameDef = {
  id: 'night', title: 'القطوة السوداء', titleHTML: 'القطوة <em>السوداء</em>', theme: 'dunes',
  eyebrow: 'خونة بين أهل الديرة · من ٤ إلى ١٢ لاعبًا',
  tagline: 'بين أهل الديرة خونة لا يعرفهم أحد. بالنهار تتبادلون التهم، وإذا حلّ الليل… اختار الخونة من يغتالون.',
  rules, lineup: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12'],
  timerTotal: p => TOTAL[p] || 30000,
  mood: s => ['kill', 'confess', 'reveal'].includes(s.phase) ? 'dark' : 'night',

  seat(id, p, c) {
    const s = c.state, mine = s.mine, inGame = p.inGame && s.phase !== 'lobby'
    if (!inGame) return {char: p.char || id, tag: s.phase === 'lobby' ? '' : 'يشاهد'}
    const meAlive = alive(s.seats[c.me])
    let cta = ''
    if (meAlive && alive(p)) {
      if (myTurn(c)) cta = aimable(id, p, c)
      else if (s.phase === 'dawn' && mine?.team === 'traitor' && !s.seats[c.me].done) cta = icon('cat')
      else if (s.phase === 'kill' && id !== c.me) {
        if (mine?.team === 'traitor' && !mine.votes?.[c.me]) cta = icon('weapon')
        else if (mine?.can_guard && !mine.guard) cta = icon('shield')
      }
    }
    const trial = (id === c.me && mine ? mine.trial.map((t: {kind: string; open: boolean}) => `<i class="tc t-${t.kind} ${t.open ? '' : 'mine'}" title="${TRIAL[t.kind]}${t.open ? '' : ' (مخفية عن غيرك)'}"></i>`) : (p.trial || []).map((k: string) => `<i class="tc ${k ? `t-${k}` : 't-hid'}" title="${k ? TRIAL[k] : 'مخفية'}"></i>`)).join('')
    const marks = [
      p.accused ? `<i class="acc">${icon('accuse')}${p.accused}/${p.limit}</i>` : '',
      ...(p.front || []).map((k: string) => `<i>${icon(k, CARD[k].name)}</i>`),
      p.cat ? `<i>${icon('cat', 'القطة السوداء')}</i>` : '',
      mine?.votes && mine.votes[c.me] === id ? '<i class="bad">✓</i>' : '',
      mine?.guard === id ? `<i>${icon('shield')}</i>` : '',
      (s.phase === 'kill' || s.phase === 'confess' || s.phase === 'dawn') && p.done && alive(p) && s.phase !== 'dawn' ? '<i class="muted">✔</i>' : '',
    ].join('')
    const ch = CHARACTERS[p.char]
    const team = p.team === 'traitor' ? ' · خائن' : ''
    return {char: p.char, cta, turn: s.phase === 'turn' && s.turn === id, badges: `<span class="tcs">${trial}</span><span class="mk">${marks}${p.hand ? `<i class="hand">${icon('card', 'أوراق في يده')}${p.hand}</i>` : ''}</span>`,
      tag: s.phase === 'turn' && s.turn === id && alive(p) ? (id === c.me ? '▶ دورك' : '▶ يلعب الآن') : `${ch?.title || ''}${team}${!alive(p) ? ' · مات' : ''}`, color: p.team === 'traitor' ? '#ff5a5a' : undefined}
  },

  phaseText(c) {
    const s = c.state, mine = s.mine, me = s.seats[c.me], live = alive(me), name = (id: string) => s.seats[id]?.name || ''
    switch (s.phase) {
      case 'dawn': return live && mine?.team === 'traitor' ? (me.done ? 'وضعت القطة ✔' : 'اختر أمام من تضع القطة السوداء') : 'الفجر — الخونة يتعارفون'
      case 'turn':
        if (s.turn !== c.me) return `دور ${name(s.turn)}`
        if (c.sel.ability) return 'اختر لاعبًا لعين الصقر'
        if (c.sel.kind === 'camel') return c.sel.from ? 'اختر إلى من تنقلها' : 'اختر من تنقل ما أمامه'
        if (c.sel.kind) return `اختر لاعبًا لـ«${CARD[c.sel.kind].name}»`
        return s.played ? 'دورك — العب المزيد أو أنهِ دورك' : 'دورك — اسحب أو العب ورقة'
      case 'choose': return s.choosing === c.me ? 'اختر ورقة محاكمة تكشفها' : `${name(s.choosing)} يختار ورقة`
      case 'conspiracy': return 'المؤامرة! 👁️'
      case 'kill': return !live ? 'الليل' : mine?.team === 'traitor' && !mine.votes?.[c.me] ? 'اختر من تغتال' : mine?.can_guard && !mine.guard ? 'احمِ لاعبًا بالدرع' : 'حلّ الليل — أغمض عينيك'
      case 'confess': return !live ? 'الاعتراف' : mine?.exempt ? 'أنت محمي الليلة ✔' : mine?.confess ? 'اخترت ✔ — بانتظار البقية' : 'خاطر… أو اكشف ورقة لتتحصن'
      case 'reveal': return 'انتهى الليل'
      case 'over': return s.winner === 'village' ? 'فاز أهل الديرة 🏆' : 'فاز الخونة 🏆'
    }
    return '…'
  },

  guide(c) {
    const s = c.state, mine = s.mine, me = s.seats[c.me], live = alive(me), name = (id: string) => `<b>${esc(s.seats[id]?.name || '')}</b>`
    if (s.phase === 'over') return {text: 'انتهت اللعبة — ترجعون للمجلس بعد لحظات', mine: false}
    if (!mine || !me?.inGame) return {text: 'أنت تشاهد هذه الجولة — تدخل اللعبة الجاية', mine: false}
    if (!live) return {text: 'خرجت من اللعبة 👻 — تقدر تشاهد وتتكلم مع الأموات في 💬', mine: false}
    switch (s.phase) {
      case 'dawn': return mine.team === 'traitor' && !me.done
        ? {text: `أنت <b class="bad">خائن</b>: اضغط ${icon('cat')} فوق اللاعب اللي تبي تحط القطة السوداء قدامه — الدور يبدأ منه`, mine: true, alert: 'ضع القطة السوداء'}
        : {text: 'الفجر: الخونة يتعارفون ويحطون القطة السوداء… انتظر', mine: false}
      case 'turn': {
        if (s.turn !== c.me) return {text: `الدور الحين عند ${name(s.turn)} — انتظر دورك، وتابع وش يلعب`, mine: false}
        if (c.sel.ability) return {text: `${icon('falcon')} عين الصقر: اضغط على لاعب وتشوف وحدة من أوراقه المخفية سرًّا`, mine: true}
        if (c.sel.kind === 'camel') return {text: c.sel.from ? `${icon('camel')} الحين اضغط على اللاعب اللي <b>تنقل له</b> كل شي كان قدام ${name(c.sel.from)}` : `${icon('camel')} ناقة: اضغط أولًا على اللاعب اللي <b>تاخذ من قدامه</b>`, mine: true}
        if (c.sel.kind) return {text: `${icon(c.sel.kind)} <b>${CARD[c.sel.kind].name}</b>: ${CARD[c.sel.kind].hint}. اضغط على اللاعب اللي فوقه نفس الأيقونة`, mine: true}
        return s.played
          ? {text: 'تقدر تلعب ورقة ثانية من يدك، أو اضغط <b>«أنهِ دورك»</b>', mine: true}
          : {text: `<b>دورك!</b> اختر واحد: اضغط ورقة من يدك وبعدين اضغط على لاعب — أو اضغط <b>«اسحب»</b> وتاخذ ${me.char === 'p3' ? '٣ أوراق' : 'ورقتين'} وينتهي دورك`, mine: true, alert: 'دورك!'}
      }
      case 'choose': return s.choosing === c.me
        ? {text: 'اكتملت الاتهامات عليك: اختر تحت أي ورقة من أوراق محاكمتك تنكشف للكل', mine: true, alert: 'اختر ورقة تنكشف'}
        : {text: `اكتملت الاتهامات على ${name(s.choosing)} — بتنكشف وحدة من أوراقه`, mine: false}
      case 'conspiracy': return {text: '👁️ المؤامرة: كل لاعب ياخذ ورقة محاكمة مخفية من جاره — ممكن تصير خائن!', mine: false}
      case 'kill':
        if (mine.team === 'traitor' && !mine.votes?.[c.me]) return {text: `حلّ الليل: اضغط ${icon('weapon')} على اللاعب اللي تبون تغتالونه. تكلم مع رفاقك سرًّا في 💬`, mine: true, alert: 'اختر من تغتال'}
        if (mine.can_guard && !mine.guard) return {text: `أنت <b>الشايب</b>: اضغط ${icon('shield')} على لاعب تحميه من الاغتيال الليلة`, mine: true, alert: 'احمِ لاعبًا'}
        return {text: 'حلّ الليل: الخونة يختارون ضحيتهم… انتظر', mine: false}
      case 'confess':
        if (mine.exempt || mine.confess) return {text: 'تم ✔ — ننتظر البقية يختارون', mine: false}
        return {text: 'قرّر: <b>«أخاطر»</b> وممكن تنقتل الليلة، أو <b>اكشف ورقة محاكمة</b> للكل وتنجو أكيد', mine: true, alert: 'تخاطر أو تكشف؟'}
      case 'reveal': return {text: 'طلع الصبح — شوفوا وش صار بالليل', mine: false}
    }
    return {text: '', mine: false}
  },

  roleChip(c) {
    const mine = c.state.mine, me = c.state.seats[c.me]
    if (!mine || !me) return '<b>تشاهد</b>'
    const traitor = mine.team === 'traitor', mates = (mine.mates || []).map((s: string) => esc(c.state.seats[s]?.name || '')).join('، ')
    const peeks = (mine.peeks || []).slice(-3).map((x: {seat: string; kind: string}) => `${esc(c.state.seats[x.seat]?.name || '')}: ${TRIAL[x.kind]}`).join(' · ')
    return `<b style="color:${traitor ? '#ff5a5a' : '#5fe08e'}">${traitor ? `${icon('traitor')} خائن` : `${icon('dove')} مسالم`}${mine.old ? ` · ${icon('shield')} الشايب` : ''}</b>
     <small><b style="color:${CHARACTERS[me.char]?.color}">${CHARACTERS[me.char]?.title}</b> — ${ABILITY[me.char]}${me.used ? ' (استُخدمت)' : ''}</small>
     ${traitor && mates ? `<small class="bad">رفاقك: ${mates}</small>` : ''}${peeks ? `<small>🔍 ${peeks}</small>` : ''}`
  },

  dock(c) {
    const s = c.state, mine = s.mine, me = s.seats[c.me]
    const info = `<span class="pill" title="الكومة · المحروقة">${icon('card')} ${s.deck} · ${icon('burn')} ${s.burn}${mine?.top ? ` · الأعلى: ${mine.top === 'night' ? 'الليل' : mine.top === 'plot' ? 'المؤامرة' : icon(mine.top) + ' ' + CARD[mine.top]?.name}` : ''}</span>`
    if (!mine || !alive(me)) return info
    let out = ''
    if (s.phase === 'confess' && !mine.exempt && !mine.confess) {
      out = `<button class="ghost risk" data-pick="risk">أخاطر</button>${mine.trial.filter((t: {open: boolean}) => !t.open).map((t: {id: number; kind: string}) => `<button class="ghost tcard t-${t.kind}" data-pick="confess" data-id="${t.id}">اكشف «${TRIAL[t.kind]}»</button>`).join('')}`
      return out + info
    }
    if (s.phase === 'choose' && s.choosing === c.me) return mine.trial.filter((t: {open: boolean}) => !t.open).map((t: {id: number; kind: string}) => `<button class="ghost tcard t-${t.kind}" data-pick="reveal" data-id="${t.id}">اكشف «${TRIAL[t.kind]}»</button>`).join('')
    const turn = myTurn(c)
    const hand = mine.hand.map((h: {id: number; kind: string}) => `<button class="pcard c-${CARD[h.kind].color} ${c.sel.card === h.id ? 'active' : ''}" data-card="${h.id}" data-kind="${h.kind}" title="${CARD[h.kind].name}: ${CARD[h.kind].hint}" ${turn ? '' : 'disabled'}><em>${icon(h.kind)}</em><small>${CARD[h.kind].name}</small></button>`).join('')
    const btns = turn ? [
      !s.played ? `<button class="ghost go" data-pick="draw">${icon('card')} اسحب</button>` : '<button class="ghost go" data-pick="end">✔ أنهِ دورك</button>',
      (me.char === 'p1' || me.char === 'p9') && !me.used ? `<button class="ghost ${c.sel.ability ? 'on' : ''}" data-pick="ability">${me.char === 'p1' ? `${icon('falcon')} عين الصقر` : `${icon('beads')} صفاء النية`}</button>` : '',
      c.sel.kind || c.sel.ability ? '<button class="ghost" data-pick="cancel">إلغاء</button>' : '',
    ].join('') : ''
    return `<div class="hand">${hand || '<span class="muted">يدك فارغة</span>'}</div><div class="acts">${btns}${info}</div>`
  },

  onSeat(id, c) {
    const s = c.state, mine = s.mine
    if (s.phase === 'dawn') return c.send({kind: 'cat', target: id})
    if (s.phase === 'kill') return c.send({kind: mine?.team === 'traitor' && !mine.votes?.[c.me] ? 'kill' : 'guard', target: id})
    if (!myTurn(c)) return
    if (c.sel.ability) { c.send({kind: 'ability', target: id}); delete c.sel.ability; return c.render() }
    if (c.sel.kind === 'camel' && !c.sel.from) { c.sel.from = id; return c.render() }
    if (c.sel.card) {
      c.send(c.sel.kind === 'camel' ? {kind: 'play', card: c.sel.card, target: c.sel.from, to: id} : {kind: 'play', card: c.sel.card, target: id})
      for (const k of Object.keys(c.sel)) delete c.sel[k]
      c.render()
    }
  },
  onAction(el, c) {
    const sel = c.sel
    if (el.dataset.card) {
      const id = Number(el.dataset.card), was = sel.card
      for (const k of Object.keys(sel)) delete sel[k]
      if (was !== id && c.state.mine?.hand.some((h: {id: number}) => h.id === id)) { sel.card = id; sel.kind = el.dataset.kind }
      return c.render()
    }
    const p = el.dataset.pick
    if (p === 'draw' || p === 'end') { for (const k of Object.keys(sel)) delete sel[k]; c.send({kind: p}) }
    else if (p === 'ability') {
      for (const k of Object.keys(sel)) delete sel[k]
      if (c.state.seats[c.me].char === 'p9') c.send({kind: 'ability'}); else { sel.ability = true; c.render() }
    }
    else if (p === 'cancel') { for (const k of Object.keys(sel)) delete sel[k]; c.render() }
    else if (p === 'risk') c.send({kind: 'confess', card: 'risk'})
    else if (p === 'confess') c.send({kind: 'confess', card: Number(el.dataset.id)})
    else if (p === 'reveal') c.send({kind: 'reveal', card: Number(el.dataset.id)})
  },
  changed(prev, c) {
    const s = c.state
    c.camp.cat = Object.keys(s.seats).find(id => s.seats[id].cat) || ''
    if (!prev) return
    for (const [id, p] of Object.entries(s.seats)) {
      const q = prev.seats[id]
      if (q?.alive && !p.alive && p.inGame && s.phase !== 'lobby') c.camp.burst(id, 'death')
      else if (q && (p.trial || []).filter(Boolean).length > (q.trial || []).filter(Boolean).length && s.phase !== 'over') c.camp.burst(id, 'reveal')
    }
    if (prev.phase !== s.phase && s.phase === 'kill') { c.camp.burst('', 'flash'); c.sfx('count') }
    if (prev.phase !== s.phase && s.phase === 'turn' && s.turn === c.me) c.sfx('rack')
    if (prev.turn !== s.turn && s.turn === c.me && s.phase === 'turn') c.sfx('rack')
    if (prev.phase !== s.phase && s.phase === 'over') c.sfx(s.mine && ((s.winner === 'traitors') === (s.mine.team === 'traitor')) ? 'win' : 'lose')
  },
}

export function mountNight() { mountSocial(def) }
