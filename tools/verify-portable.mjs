import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
const project=path.resolve(import.meta.dirname,'..'),target=path.resolve(process.argv[2]||path.join(project,'release/빈자리의혼례_웹캠_C_설치없이실행'));
if(process.platform!=='win32')throw Error('Windows 실행 시험용입니다.');
const nodePath=path.join(target,'runtime/node-win-x64/node.exe');
const record=JSON.parse(await readFile(path.join(target,'runtime/node-win-x64/runtime.json'),'utf8'));
const sum=createHash('sha256');for await(const b of createReadStream(nodePath))sum.update(b);assert.equal(sum.digest('hex'),record.sha256);
const systemRoot=process.env.SystemRoot||'C:\\Windows',system32=path.join(systemRoot,'System32');
const isolatedEnv={...process.env,PATH:system32+';'+systemRoot,NODE_PATH:'',NODE_OPTIONS:''};
let systemNodeFound=false;try{execFileSync(path.join(system32,'where.exe'),['node'],{cwd:target,env:isolatedEnv,stdio:'pipe'});systemNodeFound=true;}catch{}
assert.equal(systemNodeFound,false,'시스템 PATH에 Node가 남아 있습니다.');
const version=execFileSync(nodePath,['--version'],{cwd:target,env:isolatedEnv,encoding:'utf8',windowsHide:true}).trim();assert.equal(version,record.version);
const actualExe=execFileSync(nodePath,['-p','process.execPath'],{cwd:target,env:isolatedEnv,encoding:'utf8',windowsHide:true}).trim();assert.equal(actualExe.toLowerCase(),nodePath.toLowerCase());
for(const p of ['00_전시시작.cmd','START_EXHIBITION.cmd','server.mjs','public/models/pose_landmarker_lite.task','public/models/face_landmarker.task','public/vendor/vision_bundle.js','public/vendor/wasm/vision_wasm_internal.wasm'])await stat(path.join(target,p));
async function unusedPort(){const s=net.createServer();await new Promise((resolve,reject)=>{s.once('error',reject);s.listen(0,'127.0.0.1',resolve);});const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const runs=[];
for(let cycle=0;cycle<2;cycle++){
 const port=await unusedPort(),url=`http://127.0.0.1:${port}`;
 const child=spawn(path.join(system32,'cmd.exe'),['/d','/c','START_EXHIBITION.cmd','--no-browser'],{cwd:target,env:{...isolatedEnv,EXHIBITION_PORT:String(port)},stdio:['ignore','pipe','pipe'],windowsHide:true});
 let output='',childError=null;child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',e=>childError=e);
 const started=performance.now();
 try{
  let ready=false;
  while(performance.now()-started<15000){if(childError)throw childError;if(child.exitCode!==null)throw Error(`실행기가 종료됐습니다: ${output}`);try{const r=await fetch(url,{signal:AbortSignal.timeout(700)});ready=r.ok;}catch{}if(ready)break;await delay(150);}
  assert.ok(ready,`서버 준비 실패: ${output}`);
  const assets=['/','/app.mjs','/vision-worker.js','/vendor/vision_bundle.js','/vendor/wasm/vision_wasm_internal.js','/vendor/wasm/vision_wasm_internal.wasm','/models/pose_landmarker_lite.task','/models/face_landmarker.task','/assets/characters/songaksi.webp','/assets/characters/mongdal.webp'];
  for(const file of assets){const r=await fetch(url+file,{method:'HEAD',signal:AbortSignal.timeout(3000)});assert.equal(r.status,200,file);assert.ok(Number(r.headers.get('content-length'))>0);}
  assert.equal((await fetch(url+'/',{method:'POST'})).status,405);
  assert.equal((await fetch(url+'/runtime/node-win-x64/node.exe')).status,404);
  runs.push({cycle:cycle+1,pass:true,startupMs:performance.now()-started,resourcesChecked:assets.length,bundledRuntimeNotWebServed:true});
 }finally{
  if(child.pid&&child.exitCode===null){try{execFileSync(path.join(system32,'taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'pipe'});}catch{}}
  await delay(250);
 }
}
const result={date:new Date().toISOString(),pass:true,version,nodeExeSHA256:record.sha256,systemNodeOnPATH:false,nodeOptionsCleared:true,executedRuntime:'runtime/node-win-x64/node.exe',launcher:'START_EXHIBITION.cmd --no-browser',runs,physicalSeatedCameraTest:false,browserVisualRetest:false,note:'시스템 Node 경로를 제외한 환경에서 복사한 배포본 실행기를 두 번 실행. 다른 물리 PC·실제 관객 정확도·손/팔 동작 검증과 구분.'};
await writeFile(path.join(project,'docs/portable-validation.json'),JSON.stringify(result,null,2));
await writeFile(path.join(target,'docs/portable-validation.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
