import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:4173';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('로컬 전시 서버 주소만 허용합니다.');
const files=['/','/app.mjs','/vision-worker.js','/lib/seat.mjs','/vendor/vision_bundle.js','/vendor/wasm/vision_wasm_internal.js','/vendor/wasm/vision_wasm_internal.wasm','/models/pose_landmarker_lite.task','/models/face_landmarker.task','/assets/characters/songaksi.webp','/assets/characters/mongdal.webp'];
for(const file of files){const r=await fetch(base+file,{method:'HEAD',signal:AbortSignal.timeout(5000)});assert.equal(r.status,200,file);assert.ok(r.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok(Number(r.headers.get('content-length'))>0);}
assert.equal((await fetch(base+'/missing-resource')).status,404);
assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
const range=await fetch(base+'/assets/characters/songaksi.webp',{headers:{Range:'bytes=0-15'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,16);
const result={at:new Date().toISOString(),pass:true,resourceHEADChecks:files.length,missing404:true,writeRejected405:true,byteRange206:true,scope:'복사된 배포본 로컬 HTTP 확인. 실제 관객 또는 시각 연출 검사 아님.'};
await writeFile(path.resolve(import.meta.dirname,'../docs/server-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
