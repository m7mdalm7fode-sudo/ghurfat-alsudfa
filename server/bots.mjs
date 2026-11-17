#!/usr/bin/env node
// Local testing helper: fills a room with bot players. Usage: node server/bots.mjs ROOMCODE [count] [ws://127.0.0.1:8787/ws]
import {WebSocket} from 'ws'

const room = String(process.argv[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const count = Math.min(5, Math.max(1, Number(process.argv[3] || 3)))
const base = process.argv[4] || 'ws://127.0.0.1:8787/ws'
if (!/^[A-Z0-9]{4,8}$/.test(room)) { console.error('usage: node server/bots.mjs ROOMCODE [count]'); process.exit(1) }
const NAMES = ['بوت سالم', 'بوت راشد', 'بوت ناصر', 'بوت حمد', 'بوت عيسى']

function decide(m, role) {
  const me = m.seats[role]
  const others = Object.entries(m.seats).filter(([s, v]) => s !== role && v.alive && v.connected)
  const target = others.length ? others[Math.floor(Math.random() * others.length)][0] : ''
  const usable = me.items.filter(i => !(i === 'dallah' && me.lives >= m.match.max_lives) && !(i === 'double' && me.double) && !((i === 'rope' || i === 'steal') && !target) && !(i === 'rope' && m.seats[target]?.skip))
  const item = usable[Math.floor(Math.random() * usable.length)]
  if (item && Math.random() < .4) {
    if (item === 'steal') {
      const victim = others.find(([, v]) => v.items.some(x => x !== 'steal'))
      if (victim) return {action: 'item', item, target: victim[0], steal: victim[1].items.find(x => x !== 'steal')}
    } else return {action: 'item', item, target}
  }
  return Math.random() < .5 || !target ? {action: 'self'} : {action: 'shoot', target}
}

for (let i = 0; i < count; i++) {
  const ws = new WebSocket(`${base}?room=${room}&name=${encodeURIComponent(NAMES[i])}`)
  let role = '', busy = false
  ws.on('message', d => {
    const m = JSON.parse(d.toString())
    if (m.type === 'welcome') { role = m.role; console.log(`${NAMES[i]} → ${role}`) }
    if (m.type === 'room' && m.phase === 'live' && m.turn === role && !busy) {
      busy = true
      setTimeout(() => { busy = false; if (ws.readyState === 1) ws.send(JSON.stringify({type: 'action', ...decide(m, role)})) }, 1800 + Math.random() * 1500)
    }
  })
  setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({type: 'ping', t: Date.now()})), 5000)
}
