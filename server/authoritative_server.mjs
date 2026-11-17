#!/usr/bin/env node
// Authoritative room server for «غرفة الصدفة»: a rifle loaded with live and blank bullets, lives, and items.
import {createServer} from 'node:http'; import {randomBytes} from 'node:crypto'; import {WebSocketServer,WebSocket} from 'ws'
const MARKER='chamber6-v2', HOST=process.env.HOST||'127.0.0.1', PORT=Number(process.env.PORT||8787)
const SEATS=['p1','p2','p3','p4','p5','p6'], MAX_ROOMS=128, MAX_SPECTATORS=8
const COUNTDOWN_MS=3000, RECONNECT_MS=60000, IDLE_MS=600000, TURN_MS=Number(process.env.TURN_MS||30000)
const LIVES=3, MAX_ITEMS=4, ITEMS=['scope','dallah','rope','bukhoor']
const ITEM_NAME={scope:'المنظار',dallah:'الدلّة',rope:'الحبل',bukhoor:'البخور'}
const rooms=new Map(), allowed=new Set((process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean))
const token=()=>randomBytes(18).toString('base64url'), code=v=>/^[A-Z0-9]{4,8}$/.test(v)?v:''
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)
const empty=()=>({token:'',socket:null,disconnectedAt:0,score:0,alive:false,name:'',lives:0,items:[],skip:false})
const open=s=>s.socket?.readyState===WebSocket.OPEN
function seatState(s){return {connected:open(s),alive:s.alive,score:s.score,name:s.name,lives:s.lives,items:[...s.items]}}
function send(ws,p){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(p))}
const pick=a=>a[Math.floor(Math.random()*a.length)]
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

class Room{
 constructor(id){this.id=id;this.seq=0;this.round=0;this.phase='waiting';this.ends=0;this.turn='';this.winner='';this.notice='';this.last=Date.now();this.chamber=[];this.loaded={live:0,blank:0};this.seats=Object.fromEntries(SEATS.map(s=>[s,empty()]));this.watchers=new Set()}
 connected(){return SEATS.filter(s=>open(this.seats[s]))}
 active(){return SEATS.filter(s=>this.seats[s].alive&&open(this.seats[s]))}
 claim(ws,resume,name=''){let role='spectator';for(const s of SEATS){const x=this.seats[s];if(resume&&x.token===resume&&(!x.disconnectedAt||Date.now()-x.disconnectedAt<RECONNECT_MS)){role=s;x.socket=ws;x.disconnectedAt=0;if(name)x.name=name;break}}
  if(role==='spectator'){const free=SEATS.find(s=>!this.seats[s].token);if(free){role=free;const x=this.seats[free];x.token=token();x.socket=ws;x.name=name||`لاعب ${SEATS.indexOf(free)+1}`;x.score=0}else{if(this.watchers.size>=MAX_SPECTATORS){ws.close(1013);return}this.watchers.add(ws)}}
  ws.room=this;ws.role=role;this.last=Date.now()
  send(ws,{type:'welcome',marker:MARKER,room:this.id,role,resume_token:role==='spectator'?'':this.seats[role].token,rules:{max_players:6,lives:LIVES,turn_seconds:TURN_MS/1000}});this.maybeStart();this.broadcast()
 }
 maybeStart(){if(this.phase==='waiting'&&this.connected().length>=2){this.round++;this.phase='countdown';this.ends=Date.now()+COUNTDOWN_MS;this.notice='المجلس يستعد للجولة'}}
 /** Loads 2–8 bullets, announces the counts, and hands every living player two new items. */
 load(){const n=2+Math.floor(Math.random()*7),live=Math.max(1,Math.min(n-1,Math.round(n*(.3+Math.random()*.4))));this.chamber=shuffle([...Array(live).fill('live'),...Array(n-live).fill('blank')]);this.loaded={live,blank:n-live}
  for(const s of this.active()){const x=this.seats[s];for(let i=0;i<2&&x.items.length<MAX_ITEMS;i++)x.items.push(pick(ITEMS))}
  return `حُشيت البندقية: ${live} حيّة و${n-live} فارغة`}
 setupRound(){this.phase='live';this.winner='';for(const s of SEATS){const x=this.seats[s];x.alive=open(x);x.lives=x.alive?LIVES:0;x.items=[];x.skip=false}
  this.notice=this.load();const alive=this.active();this.turn=alive[(this.round-1)%alive.length]||'';this.ends=Date.now()+TURN_MS;this.broadcast()}
 view(){return {live:this.loaded.live,blank:this.loaded.blank,total:this.chamber.length}}
 snapshot(){this.seq++;return {type:'room',marker:MARKER,room:this.id,seq:this.seq,round:this.round,phase:this.phase,phase_ends_in_ms:this.ends?Math.max(0,this.ends-Date.now()):0,turn:this.turn,seats:Object.fromEntries(SEATS.map(s=>[s,seatState(this.seats[s])])),chamber:this.view(),winner:this.winner,notice:this.notice}}
 everyone(p){const text=JSON.stringify(p);for(const s of SEATS)if(open(this.seats[s]))this.seats[s].socket.send(text);for(const ws of this.watchers)if(ws.readyState===WebSocket.OPEN)ws.send(text)}
 broadcast(){this.everyone(this.snapshot())}
 /** Next living seat after `side`, honouring the rope: a tied player loses one turn. */
 next(side){const alive=this.active();if(!alive.length)return '';let i=SEATS.indexOf(side),skipped=[];for(let n=0;n<12;n++){i=(i+1)%SEATS.length;const s=SEATS[i];if(!alive.includes(s))continue;if(this.seats[s].skip&&s!==side){this.seats[s].skip=false;skipped.push(this.seats[s].name);continue}if(skipped.length)this.notice+=` — ${skipped.join('، ')} مربوط فخسر دوره`;return s}return alive[0]}
 action(side,msg){
  if(this.phase!=='live')return this.err(side,'not_ready')
  if(side!==this.turn||!this.seats[side].alive)return this.err(side,'not_your_turn')
  const me=this.seats[side]
  if(msg.action==='item'){const at=me.items.indexOf(msg.item);if(at<0)return this.err(side,'invalid_message')
   if(msg.item==='dallah'&&me.lives>=LIVES)return this.err(side,'invalid_target')
   me.items.splice(at,1)
   if(msg.item==='scope'){send(me.socket,{type:'peek',marker:MARKER,room:this.id,kind:this.chamber[0]||'blank'});this.notice=`${me.name} نظر بالمنظار إلى الطلقة القادمة`}
   else if(msg.item==='dallah'){me.lives++;this.notice=`${me.name} شرب من الدلّة واسترد روحًا`}
   else if(msg.item==='rope'){const alive=this.active(),i=SEATS.indexOf(side),n=[...SEATS.slice(i+1),...SEATS.slice(0,i)].find(s=>alive.includes(s));if(n&&n!==side){this.seats[n].skip=true;this.notice=`${me.name} ربط ${this.seats[n].name} بالحبل — سيخسر دوره القادم`}else this.notice=`${me.name} استخدم الحبل بلا فائدة`}
   else if(msg.item==='bukhoor'){const live=this.chamber.filter(x=>x==='live').length;this.notice=`دخان البخور كشف الباقي: ${live} حيّة و${this.chamber.length-live} فارغة`}
   this.everyone({type:'item',marker:MARKER,room:this.id,actor:side,item:msg.item});this.broadcast();return}
  if(msg.action!=='self'&&msg.action!=='shoot')return this.err(side,'invalid_message')
  const target=msg.action==='self'?side:msg.target
  if(!SEATS.includes(target)||!this.seats[target].alive||(msg.action==='shoot'&&target===side))return this.err(side,'invalid_target')
  const kind=this.chamber.shift()||'blank',t=this.seats[target];let eliminated='',damage=0
  const who=target===side?'على نفسه':`على ${t.name}`
  if(kind==='live'){damage=1;t.lives=Math.max(0,t.lives-1);this.notice=`${me.name} أطلق ${who}: طلقة حيّة!`;if(!t.lives){t.alive=false;eliminated=target;this.notice+=` — خرج ${t.name}`}}
  else this.notice=`${me.name} أطلق ${who}: طلقة فارغة${target===side?' — يحتفظ بدوره':''}`
  const alive=this.active()
  if(alive.length<=1)this.finish()
  else{this.turn=kind==='blank'&&target===side?side:this.next(side);this.ends=Date.now()+TURN_MS;if(!this.chamber.length)this.notice+=` — ${this.load()}`}
  this.everyone({type:'result',marker:MARKER,room:this.id,round:this.round,actor:side,target,kind,damage,lives:t.lives,eliminated,next_turn:this.turn,notice:this.notice,chamber:this.view()});this.broadcast()
 }
 err(side,reason){send(this.seats[side].socket,{type:'error',marker:MARKER,room:this.id,code:reason})}
 release(ws){if(ws.role&&this.seats[ws.role]){const s=this.seats[ws.role];if(s.socket===ws){s.socket=null;s.disconnectedAt=Date.now();s.alive=false;if(this.phase==='live'){if(this.active().length<=1)this.finish();else if(this.turn===ws.role){this.turn=this.next(ws.role);this.ends=Date.now()+TURN_MS}}}}else this.watchers.delete(ws);this.broadcast()}
 finish(){const alive=this.active();this.phase='ended';this.winner=alive[0]||'';if(this.winner)this.seats[this.winner].score++;this.ends=Date.now()+6000;this.turn='';this.notice=this.winner?`${this.notice} — الفائز: ${this.seats[this.winner].name}`:'لا فائز في هذه الجولة'}
 tick(){const now=Date.now();for(const s of SEATS){const x=this.seats[s];if(x.token&&x.disconnectedAt&&now-x.disconnectedAt>RECONNECT_MS)Object.assign(x,empty())}
  if(this.phase==='live'&&this.turn&&this.ends&&now>=this.ends){const late=this.turn;this.notice='';this.action(late,{action:'self'});this.notice=`انتهى وقت ${this.seats[late].name} فأُطلقت عليه — ${this.notice}`;this.broadcast()}
  if(this.phase==='countdown'&&now>=this.ends)this.setupRound();else if(this.phase==='ended'&&now>=this.ends){if(this.connected().length>=2){this.phase='countdown';this.ends=now+COUNTDOWN_MS;this.round++;this.notice='جولة جديدة'}else{this.phase='waiting';this.ends=0}this.broadcast()}
  if(this.connected().length<2&&this.phase!=='waiting'){this.phase='waiting';this.ends=0;this.turn='';for(const s of SEATS)this.seats[s].alive=false;this.broadcast()}
 }
}
function room(id){if(!rooms.has(id))rooms.set(id,new Room(id));return rooms.get(id)}
const http=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,marker:MARKER,rooms:rooms.size}));return}res.writeHead(404);res.end('Not found')})
const wss=new WebSocketServer({noServer:true,maxPayload:4096});http.on('upgrade',(req,socket,head)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{return socket.destroy()}const origin=req.headers.origin;const same=origin&&(()=>{try{return new URL(origin).host===req.headers.host}catch{return false}})();if(origin&&!same&&!allowed.has(origin))return socket.destroy();if(u.pathname!=='/ws')return socket.destroy();const id=code(u.searchParams.get('room'));if(!id||(!rooms.has(id)&&rooms.size>=MAX_ROOMS))return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,u,id))})
wss.on('connection',(ws,u,id)=>{const r=room(id);r.claim(ws,u.searchParams.get('resume')||'',cleanName(u.searchParams.get('name')));ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='action'&&ws.role!=='spectator'){r.last=Date.now();r.action(ws.role,m)}else if(m.type==='ping')send(ws,{type:'pong',marker:MARKER,room:id,t:m.t})}catch{send(ws,{type:'error',marker:MARKER,room:id,code:'invalid_message'})}});ws.on('close',()=>r.release(ws));ws.on('error',()=>r.release(ws))})
setInterval(()=>{const now=Date.now();for(const [id,r] of rooms){r.tick();if(!r.connected().length&&!r.watchers.size&&now-r.last>IDLE_MS)rooms.delete(id)}},200).unref()
http.listen(PORT,HOST,()=>console.log(JSON.stringify({marker:MARKER,status:'listening',host:HOST,port:http.address().port})))
