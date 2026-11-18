import {Audio, type Sfx} from '../engine/audio'
import {Connection, bootstrapUrl, type ConnectionState} from '../net/connection'
import {BUILD, generateRoom, sanitizeRoom, parseEnvelope} from '../net/protocol'
import {inviteUrl, loadResume, resolveRoom, storeResume, writeRoom} from '../net/session'
import {Camp, type CampSeat, type Mood, type Theme} from '../ui/camp'
import {CHARACTERS} from '../ui/characters'
import {portraitURL} from '../ui/pixel'

/**
 * Shared screens for the hidden-role games: title + lobby, the camp scene with a HUD on top, chat,
 * event log and connection handling. Each game supplies a `GameDef` that turns the server's
 * per-player state into seat labels, the bottom dock and actions.
 */
export type LogEntry = {id: number; text: string; kind: string}
export type SeatPub = {name: string; connected: boolean; inGame: boolean; alive: boolean; [k: string]: any}
export type SocialState = {
  type: 'state'; marker: string; room: string; game: string; seq: number; phase: string; ends_in: number
  host: string; min: number; max: number; notice: string; seats: Record<string, SeatPub>; log: LogEntry[]; mine: any; [k: string]: any
}
export type Ctx = {
  me: string; state: SocialState; sel: Record<string, any>
  send(m: Record<string, unknown>): void; say(text: string): void; sfx(n: Sfx): void; render(): void; camp: Camp
}
export type GameDef = {
  id: 'mafia' | 'night'; title: string; titleHTML: string; eyebrow: string; tagline: string; rules: string; theme: Theme
  lineup: string[]
  mood(s: SocialState): Mood
  seat(id: string, p: SeatPub, ctx: Ctx): Partial<CampSeat>
  phaseText(ctx: Ctx): string
  /** HUD chip under the phase box: who you are this game. */
  roleChip(ctx: Ctx): string
  dock(ctx: Ctx): string
  onSeat(id: string, ctx: Ctx): void
  onAction(el: HTMLElement, ctx: Ctx): void
  /** Called on every new state (after the previous one) for sounds and effects. */
  changed?(prev: SocialState | null, ctx: Ctx): void
  timerTotal(phase: string): number
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[c]!))
export {esc}
const NAME_KEY = 'chamber6_name', PREFS_KEY = 'chamber6_prefs'
const CONN_TEXT: Record<ConnectionState, string> = {stopped: 'غير متصل', discovering: 'جارٍ البحث عن المجلس…', connecting: 'جارٍ الاتصال…', open: 'متصل', retry: 'انقطع الاتصال — نعيد المحاولة…', unavailable: 'خادم اللعب غير متاح'}
const ERRORS: Record<string, string> = {not_your_turn: 'ليس دورك الآن', invalid_target: 'لا يمكن اختيار هذا اللاعب', not_ready: 'ليس الآن', invalid_message: 'لا يمكن ذلك الآن', not_host: 'المضيف فقط يبدأ اللعبة', need_players: 'تحتاج 4 لاعبين على الأقل', quiet: 'لا يمكنك الكلام الآن', fort: 'عليه «حصن» — الاتهام لا يصله', guarded: 'الحارس لا يُسرق ولا يُتحرّى عنه', empty: 'لا يوجد ما تأخذه أو تزيله منه', used: 'استخدمت قدرتك من قبل', same_save: 'لا يمكنك حماية نفس الشخص ليلتين متتاليتين', already: 'حققت الليلة بالفعل'}
function readJSON<T>(k: string, f: T): T { try { const v = localStorage.getItem(k); return v ? {...f, ...JSON.parse(v)} : f } catch { return f } }
function writeJSON(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* blocked */ } }
function readText(k: string) { try { return localStorage.getItem(k) || '' } catch { return '' } }
function writeText(k: string, v: string) { try { localStorage.setItem(k, v) } catch { /* blocked */ } }
const cleanName = (v: string) => v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14)

export function mountSocial(def: GameDef) {
  document.title = def.title
  const root = document.querySelector('#ui')!
  const prefs = readJSON(PREFS_KEY, {calm: matchMedia('(prefers-reduced-motion: reduce)').matches, sound: true})
  let room = resolveRoom(), me = 'spectator', lastSeq = -1, conn: ConnectionState = 'stopped', state: SocialState | null = null
  let endsAt = 0, seenLog = 0, audio: Audio | null = null, pingTimer = 0, unread = 0, chatOpen = false
  const sel: Record<string, any> = {}
  const lineup = def.lineup.map(c => `<figure class="hero-char" style="--c:${CHARACTERS[c].color}"><img class="figure" src="${portraitURL(c)}" alt="${CHARACTERS[c].title}"><figcaption><b>${CHARACTERS[c].title}</b></figcaption></figure>`).join('')
  root.innerHTML = `<main class="app ${def.id}">
<section class="title-view" data-view="title">
 <div class="title-copy">
  <a class="back-hub" href="./">→ كل الألعاب</a>
  <p class="eyebrow">${def.eyebrow}</p>
  <h1>${def.titleHTML}</h1>
  <p class="tagline">${def.tagline}</p>
  <div class="room-form">
   <label for="nm">اسمك في المجلس</label><input id="nm" class="name-input" maxlength="14" placeholder="مثلًا: أبو فهد" value="${esc(readText(NAME_KEY))}">
   <label for="rm">رمز الغرفة</label><input id="rm" class="room-input" maxlength="8" value="${esc(room)}">
   <button class="primary" data-action="play">ادخل المجلس</button>
  </div>
  <details class="rules"><summary>كيف تُلعب؟</summary>${def.rules}</details>
 </div>
 <div class="hero-side"><div class="title-stage"></div><div class="hero-lineup many">${lineup}</div></div>
</section>
<section class="game-view" data-view="game">
 <div class="frame">
  <div class="stage-host"></div>
  <div class="hudx topbar">
   <div class="side"><button class="ibtn" data-action="menu" aria-label="القائمة">☰</button><button class="ibtn chat-btn" data-action="chat" aria-label="الدردشة">💬<i class="unread" hidden></i></button><span class="status-dot"></span><button class="role-chip chip" data-action="menu" title="دورك — اضغط للتفاصيل"></button></div>
   <div class="turn chip"><div class="phase">…</div><div class="timer"><i></i></div><div class="notice"></div></div>
  </div>
  <div class="hudx sdock"></div>
  <div class="hudx lobby-card chip" hidden></div>
  <div class="hudx chat-pop chip" hidden><ol class="chat-log"></ol><form class="chat-form"><input maxlength="140" placeholder="اكتب رسالة…" aria-label="رسالة"><button class="ghost" type="submit">إرسال</button></form></div>
  <div class="hudx menu-pop chip" hidden>
   <div class="role-info"></div>
   <div class="row"><b class="room-label"></b><span class="conn-text">غير متصل</span></div>
   <div class="row"><button class="ghost" data-action="invite">📨 نسخ الدعوة</button><button class="ghost toggle" data-action="sound" aria-pressed="true">🔊 الصوت</button><button class="ghost toggle" data-action="calm" aria-pressed="false">حركة أقل</button><button class="ghost" data-action="leave">🚪 خروج</button></div>
   <ol class="log" aria-label="ما حدث"></ol>
  </div>
 </div>
 <div class="overlay" hidden><div class="overlay-card"><div class="spinner" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 4 38 22 56 16 44 32 56 48 38 42 32 60 26 42 8 48 20 32 8 16 26 22Z" fill="none" stroke="#e8b84a" stroke-width="3"/></svg></div><p class="overlay-text"></p><button class="primary small" data-action="retry" hidden>حاول مجددًا</button></div></div>
 <div class="toast" role="status"></div>
</section></main>`

  const $ = <T extends HTMLElement>(q: string) => root.querySelector<T>(q)!
  const title = $('[data-view="title"]'), view = $('[data-view="game"]'), overlay = $('.overlay'), toast = $('.toast'), phase = $('.phase'), notice = $('.notice'), timer = $('.timer')
  const dock = $('.sdock'), lobby = $('.lobby-card'), chatPop = $('.chat-pop'), chatLog = $('.chat-log'), menuPop = $('.menu-pop'), logEl = $('.log'), roleChip = $('.role-chip')
  const camp = new Camp($('.stage-host'), def.theme, id => { if (ctx()) def.onSeat(id, ctx()!) })
  camp.setActive(false)
  // Title backdrop: everyone sitting around the fire.
  const demo = new Camp($('.title-stage'), def.theme)
  demo.update(def.lineup.slice(0, 8).map((c, i) => ({id: c, char: c, name: CHARACTERS[c].title, present: true, alive: true, me: false, turn: i === 0, cta: '', tag: '', badges: ''})), '')
  let demoTurn = 0
  window.setInterval(() => { demoTurn = (demoTurn + 1) % 8; demo.update(def.lineup.slice(0, 8).map((c, i) => ({id: c, char: c, name: CHARACTERS[c].title, present: true, alive: true, me: false, turn: i === demoTurn, cta: '', tag: '', badges: ''})), '') }, 1800)

  let toastTimer = 0
  const say = (text: string) => { toast.textContent = text; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('on'), 2800) }
  const sfx = (n: Sfx) => { if (prefs.sound) audio?.play(n) }
  const send = (m: Record<string, unknown>) => { if (!connection.send(JSON.stringify(m))) say('الاتصال غير جاهز بعد') }
  const ctx = (): Ctx | null => state ? {me, state, sel, send: m => send({type: 'act', ...m}), say, sfx, render: () => render(), camp} : null

  function applyPrefs() {
    document.documentElement.classList.toggle('calm', prefs.calm); camp.calm = demo.calm = prefs.calm
    $('[data-action="calm"]').setAttribute('aria-pressed', String(prefs.calm)); $('[data-action="sound"]').setAttribute('aria-pressed', String(prefs.sound)); writeJSON(PREFS_KEY, prefs)
  }
  applyPrefs()

  function showConn() {
    $('.conn-text').textContent = CONN_TEXT[conn]
    $('.status-dot').className = `status-dot ${conn === 'open' ? 'on' : conn === 'unavailable' ? 'off' : 'wait'}`
    const blocking = view.classList.contains('is-live') && (conn !== 'open' || !state)
    overlay.hidden = !blocking
    if (blocking) {
      $('.overlay-text').textContent = conn === 'unavailable' ? 'خادم اللعب غير متاح الآن. حاول مجددًا بعد قليل.' : conn === 'open' ? 'جارٍ تجهيز مقعدك في المجلس…' : `${CONN_TEXT[conn]} (قد يستغرق الخادم نصف دقيقة ليستيقظ)`
      $('[data-action="retry"]').hidden = conn !== 'unavailable'
      overlay.classList.toggle('error', conn === 'unavailable')
    }
  }

  const connection = new Connection({
    state: s => { conn = s; showConn(); clearInterval(pingTimer); if (s === 'open') pingTimer = window.setInterval(() => connection.send(JSON.stringify({type: 'ping', t: Date.now()})), 3000) },
    text: text => {
      const m = parseEnvelope(text) as any
      if (!m || m.marker !== BUILD || m.room !== room) return
      connection.confirmActivity()
      if (m.type === 'welcome' && m.game === def.id) { me = m.role; lastSeq = -1; storeResume(`${def.id}_${room}`, connection.endpoint, m.resume_token); sfx('join'); if (me === 'spectator') say('المجلس ممتلئ — أنت تشاهد') }
      else if (m.type === 'welcome') { connection.stop(); conn = 'unavailable'; showConn(); $('.overlay-text').textContent = 'خادم اللعب لم يُحدَّث بعد لهذه اللعبة — جرّب بعد قليل.' }
      else if (m.type === 'state' && m.game === def.id && m.seq > lastSeq) { lastSeq = m.seq; onState(m) }
      else if (m.type === 'chat') onChat(m)
      else if (m.type === 'error') { say(ERRORS[m.code] || 'لا يمكن ذلك'); sfx('ui') }
    },
    lost: () => say('انقطع الاتصال — نحاول العودة إلى مقعدك'),
  })

  function onState(s: SocialState) {
    const prev = state
    state = s
    endsAt = performance.now() + s.ends_in
    if (prev && prev.phase !== s.phase) { for (const k of Object.keys(sel)) delete sel[k] }
    // New log lines: toast the newest private/important one, play a sound per kind.
    const fresh = s.log.filter(e => e.id > seenLog)
    if (seenLog && fresh.length) {
      const last = fresh[fresh.length - 1]
      say(last.text)
      const k = last.kind
      sfx(k === 'death' ? 'hit' : k === 'win' ? 'win' : k === 'night' ? 'count' : k === 'accuse' ? 'click' : k === 'draw' ? 'load' : k === 'bad' ? 'lose' : k === 'good' || k === 'safe' ? 'heal' : k === 'plot' ? 'rack' : 'item')
    }
    if (s.log.length) seenLog = Math.max(seenLog, s.log[s.log.length - 1].id)
    logEl.innerHTML = [...s.log].reverse().slice(0, 14).map(e => `<li class="${e.kind}">${esc(e.text)}</li>`).join('')
    if (s.phase === 'over' && prev?.phase !== 'over') camp.showStamp(s.notice, 'win')
    if (s.phase !== 'over') camp.hideStamp()
    def.changed?.(prev, ctx()!)
    render()
  }

  function onChat(m: {from: string; name: string; text: string; scope: string}) {
    const li = document.createElement('li')
    li.className = m.scope
    li.innerHTML = `<b style="color:${CHARACTERS[charOf(m.from)]?.color || '#e8b84a'}">${esc(m.from === me ? 'أنت' : m.name)}${m.scope === 'team' ? ' 🤫' : m.scope === 'dead' ? ' 👻' : ''}:</b> ${esc(m.text)}`
    chatLog.appendChild(li)
    while (chatLog.children.length > 60) chatLog.firstElementChild!.remove()
    chatLog.scrollTop = chatLog.scrollHeight
    if (!chatOpen && m.from !== me) { unread++; sfx('ui') }
    showUnread()
  }
  const showUnread = () => { const u = $('.unread'); u.hidden = !unread; u.textContent = unread > 9 ? '9+' : String(unread) }
  const charOf = (id: string) => state?.seats[id]?.char || id

  /** Only touch the DOM when the markup changed, so a tap is never lost to a re-render. */
  const setHTML = (el: HTMLElement, html: string) => { if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html } }
  function render() {
    const s = state, c = ctx()
    if (!s || !c) return
    const ids = Object.keys(s.seats).filter(id => s.seats[id].inGame || s.phase === 'lobby' || s.seats[id].connected)
    const seats: CampSeat[] = ids.map(id => {
      const p = s.seats[id]
      return {id, char: id, name: p.name, present: true, alive: s.phase === 'lobby' || !p.inGame ? p.connected : p.alive, me: id === me, turn: false, cta: '', tag: '', badges: '', dim: !p.connected, ...def.seat(id, p, c)}
    })
    camp.mood = def.mood(s)
    camp.update(seats, me)
    phase.textContent = def.phaseText(c)
    phase.className = `phase ${/دورك|اختر/.test(phase.textContent) ? 'mine' : ''}`
    notice.textContent = s.phase === 'lobby' || s.phase === 'turn' ? '' : s.notice
    const role = s.phase === 'lobby' ? '' : def.roleChip(c)
    setHTML(roleChip, role)
    setHTML($('.role-info'), role)
    roleChip.hidden = !roleChip.innerHTML
    setHTML(dock, s.phase === 'lobby' ? '' : def.dock(c))
    // Lobby: who is here, invite, and the host's start button.
    lobby.hidden = s.phase !== 'lobby'
    if (s.phase === 'lobby') {
      const n = Object.values(s.seats).filter(p => p.connected).length, host = s.host === me
      setHTML(lobby, `<b>${def.title}</b><span>في المجلس ${n} من ${s.max} — تحتاجون ${s.min} على الأقل</span>
       <div class="row"><button class="ghost" data-action="invite">📨 ادعُ أصحابك</button>${host ? `<button class="primary small" data-action="start" ${n < s.min ? 'disabled' : ''}>▶ ابدأ اللعبة</button>` : `<span class="muted">بانتظار ${esc(s.seats[s.host]?.name || 'المضيف')} ليبدأ…</span>`}</div>`)
    }
    $('.room-label').textContent = room
    showConn()
  }

  function landscape() { try { const el = document.documentElement as HTMLElement & {webkitRequestFullscreen?: () => void}; const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.(); Promise.resolve(p).then(() => (screen.orientation as ScreenOrientation & {lock?: (o: string) => Promise<void>}).lock?.('landscape')).catch(() => {}) } catch { /* not supported */ } }
  function connect() {
    lastSeq = -1; state = null; seenLog = 0; chatLog.innerHTML = ''; unread = 0; showUnread()
    const name = cleanName($<HTMLInputElement>('.name-input').value)
    connection.discover(bootstrapUrl(location.href), BUILD, e => { const r = loadResume(`${def.id}_${room}`, e); return `${e}?room=${encodeURIComponent(room)}&game=${def.id}${r ? `&resume=${encodeURIComponent(r)}` : ''}${name ? `&name=${encodeURIComponent(name)}` : ''}` })
    showConn()
  }

  $('.chat-form').addEventListener('submit', e => {
    e.preventDefault()
    const input = $<HTMLInputElement>('.chat-form input'), text = input.value.trim()
    if (!text) return
    connection.send(JSON.stringify({type: 'chat', text})); input.value = ''
  })
  root.addEventListener('click', e => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-card],[data-pick]')
    if (!el) return
    if (!audio) { try { audio = new Audio(); audio.setVolumes(0, .9) } catch { audio = null } }
    audio?.unlock()
    const a = el.dataset.action
    if (a === 'play') {
      const input = $<HTMLInputElement>('.room-input'); room = sanitizeRoom(input.value) || generateRoom(); input.value = room; writeRoom(room)
      writeText(NAME_KEY, cleanName($<HTMLInputElement>('.name-input').value))
      view.classList.add('is-live'); title.classList.remove('is-active'); camp.setActive(true); demo.setActive(false); menuPop.hidden = true; landscape(); connect()
    } else if (a === 'menu') { menuPop.hidden = !menuPop.hidden; chatPop.hidden = true; chatOpen = false }
    else if (a === 'chat') { chatPop.hidden = !chatPop.hidden; chatOpen = !chatPop.hidden; menuPop.hidden = true; if (chatOpen) { unread = 0; showUnread(); chatLog.scrollTop = chatLog.scrollHeight; $<HTMLInputElement>('.chat-form input').focus() } }
    else if (a === 'retry') connect()
    else if (a === 'start') connection.send(JSON.stringify({type: 'start'}))
    else if (a === 'invite') { const url = inviteUrl(room); if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({title: def.title, text: `انضم إلى مجلسي في ${def.title} — الرمز ${room}`, url}).catch(() => {}); else navigator.clipboard?.writeText(url).then(() => say('تم نسخ رابط الدعوة'), () => say(url)) }
    else if (a === 'sound') { prefs.sound = !prefs.sound; applyPrefs() }
    else if (a === 'calm') { prefs.calm = !prefs.calm; applyPrefs() }
    else if (a === 'leave') { connection.stop(); clearInterval(pingTimer); state = null; view.classList.remove('is-live'); title.classList.add('is-active'); camp.setActive(false); demo.setActive(true); overlay.hidden = true }
    else { const c = ctx(); if (c) def.onAction(el, c) }
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { for (const k of Object.keys(sel)) delete sel[k]; render() } })
  window.setInterval(() => { if (view.classList.contains('is-live') && !document.hidden && Math.random() < .3) sfx('crackle') }, 160)

  title.classList.add('is-active')
  const frame = (now: number) => {
    if (state && endsAt && state.phase !== 'lobby') {
      const left = Math.max(0, endsAt - now), total = def.timerTotal(state.phase)
      timer.style.setProperty('--p', String(Math.min(1, left / total)))
      timer.classList.toggle('on', left > 0)
      timer.classList.toggle('low', left < 8000)
    } else timer.classList.remove('on')
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  let last = performance.now()
  window.setInterval(() => { const now = performance.now(); connection.poll((now - last) / 1000); last = now }, 100)
}
