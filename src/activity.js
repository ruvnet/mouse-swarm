/** Bounded host-fed observations. Provenance is supplied by the host and must be verified there. */
const AGENT_STATES=new Set(['unknown','idle','active','busy','terminated','working','running','paused','blocked','completed','done','failed','error','offline']);
const TASK_STATES=new Set(['open','claimed','blocked','complete','completed','pending','failed','cancelled','in_progress']);
const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
function id(v,name){if(!safeId(v))throw new TypeError(`${name} must be a safe identifier`);return v}
function sourceOf(s){if(!s||typeof s!=='object'||!['ruflo','metaharness'].includes(s.kind)||!['snapshot','event'].includes(s.mode))throw new TypeError('invalid source');return Object.freeze({kind:s.kind,mode:s.mode,reference:id(s.reference,'source reference')})}
function timeOf(t){if(!Number.isSafeInteger(t)||t<0)throw new TypeError('observedAt must be a non-negative integer');return t}
function project(e){
 if(!e||typeof e!=='object'||Array.isArray(e))throw new TypeError('invalid event');
 const out={type:e.type,id:id(e.id,'agent id')};
 if(e.revision!==undefined){if(!Number.isSafeInteger(e.revision)||e.revision<0)throw new TypeError('invalid revision');out.revision=e.revision}
 if(e.type==='agent.remove')return Object.freeze(out);
 if(e.type==='agent.upsert'){
   if(e.role!==undefined){if(typeof e.role!=='string'||!/^[A-Za-z0-9 _-]{0,64}$/.test(e.role))throw new TypeError('invalid role');out.role=e.role}
   if(e.status!==undefined){if(!AGENT_STATES.has(e.status))throw new TypeError('invalid agent status');out.status=e.status}
   return Object.freeze(out);
 }
 if(e.type==='task.update'){out.taskId=id(e.taskId,'task id');if(!TASK_STATES.has(e.status))throw new TypeError('invalid task status');out.status=e.status;return Object.freeze(out)}
 throw new TypeError('unsupported activity event');
}
function recordOf(input,index){if(!input||typeof input!=='object')throw new TypeError('invalid activity');return Object.freeze({sequence:index,observedAt:timeOf(input.observedAt),source:sourceOf(input.source),event:project(input.event)})}
function load(recording,maxEvents=10000){
 if(!recording||recording.version!==1||!Array.isArray(recording.events)||recording.events.length>maxEvents)throw new TypeError('invalid activity recording');
 let prior=-1;return Object.freeze({version:1,events:Object.freeze(recording.events.map((item,index)=>{if(item.sequence!==index)throw new TypeError('invalid activity sequence');const out=recordOf(item,index);if(out.observedAt<prior)throw new TypeError('out of order activity');prior=out.observedAt;return out}))});
}
/** Capture only fields required for status playback. Do not include secrets in IDs or source references. */
export function createActivityRecorder({maxEvents=1000}={}){
 if(!Number.isInteger(maxEvents)||maxEvents<1||maxEvents>10000)throw new RangeError('maxEvents must be 1 to 10000');
 const events=[],baselines=new Map();let last=-1,disposed=false;
 const guard=()=>{if(disposed)throw new Error('recorder disposed')};
 function append(input){guard();const entry=recordOf(input,events.length);if(entry.observedAt<last)throw new Error('out of order activity');if(events.length>=maxEvents)throw new RangeError('activity capacity exceeded');events.push(entry);last=entry.observedAt;return entry}
 function recordSnapshot({source,observedAt,events:items}){
   guard();const src=sourceOf(source),at=timeOf(observedAt);
   if(src.mode!=='snapshot')throw new TypeError('snapshot source required');
   if(at<last)throw new Error('out of order activity');
   if(!Array.isArray(items)||items.length>256)throw new RangeError('invalid snapshot size');
   const key=src.kind+':'+src.reference,previous=baselines.get(key);
   if(!previous&&baselines.size>=16)throw new RangeError('snapshot source capacity exceeded');
   if(previous&&at<previous.at)throw new Error('out of order snapshot');
   const next=new Map();
   for(const item of items){const e=project(item);if(e.type!=='agent.upsert')throw new TypeError('snapshots only accept agent upserts');if(next.has(e.id))throw new TypeError('duplicate agent');next.set(e.id,e)}
   const changes=[];for(const [id,event] of next){const old=previous?.agents.get(id);if(!old||JSON.stringify(old)!==JSON.stringify(event))changes.push(event)}
   if(previous)for(const id of previous.agents.keys())if(!next.has(id))changes.push(Object.freeze({type:'agent.remove',id}));
   if(events.length+changes.length>maxEvents)throw new RangeError('activity capacity exceeded');
   const added=changes.map((event,i)=>recordOf({source:src,observedAt:at,event},events.length+i));
   for(const entry of added)events.push(entry);last=at;
   baselines.set(key,{at,agents:next});return Object.freeze(added);
 }
 function snapshot(){guard();return Object.freeze({version:1,events:Object.freeze([...events])})}
 function dispose(){events.length=0;baselines.clear();disposed=true}
 return {record:append,recordSnapshot,snapshot,dispose};
}
/** Validate and project imported JSON before playback. */
export function validateActivityRecording(recording){return load(recording)}
/** Replay in sequence order. reset must clear the consumer's state before applying. */
export function replayActivity(recording,{reset,apply,through}={}){
 const data=load(recording);if(typeof reset!=='function'||typeof apply!=='function')throw new TypeError('reset and apply functions required');
 const end=through===undefined?data.events.length:through;if(!Number.isInteger(end)||end<0||end>data.events.length)throw new RangeError('invalid replay position');
 reset();for(let i=0;i<end;i++)apply(data.events[i]);return end;
}
/** Play recorded intervals without introducing synthetic events or positions. */
export function createActivityPlayer({recording,reset,apply,setTimer=setTimeout,clearTimer=clearTimeout,now=Date.now,onError}={}){
 const data=load(recording);if(typeof reset!=='function'||typeof apply!=='function'||typeof setTimer!=='function'||typeof clearTimer!=='function'||typeof now!=='function'||(onError!==undefined&&typeof onError!=='function'))throw new TypeError('invalid player callbacks');
 let index=0,state='paused',timer=null,generation=0,initialized=false,remaining=null,startedAt=0;
 function cancel(){generation++;if(timer!==null){clearTimer(timer);timer=null}}
 function error(e){cancel();state='error';if(onError)onError(e);else throw e}
 function schedule(){if(state!=='playing'||index>=data.events.length){if(state==='playing')state='complete';return}if(remaining===null)remaining=index===0?0:data.events[index].observedAt-data.events[index-1].observedAt;const run=generation;function wait(){const chunk=Math.min(remaining,2147483647);startedAt=now();timer=setTimer(()=>{if(run!==generation||state!=='playing')return;timer=null;remaining-=chunk;if(remaining>0){wait();return}remaining=null;try{apply(data.events[index]);index++;schedule()}catch(e){error(e)}},chunk)}wait()}
 function play(){if(state==='destroyed')throw new Error('player destroyed');if(state==='playing')return;if(state==='error')throw new Error('seek before restarting');if(!initialized){try{reset();initialized=true}catch(e){error(e);return}}if(index>=data.events.length){state='complete';return}state='playing';schedule()}
 function pause(){if(state==='playing'){if(timer!==null&&remaining!==null)remaining=Math.max(0,remaining-Math.max(0,now()-startedAt));cancel();state='paused'}}
 function seek(count){if(state==='destroyed')throw new Error('player destroyed');if(!Number.isInteger(count)||count<0||count>data.events.length)throw new RangeError('invalid replay position');cancel();remaining=null;try{replayActivity(data,{reset,apply,through:count});initialized=true;index=count;state=count===data.events.length?'complete':'paused'}catch(e){error(e)}}
 function destroy(){cancel();state='destroyed'}
 return {play,pause,seek,destroy,getState:()=>Object.freeze({state,index,total:data.events.length})};
}
