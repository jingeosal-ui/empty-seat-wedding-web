import {appURL} from './paths.mjs';
export class Vision {
 constructor(video,onEvent){this.video=video;this.onEvent=onEvent;this.worker=null;this.ready=false;this.busy=false;this.lastSent=0;this.lastResult=null;this.seq=0;this.generation=0;this.timer=null;this.lastFaceAt=0;this.lastFace=false;this.errorCount=0;}
 stop(){this.generation++;clearInterval(this.timer);this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.lastResult=null;this.lastFace=false;this.lastFaceAt=0;this.lastVideoTime=-1;}
 start(config){
  this.stop();this.config=config;const generation=this.generation;
  this.onEvent({type:'loading'});
  try{
   this.worker=new Worker(appURL('vision-worker.js'));
   this.worker.onmessage=e=>{
    if(generation!==this.generation)return;const m=e.data;
    if(m.type==='ready'){this.ready=true;this.errorCount=0;this.onEvent(m);}
    if(['result','frame-error','skip'].includes(m.type))this.busy=false;
    if(m.type==='result'){
      if(m.faceUpdated){this.lastFace=m.facePresent;this.lastFaceAt=m.sourceMs;}
      m.facePresent=this.lastFace&&performance.now()-this.lastFaceAt<650;
      this.lastResult=m;this.errorCount=0;this.onEvent(m);
    }else if(m.type==='frame-error'){
      this.errorCount++;this.onEvent(m);if(this.errorCount>=3){this.ready=false;this.onEvent({type:'error',message:'연속 추론 오류가 발생했습니다. 카메라를 다시 연결하세요.'});}
    }else if(m.type==='error'){this.ready=false;this.busy=false;this.onEvent(m);}
   };
   this.worker.onerror=e=>{this.ready=false;this.busy=false;this.onEvent({type:'error',message:e.message||'AI Worker 오류'});};
   this.worker.postMessage({type:'init',config:config.detection});
   this.timer=setInterval(()=>this.capture(generation),16);
  }catch(e){this.onEvent({type:'error',message:e.message});}
 }
 async capture(generation){
  if(!this.ready||this.busy||document.hidden||performance.now()-this.lastSent<1000/this.config.detection.fps||this.video.readyState<2||!this.video.videoWidth||this.video.currentTime===this.lastVideoTime)return;
  this.lastVideoTime=this.video.currentTime;
  this.busy=true;const sourceMs=performance.now();
  try{
    const width=Math.min(this.config.detection.width,this.video.videoWidth),height=Math.round(width*this.video.videoHeight/this.video.videoWidth);
    const bitmap=await createImageBitmap(this.video,{resizeWidth:width,resizeHeight:height,resizeQuality:'low'});
    if(generation!==this.generation){bitmap.close();return;}
    this.lastSent=sourceMs;this.worker.postMessage({type:'frame',seq:++this.seq,sourceMs,bitmap},[bitmap]);
  }catch(e){if(generation===this.generation){this.busy=false;this.onEvent({type:'frame-error',message:e.message});}}
 }
}
