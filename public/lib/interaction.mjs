export const phaseNames={IDLE:'관객 대기',APPROACH:'관객 감지',SEATED:'착석 확인',WAITING:'대기',GHOST_ENTER:'귀신 등장',GHOST_HOLD:'정지',GHOST_REVEAL:'가리개 내림',GHOST_WATCH:'응시',EXIT:'퇴장',RESET:'초기화'};
const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const active=new Set(['WAITING','GHOST_ENTER','GHOST_HOLD','GHOST_REVEAL','GHOST_WATCH']);
export class Interaction {
 constructor(config,onEvent=()=>{}){this.config=config;this.onEvent=onEvent;this.state='IDLE';this.since=0;this.latched=false;this.manual=false;this.exitPose=null;this.cycleStart=0;this.absentSince=null;this.vacantSince=null;}
 change(state,now,extra={}){this.state=state;this.since=now;this.onEvent({type:'phase',state,at:now,manual:this.manual,...extra});}
 reset(now=0){this.manual=false;this.latched=true;this.absentSince=null;this.vacantSince=null;this.exitPose=null;this.change('RESET',now,{reason:'operator'});}
 preview(now){this.manual=true;this.latched=true;this.cycleStart=now;this.absentSince=null;this.change('WAITING',now,{reason:'emergency-manual'});}
 exit(now,reason){if(['EXIT','RESET','IDLE','APPROACH'].includes(this.state))return;this.exitPose=this.visual(now);this.latched=true;this.change('EXIT',now,{reason});}
 tick(now,input){
  const t=this.config.timing,elapsed=(now-this.since)/1000;
  if(!input.present){this.vacantSince??=now;if(now-this.vacantSince>1200)this.latched=false;}else this.vacantSince=null;
  const ready=input.cameraLive&&input.aiReady&&input.fresh;
  if(active.has(this.state)&&!this.manual){
    if(!ready||!input.occupied){this.absentSince??=now;if(now-this.absentSince>=this.config.detection.leaveMs){this.exit(now,ready?'left-seat':'input-lost');return;}}
    else this.absentSince=null;
  }
  if(active.has(this.state)&&now-this.cycleStart>t.maxSession*1000){this.exit(now,'session-timeout');return;}
  switch(this.state){
   case 'IDLE':if(input.present&&ready)this.change('APPROACH',now);break;
   case 'APPROACH':if(!input.present||!ready)this.change('IDLE',now);else if(input.seated&&!this.latched){this.manual=false;this.cycleStart=now;this.change('SEATED',now);}break;
   case 'SEATED':if(!input.seated||!ready)this.change('APPROACH',now);else if(elapsed>=.2){this.latched=true;this.change('WAITING',now);}break;
   case 'WAITING':if(elapsed>=t.waiting)this.change('GHOST_ENTER',now);break;
   case 'GHOST_ENTER':if(elapsed>=t.enter)this.change('GHOST_HOLD',now);break;
   case 'GHOST_HOLD':if(elapsed>=t.hold)this.change('GHOST_REVEAL',now);break;
   case 'GHOST_REVEAL':if(elapsed>=t.reveal+t.offset)this.change('GHOST_WATCH',now);break;
   case 'GHOST_WATCH':if(elapsed>=t.watch)this.exit(now,'show-timeout');break;
   case 'EXIT':if(elapsed>=t.exit){this.manual=false;this.exitPose=null;this.change('RESET',now);}break;
   case 'RESET':if(elapsed>=t.reset)this.change('IDLE',now);break;
  }
 }
 visual(now){
  const t=this.config.timing,s=this.state,elapsed=Math.max(0,(now-this.since)/1000);
  let opacity=0,enter=0,bride=0,groom=0,watch=0;
  if(s==='GHOST_ENTER'){opacity=ease(elapsed/t.enter);enter=opacity;}
  if(['GHOST_HOLD','GHOST_REVEAL','GHOST_WATCH'].includes(s)){opacity=1;enter=1;}
  if(s==='GHOST_REVEAL'){bride=ease(elapsed/t.reveal);groom=ease((elapsed-t.offset)/t.reveal);}
  if(s==='GHOST_WATCH'){bride=1;groom=1;watch=ease(elapsed/3);}
  if(s==='EXIT'&&this.exitPose){return {...this.exitPose,opacity:this.exitPose.opacity*(1-ease(elapsed/t.exit))};}
  return {opacity,enter,bride,groom,watch};
 }
}
