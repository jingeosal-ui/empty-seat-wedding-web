import {Metrics} from './lib/metrics.mjs';
const report=document.getElementById('report'),button=document.getElementById('run');let data;
button.onclick=async()=>{
 button.disabled=true;report.textContent='로컬 모델을 준비합니다…';const started=performance.now(),metrics=new Metrics();let ticking=true;
 const frame=t=>{if(!ticking)return;metrics.frame(t,false);requestAnimationFrame(frame);};requestAnimationFrame(frame);
 const worker=new Worker('/vision-worker.js');let timer=setTimeout(()=>finish({pass:false,error:'모델 준비/실행 시간 초과'}),60000),seq=0,results=[];
 function finish(extra){clearTimeout(timer);ticking=false;worker.terminate();data={createdAt:new Date().toISOString(),test:'black-frame-local-model-worker',physicalCamera:false,frames:results.length,loadMs:loadMs??null,metrics:metrics.snapshot(),...extra};report.textContent=JSON.stringify(data,null,2);button.disabled=false;document.getElementById('save').disabled=false;}
 let loadMs;
 async function send(){const canvas=new OffscreenCanvas(640,360),ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,640,360);const bitmap=canvas.transferToImageBitmap();worker.postMessage({type:'frame',bitmap,seq:seq++,sourceMs:performance.now()},[bitmap]);}
 worker.onerror=e=>finish({pass:false,error:e.message});
 worker.onmessage=async({data:m})=>{
  if(m.type==='ready'){loadMs=performance.now()-started;report.textContent='로컬 Face/Pose 모델 준비됨. 검은 프레임 36개를 분석합니다…';await send();}
  if(m.type==='error'||m.type==='frame-error'){finish({pass:false,error:m.message});}
  if(m.type==='result'){results.push(m);metrics.inference(m.inferenceMs,m.sourceMs);if(results.length<36)setTimeout(send,83);else finish({pass:results.every(r=>!r.landmarks.length&&!r.facePresent),falsePositiveFrames:results.filter(r=>r.landmarks.length||r.facePresent).length});}
 };
 worker.postMessage({type:'init',config:{sensitivity:.55}});
};
document.getElementById('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='local-ai-validation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
