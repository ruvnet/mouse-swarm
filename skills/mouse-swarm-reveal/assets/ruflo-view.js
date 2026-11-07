/** Render host-supplied agent status. No network, execution, or synthetic coordinates. */
const CSS = `
.ms-ruflo-panel{box-sizing:border-box;background:#101914;color:#e9f1e7;border:1px solid #34493a;border-radius:10px;padding:14px;font:13px/1.45 system-ui,sans-serif}
.ms-ruflo-panel h2{font-size:15px;margin:0 0 4px}.ms-ruflo-panel p{margin:4px 0;color:#a9bcae;font-size:12px}.ms-ruflo-panel ul{list-style:none;margin:12px 0 0;padding:0;max-height:260px;overflow:auto}.ms-ruflo-panel li{padding:7px 0;border-top:1px solid #26372b;overflow-wrap:anywhere}.ms-ruflo-panel strong{color:#ddf5bb}.ms-ruflo-panel .ms-ruflo-task{color:#9cb0a1;font-size:12px}
.ms-ruflo-overlay{position:fixed;inset:0;z-index:2147483645;pointer-events:none;overflow:hidden}.ms-ruflo-marker{position:absolute;pointer-events:none;transition:left .5s ease,top .5s ease;color:#c9f578;font:11px system-ui,sans-serif;filter:drop-shadow(0 1px 3px #000)}.ms-ruflo-marker::before{content:'';display:block;width:0;height:0;border-top:17px solid #c9f578;border-right:10px solid transparent}.ms-ruflo-marker span{display:block;background:#c9f578;color:#10200e;border-radius:3px;padding:2px 4px;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(prefers-reduced-motion:reduce){.ms-ruflo-marker{transition:none!important}}
`;
const SOURCE_STATES = new Set(['unverified','connected','stale','error','disconnected']);
function clean(value, fallback='') {
  if(typeof value!=='string') return fallback;
  return Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,80).join('') || fallback;
}
function validPosition(value) {
  return value !== null && typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y) && value.x >= 0 && value.x <= 1 && value.y >= 0 && value.y <= 1;
}
/**
 * Display a bounded, host-provided status snapshot. An agent receives a marker
 * only when the host supplies normalized viewport coordinates. A connection
 * label must be set explicitly by the host and is not an execution guarantee.
 */
export function createRufloSwarmView({adapter,container,maxAgents=64,maxMarkers=64,showTaskTitles=false}={}) {
  if(!adapter || typeof adapter.subscribe!=='function') throw new TypeError('adapter must provide subscribe');
  if(!container || !container.ownerDocument || typeof container.append!=='function') throw new TypeError('container must be a DOM element');
  if(!Number.isInteger(maxAgents)||maxAgents<1||maxAgents>256) throw new RangeError('maxAgents must be from 1 to 256');
  if(!Number.isInteger(maxMarkers)||maxMarkers<0||maxMarkers>256) throw new RangeError('maxMarkers must be from 0 to 256');
  if(typeof showTaskTitles!=='boolean') throw new TypeError('showTaskTitles must be a boolean');
  const doc=container.ownerDocument;
  const style=doc.createElement('style');style.textContent=CSS;
  const panel=doc.createElement('section');panel.className='ms-ruflo-panel';panel.setAttribute('aria-label','Ruflo swarm status');
  const title=doc.createElement('h2');title.textContent='Ruflo swarm status';
  const source=doc.createElement('p');source.setAttribute('role','status');source.textContent='Source: unverified';
  const explanation=doc.createElement('p');explanation.textContent='Statuses are reported by the host and do not verify execution. Markers require supplied positions.';
  const list=doc.createElement('ul');list.setAttribute('aria-label','Reported agents');
  panel.append(title,source,explanation,list);
  const overlay=doc.createElement('div');overlay.className='ms-ruflo-overlay';overlay.setAttribute('aria-hidden','true');
  const markers=new Map();let destroyed=false,unsubscribe;
  function render(snapshot){
    if(destroyed)return;
    const agents=Array.isArray(snapshot?.agents)?snapshot.agents:[];
    const unique=new Set(),shown=[],active=new Set();let markerCount=0;
    for(const agent of agents.slice(0,maxAgents)){
      if(shown.length>=maxAgents)break;
      if(!agent || typeof agent.id!=='string' || agent.id.length<1 || agent.id.length>128 || unique.has(agent.id))continue;
      unique.add(agent.id);
      const label=clean(agent.label,'Agent'),role=clean(agent.role),status=clean(agent.status,'unknown');
      const row=doc.createElement('li'),name=doc.createElement('strong'),details=doc.createElement('span');
      name.textContent=label;details.textContent=`${role?' · '+role:''} · ${status}`;row.append(name,details);
      if(agent.task && typeof agent.task==='object'){
        const taskStatus=clean(agent.task.status,'unknown');const task=doc.createElement('div');task.className='ms-ruflo-task';
        task.textContent=showTaskTitles && clean(agent.task.title)?`Task: ${clean(agent.task.title)} · ${taskStatus}`:`Task status: ${taskStatus}`;row.append(task);
      }
      shown.push(row);
      if(markerCount<maxMarkers && validPosition(agent.position)){
        let marker=markers.get(agent.id);
        if(!marker){marker=doc.createElement('div');marker.className='ms-ruflo-marker';const text=doc.createElement('span');marker.append(text);marker._rufloLabel=text;markers.set(agent.id,marker);overlay.append(marker)}
        marker._rufloLabel.textContent=label;marker.style.left=`${agent.position.x*100}%`;marker.style.top=`${agent.position.y*100}%`;
        active.add(agent.id);markerCount++;
      }
    }
    if(!shown.length){const empty=doc.createElement('li');empty.textContent='No agent status reported.';shown.push(empty)}
    list.replaceChildren(...shown);
    for(const [id,marker] of markers){if(!active.has(id)){marker.remove();markers.delete(id)}}
  }
  function setSourceState(value){if(destroyed)throw new Error('view has been destroyed');if(!SOURCE_STATES.has(value))throw new TypeError('unsupported source state');source.textContent=`Source: ${value}`;overlay.style.display=['stale','error','disconnected'].includes(value)?'none':'';}
  doc.head.append(style);container.append(panel);doc.body.append(overlay);
  try{unsubscribe=adapter.subscribe(render);if(typeof unsubscribe!=='function')throw new TypeError('subscribe must return an unsubscribe function')}
  catch(error){style.remove();panel.remove();overlay.remove();throw error}
  function destroy(){if(destroyed)return;destroyed=true;try{unsubscribe()}finally{markers.clear();style.remove();panel.remove();overlay.remove()}}
  return {setSourceState,destroy};
}
