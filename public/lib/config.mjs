export const defaults = {
  schema:1, calibrationDeviceId:'', camera:{deviceId:'',width:1280,height:720,fps:30},
  roi:{x:.32,y:.42,w:.36,h:.38,configured:false},
  detection:{fps:12,width:640,sensitivity:.55,holdMs:1800,stability:.035,leaveMs:2200,staleMs:800,allowUpperBody:false,baseline:null},
  timing:{waiting:1.5,enter:3,hold:1.5,reveal:3,offset:.8,watch:12,exit:2,reset:.7,maxSession:50},
  actors:{songaksi:{x:.21,y:.94,height:.82},mongdal:{x:.79,y:.94,height:.9}},
  debug:false
};
const clamp=(v,a,b,d)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):d;
export function sanitize(raw={}){
  const c=structuredClone(defaults);
  const a=raw.camera||{},d=raw.detection||{},t=raw.timing||{},r=raw.roi||{};
  c.camera={deviceId:typeof a.deviceId==='string'?a.deviceId.slice(0,250):'',width:clamp(a.width,320,1920,1280),height:clamp(a.height,240,1080,720),fps:clamp(a.fps,15,60,30)};
  c.roi={x:clamp(r.x,0,.95,.32),y:clamp(r.y,0,.95,.42),w:clamp(r.w,.05,1,.36),h:clamp(r.h,.05,1,.38),configured:r.configured===true};
  c.roi.w=Math.min(c.roi.w,1-c.roi.x);c.roi.h=Math.min(c.roi.h,1-c.roi.y);
  c.detection={...c.detection,fps:clamp(d.fps,5,15,12),width:clamp(d.width,256,960,640),sensitivity:clamp(d.sensitivity,.1,.9,.55),holdMs:clamp(d.holdMs,600,6000,1800),stability:clamp(d.stability,.008,.12,.035),leaveMs:clamp(d.leaveMs,600,8000,2200),staleMs:clamp(d.staleMs,350,2500,800),allowUpperBody:d.allowUpperBody===true};
  if(d.baseline && ['hipY','torso','shoulderY'].every(k=>Number.isFinite(d.baseline[k])))c.detection.baseline={hipY:clamp(d.baseline.hipY,0,1,.6),torso:clamp(d.baseline.torso,.03,.8,.2),shoulderY:clamp(d.baseline.shoulderY,0,1,.4)};
  for(const k of Object.keys(c.timing))c.timing[k]=clamp(t[k],k==='offset'?0:k==='maxSession'?5:.2,k==='maxSession'?180:60,c.timing[k]);
  for(const name of Object.keys(c.actors)){
    const p=raw.actors?.[name]||{};c.actors[name]={x:clamp(p.x,.03,.97,c.actors[name].x),y:clamp(p.y,.45,1.15,.94),height:clamp(p.height,.25,1.4,c.actors[name].height)};
  }
  c.debug=raw.debug===true;
  c.calibrationDeviceId=typeof raw.calibrationDeviceId==='string'?raw.calibrationDeviceId.slice(0,250):'';
  return c;
}
export function loadConfig(storage=globalThis.localStorage){try{return sanitize(JSON.parse(storage.getItem('empty-seat-c-v1')||'{}'));}catch{return sanitize();}}
export function saveConfig(config,storage=globalThis.localStorage){const c=sanitize(config);storage.setItem('empty-seat-c-v1',JSON.stringify(c));return c;}
