import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('observation pauses for BFCache and resumes once on restoration', async () => {
  const source=readFileSync(new URL('../examples/ruflo-live.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const handlers={},states=[],timers=new Map();let nextTimer=0,fetches=0,replacements=0,destroyed=0,disposed=0;
  const state={textContent:''};
  const context={
    document:{getElementById:id=>id==='state'?state:{}},
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
