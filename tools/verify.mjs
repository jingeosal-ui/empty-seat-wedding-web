import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const record=JSON.parse(await readFile(path.join(root,'licenses/models-and-vendor.json'),'utf8'));
let bytes=0,files=0;
for(const m of record.models){const b=await readFile(path.join(root,'public',m.file));if(sha(b)!==m.sha256)throw Error(`모델 해시 불일치: ${m.file}`);}
const manifest=JSON.parse(await readFile(path.join(root,'public/assets/characters/manifest.json'),'utf8'));
for(const [name,a] of Object.entries(manifest.actors)){const b=await readFile(path.join(root,'public',a.body));if(sha(b)!==a.webpHash)throw Error(`승인 전신 해시 불일치: ${name}`);}
let film=null;try{film=JSON.parse(await readFile(path.join(root,'public/assets/film/manifest.json'),'utf8'));}catch{}
if(film)for(const [actor,a] of Object.entries(film.actors))for(const kind of ['walk','reveal','poster']){const b=await readFile(path.join(root,'public',a[kind]));if(sha(b)!==a.files[kind].sha256)throw Error(`실사 영상/이미지 해시 불일치: ${actor}/${kind}`);}
for(const p of ['vendor/vision_bundle.js','vendor/wasm/vision_wasm_internal.js','vendor/wasm/vision_wasm_internal.wasm','index.html','vision-worker.js'])await stat(path.join(root,'public',p));
async function walk(dir){for(const n of await readdir(dir)){const p=path.join(dir,n),s=await stat(p);if(s.isDirectory())await walk(p);else{bytes+=s.size;files++;if(/\.(?:mjs|js|html|css)$/.test(n)&&!p.includes(`${path.sep}vendor${path.sep}`)){const code=await readFile(p,'utf8');if(/(?:src|href)=["']https?:\/\//.test(code)||/(?:importScripts|fetch)\(["']https?:\/\//.test(code))throw Error(`외부 런타임 요청: ${p}`);}}}}
await walk(path.join(root,'public'));
await mkdir(path.join(root,'docs'),{recursive:true});
const result={createdAt:new Date().toISOString(),pass:true,models:record.models.length,characters:Object.keys(manifest.actors),publicFiles:files,publicBytes:bytes,physicalCameraTest:false,artStatus:film?.artStatus||manifest.artStatus,filmHashesVerified:film?6:0};
await writeFile(path.join(root,'docs/resource-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
