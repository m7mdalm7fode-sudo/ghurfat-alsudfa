#!/usr/bin/env node
// Local testing helper: fills a room with bot players. Usage: node server/bots.mjs ROOMCODE [count] [ws://127.0.0.1:8787/ws]
import {WebSocket} from 'ws'

const room = String(process.argv[2] || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const count = Math.min(5, Math.max(1, Number(process.argv[3] || 3)))
const base = process.argv[4] || 'ws://127.0.0.1:8787/ws'
if (!/^[A-Z0-9]{4,8}$/.test(room)) { console.error('usage: node server/bots.mjs ROOMCODE [count]'); process.exit(1) }
const NAMES = ['بوت سالم', 'بوت راشد', 'بوت ناصر', 'بوت حمد', 'بوت عيسى']

for (let i = 0; i < count; i++) {
  const ws = new WebSocket(`${base}?room=${room}&name=${encodeURIComponent(NAMES[i])}`)
  let role = ''
  ws.on('message', d => {
    const m = JSON.parse(d.toString())
    if (m.type === 'welcome') { role = m.role; console.log(`${NAMES[i]} → ${role}`) }
    if (m.type === 'room' && m.phase === 'live' && m.turn === role) {
      const others = Object.entries(m.seats).filter(([s, v]) => s !== role && v.alive && v.connected).map(([s]) => s)
      const me = m.seats[role], item = me.items.find(x => x !== 'dallah' || me.lives < 3)
      const act = item && Math.random() < .35 ? {action: 'item', item} : Math.random() < .5 || !others.length ? {action: 'self'} : {action: 'shoot', target: others[Math.floor(Math.random() * others.length)]}
      setTimeout(() => ws.readyState === 1 && ws.send(JSON.stringify({type: 'action', ...act})), 1800 + Math.random() * 1500)
    }
  })
  setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({type: 'ping', t: Date.now()})), 5000)
}
