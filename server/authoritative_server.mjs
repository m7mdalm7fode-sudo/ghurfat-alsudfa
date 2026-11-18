#!/usr/bin/env node
// Authoritative room server for «آخر فنجال»: a match of three rounds around one rifle loaded with
// live and blank bullets. Each round is harder and hands out more items; the round winner opens the next.
import {createServer} from 'node:http'; import {randomBytes} from 'node:crypto'; import {WebSocketServer,WebSocket} from 'ws'; import {MafiaRoom} from './mafia.mjs'; import {NightRoom} from './night.mjs'
const MARKER='chamber6-v3', HOST=process.env.HOST||'127.0.0.1', PORT=Number(process.env.PORT||8787)
const SEATS=['p1','p2','p3','p4','p5','p6'], MAX_ROOMS=128, MAX_SPECTATORS=8
const COUNTDOWN_MS=3500, ROUND_END_MS=Number(process.env.ROUND_END_MS||6000), MATCH_END_MS=Number(process.env.MATCH_END_MS||10000)
const RECONNECT_MS=60000, IDLE_MS=600000, TURN_MS=Number(process.env.TURN_MS||30000), ROUNDS=3
const ITEMS=['scope','dallah','rope','bukhoor','double','steal','eject','flip']
/** Difficulty per round: lives, bullets per load, live ratio, items per load, inventory cap. */
const LEVEL=[null,
 {lives:4,min:2,max:5,ratio:[.25,.45],give:2,cap:4},
 {lives:3,min:3,max:7,ratio:[.35,.6],give:3,cap:6},
 {lives:2,min:4,max:8,ratio:[.45,.7],give:4,cap:8}]
const rooms=new Map(), allowed=new Set((process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean))
const token=()=>randomBytes(18).toString('base64url'), code=v=>/^[A-Z0-9]{4,8}$/.test(v)?v:''
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)
const empty=()=>({token:'',socket:null,disconnectedAt:0,score:0,alive:false,name:'',lives:0,items:[],skip:false,double:false})
const open=s=>s.socket?.readyState===WebSocket.OPEN
function seatState(s){return {connected:open(s),alive:s.alive,score:s.score,name:s.name,lives:s.lives,items:[...s.items],skip:s.skip,double:s.double}}
function send(ws,p){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(p))}
const pick=a=>a[Math.floor(Math.random()*a.length)]
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

class Room{
 constructor(id){this.id=id;this.seq=0;this.round=0;this.phase='waiting';this.ends=0;this.turn='';this.winner='';this.notice='';this.last=Date.now();this.chamber=[];this.loaded={live:0,blank:0};this.winners=[];this.over=false;this.champion=[];this.seats=Object.fromEntries(SEATS.map(s=>[s,empty()]));this.watchers=new Set()}
 get level(){return LEVEL[Math.min(ROUNDS,Math.max(1,this.round))]}
 connected(){return SEATS.filter(s=>open(this.seats[s]))}
 active(){return SEATS.filter(s=>this.seats[s].alive&&open(this.seats[s]))}
 claim(ws,resume,name=''){let role='spectator';for(const s of SEATS){const x=this.seats[s];if(resume&&x.token===resume&&(!x.disconnectedAt||Date.now()-x.disconnectedAt<RECONNECT_MS)){role=s;x.socket=ws;x.disconnectedAt=0;if(name)x.name=name;break}}
  if(role==='spectator'){const free=SEATS.find(s=>!this.seats[s].token);if(free){role=free;const x=this.seats[free];x.token=token();x.socket=ws;x.name=name||`لاعب ${SEATS.indexOf(free)+1}`;x.score=0}else{if(this.watchers.size>=MAX_SPECTATORS){ws.close(1013);return}this.watchers.add(ws)}}
  ws.room=this;ws.role=role;this.last=Date.now()
  send(ws,{type:'welcome',marker:MARKER,room:this.id,role,resume_token:role==='spectator'?'':this.seats[role].token,rules:{max_players:6,rounds:ROUNDS,turn_seconds:TURN_MS/1000}});this.maybeStart();this.broadcast()
 }
 newMatch(){this.round=0;this.winners=[];this.over=false;this.champion=[];for(const s of SEATS)this.seats[s].score=0}
 maybeStart(){if(this.phase==='waiting'&&this.connected().length>=2){if(this.over||!this.round)this.newMatch();this.round++;this.phase='countdown';this.ends=Date.now()+COUNTDOWN_MS;this.notice=`الجولة ${this.round} من ${ROUNDS} تستعد`}}
 /** Loads the rifle for the current round, announces the counts, and hands out items up to the cap. */
 load(){const L=this.level,n=L.min+Math.floor(Math.random()*(L.max-L.min+1)),ratio=L.ratio[0]+Math.random()*(L.ratio[1]-L.ratio[0])
  const live=Math.max(1,Math.min(n-1,Math.round(n*ratio)));this.chamber=shuffle([...Array(live).fill('live'),...Array(n-live).fill('blank')]);this.loaded={live,blank:n-live}
  for(const s of this.active()){const x=this.seats[s];for(let i=0;i<L.give&&x.items.length<L.cap;i++)x.items.push(pick(ITEMS))}
  return `حُشيت البندقية: ${live} حيّة و${n-live} فارغة`}
 setupRound(){const L=this.level;this.phase='live';const prevWinner=this.winners[this.winners.length-1]||'';this.winner=''
  for(const s of SEATS){const x=this.seats[s];x.alive=open(x);x.lives=x.alive?L.lives:0;x.items=[];x.skip=false;x.double=false}
  this.notice=`الجولة ${this.round}: ${this.load()}`;const alive=this.active()
  this.turn=prevWinner&&alive.includes(prevWinner)?prevWinner:alive[(this.round-1)%alive.length]||'';if(prevWinner&&this.turn===prevWinner)this.notice+=` — يبدأ ${this.seats[prevWinner].name} فائز الجولة السابقة`
  this.ends=Date.now()+TURN_MS;this.broadcast()}
 view(){return {live:this.loaded.live,blank:this.loaded.blank,total:this.chamber.length}}
 snapshot(){this.seq++;return {type:'room',marker:MARKER,room:this.id,seq:this.seq,round:this.round,phase:this.phase,phase_ends_in_ms:this.ends?Math.max(0,this.ends-Date.now()):0,turn:this.turn,seats:Object.fromEntries(SEATS.map(s=>[s,seatState(this.seats[s])])),chamber:this.view(),winner:this.winner,notice:this.notice,match:{of:ROUNDS,winners:[...this.winners],over:this.over,champion:[...this.champion],max_lives:this.level.lives,cap:this.level.cap}}}
 everyone(p){const text=JSON.stringify(p);for(const s of SEATS)if(open(this.seats[s]))this.seats[s].socket.send(text);for(const ws of this.watchers)if(ws.readyState===WebSocket.OPEN)ws.send(text)}
 broadcast(){this.everyone(this.snapshot())}
 /** Next living seat after `side`, honouring the rope: a tied player loses one turn. */
 next(side){const alive=this.active();if(!alive.length)return '';let i=SEATS.indexOf(side),skipped=[];for(let n=0;n<12;n++){i=(i+1)%SEATS.length;const s=SEATS[i];if(!alive.includes(s))continue;if(this.seats[s].skip&&s!==side){this.seats[s].skip=false;skipped.push(this.seats[s].name);continue}if(skipped.length)this.notice+=` — ${skipped.join('، ')} مربوط فخسر دوره`;return s}return alive[0]}
 useItem(side,msg){
  const me=this.seats[side],at=me.items.indexOf(msg.item);if(at<0)return this.err(side,'invalid_message')
  const target=msg.target,t=SEATS.includes(target)?this.seats[target]:null,validOther=t&&target!==side&&t.alive&&open(t)
  let extra={}
  if(msg.item==='dallah'&&me.lives>=this.level.lives)return this.err(side,'invalid_target')
  if(msg.item==='double'&&me.double)return this.err(side,'invalid_target')
  if((msg.item==='rope'||msg.item==='steal')&&!validOther)return this.err(side,'invalid_target')
  if(msg.item==='rope'&&t.skip)return this.err(side,'invalid_target')
  if(msg.item==='steal'){const k=t.items.indexOf(msg.steal);if(k<0||msg.steal==='steal')return this.err(side,'invalid_target');t.items.splice(k,1);me.items.splice(at,1);me.items.push(msg.steal);this.notice=`${me.name} سرق ${NAMES[msg.steal]} من ${t.name}`;extra={target,stolen:msg.steal};this.everyone({type:'item',marker:MARKER,room:this.id,actor:side,item:'steal',...extra});this.broadcast();return}
  me.items.splice(at,1)
  if(msg.item==='scope'){send(me.socket,{type:'peek',marker:MARKER,room:this.id,kind:this.chamber[0]||'blank'});this.notice=`${me.name} نظر بالمنظار إلى الطلقة القادمة`}
  else if(msg.item==='dallah'){me.lives++;this.notice=`${me.name} شرب فنجال من الدلّة واسترد روحًا`}
  else if(msg.item==='rope'){t.skip=true;this.notice=`${me.name} ربط ${t.name} بالحبل — سيخسر دوره القادم`;extra={target}}
  else if(msg.item==='bukhoor'){const live=this.chamber.filter(x=>x==='live').length;this.notice=`دخان البخور كشف الباقي: ${live} حيّة و${this.chamber.length-live} فارغة`}
  else if(msg.item==='double'){me.double=true;this.notice=`${me.name} حشا طلقة دبل — الحيّة القادمة منه تأخذ روحين`}
  else if(msg.item==='flip'){if(this.chamber.length)this.chamber[0]=this.chamber[0]==='live'?'blank':'live';this.notice=`${me.name} قلب الطلقة القادمة — صارت عكس ما كانت`}
  else if(msg.item==='eject'){const k=this.chamber.shift()||'blank';extra={ejected:k};this.notice=`${me.name} حذف الطلقة القادمة: كانت ${k==='live'?'حيّة':'فارغة'}`;if(!this.chamber.length)this.notice+=` — ${this.load()}`}
  this.everyone({type:'item',marker:MARKER,room:this.id,actor:side,item:msg.item,...extra});this.broadcast()
 }
 action(side,msg){
  if(this.phase!=='live')return this.err(side,'not_ready')
  if(side!==this.turn||!this.seats[side].alive)return this.err(side,'not_your_turn')
  if(msg.action==='item'&&ITEMS.includes(msg.item))return this.useItem(side,msg)
  if(msg.action!=='self'&&msg.action!=='shoot')return this.err(side,'invalid_message')
  const me=this.seats[side],target=msg.action==='self'?side:msg.target
  if(!SEATS.includes(target)||!this.seats[target].alive||(msg.action==='shoot'&&target===side))return this.err(side,'invalid_target')
  const kind=this.chamber.shift()||'blank',t=this.seats[target];let eliminated='',damage=0
  const who=target===side?'على نفسه':`على ${t.name}`,dbl=me.double;me.double=false
  if(kind==='live'){damage=dbl?2:1;t.lives=Math.max(0,t.lives-damage);this.notice=`${me.name} أطلق ${who}: طلقة حيّة${dbl?' دبل!':'!'}`;if(!t.lives){t.alive=false;eliminated=target;this.notice+=` — خرج ${t.name}`}}
  else this.notice=`${me.name} أطلق ${who}: طلقة فارغة${target===side?' — يحتفظ بدوره':''}`
  const alive=this.active()
  if(alive.length<=1)this.endRound()
  else{this.turn=kind==='blank'&&target===side?side:this.next(side);this.ends=Date.now()+TURN_MS;if(!this.chamber.length)this.notice+=` — ${this.load()}`}
  this.everyone({type:'result',marker:MARKER,room:this.id,round:this.round,actor:side,target,kind,damage,lives:t.lives,eliminated,next_turn:this.turn,notice:this.notice,chamber:this.view()});this.broadcast()
 }
 err(side,reason){send(this.seats[side].socket,{type:'error',marker:MARKER,room:this.id,code:reason})}
 release(ws){if(ws.role&&this.seats[ws.role]){const s=this.seats[ws.role];if(s.socket===ws){s.socket=null;s.disconnectedAt=Date.now();s.alive=false;if(this.phase==='live'){if(this.active().length<=1)this.endRound();else if(this.turn===ws.role){this.turn=this.next(ws.role);this.ends=Date.now()+TURN_MS}}}}else this.watchers.delete(ws);this.broadcast()}
 /** Closes the round; after the third round the match winner (most round wins) is crowned. */
 endRound(){const alive=this.active();this.phase='ended';this.winner=alive[0]||'';this.turn='';this.winners.push(this.winner)
  if(this.winner){this.seats[this.winner].score++;this.notice=`${this.notice} — فاز ${this.seats[this.winner].name} بالجولة ${this.round}`}else this.notice='لا فائز في هذه الجولة'
  if(this.round>=ROUNDS){const best=Math.max(...SEATS.map(s=>this.seats[s].score));this.champion=best>0?SEATS.filter(s=>this.seats[s].score===best&&this.seats[s].token):[];this.over=true;this.ends=Date.now()+MATCH_END_MS;this.notice=this.champion.length===1?`انتهت المباراة — صاحب آخر فنجال: ${this.seats[this.champion[0]].name}`:'انتهت المباراة بالتعادل'}
  else this.ends=Date.now()+ROUND_END_MS}
 tick(){const now=Date.now();for(const s of SEATS){const x=this.seats[s];if(x.token&&x.disconnectedAt&&now-x.disconnectedAt>RECONNECT_MS)Object.assign(x,empty())}
  if(this.phase==='live'&&this.turn&&this.ends&&now>=this.ends){const late=this.turn;this.notice='';this.action(late,{action:'self'});this.notice=`انتهى وقت ${this.seats[late].name} فأُطلقت عليه — ${this.notice}`;this.broadcast()}
  if(this.phase==='countdown'&&now>=this.ends)this.setupRound()
  else if(this.phase==='ended'&&now>=this.ends){if(this.connected().length>=2){if(this.over)this.newMatch();this.round++;this.phase='countdown';this.ends=now+COUNTDOWN_MS;this.notice=this.round===1?'مباراة جديدة — الجولة 1 من 3':`الجولة ${this.round} من ${ROUNDS} — أصعب`}else{this.phase='waiting';this.ends=0}this.broadcast()}
  if(this.connected().length<2&&this.phase!=='waiting'&&this.phase!=='ended'){this.phase='waiting';this.ends=0;this.turn='';this.round=Math.max(0,this.round-1);for(const s of SEATS)this.seats[s].alive=false;this.broadcast()}
 }
}
const NAMES={scope:'المنظار',dallah:'الدلّة',rope:'الحبل',bukhoor:'البخور',double:'طلقة الدبل',steal:'السرقة',eject:'حذف الطلقة',flip:'التبديل'}
const GAMES={fanjal:Room,mafia:MafiaRoom,night:NightRoom}
function room(game,id){const key=`${game}:${id}`;if(!rooms.has(key))rooms.set(key,new GAMES[game](id));return rooms.get(key)}
const http=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,marker:MARKER,rooms:rooms.size}));return}res.writeHead(404);res.end('Not found')})
const wss=new WebSocketServer({noServer:true,maxPayload:4096});http.on('upgrade',(req,socket,head)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{return socket.destroy()}const origin=req.headers.origin;const same=origin&&(()=>{try{return new URL(origin).host===req.headers.host}catch{return false}})();if(origin&&!same&&!allowed.has(origin))return socket.destroy();if(u.pathname!=='/ws')return socket.destroy();const id=code(u.searchParams.get('room')),game=GAMES[u.searchParams.get('game')]?u.searchParams.get('game'):'fanjal';if(!id||(!rooms.has(`${game}:${id}`)&&rooms.size>=MAX_ROOMS))return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,u,id,game))})
wss.on('connection',(ws,u,id,game)=>{const r=room(game,id);r.claim(ws,u.searchParams.get('resume')||'',cleanName(u.searchParams.get('name')));ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='ping')send(ws,{type:'pong',marker:MARKER,room:id,t:m.t});else if(r.message)r.message(ws,m);else if(m.type==='action'&&ws.role!=='spectator'){r.last=Date.now();r.action(ws.role,m)}}catch{send(ws,{type:'error',marker:MARKER,room:id,code:'invalid_message'})}});ws.on('close',()=>r.release(ws));ws.on('error',()=>r.release(ws))})
setInterval(()=>{const now=Date.now();for(const [id,r] of rooms){r.tick();if(!r.connected().length&&!r.watchers.size&&now-r.last>IDLE_MS)rooms.delete(id)}},200).unref()
http.listen(PORT,HOST,()=>console.log(JSON.stringify({marker:MARKER,status:'listening',host:HOST,port:http.address().port})))
