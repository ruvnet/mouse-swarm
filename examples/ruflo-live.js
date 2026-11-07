import {createRufloSwarmAdapter} from '/ruflo.js';
import {createRufloSwarmView} from '/ruflo-view.js';
import {createActivityRecorder,createActivityPlayer,validateActivityRecording} from '/activity.js';
const state=document.getElementById('state');
const adapter=createRufloSwarmAdapter();
const view=createRufloSwarmView({adapter,container:document.getElementById('swarm')});
const recordButton=document.getElementById('record'), replayButton=document.getElementById('replay'), pauseButton=document.getElementById('pause-replay'), saveButton=document.getElementById('save'), recordState=document.getElementById('record-state'), eventList=document.getElementById('events'), loadInput=document.getElementById('load');
let recorder=null,imported=null,recording=false,player=null,replayAdapter=null,replayView=null,lastTime=0;
function activeRecording(){return imported??recorder?.snapshot()??null}
function resetReplay(){
  replayView?.destroy();replayAdapter?.dispose();eventList.replaceChildren();
  replayAdapter=createRufloSwarmAdapter();replayView=createRufloSwarmView({adapter:replayAdapter,container:document.getElementById('replay-swarm')});replayView.setSourceState('unverified');
}
function setButtons(){const has=!!activeRecording()?.events.length;replayButton.disabled=!has;saveButton.disabled=!has}
recordButton.addEventListener('click',()=>{
  if(recording){recording=false;recordButton.textContent='Start new recording';recordState.textContent='Recording stopped. The timeline remains in this browser.';setButtons();return}
  player?.destroy();player=null;replayView?.destroy();replayAdapter?.dispose();replayView=null;replayAdapter=null;eventList.replaceChildren();recorder?.dispose();imported=null;recorder=createActivityRecorder();recording=true;lastTime=0;recordButton.textContent='Stop recording';pauseButton.disabled=true;setButtons();recordState.textContent='Recording changes from the next successful snapshot.';
});
replayButton.addEventListener('click',()=>{
  const data=activeRecording();if(!data)return;player?.destroy();
  player=createActivityPlayer({recording:data,reset:resetReplay,apply:entry=>{
    replayAdapter.ingest(entry.event);const item=document.createElement('li');
    item.textContent=`${new Date(entry.observedAt).toLocaleTimeString()} · ${entry.source.kind} ${entry.source.mode} · ${entry.event.id} · ${entry.event.type}${entry.event.status?' · '+entry.event.status:''}`;eventList.append(item);
  },onError:()=>{recordState.textContent='Could not replay this recording.'}});
  pauseButton.disabled=false;pauseButton.textContent='Pause replay';player.play();recordState.textContent='Replaying observed snapshots; this is not live telemetry.';
});
pauseButton.addEventListener('click',()=>{if(!player)return;if(player.getState().state==='playing'){player.pause();pauseButton.textContent='Resume replay';recordState.textContent='Replay paused.'}else{player.play();pauseButton.textContent='Pause replay';recordState.textContent='Replaying observed snapshots.'}});
saveButton.addEventListener('click',()=>{
  const data=activeRecording();if(!data)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='mouse-swarm-observations.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
loadInput.addEventListener('change',async event=>{
  try{const file=event.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)throw Error('recording too large');const data=validateActivityRecording(JSON.parse(await file.text()));player?.destroy();player=null;replayView?.destroy();replayAdapter?.dispose();replayView=null;replayAdapter=null;eventList.replaceChildren();recorder?.dispose();recorder=null;recording=false;imported=data;recordButton.textContent='Start new recording';pauseButton.disabled=true;setButtons();recordState.textContent=`Loaded ${data.events.length} observations. Source labels are supplied by the recording.`}
  catch{recordState.textContent='Could not load recording. Choose a valid JSON recording under 2 MB.'}
  finally{event.target.value=''}
});
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
    if(recording){try{lastTime=Math.max(lastTime,Date.now());recorder.recordSnapshot({source:{kind:'ruflo',mode:'snapshot',reference:'local-ruflo'},observedAt:lastTime,events:body.events});recordState.textContent=`Recording ${recorder.snapshot().events.length} observed changes.`;setButtons()}catch{recording=false;recordButton.textContent='Start new recording';recordState.textContent='Recording stopped: snapshot invalid or capacity reached.';setButtons()}}
  }catch{
    if(run===epoch&&!stopped){view.setSourceState(hadSuccess?'stale':'error');state.textContent='Local Ruflo status unavailable. Previously shown entries may be stale.'}
  }finally{
    clearTimeout(deadline);if(controller===current)controller=null;
    if(run===epoch&&!stopped)timer=setTimeout(poll,2500);
  }
}
addEventListener('pagehide',event=>{
  stopped=true;epoch++;clearTimeout(timer);controller?.abort();player?.pause();
  if(event.persisted){view.setSourceState('disconnected');state.textContent='Observation paused.'}
  else{view.destroy();adapter.dispose();player?.destroy();replayView?.destroy();replayAdapter?.dispose();recorder?.dispose()}
});
addEventListener('pageshow',event=>{if(event.persisted){stopped=false;epoch++;poll()}});
poll();
