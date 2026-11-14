import {ease} from './interaction.mjs';
import {appURL} from './paths.mjs';
const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('귀신 시작 이미지를 읽지 못했습니다.'));im.src=src;});
const usable=v=>v.readyState>=2&&!v.seeking;
const finished=v=>v.ended||(v.duration>0&&v.currentTime>=v.duration-.04);
export class Scene{
 constructor(container,onError){this.container=container;this.onError=onError;this.actors={};this.ready=false;this.lastState='INIT';this.generation=0;this.events=[];this.artStatus='walking-reveal-film-v2';this.failed=false;}
 event(type,extra={}){this.events.push({type,at:performance.now(),...extra});if(this.events.length>600)this.events.splice(0,100);}
 async load(v,url){
  v.src=url;v.load();
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('귀신 영상 준비가 지연됩니다. 로컬 파일을 확인하세요.')),20000);const finish=fn=>{clearTimeout(timeout);v.removeEventListener('loadeddata',loaded);v.removeEventListener('error',bad);fn();};const loaded=()=>finish(resolve),bad=()=>finish(()=>reject(Error('귀신 WebM 파일을 읽지 못했습니다.')));v.addEventListener('loadeddata',loaded);v.addEventListener('error',bad);if(v.readyState>=2)loaded();});
  if(!Number.isFinite(v.duration)||v.duration<1||v.videoWidth!==576||v.videoHeight!==1024)throw Error('귀신 영상의 길이/크기가 승인 에셋과 다릅니다.');
  // 두 영상 모두 실제 첫 프레임을 한 번 그려 디코딩 준비를 확인한다.
  const c=document.createElement('canvas');c.width=c.height=2;c.getContext('2d').drawImage(v,0,0,2,2);
  v.addEventListener('error',()=>this.fail('귀신 영상 디코딩 오류가 발생했습니다.'));
 }
 async init(){
  const r=await fetch(appURL('assets/film/manifest.json'));if(!r.ok)throw Error('걷기 전시 에셋 목록이 없습니다.');this.manifest=await r.json();
  for(const [name,spec] of Object.entries(this.manifest.actors)){
   for(const key of ['walk','reveal','poster'])spec[key]=appURL(spec[key]);
   await image(spec.poster);const el=document.createElement('div');el.className='actor film-actor';el.dataset.actor=name;
   const poster=document.createElement('img');poster.className='film-poster';poster.src=spec.poster;poster.alt='';
   const create=kind=>{const v=document.createElement('video');v.className='film-video';v.dataset.kind=kind;v.muted=true;v.playsInline=true;v.preload='auto';v.disablePictureInPicture=true;v.setAttribute('aria-hidden','true');return v;};
   const walk=create('walk'),reveal=create('reveal');el.append(poster,walk,reveal);this.container.append(el);
   const a={el,poster,walk,reveal,spec,active:'poster',walkStarted:false,revealStarted:false,lastProgress:performance.now(),lastTime:0};this.actors[name]=a;
   await this.load(walk,spec.walk);await this.load(reveal,spec.reveal);
  }
  // 실제 alpha-video 합성 경로까지 낮은 불투명도로 미리 그린다.
  // canvas 썸네일 준비만으로는 첫 표시 때의 영상 합성이 준비되지 않았다.
  for(const a of Object.values(this.actors))await this.warm(a);
  this.rearm();this.beginMeasurement();this.ready=true;this.event('ready');
 }
 async warm(a){
  a.el.style.cssText='position:absolute;left:0;top:0;width:288px;height:512px;opacity:0.001';a.poster.style.visibility='hidden';
  for(const v of [a.walk,a.reveal]){
   v.style.opacity='1';
   try{await v.play();await new Promise(resolve=>{let count=0;const timeout=setTimeout(resolve,1200);const frame=()=>{if(++count>=2){clearTimeout(timeout);resolve();}else v.requestVideoFrameCallback(frame);};if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(frame);else requestAnimationFrame(()=>requestAnimationFrame(resolve));});v.pause();if(v.currentTime!==0){await new Promise(resolve=>{const timeout=setTimeout(resolve,2000);v.addEventListener('seeked',()=>{clearTimeout(timeout);resolve();},{once:true});v.currentTime=0;});}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
   catch(e){this.event('warm-skipped',{message:e.message});v.pause();}v.style.opacity='0';
  }
  a.el.style.opacity='0';a.poster.style.visibility='visible';
 }
 beginMeasurement(){for(const a of Object.values(this.actors))for(const v of [a.walk,a.reveal]){const q=v.getVideoPlaybackQuality?.();v.measurementBaseline=q?{total:q.totalVideoFrames,dropped:q.droppedVideoFrames}:{total:0,dropped:0};}}
 fail(message){if(this.failed)return;this.failed=true;this.event('error',{message});this.onError(message);}
 activate(a,kind){a.active=kind;a.lastTime=a[kind].currentTime;a.lastProgress=performance.now();a.poster.style.visibility='hidden';a.walk.style.opacity=kind==='walk'?'1':'0';a.reveal.style.opacity=kind==='reveal'?'1':'0';}
 begin(a,kind,rate,name){
  const v=a[kind],key=kind+'Started';if(a[key]||!usable(v)||this.failed)return;
  a[key]=true;v.playbackRate=Math.max(.75,Math.min(1.25,rate));const generation=this.generation;
  a.lastProgress=performance.now();a.lastTime=v.currentTime;
  this.event('play-request',{actor:name,kind,rate:v.playbackRate});
  const visible=()=>{if(generation!==this.generation||!a[key])return;this.activate(a,kind);this.event('first-frame',{actor:name,kind,mediaTime:v.currentTime});};
  v.play().then(()=>{if(generation!==this.generation){v.pause();return;}if(v.requestVideoFrameCallback)v.requestVideoFrameCallback(visible);else visible();}).catch(e=>{if(generation===this.generation)this.fail('귀신 영상 재생을 시작하지 못했습니다: '+e.message);});
 }
 rearm(){
  this.generation++;for(const a of Object.values(this.actors)){a.el.style.opacity='0';for(const v of [a.walk,a.reveal]){v.pause();if(v.currentTime!==0)v.currentTime=0;v.playbackRate=1;}a.walkStarted=a.revealStarted=false;a.active='poster';a.poster.style.visibility='visible';a.walk.style.opacity=a.reveal.style.opacity='0';}this.failed=false;this.event('hidden-reset');
 }
 gate(){return {walkComplete:this.ready&&Object.values(this.actors).every(a=>a.walkStarted&&finished(a.walk)),revealComplete:this.ready&&Object.values(this.actors).every(a=>a.revealStarted&&finished(a.reveal))};}
 render(now,visual,config,state){
  if(!this.ready)return;
  const changed=state!==this.lastState;
  if(changed){this.event('phase',{state});if(state==='RESET'||(state==='IDLE'&&this.lastState==='INIT'))this.rearm();if(state==='GHOST_ENTER')this.enterAt=now;}
  const height=this.container.clientHeight;
  for(const [name,a] of Object.entries(this.actors)){
   const p=config.actors[name],h=height*p.height,w=h*576/1024;
   a.el.style.width=w+'px';a.el.style.height=h+'px';a.el.style.left=`calc(${p.x*100}% - ${w/2}px)`;a.el.style.top=`calc(${p.y*100}% - ${h}px)`;
   a.el.style.transform='none';a.el.style.opacity=String(visual.opacity);
   if(state==='GHOST_ENTER')this.begin(a,'walk',Math.max(...Object.values(this.actors).map(x=>x.walk.duration))/config.timing.enter,name);
   if(state==='GHOST_REVEAL'&&(name==='songaksi'||this.actors.songaksi.reveal.currentTime>=config.timing.offset))this.begin(a,'reveal',a.reveal.duration/config.timing.reveal,name);
   if(['GHOST_ENTER','GHOST_REVEAL','EXIT'].includes(state)){
    const v=a[a.active];if(v instanceof HTMLVideoElement&&!v.paused&&!v.ended){if(v.currentTime>a.lastTime+.002){a.lastTime=v.currentTime;a.lastProgress=now;}else if(now-a.lastProgress>3500)this.fail('귀신 영상 프레임이 멈췄습니다. 연출을 종료합니다.');}
   }
  }
  this.lastState=state;
 }
 async setClip(name,url){const a=this.actors[name];if(!a)return;this.rearm();await this.load(a.reveal,url);this.event('temporary-reveal',{actor:name});}
 async setImage(name,url){await image(url);const a=this.actors[name];if(a)a.poster.src=url;}
 snapshot(){const clip=v=>{const q=v.getVideoPlaybackQuality?.(),b=v.measurementBaseline||{total:0,dropped:0};return{time:v.currentTime,duration:v.duration,quality:q?{totalFrames:q.totalVideoFrames-b.total,droppedFrames:q.droppedVideoFrames-b.dropped,baseline:b}:null};};return {artStatus:this.artStatus,ready:this.ready,failed:this.failed,actors:Object.fromEntries(Object.entries(this.actors).map(([name,a])=>[name,{active:a.active,walk:clip(a.walk),reveal:clip(a.reveal)}])),events:this.events};}
}
