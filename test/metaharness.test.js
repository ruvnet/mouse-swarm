import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaHarnessAdapter} from '../src/metaharness.js';
const record=(index,branch='main',payload={})=>({index,branch,kind:'tool',payload});

test('projects host-mapped MetaHarness envelope with provenance and no raw payload',()=>{
 const output=[];const adapter=createMetaHarnessAdapter({sourceId:'session1',clock:()=>1234,mapEvent:e=>({type:'agent.upsert',id:e.payload.agentId,role:'coder',status:'busy'}),record:e=>output.push(e)});
 assert.equal(adapter.ingest(record(0,'main',{agentId:'a1',prompt:'private-data'})),true);
 assert.deepEqual(output,[{source:{kind:'metaharness',mode:'event',reference:'session1:main:0'},observedAt:1234,event:{type:'agent.upsert',id:'a1',role:'coder',status:'busy'}}]);
 assert.equal(JSON.stringify(output).includes('private-data'),false);
});

test('requires host mapping and does not infer agents from native kinds',()=>{
 assert.throws(()=>createMetaHarnessAdapter({sourceId:'x',record:()=>{}}),/mapEvent/);
 const out=[];const adapter=createMetaHarnessAdapter({sourceId:'x',mapEvent:()=>null,record:e=>out.push(e)});
 assert.equal(adapter.ingest(record(0)),false);assert.deepEqual(out,[]);
});

test('enforces ordered branch indexes and branch limits',()=>{
 const out=[];const adapter=createMetaHarnessAdapter({sourceId:'x',maxBranches:1,mapEvent:()=>({type:'agent.remove',id:'a'}),record:e=>out.push(e),clock:()=>1});
 assert.equal(adapter.ingest(record(5)),true);assert.equal(adapter.ingest(record(5)),false);assert.equal(adapter.ingest(record(4)),false);
 assert.throws(()=>adapter.ingest(record(0,'other')),/capacity/);assert.equal(out.length,1);
 adapter.dispose();assert.throws(()=>adapter.ingest(record(6)),/disposed/);
});

test('rejects unsupported fields, unsafe identifiers and invalid source data',()=>{
 let mapped={type:'agent.upsert',id:'a',label:'private'};const adapter=createMetaHarnessAdapter({sourceId:'x',mapEvent:()=>mapped,record:()=>{}});
 assert.throws(()=>adapter.ingest(record(0)),/unsupported/);
 mapped={type:'agent.upsert',status:'idle'};assert.throws(()=>adapter.ingest(record(0)),/invalid mapped/);
 mapped={type:'task.update',id:'a',status:'completed'};assert.throws(()=>adapter.ingest(record(0)),/invalid task/);
 assert.throws(()=>adapter.ingest(record(0,'invalid branch')),/envelope/);
 assert.throws(()=>createMetaHarnessAdapter({sourceId:'../../x',mapEvent:()=>null,record:()=>{}}),/sourceId/);
});

test('does not advance the branch when recording fails',()=>{
 let fail=true;const out=[];const adapter=createMetaHarnessAdapter({sourceId:'x',mapEvent:()=>({type:'agent.remove',id:'a'}),record:e=>{if(fail)throw Error('full');out.push(e)},clock:()=>1});
 assert.throws(()=>adapter.ingest(record(0)),/full/);fail=false;assert.equal(adapter.ingest(record(0)),true);assert.equal(out.length,1);
});

test('connects to activity recorder without storing source payload',async()=>{
 const {createActivityRecorder}=await import('../src/activity.js');const recorder=createActivityRecorder();
 const adapter=createMetaHarnessAdapter({sourceId:'kernel',clock:()=>42,record:recorder.record,mapEvent:e=>e.kind==='turn'?{type:'agent.upsert',id:'agent1',status:'busy'}:null});
 adapter.ingest({index:0,branch:'main',kind:'turn',payload:{prompt:'private',token:'secret'}});
 const data=recorder.snapshot();assert.equal(data.events.length,1);assert.equal(data.events[0].source.reference,'kernel:main:0');assert.equal(data.events[0].observedAt,42);assert.equal(data.events[0].event.status,'busy');assert.equal(JSON.stringify(data).includes('private'),false);assert.equal(JSON.stringify(data).includes('secret'),false);
});
