import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const assets=JSON.parse(await readFile(path.join(root,'licenses/pages-assets.json'),'utf8'));
for(const a of assets){
 const file=path.join(root,'public',a.path);
 let bytes;try{bytes=await readFile(file);}catch{}
 if(!bytes){const r=await fetch(a.url);if(!r.ok)throw Error(`${a.path}: HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes);}
 if(bytes.length!==a.bytes||createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw Error(`고정 리소스 해시 불일치: ${a.path}`);
}
await mkdir(path.join(root,'_site'),{recursive:true});
await cp(path.join(root,'public'),path.join(root,'_site'),{recursive:true});
await cp(path.join(root,'licenses'),path.join(root,'_site','licenses'),{recursive:true});
await writeFile(path.join(root,'_site','.nojekyll'),'');
console.log('GitHub Pages 정적 파일과 로컬 AI 모델 준비 완료');
