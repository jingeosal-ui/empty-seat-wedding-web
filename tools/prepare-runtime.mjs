import {createHash} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const version='v26.13.1',expected='f5109dc868ec38703ad8f305e0aceece717cb60d4889873f434017af4e96cccb';
const base=`https://nodejs.org/dist/${version}/`,folder=path.join(root,'runtime/node-win-x64');
await mkdir(folder,{recursive:true});
const manifestResponse=await fetch(base+'SHASUMS256.txt');if(!manifestResponse.ok)throw Error('공식 체크섬 다운로드 실패');
const manifest=await manifestResponse.text(),line=manifest.split(/\r?\n/).find(x=>x.endsWith('  win-x64/node.exe'));
if(!line||line.slice(0,64)!==expected)throw Error('고정된 공식 Node 체크섬과 일치하지 않습니다.');
const destination=path.join(folder,'node.exe');
async function hash(file){const sha=createHash('sha256');for await(const b of createReadStream(file))sha.update(b);return sha.digest('hex');}
let valid=false;try{valid=await hash(destination)===expected;}catch{}
if(!valid){
 const response=await fetch(base+'win-x64/node.exe');if(!response.ok)throw Error(`Node 다운로드 HTTP ${response.status}`);
 const temporary=path.join(folder,`node-${process.pid}.download`),sha=createHash('sha256');
 try{await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,callback){sha.update(chunk);callback(null,chunk);}}),createWriteStream(temporary,{flags:'wx'}));if(sha.digest('hex')!==expected)throw Error('Node 실행 파일 해시 불일치');await rename(temporary,destination);}finally{await rm(temporary,{force:true});}
}
const licenseURL=`https://raw.githubusercontent.com/nodejs/node/${version}/LICENSE`,licenseResponse=await fetch(licenseURL);
if(!licenseResponse.ok)throw Error('Node 라이선스 다운로드 실패');const license=await licenseResponse.text();if(!license.includes('Permission is hereby granted'))throw Error('라이선스 내용 확인 실패');
await writeFile(path.join(folder,'LICENSE.txt'),license);
await writeFile(path.join(folder,'SHASUMS256.txt'),manifest);
const {size}=await import('node:fs/promises').then(fs=>fs.stat(destination));
const record={version,platform:'win32',arch:'x64',binary:'node.exe',bytes:size,sha256:expected,binaryURL:base+'win-x64/node.exe',checksumsURL:base+'SHASUMS256.txt',licenseURL,preparedAt:new Date().toISOString(),note:'npm·설치 프로그램 없이 공식 실행 파일과 전체 라이선스만 동봉'};
await writeFile(path.join(folder,'runtime.json'),JSON.stringify(record,null,2));
await writeFile(path.join(root,'licenses/node-runtime.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify({version,bytes:size,sha256:expected,reused:valid}));
