import {createRufloSwarmAdapter} from '/ruflo.js';
import {createRufloSwarmView} from '/ruflo-view.js';
const state=document.getElementById('state');
const adapter=createRufloSwarmAdapter();
const view=createRufloSwarmView({adapter,container:document.getElementById('swarm')});
let timer=null,stopped=false,controller=null,epoch=0,hadSuccess=false;
async function poll(){
  if(stopped)return;
  const run=epoch, current=new AbortController();controller=current;
  const deadline=setTimeout(()=>current.abort(),8000);
  try{
    const response=await fetch('/api/ruflo/agents',{cache:'no-store',signal:current.signal});
    if(!response.ok)throw new Error('source unavailable');
    const body=await response.json();
    if(run!==epoch||stopped)return;
    adapter.replaceAgents(body.events);
    view.setSourceState('connected');hadSuccess=true;
    state.textContent=`Local source checked. ${body.events.length} registered agent${body.events.length===1?'':'s'} reported.`;
  }catch{
    if(run===epoch&&!stopped){view.setSourceState(hadSuccess?'stale':'error');state.textContent='Local Ruflo status unavailable. Previously shown entries may be stale.'}
  }finally{
    clearTimeout(deadline);if(controller===current)controller=null;
    if(run===epoch&&!stopped)timer=setTimeout(poll,2500);
  }
}
addEventListener('pagehide',event=>{
  stopped=true;epoch++;clearTimeout(timer);controller?.abort();
  if(event.persisted){view.setSourceState('disconnected');state.textContent='Observation paused.'}
  else{view.destroy();adapter.dispose()}
});
addEventListener('pageshow',event=>{if(event.persisted){stopped=false;epoch++;poll()}});
poll();
