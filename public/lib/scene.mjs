import { ease } from './interaction.mjs';
import {appURL} from './paths.mjs';
const loadImage=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(`이미지 읽기 실패: ${src}`));im.src=src;});
function parchment(){
 const c=document.createElement('canvas');c.width=300;c.height=110;const x=c.getContext('2d');
 x.fillStyle='#cebd96';x.fillRect(0,0,c.width,c.height);let seed=9173;
 for(let i=0;i<2500;i++){seed=(seed*16807)%2147483647;const px=seed%300;seed=(seed*16807)%2147483647;const py=seed%110;x.fillStyle=i%2?'#c2af8529':'#f0e2bd22';x.fillRect(px,py,1+(i%4),1);}
 const g=x.createLinearGradient(0,0,0,110);g.addColorStop(0,'#58472766');g.addColorStop(.3,'#fff0');g.addColorStop(1,'#4e402533');x.fillStyle=g;x.fillRect(0,0,300,110);return c;
}
export class Scene {
 constructor(container,onError){this.container=container;this.onError=onError;this.actors={};this.ready=false;this.lastState='IDLE';this.generation=0;this.artStatus='layer-preview';}
 async init(){
  const response=await fetch(appURL('assets/characters/manifest.json'));if(!response.ok)throw Error('캐릭터 목록이 없습니다. npm run assets를 실행하세요.');
  this.manifest=await response.json();
  for(const [name,spec] of Object.entries(this.manifest.actors)){
   spec.body=appURL(spec.body);if(spec.revealVideo)spec.revealVideo=appURL(spec.revealVideo);
   await loadImage(spec.body);
   const el=document.createElement('div');el.className='actor';el.dataset.actor=name;
   const body=document.createElement('img');body.className='actor-body';body.src=spec.body;body.alt='';
   const head=document.createElement('img');head.className='actor-head';head.src=spec.body;head.alt='';
   const cover=document.createElement('div');cover.className='cover';cover.append(parchment());
   const clip=document.createElement('video');clip.className='actor-clip';clip.muted=true;clip.playsInline=true;clip.preload='auto';
   el.append(body,head,cover,clip);this.container.append(el);
   this.actors[name]={el,body,head,cover,clip,spec,clipReady:false,clipStarted:false,clipFailed:false};
   if(spec.revealVideo)await this.setClip(name,spec.revealVideo);
  }
  this.ready=true;
 }
 async setImage(name,url){const im=await loadImage(url),a=this.actors[name];a.body.src=url;a.head.src=url;a.spec.width=im.naturalWidth;a.spec.height=im.naturalHeight;}
 async setClip(name,url){
  const a=this.actors[name];if(!a)return;
  a.clipReady=false;a.clipStarted=false;a.clipFailed=false;a.clip.src=url;a.clip.load();
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('영상 준비 시간 초과')),15000);a.clip.onloadeddata=()=>{clearTimeout(timeout);a.clipReady=true;resolve();};a.clip.onerror=()=>{clearTimeout(timeout);reject(Error('영상 코덱 또는 파일을 확인하세요.'));};});
 }
 render(now,visual,config,state){
  if(!this.ready)return;
  const height=this.container.clientHeight;
  if(state==='GHOST_REVEAL'&&this.lastState!=='GHOST_REVEAL')this.revealAt=now;
  for(const [name,a] of Object.entries(this.actors)){
   const p=config.actors[name],h=height*p.height,w=h*a.spec.width/a.spec.height;
   const side=name==='songaksi'?-1:1,phase=name==='songaksi'?0:1.7;
   const breathing=Math.sin(now*.0011+phase)*.7;
   const shiftX=side*(1-visual.enter)*w*.12,shiftY=-(1-visual.enter)*h*.035;
   const scale=.96+.04*visual.enter;
   a.el.style.width=`${w}px`;a.el.style.height=`${h}px`;a.el.style.left=`calc(${p.x*100}% - ${w/2}px)`;a.el.style.top=`calc(${p.y*100}% - ${h}px)`;
   a.el.style.transform=`translate3d(${shiftX}px,${shiftY+breathing}px,0) scale(${scale})`;
   a.el.style.opacity=String(visual.opacity);
   const reveal=name==='songaksi'?visual.bride:visual.groom;
   const cover=a.spec.cover;
   a.cover.style.top=`${cover.top*100}%`;a.cover.style.height=`${cover.height*100}%`;a.cover.style.width=`${cover.width*100}%`;a.cover.style.left=`${(1-cover.width)*50}%`;
   a.cover.style.transform=`translate3d(0,${h*cover.drop*reveal}px,0) rotate(${side*.6*Math.sin(reveal*Math.PI)}deg)`;
   const tilt=(name==='songaksi'?-1.5*visual.watch:2.2*visual.watch);
   a.head.style.transform=`rotate(${tilt}deg) translateY(${name==='songaksi'?-visual.watch:0}px)`;
   if(state==='RESET' || (!visual.opacity && ['IDLE','APPROACH'].includes(state))){
    if(a.clipStarted){a.clip.pause();a.clip.currentTime=0;a.clipStarted=false;a.el.classList.remove('video-active');}
   }
   if(a.clipReady&&!a.clipFailed&&!a.clipStarted&&state==='GHOST_REVEAL'&&(name==='songaksi'||(now-this.revealAt)/1000>=config.timing.offset)){
    const rate=a.clip.duration/config.timing.reveal;
    if(!Number.isFinite(rate)||rate<.25||rate>4){a.clipFailed=true;this.onError('영상 길이와 가리개 시간이 맞지 않습니다. 재생 속도 0.25~4배 범위로 시간을 조정하세요.');continue;}
    a.clip.playbackRate=rate;
    a.clipStarted=true;
    a.clip.play().then(()=>a.el.classList.add('video-active')).catch(e=>{a.clipFailed=true;this.onError(`가리개 영상 재생 실패: ${e.message}`);});
    a.clip.onended=()=>a.clip.pause();
    a.clip.onerror=()=>{a.clipFailed=true;this.onError('가리개 영상 디코딩 오류. 현재 연출을 종료합니다.');};
   }
  }
  this.lastState=state;
 }
}
