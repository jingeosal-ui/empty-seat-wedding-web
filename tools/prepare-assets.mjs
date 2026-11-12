import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
await mkdir(path.join(root,'public/assets/characters'),{recursive:true});
await mkdir(path.join(root,'docs'),{recursive:true});
const specs=[
 {id:'songaksi',name:'손각시',crop:{left:15,top:0,width:485,height:1024},cover:{top:.065,height:.125,width:.76,drop:.34},headPivot:.19},
 {id:'mongdal',name:'몽달귀신',crop:{left:0,top:0,width:455,height:1024},cover:{top:.09,height:.13,width:.8,drop:.33},headPivot:.22}
];
const manifest={version:1,approvedOn:'2026-11-12',artStatus:'layer-preview',note:'승인된 시트의 정면 전신만 추출. 손·팔 가리개 내림 실사 영상 미등록. 원본 외형 재생성 없음.',actors:{}};
for(const s of specs){
 const source=path.join(root,'sources/approved',`${s.id}-sheet.png`),original=await readFile(source);
 const cropped=await sharp(original).extract(s.crop).png().toBuffer();
 const trimmed=await sharp(cropped).trim({background:'#00000000',threshold:8}).png().toBuffer();
 const {data,info}=await sharp(trimmed).resize({height:1024,withoutEnlargement:true}).webp({quality:94,alphaQuality:100,effort:6}).toBuffer({resolveWithObject:true});
 await writeFile(path.join(root,'public/assets/characters',`${s.id}.webp`),data);
 manifest.actors[s.id]={name:s.name,body:`/assets/characters/${s.id}.webp`,width:info.width,height:info.height,cover:s.cover,headPivot:s.headPivot,revealVideo:null,sourceHash:createHash('sha256').update(original).digest('hex'),webpHash:createHash('sha256').update(data).digest('hex'),sourceCrop:s.crop,bytes:data.length};
}
await writeFile(path.join(root,'public/assets/characters/manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(path.join(root,'docs/ASSET_REVIEW.md'),'# 승인 에셋 분리\n\n첨부한 D:/굿굿의 승인 원본 두 장을 sources/approved에 그대로 보존했다. 정면 전신 영역만 Sharp로 결정적으로 잘라 투명 WebP로 저장했다. 얼굴·의상 재생성이나 화풍 변경 없음. 원본 해시는 manifest.json에 기록.\n\n중요: 원본 손각시는 손을 앞에 모으고 몽달은 팔을 내린 자세이다. 가리개를 양손으로 들었다가 내리는 자세·동영상은 제공되지 않았다. 현재 가리개와 미세 고개 움직임은 같은 원본을 쓰는 레이어 시안이며, 실제 양손 동작과 눈동자 시선 이동을 완성한 것으로 간주하지 않는다. 자연스러운 실사 팔·손 검수는 보류. 승인 캐릭터를 그대로 촬영/애니메이션한 투명 WebM을 캐릭터 설정에서 연결할 수 있다. 공개 전시는 그 구간의 교체 영상 검수가 필요하다.\n');
console.log(JSON.stringify(manifest));
