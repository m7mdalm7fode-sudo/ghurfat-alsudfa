import * as THREE from 'three'
import type {Renderer} from '../engine/renderer'
import type {Quality} from '../engine/save'
import type {Result, Role, RoomState, Seat, Welcome} from '../net/protocol'
import {SEATS} from '../net/protocol'
const COLORS:Record<Seat,string>={p1:'#e0485f',p2:'#e8b84a',p3:'#2fc4b2',p4:'#9b7cf0',p5:'#4fd18b',p6:'#ff9a4d'}
export class Game{
 role:Role='spectator';state:RoomState|null=null;lastResult:Result|null=null;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(42,1,.1,100);private tokens=new Map<Seat,THREE.Mesh>();private pulse=0
 constructor(private renderer:Renderer){this.scene.background=new THREE.Color('#090713');this.scene.add(new THREE.HemisphereLight('#ffd6b0','#100b24',1.5));const key=new THREE.PointLight('#ff5c78',18,30);key.position.set(0,8,4);this.scene.add(key);const fill=new THREE.PointLight('#ffd35c',10,24);fill.position.set(-7,4,-4);this.scene.add(fill);const table=new THREE.Mesh(new THREE.CylinderGeometry(8,8,0.7,96),new THREE.MeshStandardMaterial({color:'#24162b',roughness:.55,metalness:.25}));table.position.y=-.4;table.receiveShadow=true;this.scene.add(table);const rim=new THREE.Mesh(new THREE.TorusGeometry(8,.12,12,96),new THREE.MeshStandardMaterial({color:'#ff5c78',emissive:'#ff5c78',emissiveIntensity:2}));rim.rotation.x=Math.PI/2;this.scene.add(rim);const center=new THREE.Mesh(new THREE.CylinderGeometry(2.3,2.3,.15,64),new THREE.MeshStandardMaterial({color:'#4d1e2b',emissive:'#ff5c78',emissiveIntensity:.15}));center.position.y=.02;this.scene.add(center);this.camera.position.set(0,13,15);this.camera.lookAt(0,0,0);for(const seat of SEATS){const token=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.4,32),new THREE.MeshStandardMaterial({color:COLORS[seat],emissive:COLORS[seat],emissiveIntensity:.25}));token.castShadow=true;this.scene.add(token);this.tokens.set(seat,token)}}
 get cameraRef(){return this.camera}
 welcome(m:Welcome){this.role=m.role;this.state=null;this.lastResult=null}
 room(s:RoomState){this.state=s;this.layout()}
 result(r:Result){this.lastResult=r;this.pulse=1}
 leave(){this.role='spectator';this.state=null;this.lastResult=null}
 setQuality(q:Quality){this.renderer.applyQuality(q)}
 step(dt:number){this.pulse=Math.max(0,this.pulse-dt*2)}
 render(_dt:number){this.layout();this.renderer.render(this.scene,this.camera)}
 private layout(){const s=this.state;for(const [i,seat] of SEATS.entries()){const token=this.tokens.get(seat)!;const a=(i/6)*Math.PI*2-Math.PI/2;token.position.set(Math.cos(a)*5.2,.35,Math.sin(a)*5.2);const st=s?.seats[seat];token.visible=Boolean(st?.connected||seat===this.role);token.scale.setScalar(st?.alive===false&&s?.phase==='live'?.65:1);if(s?.turn===seat&&s.phase==='live'){token.scale.setScalar(1.15+this.pulse*.12);(token.material as THREE.MeshStandardMaterial).emissiveIntensity=.8+this.pulse}else(token.material as THREE.MeshStandardMaterial).emissiveIntensity=.25}}
}
