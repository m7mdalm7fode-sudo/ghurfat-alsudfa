import {icon} from '../ui/icons'
import {esc, mountSocial, type GameDef} from './social'

const ROLE: Record<string, {name: string; icon: string; goal: string; color: string}> = {
  mafia: {name: 'ذيب', icon: 'knife', goal: 'اختاروا ضحية كل ليلة، وتخفّوا بالنهار حتى تصيروا الأغلبية', color: '#ff5a5a'},
  doctor: {name: 'الطبيب', icon: 'help', goal: 'احمِ لاعبًا كل ليلة من القتل (ليس نفس الشخص ليلتين متتاليتين)', color: '#5fe08e'},
  detective: {name: 'المحقق', icon: 'look', goal: 'حقق مع لاعب كل ليلة لتعرف إن كان من الذيابة', color: '#6fb3ff'},
  citizen: {name: 'مواطن', icon: 'house', goal: 'اكشفوا الذيابة بالنقاش والتصويت', color: '#e3d6b8'},
}
const TOTAL: Record<string, number> = {night: 45000, dawn: 7000, day: 120000, vote: 45000, verdict: 7000, over: 25000}

const rules = `<h4>الفكرة</h4><ul>
<li>كل لاعب يأخذ دورًا سريًّا: <b class="bad">ذيب</b>، <b class="ok">الطبيب</b>، <b class="ok">المحقق</b> أو <b>مواطن</b>.</li>
<li>الذيابة يعرفون بعضهم. البقية لا يعرفون أحدًا.</li></ul>
<h4>الليل 🌙</h4><ul>
<li>الذيابة يختارون ضحية (🔪 فوق اللاعب)، ويتكلمون سرًّا بينهم في الدردشة.</li>
<li>الطبيب يحمي لاعبًا (💊)، والمحقق يسأل عن لاعب (🔎) ويعرف الجواب فورًا.</li></ul>
<h4>النهار ☀️</h4><ul>
<li>يُعلن من مات ودوره. تناقشوا في الدردشة أو الصوت، ثم صوّتوا (🗳️) لطرد من تشكّون فيه، أو امتنعوا.</li>
<li>الأكثر أصواتًا يُطرد ويُكشف دوره. التعادل = لا أحد يُطرد.</li></ul>
<h4>الفوز</h4><ul><li>أهل المدينة يفوزون بطرد كل الذيابة. الذيابة يفوزون إذا صار عددهم مساويًا للبقية.</li>
<li>من ٤ إلى ١٠ لاعبين. الخادم هو الراوي — لا تحتاجون قائدًا.</li></ul>`

const def: GameDef = {
  id: 'mafia', title: 'الذيابة', titleHTML: '<em>الذيابة</em>', theme: 'village',
  eyebrow: 'أدوار سرية · من ٤ إلى ١٠ لاعبين · الخادم هو الراوي',
  tagline: 'في الديرة القديمة ذيابة لابسين ثياب أهلها. في الليل يختارون ضحية، وفي النهار يجلس الجميع حول النار… فمن تتهم؟',
  rules, lineup: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'],
  timerTotal: p => TOTAL[p] || 30000,
  mood: s => s.phase === 'night' ? 'dark' : s.phase === 'lobby' || s.phase === 'over' ? 'night' : 'day',

  seat(id, p, c) {
    const s = c.state, mine = s.mine || {}, alive = p.inGame ? p.alive : p.connected || Boolean(p.bot), meAlive = s.seats[c.me]?.alive && s.seats[c.me]?.inGame
    const role = p.role ? ROLE[p.role] : null
    let cta = '', badges = ''
    const votes = Object.values(s.seats).filter(x => x.vote === id).length
    if (s.phase === 'vote' || s.phase === 'verdict') badges = votes ? `<i class="vote">${icon('vote')}${votes}</i>` : ''
    if (s.phase === 'day' && p.ready) badges = `<i>${icon('ready')}</i>`
    if (s.phase === 'night' && mine.role === 'mafia' && mine.kill) { const n = Object.values(mine.kill).filter(t => t === id).length; if (n) badges = `<i class="bad">${icon('knife')}${n > 1 ? n : ''}</i>` }
    if (s.phase === 'night' && mine.role === 'doctor' && mine.save === id) badges = `<i>${icon('help')}</i>`
    if (s.phase === 'night' && mine.role === 'detective' && mine.check === id) badges = `<i>${icon('look')}</i>`
    const checked = (mine.checks || []).find((x: {seat: string}) => x.seat === id)
    if (checked && !role) badges += checked.mafia ? '<i class="bad">ذيب!</i>' : '<i class="ok">بريء</i>'
    if (meAlive && alive && p.inGame) {
      if (s.phase === 'night') {
        if (mine.role === 'mafia' && p.role !== 'mafia') cta = icon('knife')
        if (mine.role === 'doctor' && id !== mine.last_save) cta = icon('help')
        if (mine.role === 'detective' && id !== c.me && !mine.check) cta = icon('look')
      }
      if (s.phase === 'vote' && id !== c.me) cta = s.seats[c.me].vote === id ? icon('ready') : icon('vote')
    }
    const tag = !p.inGame && s.phase !== 'lobby' ? 'يشاهد' : role && (!alive || s.phase === 'over' || id === c.me || p.role === 'mafia') ? `${role.name}${!alive ? ' · خرج' : ''}` : !alive ? 'خرج' : ''
    return {char: id, alive, cta, badges, tag, color: role && p.role === 'mafia' && (id === c.me || mine.role === 'mafia' || s.phase === 'over' || !alive) ? '#ff5a5a' : undefined}
  },

  phaseText(c) {
    const s = c.state, mine = s.mine || {}, me = s.seats[c.me], alive = me?.inGame && me.alive
    if (s.phase === 'night') {
      if (!alive) return `الليلة ${s.night} — أنت تشاهد`
      if (mine.role === 'mafia') return 'اختر ضحية الليلة'
      if (mine.role === 'doctor') return mine.save ? 'اخترت من تحميه ✔' : 'اختر من تحميه'
      if (mine.role === 'detective') return mine.check ? 'حققت الليلة ✔' : 'اختر من تحقق معه'
      return `الليلة ${s.night} — نَم وانتظر الفجر`
    }
    if (s.phase === 'dawn') return 'الفجر'
    if (s.phase === 'day') return 'النهار — تناقشوا'
    if (s.phase === 'vote') return alive ? (me.vote ? 'صوّتّ ✔ — بانتظار البقية' : 'صوّت: من تطرد؟') : 'التصويت'
    if (s.phase === 'verdict') return 'حُكم المجلس'
    if (s.phase === 'over') return s.winner === 'town' ? 'فاز أهل المدينة 🏆' : 'فازت الذيابة 🐺'
    return 'بانتظار اللاعبين'
  },

  guide(c) {
    const s = c.state, mine = s.mine || {}, me = s.seats[c.me], live = me?.inGame && me.alive
    if (s.phase === 'over') return {text: 'انتهت اللعبة — ترجعون للمجلس بعد لحظات', mine: false}
    if (!me?.inGame) return {text: 'أنت تشاهد هذه الجولة — تدخل اللعبة الجاية', mine: false}
    if (!live) return {text: 'خرجت من اللعبة 👻 — تقدر تشاهد وتتكلم مع الأموات في 💬', mine: false}
    if (s.phase === 'night') {
      if (mine.role === 'mafia') return {text: `أنت <b class="bad">ذيب</b>: اضغط ${icon('knife')} على اللي تبي تقتله الليلة. تكلم مع ربعك سرًّا في 💬`, mine: true, alert: 'اختر ضحيتك'}
      if (mine.role === 'doctor') return mine.save ? {text: 'اخترت من تحميه ✔ — تقدر تغيّره قبل ما يخلص الوقت', mine: false} : {text: `أنت <b class="ok">الطبيب</b>: اضغط ${icon('help')} على لاعب تحميه من القتل الليلة (تقدر تحمي نفسك)`, mine: true, alert: 'احمِ لاعبًا'}
      if (mine.role === 'detective') return mine.check ? {text: 'حققت الليلة ✔ — الجواب تحت اسمه', mine: false} : {text: `أنت <b class="ok">المحقق</b>: اضغط ${icon('look')} على لاعب وتعرف هل هو ذيب`, mine: true, alert: 'حقق مع لاعب'}
      return {text: 'أنت مواطن: نم وانتظر الفجر… الذيابة يتحركون الحين', mine: false}
    }
    if (s.phase === 'dawn') return {text: 'الفجر: شوفوا مين انقتل الليلة', mine: false}
    if (s.phase === 'day') return me.ready ? {text: 'أنت جاهز ✔ — ننتظر البقية يخلصون نقاش', mine: false} : {text: 'النهار: تناقشوا في 💬 أو بالصوت: مين تشكّون فيه؟ إذا خلصتم اضغط <b>«جاهز للتصويت»</b>', mine: true}
    if (s.phase === 'vote') return me.vote ? {text: 'صوّتّ ✔ — تقدر تغيّر صوتك قبل ما يخلص الوقت', mine: false} : {text: `التصويت: اضغط ${icon('vote')} على اللي تبي تطرده، أو <b>«أمتنع»</b>`, mine: true, alert: 'صوّت الآن'}
    return {text: '', mine: false}
  },

  roleChip(c) {
    const mine = c.state.mine, r = mine?.role && ROLE[mine.role]
    if (!r) return '<b>تشاهد</b>'
    const mates = mine.role === 'mafia' ? Object.entries(c.state.seats).filter(([id, p]) => id !== c.me && p.role === 'mafia').map(([, p]) => esc(p.name)) : []
    return `<b style="color:${r.color}">${icon(r.icon)} ${r.name}</b><small>${r.goal}${mates.length ? ` · معك: ${mates.join('، ')}` : ''}</small>`
  },

  dock(c) {
    const s = c.state, me = s.seats[c.me], alive = me?.inGame && me.alive
    const counts = s.counts ? `<span class="pill">${icon('knife')} ${s.counts.mafia} ذيب · ${icon('help')} ${s.counts.doctor} · ${icon('look')} ${s.counts.detective} · ${icon('house')} ${s.counts.citizen}</span>` : ''
    let act = ''
    if (alive && s.phase === 'day') act = `<button class="ghost ${me.ready ? 'on' : ''}" data-pick="ready">${icon('ready')} ${me.ready ? 'جاهز ✔ (إلغاء)' : 'جاهز للتصويت'}</button>`
    if (alive && s.phase === 'vote') act = `<button class="ghost ${me.vote === 'skip' ? 'on' : ''}" data-pick="skip">أمتنع</button>`
    return `${counts}${act}`
  },

  onSeat(id, c) {
    const s = c.state, mine = s.mine || {}
    if (s.phase === 'night') c.send({kind: mine.role === 'mafia' ? 'kill' : mine.role === 'doctor' ? 'save' : 'check', target: id})
    else if (s.phase === 'vote') c.send({kind: 'vote', target: id})
  },
  onAction(el, c) {
    if (el.dataset.pick === 'ready') c.send({kind: 'ready'})
    if (el.dataset.pick === 'skip') c.send({kind: 'vote', target: 'skip'})
  },
  changed(prev, c) {
    const s = c.state
    if (!prev) return
    for (const [id, p] of Object.entries(s.seats)) if (prev.seats[id]?.alive && !p.alive && p.inGame) c.camp.burst(id, 'death')
    if (prev.phase !== s.phase && s.phase === 'night') c.sfx('count')
    if (prev.phase !== s.phase && s.phase === 'over') c.sfx(s.mine?.role && ((s.winner === 'mafia') === (s.mine.role === 'mafia')) ? 'win' : 'lose')
  },
}

export function mountMafia() { mountSocial(def) }
