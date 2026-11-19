import {Renderer,suggestQuality} from '../engine/renderer'
import {SaveStore,SAVE_KEY} from '../engine/save'
import {Audio,type Sfx} from '../engine/audio'
import {Connection,bootstrapUrl,type ConnectionState} from '../net/connection'
import {BUILD,SEATS,decode,generateRoom,sanitizeRoom,type ClientAction,type Item,type Result,type RoomState,type Seat,type Role} from '../net/protocol'
import {inviteUrl,loadResume,resolveRoom,socketUrl,storeResume,writeRoom} from '../net/session'
import {Game} from '../game/game'
import {CHARACTERS} from '../ui/characters'
import {portraitURL} from '../ui/pixel'
import {ITEM_HINT,ITEM_ICON,ITEM_NAME,Stage} from '../ui/stage'

const GAME='آخر فنجال'
document.title=GAME
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!))
const PREFS_KEY='chamber6_prefs', NAME_KEY='chamber6_name'
type Prefs={calm:boolean;sound:boolean}
type Pick=''|'shoot'|'rope'|'steal'
const ERRORS:Record<string,string>={not_your_turn:'ليس دورك الآن',invalid_target:'لا يمكن ذلك الآن',not_ready:'الجولة لم تبدأ بعد',invalid_message:'رسالة غير صالحة'}
const CONN_TEXT:Record<ConnectionState,string>={stopped:'غير متصل',discovering:'جارٍ البحث عن الطاولة…',connecting:'جارٍ الاتصال…',open:'متصل',retry:'انقطع الاتصال — نعيد المحاولة…',unavailable:'خادم اللعب غير متاح'}
const ITEM_SFX:Record<Item,Sfx>={scope:'item',dallah:'heal',rope:'rope',bukhoor:'item',double:'rack',steal:'item',eject:'rack',flip:'click'}

function readJSON<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?{...fallback,...JSON.parse(v)}:fallback}catch{return fallback}}
function writeJSON(key:string,v:unknown){try{localStorage.setItem(key,JSON.stringify(v))}catch{/* storage blocked */}}
function readText(key:string){try{return localStorage.getItem(key)||''}catch{return ''}}
function writeText(key:string,v:string){try{localStorage.setItem(key,v)}catch{/* storage blocked */}}
const cleanName=(v:string)=>v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)
const shells=(n:number,kind:'live'|'blank')=>Array.from({length:n},()=>`<i class="shell ${kind}"></i>`).join('')

/** «آخر فنجال»: the rifle-and-bullets game (three rounds, up to six players). */
export async function mountFanjal(){
 const canvas=document.querySelector<HTMLCanvasElement>('#game')!,root=document.querySelector('#ui')!
 const save=new SaveStore(),renderer=new Renderer(canvas,save.data.quality||suggestQuality()),game=new Game(renderer)
 let audio:Audio|null=null
 const prefs=readJSON<Prefs>(PREFS_KEY,{calm:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:true})
 let room=resolveRoom(),role:Role='spectator',lastSeq=-1,conn:ConnectionState='stopped',pick:Pick='',stealFrom:Seat|''='',state:RoomState|null=null
 let phaseEndsAt=0,lastTurn='',lastPhase='',lastRound=0,log:string[]=[],pingTimer=0,myOutRound=-1,peek='',holdUntil=0,pending:RoomState|null=null,holdTimer=0

 const lineup=SEATS.map(seat=>`<figure class="hero-char" style="--c:${CHARACTERS[seat].color}"><img class="figure" src="${portraitURL(seat)}" alt="${CHARACTERS[seat].title}"><figcaption><b>${CHARACTERS[seat].title}</b><small>${CHARACTERS[seat].trait}</small></figcaption></figure>`).join('')
 const itemRules=(Object.keys(ITEM_NAME) as Item[]).map(i=>`<li>${ITEM_ICON[i]} <b>${ITEM_NAME[i]}</b>: ${ITEM_HINT[i]}</li>`).join('')
 root.innerHTML=`<main class="app">
<section class="title-view" data-view="title">
 <div class="title-copy">
  <a class="back-hub" href="./">→ كل الألعاب</a>
  <div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 22h30v10a15 15 0 0 1-30 0Z" fill="#f4ead8" stroke="#e3a94a" stroke-width="3"/><path d="M18 26h22" stroke="#c8324a" stroke-width="3"/><path d="M44 25h5a5 5 0 0 1 0 10h-6" fill="none" stroke="#e3a94a" stroke-width="3"/><path d="M22 14c0-4 4-4 4-8M30 14c0-4 4-4 4-8" stroke="#a88f74" stroke-width="2" fill="none"/><path d="M10 52h38" stroke="#e3a94a" stroke-width="3"/></svg></div>
  <p class="eyebrow">مجلس مخاطرة جماعي · من ٢ إلى ٦ لاعبين · ٣ جولات</p>
  <h1>آخر <em>فنجال</em></h1>
  <p class="tagline">حول النار بندقية واحدة وطلقات مخفية… ومن يصمد للنهاية يشرب آخر فنجال.</p>
  <div class="room-form">
   <label for="nm">اسمك في المجلس</label><input id="nm" class="name-input" maxlength="14" placeholder="مثلًا: أبو فهد" value="${esc(readText(NAME_KEY))}">
   <label for="rm">رمز الغرفة</label><input id="rm" class="room-input" maxlength="8" value="${esc(room)}" placeholder="اتركه فارغًا لإنشاء غرفة">
   <button class="primary" data-action="play">ادخل المجلس</button>
  </div>
  <details class="rules"><summary>كيف تُلعب؟</summary>
   <h4>المباراة</h4><ul>
    <li>المباراة <b>٣ جولات</b>. من يفوز بجولة يبدأ الجولة التي بعدها، ومن يجمع أكثر الجولات يشرب <b>آخر فنجال</b>.</li>
    <li>كل جولة أصعب: الأرواح ٤ ثم ٣ ثم ٢، والطلقات الحيّة أكثر، والأدوات تزيد حتى ٨ في الجولة الأخيرة.</li></ul>
   <h4>الطلقات</h4><ul>
    <li>تُحشى البندقية ويُعلن العدد: كم <b class="bad">حيّة</b> وكم <b class="ok">فارغة</b>، لكن ترتيبها مخفي.</li>
    <li><b>أطلق على نفسك</b>: إن كانت فارغة يبقى الدور لك. <b>أطلق على لاعب</b>: ينتقل الدور.</li>
    <li>الحيّة تأخذ روحًا ♥، ومن تنتهي أرواحه يخرج من الجولة. لديك ٣٠ ثانية وإلا أُطلقت عليك.</li></ul>
   <h4>الأدوات</h4><ul>${itemRules}</ul>
  </details>
 </div>
 <div class="hero-side"><div class="title-stage"></div><div class="hero-lineup" aria-label="شخصيات المجلس">${lineup}</div></div>
</section>
<section class="game-view" data-view="game">
 <div class="frame">
  <div class="stage-host"></div>
  <div class="hudx topbar">
   <div class="side"><button class="ibtn" data-action="menu" aria-label="القائمة">☰</button><span class="status-dot"></span><span class="match-bar" aria-label="جولات المباراة"></span></div>
   <div class="turn chip"><div class="phase">…</div><div class="timer"><i></i></div><div class="notice"></div></div>
  </div>
  <div class="hudx gun-dock chip" aria-label="البندقية"><div class="loaded"></div><div class="peek" hidden></div></div>
  <div class="hudx items-dock" aria-label="أدواتك"><div class="items"></div></div>
  <div class="hudx pick-pop chip" hidden><span class="act-hint"></span><span class="target-picker"></span></div>
  <div class="hudx lobby-card chip fanjal-wait" hidden></div>
  <div class="hudx menu-pop chip" hidden>
   <div class="bots-slot"></div>
   <div class="row"><b class="room-label"></b><span class="conn-text">غير متصل</span></div>
   <div class="row"><button class="ghost" data-action="invite">📨 نسخ الدعوة</button><button class="ghost toggle" data-action="sound" aria-pressed="true">🔊 الصوت</button><button class="ghost toggle" data-action="calm" aria-pressed="false">حركة أقل</button><button class="ghost" data-action="leave">🚪 خروج</button></div>
   <ol class="log" aria-label="ما حدث"></ol>
  </div>
 </div>
 <div class="overlay" hidden><div class="overlay-card"><div class="spinner" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 4 38 22 56 16 44 32 56 48 38 42 32 60 26 42 8 48 20 32 8 16 26 22Z" fill="none" stroke="#e8b84a" stroke-width="3"/></svg></div><p class="overlay-text"></p><button class="primary small" data-action="retry" hidden>حاول مجددًا</button></div></div>
 <div class="toast" role="status"></div>
</section></main>`

 const $=<T extends HTMLElement>(q:string)=>root.querySelector<T>(q)!
 const title=$('[data-view="title"]'),view=$('[data-view="game"]'),phase=$('.phase'),notice=$('.notice'),toast=$('.toast'),overlay=$('.overlay'),timer=$('.timer'),logEl=$('.log'),picker=$('.target-picker'),itemsEl=$('.items'),peekEl=$('.peek'),matchBar=$('.match-bar'),loadedEl=$('.loaded'),pickPop=$('.pick-pop'),menuPop=$('.menu-pop')
 const stage=new Stage($('.stage-host'),seat=>onSeat(seat))
 stage.setActive(false)
 // Title backdrop: a demo camp with all six characters, the turn passing around the fire.
 const demo=new Stage($('.title-stage'))
 const demoState=(turn:number):RoomState=>({type:'room',marker:BUILD,room:'',seq:0,round:1,phase:'live',phase_ends_in_ms:0,turn:SEATS[turn],winner:'',notice:'',chamber:{live:3,blank:3,total:6},match:{of:3,winners:[],over:false,champion:[],max_lives:4,cap:4},seats:Object.fromEntries(SEATS.map(x=>[x,{connected:true,alive:true,score:0,name:CHARACTERS[x].title,lives:4,items:[],skip:false,double:false}])) as unknown as RoomState['seats']})
 let demoTurn=0;demo.update(demoState(0),'spectator',[])
 window.setInterval(()=>{demoTurn=(demoTurn+1)%6;demo.update(demoState(demoTurn),'spectator',[])},1800)
 const showGame=(on:boolean)=>{stage.setActive(on);demo.setActive(!on)}
 let toastTimer=0
 const say=(text:string)=>{toast.textContent=text;toast.classList.add('on');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.classList.remove('on'),2600)}
 const sfx=(n:Sfx)=>{if(prefs.sound)audio?.play(n)}
 const nameOf=(seat:Seat|'')=>seat&&state?(state.seats[seat]?.name||CHARACTERS[seat].title):''

 function applyPrefs(){document.documentElement.classList.toggle('calm',prefs.calm);stage.calm=demo.calm=prefs.calm;$('[data-action="calm"]').setAttribute('aria-pressed',String(prefs.calm));$('[data-action="sound"]').setAttribute('aria-pressed',String(prefs.sound));writeJSON(PREFS_KEY,prefs)}
 applyPrefs()

 function showConn(){
  $('.conn-text').textContent=CONN_TEXT[conn]
  $('.status-dot').className=`status-dot ${conn==='open'?'on':conn==='unavailable'?'off':'wait'}`
  const blocking=view.classList.contains('is-live')&&(conn!=='open'||!state)
  overlay.hidden=!blocking
  if(blocking){
   $('.overlay-text').textContent=conn==='unavailable'?'خادم اللعب الجماعي غير متاح الآن. حاول مجددًا بعد قليل.':conn==='open'?'جارٍ تجهيز مقعدك في المجلس…':conn==='connecting'||conn==='retry'?`${CONN_TEXT[conn]} (قد يستغرق الخادم نصف دقيقة ليستيقظ)`:CONN_TEXT[conn]
   $('[data-action="retry"]').hidden=conn!=='unavailable'
   overlay.classList.toggle('error',conn==='unavailable')
  }
 }

 const connection=new Connection({
  state:s=>{conn=s;showConn();clearInterval(pingTimer);if(s==='open')pingTimer=window.setInterval(()=>connection.send(JSON.stringify({type:'ping',t:Date.now()})),3000)},
  text:text=>{
   const msg=decode(text,room,lastSeq);if(!msg)return;connection.confirmActivity()
   if(msg.type==='welcome'){role=msg.role;lastSeq=-1;storeResume(room,connection.endpoint,msg.resume_token);game.welcome(msg);say(role==='spectator'?'المجلس ممتلئ — أنت تشاهد الآن':`جلستَ في مقعد ${CHARACTERS[role].title}`);sfx('join')}
   else if(msg.type==='room'){lastSeq=msg.seq;game.room(msg);deliver(msg)}
   else if(msg.type==='result'){onResult(msg)}
   else if(msg.type==='peek'){peek=msg.kind;sfx('item');say(`🔭 الطلقة القادمة ${msg.kind==='live'?'حيّة!':'فارغة'}`);if(state)render(state)}
   else if(msg.type==='item'){
    sfx(ITEM_SFX[msg.item])
    if(msg.item==='flip'||msg.item==='eject')peek=''
    const who=nameOf(msg.actor),t=msg.target?nameOf(msg.target):''
    pushLog(msg.item==='steal'&&msg.stolen?`${who} 🖐️ سرق ${ITEM_ICON[msg.stolen]} ${ITEM_NAME[msg.stolen]} من ${t}`:msg.item==='rope'?`${who} 🪢 ربط ${t}`:msg.item==='eject'?`${who} ⏏️ حذف طلقة ${msg.ejected==='live'?'حيّة':'فارغة'}`:`${who} استخدم ${ITEM_ICON[msg.item]} ${ITEM_NAME[msg.item]}`)
    if(msg.item==='steal'&&msg.target===role&&msg.stolen)say(`${who} سرق منك ${ITEM_NAME[msg.stolen]}!`)
    if(msg.item==='rope'&&msg.target===role)say(`${who} ربطك — ستخسر دورك القادم`)
   }
   else if(msg.type==='error'){say(ERRORS[msg.code]||'خطأ');pick='';stealFrom='';if(state)render(state)}
  },
  lost:()=>{say('انقطع الاتصال — نحاول العودة إلى مقعدك')}
 })

 /** Room updates that follow a shot wait for the bang, so hearts drop when the bullet lands. */
 function deliver(s:RoomState){
  const now=performance.now()
  if(now<holdUntil){pending=s;clearTimeout(holdTimer);holdTimer=window.setTimeout(()=>{const p=pending;pending=null;if(p)onRoom(p)},holdUntil-now);return}
  onRoom(s)
 }

 function onRoom(s:RoomState){
  const prev=state;state=s
  phaseEndsAt=performance.now()+s.phase_ends_in_ms
  if(s.phase!==lastPhase||s.round!==lastRound){
   if(s.phase==='countdown'){sfx('count');stage.hideStamp();myOutRound=-1;if(s.round===1&&lastRound!==1){log=[];logEl.innerHTML=''}}
   if(s.phase==='live'&&lastPhase!=='live'){sfx('load');pushLog(`— الجولة ${s.round} من ${s.match.of}: ${s.chamber.live} حيّة و${s.chamber.blank} فارغة`)}
   if(s.phase==='ended'){
    const w=s.winner,m=s.match
    if(m.over){const champ=m.champion;stage.showStamp(champ.length===1?`صاحب آخر فنجال: ${nameOf(champ[0])}`:'تعادل في المباراة','win');window.setTimeout(()=>sfx(champ.includes(role as Seat)?'win':'lose'),300);pushLog(champ.length===1?`☕ ${nameOf(champ[0])} شرب آخر فنجال`:'انتهت المباراة بالتعادل')}
    else{stage.showStamp(w?`فاز ${nameOf(w)} بالجولة ${s.round}`:'لا فائز',w?'win':'out');window.setTimeout(()=>sfx(w&&w===role?'win':'lose'),300);pushLog(w?`🏆 ${nameOf(w)} فاز بالجولة ${s.round}`:'انتهت الجولة بلا فائز')}
   }
   lastPhase=s.phase;lastRound=s.round
  }else if(s.phase==='live'&&prev&&s.chamber.total>prev.chamber.total){sfx('load');peek='';pushLog(`أُعيد الحشو: ${s.chamber.live} حيّة و${s.chamber.blank} فارغة`)}
  if(s.phase==='live'&&s.turn!==lastTurn&&s.turn===role){window.setTimeout(()=>sfx('rack'),200)}
  if(s.turn!==lastTurn){pick='';stealFrom=''}
  lastTurn=s.turn
  if(s.phase!=='live'){pick='';stealFrom='';peek=''}
  render(s)
 }

 function onResult(r:Result){
  const delay=stage.shotDelay(prefs.calm)*1000
  holdUntil=performance.now()+delay+30
  stage.play(r,prefs.calm)
  sfx('rack')
  window.setTimeout(()=>{sfx(r.kind==='live'?'shot':'click');if(r.kind==='live'){window.setTimeout(()=>sfx('hit'),120);if(r.damage>1)window.setTimeout(()=>sfx('shot'),90)}},delay)
  peek=''
  const who=nameOf(r.actor),on=r.actor===r.target?'على نفسه':`على ${nameOf(r.target)}`
  window.setTimeout(()=>pushLog(`${who} أطلق ${on}: ${r.kind==='live'?(r.damage>1?'حيّة دبل 💥💥':'حيّة 💥'):'فارغة'}${r.eliminated?` — خرج ${nameOf(r.eliminated)}`:''}`),delay)
  if(r.eliminated&&r.eliminated===role){myOutRound=r.round;window.setTimeout(()=>{if(state?.phase==='live'&&myOutRound===r.round)stage.showStamp('خرجتَ من الجولة','out')},delay+500)}
 }

 function pushLog(line:string){log=[line,...log].slice(0,8);logEl.innerHTML=log.map(l=>`<li>${esc(l)}</li>`).join('')}

 /** Seats that can be picked for the current mode. */
 function targets(s:RoomState,mode:Pick=pick):Seat[]{
  if(!mode)return []
  return SEATS.filter(seat=>{const x=s.seats[seat];if(seat===role||!x.alive||!x.connected)return false;if(mode==='rope')return !x.skip;if(mode==='steal')return x.items.some(i=>i!=='steal');return true})
 }

 /** Tapping the button above a player on the scene: shoot him, shoot yourself, or pick him for the rope/theft. */
 function onSeat(seat:Seat){
  const s=state;if(!s||s.phase!=='live'||s.turn!==role)return
  if(pick==='rope'){if(!targets(s,'rope').includes(seat))return;pick='';send({type:'action',action:'item',item:'rope',target:seat})}
  else if(pick==='steal'){if(!targets(s,'steal').includes(seat))return;stealFrom=seat}
  else if(seat===role){send({type:'action',action:'self'})}
  else if(targets(s,'shoot').includes(seat)){send({type:'action',action:'shoot',target:seat})}
  render(s)
 }

 /** Action labels drawn above players on the scene during your turn. */
 function seatLabels(s:RoomState):Partial<Record<Seat,string>>{
  const out:Partial<Record<Seat,string>>={}
  if(s.phase!=='live'||role==='spectator'||s.turn!==role||stealFrom)return out
  if(pick==='rope'){for(const x of targets(s,'rope'))out[x]='🪢';return out}
  if(pick==='steal'){for(const x of targets(s,'steal'))out[x]='🖐️';return out}
  for(const x of targets(s,'shoot'))out[x]='🎯'
  out[role]='🎯'
  return out
 }

 function renderMatch(s:RoomState){
  const m=s.match,cur=s.phase==='waiting'?0:s.round
  matchBar.innerHTML=Array.from({length:m.of},(_,i)=>{const n=i+1,w=m.winners[i],done=i<m.winners.length,now=n===cur&&!done
   return `<span class="rd ${done?'done':''} ${now?'now':''}" style="${w?`--c:${CHARACTERS[w].color}`:''}" title="الجولة ${n}${done?(w?` — فاز ${esc(nameOf(w))}`:' — بلا فائز'):now?' — تُلعب الآن':''}">${done&&w?'🏆':n}</span>`}).join('')
 }

 function render(s:RoomState){
  const live=s.phase==='live',mine=live&&s.turn===role,me=role==='spectator'?null:s.seats[role]
  const connected=SEATS.filter(x=>s.seats[x].connected).length
  renderMatch(s)
  // Bots: the host (first person at the table) can add or remove them; a bot plays its own turns.
  const bots=SEATS.filter(x=>s.seats[x].bot).length,host=SEATS.find(x=>s.seats[x].connected&&!s.seats[x].bot)===role
  const botRow=host?`<div class="row bots-row"><span>🤖 البوتات:</span><button class="ghost" data-action="bots" data-n="${bots-1}" ${bots?'':'disabled'} aria-label="شيل بوت">−</button><b>${bots||'بدون'}</b><button class="ghost" data-action="bots" data-n="${bots+1}" ${connected<6?'':'disabled'} aria-label="أضف بوت">+</button></div>`:''
  const slot=$('.bots-slot');if(slot.dataset.html!==botRow){slot.dataset.html=botRow;slot.innerHTML=botRow}
  const wait=$('.fanjal-wait');wait.hidden=s.phase!=='waiting'||role==='spectator'
  const waitHTML=`<b>آخر فنجال</b><span>${connected<2?'تحتاج لاعبًا ثانيًا على الأقل — ادعُ أصحابك أو أضف بوت':'سيبدأ اللعب قريبًا'}</span><div class="row"><button class="ghost" data-action="invite">📨 ادعُ أصحابك</button></div>${botRow||(bots?`<span class="muted">🤖 معكم ${bots} بوت</span>`:'')}`
  if(!wait.hidden&&wait.dataset.html!==waitHTML){wait.dataset.html=waitHTML;wait.innerHTML=waitHTML}
  phase.textContent=s.phase==='waiting'?`بانتظار اللاعبين (${connected}/6)`:s.phase==='countdown'?`الجولة ${s.round} من ${s.match.of}`:s.phase==='ended'?(s.match.over?'انتهت المباراة':`انتهت الجولة ${s.round}`):mine?'دورك — اضغط 🎯':`دور ${nameOf(s.turn)}`
  phase.className=`phase ${mine?'mine':live?'other':s.phase}`
  notice.textContent=s.phase==='waiting'?(connected<2?'شارك رابط الدعوة — تحتاج لاعبًا آخر على الأقل.':'سيبدأ اللعب قريبًا.'):s.notice||(mine?'أطلق على نفسك أو على لاعب، أو استخدم أداة.':role==='spectator'?'أنت تشاهد هذه الطاولة.':'انتظر دورك وراقب الطاولة.')
  // Rifle panel: what was loaded (announced) and how many bullets are left.
  loadedEl.innerHTML=live?`<span class="shells" title="${s.chamber.live} حيّة و${s.chamber.blank} فارغة">${shells(s.chamber.live,'live')}${shells(s.chamber.blank,'blank')}</span><span><b>${s.chamber.total}</b> <span class="muted">باقية</span></span>`:'<span class="muted">🔫 تُحشى مع الجولة</span>'
  peekEl.hidden=!peek||!live
  peekEl.className=`peek ${peek}`
  peekEl.textContent=peek?`🔭 القادمة ${peek==='live'?'حيّة':'فارغة'}`:''
  $('.room-label').textContent=room
  if(!mine){pick='';stealFrom=''}
  const labels=seatLabels(s)
  const t=(Object.keys(labels) as Seat[]).filter(x=>x!==role)
  const hint=$('.act-hint')
  hint.className=`act-hint ${mine?'mine':''}`
  hint.textContent=pick==='rope'?'🪢 اختر من تربطه':pick==='steal'&&!stealFrom?'🖐️ اختر من تسرق منه':''
  pickPop.hidden=!mine||!pick
  if(pick==='steal'&&stealFrom){
   const victim=s.seats[stealFrom]
   picker.innerHTML=`<span>ماذا تسرق من ${esc(nameOf(stealFrom))}؟</span>${victim.items.map(i=>`<button data-steal="${i}" ${i==='steal'?'disabled':''}>${ITEM_ICON[i]} ${ITEM_NAME[i]}</button>`).join('')}<button class="cancel" data-action="cancel">إلغاء</button>`
  }else picker.innerHTML=pick?`<button class="cancel" data-action="cancel">إلغاء ${pick==='rope'?'الحبل':'السرقة'}</button>`:''
  const items=live&&me?.alive?me.items:[]
  itemsEl.innerHTML=items.length?items.map((i,k)=>{const off=!mine||(i==='dallah'&&me!.lives>=s.match.max_lives)||(i==='double'&&me!.double)||((i==='rope'||i==='steal')&&!targets(s,i).length);return `<button data-item="${i}" data-k="${k}" title="${ITEM_NAME[i]}: ${ITEM_HINT[i]}" ${off?'disabled':''} class="${pick===i?'active':''}"><em>${ITEM_ICON[i]}</em><small>${ITEM_NAME[i]}</small></button>`}).join(''):''
  stage.update(s,role,t,labels)
  view.classList.toggle('turn-mine',mine)
  showConn()
 }

 /** Android: go fullscreen and lock landscape. iPhone can't lock, so CSS turns the game sideways instead. */
 function landscape(){try{const el=document.documentElement as HTMLElement&{webkitRequestFullscreen?:()=>void};const p=el.requestFullscreen?el.requestFullscreen():el.webkitRequestFullscreen?.();Promise.resolve(p).then(()=>(screen.orientation as ScreenOrientation&{lock?:(o:string)=>Promise<void>}).lock?.('landscape')).catch(()=>{})}catch{/* not supported */}}
 function send(action:ClientAction){if(!connection.send(JSON.stringify(action)))say('الاتصال غير جاهز بعد')}
 function connect(){lastSeq=-1;state=null;lastPhase='';lastTurn='';lastRound=0;log=[];peek='';logEl.innerHTML='';stage.hideStamp();const name=cleanName($<HTMLInputElement>('.name-input').value);connection.discover(bootstrapUrl(location.href),BUILD,e=>`${socketUrl(e,room,loadResume(room,e))}${name?`&name=${encodeURIComponent(name)}`:''}`);showConn()}

 root.addEventListener('click',e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-target],[data-item],[data-steal]');if(!el)return
  if(!audio){try{audio=new Audio();audio.setVolumes(0,.9)}catch{audio=null}}audio?.unlock()
  if(el.dataset.target){onSeat(el.dataset.target as Seat);return}
  if(el.dataset.steal&&stealFrom){const item=el.dataset.steal as Item;send({type:'action',action:'item',item:'steal',target:stealFrom,steal:item});pick='';stealFrom='';if(state)render(state);return}
  if(el.dataset.item){
   const item=el.dataset.item as Item
   if(item==='rope'||item==='steal'){pick=pick===item?'':item;stealFrom='';if(state)render(state);return}
   pick='';stealFrom='';send({type:'action',action:'item',item});return
  }
  const a=el.dataset.action
  if(a==='play'){const input=$<HTMLInputElement>('.room-input');room=sanitizeRoom(input.value)||generateRoom();input.value=room;writeRoom(room);writeText(NAME_KEY,cleanName($<HTMLInputElement>('.name-input').value));view.classList.add('is-live');title.classList.remove('is-active');showGame(true);menuPop.hidden=true;$('.room-label').textContent=room;landscape();connect()}
  else if(a==='menu'){menuPop.hidden=!menuPop.hidden}
  else if(a==='bots'){if(!connection.send(JSON.stringify({type:'bots',count:Number(el.dataset.n)})))say('الاتصال غير جاهز بعد')}
  else if(a==='retry')connect()
  else if(a==='invite'){const url=inviteUrl(room);const done=()=>say('تم نسخ رابط الدعوة');if(navigator.share&&matchMedia('(pointer: coarse)').matches)navigator.share({title:GAME,text:`انضم إلى مجلسي في ${GAME} — الرمز ${room}`,url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(done,()=>say(url))}
  else if(a==='sound'){prefs.sound=!prefs.sound;applyPrefs()}
  else if(a==='calm'){prefs.calm=!prefs.calm;applyPrefs()}
  else if(a==='leave'){connection.stop();clearInterval(pingTimer);game.leave();state=null;view.classList.remove('is-live');title.classList.add('is-active');showGame(false);overlay.hidden=true}
  else if(a==='self'){pick='';stealFrom='';send({type:'action',action:'self'})}
  else if(a==='shoot'){if(!state)return;pick=pick==='shoot'?'':'shoot';stealFrom='';if(pick&&!targets(state).length){pick='';say('لا يوجد لاعب تطلق عليه')}render(state)}
  else if(a==='cancel'){pick='';stealFrom='';if(state)render(state)}
 })
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pick&&state){pick='';stealFrom='';render(state)}})

 // Campfire ambience: soft random crackles while seated (sound effects only, no music).
 window.setInterval(()=>{if(view.classList.contains('is-live')&&!document.hidden&&Math.random()<.4)sfx('crackle')},130)

 title.classList.add('is-active')
 let last=performance.now()
 const frame=(now:number)=>{
  const dt=Math.min(.05,(now-last)/1000);last=now
  connection.poll(dt);game.step(dt)
  if(state&&(state.phase==='countdown'||state.phase==='live')&&phaseEndsAt){
   const left=Math.max(0,phaseEndsAt-now)
   if(state.phase==='countdown')phase.textContent=`الجولة ${state.round} من ${state.match.of} — تبدأ خلال ${Math.ceil(left/1000)}`
   const total=state.phase==='live'?30000:3500
   timer.style.setProperty('--p',String(Math.min(1,left/total)))
   timer.classList.toggle('on',left>0)
   timer.classList.toggle('low',state.phase==='live'&&left<8000)
  }else timer.classList.remove('on')
  requestAnimationFrame(frame)
 }
 requestAnimationFrame(frame)
 ;(window as any).__game={game,connection}
 if(!safeGet(SAVE_KEY))save.update({quality:suggestQuality()})
}
function safeGet(k:string){try{return localStorage.getItem(k)}catch{return null}}
