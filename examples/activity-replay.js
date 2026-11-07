/** Scale intervals to fit a clip while preserving order and simultaneous events. */
export function scheduleActivity(events,durationMs){
  if(!Array.isArray(events)||!Number.isFinite(durationMs)||durationMs<100)throw new TypeError('invalid replay');
  if(!events.length)return [];
  const first=events[0].observedAt,last=events[events.length-1].observedAt,span=last-first;
  if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||span<0)throw new TypeError('invalid observation times');
  let prior=-1;for(const entry of events){if(!Number.isSafeInteger(entry?.observedAt)||entry.observedAt<prior)throw new TypeError('invalid observation times');prior=entry.observedAt}
  return events.map(entry=>({entry,at:span===0?0:(entry.observedAt-first)/span*durationMs*.8}));
}

if(typeof document!=='undefined'){
  const data=globalThis.__MOUSE_SWARM_RECORDING__,events=data?.recording?.events;
  const agents=document.getElementById('agents'),list=document.getElementById('events'),empty=document.getElementById('empty'),counter=document.getElementById('counter'),bar=document.getElementById('bar');
  try{
    const schedule=scheduleActivity(events,data.durationMs),state=new Map();let next=0;
    function apply(entry){
      const event=entry.event;
      if(event.type==='agent.remove')state.delete(event.id);
      else if(event.type==='agent.upsert')state.set(event.id,{id:event.id,role:event.role||'agent',status:event.status||'unknown'});
      else if(event.type==='task.update'&&state.has(event.id))state.set(event.id,{...state.get(event.id),status:'task '+event.status});
      agents.replaceChildren();
      for(const agent of [...state.values()].slice(0,12)){const card=document.createElement('div'),name=document.createElement('strong'),details=document.createElement('small');card.className='agent';name.textContent=agent.id;details.textContent=agent.role+' · '+agent.status;card.append(name,details);agents.append(card)}
      empty.textContent=state.size?(state.size>12?`Showing 12 of ${state.size} agents.`:''):'No agents in the observed state.';
      const time=new Date(entry.observedAt);const observed=Number.isNaN(time.valueOf())?String(entry.observedAt):time.toISOString();
      const line=document.createElement('li');line.textContent=`#${entry.sequence} · ${entry.source.kind} ${entry.source.mode} / ${entry.source.reference} · ${event.id} · ${event.type}${event.status?' · '+event.status:''} · ${observed}`;list.append(line);while(list.children.length>5)list.firstElementChild.remove();
      counter.textContent=`${next} / ${schedule.length} observations`;bar.style.width=`${schedule.length?next/schedule.length*100:100}%`;
    }
    if(!schedule.length){empty.textContent='No observations in this recording.';counter.textContent='0 observations';bar.style.width='100%'}
    else{const start=performance.now();function tick(now){const elapsed=now-start;while(next<schedule.length&&schedule[next].at<=elapsed){const entry=schedule[next++].entry;apply(entry)}if(next<schedule.length)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
  }catch{counter.textContent='Invalid activity recording.'}
}
