/**
 * Host-fed, in-memory projection of normalized Ruflo agent and task updates.
 * This module does not connect to Ruflo, start agents, access the DOM, or make
 * network calls. Applications must authenticate and normalize their own source.
 */
const AGENT_STATES = new Set(['unknown','idle','active','busy','terminated','working','running','paused','blocked','completed','done','failed','error','offline']);
const TASK_STATES = new Set(['open','claimed','blocked','complete','completed','pending','failed','cancelled','in_progress']);
const allowed = {
  'agent.upsert': new Set(['type','id','label','role','status','position','revision']),
  'agent.remove': new Set(['type','id','revision']),
  'task.update': new Set(['type','id','taskId','title','status','revision'])
};
function isPlain(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) return false; const p=Object.getPrototypeOf(value); return p===Object.prototype || p===null; }
function identifier(value,field) { if (typeof value!=='string'||!(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/).test(value)) throw new TypeError(`${field} must be a safe identifier of at most 128 characters`); return value; }
function text(value,field) { if(typeof value!=='string') throw new TypeError(`${field} must be a string`); if(value.length>8192) throw new RangeError(`${field} is too long`); return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').replace(/</g,'‹').replace(/>/g,'›').trim()).slice(0,80).join(''); }
function position(value) { if(value===null) return null; if(!isPlain(value) || Object.keys(value).some(k=>k!=='x'&&k!=='y') || typeof value.x!=='number'||typeof value.y!=='number'||!Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.x>1||value.y<0||value.y>1) throw new TypeError('position must contain normalized x and y values between 0 and 1'); return Object.freeze({x:value.x,y:value.y}); }
function checkRevision(value) { if(value!==undefined&&(!Number.isSafeInteger(value)||value<0)) throw new TypeError('revision must be a non-negative safe integer'); return value; }
function validate(event){
  if(!isPlain(event)||typeof event.type!=='string'||!Object.hasOwn(allowed,event.type)) throw new TypeError('unknown or invalid event');
  if(Object.keys(event).length>8 || Object.keys(event).some(k=>!allowed[event.type].has(k))) throw new TypeError('event contains unsupported fields');
  const id=identifier(event.id,'id'), revision=checkRevision(event.revision);
  if(event.type==='agent.remove') return {type:event.type,id,revision};
  if(event.type==='agent.upsert'){
    const out={type:event.type,id,revision};
    if(event.label!==undefined) out.label=text(event.label,'label');
    if(event.role!==undefined) out.role=text(event.role,'role');
    if(event.status!==undefined){if(!AGENT_STATES.has(event.status)) throw new TypeError('unsupported agent status');out.status=event.status;}
    if(event.position!==undefined) out.position=position(event.position);
    return out;
  }
  const taskId=identifier(event.taskId,'taskId');
  if(!TASK_STATES.has(event.status)) throw new TypeError('unsupported task status');
  return {type:event.type,id,revision,taskId,status:event.status,title:event.title===undefined?'':text(event.title,'title')};
}
/**
 * Host events use normalized IDs, safe labels, known status values, optional
 * explicitly observed normalized viewport coordinates, and optional monotonic
 * per-agent revisions. Keep raw task bodies, secrets, and personal data out.
 */
export function createRufloSwarmAdapter({maxAgents=64,onError}={}) {
  if(!Number.isInteger(maxAgents)||maxAgents<1||maxAgents>256) throw new RangeError('maxAgents must be from 1 to 256');
  if(onError!==undefined&&typeof onError!=='function') throw new TypeError('onError must be a function');
  const agents=new Map(),tombstones=new Map(),listeners=new Set();let version=0,disposed=false,emitting=false;
  function snapshot(){return Object.freeze({version,agents:Object.freeze([...agents.values()])});}
  function report(error){if(onError){try{onError(error)}catch{ /* A failing observer must not break projection. */ }}}
  function dispatch(){const view=snapshot();emitting=true;try{for(const listener of [...listeners]){try{listener(view)}catch(error){report(error)}}}finally{emitting=false}}
  function guard(){if(disposed)throw new Error('adapter has been disposed');if(emitting)throw new Error('cannot mutate adapter during subscriber notification');}
  function stale(current,revision,id){const last=current?.revision??tombstones.get(id);return last!==undefined&&(revision===undefined||revision<=last);}
  function rememberRemoval(id,revision){if(revision===undefined)return;tombstones.delete(id);tombstones.set(id,revision);if(tombstones.size>maxAgents*2)tombstones.delete(tombstones.keys().next().value);}
  function ingest(input){
    guard(); const e=validate(input),current=agents.get(e.id);
    if(stale(current,e.revision,e.id))return false;
    if(e.type==='agent.remove') { rememberRemoval(e.id,e.revision??current?.revision);if(!current)return false;agents.delete(e.id);version++;dispatch();return true; }
    if(e.type==='task.update') { if(!current)return false;const task=Object.freeze({id:e.taskId,title:e.title,status:e.status});agents.set(e.id,Object.freeze({...current,position:null,task,...(e.revision!==undefined?{revision:e.revision}:{})}));version++;dispatch();return true; }
    if(!current&&agents.size>=maxAgents) throw new RangeError('agent capacity exceeded');
    const next={id:e.id,label:e.label||current?.label||'Agent',role:e.role??current?.role??'',status:e.status??current?.status??'unknown',position:e.position!==undefined?e.position:null,task:current?.task??null};
    if(e.revision!==undefined)next.revision=e.revision;
    tombstones.delete(e.id);agents.set(e.id,Object.freeze(next));version++;dispatch();return true;
  }
  function replaceAgents(events){
    guard();if(!Array.isArray(events)||events.length>maxAgents)throw new RangeError('snapshot exceeds agent capacity');
    const replacement=new Map();
    for(const input of events){const e=validate(input);if(e.type!=='agent.upsert')throw new TypeError('snapshot only accepts agent updates');if(replacement.has(e.id))throw new TypeError('duplicate snapshot agent');const current=agents.get(e.id);if(current?.revision!==undefined&&e.revision===current.revision){replacement.set(e.id,current);continue}if(stale(current,e.revision,e.id))throw new Error('stale snapshot');const next={id:e.id,label:e.label||current?.label||'Agent',role:e.role??current?.role??'',status:e.status??current?.status??'unknown',position:e.position??null,task:current?.task??null};if(e.revision!==undefined)next.revision=e.revision;replacement.set(e.id,Object.freeze(next))}
    for(const [id,agent] of agents)if(!replacement.has(id))rememberRemoval(id,agent.revision);
    agents.clear();for(const [id,agent] of replacement){tombstones.delete(id);agents.set(id,agent)}version++;dispatch();return true;
  }
  function remove(id){guard();const key=identifier(id,'id'),current=agents.get(key);if(!current)return false;rememberRemoval(key,current.revision);agents.delete(key);version++;dispatch();return true;}
  function subscribe(listener){guard();if(typeof listener!=='function')throw new TypeError('listener must be a function');if(listeners.size>=128)throw new RangeError('subscriber capacity exceeded');listeners.add(listener);try{listener(snapshot())}catch(error){report(error)}let active=true;return ()=>{if(active){active=false;listeners.delete(listener)}};}
  function dispose(){if(disposed)return; if(emitting)throw new Error('cannot dispose during subscriber notification');agents.clear();tombstones.clear();listeners.clear();disposed=true;version++;}
  return {ingest,replaceAgents,subscribe,snapshot,remove,dispose};
}
