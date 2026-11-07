/** Host-fed projection of MetaHarness kernel SessionEvent envelopes.
 * No file, network, execution, timestamp, or agent semantics are inferred.
 * Upstream: packages/kernel-js/src/session.ts at 574ce3b881e902d23472a541f9f9e2fdccfa63db.
 */
const AGENT_STATES=new Set(['unknown','idle','active','busy','terminated','working','running','paused','blocked','completed','done','failed','error','offline']);
const TASK_STATES=new Set(['open','claimed','blocked','complete','completed','pending','failed','cancelled','in_progress']);
const safe=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,31}$/;
const agentId=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
function validateProjection(value){
 if(!isObject(value)||!['agent.upsert','agent.remove','task.update'].includes(value.type)||typeof value.id!=='string'||!agentId.test(value.id))throw new TypeError('invalid mapped event');
 const fields=value.type==='agent.upsert'?['type','id','role','status','revision']:value.type==='agent.remove'?['type','id','revision']:['type','id','taskId','status','revision'];
 if(Object.keys(value).some(k=>!fields.includes(k)))throw new TypeError('mapped event contains unsupported fields');
 if(value.revision!==undefined&&(!Number.isSafeInteger(value.revision)||value.revision<0))throw new TypeError('invalid revision');
 if(value.type==='agent.upsert'){
  if(value.role!==undefined&&(typeof value.role!=='string'||!/^[a-zA-Z0-9 _-]{1,64}$/.test(value.role)))throw new TypeError('invalid role');
  if(value.status!==undefined&&!AGENT_STATES.has(value.status))throw new TypeError('invalid status');
 }
 if(value.type==='task.update'&&(typeof value.taskId!=='string'||!agentId.test(value.taskId)||!TASK_STATES.has(value.status)))throw new TypeError('invalid task event');
 return Object.freeze({...value});
}
/**
 * `mapEvent` is the host's explicit mapping from a native envelope to a
 * normalized event (or null to ignore it). `record` receives a minimized
 * observation. Never write the free-form native payload to the recording.
 */
export function createMetaHarnessAdapter({sourceId,mapEvent,record,clock=Date.now,maxBranches=32}={}){
 if(typeof sourceId!=='string'||!safe.test(sourceId))throw new TypeError('sourceId must be a safe identifier');
 if(typeof mapEvent!=='function'||typeof record!=='function'||typeof clock!=='function')throw new TypeError('mapEvent, record and clock must be functions');
 if(!Number.isInteger(maxBranches)||maxBranches<1||maxBranches>256)throw new RangeError('maxBranches must be from 1 to 256');
 const offsets=new Map();let disposed=false;
 return {
  ingest(raw){
   if(disposed)throw new Error('adapter has been disposed');
   if(!isObject(raw)||!Number.isSafeInteger(raw.index)||raw.index<0||typeof raw.branch!=='string'||!safe.test(raw.branch)||typeof raw.kind!=='string'||raw.kind.length<1||raw.kind.length>128||!Object.hasOwn(raw,'payload'))throw new TypeError('invalid MetaHarness session envelope');
   const last=offsets.get(raw.branch);if(last!==undefined&&raw.index<=last)return false;
   if(last===undefined&&offsets.size>=maxBranches)throw new RangeError('branch capacity exceeded');
   const mapped=mapEvent(raw);if(mapped===null||mapped===undefined){offsets.set(raw.branch,raw.index);return false}
   const event=validateProjection(mapped),observedAt=clock();if(!Number.isSafeInteger(observedAt)||observedAt<0)throw new TypeError('invalid observation time');
   record({source:{kind:'metaharness',mode:'event',reference:`${sourceId}:${raw.branch}:${raw.index}`},observedAt,event});
   offsets.set(raw.branch,raw.index);return true;
  },
  dispose(){disposed=true;offsets.clear()}
 };
}
