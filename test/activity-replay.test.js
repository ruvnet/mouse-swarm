import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scheduleActivity} from '../examples/activity-replay.js';

test('schedule scales observation gaps and preserves simultaneous events',()=>{
  const rows=[{observedAt:100},{observedAt:100},{observedAt:300}];
  assert.deepEqual(scheduleActivity(rows,10000).map(row=>row.at),[0,0,8000]);
  assert.deepEqual(scheduleActivity([],10000),[]);
  assert.throws(()=>scheduleActivity([{observedAt:10},{observedAt:0}],1000),/times/);
  assert.throws(()=>scheduleActivity([{observedAt:1},{observedAt:0},{observedAt:2}],1000),/times/);
});

test('activity video CLI rejects bad records before invoking exporter',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'activity-video-test-'));
  try{
    const input=join(dir,'recording.json');await writeFile(input,JSON.stringify({version:1,events:[{sequence:0,observedAt:1,source:{kind:'ruflo',mode:'snapshot',reference:'ok'},event:{type:'agent.upsert',id:'<script>',status:'idle'}}]}));
    const bin=fileURLToPath(new URL('../bin/activity-video.js',import.meta.url));
    const result=spawnSync(process.execPath,[bin,'--input',input,'--output',join(dir,'out.mp4')],{encoding:'utf8'});
    assert.equal(result.status,1);assert.match(result.stderr,/agent id/);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test('activity video validates shared capture settings before reading a recording',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'activity-config-test-'));
  try{
    const config=join(dir,'settings.json');await writeFile(config,JSON.stringify({duration:0}));
    const bin=fileURLToPath(new URL('../bin/activity-video.js',import.meta.url));
    const result=spawnSync(process.execPath,[bin,'--input',join(dir,'missing.json'),'--output',join(dir,'out.mp4'),'--config',config],{encoding:'utf8'});
    assert.equal(result.status,1);assert.match(result.stderr,/duration/);
  }finally{await rm(dir,{recursive:true,force:true})}
});

test('replay page labels observed provenance and applies state changes in sequence',async()=>{
  const {readFile}=await import('node:fs/promises');const vm=await import('node:vm');
  const script=(await readFile(new URL('../examples/activity-replay.js',import.meta.url),'utf8')).replace('export function','function');
  const nodes=new Map(),queue=[];
  const node=()=>({textContent:'',style:{},children:[],replaceChildren(){this.children=[]},append(...values){this.children.push(...values)},get firstElementChild(){return this.children[0]}});
  const getNode=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
  const events=[{sequence:0,observedAt:1000,source:{kind:'ruflo',mode:'snapshot',reference:'fixture'},event:{type:'agent.upsert',id:'agent1',role:'coder',status:'idle'}},{sequence:1,observedAt:2000,source:{kind:'ruflo',mode:'snapshot',reference:'fixture'},event:{type:'agent.remove',id:'agent1'}}];
  const context={__MOUSE_SWARM_RECORDING__:{recording:{version:1,events},durationMs:1000},document:{getElementById:getNode,createElement:node},performance:{now:()=>0},requestAnimationFrame:fn=>queue.push(fn),Date};
  vm.runInNewContext(script,context);assert.equal(queue.length,1);queue.shift()(1);
  assert.equal(getNode('agents').children.length,1);assert.match(getNode('events').children[0].textContent,/ruflo snapshot \/ fixture/);
  queue.shift()(801);assert.equal(getNode('agents').children.length,0);assert.match(getNode('events').children[1].textContent,/agent.remove/);assert.equal(getNode('counter').textContent,'2 / 2 observations');
});
