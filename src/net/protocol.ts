export const BUILD = 'chamber6-v2'
export const MAX_MESSAGE_BYTES = 8192
export const SEATS = ['p1','p2','p3','p4','p5','p6'] as const
export const ITEMS = ['scope','dallah','rope','bukhoor'] as const
export type Seat = typeof SEATS[number]
export type Item = typeof ITEMS[number]
export type Role = Seat | 'spectator'
export type Phase = 'waiting' | 'countdown' | 'live' | 'ended'
export type Bullet = 'live' | 'blank'
export type SeatState = { connected: boolean; alive: boolean; score: number; name: string; lives: number; items: Item[] }
/** `live`/`blank` are the counts announced when the rifle was loaded; `total` is what is left. */
export type ChamberView = { live: number; blank: number; total: number }
export type RoomState = { type:'room'; marker:string; room:string; seq:number; round:number; phase:Phase; phase_ends_in_ms:number; turn:Seat|''; seats:Record<Seat,SeatState>; chamber:ChamberView; winner:Seat|''; notice:string }
export type Welcome = { type:'welcome'; marker:string; room:string; role:Role; resume_token:string; rules:{max_players:number;lives:number;turn_seconds:number} }
export type Result = { type:'result'; marker:string; room:string; round:number; actor:Seat; target:Seat; kind:Bullet; damage:number; lives:number; eliminated:Seat|''; next_turn:Seat|''; notice:string; chamber:ChamberView }
export type Peek = { type:'peek'; marker:string; room:string; kind:Bullet }
export type ItemUsed = { type:'item'; marker:string; room:string; actor:Seat; item:Item }
export type Pong = { type:'pong'; marker:string; room:string; t:number }
export type ServiceError = { type:'error'; marker:string; room:string; code:'invalid_message'|'not_your_turn'|'invalid_target'|'not_ready' }
export type Message = Welcome|RoomState|Result|Peek|ItemUsed|Pong|ServiceError
export type ClientAction = { type:'action'; action:'self'|'shoot'|'item'; target?:Seat; item?:Item }
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const isObject=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v)
const isSeat=(v:unknown):v is Seat=>SEATS.includes(v as Seat)
const isBullet=(v:unknown):v is Bullet=>v==='live'||v==='blank'
export function validRoom(v:string){return /^[A-Z0-9]{4,8}$/.test(v)}
export function sanitizeRoom(v:string|null|undefined){return String(v??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)}
export function generateRoom(r=Math.random){let s='';for(let i=0;i<6;i++)s+=ALPHABET[Math.floor(r()*ALPHABET.length)];return s}
export function parseEnvelope(text:string){if(new TextEncoder().encode(text).length>MAX_MESSAGE_BYTES)return null;try{const v=JSON.parse(text);return isObject(v)?v:null}catch{return null}}
export function decode(text:string,room:string,lastSeq:number):Message|null{
 const raw=parseEnvelope(text); if(!raw||raw.marker!==BUILD||raw.room!==room||typeof raw.type!=='string')return null
 if(raw.type==='pong')return Number.isSafeInteger(raw.t)?raw as Pong:null
 if(raw.type==='error')return raw.code==='invalid_message'||raw.code==='not_your_turn'||raw.code==='invalid_target'||raw.code==='not_ready'?raw as ServiceError:null
 if(raw.type==='welcome')return (typeof raw.role==='string'&&(raw.role==='spectator'||isSeat(raw.role))&&typeof raw.resume_token==='string'&&isObject(raw.rules))?raw as Welcome:null
 if(raw.type==='result')return isSeat(raw.actor)&&isSeat(raw.target)&&isBullet(raw.kind)&&typeof raw.notice==='string'&&isObject(raw.chamber)?raw as Result:null
 if(raw.type==='peek')return isBullet(raw.kind)?raw as Peek:null
 if(raw.type==='item')return isSeat(raw.actor)&&ITEMS.includes(raw.item as Item)?raw as ItemUsed:null
 if(raw.type==='room')return Number.isSafeInteger(raw.seq)&&Number(raw.seq)>lastSeq&&Number.isSafeInteger(raw.round)&&['waiting','countdown','live','ended'].includes(String(raw.phase))&&isObject(raw.seats)&&isSeatOrEmpty(raw.turn)&&isSeatOrEmpty(raw.winner)?raw as RoomState:null
 return null
}
function isSeatOrEmpty(v:unknown):v is Seat|''{return v===''||isSeat(v)}
