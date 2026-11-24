/* Features page: network flow for one 30 second epoch, end to end.
   Adapted from cnn-visualization in github.com/24mjihad/deltalabs-sleep (CNNVISUALIZATION).
   Every dot is one channel of a layer, lit by its real mean activation for the epoch on
   screen; lines brighten where both ends are active. Data comes from sleep-data.js
   (tools/build-sleep-data.py). Output size and parameter count sit above each layer. */
(()=>{
 const cv=document.querySelector('#flow-canvas'),D=window.DELTA_SLEEP;
 if(!cv||!D)return;
 const card=cv.closest('.network-card'),$=id=>document.getElementById(id);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bytes=s=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;};
 const X=new Int8Array(bytes(D.x).buffer),MEANS=bytes(D.means),FEAT=bytes(D.feat),H=new Int8Array(bytes(D.h).buffer),HP=new Int8Array(bytes(D.hPrev).buffer);
 const PLAY=D.runs.flat(),N=PLAY.length,HOUR=D.hourTrue.length;
 const CODES=['W','N1','N2','N3','REM'],NAMES=['Awake','Light sleep, stage 1','Light sleep, stage 2','Deep sleep','REM sleep'];
 const SCOL=['#e3c07a','#c3d0d6','#6fc0c7','#a3a3dc','#dba888'],SDIM=['#c0a062','#9aabb4','#43858b','#65658f','#a77f66'];
 const INK='#ffffff',INK2='#c9d6d9',INK3='#7f9096',EEG='#ffffff',EOG='#bfeaf0';
 const argmax=a=>a.indexOf(Math.max(...a)),PRED=D.p.map(argmax),TRUE=PLAY.map(i=>D.hourTrue[i]);
 const clamp=x=>x<0?0:x>1?1:x,seg=(t,a,b)=>clamp((t-a)/(b-a)),ease=x=>1-Math.pow(1-x,3),mix=(a,b,t)=>a+(b-a)*t,wrap=k=>(k%N+N)%N;
 const FONT=getComputedStyle(document.body).fontFamily||'Arial';

 const COLS=[
  {n:16,name:'STEM',short:'STEM',sub:'16 × 125',par:'1,632'},{n:32,name:'DS BLOCK 1',short:'DS1',sub:'32 × 63',par:'1,280'},
  {n:48,name:'DS BLOCK 2',short:'DS2',sub:'48 × 32',par:'3,520'},{n:64,name:'DS BLOCK 3',short:'DS3',sub:'64 × 16',par:'6,784'},
  {n:70,name:'FEATURE',short:'FEAT',sub:'64 + 6',par:'–'},{n:32,name:'LSTM',short:'LSTM',sub:'32',par:'13,312'},{n:5,name:'STAGE',short:'OUT',sub:'5',par:'165'}];
 const OFF=[0,16,48,96];

 /* activation ramp: panel dark -> teal -> near white */
 const RAMP=new Uint8Array(256*3);
 {const stops=[[0,14,22,26],[.3,34,84,96],[.68,120,196,208],[1,240,252,255]];
  for(let i=0;i<256;i++){const t=Math.pow(i/255,.8);let s=0;while(s<stops.length-2&&t>stops[s+1][0])s++;const a=stops[s],b=stops[s+1],u=(t-a[0])/(b[0]-a[0]);for(let j=0;j<3;j++)RAMP[i*3+j]=a[j+1]+(b[j+1]-a[j+1])*u;}}
 const rampCss=x=>{const i=Math.max(0,Math.min(255,x|0))*3;return `rgb(${RAMP[i]},${RAMP[i+1]},${RAMP[i+2]})`;};
 const diverge=x=>{const a=Math.min(1,Math.abs(x)),c=x>=0?[111,192,199]:[224,146,92];return `rgb(${mix(20,c[0],a)|0},${mix(26,c[1],a)|0},${mix(30,c[2],a)|0})`;};

 /* node values for a played epoch: 7 arrays. LSTM is signed, the rest 0..1.
    before=true gives the state the network was in when this epoch arrived. */
 const CACHE={};
 function vals(e,before){
  const key=e+(before?'b':'');if(CACHE[key])return CACHE[key];
  const src=before?wrap(e-1):e,out=COLS.map(c=>new Float32Array(c.n));
  for(let c=0;c<4;c++)for(let i=0;i<COLS[c].n;i++)out[c][i]=MEANS[src*160+OFF[c]+i]/255;
  for(let i=0;i<64;i++)out[4][i]=Math.sqrt(FEAT[src*64+i]/255);
  for(let i=0;i<6;i++)out[4][64+i]=Math.min(1,Math.sqrt(D.aux[src][i]));
  for(let i=0;i<32;i++)out[5][i]=(before?HP[e*32+i]:H[e*32+i])/127;      // the carried state is the real one from the epoch before
  out[6].set(D.p[src]);
  return CACHE[key]=out;
 }

 let G=null;
 function geom(w,h){
  const dpr=Math.min(devicePixelRatio||1,2);
  if(G&&G.w===w&&G.h===h&&G.dpr===dpr)return G;
  const narrow=w<520,x0=w*(narrow?.24:.27),x1=w*(narrow?.84:.87),gap=(x1-x0)/6,top=58,bot=h-70,colH=bot-top,cy=(top+bot)/2;
  const cols=COLS.map((c,k)=>{
   const sp=k===6?Math.min(colH/5,74):Math.min(colH/(c.n+(k===4?3:0)),18),ys=[];
   for(let i=0;i<c.n;i++)ys.push(cy+(i-(c.n-1)/2)*sp+(k===4?(i>=64?1.5:-1.5)*sp:0));
   return {x:x0+k*gap,ys,sp,r:Math.max(1.2,Math.min(sp*.36,4.6))};
  });
  const bh=Math.min(colH*.56,170),box={x:1,y:cy-bh/2,w:w*(narrow?.17:.2),h:bh};
  G={w,h,dpr,narrow,x0,gap,top,bot,cy,cols,box,src:{x:box.x+box.w,y:cy},lit:{}};
  G.dim=edges(G,null);
  return G;
 }
 function edges(G,v){               // v null: every connection, faint. Otherwise only the active ones.
  const c=document.createElement('canvas');c.width=Math.round(G.w*G.dpr);c.height=Math.round(G.h*G.dpr);
  const g=c.getContext('2d');g.setTransform(G.dpr,0,0,G.dpr,0,0);
  const ALPHA=[.05,.1,.19,.32],bucket=wt=>wt<.22?-1:wt<.4?0:wt<.58?1:wt<.78?2:3;
  const paths=()=>[new Path2D(),new Path2D(),new Path2D(),new Path2D()];
  const flush=(ps,col)=>ps.forEach((p,b)=>{g.strokeStyle=col;g.globalAlpha=ALPHA[b];g.stroke(p);});
  const line=(p,ax,ay,bx,by)=>{p.moveTo(ax,ay);p.lineTo(bx,by);};
  if(!v){
   const p=new Path2D();G.cols[0].ys.forEach(y=>line(p,G.src.x,G.src.y,G.cols[0].x,y));
   for(let k=0;k<6;k++){const A=G.cols[k],B=G.cols[k+1];A.ys.forEach((ya,i)=>{if(k===3){if(i<64)line(p,A.x,ya,B.x,B.ys[i]);}else B.ys.forEach(yb=>line(p,A.x,ya,B.x,yb));});}
   g.lineWidth=.5;g.strokeStyle='rgba(255,255,255,.03)';g.stroke(p);return c;
  }
  g.lineWidth=.8;let ps=paths();
  G.cols[0].ys.forEach((y,j)=>{const b=bucket(v[0][j]);if(b>=0)line(ps[b],G.src.x,G.src.y,G.cols[0].x,y);});
  for(let k=0;k<5;k++){const A=G.cols[k],B=G.cols[k+1],va=v[k],vb=v[k+1];
   for(let i=0;i<va.length;i++){const a=Math.abs(va[i]);if(a<.2)continue;
    if(k===3){if(i<64){const b=bucket(a*a);if(b>=0)line(ps[b],A.x,A.ys[i],B.x,B.ys[i]);}continue;}   // pooling: channel i feeds feature i only
    for(let j=0;j<vb.length;j++){const b=bucket(a*Math.abs(vb[j]));if(b>=0)line(ps[b],A.x,A.ys[i],B.x,B.ys[j]);}}}
  flush(ps,'rgb(170,226,234)');
  const A=G.cols[5],B=G.cols[6];
  for(let j=0;j<5;j++){ps=paths();for(let i=0;i<32;i++){const b=bucket(Math.abs(v[5][i])*Math.sqrt(v[6][j]));if(b>=0)line(ps[b],A.x,A.ys[i],B.x,B.ys[j]);}flush(ps,SCOL[j]);}
  return c;
 }
 function lit(G,e,before){
  const key=e+(before?'b':'');
  if(!G.lit[key]){const keep=new Set([key,e+'',e+'b']);for(const q of Object.keys(G.lit))if(!keep.has(q))delete G.lit[q];G.lit[key]=edges(G,vals(e,before));}
  return G.lit[key];
 }
 function clock(i){const s=(D.meta.start+i)*30,h=Math.floor(s/3600),m=Math.floor(s%3600/60);return `${h}:${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

 let shown=-1;
 function setResult(e){
  if(e===shown)return;shown=e;const q=PRED[e],ok=q===TRUE[e];
  $('flow-stage').textContent=CODES[q];$('flow-stage').style.color=SCOL[q];$('flow-name').textContent=NAMES[q];
  $('flow-meta').textContent=`${Math.round(D.p[e][q]*100)}% confident / ${ok?'matches the human scorer':'human scorer said '+CODES[TRUE[e]]}`;
  $('flow-meta').dataset.match=ok?'yes':'no';
 }

 let k=0,t=reduced?1:0,width=0,height=0;
 function draw(){
  const w=cv.clientWidth,h=cv.clientHeight;if(w<120||h<120)return;
  const dpr=Math.min(devicePixelRatio||1,2);if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
  const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);width=w;height=h;
  const F=geom(w,h),cur=vals(k,false),prev=vals(k,true),small=F.gap<62,tiny=F.gap<44,pk=wrap(k-1);
  const sweep=seg(t,0,.28),hold=1-.65*seg(t,0,.2),head=ease(seg(t,.80,.92));
  const p=-.8+6.3*seg(t,.28,.80)+.5*seg(t,.80,.88),waveX=F.x0+p*F.gap;

  g.drawImage(F.dim,0,0,w,h);
  g.save();g.beginPath();g.rect(waveX,0,w,F.bot+10);g.clip();g.globalAlpha=.5*hold;g.drawImage(lit(F,k,true),0,0,w,h);g.restore();
  g.save();g.beginPath();g.rect(0,0,Math.max(0,waveX),F.bot+10);g.clip();g.drawImage(lit(F,k,false),0,0,w,h);g.restore();
  if(t>.28&&t<.88){
   const gr=g.createLinearGradient(waveX-46,0,waveX,0);gr.addColorStop(0,'rgba(233,247,250,0)');gr.addColorStop(1,'rgba(233,247,250,.09)');
   g.fillStyle=gr;g.fillRect(waveX-46,F.top-8,46,F.bot-F.top+16);g.fillStyle='rgba(233,247,250,.4)';g.fillRect(waveX-.5,F.top-8,1,F.bot-F.top+16);
  }

  /* raw input epoch */
  const B=F.box,lane=B.h/2;
  g.fillStyle='rgba(255,255,255,.03)';g.fillRect(B.x,B.y,B.w,B.h);g.strokeStyle='rgba(255,255,255,.16)';g.lineWidth=1;g.strokeRect(B.x-.5,B.y-.5,B.w,B.h);
  g.save();g.beginPath();g.rect(B.x,B.y,B.w,B.h);g.clip();
  const n=Math.floor(sweep*3000);
  [EEG,EOG].forEach((col,c)=>{
   const base=(k*2+c)*3000,mid=B.y+lane*(c+.5),amp=lane*.44/127;g.strokeStyle=col;g.lineWidth=.8;g.lineJoin='round';
   g.globalAlpha=.16;g.beginPath();for(let i=0;i<3000;i+=2){const x=B.x+i/2999*B.w,y=mid-X[base+i]*amp;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
   g.globalAlpha=1;g.beginPath();for(let i=0;i<n;i++){const x=B.x+i/2999*B.w,y=mid-X[base+i]*amp;i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
  });
  if(sweep>0&&sweep<1){g.fillStyle=INK;g.fillRect(B.x+sweep*B.w-.5,B.y,1,B.h);}
  g.restore();
  g.textBaseline='alphabetic';g.textAlign='left';
  g.font=`600 ${small?8:9}px ${FONT}`;g.fillStyle=sweep<1?INK:INK2;g.fillText(small?'INPUT':'RAW INPUT',B.x,14);
  g.font=`${small?8:9}px ${FONT}`;g.fillStyle=INK3;g.fillText(tiny?'SIZE':'OUTPUT SIZE',B.x,28);g.fillText(tiny?'PARAMS':'PARAMETERS',B.x,41);g.fillText('2 × 3000',B.x,B.y-(small?8:21));
  g.fillStyle=EEG;g.fillText('EEG',B.x+5,B.y+12);g.fillStyle=EOG;g.fillText(small?'EOG':'EYE',B.x+5,B.y+lane+12);
  g.fillStyle=INK3;g.fillText('0 s',B.x,B.y+B.h+13);g.textAlign='right';g.fillText('30 s',B.x+B.w,B.y+B.h+13);
  if(!small){g.textAlign='left';g.fillText('100 Hz / z-scored',B.x,B.y-8);}

  /* hidden layers */
  for(let c=0;c<6;c++){
   const C=F.cols[c],rv=ease(clamp((p-(c-.5))/.5)),on=p>c-.5&&p<c+.5;
   for(let i=0;i<C.ys.length;i++){
    const val=c===5?mix(prev[c][i],cur[c][i],rv):mix(prev[c][i]*hold,cur[c][i],rv);
    g.beginPath();g.arc(C.x,C.ys[i],C.r,0,6.2832);
    if(c===5)g.fillStyle=diverge(val);
    else if(c===4&&i>64){g.fillStyle='#152026';g.fill();g.globalAlpha=.25+.75*val;g.fillStyle=SCOL[i-65];}
    else g.fillStyle=rampCss(30+val*225);
    g.fill();g.globalAlpha=1;
   }
   g.textAlign='center';g.font=`600 ${small?8:9}px ${FONT}`;g.fillStyle=on?INK:INK2;g.fillText(small?COLS[c].short:COLS[c].name,C.x,14);
   g.font=`${tiny?7:small?8:9}px ${FONT}`;g.fillStyle=INK2;g.fillText(tiny?String(COLS[c].n===70?'64+6':COLS[c].n):COLS[c].sub,C.x,28);g.fillStyle=INK3;g.fillText(COLS[c].par,C.x,41);
  }
  /* night context caption and the LSTM's carried state */
  const Fe=F.cols[4],L=F.cols[5],ly=L.ys[31]+L.r+15;
  g.font=`8px ${FONT}`;g.fillStyle=INK3;g.textAlign='center';
  if(!small)g.fillText('night context',Fe.x,Fe.ys[69]+Fe.r+12);
  g.strokeStyle=INK3;g.lineWidth=1;g.beginPath();g.arc(L.x,ly,6,-1.1,3.9);g.stroke();
  g.beginPath();g.moveTo(L.x+1,ly-9);g.lineTo(L.x+5,ly-5.5);g.lineTo(L.x+.5,ly-3);g.stroke();
  if(!small&&ly+19<F.bot+12)g.fillText('state carries over',L.x,ly+19);

  /* output: one node per stage */
  const O=F.cols[6],decided=seg(t,.80,.92)>.35,win=decided?PRED[k]:PRED[pk],rmax=Math.min(O.sp*.4,small?11:19);
  for(let j=0;j<5;j++){
   const pv=mix(prev[6][j],cur[6][j],head),r=3+(rmax-3)*Math.sqrt(pv),y=O.ys[j];
   g.beginPath();g.arc(O.x,y,rmax,0,6.2832);g.strokeStyle=SCOL[j];g.globalAlpha=.25;g.lineWidth=1;g.stroke();
   g.globalAlpha=.2+.8*pv;g.fillStyle=SCOL[j];if(j===win){g.shadowColor=SCOL[j];g.shadowBlur=18;}
   g.beginPath();g.arc(O.x,y,r,0,6.2832);g.fill();g.shadowBlur=0;g.globalAlpha=1;
   g.textAlign='left';g.textBaseline='middle';
   g.font=`600 ${small?9:12}px ${FONT}`;g.fillStyle=j===win?SCOL[j]:INK2;g.fillText(CODES[j],O.x+rmax+7,y-(small?5:6));
   g.font=`${small?8:10}px ${FONT}`;g.fillStyle=j===win?INK:INK3;g.fillText(Math.round(pv*100)+'%',O.x+rmax+7,y+(small?6:8));
   g.textBaseline='alphabetic';
  }
  g.textAlign='center';g.font=`600 ${small?8:9}px ${FONT}`;g.fillStyle=head>0&&head<1?INK:INK2;g.fillText(small?COLS[6].short:COLS[6].name,O.x,14);
  g.font=`${tiny?7:small?8:9}px ${FONT}`;g.fillStyle=INK2;g.fillText(COLS[6].sub,O.x,28);g.fillStyle=INK3;g.fillText(COLS[6].par,O.x,41);

  /* the hour this epoch comes from: human scorer above, model below */
  const sx=small?44:58,sw=w-sx,cw=sw/HOUR,sy=h-30,rh=8;
  g.font=`8px ${FONT}`;g.textAlign='left';g.textBaseline='middle';g.fillStyle=INK3;g.fillText('SCORER',0,sy+rh/2);g.fillText('MODEL',0,sy+rh*1.5+2);
  for(let i=0;i<HOUR;i++){const x=sx+i*cw,bw=Math.max(.6,cw-.6);g.globalAlpha=.55;g.fillStyle=SDIM[D.hourTrue[i]];g.fillRect(x,sy,bw,rh);g.fillStyle=SDIM[D.hourPred[i]];g.fillRect(x,sy+rh+2,bw,rh);}
  g.globalAlpha=1;const jump=ease(seg(t,0,.1)),px=sx+mix(PLAY[pk],PLAY[k],jump)*cw;
  g.strokeStyle=INK;g.lineWidth=1.2;g.strokeRect(px-1,sy-2,cw+2,rh*2+6);
  g.textBaseline='alphabetic';g.fillStyle=INK3;g.textAlign='right';g.fillText(`${clock(PLAY[k])} INTO THE NIGHT`,w,sy-8);
  g.textAlign='left';g.fillText(small?'ONE HOUR':'ONE HOUR OF THE NIGHT',sx,sy-8);

  setResult(decided?k:pk);
 }

 const DUR=5000;let last=performance.now(),visible=true;
 function advance(d){t+=d;while(t>=1){t-=1;k=wrap(k+1);}}
 function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(100,now-last);if(dt<16)return;last=now;if(document.hidden||!visible)return;
  if(!reduced)advance(dt/DUR);
  draw();
 }
 new ResizeObserver(draw).observe(cv);
 if('IntersectionObserver' in window)new IntersectionObserver(en=>{visible=en[0].isIntersecting;}).observe(card);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
 draw();requestAnimationFrame(frame);
})();
