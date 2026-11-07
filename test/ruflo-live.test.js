import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createActivityRecorder,createActivityPlayer,validateActivityRecording} from '../src/activity.js';

test('observation pauses for BFCache and resumes once on restoration', async () => {
  const source=readFileSync(new URL('../examples/ruflo-live.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const handlers={},states=[],timers=new Map();let nextTimer=0,fetches=0,replacements=0,destroyed=0,disposed=0;
  const nodes=new Map();
  const getNode=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,addEventListener(type,fn){this[type]=fn},replaceChildren(){},append(){}});return nodes.get(id)};
  const context={
    document:{getElementById:getNode,createElement:()=>({})},
    createActivityRecorder,createActivityPlayer,validateActivityRecording,
    createRufloSwarmAdapter:()=>({replaceAgents:()=>{replacements++},dispose:()=>{disposed++}}),
    createRufloSwarmView:()=>({setSourceState:s=>states.push(s),destroy:()=>{destroyed++}}),
    addEventListener:(type,fn)=>{handlers[type]=fn},AbortController,
    fetch:async()=>{fetches++;return {ok:true,json:async()=>({events:[]})}},
    setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id},
    clearTimeout:id=>timers.delete(id),
  };
  vm.runInNewContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fetches,1);assert.equal(replacements,1);assert.equal(timers.size,1);
  handlers.pagehide({persisted:true});
  assert.equal(timers.size,0);assert.equal(states.at(-1),'disconnected');assert.equal(destroyed,0);
  handlers.pageshow({persisted:true});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fetches,2);assert.equal(replacements,2);assert.equal(timers.size,1);
  handlers.pagehide({persisted:false});
  assert.equal(destroyed,1);assert.equal(disposed,1);assert.equal(timers.size,0);
});

test('records a successful snapshot and replays its observed change', async()=>{
  const source=readFileSync(new URL('../examples/ruflo-live.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const handlers={},nodes=new Map(),timers=new Map(),applied=[];let nextTimer=0,fetchCount=0;
  const getNode=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,children:[],addEventListener(type,fn){this[type]=fn},replaceChildren(){this.children=[]},append(child){this.children.push(child)}});return nodes.get(id)};
  const context={document:{getElementById:getNode,createElement:()=>({})},createActivityRecorder,validateActivityRecording,createActivityPlayer:options=>createActivityPlayer({...options,setTimer:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimer:id=>timers.delete(id)}),
    createRufloSwarmAdapter:()=>({replaceAgents(){},ingest:event=>applied.push(event),dispose(){}}),
    createRufloSwarmView:()=>({setSourceState(){},destroy(){}}),addEventListener:(type,fn)=>{handlers[type]=fn},AbortController,Date,
    fetch:async()=>({ok:true,json:async()=>({events:++fetchCount===1?[]:[{type:'agent.upsert',id:'agent1',status:'idle'}]})}),
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
  getNode('record').click();
  const scheduled=[...timers].find(([,t])=>t.ms===2500);assert.ok(scheduled);timers.delete(scheduled[0]);scheduled[1].fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(getNode('record-state').textContent,/1 observed changes/);getNode('record').click();
  getNode('replay').click();const replay=[...timers].find(([,t])=>t.ms===0);assert.ok(replay);timers.delete(replay[0]);replay[1].fn();
  assert.equal(applied.length,1);assert.equal(applied[0].id,'agent1');assert.match(getNode('events').children[0].textContent,/ruflo snapshot/);
  const recording={version:1,events:[{sequence:0,observedAt:123,source:{kind:'ruflo',mode:'snapshot',reference:'test'},event:{type:'agent.upsert',id:'loaded',status:'idle'}}]};
  await getNode('load').change({target:{files:[{size:200,text:async()=>JSON.stringify(recording)}]}});
  assert.match(getNode('record-state').textContent,/Loaded 1 observations/);
  await getNode('load').change({target:{files:[{size:2*1024*1024+1}]}});
  assert.match(getNode('record-state').textContent,/Could not load/);
  handlers.pagehide({persisted:false});
});
