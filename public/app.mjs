import {defaults,loadConfig,saveConfig,sanitize} from './lib/config.mjs';
import {Camera} from './lib/camera.mjs';
import {Vision} from './lib/vision.mjs';
import {SeatDetector,reasons} from './lib/seat.mjs';
import {Interaction,phaseNames} from './lib/interaction.mjs';
import {Scene} from './lib/scene-film.mjs';
import {Metrics} from './lib/metrics.mjs';
const $=id=>document.getElementById(id);
let config=loadConfig(),seat=new SeatDetector(config),lastSeat=seat.lastResult,lastPose=null,lastAI=0,aiState='off',aiError='',cameraInfo=null,editing=false,dragStart=null,adminOpen=false,baselineBusy=false,noticeTimer=null,lastDebug=0;
const metrics=new Metrics();
const interaction=new Interaction(config,event=>metrics.event(event));
const scene=new Scene($('actors'),message=>{notify(message,true);interaction.exit(performance.now(),'art-error');});
const video=$('camera');
const camera=new Camera(video,async status=>{
 const labels={off:'카메라 꺼짐',requesting:'카메라 권한 요청 중',connecting:'입력 프레임 대기',live:'카메라 연결됨',stalled:'카메라 프레임 멈춤',ended:'카메라 연결 종료',error:'카메라 연결 오류'};
 $('cameraStatus').textContent=labels[status.state]||status.state;$('cameraStatus').classList.toggle('live',status.state==='live');
 if(status.state==='live'){
  cameraInfo=status;
  if(config.roi.configured&&config.calibrationDeviceId&&status.settings.deviceId!==config.calibrationDeviceId){config.roi.configured=false;config.detection.baseline=null;config=saveConfig(config);seat.configure(config);notify('카메라가 바뀌었습니다. 의자 영역을 다시 지정하세요.',true);}
  $('startCard').hidden=true;
  $('actualCamera').textContent=`실제 입력: ${status.settings.width} × ${status.settings.height}, 장치 보고 ${Number(status.settings.frameRate||0).toFixed(1)} FPS · ${status.label}`;
  await refreshDevices();
  if(!config.roi.configured)openSettings();
 }
 if(status.message){$('startupMessage').textContent=status.message;notify(status.message,true);}
 if(['error','ended'].includes(status.state)){$('startCard').hidden=false;vision.stop();aiState='off';seat.reset();}
});
const vision=new Vision(video,event=>{
 if(event.type==='loading'){aiState='loading';aiError='';lastAI=0;}
 if(event.type==='ready'){aiState='ready';metrics.event({type:'ai-ready',at:performance.now(),delegate:event.delegate});}
 if(event.type==='error'){aiState='error';aiError=event.message;lastAI=0;notify(`AI 준비 실패: ${event.message}`,true);}
 if(event.type==='frame-error'){aiError=event.message;metrics.event({type:'ai-frame-error',at:performance.now(),message:event.message});}
 if(event.type==='result'){
  lastPose=event;lastAI=performance.now();metrics.inference(event.inferenceMs,event.sourceMs);
  lastSeat=seat.evaluate({...event,now:lastAI});
 }
});
const overlay=$('overlay'),ctx=overlay.getContext('2d');
function notify(message,sticky=false){clearTimeout(noticeTimer);$('notice').textContent=message;$('notice').hidden=false;if(!sticky)noticeTimer=setTimeout(()=>$('notice').hidden=true,5000);}
function exportJSON(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function refreshDevices(){
 try{const devices=await camera.devices(),select=$('deviceSelect'),chosen=config.camera.deviceId;select.replaceChildren(new Option('기본 카메라',''));devices.forEach((d,i)=>select.append(new Option(d.label||`카메라 ${i+1}`,d.deviceId)));select.value=chosen;}catch(e){notify(`카메라 목록: ${e.message}`);}
}
async function startCamera(){
 $('startCamera').disabled=true;$('startupMessage').textContent='Chrome의 카메라 권한을 확인해 주세요.';
 try{vision.stop();seat.reset();lastSeat=seat.lastResult;lastPose=null;await camera.start(config.camera);if(camera.stream)vision.start(config);}
 catch{}finally{$('startCamera').disabled=false;}
}
function openSettings(){adminOpen=true;$('admin').hidden=false;fillForm();if(['GHOST_ENTER','GHOST_HOLD','GHOST_REVEAL','GHOST_WATCH'].includes(interaction.state))interaction.exit(performance.now(),'settings-open');}
function closeSettings(){adminOpen=false;$('admin').hidden=true;editing=false;document.body.classList.remove('drawing');$('drawingHint').hidden=true;}
function fillForm(){
 const form=$('settingsForm');
 for(const el of form.elements){if(!el.name)continue;const [a,b]=el.name.split('.');let value=b?config[a]?.[b]:undefined;if(value===undefined)continue;if(el.type==='checkbox')el.checked=value;else el.value=String(value);}
 form.elements.holdSeconds.value=config.detection.holdMs/1000;form.elements.leaveSeconds.value=config.detection.leaveMs/1000;
 for(const name of ['songaksi','mongdal'])for(const [s,k] of [['X','x'],['Y','y'],['Height','height']])form.elements[name+s].value=(config.actors[name][k]*100).toFixed(0);
 $('resolution').value=`${config.camera.width}x${config.camera.height}`;
 $('roiText').textContent=config.roi.configured?`설정됨 · 가로 ${(config.roi.x*100).toFixed(0)}% / 세로 ${(config.roi.y*100).toFixed(0)}% / 폭 ${(config.roi.w*100).toFixed(0)}% / 높이 ${(config.roi.h*100).toFixed(0)}%`:'의자 영역 미설정';
 $('baselineText').textContent=config.detection.baseline?`착석 기준 저장됨 · 엉덩이 높이 ${(config.detection.baseline.hipY*100).toFixed(1)}%`:'착석 기준 미저장. 기본은 다리 굽힘을 함께 확인합니다.';
}
function readForm(){
 const next=structuredClone(config),form=$('settingsForm');
 for(const el of form.elements){if(!el.name?.includes('.'))continue;const [a,b]=el.name.split('.');next[a][b]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'&&a==='camera'?el.value:Number(el.value);}
 next.detection.holdMs=Number(form.elements.holdSeconds.value)*1000;next.detection.leaveMs=Number(form.elements.leaveSeconds.value)*1000;
 const [width,height]=$('resolution').value.split('x').map(Number);next.camera.width=width;next.camera.height=height;
 for(const name of ['songaksi','mongdal'])for(const [s,k] of [['X','x'],['Y','y'],['Height','height']])next.actors[name][k]=Number(form.elements[name+s].value)/100;
 if(next.camera.deviceId!==config.camera.deviceId||Math.abs(next.camera.width/next.camera.height-config.camera.width/config.camera.height)>.01){next.roi.configured=false;next.detection.baseline=null;next.calibrationDeviceId='';}
 return sanitize(next);
}
function applyConfig(next,{restartVision=true}={}){
 const wasWaiting=['IDLE','APPROACH','RESET'].includes(interaction.state);
 config=saveConfig(next);seat.configure(config);lastSeat=seat.lastResult;interaction.config=config;interaction.reset(performance.now());
 if(wasWaiting)interaction.latched=false;
 if(restartVision&&camera.stream)vision.start(config);fillForm();
}
function videoRect(){
 const w=$('stage').clientWidth,h=$('stage').clientHeight,vw=video.videoWidth||16,vh=video.videoHeight||9,scale=Math.min(w/vw,h/vh);
 return {x:(w-vw*scale)/2,y:(h-vh*scale)/2,w:vw*scale,h:vh*scale};
}
const clamp=x=>Math.max(0,Math.min(1,x));
function normalized(e){const rect=videoRect(),b=overlay.getBoundingClientRect();return{x:clamp((e.clientX-b.left-rect.x)/rect.w),y:clamp((e.clientY-b.top-rect.y)/rect.h)};}
function drawOverlay(now){
 const stage=$('stage'),dpr=Math.min(devicePixelRatio||1,2),w=stage.clientWidth,h=stage.clientHeight;
 if(overlay.width!==Math.round(w*dpr)||overlay.height!==Math.round(h*dpr)){overlay.width=Math.round(w*dpr);overlay.height=Math.round(h*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!editing&&!adminOpen&&!config.debug)return;
 const rect=videoRect(),r=config.roi;
 ctx.strokeStyle=lastSeat.seated?'#d9c78e':'#8abe9f';ctx.fillStyle='#89bc9920';ctx.lineWidth=2;ctx.setLineDash(editing?[7,5]:[]);
 ctx.fillRect(rect.x+r.x*rect.w,rect.y+r.y*rect.h,r.w*rect.w,r.h*rect.h);ctx.strokeRect(rect.x+r.x*rect.w,rect.y+r.y*rect.h,r.w*rect.w,r.h*rect.h);ctx.setLineDash([]);
 ctx.fillStyle='#d7ead9';ctx.font='13px sans-serif';ctx.fillText(r.configured?'의자 영역':'의자 영역 지정 필요',rect.x+r.x*rect.w+7,rect.y+r.y*rect.h+20);
 if(lastPose&&now-lastPose.sourceMs<config.detection.staleMs){
  const p=lastPose.landmarks;const point=i=>({x:rect.x+(1-p[i].x)*rect.w,y:rect.y+p[i].y*rect.h});
  ctx.strokeStyle='#d9d0a9';ctx.lineWidth=2;
  for(const [a,b] of [[11,12],[11,23],[12,24],[23,24],[23,25],[24,26],[25,27],[26,28]])if(p[a]?.visibility>.3&&p[b]?.visibility>.3){const u=point(a),v=point(b);ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.stroke();}
  for(const i of [11,12,23,24,25,26,27,28])if(p[i]?.visibility>.3){const a=point(i);ctx.beginPath();ctx.arc(a.x,a.y,4,0,Math.PI*2);ctx.fill();}
 }
}
function debug(now,live,fresh){
 const m=metrics.snapshot(),r=lastSeat;
 const values={카메라:live?'실제 프레임 수신':camera.state,AI:aiState==='ready'?(fresh?'분석 수신':'분석 지연/대기'):aiState,관객:fresh&&r.present?'감지됨':'미감지/보류',착석:fresh&&r.seated?'감지됨':'확인 중',연출:phaseNames[interaction.state],입력출처:interaction.manual?'비상 수동':'실제 카메라 자동',화면FPS:m.render.fps.toFixed(1),화면p99:`${m.render.p99Ms.toFixed(1)} ms`,최대프레임:`${m.render.maxMs.toFixed(1)} ms`,AI평균:`${m.inference.meanMs.toFixed(1)} ms`,AI결과나이:lastPose?`${Math.round(now-lastPose.sourceMs)} ms`:'없음',밝기:lastPose?`${Math.round(lastPose.brightness)} / 255`:'없음',무릎각도:r.kneeAngles?.map(x=>x.toFixed(0)).join(' / ')||'미확인',프레임수:camera.frameCount};
 const dl=$('debugValues');dl.replaceChildren();for(const [name,value] of Object.entries(values)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=String(value);dl.append(dt,dd);}
 $('seatProgress').value=fresh?r.progress:0;$('seatReason').textContent=aiError||(lastPose?.brightness<25?'화면이 매우 어둡습니다. 관객 앞쪽 조명이 필요합니다. · ':'')+(reasons[fresh?r.reason:'stale']||r.reason);
}
async function captureBaseline(){
 if(baselineBusy||!camera.stream||!vision.ready){notify('카메라와 AI가 연결된 뒤 앉은 상태에서 저장하세요.');return;}
 baselineBusy=true;$('captureBaseline').disabled=true;const samples=[],started=performance.now();let seq=-1;
 notify('현재 앉은 자세를 2초 동안 측정합니다.');
 const timer=setInterval(()=>{
  if(lastPose&&lastPose.seq!==seq&&performance.now()-lastPose.sourceMs<config.detection.staleMs&&lastSeat.signature){samples.push(lastSeat.signature);seq=lastPose.seq;}
  if(performance.now()-started<2100)return;
  clearInterval(timer);baselineBusy=false;$('captureBaseline').disabled=false;
  const ys=samples.map(s=>s.hipY);
  if(samples.length<8||Math.max(...ys)-Math.min(...ys)>.06){notify('엉덩이·어깨가 안정적으로 보이지 않아 저장하지 않았습니다.',true);return;}
  config.detection.baseline={};for(const k of ['hipY','torso','shoulderY'])config.detection.baseline[k]=samples.reduce((s,x)=>s+x[k],0)/samples.length;
  config.calibrationDeviceId=cameraInfo?.settings.deviceId||'';applyConfig(config,{restartVision:false});notify('착석 기준을 저장했습니다. 실제 일어섬과 착석을 반복해 기준을 확인하세요.');
 },80);
}
function manual(){if(!scene.ready){notify('캐릭터 에셋이 아직 준비되지 않았습니다.');return;}closeSettings();$('startCard').hidden=true;interaction.preview(performance.now());metrics.event({type:'manual-preview',at:performance.now(),cameraLive:camera.state==='live'});}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();}catch(e){notify(`전체화면 전환: ${e.message}`);}}

$('startCamera').onclick=startCamera;$('settingsButton').onclick=()=>adminOpen?closeSettings():openSettings();$('closeSettings').onclick=closeSettings;
$('fullscreenButton').onclick=fullscreen;$('manualPreview').onclick=manual;
$('reconnect').onclick=async()=>{applyConfig(readForm(),{restartVision:false});await startCamera();};
$('settingsForm').onsubmit=e=>{e.preventDefault();applyConfig(readForm());notify('설정을 저장했습니다. 카메라 선택·해상도 변경은 다시 연결 후 적용됩니다.');};
$('drawROI').onclick=()=>{if(!camera.stream){notify('카메라를 먼저 시작하세요.');return;}adminOpen=false;$('admin').hidden=true;editing=true;document.body.classList.add('drawing');$('drawingHint').hidden=false;};
overlay.onpointerdown=e=>{if(!editing)return;dragStart=normalized(e);overlay.setPointerCapture(e.pointerId);};
overlay.onpointermove=e=>{if(!dragStart||!editing)return;const n=normalized(e);config.roi={x:Math.min(n.x,dragStart.x),y:Math.min(n.y,dragStart.y),w:Math.abs(n.x-dragStart.x),h:Math.abs(n.y-dragStart.y),configured:false};};
overlay.onpointerup=()=>{if(!editing||!dragStart)return;dragStart=null;if(config.roi.w<.05||config.roi.h<.05){notify('영역이 너무 작습니다. 다시 드래그하세요.');return;}config.roi.configured=true;config.calibrationDeviceId=cameraInfo?.settings.deviceId||'';applyConfig(config,{restartVision:false});editing=false;document.body.classList.remove('drawing');$('drawingHint').hidden=true;openSettings();notify('의자 영역을 저장했습니다. 엉덩이가 이 영역에 들어오는지 확인하세요.');};
$('captureBaseline').onclick=captureBaseline;$('clearBaseline').onclick=()=>{config.detection.baseline=null;applyConfig(config,{restartVision:false});notify('착석 기준을 지웠습니다.');};
$('exportSettings').onclick=()=>exportJSON('빈자리의혼례_설정.json',readForm());
$('importSettings').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>50000)throw Error('설정 파일이 너무 큽니다.');applyConfig(sanitize(JSON.parse(await f.text())));notify('설정을 가져왔습니다. 카메라를 다시 연결하고 의자 영역을 확인하세요.');}catch(err){notify(`설정 불러오기 실패: ${err.message}`,true);}};
$('resetDefaults').onclick=()=>{applyConfig(structuredClone(defaults));notify('기본값으로 복원했습니다. 의자 영역을 다시 지정하세요.');};
$('resetShow').onclick=()=>interaction.reset(performance.now());$('stopCamera').onclick=()=>{vision.stop();camera.stop();aiState='off';seat.reset();lastSeat=seat.lastResult;interaction.reset(performance.now());$('startCard').hidden=false;closeSettings();};
$('toggleDebug').onclick=()=>{config.debug=!config.debug;$('debug').hidden=!config.debug;};
$('downloadLog').onclick=()=>exportJSON('빈자리의혼례_검증기록.json',{createdAt:new Date().toISOString(),camera:{state:camera.state,frames:camera.frameCount,settings:cameraInfo?.settings||null},ai:{state:aiState,error:aiError},metrics:metrics.snapshot(),media:scene.snapshot(),artStatus:scene.artStatus,physicalCameraValidation:'operator-required',note:'사진·영상·얼굴 특징·관절 시계열은 포함하지 않습니다.'});
$('resetMetrics').onclick=()=>{metrics.clear();notify('이 시점부터 화면·AI 성능을 새로 측정합니다.');};
for(const name of ['songaksi','mongdal']){
 $(name+'Image').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);try{interaction.reset(performance.now());await scene.setImage(name,url);notify('이미지를 이번 실행에 적용했습니다. 외곽·크기·얼굴을 확인하세요.');}catch(err){URL.revokeObjectURL(url);notify(err.message,true);}};
 $(name+'Video').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);try{interaction.reset(performance.now());await scene.setClip(name,url);$('artStatus').textContent='가리개 영상 연결됨 · 원본 동일성·손 동작·시작/끝 자세는 운영자 검수 필요';notify('이번 실행에 영상을 연결했습니다. 수동 시연으로 검수한 뒤 전시하세요.');}catch(err){URL.revokeObjectURL(url);notify(err.message,true);}};
}
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||(e.target.tagName==='BUTTON'&&e.code==='Space'))return;
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)manual();}
 if(e.key.toLowerCase()==='f')fullscreen();
 if(e.key.toLowerCase()==='r')interaction.reset(performance.now());
 if(e.key.toLowerCase()==='d'){config.debug=!config.debug;$('debug').hidden=!config.debug;}
 if(e.key.toLowerCase()==='h')document.body.classList.toggle('clean');
 if(e.key==='Escape'&&editing){editing=false;dragStart=null;document.body.classList.remove('drawing');$('drawingHint').hidden=true;openSettings();}
});
document.addEventListener('visibilitychange',()=>metrics.event({type:'visibility',hidden:document.hidden,at:performance.now()}));
window.addEventListener('beforeunload',()=>{vision.stop();camera.stop();});
let previousState=interaction.state;
function loop(now){
 metrics.frame(now,document.hidden);const live=camera.check(now),fresh=Boolean(lastPose&&now-lastPose.sourceMs<=config.detection.staleMs);
 const input={cameraLive:live,aiReady:vision.ready&&scene.ready,fresh,present:fresh&&lastSeat.present,occupied:fresh&&lastSeat.occupied,seated:fresh&&lastSeat.seated&&!adminOpen&&!editing,...scene.gate()};
 interaction.tick(now,input);scene.render(now,interaction.visual(now),config,interaction.state);
 $('manualBanner').hidden=!interaction.manual;
 if(previousState!==interaction.state){if(interaction.state==='IDLE'&&!live)$('startCard').hidden=false;previousState=interaction.state;}
 drawOverlay(now);
 if(now-lastDebug>500){
  $('aiStatus').textContent=aiState==='ready'?(fresh?'AI 분석 중':'AI 입력 대기'):aiState==='loading'?'AI 준비 중':aiState==='error'?'AI 오류':'AI 대기';
  $('seatStatus').textContent=fresh?(lastSeat.seated?'착석 감지':lastSeat.present?'관객 감지':'관객 없음'):'관객 판정 보류';
  if(config.debug)debug(now,live,fresh);lastDebug=now;
 }
 requestAnimationFrame(loop);
}
fillForm();$('debug').hidden=!config.debug;
scene.init().then(()=>{$('artStatus').textContent='승인 캐릭터의 실제 걷기·양손 가리개 영상 연결됨 · 현장 카메라 보정 필요';metrics.event({type:'assets-ready',at:performance.now()});}).catch(e=>{notify(e.message,true);$('startupMessage').textContent=e.message;});
refreshDevices();requestAnimationFrame(loop);
