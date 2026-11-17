#!/usr/bin/env node
import {createServer} from 'node:http'; import {randomBytes} from 'node:crypto'; import {WebSocketServer,WebSocket} from 'ws'
const MARKER='chamber6-v1', HOST=process.env.HOST||'127.0.0.1', PORT=Number(process.env.PORT||8787)
const SEATS=['p1','p2','p3','p4','p5','p6'], MAX_ROOMS=128, MAX_CLIENTS=256, MAX_SPECTATORS=8
const COUNTDOWN_MS=3000, ROUND_MS=120000, RECONNECT_MS=60000, IDLE_MS=600000, TURN_MS=Number(process.env.TURN_MS||30000)
const cleanName=v=>String(v||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,14)
// Fills the chamber with shells for the players still alive: at least one danger, never only dangers.
function load(alive){const out=[],danger=Math.min(3,Math.max(1,Math.floor(alive/2)));for(let i=0;i<danger;i++)out.push('danger');for(let i=0;i<4;i++)out.push('safe');for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out}
const rooms=new Map(), allowed=new Set((process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean))
const token=()=>randomBytes(18).toString('base64url'), code=v=>/^[A-Z0-9]{4,8}$/.test(v)?v:''
const empty=()=>({token:'',socket:null,disconnectedAt:0,score:0,alive:false,name:''})
function seatState(s){return {connected:s.socket?.readyState===WebSocket.OPEN,alive:s.alive,score:s.score,name:s.name}}
function send(ws,p){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(p))}
class Room{
 constructor(id){this.id=id;this.seq=0;this.round=0;this.phase='waiting';this.ends=0;this.turn='';this.winner='';this.notice='';this.last=Date.now();this.chamber=[];this.seats=Object.fromEntries(SEATS.map(s=>[s,empty()]));this.watchers=new Set()}
 connected(){return SEATS.filter(s=>this.seats[s].socket?.readyState===WebSocket.OPEN)}
 active(){return SEATS.filter(s=>this.seats[s].alive&&this.seats[s].socket?.readyState===WebSocket.OPEN)}
 claim(ws,resume,name=''){let role='spectator'; for(const s of SEATS){const x=this.seats[s];if(resume&&x.token===resume&&(!x.disconnectedAt||Date.now()-x.disconnectedAt<RECONNECT_MS)){role=s;x.socket=ws;x.disconnectedAt=0;if(name)x.name=name;break}}
  if(role==='spectator'){const free=SEATS.find(s=>!this.seats[s].token);if(free){role=free;const x=this.seats[free];x.token=token();x.socket=ws;x.name=name||`لاعب ${SEATS.indexOf(free)+1}`;x.score=0}else{if(this.watchers.size>=MAX_SPECTATORS){ws.close(1013);return}this.watchers.add(ws)}}
  ws.room=this;ws.role=role;send(ws,{type:'welcome',marker:MARKER,room:this.id,role,resume_token:role==='spectator'?'':this.seats[role].token,rules:{max_players:6,round_seconds:120}});this.maybeStart();this.broadcast()
 }
 maybeStart(){if(this.phase==='waiting'&&this.connected().length>=2){this.round++;this.phase='countdown';this.ends=Date.now()+COUNTDOWN_MS;this.notice='الطاولة تستعد للجولة'}}
 setupRound(){this.phase='live';this.ends=0;this.winner='';this.notice='';this.chamber=load(this.connected().length);for(const s of SEATS)this.seats[s].alive=Boolean(this.seats[s].socket?.readyState===WebSocket.OPEN);const alive=this.active();this.turn=alive[(this.round-1)%alive.length]||'';this.ends=Date.now()+TURN_MS;this.broadcast()}
 view(){const safe=this.chamber.filter(x=>x==='safe').length,danger=this.chamber.filter(x=>x==='danger').length;return {safe,danger,total:this.chamber.length}}
 snapshot(){this.seq++;return {type:'room',marker:MARKER,room:this.id,seq:this.seq,round:this.round,phase:this.phase,phase_ends_in_ms:this.ends?Math.max(0,this.ends-Date.now()):0,turn:this.turn,seats:Object.fromEntries(SEATS.map(s=>[s,seatState(this.seats[s])])),chamber:this.view(),winner:this.winner,notice:this.notice}}
 broadcast(){const text=JSON.stringify(this.snapshot());for(const s of SEATS)if(this.seats[s].socket?.readyState===WebSocket.OPEN)this.seats[s].socket.send(text);for(const ws of this.watchers)send(ws,JSON.parse(text))}
 action(side,msg){if(this.phase!=='live'){return this.err(side,'not_ready')}if(side!==this.turn||!this.seats[side].alive)return this.err(side,'not_your_turn');if(!['self','challenge','peek'].includes(msg.action))return this.err(side,'invalid_message');if(msg.action==='peek'){this.notice='أداة البصيرة: تم كشف عدد الشحنات فقط';this.broadcast();return}
  const target=msg.action==='self'?side:msg.target;if(!SEATS.includes(target)||!this.seats[target].alive)return this.err(side,'invalid_target');const kind=this.chamber.shift()||'safe';const targetSeat=this.seats[target];let eliminated='';if(kind==='danger'){targetSeat.alive=false;eliminated=target;this.notice=`خرج ${targetSeat.name} من الجولة`}else this.notice='شحنة آمنة — الدور ينتقل';
  const alive=this.active();if(alive.length<=1){this.phase='ended';this.winner=alive[0]||'';if(this.winner)this.seats[this.winner].score++;this.ends=Date.now()+6000;this.turn='';this.notice=this.winner?`الفائز: ${this.seats[this.winner].name}`:'لا فائز في هذه الجولة'}else{const order=SEATS.filter(s=>this.seats[s].alive||s===side);const idx=order.indexOf(side);this.turn=order.slice(idx+1).concat(order.slice(0,idx+1)).find(s=>alive.includes(s))||alive[0];this.ends=Date.now()+TURN_MS;if(!this.chamber.length){this.chamber=load(alive.length);this.notice+=' — نفدت الشحنات فامتلأت الحجرة من جديد'}}
  const result={type:'result',marker:MARKER,room:this.id,round:this.round,actor:side,target,kind,eliminated,next_turn:this.turn,notice:this.notice,chamber:this.view()};for(const s of SEATS)send(this.seats[s].socket,result);for(const ws of this.watchers)send(ws,result);this.broadcast()
 }
 err(side,reason){send(this.seats[side].socket,{type:'error',marker:MARKER,room:this.id,code:reason})}
 release(ws){if(ws.role&&this.seats[ws.role]){const s=this.seats[ws.role];if(s.socket===ws){s.socket=null;s.disconnectedAt=Date.now();s.alive=false;if(this.phase==='live'&&this.turn===ws.role){const alive=this.active();this.turn=alive[0]||'';this.ends=Date.now()+TURN_MS;if(alive.length<=1)this.finish()}else if(this.phase==='live'&&this.active().length<=1)this.finish()}}else this.watchers.delete(ws);this.broadcast()}
 finish(){const alive=this.active();this.phase='ended';this.winner=alive[0]||'';if(this.winner)this.seats[this.winner].score++;this.ends=Date.now()+6000;this.turn='';this.notice=this.winner?`الفائز: ${this.seats[this.winner].name}`:'لا فائز في هذه الجولة'}
 tick(){const now=Date.now();for(const s of SEATS){const x=this.seats[s];if(x.token&&x.disconnectedAt&&now-x.disconnectedAt>RECONNECT_MS){Object.assign(x,empty())}}
  if(this.phase==='live'&&this.turn&&this.ends&&now>=this.ends){const late=this.turn;this.action(late,{action:'self'});if(this.phase==='live'||this.phase==='ended'){this.notice=`انتهى وقت ${this.seats[late].name} فسُحبت الشحنة عليه — ${this.notice}`;this.broadcast()}}
  if(this.phase==='countdown'&&now>=this.ends)this.setupRound();else if(this.phase==='ended'&&now>=this.ends){if(this.connected().length>=2){this.phase='countdown';this.ends=now+COUNTDOWN_MS;this.round++}else{this.phase='waiting';this.ends=0}this.broadcast()}
  if(this.connected().length<2&&this.phase!=='waiting'){this.phase='waiting';this.ends=0;this.turn='';for(const s of SEATS)this.seats[s].alive=false;this.broadcast()}
 }
}
function room(id){if(!rooms.has(id))rooms.set(id,new Room(id));return rooms.get(id)}
const http=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,marker:MARKER,rooms:rooms.size}));return}res.writeHead(404);res.end('Not found')})
const wss=new WebSocketServer({noServer:true,maxPayload:4096});http.on('upgrade',(req,socket,head)=>{let u;try{u=new URL(req.url,'http://localhost')}catch{return socket.destroy()}const origin=req.headers.origin;const same=origin&&(()=>{try{return new URL(origin).host===req.headers.host}catch{return false}})();if(origin&&!same&&!allowed.has(origin))return socket.destroy();if(u.pathname!=='/ws')return socket.destroy();const id=code(u.searchParams.get('room'));if(!id||(!rooms.has(id)&&rooms.size>=MAX_ROOMS))return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,u,id))})
wss.on('connection',(ws,u,id)=>{const r=room(id);r.claim(ws,u.searchParams.get('resume')||'',cleanName(u.searchParams.get('name')));ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='action'&&ws.role!=='spectator')r.action(ws.role,m);else if(m.type==='ping')send(ws,{type:'pong',marker:MARKER,room:id,t:m.t})}catch{send(ws,{type:'error',marker:MARKER,room:id,code:'invalid_message'})}});ws.on('close',()=>r.release(ws));ws.on('error',()=>r.release(ws))})
setInterval(()=>{const now=Date.now();for(const [id,r] of rooms){r.tick();if(!r.connected().length&&!r.watchers.size&&now-r.last>IDLE_MS)rooms.delete(id)}},200).unref()
http.listen(PORT,HOST,()=>console.log(JSON.stringify({marker:MARKER,status:'listening',host:HOST,port:http.address().port})))
