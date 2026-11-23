import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.REPNOTE_PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4'};

function requestedRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/i.exec(header ?? '');
  if(!match||(!match[1]&&!match[2]))return null;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
  return {start,end};
}

const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let filename=path.resolve(root,'.'+requested);
    if(filename!==root.slice(0,-1)&&!filename.startsWith(root)){res.writeHead(403);res.end();return;}
    let info=await stat(filename);
    if(info.isDirectory()){
      filename=path.join(filename,'index.html');
      info=await stat(filename);
    }
    const headers={'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
    // This server supplies no validators, so an If-Range request gets the whole current file.
    const range=req.method==='GET' && !req.headers['if-range'] && requestedRange(req.headers.range,info.size);
    if(range && range.start>range.end){
      res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`,'Content-Length':0});
      res.end();
      return;
    }
    if(range)headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
    headers['Content-Length']=range?range.end-range.start+1:info.size;
    res.writeHead(range?206:200,headers);
    if(req.method==='HEAD'){res.end();return;}
    await pipeline(createReadStream(filename,range || {}),res);
  }catch{
    if(!res.headersSent && !res.destroyed){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
  }
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`REPS NOTE: http://127.0.0.1:${server.address().port}/\n`));
