import test from 'node:test';
import assert from 'node:assert/strict';
import {createActivityRecorder,validateActivityRecording,replayActivity,createActivityPlayer} from '../src/activity.js';
const source={kind:'ruflo',mode:'snapshot',reference:'local-project'};
const agent=(id,status='idle')=>({type:'agent.upsert',id,role:'coder',status});

test('records only minimal data and immutable source provenance',()=>{
 const r=createActivityRecorder();r.record({observedAt:10,source,event:{...agent('a'),label:'private',secret:'secret',position:{x:.2,y:.3}}});
 const s=r.snapshot();assert.deepEqual(s.events[0],{sequence:0,observedAt:10,source,event:agent('a')});assert.ok(Object.isFrozen(s.events[0].event));assert.equal(JSON.stringify(s).includes('secret'),false);r.dispose();assert.throws(()=>r.snapshot(),/disposed/);
});

test('derives complete snapshot observations without inventing unseen transitions',()=>{
 const r=createActivityRecorder();
 assert.equal(r.recordSnapshot({observedAt:100,source,events:[agent('a'),agent('b')]}).length,2);
 assert.equal(r.recordSnapshot({observedAt:200,source,events:[agent('a'),agent('b')]}).length,0);
 const updates=r.recordSnapshot({observedAt:300,source,events:[agent('a','busy'),agent('c')]});
 assert.deepEqual(updates.map(x=>x.event),[agent('a','busy'),agent('c'),{type:'agent.remove',id:'b'}]);
 assert.equal(updates.every(x=>x.observedAt===300&&x.source.mode==='snapshot'),true);
 assert.throws(()=>r.recordSnapshot({observedAt:299,source,events:[]}),/order/);
});

test('malformed or oversized snapshots do not change recording or baseline',()=>{
 const r=createActivityRecorder({maxEvents:2});r.recordSnapshot({observedAt:1,source,events:[agent('a')]});
 const before=r.snapshot();assert.throws(()=>r.recordSnapshot({observedAt:2,source,events:[agent('b'),agent('c')]}),/capacity/);assert.deepEqual(r.snapshot(),before);
 assert.throws(()=>r.recordSnapshot({observedAt:2,source,events:[agent('a'),agent('a')]}),/duplicate/);assert.deepEqual(r.snapshot(),before);
 const changed=r.recordSnapshot({observedAt:3,source,events:[agent('a','busy')]});assert.equal(changed.length,1);
});

test('rejects invalid imports, sequence, timestamps, identifiers, and revisions',()=>{
 const r=createActivityRecorder({maxEvents:1});assert.throws(()=>r.record({source,observedAt:-1,event:agent('a')}),/observedAt/);assert.throws(()=>r.record({source,observedAt:1,event:agent('<bad>')}),/identifier/);
 r.record({source,observedAt:1,event:agent('a')});assert.throws(()=>r.record({source,observedAt:2,event:agent('b')}),/capacity/);
 assert.throws(()=>validateActivityRecording({version:1,events:[{sequence:7,source,observedAt:1,event:agent('a')}]}),/sequence/);
 assert.throws(()=>validateActivityRecording({version:1,events:[{sequence:0,source,observedAt:2,event:agent('a')},{sequence:1,source,observedAt:1,event:agent('b')}]}),/order/);
});

test('replay rebuilds identical prefixes in capture order',()=>{
 const r=createActivityRecorder();r.recordSnapshot({source,observedAt:1,events:[agent('a'),agent('b')]});r.recordSnapshot({source,observedAt:2,events:[agent('a','busy')]});
 const state=new Map(),reset=()=>state.clear(),apply=x=>{if(x.event.type==='agent.remove')state.delete(x.event.id);else state.set(x.event.id,x.event.status)};
 replayActivity(r.snapshot(),{reset,apply,through:2});assert.deepEqual([...state],[['a','idle'],['b','idle']]);
 replayActivity(r.snapshot(),{reset,apply});assert.deepEqual([...state],[['a','busy']]);
 replayActivity(r.snapshot(),{reset,apply});assert.deepEqual([...state],[['a','busy']]);
});

test('player preserves recorded delays and supports pause, seek and teardown',()=>{
 const r=createActivityRecorder();r.record({source,observedAt:100,event:agent('a')});r.record({source,observedAt:350,event:agent('b')});
 const timers=new Map(),delays=[],applied=[];let serial=0,resets=0;
 const p=createActivityPlayer({recording:r.snapshot(),reset:()=>{resets++;applied.length=0},apply:e=>applied.push(e.event.id),setTimer:(fn,ms)=>{const id=++serial;timers.set(id,fn);delays.push(ms);return id},clearTimer:id=>timers.delete(id)});
 p.play();assert.equal(resets,1);assert.equal(delays[0],0);let [id,fn]=timers.entries().next().value;timers.delete(id);fn();assert.deepEqual(applied,['a']);assert.equal(delays[1],250);
 p.pause();assert.equal(timers.size,0);p.seek(0);assert.deepEqual(applied,[]);p.seek(2);assert.deepEqual(applied,['a','b']);assert.equal(p.getState().state,'complete');p.destroy();assert.throws(()=>p.play(),/destroyed/);
});

test('pause and resume preserve the remaining interval',()=>{
 const r=createActivityRecorder();r.record({source,observedAt:100,event:agent('a')});r.record({source,observedAt:350,event:agent('b')});
 let clock=0,sequence=0;const timers=new Map(),delays=[];
 const p=createActivityPlayer({recording:r.snapshot(),reset:()=>{},apply:()=>{},now:()=>clock,setTimer:(fn,ms)=>{const id=++sequence;timers.set(id,fn);delays.push(ms);return id},clearTimer:id=>timers.delete(id)});
 p.play();let [id,fn]=timers.entries().next().value;timers.delete(id);fn();clock=100;p.pause();p.play();assert.equal(delays.at(-1),150);p.destroy();
});

test('long recording gaps are chunked instead of overflowing timers',()=>{
 const r=createActivityRecorder();r.record({source,observedAt:1,event:agent('a')});r.record({source,observedAt:2147483658,event:agent('b')});
 const timers=new Map(),delays=[],applied=[];let sequence=0;
 const p=createActivityPlayer({recording:r.snapshot(),reset:()=>{},apply:e=>applied.push(e.event.id),setTimer:(fn,ms)=>{const id=++sequence;timers.set(id,fn);delays.push(ms);return id},clearTimer:id=>timers.delete(id)});
 p.play();let [id,fn]=timers.entries().next().value;timers.delete(id);fn();assert.equal(delays.at(-1),2147483647);[id,fn]=timers.entries().next().value;timers.delete(id);fn();assert.equal(delays.at(-1),10);assert.deepEqual(applied,['a']);p.destroy();
});
