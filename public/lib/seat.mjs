const avg=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:((a.z||0)+(b.z||0))/2});
const visible=(p,min)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=min;
function angle(a,b,c){if(!a||!b||!c)return 180;const u=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];const n=Math.hypot(...u)*Math.hypot(...v);return n?Math.acos(Math.min(1,Math.max(-1,u.reduce((s,x,i)=>s+x*v[i],0)/n)))*180/Math.PI:180;}
export const reasons={calibration:'의자 영역을 먼저 지정하세요',missing:'관객 없음',hips:'엉덩이·어깨가 충분히 보이지 않음',outside:'의자 영역 밖',torso:'상체 자세 확인 중',moving:'자세 안정화 중',legs:'다리 굽힘 또는 착석 기준이 필요함',baseline:'저장된 착석 높이와 다름',holding:'착석 유지 확인 중',seated:'착석 감지',stale:'AI 결과가 오래되어 판정 보류',warming:'AI 준비 중'};
export class SeatDetector {
 constructor(config){this.configure(config);}
 configure(config){this.config=config;this.reset();}
 reset(){this.samples=[];this.holdStart=null;this.lastSource=null;this.lastResult={present:false,occupied:false,seated:false,progress:0,reason:'missing',score:0};}
 evaluate({landmarks=[],world=[],facePresent=false,sourceMs,now=sourceMs}){
  const {roi,detection:d}=this.config;
  if(!Number.isFinite(sourceMs)||now-sourceMs>d.staleMs){this.holdStart=null;return this.lastResult={...this.lastResult,seated:false,occupied:false,progress:0,reason:'stale'};}
  if(this.lastSource!==null && sourceMs<=this.lastSource)return this.lastResult;
  if(this.lastSource!==null && sourceMs-this.lastSource>500){this.holdStart=null;this.samples=[];}
  this.lastSource=sourceMs;
  const min=.65-d.sensitivity*.35,p=landmarks;
  const present=Boolean(p.length||facePresent);
  const fail=(reason,extra={})=>{this.holdStart=null;return this.lastResult={present,occupied:false,seated:false,progress:0,score:0,reason,...extra};};
  if(!present){this.samples=[];return fail('missing');}
  if(![11,12,23,24].every(i=>visible(p[i],min)))return fail('hips');
  const hip=avg(p[23],p[24]),shoulder=avg(p[11],p[12]);
  const mirroredHip={x:1-hip.x,y:hip.y},torso=hip.y-shoulder.y;
  const inROI=mirroredHip.x>=roi.x&&mirroredHip.x<=roi.x+roi.w&&hip.y>=roi.y&&hip.y<=roi.y+roi.h;
  const signature={hipY:hip.y,shoulderY:shoulder.y,torso};
  if(!roi.configured)return fail('calibration',{hip:mirroredHip,signature});
  if(!inROI){this.samples=[];return fail('outside',{hip:mirroredHip,signature});}
  if(torso<.045)return fail('torso',{hip:mirroredHip,signature});
  this.samples.push({x:hip.x,y:hip.y,t:sourceMs});this.samples=this.samples.filter(s=>sourceMs-s.t<1100);
  const xs=this.samples.map(s=>s.x),ys=this.samples.map(s=>s.y);
  const spread=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  const stable=this.samples.length>=3&&sourceMs-this.samples[0].t>=180&&spread<d.stability;
  let bent=false;const kneeAngles=[];
  for(const [h,k,a] of [[23,25,27],[24,26,28]]){
    if([h,k,a].every(i=>visible(p[i],min))){const points=world.length?world:p;const v=angle(points[h],points[k],points[a]);kneeAngles.push(v);if(v<154+d.sensitivity*12 && p[k].y>hip.y-.08)bent=true;}
  }
  const baseline=d.baseline;
  const matches=baseline&&Math.abs(hip.y-baseline.hipY)<.055+d.sensitivity*.065&&Math.abs(torso-baseline.torso)<Math.max(.035,baseline.torso*.28);
  const extra={hip:mirroredHip,signature,spread,kneeAngles,bent,baselineMatch:Boolean(matches),occupied:true};
  if(baseline&&!matches)return fail('baseline',{...extra,occupied:false});
  if(!bent&&!(matches&&(d.allowUpperBody||kneeAngles.length)))return fail('legs',{...extra,occupied:false});
  if(!stable)return fail('moving',extra);
  this.holdStart??=sourceMs;
  const progress=Math.min(1,(sourceMs-this.holdStart)/d.holdMs);
  return this.lastResult={present:true,occupied:true,seated:progress>=1,progress,reason:progress>=1?'seated':'holding',score:Math.min(1,.65+progress*.35),...extra};
 }
}
