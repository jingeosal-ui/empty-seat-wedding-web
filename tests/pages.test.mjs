import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
test('application assets remain inside the GitHub repository prefix',async()=>{
 const code=await readFile(new URL('public/lib/paths.mjs',root),'utf8');
 for(const base of ['https://example.org/','https://example.org/empty-seat-wedding-web/']){
  const {appURL}=await import('data:text/javascript,'+encodeURIComponent(code.replace('import.meta.url',JSON.stringify(base+'lib/paths.mjs'))));
  for(const resource of ['vision-worker.js','/assets/film/songaksi_walk.webm','models/face_landmarker.task'])assert.equal(appURL(resource),base+resource.replace(/^\//,''));
 }
});
test('HTML entrypoints use relative links and scripts',async()=>{
 for(const file of ['index.html','film-review.html','diagnostics.html']){
  const s=await readFile(new URL('public/'+file,root),'utf8');
  assert.doesNotMatch(s,/(?:src|href)=["']\//);
  assert.match(s,/src="\.\/[\w-]+\.mjs"/);
 }
});
test('classic AI worker resolves SDK, WASM and both models under its own prefix',async()=>{
 const code=await readFile(new URL('public/vision-worker.js',root),'utf8');
 for(const base of ['https://example.org/','https://example.org/empty-seat-wedding-web/']){
  const seen=[],messages=[];
  const lib={FilesetResolver:{forVisionTasks:async p=>{seen.push(p);return {};}}};
  for(const name of ['PoseLandmarker','FaceLandmarker'])lib[name]={createFromOptions:async(_,o)=>{seen.push(o.baseOptions.modelAssetPath);return {};}};
  const self={location:{href:base+'vision-worker.js'},Vision:lib};
  class OffscreenCanvas{getContext(){return {};}}
  vm.runInNewContext(code,{self,URL,OffscreenCanvas,importScripts:p=>seen.push(p),postMessage:m=>messages.push(m)});
  await self.onmessage({data:{type:'init',config:{sensitivity:.55}}});
  assert.deepEqual(seen,['vendor/vision_bundle.js','vendor/wasm','models/pose_landmarker_lite.task','models/face_landmarker.task'].map(x=>base+x));
  assert.equal(messages.at(-1).type,'ready');
 }
});
