#!/usr/bin/env node
// Plays full rounds against a real authoritative server: `node chamber_e2e.mjs 2` or `node chamber_e2e.mjs 6`.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {WebSocket} from 'ws'

const MARKER = 'chamber6-v2'
const players = Number(process.argv[2] || 2)
const port = 18000 + Math.floor(Math.random() * 2000)
const room = `T${players}${Date.now().toString(36).toUpperCase()}`.slice(0, 8)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const server = spawn(process.execPath, [fileURLToPath(new URL('./authoritative_server.mjs', import.meta.url))], {env: {...process.env, PORT: String(port), TURN_MS: '4000'}, stdio: 'pipe'})
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('exit', reject) })

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
        // Alternate between drawing on self, challenging and peeking, like a real table.
        const others = Object.entries(m.seats).filter(([s, v]) => s !== c.role && v.alive && v.connected).map(([s]) => s)
        const pick = Math.random()
        const items = m.seats[c.role].items, item = items[0]
        const act = item && pick < .3 && !(item === 'dallah' && m.seats[c.role].lives >= 3) ? {action: 'item', item} : pick < .55 || !others.length ? {action: 'self'} : {action: 'shoot', target: others[Math.floor(Math.random() * others.length)]}
        setTimeout(() => c.ws.readyState === 1 && c.ws.send(JSON.stringify({type: 'action', ...act})), act.action === 'item' ? 5 : 15)
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
  assert.equal(cs[0].last.seats.p1.name, 'ضيف 1', 'player names reach every client')
  const t0 = Date.now()
  let rounds = 0
  while (rounds < 3) {
    assert.ok(Date.now() - t0 < 120000, 'rounds must finish (no stalemate)')
    await sleep(100)
    rounds = Math.max(...cs.map(c => c.msgs.filter(m => m.type === 'room' && m.phase === 'ended' && m.winner).map(m => m.round)).map(r => new Set(r).size))
  }
  const ends = cs.map(c => c.msgs.filter(m => m.type === 'room' && m.phase === 'ended').map(m => `${m.round}:${m.winner}`))
  for (const e of ends) assert.deepEqual([...new Set(e)], [...new Set(ends[0])], 'every client sees the same winners')
  const results = cs[0].msgs.filter(m => m.type === 'result')
  const scores = Object.fromEntries(Object.entries(cs.at(-1).last.seats).map(([s, v]) => [s, v.score]))
  console.log(JSON.stringify({result: 'PASS', players, room, rounds, draws: results.length, lives: results.filter(r => r.kind === 'live').length, items: cs[0].msgs.filter(m => m.type === 'item').length, scores}))
  for (const c of cs) c.ws.close()
} catch (e) {
  console.error(JSON.stringify({result: 'FAIL', players, error: e.stack || String(e)}))
  process.exitCode = 1
} finally {
  server.kill()
}
