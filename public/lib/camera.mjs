export class Camera {
 constructor(video,onState){this.video=video;this.onState=onState;this.stream=null;this.state='off';this.lastFrame=0;this.frameCount=0;this.generation=0;this.frameRequest=null;}
 notify(state,extra={}){this.state=state;this.onState({state,...extra});}
 async devices(){const list=await navigator.mediaDevices?.enumerateDevices();return (list||[]).filter(x=>x.kind==='videoinput');}
 stop(){this.generation++;if(this.frameRequest!==null&&this.video.cancelVideoFrameCallback)this.video.cancelVideoFrameCallback(this.frameRequest);for(const t of this.stream?.getTracks()||[])t.stop();this.stream=null;this.video.srcObject=null;this.lastFrame=0;this.frameCount=0;this.notify('off');}
 async start(config){
  this.stop();const generation=this.generation;
  if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia){this.notify('error',{message:'카메라는 Chrome의 localhost 주소에서 실행해야 합니다.'});throw Error('secure-context');}
  this.notify('requesting');
  try{
   const video={width:{ideal:config.width},height:{ideal:config.height},frameRate:{ideal:config.fps,max:60}};
   if(config.deviceId)video.deviceId={exact:config.deviceId};else video.facingMode='user';
   const stream=await navigator.mediaDevices.getUserMedia({video,audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;const track=stream.getVideoTracks()[0];
   track.addEventListener('ended',()=>{if(generation===this.generation)this.notify('ended',{message:'카메라 연결이 종료되었습니다. 다시 연결하세요.'});});
   this.video.srcObject=stream;this.notify('connecting');await this.video.play();
   let lastTime=-1;
   const frame=()=>{
    if(generation!==this.generation)return;
    if(this.video.readyState>=2&&this.video.videoWidth>0&&this.video.currentTime!==lastTime){
      lastTime=this.video.currentTime;this.lastFrame=performance.now();this.frameCount++;
      if(this.state!=='live')this.notify('live',{settings:track.getSettings(),label:track.label});
    }
    if(this.video.requestVideoFrameCallback)this.frameRequest=this.video.requestVideoFrameCallback(frame);
    else this.frameRequest=requestAnimationFrame(frame);
   };
   frame();
  }catch(e){
   if(generation===this.generation){for(const t of this.stream?.getTracks()||[])t.stop();this.stream=null;this.video.srcObject=null;}
   const messages={NotAllowedError:'카메라 권한이 차단되었습니다. Chrome 주소창의 사이트 설정과 Windows 카메라 개인 정보 설정을 확인하세요.',NotFoundError:'연결된 카메라가 없습니다. USB 연결과 장치 인식을 확인하세요.',NotReadableError:'다른 앱이 카메라를 사용 중이거나 장치를 열 수 없습니다.',OverconstrainedError:'선택한 카메라를 찾지 못했습니다. 카메라 선택을 다시 확인하세요.'};
   if(generation===this.generation)this.notify('error',{message:messages[e.name]||`카메라 오류: ${e.message}`});
   throw e;
  }
 }
 check(now){if(this.stream&&this.frameCount&&now-this.lastFrame>2000&&this.state==='live')this.notify('stalled',{message:'카메라 프레임이 멈췄습니다. 판정을 중지했습니다.'});return this.state==='live'&&now-this.lastFrame<2000;}
}
