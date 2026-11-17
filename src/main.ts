import './styles/main.css'
import {Renderer,suggestQuality} from './engine/renderer'
import {SaveStore,SAVE_KEY} from './engine/save'
import {Audio} from './engine/audio'
import {Connection,bootstrapUrl,type ConnectionState} from './net/connection'
import {BUILD,SEATS,decode,generateRoom,sanitizeRoom,type ClientAction,type Result,type RoomState,type Seat,type Role} from './net/protocol'
import {inviteUrl,loadResume,resolveRoom,socketUrl,storeResume,writeRoom} from './net/session'
import {Game} from './game/game'
import {CHARACTERS} from './ui/characters'
import {portraitURL} from './ui/pixel'
import {Stage} from './ui/stage'

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!))
const PREFS_KEY='chamber6_prefs', NAME_KEY='chamber6_name'
type Prefs={calm:boolean;sound:boolean}
const ERRORS:Record<string,string>={not_your_turn:'ليس دورك الآن',invalid_target:'هذا اللاعب لا يمكن تحديه',not_ready:'الجولة لم تبدأ بعد',invalid_message:'رسالة غير صالحة'}
const CONN_TEXT:Record<ConnectionState,string>={stopped:'غير متصل',discovering:'جارٍ البحث عن الطاولة…',connecting:'جارٍ الاتصال…',open:'متصل',retry:'انقطع الاتصال — نعيد المحاولة…',unavailable:'خادم اللعب غير متاح'}

function readJSON<T>(key:string,fallback:T):T{try{const v=localStorage.getItem(key);return v?{...fallback,...JSON.parse(v)}:fallback}catch{return fallback}}
function writeJSON(key:string,v:unknown){try{localStorage.setItem(key,JSON.stringify(v))}catch{/* storage blocked */}}
function readText(key:string){try{return localStorage.getItem(key)||''}catch{return ''}}
function writeText(key:string,v:string){try{localStorage.setItem(key,v)}catch{/* storage blocked */}}
const cleanName=(v:string)=>v.replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)

async function boot(){
 const canvas=document.querySelector<HTMLCanvasElement>('#game')!,root=document.querySelector('#ui')!
 const save=new SaveStore(),renderer=new Renderer(canvas,save.data.quality||suggestQuality()),game=new Game(renderer)
 let audio:Audio|null=null
 const prefs=readJSON<Prefs>(PREFS_KEY,{calm:matchMedia('(prefers-reduced-motion: reduce)').matches,sound:true})
 let room=resolveRoom(),role:Role='spectator',lastSeq=-1,conn:ConnectionState='stopped',picking=false,state:RoomState|null=null
 let phaseEndsAt=0,lastTurn='',lastPhase='',log:string[]=[],pingTimer=0,myOutRound=-1

 const lineup=SEATS.map(seat=>`<figure class="hero-char" style="--c:${CHARACTERS[seat].color}"><img class="figure" src="${portraitURL(seat)}" alt="${CHARACTERS[seat].title}"><figcaption><b>${CHARACTERS[seat].title}</b><small>${CHARACTERS[seat].trait}</small></figcaption></figure>`).join('')
 root.innerHTML=`<main class="app">
<section class="title-view" data-view="title">
 <div class="title-copy">
  <div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 38 22 56 16 44 32 56 48 38 42 32 60 26 42 8 48 20 32 8 16 26 22Z" fill="none" stroke="#e8b84a" stroke-width="2.5"/><path d="M32 18 42 32 32 46 22 32Z" fill="#c8324a"/><circle cx="32" cy="32" r="5" fill="#e8b84a"/></svg></div>
  <p class="eyebrow">مجلس مخاطرة جماعي · من ٢ إلى ٦ لاعبين</p>
  <h1>غرفة <em>الصدفة</em></h1>
  <p class="tagline">اجلس في المجلس، اختر قرارك تحت ضوء الفانوس… فكل شحنة قد تُخرجك من الجولة.</p>
  <div class="room-form">
   <label for="nm">اسمك في المجلس</label><input id="nm" class="name-input" maxlength="14" placeholder="مثلًا: أبو فهد" value="${esc(readText(NAME_KEY))}">
   <label for="rm">رمز الغرفة</label><input id="rm" class="room-input" maxlength="8" value="${esc(room)}" placeholder="اتركه فارغًا لإنشاء غرفة">
   <button class="primary" data-action="play">ادخل المجلس</button>
  </div>
  <details class="rules"><summary>كيف تُلعب؟</summary><ul><li>في كل جولة مجموعة شحنات مقلوبة: بعضها <b class="ok">آمن</b> وبعضها <b class="bad">خطر</b>.</li><li>في دورك: <b>اسحب على نفسك</b> أو <b>تحدَّ لاعبًا</b> فتُسحب الشحنة عليه.</li><li>الشحنة الخطرة تُخرج صاحبها من الجولة، وآخر من يبقى يفوز بنجمة.</li><li><b>البصيرة</b> تكشف ما تبقى من الشحنات دون أن تخسر دورك.</li><li>لديك ٣٠ ثانية في كل دور، وإلا سُحبت الشحنة عليك تلقائيًا.</li></ul></details>
 </div>
 <div class="hero-side"><div class="title-stage"></div><div class="hero-lineup" aria-label="شخصيات المجلس">${lineup}</div></div>
</section>
<section class="game-view" data-view="game">
 <header>
  <div class="conn"><span class="status-dot"></span><span class="conn-text">غير متصل</span><b class="room-label"></b></div>
  <button class="ghost" data-action="invite">نسخ الدعوة</button>
  <button class="ghost toggle" data-action="sound" aria-pressed="true">الصوت</button>
  <button class="ghost toggle" data-action="calm" aria-pressed="false">حركة أقل</button>
  <button class="ghost" data-action="leave">خروج</button>
 </header>
 <div class="board">
  <div class="stage-host"></div>
  <div class="hud">
   <div class="phase-row"><div class="phase">…</div><div class="timer"><i></i></div></div>
   <div class="notice"></div>
   <div class="chamber"><span class="pill safe"><svg viewBox="0 0 20 20"><path d="M13 3a8 8 0 1 0 0 14 6.5 6.5 0 1 1 0-14Z"/></svg><b class="safe-count">0</b> آمنة</span><span class="pill danger"><svg viewBox="0 0 20 20"><path d="M10 1 12 8 19 10 12 12 10 19 8 12 1 10 8 8Z"/></svg><b class="danger-count">0</b> خطرة</span><span class="pill round">الجولة <b class="round-n">0</b></span></div>
   <div class="actions"><button class="action-self" data-action="self">اسحب على نفسك</button><button class="action-challenge" data-action="challenge">تحدَّ لاعبًا</button><button class="action-peek" data-action="peek">البصيرة</button></div>
   <div class="target-picker"></div>
   <ol class="log" aria-label="سجل المجلس"></ol>
  </div>
 </div>
 <div class="overlay" hidden><div class="overlay-card"><div class="spinner" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M32 4 38 22 56 16 44 32 56 48 38 42 32 60 26 42 8 48 20 32 8 16 26 22Z" fill="none" stroke="#e8b84a" stroke-width="3"/></svg></div><p class="overlay-text"></p><button class="primary small" data-action="retry" hidden>حاول مجددًا</button></div></div>
 <div class="toast" role="status"></div>
</section></main>`

 const $=<T extends HTMLElement>(q:string)=>root.querySelector<T>(q)!
 const title=$('[data-view="title"]'),view=$('[data-view="game"]'),phase=$('.phase'),notice=$('.notice'),toast=$('.toast'),overlay=$('.overlay'),timer=$('.timer'),logEl=$('.log'),picker=$('.target-picker')
 const stage=new Stage($('.stage-host'),seat=>{if(picking)challenge(seat)})
 stage.setActive(false)
 // Title backdrop: a demo camp with all six characters, the turn passing around the fire.
 const demo=new Stage($('.title-stage'))
 const demoState=(turn:number):RoomState=>({type:'room',marker:BUILD,room:'',seq:0,round:1,phase:'live',phase_ends_in_ms:0,turn:SEATS[turn],winner:'',notice:'',chamber:{safe:4,danger:2,total:6},seats:Object.fromEntries(SEATS.map(x=>[x,{connected:true,alive:true,score:0,name:CHARACTERS[x].title}])) as RoomState['seats']})
 let demoTurn=0;demo.update(demoState(0),'spectator',[])
 window.setInterval(()=>{demoTurn=(demoTurn+1)%6;demo.update(demoState(demoTurn),'spectator',[])},1800)
 const showGame=(on:boolean)=>{stage.setActive(on);demo.setActive(!on)}
 let toastTimer=0
 const say=(text:string)=>{toast.textContent=text;toast.classList.add('on');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>toast.classList.remove('on'),2600)}
 const sfx=(n:Parameters<Audio['play']>[0])=>{if(prefs.sound)audio?.play(n)}
 const nameOf=(seat:Seat|'')=>seat&&state?(state.seats[seat]?.name||CHARACTERS[seat].title):''

 function applyPrefs(){document.documentElement.classList.toggle('calm',prefs.calm);stage.calm=demo.calm=prefs.calm;$('[data-action="calm"]').setAttribute('aria-pressed',String(prefs.calm));$('[data-action="sound"]').setAttribute('aria-pressed',String(prefs.sound));writeJSON(PREFS_KEY,prefs)}
 applyPrefs()

 function showConn(){
  $('.conn-text').textContent=CONN_TEXT[conn]
  $('.status-dot').className=`status-dot ${conn==='open'?'on':conn==='unavailable'?'off':'wait'}`
  const blocking=view.classList.contains('is-live')&&(conn!=='open'||!state)
  overlay.hidden=!blocking
  if(blocking){
   $('.overlay-text').textContent=conn==='unavailable'?'خادم اللعب الجماعي غير متاح الآن. تأكد من تشغيل الخادم ثم حاول مجددًا.':conn==='open'?'جارٍ تجهيز مقعدك في المجلس…':CONN_TEXT[conn]
   $('[data-action="retry"]').hidden=conn!=='unavailable'
   overlay.classList.toggle('error',conn==='unavailable')
  }
 }

 const connection=new Connection({
  state:s=>{conn=s;showConn();clearInterval(pingTimer);if(s==='open')pingTimer=window.setInterval(()=>connection.send(JSON.stringify({type:'ping',t:Date.now()})),3000)},
  text:text=>{
   const msg=decode(text,room,lastSeq);if(!msg)return;connection.confirmActivity()
   if(msg.type==='welcome'){role=msg.role;lastSeq=-1;storeResume(room,connection.endpoint,msg.resume_token);game.welcome(msg);say(role==='spectator'?'المجلس ممتلئ — أنت تشاهد الآن':`جلستَ في مقعد ${CHARACTERS[role].title}`);sfx('join')}
   else if(msg.type==='room'){lastSeq=msg.seq;game.room(msg);onRoom(msg)}
   else if(msg.type==='result'){game.result(msg);onResult(msg)}
   else if(msg.type==='error'){say(ERRORS[msg.code]||'خطأ');picking=false;if(state)render(state)}
  },
  lost:()=>{say('انقطع الاتصال — نحاول العودة إلى مقعدك')}
 })

 function onRoom(s:RoomState){
  const prev=state;state=s
  phaseEndsAt=performance.now()+s.phase_ends_in_ms
  if(s.phase!==lastPhase){
   if(s.phase==='countdown'){sfx('count');stage.hideStamp();myOutRound=-1}
   if(s.phase==='live'&&lastPhase!=='live'){sfx('go');pushLog(`بدأت الجولة ${s.round}`)}
   if(s.phase==='ended'){
    const w=s.winner
    stage.showStamp(w?`الفائز: ${nameOf(w)}`:'لا فائز',w?'win':'out')
    sfx(w&&w===role?'win':'lose');pushLog(w?`🏆 ${nameOf(w)} فاز بالجولة`:'انتهت الجولة بلا فائز')
   }
   lastPhase=s.phase
  }
  if(s.phase==='live'&&s.turn!==lastTurn&&s.turn===role){sfx('ui');say('دورك الآن!')}
  lastTurn=s.turn
  if(s.phase!=='live')picking=false
  if(prev&&s.phase==='live'&&s.notice&&s.notice!==prev.notice&&s.notice.startsWith('أداة البصيرة'))pushLog(`${nameOf(prev.turn)} استخدم البصيرة: ${s.chamber.safe} آمنة و${s.chamber.danger} خطرة`)
  render(s)
 }

 function onResult(r:Result){
  stage.play(r,prefs.calm)
  sfx(r.kind==='danger'?'fall':'bump')
  const who=nameOf(r.actor),on=r.actor===r.target?'على نفسه':`على ${nameOf(r.target)}`
  pushLog(`${who} سحب ${on}: ${r.kind==='danger'?'شحنة خطرة ✦':'شحنة آمنة ☾'}`)
  if(r.eliminated&&r.eliminated===role&&state){myOutRound=r.round;window.setTimeout(()=>{if(state?.phase==='live'&&myOutRound===r.round)stage.showStamp('خرجتَ من الجولة','out')},prefs.calm?200:900)}
 }

 function pushLog(line:string){log=[line,...log].slice(0,5);logEl.innerHTML=log.map(l=>`<li>${esc(l)}</li>`).join('')}

 function targets(s:RoomState):Seat[]{return SEATS.filter(seat=>seat!==role&&s.seats[seat].alive&&s.seats[seat].connected)}

 function render(s:RoomState){
  const live=s.phase==='live',mine=live&&s.turn===role
  const connected=SEATS.filter(x=>s.seats[x].connected).length
  phase.textContent=s.phase==='waiting'?`بانتظار اللاعبين (${connected}/6)`:s.phase==='countdown'?'المجلس يستعد…':s.phase==='ended'?(s.winner?`الفائز: ${nameOf(s.winner)}`:'لا فائز'):mine?'دورك الآن':`دور ${nameOf(s.turn)}`
  phase.className=`phase ${mine?'mine':live?'other':s.phase}`
  notice.textContent=s.phase==='waiting'?(connected<2?'شارك رابط الدعوة — تحتاج لاعبًا آخر على الأقل.':'سيبدأ اللعب قريبًا.'):s.notice||(mine?'اختر قرارك: اسحب على نفسك، تحدَّ لاعبًا، أو استخدم البصيرة.':role==='spectator'?'أنت تشاهد هذه الطاولة.':!s.seats[role as Seat]?.alive&&live?'خرجتَ من هذه الجولة — تابع حتى النهاية.':'انتظر دورك وراقب الطاولة.')
  $('.safe-count').textContent=String(s.chamber.safe)
  $('.danger-count').textContent=String(s.chamber.danger)
  $('.round-n').textContent=String(s.round)
  $('.room-label').textContent=room
  root.querySelectorAll<HTMLButtonElement>('.actions button').forEach(b=>{b.disabled=!mine;b.classList.toggle('active',picking&&b.dataset.action==='challenge')})
  const t=mine&&picking?targets(s):[]
  picker.innerHTML=t.length?`<span>اختر من تتحدّاه:</span>${t.map(seat=>`<button data-target="${seat}" style="--c:${CHARACTERS[seat].color}">${esc(nameOf(seat))}</button>`).join('')}<button class="cancel" data-action="cancel">إلغاء</button>`:''
  stage.update(s,role,t)
  view.classList.toggle('turn-mine',mine)
  showConn()
 }

 function send(action:ClientAction){if(!connection.send(JSON.stringify(action)))say('الاتصال غير جاهز بعد')}
 function challenge(seat:Seat){picking=false;send({type:'action',action:'challenge',target:seat});if(state)render(state)}
 function connect(){lastSeq=-1;state=null;lastPhase='';lastTurn='';log=[];logEl.innerHTML='';stage.hideStamp();const name=cleanName($<HTMLInputElement>('.name-input').value);connection.discover(bootstrapUrl(location.href),BUILD,e=>`${socketUrl(e,room,loadResume(room,e))}${name?`&name=${encodeURIComponent(name)}`:''}`);showConn()}

 root.addEventListener('click',e=>{
  const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action],[data-target]');if(!el)return
  if(!audio){try{audio=new Audio();audio.setVolumes(.6,.9)}catch{audio=null}}audio?.unlock()
  if(el.dataset.target){challenge(el.dataset.target as Seat);return}
  const a=el.dataset.action
  if(a==='play'){const input=$<HTMLInputElement>('.room-input');room=sanitizeRoom(input.value)||generateRoom();input.value=room;writeRoom(room);writeText(NAME_KEY,cleanName($<HTMLInputElement>('.name-input').value));view.classList.add('is-live');title.classList.remove('is-active');showGame(true);$('.room-label').textContent=room;connect()}
  else if(a==='retry')connect()
  else if(a==='invite'){const url=inviteUrl(room);const done=()=>say('تم نسخ رابط الدعوة');if(navigator.share&&matchMedia('(pointer: coarse)').matches)navigator.share({title:'غرفة الصدفة',text:`انضم إلى مجلسي في غرفة الصدفة — الرمز ${room}`,url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(done,()=>say(url))}
  else if(a==='sound'){prefs.sound=!prefs.sound;applyPrefs()}
  else if(a==='calm'){prefs.calm=!prefs.calm;applyPrefs()}
  else if(a==='leave'){connection.stop();clearInterval(pingTimer);game.leave();state=null;view.classList.remove('is-live');title.classList.add('is-active');showGame(false);overlay.hidden=true}
  else if(a==='self'||a==='peek'){picking=false;sfx('ui');send({type:'action',action:a})}
  else if(a==='challenge'){if(!state)return;picking=!picking;if(picking&&!targets(state).length){picking=false;say('لا يوجد لاعب يمكن تحديه')}sfx('ui');render(state)}
  else if(a==='cancel'){picking=false;if(state)render(state)}
 })
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picking&&state){picking=false;render(state)}})

 title.classList.add('is-active')
 let last=performance.now()
 const frame=(now:number)=>{
  const dt=Math.min(.05,(now-last)/1000);last=now
  connection.poll(dt);game.step(dt)
  if(state&&(state.phase==='countdown'||state.phase==='live')&&phaseEndsAt){
   const left=Math.max(0,phaseEndsAt-now)
   if(state.phase==='countdown')phase.textContent=`تبدأ الجولة خلال ${Math.ceil(left/1000)}`
   const total=state.phase==='live'?30000:3000
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
boot().catch(e=>{console.error(e);document.querySelector('#ui')!.innerHTML=`<div class="fatal">تعذر تشغيل اللعبة: ${esc(String(e))}</div>`})
