#!/usr/bin/env node
// Plays a full 3-round match against a real authoritative server: `node chamber_e2e.mjs 2` or `node chamber_e2e.mjs 6`.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {WebSocket} from 'ws'

const MARKER = 'chamber6-v3'
const players = Number(process.argv[2] || 2)
const port = 18000 + Math.floor(Math.random() * 2000)
const room = `T${players}${Date.now().toString(36).toUpperCase()}`.slice(0, 8)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const server = spawn(process.execPath, [fileURLToPath(new URL('./authoritative_server.mjs', import.meta.url))], {env: {...process.env, PORT: String(port), TURN_MS: '4000', ROUND_END_MS: '800', MATCH_END_MS: '1500'}, stdio: 'pipe'})
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('exit', reject) })

/** A player who uses every kind of item, picks targets for the rope and the theft, and shoots. */
export function decide(m, role) {
  const me = m.seats[role]
  const others = Object.entries(m.seats).filter(([s, v]) => s !== role && v.alive && v.connected)
  const target = others.length ? others[Math.floor(Math.random() * others.length)][0] : ''
  const usable = me.items.filter(i => !(i === 'dallah' && me.lives >= m.match.max_lives) && !(i === 'double' && me.double) && !((i === 'rope' || i === 'steal') && !target) && !(i === 'rope' && m.seats[target]?.skip))
  const item = usable[Math.floor(Math.random() * usable.length)]
  if (item && Math.random() < .45) {
    if (item === 'steal') {
      const victim = others.find(([, v]) => v.items.some(x => x !== 'steal'))
      if (victim) return {action: 'item', item, target: victim[0], steal: victim[1].items.find(x => x !== 'steal')}
    } else return {action: 'item', item, target}
  }
  return Math.random() < .5 || !target ? {action: 'self'} : {action: 'shoot', target}
}

function client(i) {
  const c = {i, role: '', msgs: [], last: null}
  c.ws = new WebSocket(`ws://127.0.0.1:${port}/ws?room=${room}&name=${encodeURIComponent('ضيف ' + i)}`)
  c.ws.on('message', d => {
    const m = JSON.parse(d.toString())
    assert.equal(m.marker, MARKER)
    c.msgs.push(m)
    if (m.type === 'welcome') c.role = m.role
    if (m.type === 'room') {
      c.last = m
      if (m.phase === 'live' && m.turn === c.role) {
        const act = decide(m, c.role)
        setTimeout(() => c.ws.readyState === 1 && c.ws.send(JSON.stringify({type: 'action', ...act})), 10)
      }
    }
  })
  return c
}

try {
  const cs = []
  for (let i = 1; i <= players; i++) { cs.push(client(i)); await sleep(40) }
  await sleep(300)
  assert.deepEqual(cs.map(c => c.role).sort(), Array.from({length: players}, (_, i) => `p${i + 1}`))
  const t0 = Date.now()
  let over = null
  while (!over) {
    assert.ok(Date.now() - t0 < 150000, 'the match must finish')
    await sleep(100)
    over = cs[0].msgs.find(m => m.type === 'room' && m.match.over)
  }
  await sleep(200)
  // Difficulty rises: lives at round start go down, the inventory cap reaches 8 in round 3.
  const starts = [1, 2, 3].map(r => cs[0].msgs.find(m => m.type === 'room' && m.phase === 'live' && m.round === r))
  assert.deepEqual(starts.map(s => s.match.max_lives), [4, 3, 2])
  assert.deepEqual(starts.map(s => s.match.cap), [4, 6, 8])
  // Each round winner opens the next round.
  for (const r of [2, 3]) { const w = starts[r - 1].match.winners[r - 2]; if (w && starts[r - 1].seats[w].connected) assert.equal(starts[r - 1].turn, w, `winner of round ${r - 1} starts round ${r}`) }
  for (const c of cs) { const o = c.msgs.find(m => m.type === 'room' && m.match.over); assert.deepEqual(o.match.champion, over.match.champion, 'every client sees the same champion') }
  const items = {}; for (const m of cs[0].msgs) if (m.type === 'item') items[m.item] = (items[m.item] || 0) + 1
  const results = cs[0].msgs.filter(m => m.type === 'result')
  console.log(JSON.stringify({result: 'PASS', players, room, winners: over.match.winners, champion: over.match.champion, shots: results.length, doubles: results.filter(r => r.damage === 2).length, items}))
  for (const c of cs) c.ws.close()
} catch (e) {
  console.error(JSON.stringify({result: 'FAIL', players, error: e.stack || String(e)}))
  process.exitCode = 1
} finally {
  server.kill()
}
