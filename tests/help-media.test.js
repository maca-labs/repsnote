import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, readFile, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {preparePages} from '../scripts/prepare-pages.mjs';

const dist=fileURLToPath(new URL('../dist/',import.meta.url));

test('the local video server handles mobile metadata probes and seeks', {timeout:20000}, async t=>{
  const server=spawn(process.execPath,[fileURLToPath(new URL('../scripts/serve.mjs',import.meta.url))],{
    env:{...process.env,REPNOTE_PORT:'0'},stdio:['ignore','pipe','inherit'],
  });
  t.after(()=>server.kill());
  const [output]=await once(server.stdout,'data');
  const origin=new URL(output.toString().match(/http:\/\/127\.0\.0\.1:\d+\//)[0]);
  const url=new URL('help/workout.mp4',origin);
  const bytes=await readFile(path.join(dist,'help/workout.mp4'));
  const head=await fetch(url,{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-type'),'video/mp4');
  assert.equal(head.headers.get('accept-ranges'),'bytes');
  assert.equal(Number(head.headers.get('content-length')),bytes.length);
  for(const [range,start,end] of [['0-1',0,1],['100-110',100,110],['-16',bytes.length-16,bytes.length-1]]){
    const response=await fetch(url,{headers:{Range:'bytes='+range}});
    assert.equal(response.status,206);
    assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end+1));
  }
  const missing=await fetch(url,{headers:{Range:`bytes=${bytes.length}-`}});
  assert.equal(missing.status,416);
  assert.equal(missing.headers.get('content-range'),`bytes */${bytes.length}`);
  const poster=await fetch(new URL('help/workout.jpg',origin),{method:'HEAD'});
  assert.equal(poster.status,200);
  assert.equal(poster.headers.get('content-type'),'image/jpeg');
});

test('each Pages release keeps the guide media URLs used by already-open tabs', async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'reps-note-guide-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const oldRevision='b'.repeat(40), newRevision='c'.repeat(40);
  for(const revision of [oldRevision,newRevision]){
    const output=path.join(root,revision);
    await preparePages(dist,output,revision);
    const shell=path.join(output,'releases',revision);
    assert.ok((await stat(path.join(shell,'help.js'))).isFile());
    await assert.rejects(stat(path.join(shell,'help')),{code:'ENOENT'});
    for(const name of ['workout','food','body','history','records']){
      for(const ext of ['.mp4','.jpg']){
        const relative=path.join('help',name+ext);
        assert.equal((await stat(path.join(output,relative))).size,(await stat(path.join(dist,relative))).size);
      }
    }
  }
  await assert.rejects(stat(path.join(root,newRevision,'releases',oldRevision)),{code:'ENOENT'});
});
