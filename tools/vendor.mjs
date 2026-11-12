import { mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const pkg=path.join(root,'node_modules/@mediapipe/tasks-vision');
await mkdir(path.join(root,'public/vendor/wasm'),{recursive:true});
await mkdir(path.join(root,'public/models'),{recursive:true});
await mkdir(path.join(root,'licenses'),{recursive:true});
await copyFile(path.join(pkg,'vision_bundle.js'),path.join(root,'public/vendor/vision_bundle.js'));
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm'])await copyFile(path.join(pkg,'wasm',name),path.join(root,'public/vendor/wasm',name));
for(const name of ['LICENSE','NOTICE']){try{await copyFile(path.join(pkg,name),path.join(root,'licenses',`mediapipe-${name}`));}catch{}}
const sources=[
 ['pose_landmarker_lite.task','https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'],
 ['face_landmarker.task','https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task']
];
const record=[];
for(const [name,url] of sources){
 const dst=path.join(root,'public/models',name);let bytes;
 try{bytes=await readFile(dst);if(bytes.length<1_000_000)throw Error('small');}catch{const res=await fetch(url);if(!res.ok)throw Error(`${name}: HTTP ${res.status}`);bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<1_000_000)throw Error('모델 다운로드 크기가 비정상입니다.');await writeFile(dst,bytes);}
 record.push({file:`models/${name}`,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const meta=JSON.parse(await readFile(path.join(pkg,'package.json'),'utf8'));
await writeFile(path.join(root,'licenses/models-and-vendor.json'),JSON.stringify({package:'@mediapipe/tasks-vision',version:meta.version,downloadedAt:new Date().toISOString(),models:record},null,2));
console.log(JSON.stringify({version:meta.version,models:record.map(({file,bytes})=>({file,bytes})),note:'실행 중 CDN에 접속하지 않습니다.'}));
