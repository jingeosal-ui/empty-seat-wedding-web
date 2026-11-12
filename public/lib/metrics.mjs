export class Metrics{
 clear(){this.frames=[];this.ai=[];this.events=[];this.longTasks=[];this.last=null;this.started=performance.now();}
 constructor(){this.frames=[];this.ai=[];this.events=[];this.last=null;this.started=performance.now();this.longTasks=[];try{this.observer=new PerformanceObserver(list=>{for(const x of list.getEntries())this.longTasks.push({at:x.startTime,ms:x.duration});});this.observer.observe({type:'longtask',buffered:true});}catch{}}
 frame(now,hidden=false){if(hidden){this.last=null;return;}if(this.last!==null)this.frames.push({at:now,ms:now-this.last});this.last=now;while(this.frames.length>18000)this.frames.shift();}
 inference(ms,sourceMs){this.ai.push({at:performance.now(),ms,sourceMs});if(this.ai.length>3000)this.ai.shift();}
 event(e){this.events.push(e);if(this.events.length>300)this.events.shift();}
 static summary(data){const a=data.map(x=>x.ms).filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return {samples:n,meanMs:n?a.reduce((s,x)=>s+x,0)/n:0,p95Ms:a[Math.floor((n-1)*.95)]||0,p99Ms:a[Math.floor((n-1)*.99)]||0,maxMs:a[n-1]||0,over50:a.filter(x=>x>50).length,over100:a.filter(x=>x>100).length};}
 snapshot(){const render=Metrics.summary(this.frames),memory=performance.memory;return {render:{...render,fps:render.meanMs?1000/render.meanMs:0},inference:Metrics.summary(this.ai),mainThreadHeap:memory?{usedBytes:memory.usedJSHeapSize,totalBytes:memory.totalJSHeapSize,limitBytes:memory.jsHeapSizeLimit,scope:'Chrome 참고값: Worker·GPU·전체 프로세스 메모리 제외'}:null,events:this.events,longTasks:this.longTasks.slice(-100),durationMs:performance.now()-this.started,note:'표시 중인 탭의 requestAnimationFrame 간격. 실제 패널 표시·물리 카메라 지연·관객 인식 정확도와 다름.'};}
}
