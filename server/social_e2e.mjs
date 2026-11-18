// Full-game test for «المافيا» and «الليل الأسود»: N bots join, the host starts, every bot makes
// random legal moves until the game is over. Usage: node server/social_e2e.mjs mafia|night [players] [games]
import {spawn} from 'node:child_process'; import WebSocket from 'ws'
const game = process.argv[2] || 'mafia', N = Number(process.argv[3] || 6), GAMES = Number(process.argv[4] || 1), PORT = 8900 + Math.floor(Math.random() * 90)
const EXT = process.env.URL, srv = EXT ? {kill() {}, stdout: {once: (_e, r) => r()}} : spawn(process.execPath, ['authoritative_server.mjs'], {cwd: new URL('.', import.meta.url), env: {...process.env, PORT: String(PORT), SOCIAL_SPEED: process.env.SOCIAL_SPEED || '0.02'}, stdio: ['ignore', 'pipe', 'inherit']})
await new Promise(r => srv.stdout.once('data', r))
const NAMES = ['أبو فهد', 'سالم', 'ناصر', 'بدر', 'مشعل', 'فيصل', 'عبدالله', 'تركي', 'ماجد', 'سعود', 'خالد']
const pick = a => a[Math.floor(Math.random() * a.length)]
const room = process.env.ROOM || 'T' + Math.random().toString(36).slice(2, 7).toUpperCase()
let done = 0, errors = 0, results = [], codes = {}
const bots = []
function bot(i) {
  const ws = new WebSocket(`${EXT || `ws://127.0.0.1:${PORT}`}/ws?room=${room}&game=${game}&name=${encodeURIComponent(EXT ? NAMES[i] : 'bot' + i)}`), b = {ws, me: '', st: null, seenOver: false}
  ws.on('message', raw => {
    const m = JSON.parse(raw)
    if (m.type === 'welcome') b.me = m.role
    if (m.type === 'error' && !['not_ready', 'not_your_turn', 'already'].includes(m.code)) { errors++; codes[m.code] = (codes[m.code] || 0) + 1 }
    if (m.type !== 'state') return
    b.st = m
    if (i === 0 && m.phase === 'lobby' && Object.values(m.seats).filter(x => x.connected).length >= N && m.host === b.me && !b.started) { b.started = true; ws.send(JSON.stringify({type: 'start'})) }
    if (m.phase === 'over' && !b.seenOver) { b.seenOver = true; if (i === 0) { results.push(m.winner); done++; console.log(`game ${done}: winner=${m.winner} log=${m.log.length}`); if (process.env.LOG) console.log(m.log.map(e => e.text).join(String.fromCharCode(10))); b.started = false; if (done >= GAMES) finish() } }
    if (m.phase !== 'over') b.seenOver = false
    setTimeout(() => think(b), EXT ? 600 + Math.random() * 1500 : 2 + Math.random() * 8)
  })
  return b
}
function think(b) {
  const m = b.st, me = b.me, mine = m.mine, seat = m.seats[me]
  if (!seat?.inGame || !seat.alive) return
  const send = x => b.ws.send(JSON.stringify({type: 'act', ...x}))
  const living = Object.keys(m.seats).filter(s => m.seats[s].inGame && m.seats[s].alive)
  const others = living.filter(s => s !== me)
  if (Math.random() < .05) b.ws.send(JSON.stringify({type: 'chat', text: 'هلا ' + me}))
  if (game === 'mafia') {
    if (m.phase === 'night') { if (mine.role === 'mafia' && !mine.kill[me]) send({kind: 'kill', target: pick(others.filter(s => m.seats[s].role !== 'mafia'))}); if (mine.role === 'doctor' && !mine.save) send({kind: 'save', target: pick(living.filter(s => s !== mine.last_save))}); if (mine.role === 'detective' && !mine.check) send({kind: 'check', target: pick(others)}) }
    if (m.phase === 'day' && !seat.ready && Math.random() < .5) send({kind: 'ready'})
    if (m.phase === 'vote' && !seat.vote) send({kind: 'vote', target: Math.random() < .2 ? 'skip' : pick(others)})
    return
  }
  if (m.phase === 'dawn' && mine.team === 'traitor' && !seat.done) send({kind: 'cat', target: pick(living)})
  if (m.phase === 'kill') { if (mine.team === 'traitor' && !mine.votes?.[me]) send({kind: 'kill', target: pick(others)}); if (mine.can_guard && !mine.guard) send({kind: 'guard', target: pick(others)}) }
  if (m.phase === 'confess' && !mine.exempt && !mine.confess) { const h = mine.trial.filter(c => !c.open); send({kind: 'confess', card: Math.random() < .6 || !h.length ? 'risk' : pick(h).id}) }
  if (m.phase === 'choose' && m.choosing === me) send({kind: 'reveal', card: pick(mine.trial.filter(c => !c.open)).id})
  if (m.phase === 'turn' && m.turn === me && !m.drawing) {
    if (m.played && Math.random() < .5) return send({kind: 'end'})
    if (!m.played && (Math.random() < .45 || !mine.hand.length)) return send({kind: 'draw'})
    const c = pick(mine.hand); if (!c) return send({kind: m.played ? 'end' : 'draw'})
    if (!others.length) return send({kind: 'end'})
    const t = pick(others), to = pick(others.filter(s => s !== t))
    send({kind: 'play', card: c.id, target: t, to})
    if (Math.random() < .1) send({kind: 'ability', target: pick(others)})
  }
}
for (let i = 0; i < N; i++) { bots.push(bot(i)); await new Promise(r => setTimeout(r, 30)) }
const kill = setTimeout(() => { console.error('TIMEOUT', bots[0].st?.phase, bots[0].st?.notice); finish(1) }, EXT ? 3600000 : 120000)
// Keep the turn moving if a bot stalls on an error.
setInterval(() => { for (const b of bots) if (b.st) think(b) }, EXT ? 2500 : 150)
function finish(code = 0) { clearTimeout(kill); console.log(JSON.stringify({game, players: N, results, unexpected_errors: errors, codes})); srv.kill(); process.exit(code || (results.length < GAMES ? 1 : 0)) }
