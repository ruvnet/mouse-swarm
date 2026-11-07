import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRufloSwarmAdapter } from '../src/ruflo.js';

test('projects observed agent and task updates and notifies subscribers',()=>{
  const adapter=createRufloSwarmAdapter(),views=[];const unsub=adapter.subscribe(view=>views.push(view));
  assert.deepEqual(views[0],{version:0,agents:[]});
  assert.equal(adapter.ingest({type:'agent.upsert',id:'agent-1',label:'Researcher',role:'researcher',status:'busy',position:{x:.25,y:.5},revision:1}),true);
  assert.equal(adapter.ingest({type:'task.update',id:'agent-1',taskId:'task-1',title:'Analyze',status:'claimed',revision:2}),true);
  assert.deepEqual(adapter.snapshot(),{version:2,agents:[{id:'agent-1',label:'Researcher',role:'researcher',status:'busy',position:null,task:{id:'task-1',title:'Analyze',status:'claimed'},revision:2}]});
  assert.equal(views.length,3);unsub();adapter.remove('agent-1');assert.equal(views.length,3);adapter.dispose();
});

test('does not invent agents, tasks, positions, or raw details',()=>{
  const a=createRufloSwarmAdapter();assert.equal(a.ingest({type:'task.update',id:'unknown',taskId:'t',status:'open'}),false);
  a.ingest({type:'agent.upsert',id:'a',status:'idle'});assert.deepEqual(a.snapshot().agents[0],{id:'a',label:'Agent',role:'',status:'idle',position:null,task:null});
  a.ingest({type:'agent.upsert',id:'a',status:'terminated'});assert.equal(a.snapshot().agents[0].status,'terminated');
  assert.throws(()=>a.ingest({type:'agent.upsert',id:'a',secret:'never store this'}),/unsupported fields/);
  assert.throws(()=>a.ingest({type:'task.update',id:'a',taskId:'t',status:'claimed',body:'private task details'}),/unsupported fields/);
});

test('sanitizes labels and bounds strings and positions',()=>{
  const a=createRufloSwarmAdapter();const location={x:.2,y:.9};
  a.ingest({type:'agent.upsert',id:'a',label:'<img>\u202e'+'x'.repeat(100),role:'\u0000reviewer',position:location});location.x=.8;
  const agent=a.snapshot().agents[0];assert.equal(Array.from(agent.label).length,80);assert.ok(!agent.label.includes('<'));assert.ok(!agent.label.includes('>'));assert.ok(!agent.label.includes('\u202e'));assert.equal(agent.role,'reviewer');assert.equal(agent.position.x,.2);
  for(const p of [{x:NaN,y:0},{x:-.1,y:0},{x:0,y:1.1},{x:0,y:0,extra:1}])assert.throws(()=>a.ingest({type:'agent.upsert',id:'a',position:p}),/position/);
  assert.throws(()=>a.ingest({type:'agent.upsert',id:'a',label:'x'.repeat(8193)}),/too long/);assert.equal(a.snapshot().version,1);
  a.ingest({type:'agent.upsert',id:'a',position:null});assert.equal(a.snapshot().agents[0].position,null);
});

test('rejects stale and unversioned events after a per-agent revision',()=>{
  const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'a',status:'idle',revision:3});
  assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'busy',revision:2}),false);
  assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'busy',revision:3}),false);
  assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'busy'}),false);
  assert.equal(a.ingest({type:'agent.remove',id:'a',revision:2}),false);
  assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'busy',revision:4}),true);
  assert.equal(a.snapshot().agents[0].status,'busy');
});

test('rejects malformed inputs, bounds agents and leaves prior state intact',()=>{
  assert.throws(()=>createRufloSwarmAdapter({maxAgents:0}),RangeError);assert.throws(()=>createRufloSwarmAdapter({maxAgents:257}),RangeError);
  const a=createRufloSwarmAdapter({maxAgents:1});a.ingest({type:'agent.upsert',id:'a'});
  assert.throws(()=>a.ingest({type:'agent.upsert',id:'b'}),/capacity/);
  assert.throws(()=>a.ingest({type:'agent.upsert',id:'<bad>'}),/identifier/);
  assert.throws(()=>a.ingest({type:'agent.upsert',id:'a',status:'made-up'}),/unsupported agent status/);
  assert.throws(()=>a.ingest({type:'task.update',id:'a',taskId:'t',status:'made-up'}),/unsupported task status/);
  assert.throws(()=>a.ingest(JSON.parse('{"type":"agent.upsert","id":"a","__proto__":{"polluted":true}}')),/unsupported fields/);
  assert.equal(a.snapshot().version,1);assert.equal({}.polluted,undefined);
});

test('snapshots are immutable and remain stable after later updates',()=>{
  const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'a',position:{x:.5,y:.4}});const prior=a.snapshot();
  assert.ok(Object.isFrozen(prior));assert.ok(Object.isFrozen(prior.agents));assert.ok(Object.isFrozen(prior.agents[0]));assert.ok(Object.isFrozen(prior.agents[0].position));
  a.ingest({type:'agent.upsert',id:'a',status:'busy'});assert.equal(prior.agents[0].status,'unknown');assert.equal(a.snapshot().agents[0].status,'busy');
});

test('observer failures are isolated and mutating during notification is rejected',()=>{
  const errors=[],views=[],a=createRufloSwarmAdapter({onError:e=>errors.push(e.message)});a.subscribe(()=>{throw Error('observer broke')});
  a.subscribe(v=>{views.push(v.version);if(v.version>0)a.ingest({type:'agent.upsert',id:'unexpected'})});
  a.ingest({type:'agent.upsert',id:'a'});assert.deepEqual(views,[0,1]);assert.equal(a.snapshot().agents.length,1);assert.ok(errors.includes('observer broke'));assert.ok(errors.some(x=>x.includes('cannot mutate')));
});

test('dispose clears in-memory state and rejects further ingestion',()=>{
  const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'a'});const unsub=a.subscribe(()=>{});a.dispose();unsub();a.dispose();assert.deepEqual(a.snapshot().agents,[]);assert.throws(()=>a.ingest({type:'agent.upsert',id:'b'}),/disposed/);assert.throws(()=>a.subscribe(()=>{}),/disposed/);
});

test('position is cleared when a subsequent update does not report it',()=>{const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'a',position:{x:.3,y:.7}});a.ingest({type:'agent.upsert',id:'a',status:'busy'});assert.equal(a.snapshot().agents[0].position,null);a.ingest({type:'agent.upsert',id:'a',position:{x:.3,y:.7}});a.ingest({type:'task.update',id:'a',taskId:'t',status:'claimed'});assert.equal(a.snapshot().agents[0].position,null)});
test('accepts Ruflo canonical pending and completed task statuses',()=>{const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'agent1',status:'idle'});assert.equal(a.ingest({type:'task.update',id:'agent1',taskId:'task1',status:'pending'}),true);assert.equal(a.snapshot().agents[0].task.status,'pending');assert.equal(a.ingest({type:'task.update',id:'agent1',taskId:'task1',status:'completed'}),true);assert.equal(a.snapshot().agents[0].task.status,'completed');a.dispose()});
test('a revisioned removal blocks stale resurrection',()=>{const a=createRufloSwarmAdapter();a.ingest({type:'agent.upsert',id:'a',status:'busy',revision:3});a.ingest({type:'agent.remove',id:'a',revision:5});assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'busy',revision:4}),false);assert.equal(a.snapshot().agents.length,0);assert.equal(a.ingest({type:'agent.upsert',id:'a',status:'idle',revision:6}),true);a.dispose()});
test('a full snapshot replaces a disjoint full snapshot atomically',()=>{const a=createRufloSwarmAdapter({maxAgents:64}),events=[];a.subscribe(s=>events.push(s));const make=prefix=>Array.from({length:64},(_,i)=>({type:'agent.upsert',id:prefix+i,status:'idle'}));a.replaceAgents(make('old'));const before=events.length;a.replaceAgents(make('new'));assert.equal(events.length,before+1);assert.equal(a.snapshot().agents.length,64);assert.equal(a.snapshot().agents.every(x=>x.id.startsWith('new')),true);a.dispose()});
test('invalid snapshots leave the existing projection unchanged',()=>{const a=createRufloSwarmAdapter();a.replaceAgents([{type:'agent.upsert',id:'a',status:'idle'}]);const before=a.snapshot();assert.throws(()=>a.replaceAgents([{type:'agent.upsert',id:'b',status:'idle'},{type:'agent.upsert',id:'b',status:'busy'}]),/duplicate/);assert.deepEqual(a.snapshot(),before);assert.throws(()=>a.replaceAgents([{type:'agent.remove',id:'a'}]),/only accepts/);assert.deepEqual(a.snapshot(),before);a.dispose()});
test('versioned snapshots retain unchanged revisions and accept other advances',()=>{const a=createRufloSwarmAdapter();a.replaceAgents([{type:'agent.upsert',id:'a',status:'idle',revision:1},{type:'agent.upsert',id:'b',status:'idle',revision:1}]);a.replaceAgents([{type:'agent.upsert',id:'a',status:'busy',revision:1},{type:'agent.upsert',id:'b',status:'busy',revision:2}]);assert.deepEqual(a.snapshot().agents.map(x=>x.status),['idle','busy']);a.dispose()});
