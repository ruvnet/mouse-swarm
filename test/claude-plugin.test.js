import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {register} from '../plugins/mouse-swarm/hooks/register.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const json=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));

test('Claude marketplace, plugin, skill, commands and mod paths are self contained',async()=>{
  const market=await json('.claude-plugin/marketplace.json'),plugin=await json('.claude-plugin/plugin.json');
  assert.equal(market.name,'mouse-swarm');assert.equal(market.plugins[0].source,'./');assert.equal(market.plugins[0].name,plugin.name);
  assert.equal(plugin.commands,'./plugins/mouse-swarm/commands/');assert.equal(plugin.hooks,'./plugins/mouse-swarm/hooks/hooks.json');
  const hooks=await json(plugin.hooks);assert.deepEqual(hooks.modules,['./register.js']);
  for(const path of ['skills/mouse-swarm-reveal/SKILL.md','skills/mouse-swarm-reveal/assets/mouse-swarm.js','plugins/mouse-swarm/commands/reveal.md','plugins/mouse-swarm/commands/observe.md','plugins/mouse-swarm/commands/verify.md','plugins/mouse-swarm/commands/video.md','plugins/mouse-swarm/hooks/register.js'])await access(resolve(root,path));
});

test('mod passes events through, counts only observed successful spawns and tolerates missing Ruflo',async()=>{
  const handlers=new Map();register((name,...args)=>handlers.set(name,args.at(-1)));
  const event={privatePrompt:'never record this'},nextCalls=[];
  const next=async e=>{nextCalls.push(e);return {agentId:'private-agent-id'}};
  const registered=[];
  const session=await handlers.get('session.start')({command:{register:async x=>registered.push(x)}},event,async e=>{nextCalls.push(e);return 'continued'});
  assert.equal(session,'continued');assert.equal(registered[0].name,'mouse-swarm-mod-status');
  const spawn=await handlers.get('agent.spawn')({},event,next);assert.deepEqual(spawn,{agentId:'private-agent-id'});assert.deepEqual(nextCalls,[event,event]);
  const denied={deny:'blocked'};assert.equal(await handlers.get('agent.spawn')({},event,async()=>denied),denied);
  const status=await handlers.get('command.run')({});assert.match(status.text,/1 observed agent spawns/);assert.match(status.text,/unavailable/);assert.doesNotMatch(status.text,/privatePrompt|private-agent-id|never record/);
  const updates=[];const api={ruflo:{segment:async x=>updates.push(x),snapshot:async()=>({policy:'observe',routed:2,private:'secret'})}};
  await handlers.get('agent.spawn')(api,event,next);assert.equal(updates[0].id,'mouse-swarm');assert.match(updates[0].text,/2 observed spawns/);
  const available=await handlers.get('command.run')(api);assert.match(available.text,/policy: observe; routes: 2/);assert.doesNotMatch(available.text,/secret/);
  await assert.rejects(handlers.get('agent.spawn')(api,event,async()=>{throw Error('upstream')}),/upstream/);
});
