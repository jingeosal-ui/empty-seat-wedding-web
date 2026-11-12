import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,sanitize} from '../public/lib/config.mjs';
import {SeatDetector} from '../public/lib/seat.mjs';
import {Interaction} from '../public/lib/interaction.mjs';
const config=()=>{const c=structuredClone(defaults);c.roi.configured=true;return c;};
function pose({standing=false,x=.5,missing=false}={}){
 const p=Array.from({length:33},()=>({x,y:.4,z:0,visibility:0}));
 for(const [i,px,py] of [[11,x-.05,.3],[12,x+.05,.3],[23,x-.04,.6],[24,x+.04,.6],[25,x-.14,standing?.77:.67],[26,x+.14,standing?.77:.67],[27,x-.14,.9],[28,x+.14,.9]])p[i]={x:standing?x:px,y:py,z:0,visibility:missing&&i>=23?0:1};
 return p;
}
const feed=(s,landmarks,t,extra={})=>s.evaluate({landmarks,sourceMs:t,now:t,...extra});
test('통과하는 관객·선 자세·얼굴만으로 착석하지 않는다',()=>{
 for(const p of [pose({standing:true}),pose({x:.9}),pose({missing:true}),[]]){
  const s=new SeatDetector(config());let r;
  for(let t=0;t<4000;t+=83)r=feed(s,p,t,{facePresent:true});
  assert.equal(r.seated,false);assert.equal(r.occupied,false);
 }
});
test('의자 영역 안에서 다리를 굽히고 유지하면 자동 착석',()=>{
 const s=new SeatDetector(config());assert.equal(feed(s,pose(),0).seated,false);
 let r;for(let t=83;t<2300;t+=83)r=feed(s,pose(),t);
 assert.equal(r.seated,true);assert.equal(r.progress,1);
});
test('카메라 끊김·오래된 결과는 착석을 해제한다',()=>{
 const s=new SeatDetector(config());for(let t=0;t<2200;t+=83)feed(s,pose(),t);
 assert.equal(s.lastResult.seated,true);
 assert.equal(s.evaluate({landmarks:pose(),sourceMs:2100,now:4000}).seated,false);
 assert.equal(feed(s,pose(),5000).seated,false);
});
test('상체만 보이는 모드는 착석 기준과 명시적 허용이 모두 필요하다',()=>{
 const c=config(),p=pose();for(const i of [25,26,27,28])p[i].visibility=0;
 c.detection.baseline={hipY:.6,torso:.3,shoulderY:.3};
 const s=new SeatDetector(c);for(let t=0;t<2500;t+=83)feed(s,p,t);assert.equal(s.lastResult.seated,false);
 c.detection.allowUpperBody=true;s.configure(c);for(let t=0;t<2500;t+=83)feed(s,p,t);assert.equal(s.lastResult.seated,true);
 const q=structuredClone(p);q[23].y=q[24].y=.75;assert.equal(feed(s,q,2600).occupied,false);
});
test('ROI 보정 전에는 자동으로 시작하지 않는다',()=>{
 const s=new SeatDetector(structuredClone(defaults));for(let t=0;t<3000;t+=83)feed(s,pose(),t);
 assert.equal(s.lastResult.reason,'calibration');assert.equal(s.lastResult.seated,false);
});
const yes={cameraLive:true,aiReady:true,fresh:true,present:true,occupied:true,seated:true};
test('실제 입력이 준비되지 않으면 연출을 시작하지 않는다',()=>{
 const i=new Interaction(config());for(let t=0;t<3000;t+=16)i.tick(t,{...yes,cameraLive:false});assert.equal(i.state,'IDLE');
});
test('신부 공개 후 0.8초 시차·퇴장 시 자세 고정·투명 초기화',()=>{
 const i=new Interaction(config());i.change('GHOST_REVEAL',1000);i.cycleStart=1000;
 assert.equal(i.visual(1400).groom,0);assert.ok(i.visual(1400).bride>0);assert.ok(i.visual(2000).groom>0);
 const before=i.visual(2200);i.exit(2200,'test');const out=i.visual(2500);
 assert.equal(out.bride,before.bride);assert.equal(out.groom,before.groom);assert.ok(out.opacity<before.opacity);
 i.tick(4300,yes);assert.equal(i.state,'RESET');assert.equal(i.visual(4300).opacity,0);
});
test('지속 착석 중 재발동 방지, 퇴장 뒤 다음 관객 재무장',()=>{
 const i=new Interaction(config());i.reset(0);i.tick(1000,yes);i.tick(1100,yes);i.tick(2000,yes);assert.notEqual(i.state,'SEATED');
 i.tick(2100,{...yes,present:false});i.tick(3500,{...yes,present:false});i.tick(3600,yes);i.tick(3700,yes);assert.equal(i.state,'SEATED');
});
test('카메라/AI 입력 유실은 유예 후 자연스러운 퇴장',()=>{
 const i=new Interaction(config());i.change('GHOST_WATCH',1000);i.cycleStart=1000;
 i.tick(1100,{...yes,fresh:false});assert.equal(i.state,'GHOST_WATCH');i.tick(3400,{...yes,fresh:false});assert.equal(i.state,'EXIT');
});
test('30·60·144 FPS에서 시퀀스 길이 오차는 프레임 양자화 범위',()=>{
 const finish=[];for(const fps of [30,60,144]){
  const i=new Interaction(config());i.preview(0);let end=0;
  for(let t=0;t<40000;t+=1000/fps){i.tick(t,yes);if(i.state==='RESET'){end=t;break;}}
  assert.ok(end>=23800&&end<24100);finish.push(end);
 }
 assert.ok(Math.max(...finish)-Math.min(...finish)<300);
});
test('설정 가져오기는 범위를 제한한다',()=>{
 const c=sanitize({timing:{maxSession:-1},roi:{x:.99,y:.99,w:4,h:4},camera:{width:99999},detection:{fps:100}});
 assert.equal(c.timing.maxSession,5);assert.equal(c.camera.width,1920);assert.equal(c.detection.fps,15);assert.ok(c.roi.x+c.roi.w<=1);
});
