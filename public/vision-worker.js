/* 추론은 이 Worker에서만 실행한다. 원본 영상과 화면 애니메이션은 메인 스레드에서 독립 실행. */
let pose=null,face=null,ready=false,frameIndex=0,lastStamp=-1;
let config={sensitivity:.55};
let lumaCanvas=null,lumaCtx=null;
const appURL=resource=>new URL(resource,self.location.href).href;
self.onmessage=async event=>{
 const m=event.data;
 if(m.type==='init'){
  try{
   importScripts(appURL('vendor/vision_bundle.js'));
   const lib=self.Vision||self.vision;
   if(!lib?.FilesetResolver)throw Error('MediaPipe 번들을 읽지 못했습니다.');
   config=m.config||config;
   const files=await lib.FilesetResolver.forVisionTasks(appURL('vendor/wasm'));
   const min=.65-config.sensitivity*.35;
   pose=await lib.PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:appURL('models/pose_landmarker_lite.task'),delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:min,minPosePresenceConfidence:min,minTrackingConfidence:.45,outputSegmentationMasks:false});
   face=await lib.FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:appURL('models/face_landmarker.task'),delegate:'CPU'},runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:.45,minFacePresenceConfidence:.45,minTrackingConfidence:.45,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:true});
   lumaCanvas=new OffscreenCanvas(32,18);lumaCtx=lumaCanvas.getContext('2d',{willReadFrequently:true});
   ready=true;postMessage({type:'ready',delegate:'CPU',face:true,pose:true});
  }catch(e){postMessage({type:'error',message:String(e?.message||e)});}
 }
 if(m.type==='frame'){
  const bitmap=m.bitmap;
  if(!ready){bitmap?.close();return;}
  const started=performance.now();
  try{
   if(m.sourceMs<=lastStamp){bitmap.close();postMessage({type:'skip',seq:m.seq});return;}
   lastStamp=m.sourceMs;
   const p=pose.detectForVideo(bitmap,m.sourceMs);
   let f=null;
   if(frameIndex++%2===0)f=face.detectForVideo(bitmap,m.sourceMs);
   lumaCtx.drawImage(bitmap,0,0,32,18);const px=lumaCtx.getImageData(0,0,32,18).data;let sum=0;
   for(let i=0;i<px.length;i+=4)sum+=.2126*px[i]+.7152*px[i+1]+.0722*px[i+2];
   const matrix=f?.facialTransformationMatrixes?.[0]?.data;
   postMessage({type:'result',seq:m.seq,sourceMs:m.sourceMs,landmarks:p.landmarks?.[0]||[],world:p.worldLandmarks?.[0]||[],faceUpdated:f!==null,facePresent:Boolean(f?.faceLandmarks?.length),faceLandmarks:f?.faceLandmarks?.[0]?.filter((_,i)=>[1,33,133,263,362,152].includes(i))||[],faceMatrix:matrix?Array.from(matrix):null,brightness:sum/(32*18),inferenceMs:performance.now()-started});
  }catch(e){postMessage({type:'frame-error',seq:m.seq,message:String(e?.message||e)});}
  finally{bitmap.close();}
 }
};
