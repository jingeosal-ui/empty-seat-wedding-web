import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.EXHIBITION_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('포트 번호는 1024~65535 범위여야 합니다.');
const types = { '.html':'text/html; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8', '.wasm':'application/wasm', '.task':'application/octet-stream', '.webp':'image/webp', '.png':'image/png', '.svg':'image/svg+xml', '.webm':'video/webm', '.mp4':'video/mp4', '.ico':'image/x-icon' };
const server = http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const raw = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    const name = path.resolve(root, '.' + (raw === '/' ? '/index.html' : raw));
    if (!name.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const info = await stat(name); if (!info.isFile()) throw Error('not-file');
    const headers = {
      'Content-Type':types[path.extname(name)] || 'application/octet-stream',
      'Cache-Control':path.extname(name)==='.html'?'no-store':'no-cache',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'Permissions-Policy':'camera=(self), microphone=()',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'Accept-Ranges':'bytes'
    };
    let start=0,end=info.size-1,status=200;
    if(req.headers.range){
      const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!m || (!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      if(!m[1]) start=Math.max(0,info.size-Number(m[2]));
      else {start=Number(m[1]); if(m[2])end=Math.min(end,Number(m[2]));}
      if(start>end || start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=end-start+1;
    res.writeHead(status,headers); if(req.method==='HEAD')res.end();else createReadStream(name,{start,end}).pipe(res);
  } catch { res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('파일을 찾을 수 없습니다.'); }
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`포트 ${port}가 이미 사용 중입니다. 기존 전시 창을 확인하거나 EXHIBITION_PORT를 변경하세요.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
  const url=`http://localhost:${port}/`;
  console.log(`빈자리의 혼례 C · ${url}\n종료: 이 창에서 Ctrl+C. 서버는 이 컴퓨터에서만 접속됩니다.`);
  if(process.argv.includes('--open')){
    const choices=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Google','Chrome','Application','chrome.exe'));
    const chrome=choices.find(existsSync);
    if(chrome){const child=spawn(chrome,['--new-window',url],{detached:true,stdio:'ignore'});child.unref();}
    else console.log('Chrome을 찾지 못했습니다. Chrome 주소창에 위 localhost 주소를 입력하세요.');
  }
});
