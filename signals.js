/* Home page signal panel. Plays real recordings, one 30 second epoch at a time:
   EEG and eye movement from a public sleep-lab night (Sleep-EDF) with the prototype
   model's own stage estimate for each epoch, and a separate public head-worn
   accelerometer recording. Data comes from sleep-data.js (tools/build-sleep-data.py).
   After each short run of epochs the playhead skips ahead to another part of the hour.
   Each epoch is read, the model's estimate appears, then the human scorer's label is
   revealed next to it with a match or miss. */
(()=>{
 const canvas=document.querySelector('#sleep-signals-canvas'),D=window.DELTA_SLEEP;
 if(!canvas||!D)return;
 const ctx=canvas.getContext('2d'),container=canvas.closest('.sleep-signals'),heading=document.querySelector('#current-sleep-stage'),$=id=>document.getElementById(id),verdict=container.querySelector('.signal-verdict');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bytes=s=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;};
 const X=new Int8Array(bytes(D.x).buffer),ACC=new Int16Array(bytes(D.acc).buffer);
 const PLAY=D.runs.flat(),N=PLAY.length,FIRST=new Set(D.runs.map(r=>r[0])),HOUR=D.hourTrue.length,ACCN=ACC.length/N/3;
 const STAGES=[
  {key:'Awake',code:'W',label:'AWAKE',color:'#c0a062',ink:'#e3c07a'},
  {key:'N1',code:'N1',label:'N1 / FALLING ASLEEP',color:'#9aabb4',ink:'#c3d0d6'},
  {key:'N2',code:'N2',label:'N2 / LIGHT SLEEP',color:'#43858b',ink:'#6fc0c7'},
  {key:'N3',code:'N3',label:'N3 / DEEP SLEEP',color:'#65658f',ink:'#a3a3dc'},
  {key:'REM',code:'REM',label:'REM / RAPID EYE MOVEMENTS',color:'#a77f66',ink:'#dba888'}];
 const argmax=a=>a.indexOf(Math.max(...a)),PRED=D.p.map(argmax),TRUE=PLAY.map(i=>D.hourTrue[i]);
 const clamp=x=>x<0?0:x>1?1:x,seg=(t,a,b)=>clamp((t-a)/(b-a)),ease=x=>1-Math.pow(1-x,3),mix=(a,b,t)=>a+(b-a)*t;
 const wrap=k=>(k%N+N)%N;
 const FONT=getComputedStyle(document.body).fontFamily||'Arial';
 const DUR=3000,SWEEP=.46,DECIDE=.58,REVEAL=.70;  // ms per epoch; when the signal is fully read, when the model answers, when the scorer's label is shown
 let width=600,height=300,visible=true,k=0,t=reduced?.999:0,previous=performance.now(),shown=-1;
 {let agree=0;for(let i=0;i<HOUR;i++)if(D.hourTrue[i]===D.hourPred[i])agree++;const el=$('sv-tally');if(el)el.textContent=`MODEL AND SCORER AGREED ON ${agree} OF ${HOUR} EPOCHS IN THIS HOUR`;}

 function resize(){const r=canvas.getBoundingClientRect();if(!r.width)return;width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
 function clock(i){const s=(D.meta.start+i)*30,h=Math.floor(s/3600),m=Math.floor(s%3600/60);return `${h}:${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

 function setReadout(){
  const phase=t<DECIDE?0:t<REVEAL?1:2,key=k*3+phase;if(key===shown)return;shown=key;
  const q=PRED[k],st=STAGES[q],ok=q===TRUE[k];
  if(phase){heading.textContent=st.label;heading.dataset.stage=st.key;}else{heading.textContent='READING 30 SECONDS';delete heading.dataset.stage;}
  canvas.dataset.focusStage=st.key;canvas.dataset.epoch=String(PLAY[k]);
  if(!verdict)return;
  verdict.dataset.result=phase<2?'pending':ok?'match':'miss';
  $('sv-est').textContent=phase?st.code:'…';$('sv-est').style.color=phase?st.ink:'';
  $('sv-conf').textContent=phase?Math.round(D.p[k][q]*100)+'% SURE':'READING';
  $('sv-true').textContent=phase===2?STAGES[TRUE[k]].code:'…';$('sv-true').style.color=phase===2?STAGES[TRUE[k]].ink:'';
  $('sv-when').textContent=clock(PLAY[k])+' INTO THE NIGHT';
  $('sv-match').textContent=phase<2?'':ok?'✓ MATCH':'✕ MISS';
 }

 function draw(){
  const small=width<430,gutter=small?52:74,right=width-6,plotW=right-gutter,prev=wrap(k-1);
  const hypTop=4,hypRow=small?8:9,lanesTop=hypTop+hypRow*2+16,probH=small?40:30,axisH=15,lanesBot=height-probH-axisH-8;
  const sweep=seg(t,0,SWEEP),run=ease(seg(t,SWEEP,DECIDE)),decided=t>=DECIDE,fade=FIRST.has(PLAY[k])?ease(seg(t,0,.1)):1;
  setReadout();
  ctx.clearRect(0,0,width,height);ctx.textBaseline='middle';ctx.lineJoin='round';
  const label=(text,y,color='#ffffffbb')=>{ctx.font=`${small?7:8}px ${FONT}`;ctx.textAlign='right';ctx.fillStyle=color;ctx.fillText(text,gutter-9,y);};

  /* the hour this night comes from: human scorer above, model below */
  const cw=plotW/HOUR;label('SCORER',hypTop+hypRow/2);label('MODEL',hypTop+hypRow*1.5+2);
  for(let i=0;i<HOUR;i++){
   const x=gutter+i*cw,w=Math.max(.6,cw-.6);ctx.globalAlpha=.5;
   ctx.fillStyle=STAGES[D.hourTrue[i]].color;ctx.fillRect(x,hypTop,w,hypRow);
   ctx.fillStyle=STAGES[D.hourPred[i]].color;ctx.fillRect(x,hypTop+hypRow+2,w,hypRow);
  }
  ctx.globalAlpha=1;
  D.runs.forEach(r=>{ctx.fillStyle='#ffffff30';ctx.fillRect(gutter+r[0]*cw,hypTop+hypRow*2+5,r.length*cw,1.5);});
  const jump=ease(seg(t,0,.1)),px=gutter+mix(PLAY[prev],PLAY[k],jump)*cw;
  ctx.strokeStyle='#fff';ctx.lineWidth=1.2;ctx.strokeRect(px-1,hypTop-1.5,cw+2,hypRow*2+5);
  ctx.fillStyle='#fff';ctx.fillRect(px+cw/2-.5,hypTop+hypRow*2+3.5,1,7);

  /* lanes: EEG, eye movement, head motion */
  const lanes=[{name:small?'EEG':'EEG / Fpz-Cz',w:1.35},{name:small?'EYES':'EYE MOVEMENT',w:1},{name:small?'MOTION':'HEAD MOTION',w:.75}],total=lanes.reduce((s,l)=>s+l.w,0);
  let y=lanesTop;for(const lane of lanes){lane.top=y;lane.h=(lanesBot-lanesTop)*lane.w/total;lane.mid=y+lane.h/2;y+=lane.h;}
  ctx.font=`${small?7:8}px ${FONT}`;
  for(let s=0;s<=30;s+=5){
   const x=Math.round(gutter+s/30*plotW)+.5;ctx.strokeStyle='#ffffff12';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,lanesTop);ctx.lineTo(x,lanesBot);ctx.stroke();
   ctx.fillStyle='#ffffff80';ctx.textAlign=s===0?'left':s===30?'right':'center';ctx.fillText(s+' s',s===0?gutter:s===30?right:x,lanesBot+9);
  }
  lanes.forEach((lane,i)=>{label(lane.name,lane.mid);if(i){ctx.fillStyle='#ffffff14';ctx.fillRect(gutter,Math.round(lane.top),plotW,1);}});
  if(!small){ctx.font=`7px ${FONT}`;ctx.textAlign='right';ctx.fillStyle='#ffffff70';ctx.fillText('X / Y / Z  g',gutter-9,lanes[2].mid+11);}

  ctx.save();ctx.beginPath();ctx.rect(gutter,lanesTop,plotW,lanesBot-lanesTop);ctx.clip();
  const cut=gutter+sweep*plotW;
  const trace=(count,value,color,lw)=>{                  // faint for what is still to come, solid for what has been read
   const path=new Path2D();for(let i=0;i<count;i++){const x=gutter+i/(count-1)*plotW,yy=value(i);i?path.lineTo(x,yy):path.moveTo(x,yy);}
   ctx.strokeStyle=color;ctx.lineWidth=lw;
   ctx.save();ctx.beginPath();ctx.rect(cut,lanesTop,right-cut,lanesBot-lanesTop);ctx.clip();ctx.globalAlpha=.2*fade;ctx.stroke(path);ctx.restore();
   ctx.save();ctx.beginPath();ctx.rect(gutter,lanesTop,cut-gutter,lanesBot-lanesTop);ctx.clip();ctx.globalAlpha=fade;ctx.stroke(path);ctx.restore();
  };
  [['#ffffff',.85],['#bfeaf0',.85]].forEach(([color,lw],c)=>{const base=(k*2+c)*3000,lane=lanes[c],amp=lane.h*.42/127;trace(3000,i=>lane.mid-X[base+i]*amp,color,lw);});
  const m=lanes[2],gScale=m.h*.36;['#ffffff','#bfeaf0','#8fb7c2'].forEach((color,a)=>{const base=(k*3+a)*ACCN;trace(ACCN,i=>m.mid-(ACC[base+i]/1000-.45)*gScale,color,.9);});
  if(sweep>0&&sweep<1){
   const g=ctx.createLinearGradient(cut-34,0,cut,0);g.addColorStop(0,'#ffffff00');g.addColorStop(1,'#ffffff1c');ctx.fillStyle=g;ctx.fillRect(cut-34,lanesTop,34,lanesBot-lanesTop);
   ctx.fillStyle='#fff';ctx.fillRect(cut-.5,lanesTop,1,lanesBot-lanesTop);
  }
  ctx.restore();

  /* what the model makes of it: probability for each stage, settling once the epoch is complete */
  const pTop=height-probH,cols=small?3:5,rowsN=Math.ceil(5/cols),cellW=plotW/cols,cellH=probH/rowsN,now=D.p[k],before=D.p[prev],top=decided?PRED[k]:-1;
  label(t<SWEEP?'READING':decided?'ESTIMATE':'STAGING',pTop+probH/2,t>=SWEEP&&!decided?'#fff':'#ffffffbb');
  for(let i=0;i<5;i++){
   const st=STAGES[i],p=mix(before[i],now[i],run),x=gutter+(i%cols)*cellW,yy=pTop+Math.floor(i/cols)*cellH+cellH/2,isTop=i===top,bw=cellW-(small?58:66);
   ctx.globalAlpha=t<SWEEP?.55:1;
   ctx.font=`${isTop?600:400} ${small?8:9}px ${FONT}`;ctx.textAlign='left';ctx.fillStyle=isTop?st.ink:'#ffffffb0';ctx.fillText(st.code,x,yy);
   ctx.fillStyle='#ffffff14';ctx.fillRect(x+26,yy-2,bw,4);ctx.fillStyle=st.color;ctx.fillRect(x+26,yy-2,bw*p,4);
   ctx.font=`${small?7:8}px ${FONT}`;ctx.fillStyle=isTop?'#fff':'#ffffff90';ctx.fillText(Math.round(p*100)+'%',x+30+bw,yy);
  }
  ctx.globalAlpha=1;
 }

 function advance(d){t+=d;while(t>=1){t-=1;k=wrap(k+1);}}
 function tick(now){
  requestAnimationFrame(tick);const dt=Math.min(now-previous,100);if(dt<16)return;previous=now;if(document.hidden||!visible)return;
  if(!reduced)advance(dt/DUR);
  draw();
 }
 new ResizeObserver(resize).observe(canvas);resize();
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(container);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
 requestAnimationFrame(tick);
})();
