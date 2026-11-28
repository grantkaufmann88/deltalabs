import * as THREE from 'three';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
const stage=document.querySelector('#model-stage'),status=stage.querySelector('.model-status'),description=document.querySelector('.feature-description');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const copy={
 sensing:{kicker:'BRAINWAVES & EYE MOVEMENTS',title:'Track your sleep stages',text:'In one lab study, six wrist trackers recognized only 29–52% of awake moments. Our prototype uses brain and eye signals for sleep staging',anchor:'sleep-pressure'},
 light:{kicker:'SUNRISE LIGHT & SMART WAKE',title:'Wake up less drowsy',text:'Sunrise LEDs and a smart wake window for nights and naps',anchor:'morning-light'},
 audio:{kicker:'BUILT-IN STEREO SPEAKERS',title:'Fall asleep faster',text:'Sound pulses timed to your sleep stage — designed to increase deep sleep intensity and reduce time spent falling asleep',anchor:'sleep-pressure'},
 comfort:{kicker:'SOFT / REMOVABLE / WASHABLE',title:'Breathable face cushion',text:'Soft grey-black foam and a removable, washable face cushion',anchor:'daily-life'},
 fit:{kicker:'ADJUSTABLE MAGNETIC STRAP',title:'Comfortable magnetic fit',text:'A flexible strap that adjusts to your head and spreads pressure evenly',anchor:'daily-life'},
 power:{kicker:'WIRELESS CHARGING',title:'High-speed wireless charging',text:'Set the folded mask on its charging pad, ready for the next night',anchor:'daily-life'}
};
const buttons=[...document.querySelectorAll('[data-part]')],internal=['sensing','audio','power','fit'];
let model,ready=false,parts={},flatBoxes={},meshes=[],lightMaterials=[],flat=0,active=null,pending=null,phase='idle',phaseTime=0,phaseLength=1,fromFlat=0,closePositions={},closePairs=[],closeOpen=0,plan=null,openness=0,glowAfter=false,glow=0;const pairBoxes=new Map();
let pcbLocal=1,pcbFrom=1,rigidMounts=[],lastPCB="";let phaseStarted=performance.now();
let yaw=.25,yawGoal=.25,pitch=0,pitchGoal=0,drag=false,px=0,py=0,inertia=0,lastInput=-10000,onScreen=true;
const ease=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const basePosition=key=>new THREE.Vector3(0,0,key==='light'?.0008:0);
function text(key){const d=copy[key];document.querySelector('#part-kicker').textContent=d?d.kicker:'TRACK / SLEEP / WAKE';document.querySelector('#part-title').textContent=d?d.title:'One mask';document.querySelector('#part-copy').textContent=d?d.text:'Select a feature below';document.querySelector('#part-science').href=d?'sleep.html#'+d.anchor:'sleep.html';buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.part===key)));}
function enter(name,length){phase=name;phaseTime=0;phaseStarted=performance.now();phaseLength=reduced?.001:length;stage.dataset.phase=name;status.textContent=name==='flattening'?'Opening the band':'';description.setAttribute('aria-busy','false');}
function view(angle){yawGoal+=Math.atan2(Math.sin(angle-yawGoal),Math.cos(angle-yawGoal));pitchGoal=0;inertia=0;lastInput=performance.now();}
function resetOffsets(){for(const [key,o] of Object.entries(parts)){o.position.copy(basePosition(key));if(o.userData.pairs)for(const child of o.userData.pairs)child.position.x=0;}openness=0;}
function close(){
 stage.classList.remove('show-charging');glowAfter=active==='light';glow=0;closePositions={};closePairs=[];fromFlat=flat;closeOpen=openness;
 for(const [key,o] of Object.entries(parts)){closePositions[key]=o.position.clone();if(o.userData.pairs)for(const child of o.userData.pairs)closePairs.push({child,x:child.position.x});}
 pcbFrom=pcbLocal;enter(active==='sensing'&&pcbLocal<.33803?'pcb-folding':'closing',active==='sensing'&&pcbLocal<.33803?1.5:.70);
}
function next(){
 if(pending==='@light'){pending=null;active='light';text(active);view(2.28);enter('illuminating',2.4);return;}
 if(pending===null){active=null;plan=null;flat=0;text(null);enter('idle',1);return;}
 if(pending==='power'){active='power';pending=null;flat=0;resetOffsets();text(active);stage.classList.add('show-charging');enter('charging',1);return;}
 active=null;fromFlat=flat;view(pending==='comfort'?2.20:pending==='fit'?.86:.25);enter('flattening',1.6);
}
function request(key){
 if(key!==null&&!copy[key])return;pending=key;text(key);buttons.forEach(b=>b.dataset.pending=String(b.dataset.part===key));
 if(!ready)return;
 if(['pcb-folding','pcb-seated','cover-seating','closing','curving','hold'].includes(phase))return;
 if(['idle','charging','lit','illuminating'].includes(phase)&&flat<.001&&openness<.001){stage.classList.remove('show-charging');glow=0;active=null;next();}else close();
}
buttons.forEach(b=>b.addEventListener('click',()=>{history.replaceState(null,'','#'+b.dataset.part);request(b.dataset.part);}));
window.addEventListener('hashchange',()=>request(copy[location.hash.slice(1)]?location.hash.slice(1):null));
function boxUnion(keys){const box=new THREE.Box3();for(const key of keys)if(flatBoxes[key])box.union(flatBoxes[key]);return box;}
function makePlan(key){
 const gap=.045,positions={},radials=[];for(const name in parts)positions[name]=basePosition(name);
 const structural=['shell','padding','light','frame','comfort'];let faces=[],selectedBox=flatBoxes[key];
 if(key==='comfort'){
  const core=boxUnion(['shell','light','frame']);positions.comfort.z=core.max.z+gap-selectedBox.min.z;positions.comfort.y=.055;
 }else{
  faces=key==='sensing'?['shell','padding','light']:key==='light'?['shell','padding']:[];
  const core=boxUnion(structural.filter(n=>n!==key&&!faces.includes(n)));
  positions[key].z=core.min.z-gap-selectedBox.max.z;
  const faceBox=boxUnion(faces);const faceOffset=selectedBox.min.z+positions[key].z-gap-faceBox.max.z;
  for(const name of faces){positions[name].z+=faceOffset;positions[name].y=-.025;}
  if(!parts[key].userData.pairs)positions[key].y=.075;
  if(parts[key].userData.pairs){
   const context=boxUnion(structural);
   for(const child of parts[key].userData.pairs){const b=pairBoxes.get(child);const x=child.userData.side<0?context.min.x-gap-b.max.x:context.max.x+gap-b.min.x;radials.push({child,x});}
  }
 }
 const bounds=new THREE.Box3();
 for(const name of structural){const b=flatBoxes[name]?.clone();if(b)bounds.union(b.translate(positions[name]));}
 if(radials.length){for(const {child,x} of radials)bounds.union(pairBoxes.get(child).clone().translate(new THREE.Vector3(x,0,positions[key].z)));}
 else bounds.union(selectedBox.clone().translate(positions[key]));
 const size=bounds.getSize(new THREE.Vector3());return {key,faces,positions,radials,width:size.x,depth:size.z,gap};
}
function open(){active=pending;pending=null;plan=makePlan(active);text(active);buttons.forEach(b=>b.dataset.pending='false');description.setAttribute('aria-busy','false');enter(plan.faces.length?'face':'part',plan.faces.length?.65:active==='sensing'?4.5:1.9);}
function transition(dt){
 phaseTime=(performance.now()-phaseStarted)/1000;const u=THREE.MathUtils.clamp(phaseTime/phaseLength,0,1),e=ease(u);
 if(phase==='pcb-release'){pcbLocal=THREE.MathUtils.lerp(1,.24/.71,e);if(u===1)enter('part',4.5);
 }else if(phase==='pcb-folding'){pcbLocal=THREE.MathUtils.lerp(pcbFrom,.24/.71,e);if(u===1)enter('closing',.70);
 }else if(phase==='closing'){
  const horizontal=ease(u/.42),partReturn=ease((u-.42)/.34),faceReturn=ease((u-.76)/.24);
  for(const [key,o] of Object.entries(parts)){
   const from=closePositions[key]||basePosition(key),base=basePosition(key),isFace=plan?.faces.includes(key);
   if(isFace){if(active!=='sensing')o.position.lerpVectors(from,base,faceReturn);}
   else{o.position.x=THREE.MathUtils.lerp(from.x,base.x,horizontal);o.position.y=THREE.MathUtils.lerp(from.y,base.y,horizontal);o.position.z=THREE.MathUtils.lerp(from.z,base.z,partReturn);}
  }
  for(const item of closePairs)item.child.position.x=item.x*(1-horizontal);flat=fromFlat;openness=closeOpen*(1-e);
  if(u===1){if(active==='sensing'){pcbFrom=pcbLocal;openness=.35;enter('pcb-seated',3.2);}else{resetOffsets();fromFlat=flat;enter('curving',.9);}}
 }else if(phase==='pcb-seated'){pcbLocal=THREE.MathUtils.lerp(pcbFrom,1,e);if(u===1)enter('cover-seating',.6);
 }else if(phase==='cover-seating'){for(const key of plan.faces)parts[key].position.lerpVectors(closePositions[key],basePosition(key),e);openness=.35*(1-e);if(u===1){resetOffsets();fromFlat=flat;enter('curving',.9);}
 }else if(phase==='curving'){
  flat=fromFlat*(1-e);
  if(u===1){flat=0;pcbLocal=1;active=null;enter('hold',.12);}
 }else if(phase==='hold'&&u===1){
  if(glowAfter){glowAfter=false;active='light';text(active);view(2.28);enter('illuminating',2.4);}else next();
 }else if(phase==='flattening'){
  flat=THREE.MathUtils.lerp(fromFlat,1,e);
  if(u===1){flat=1;open();}
 }else if(phase==='face'){
  for(const key of plan.faces)parts[key].position.lerpVectors(basePosition(key),plan.positions[key],e);openness=.35*e;
  if(u===1)enter(active==='sensing'?'pcb-release':'part',active==='sensing'?2.4:1.9);
 }else if(phase==='part'){
  if(active==='sensing')pcbLocal=(.24/.71)*(1-ease((u-.55)/.45));const z=ease(Math.min(1,u/.55)),out=ease(Math.max(0,(u-.48)/.52)),base=basePosition(active);parts[active].position.z=THREE.MathUtils.lerp(base.z,plan.positions[active].z,z);parts[active].position.y=plan.positions[active].y*out;for(const item of plan.radials)item.child.position.x=item.x*out;openness=.35+.65*e;
  if(u===1){openness=1;stage.dataset.clearance=plan.gap.toFixed(3);enter('open',1);}
 }else if(phase==='open'&&active==='light'&&phaseTime>3.8){pending='@light';close();
 }else if(phase==='illuminating'){
  glow=e;stage.dataset.assembled='true';
  if(u===1){glow=1;if(pending&&pending!=='@light'){glow=0;active=null;next();}else{pending=null;enter('lit',1);}}
 }
 stage.dataset.flatten=flat.toFixed(3);stage.dataset.activePart=active||'';stage.dataset.glow=glow.toFixed(3);stage.dataset.assembled=String(flat<.001&&openness<.001);
}
function hingeY(p,start,angle,r=.00125){const q=p.clone(),d=q.y-start;if(d<=0||Math.abs(angle)<1e-8)return q;const a=Math.min(d/r,Math.abs(angle))*Math.sign(angle),tail=Math.max(0,d-r*Math.abs(angle)),radius=r*Math.sign(angle),effective=radius-(q.z+.00045);q.y=start+effective*Math.sin(a)+tail*Math.cos(a);q.z=-.00045+radius-effective*Math.cos(a)+tail*Math.sin(a);return q;}
function boardPoint(p,up,tip,ear,curve){let q=p.clone();if(p.y>.0139&&[-.03361,-.00001,.03359].some(c=>Math.abs(p.x-c)<.00982)){q=hingeY(q,.0180,-Math.PI/2*tip,.0008);q=hingeY(q,.0139,Math.PI/2*up,.0010);}if(Math.abs(p.x)>=.10495&&Math.abs(p.x)<=.11505&&p.y<-.0095596884){q.y=-q.y;q=hingeY(q,.0200,Math.PI/2*ear,.0018);q=hingeY(q,.0095596884,Math.PI/2*ear,.0018);q.y=-q.y;}if(curve>1e-8){const r=.115/curve,a=q.x/r,x=(r-q.z)*Math.sin(a);q.z=r-(r-q.z)*Math.cos(a);q.x=x;}return q;}
function updatePCB(){
 const signature=flat.toFixed(5)+':'+pcbLocal.toFixed(5);if(signature===lastPCB)return;lastPCB=signature;
 const a=pcbLocal*.71,up=ease(a/.24),tip=ease((a-.24)/.22),ear=ease((a-.46)/.25),curve=.82*(1-flat),weights={};
 if(pcbLocal>.999){weights.Flatten=flat;}else if(a<.24){weights.FlatPCB=1-up;weights.TipsUp=up;}else if(a<.46){weights.TipsUp=1-tip;weights.EarOpen=tip;}else{weights.EarOpen=1-ear;weights.Flatten=ear;}
 parts.sensing.traverse(o=>{if(!o.isMesh||!o.morphTargetInfluences?.length)return;o.morphTargetInfluences.fill(0);for(const [name,value] of Object.entries(weights)){const index=o.morphTargetDictionary[name];if(index!==undefined)o.morphTargetInfluences[index]=value;}});
 for(const rig of rigidMounts){const p=new THREE.Vector3(...rig.userData.mount_m),q=boardPoint(p,up,tip,ear,curve),dx=boardPoint(p.clone().add(new THREE.Vector3(.00001,0,0)),up,tip,ear,curve).sub(q).normalize(),dy=boardPoint(p.clone().add(new THREE.Vector3(0,.00001,0)),up,tip,ear,curve).sub(q).normalize(),normal=dx.clone().cross(dy).normalize();dy.copy(normal).cross(dx).normalize();rig.position.copy(q);rig.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dx,dy,normal));}
 stage.dataset.pcbLocal=pcbLocal.toFixed(3);stage.dataset.substrates='1';stage.dataset.rigidMounts=String(rigidMounts.length);stage.dataset.mountPose=JSON.stringify(rigidMounts.slice(0,3).map(r=>[...r.position.toArray(),...r.quaternion.toArray()]));
}
try{
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'default'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;stage.prepend(renderer.domElement);
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Mask model — drag or swipe to rotate, or use the arrow keys');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.04,6);let distance=.70;camera.position.set(0,.10,-distance);camera.lookAt(0,.015,.005);
 scene.add(new THREE.HemisphereLight(0xffffff,0x11151a,1.1));
 const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(-.35,.32,-.45);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-.8,right:.8,top:.5,bottom:-.5,near:.05,far:2});sun.shadow.normalBias=.001;sun.shadow.bias=-.00001;scene.add(sun);
 const rim=new THREE.DirectionalLight(0xffffff,2.1);rim.position.set(.35,.15,.35);scene.add(rim);
 const sunrise=new THREE.PointLight(0xffb371,0,1,.9);sunrise.position.set(0,0,.035);scene.add(sunrise);
 const resize=()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(stage);resize();
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=true;px=e.clientX;py=e.clientY;inertia=0;lastInput=performance.now();canvas.setPointerCapture(e.pointerId);stage.classList.add('dragging');});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;inertia=THREE.MathUtils.clamp((e.clientX-px)*.005,-.09,.09);yawGoal+=inertia;pitchGoal=THREE.MathUtils.clamp(pitchGoal+(e.clientY-py)*.0035,-.55,.55);px=e.clientX;py=e.clientY;lastInput=performance.now();});
 const release=()=>{drag=false;lastInput=performance.now();stage.classList.remove('dragging');};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{if(drag)release();});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();inertia=0;lastInput=performance.now();if(e.key==='ArrowLeft')yawGoal-=.18;if(e.key==='ArrowRight')yawGoal+=.18;if(e.key==='ArrowUp')pitchGoal=Math.max(-.55,pitchGoal-.12);if(e.key==='ArrowDown')pitchGoal=Math.min(.55,pitchGoal+.12);if(e.key==='Home')view(.25);});
 function flatPoint(g,i){const p=g.attributes.position,m=g.morphAttributes.position?.[0];const v=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));if(m){const f=new THREE.Vector3(m.getX(i),m.getY(i),m.getZ(i));if(g.morphTargetsRelative)v.add(f);else v.copy(f);}return v;}
 function boundsOf(object){const box=new THREE.Box3();object.traverse(o=>{if(o.isMesh)for(let i=0;i<o.geometry.attributes.position.count;i++)box.expandByPoint(flatPoint(o.geometry,i));});return box;}
 function correctMorphNormals(g){
  if(!g.morphAttributes.position?.length)return;g.computeVertexNormals();const base=g.attributes.normal,p=g.attributes.position,count=p.count;
  g.morphAttributes.normal=g.morphAttributes.position.map(target=>{const coords=new Float32Array(count*3);for(let i=0;i<count;i++){coords[i*3]=target.getX(i)+(g.morphTargetsRelative?p.getX(i):0);coords[i*3+1]=target.getY(i)+(g.morphTargetsRelative?p.getY(i):0);coords[i*3+2]=target.getZ(i)+(g.morphTargetsRelative?p.getZ(i):0);}const temp=new THREE.BufferGeometry();temp.setAttribute('position',new THREE.BufferAttribute(coords,3));if(g.index)temp.setIndex(g.index.clone());temp.computeVertexNormals();const normal=temp.attributes.normal,delta=new Float32Array(count*3);for(let i=0;i<count;i++){delta[i*3]=normal.getX(i)-(g.morphTargetsRelative?base.getX(i):0);delta[i*3+1]=normal.getY(i)-(g.morphTargetsRelative?base.getY(i):0);delta[i*3+2]=normal.getZ(i)-(g.morphTargetsRelative?base.getZ(i):0);}temp.dispose();return new THREE.BufferAttribute(delta,3);});
 }
 function splitPair(original){
  const pair=new THREE.Group();pair.name=original.name;const left=new THREE.Group(),right=new THREE.Group();left.userData.side=-1;right.userData.side=1;pair.add(left,right);pair.userData.pairs=[left,right];
  original.traverse(source=>{
   if(!source.isMesh)return;const g=source.geometry,index=g.index,p=g.attributes.position,n=g.attributes.normal,mp=g.morphAttributes.position?.[0],mn=g.morphAttributes.normal?.[0],buckets=Array.from({length:2},()=>({p:[],n:[],mp:[],mn:[]}));
   for(let i=0;i<(index?index.count:p.count);i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);const side=ids.reduce((sum,id)=>sum+flatPoint(g,id).x,0)<0?0:1;for(const id of ids){for(const [key,attribute] of [['p',p],['n',n],['mp',mp],['mn',mn]])if(attribute)buckets[side][key].push(attribute.getX(id),attribute.getY(id),attribute.getZ(id));}}
   buckets.forEach((b,i)=>{if(!b.p.length)return;const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));if(b.mp.length)geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(b.mp,3)];if(b.mn.length)geometry.morphAttributes.normal=[new THREE.Float32BufferAttribute(b.mn,3)];geometry.morphTargetsRelative=g.morphTargetsRelative;const mesh=new THREE.Mesh(geometry,source.material);mesh.castShadow=true;mesh.receiveShadow=true;(i?right:left).add(mesh);});
  });
  original.parent.add(pair);original.parent.remove(original);pairBoxes.set(left,boundsOf(left));pairBoxes.set(right,boundsOf(right));return pair;
 }
 new GLTFLoader().load('./assets/mask.glb?v=27',g=>{
  model=g.scene;model.position.y=-.008;scene.add(model);
  const colors={shell:0x272b2d,frame:0x191d20,padding:0x22282a,comfort:0x282e30,light:0xb5ad9b,sensing:0x22292a,fit:0x24282b,audio:0x51300f,power:0x343b3e};
  for(const key of Object.keys(colors)){
   let object=model.getObjectByName(key);if(!object)continue;
   object.traverse(o=>{if(!o.isMesh)return;correctMorphNormals(o.geometry);const old=o.material,name=old?.name||'',metal=/Metal|Copper/.test(name);let color=metal?(/Copper/.test(name)?new THREE.Color().setRGB(.55,.25,.075):0xb9bfc3):/Flex PCB/.test(name)?new THREE.Color().setRGB(.58,.27,.045):/Chip body/.test(name)?0x171a1d:colors[key];o.material=new THREE.MeshStandardMaterial({color,roughness:metal?(/Copper/.test(name)?.48:.22):key==='comfort'?.95:.8,metalness:metal?(/Copper/.test(name)?.38:.82):.02,side:THREE.FrontSide});if(/Flex PCB/.test(name)){o.material.transparent=true;o.material.opacity=.78;}o.castShadow=true;o.receiveShadow=true;if(metal){o.material.polygonOffset=true;o.material.polygonOffsetFactor=-1;o.material.polygonOffsetUnits=-1;}if(key==='light'){o.material.polygonOffset=true;o.material.polygonOffsetFactor=1;o.material.polygonOffsetUnits=1;lightMaterials.push(o.material);}if(key==='frame'){o.material.polygonOffset=true;o.material.polygonOffsetFactor=2;o.material.polygonOffsetUnits=2;}});
   if(['fit','audio','power'].includes(key))object=splitPair(object);parts[key]=object;flatBoxes[key]=boundsOf(object);object.position.copy(basePosition(key));
  }
  const cloth=document.createElement('canvas');cloth.width=1024;cloth.height=512;const ctx=cloth.getContext('2d');ctx.fillStyle='#272b2d';ctx.fillRect(0,0,1024,512);const grain=ctx.createImageData(1024,512);let grainSeed=0x915f36a;for(let i=0;i<grain.data.length;i+=4){grainSeed^=grainSeed<<13;grainSeed^=grainSeed>>>17;grainSeed^=grainSeed<<5;const n=((grainSeed>>>0)%17)-8;grain.data[i]=39+n;grain.data[i+1]=43+n;grain.data[i+2]=45+n;grain.data[i+3]=255;}ctx.putImageData(grain,0,0);const texture=new THREE.CanvasTexture(cloth);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  parts.shell.traverse(o=>{if(!o.isMesh)return;const uv=new Float32Array(o.geometry.attributes.position.count*2);for(let i=0;i<uv.length/2;i++){const p=flatPoint(o.geometry,i);uv[i*2]=.5-p.x/.275;uv[i*2+1]=.5+p.y/.12;}o.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));o.material.map=texture;o.material.color.set(0xffffff);o.material.polygonOffset=true;o.material.polygonOffsetFactor=-1;o.material.polygonOffsetUnits=-1;o.material.needsUpdate=true;});
  const logo=new Image();logo.onload=()=>{ctx.drawImage(logo,412,168,200,112);texture.needsUpdate=true;};logo.src='./assets/wordmark.svg?v=7';
  parts.comfort.traverse(o=>{if(!o.isMesh)return;const rest=new Float32Array(o.geometry.attributes.position.count*3);for(let i=0;i<rest.length/3;i++){const p=flatPoint(o.geometry,i);rest[i*3]=p.x;rest[i*3+1]=p.y;rest[i*3+2]=p.z;}o.geometry.setAttribute('restSurface',new THREE.BufferAttribute(rest,3));o.material.roughness=.96;o.material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec3 restSurface; varying vec3 vFoamRest;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFoamRest=restSurface;');
   shader.fragmentShader='varying vec3 vFoamRest; float foamHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);} float foamNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(foamHash(i),foamHash(i+vec3(1,0,0)),f.x),mix(foamHash(i+vec3(0,1,0)),foamHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(foamHash(i+vec3(0,0,1)),foamHash(i+vec3(1,0,1)),f.x),mix(foamHash(i+vec3(0,1,1)),foamHash(i+vec3(1,1,1)),f.x),f.y),f.z); }\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat foamFootprint=max(length(dFdx(vFoamRest)),length(dFdy(vFoamRest)))*2600.0;float foamDetail=1.0-smoothstep(0.35,1.1,foamFootprint);float foamGrain=mix(0.5,foamNoise(vFoamRest*2600.0),foamDetail);diffuseColor.rgb*=0.94+0.12*foamGrain;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nfloat fh=foamGrain*0.000035;vec3 fq0=dFdx(-vViewPosition),fq1=dFdy(-vViewPosition),fr1=cross(fq1,normal),fr2=cross(normal,fq0);float fd=dot(fq0,fr1);normal=normalize(abs(fd)*normal-sign(fd)*(dFdx(fh)*fr1+dFdy(fh)*fr2));');
  };o.material.customProgramCacheKey=()=> 'attached-foam-7';o.material.needsUpdate=true;});
  model.traverse(o=>{if(o.isMesh)meshes.push(o);if(o.userData.rigid_smt&&Array.isArray(o.userData.mount_m))rigidMounts.push(o);});
  ready=true;stage.classList.add('model-loaded');status.textContent='';stage.dataset.morphs=String(meshes.filter(o=>o.morphTargetInfluences?.length).length);stage.dataset.assembled='true';if(copy[location.hash.slice(1)])request(location.hash.slice(1));else if(pending)next();
 },undefined,()=>{status.textContent='Use the buttons below to explore each feature';});
 new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;}).observe(stage);let previous=performance.now();
 function frame(now){
  requestAnimationFrame(frame);if(now-previous<33)return;const dt=Math.min((now-previous)/1000,.25);previous=now;if(document.hidden||!onScreen)return;
  if(model&&ready){
   transition(dt);if(!drag&&!reduced){if(now-lastInput>5000)yawGoal+=dt*(active?.017:.045);else if(Math.abs(inertia)>.0001){yawGoal+=inertia;inertia*=Math.exp(-dt*10);}}
   const blend=reduced?1:1-Math.exp(-dt*5);yaw=THREE.MathUtils.lerp(yaw,yawGoal,blend);pitch=THREE.MathUtils.lerp(pitch,pitchGoal,blend);model.rotation.set(pitch,yaw,0);
   for(const mesh of meshes)if(mesh.morphTargetInfluences?.length&&!mesh.morphTargetDictionary.FlatPCB)mesh.morphTargetInfluences[0]=flat;updatePCB();
   for(const [key,o] of Object.entries(parts)){
    if(internal.includes(key))o.visible=active===key&&!['curving','hold','flattening','charging','illuminating','lit'].includes(phase);
    if(key==='frame')o.visible=flat>.95&&active!==null;
    if(key==='padding')o.visible=!!plan?.faces.includes('padding')&&Math.abs(o.position.z)>.012;
   }
   for(const material of lightMaterials){material.emissive.set(0xffad58);material.emissiveIntensity=glow*1.8;}sunrise.intensity=glow*.045;
   const visibleWidth=active==='fit'?.67:active?Math.max(.30,plan?.width||.30):.28+.39*flat;
   const width=visibleWidth,depth=.18*(1-flat)+.03*flat+(plan?.depth||0)*openness;
   const mobile=camera.aspect<1.2,frameScale=mobile?(active?.6:.60):(active?.9:1);const target=Math.max(mobile?.34:.38,(width/(2*Math.tan(THREE.MathUtils.degToRad(17))*camera.aspect)*1.15+depth*.35)*frameScale);distance=THREE.MathUtils.lerp(distance,target,blend);camera.position.set(0,.10,-distance);camera.lookAt(0,.015,.005);renderer.toneMappingExposure=THREE.MathUtils.lerp(renderer.toneMappingExposure,active?1.38:1.12,blend);
  }
  if(phase!=='charging')renderer.render(scene,camera);
 }requestAnimationFrame(frame);
}catch(error){status.textContent='Use the buttons below to explore each feature';}
