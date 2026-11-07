import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {importMetaHarnessSessionFile} from '../src/metaharness-file.js';
import {createMetaHarnessAdapter} from '../src/metaharness.js';
import {createActivityRecorder} from '../src/activity.js';

const fixtures=[
 {index:0,branch:'main',kind:'note',payload:{text:'private prompt'}},
 {index:1,branch:'main',kind:'app.agent.status',payload:{agentId:'a1',status:'idle',secret:'private secret'}},
 {index:0,branch:'fork1',parent:{branch:'main',index:1},kind:'fork',payload:null},
 {index:1,branch:'fork1',kind:'app.agent.status',payload:{agentId:'a1',status:'busy'}}
];

test('imports a native-shaped session, including forks, with explicit mapping and sanitized recording',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mouse-metaharness-'));const path=join(dir,'session.jsonl');
 try{
  await writeFile(path,fixtures.map(e=>JSON.stringify(e)).join('\n')+'\n');
  const recorder=createActivityRecorder();const adapter=createMetaHarnessAdapter({sourceId:'test',clock:()=>7,record:recorder.record,mapEvent:e=>e.kind==='app.agent.status'?{type:'agent.upsert',id:e.payload.agentId,status:e.payload.status}:null});
  assert.deepEqual(await importMetaHarnessSessionFile({path,adapter}),{records:4,accepted:2,ignored:2});
  const snapshot=JSON.stringify(recorder.snapshot());assert.ok(snapshot.includes('test:main:1'));assert.ok(snapshot.includes('test:fork1:1'));assert.equal(snapshot.includes('private'),false);assert.equal(snapshot.includes('secret'),false);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('validates all input before mapping and rejects partial, malformed, oversized or out of order files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mouse-metaharness-'));const path=join(dir,'session.jsonl');let calls=0;const adapter={ingest:()=>{calls++;return true}};
 try{
  await writeFile(path,JSON.stringify(fixtures[0])+'\n{broken}\n');await assert.rejects(importMetaHarnessSessionFile({path,adapter}),/invalid session JSON/);assert.equal(calls,0);
  await writeFile(path,JSON.stringify(fixtures[0]));await assert.rejects(importMetaHarnessSessionFile({path,adapter}),/incomplete line/);assert.equal(calls,0);
  await writeFile(path,fixtures.map(e=>JSON.stringify(e)).join('\n')+'\n');await assert.rejects(importMetaHarnessSessionFile({path,adapter,maxBytes:10}),/byte limit/);await assert.rejects(importMetaHarnessSessionFile({path,adapter,maxEvents:1}),/event limit/);
  await writeFile(path,JSON.stringify(fixtures[1])+'\n');await assert.rejects(importMetaHarnessSessionFile({path,adapter}),/session index/);
  await writeFile(path,Buffer.from([0xff,0x0a]));await assert.rejects(importMetaHarnessSessionFile({path,adapter}),/UTF-8/);
  await writeFile(path,'{"index":0,"branch":"main","kind":"note","payload":"\\ud800"}\n');await assert.rejects(importMetaHarnessSessionFile({path,adapter}),/Unicode/);
  assert.equal(calls,0);
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('rejects missing fork parents and does not follow a symlink on supported platforms',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mouse-metaharness-'));const path=join(dir,'session.jsonl');const link=join(dir,'session-link');
 try{
  await writeFile(path,JSON.stringify(fixtures[0])+'\n'+JSON.stringify({...fixtures[2],parent:{branch:'main',index:9}})+'\n');
  await assert.rejects(importMetaHarnessSessionFile({path,adapter:{ingest:()=>true}}),/missing session parent/);
  if(process.platform!=='win32'){await symlink(path,link);await assert.rejects(importMetaHarnessSessionFile({path:link,adapter:{ingest:()=>true}}))}
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('mapping failures leave previous events committed and do not expose input in reader errors',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mouse-metaharness-'));const path=join(dir,'session.jsonl');let seen=0;
 try{
  await writeFile(path,fixtures.slice(0,2).map(e=>JSON.stringify(e)).join('\n')+'\n');
  await assert.rejects(importMetaHarnessSessionFile({path,adapter:{ingest:()=>{if(++seen===2)throw Error('mapper failed');return true}}}),/mapper failed/);assert.equal(seen,2);
 }finally{await rm(dir,{recursive:true,force:true})}
});
