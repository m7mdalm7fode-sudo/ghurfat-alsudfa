import './styles/main.css'
import {CHARACTERS} from './ui/characters'
import {portraitURL} from './ui/pixel'

/**
 * «سمرة»: a small platform of Arabic table games played around a pixel-art campfire.
 * `?game=` picks the game; with no game the hub lists them. Old invites (`?room=` only) open «آخر فنجال».
 */
const GAMES = [
  {id: 'fanjal', title: 'آخر فنجال', players: '٢–٦ لاعبين', blurb: 'بندقية واحدة وطلقات حيّة وفارغة مخفية. أطلق على نفسك أو على غيرك… ومن يصمد يشرب آخر فنجال.', chars: ['p1', 'p2', 'p5'], icon: '☕'},
  {id: 'mafia', title: 'الذيابة', players: '٤–١٠ لاعبين', blurb: 'ذيابة مختبئين بين أهل الديرة. بالليل يختارون ضحية، وبالنهار يتناقش الجميع ويصوّتون.', chars: ['p6', 'p9', 'p4'], icon: '🔪'},
  {id: 'night', title: 'القطوة السوداء', players: '٤–١٢ لاعبًا', blurb: 'أوراق محاكمة مخفية، اتهامات وقطة سوداء… وإذا حلّ الليل اختار الخونة من يغتالون.', chars: ['p10', 'p7', 'p12'], icon: '🌑'},
  {id: 'baloot', title: 'بلوت', players: '٤ لاعبين · البوت يكمّل الناقص', blurb: 'فريقين ضد بعض: اشترِ صن أو حكم، العب أكلاتك صح، وسجّل مشاريعك… أول من يوصل ١٥٢ يفوز.', chars: ['p3', 'p4', 'p2'], icon: '♠️'},
] as const

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}[c]!))

function hub() {
  document.title = 'سمرة — ألعاب المجلس'
  const room = new URLSearchParams(location.search).get('room')
  document.querySelector('#ui')!.innerHTML = `<main class="app hub">
 <header class="hub-head">
  <p class="eyebrow">ألعاب جماعية حول النار · العب مع أصحابك من الجوال أو الكمبيوتر</p>
  <h1>سَمْـرَة</h1>
  <p class="tagline">اختر لعبة، ادخل المجلس، وأرسل الرابط لأصحابك.</p>
 </header>
 <section class="hub-games">${GAMES.map(g => `
  <a class="game-card" href="?game=${g.id}${room ? `&room=${esc(room)}` : ''}" style="--c:${CHARACTERS[g.chars[0]].color}">
   <div class="gc-art">${g.chars.map(c => `<img src="${portraitURL(c)}" alt="">`).join('')}<span class="gc-icon">${g.icon}</span></div>
   <div class="gc-copy"><h2>${g.title}</h2><span class="gc-players">${g.players}</span><p>${g.blurb}</p><span class="primary small gc-go">العب ←</span></div>
  </a>`).join('')}
 </section>
</main>`
}

async function boot() {
  const q = new URLSearchParams(location.search), game = q.get('game') || (q.get('room') ? 'fanjal' : '')
  if (game === 'fanjal') return (await import('./games/fanjal')).mountFanjal()
  if (game === 'mafia') return (await import('./games/mafia')).mountMafia()
  if (game === 'night') return (await import('./games/night')).mountNight()
  if (game === 'baloot') return (await import('./games/baloot')).mountBaloot()
  hub()
}
boot().catch(e => { console.error(e); document.querySelector('#ui')!.innerHTML = `<div class="fatal">تعذر تشغيل اللعبة: ${esc(String(e))}</div>` })
