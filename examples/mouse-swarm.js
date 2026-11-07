/** Visual-only cursor choreography. No telemetry, network calls, OS input, or agents. */
const OWNERS = new WeakMap();
const DEFAULT_COLORS = ['#cef575','#70c9f9','#c9acff','#ffb37a','#ed81ba','#8ee6ce','#f8d66a'];
const css = `
[data-ms-item]{transition:opacity .35s ease,transform .4s ease,filter .35s ease}
[data-ms-item][data-ms-hidden]{opacity:0;transform:translateY(7px);filter:blur(2px)}
.ms-overlay{position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden}
.ms-cursor{position:absolute;left:50%;top:50%;opacity:0;transition:left var(--ms-speed,.7s) ease,top var(--ms-speed,.7s) ease,opacity .3s ease;filter:drop-shadow(0 2px 3px #0009)}
.ms-cursor svg{display:block;width:var(--ms-size,15px);height:auto}.ms-cursor.bot svg{filter:drop-shadow(0 0 4px #259ef2)}
.ms-label{display:inline-block;margin:0 0 0 9px;padding:2px 5px;border-radius:3px;background:currentColor;font:10px system-ui,sans-serif}
.ms-label span{color:#101510}
.ms-selection{position:absolute;border:1px solid #70bdff;background:#80baff10;box-shadow:0 0 12px #68b6ff22;opacity:0;transition:left .18s,top .18s,width .18s,height .18s,opacity .18s}
.ms-role{position:absolute;opacity:0;padding:3px 6px;border-radius:3px;background:#c9f578;color:#101510;font:11px system-ui,sans-serif;white-space:nowrap}.ms-role[data-active]{opacity:1}
.ms-ghost{position:absolute;opacity:0;border:1px dashed #a1d8ff;background:#80baff18;border-radius:4px;box-shadow:0 0 14px #68b6ff33}.ms-ghost[data-active]{animation:ms-drag .55s ease-out both}
@keyframes ms-drag{from{opacity:.1;transform:translate(-80px,-30px)}60%{opacity:.9}to{opacity:0;transform:translate(0,0)}}
.ms-selection[data-active]{opacity:1}.ms-selection::before,.ms-selection::after{content:'';position:absolute;width:6px;height:6px;background:#b5e7ff;border:1px solid #3180b1}.ms-selection::before{left:-4px;top:-4px}.ms-selection::after{right:-4px;bottom:-4px}
@media(prefers-reduced-motion:reduce){[data-ms-item]{transition:none!important}.ms-overlay{display:none!important}}
`;
const arrow = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M2 2 L2 21 L7 17 L11 25 L15 23 L11 15 L19 15 Z" fill="currentColor" stroke="#10151b" stroke-width="1.5"/></svg>';
const bot = '<svg viewBox="0 0 24 26" aria-hidden="true"><path fill="#3dc7ff" stroke="#bdeeff" stroke-width=".7" d="M6 5h12v3h3v11h-3v4H6v-4H3V8h3z"/><path fill="#efffff" d="M7 9h3v3H7zm7 0h3v3h-3z"/><path stroke="#dafaff" d="M9 16h6M12 5V2M5 23h4m6 0h4"/></svg>';

/** One instance per root; text typing is opt-in on leaf elements. */
export function createSwarmReveal({
  root = document, selector = '[data-swarm-item]', cursors = 20, interval = 280,
  typeText = true, typeWords = 3, colors = DEFAULT_COLORS, botEvery = 5,
  cursorSize = 15, cursorSpeed = 700, selection = true, labels = [],
  autoScroll = false, onStep, onComplete, onError
} = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') throw new TypeError('root must support querySelectorAll');
  if (typeof selector !== 'string' || !selector) throw new TypeError('selector must be a non-empty string');
  if (!Number.isFinite(interval) || interval < 20) throw new RangeError('interval must be at least 20ms');
  if (!Number.isInteger(cursors) || cursors < 0 || cursors > 80) throw new RangeError('cursors must be an integer from 0 to 80');
  if (!Number.isInteger(typeWords) || typeWords < 1 || typeWords > 50) throw new RangeError('typeWords must be an integer from 1 to 50');
  if (!Number.isInteger(botEvery) || botEvery < 0 || botEvery > 80) throw new RangeError('botEvery must be an integer from 0 to 80');
  if (!Number.isFinite(cursorSize) || cursorSize < 8 || cursorSize > 48) throw new RangeError('cursorSize must be between 8 and 48');
  if (!Number.isFinite(cursorSpeed) || cursorSpeed < 0 || cursorSpeed > 10000) throw new RangeError('cursorSpeed must be between 0 and 10000ms');
  if (!Array.isArray(colors) || !colors.length || colors.length > 32 || colors.some(c=>typeof c !== 'string' || !c.trim() || c.length>64)) throw new TypeError('colors must be an array of 1 to 32 color strings');
  if (!Array.isArray(labels) || labels.length > 80 || labels.some(l=>typeof l !== 'string' || l.length>80)) throw new TypeError('labels must be an array of at most 80 strings');
  if (typeof typeText !== 'boolean' || typeof selection !== 'boolean' || typeof autoScroll !== 'boolean') throw new TypeError('typeText, selection and autoScroll must be booleans');
  if (onStep !== undefined && typeof onStep !== 'function') throw new TypeError('onStep must be a function');
  if (onComplete !== undefined && typeof onComplete !== 'function') throw new TypeError('onComplete must be a function');
  if (onError !== undefined && typeof onError !== 'function') throw new TypeError('onError must be a function');
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc.defaultView;
  const itemMeta = [...root.querySelectorAll(selector)].map((el,index)=>{
    function integerAttribute(name,max){
      if(!el.hasAttribute(name))return undefined;
      const raw=el.getAttribute(name);
      if(typeof raw!=='string'||!/^\d+$/.test(raw)||Number(raw)>max)throw new RangeError(`${name} must be an integer from 0 to ${max}`);
      return Number(raw);
    }
    const order=integerAttribute('data-swarm-order',100000),delay=integerAttribute('data-swarm-delay',10000)??0;
    const rawRole=el.hasAttribute('data-swarm-role')?el.getAttribute('data-swarm-role'):'';
    if(typeof rawRole!=='string'||rawRole.length>40||/[\u0000-\u001f\u007f-\u009f]/.test(rawRole))throw new TypeError('data-swarm-role must be at most 40 printable characters');
    const group=el.hasAttribute('data-swarm-group')?el.getAttribute('data-swarm-group'):undefined;
    if(group!==undefined&&(typeof group!=='string'||!/^[a-zA-Z0-9_-]{1,32}$/.test(group)))throw new TypeError('data-swarm-group must be a safe identifier of at most 32 characters');
    const effect=el.hasAttribute('data-swarm-effect')?el.getAttribute('data-swarm-effect'):undefined;
    if(effect!==undefined&&effect!=='drag')throw new TypeError('data-swarm-effect must be drag');
    return {el,index,order,delay,role:rawRole.trim(),group,effect};
  });
  itemMeta.sort((a,b)=>(a.order??Infinity)-(b.order??Infinity)||a.index-b.index);
  let maxGroup=1;for(let i=0;i<itemMeta.length;){let end=i+1;if(itemMeta[i].group)while(end<itemMeta.length&&itemMeta[end].group===itemMeta[i].group)end++;if(end-i>32)throw new RangeError('parallel reveal groups may contain at most 32 elements');maxGroup=Math.max(maxGroup,end-i);i=end}
  const items=itemMeta.map(x=>x.el);
  if (items.some(el => OWNERS.has(el))) throw new Error('reveal targets are already owned by another instance');
  const snapshots = itemMeta.map(({el,delay,role,group,effect}) => ({el,delay,role,group,effect, text: el.hasAttribute('data-swarm-type') && el.children.length === 0 ? el.textContent : null, hadItem: el.hasAttribute('data-ms-item'), hidden: el.hasAttribute('data-ms-hidden'), inert: el.hasAttribute('inert')}));
  const motion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isReduced = () => !!motion?.matches;
  const owner = {};
  const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
  const overlay = doc.createElement('div'); overlay.className = 'ms-overlay'; overlay.setAttribute('aria-hidden','true');
  const box = doc.createElement('div'); box.className = 'ms-selection'; overlay.append(box);
  const agents = Array.from({length:cursors}, (_, i) => {
    const c = doc.createElement('div'); const isBot=botEvery>0 && (i+1)%botEvery===0;
    c.className = 'ms-cursor' + (isBot ? ' bot' : ''); c.style.color = colors[i % colors.length];
    c.style.setProperty('--ms-size', `${cursorSize}px`); c.style.setProperty('--ms-speed', `${cursorSpeed}ms`);
    c.innerHTML = isBot ? bot : arrow;
    if (labels[i]) { const label=doc.createElement('div'), text=doc.createElement('span'); label.className='ms-label'; text.textContent=labels[i]; label.append(text); c.append(label); }
    overlay.append(c); return c;
  });
  const boxes=[box];for(let i=1;i<maxGroup;i++){const element=doc.createElement('div');element.className='ms-selection';overlay.append(element);boxes.push(element)}
  const ghosts=Array.from({length:maxGroup},()=>{const ghost=doc.createElement('div');ghost.className='ms-ghost';overlay.append(ghost);return ghost});
  const roleTags=Array.from({length:maxGroup},()=>{const tag=doc.createElement('div');tag.className='ms-role';overlay.append(tag);return tag});
  doc.body.append(overlay);
  items.forEach(el => OWNERS.set(el,owner));
  let timer = null, generation = 0, next = 0, steps = [], state = 'idle';
  function clear() { if (timer !== null) win.clearTimeout(timer); timer = null; }
  function placeAgents(el,role,drag=false,groupIndex=0,groupSize=1) {
    if (!el || isReduced()) return;
    const r = el.getBoundingClientRect(), w = win.innerWidth, h = win.innerHeight;
    if(groupIndex===0){ghosts.forEach(ghost=>ghost.removeAttribute('data-active'));boxes.forEach(element=>element.removeAttribute('data-active'));roleTags.forEach(tag=>tag.removeAttribute('data-active'))}
    if (r.bottom < 0 || r.top > h) return;
    const x = Math.max(8,Math.min(w-30,r.left+Math.min(r.width,220)*.6));
    const y = Math.max(8,Math.min(h-30,r.top+Math.min(r.height,50)*.5));
    const box=boxes[groupIndex],roleTag=roleTags[groupIndex];
    if (selection) { Object.assign(box.style,{left:`${Math.max(0,r.left)}px`,top:`${Math.max(0,r.top)}px`,width:`${Math.min(Math.max(r.width,25),w*.7,520)}px`,height:`${Math.min(Math.max(r.height,18),200)}px`}); box.setAttribute('data-active',''); }
    if(role){roleTag.textContent=role;roleTag.style.left=`${x}px`;roleTag.style.top=`${Math.max(4,y-25)}px`;roleTag.setAttribute('data-active','')}else roleTag.removeAttribute('data-active');
    const ghost=ghosts[groupIndex];
    if(drag){Object.assign(ghost.style,{left:`${Math.max(0,r.left)}px`,top:`${Math.max(0,r.top)}px`,width:`${Math.min(Math.max(r.width,25),w*.7,520)}px`,height:`${Math.min(Math.max(r.height,18),200)}px`});void ghost.offsetWidth;ghost.setAttribute('data-active','')}
    agents.forEach((c,i)=>{if(i%groupSize!==groupIndex)return;const near = i%3 !== 0; c.style.opacity='1'; c.style.left=`${Math.max(4,Math.min(w-20,near?x+(Math.random()-.5)*170:Math.random()*w))}px`; c.style.top=`${Math.max(4,Math.min(h-20,near?y+(Math.random()-.5)*110:Math.random()*h))}px`; });
  }
  function restore() { snapshots.forEach(({el,text,hidden,inert})=>{ if(hidden) el.setAttribute('data-ms-hidden',''); else el.removeAttribute('data-ms-hidden'); if(inert) el.setAttribute('inert',''); else el.removeAttribute('inert'); if(text !== null) el.textContent=text; }); boxes.forEach(element=>element.removeAttribute('data-active'));roleTags.forEach(tag=>tag.removeAttribute('data-active'));ghosts.forEach(ghost=>ghost.removeAttribute('data-active')); agents.forEach(c=>c.style.opacity='0'); }
  function report(error) { if (onError) onError(error); else win.console?.error('Mouse Swarm callback or animation failed:',error); }
  function fail(error) { clear(); generation++; restore(); state='error'; report(error); }
  function complete(reason='completed') { clear(); generation++; restore(); next=steps.length; state='complete'; if (onComplete) { try { onComplete({reason, current:steps.length, total:steps.length}); } catch(error) { report(error); } } }
  function delayForNext() { return (next===0?0:interval)+(steps[next]?.delayBefore??0); }
  function schedule(run,ms=delayForNext()) { if (state==='running' && run===generation) timer=win.setTimeout(()=>tick(run),ms); }
  function tick(run) {
    timer=null;
    if(run!==generation || state!=='running') return;
    if(next>=steps.length){complete();return;}
    try {
      const batch=steps[next].batch, first=next;let end=next+1;
      if(batch!==undefined)while(end<steps.length&&steps[end].batch===batch)end++;
      const emitted=[];
      while(next<end){const s=steps[next++];
        if(s.kind==='show') { s.el.removeAttribute('data-ms-hidden'); if(!s.inert) s.el.removeAttribute('inert'); if(autoScroll&&next===first+1) s.el.scrollIntoView?.({behavior:'smooth',block:'center'}); }
        else s.el.textContent+=s.text;
        placeAgents(s.el,s.role,s.kind==='show'&&s.effect==='drag',next-first-1,end-first);
        emitted.push({kind:s.kind,element:s.el,current:next,total:steps.length,...(s.role?{role:s.role}:{}),...(s.group?{group:s.group}:{}),...(s.effect?{effect:s.effect}:{})});
      }
      if(onStep)for(const event of emitted){if(run!==generation||state==='destroyed'||state==='complete'||state==='error')break;onStep(event)}
    } catch(error) { if(run===generation && state!=='destroyed' && state!=='complete') fail(error); else report(error); return; }
    schedule(run);
  }
  function start() {
    if(state==='destroyed') throw new Error('swarm reveal has been destroyed');
    clear(); const run=++generation; restore(); next=0; steps=[]; state='running';
    if(isReduced() || items.length===0){complete(isReduced()?'reduced-motion':'empty'); return;}
    snapshots.forEach(({el,text})=>{el.setAttribute('data-ms-item','');el.setAttribute('data-ms-hidden','');el.setAttribute('inert','');if(typeText&&text!==null)el.textContent=''});
    for(let i=0;i<snapshots.length;){let end=i+1;const group=snapshots[i].group;if(group)while(end<snapshots.length&&snapshots[end].group===group)end++;
      const batch=end-i>1?i:undefined,delay=Math.max(...snapshots.slice(i,end).map(s=>s.delay));
      for(let j=i;j<end;j++){const {el,inert,role,effect}=snapshots[j];steps.push({kind:'show',el,inert,role,effect,group,batch,delayBefore:j===i?delay:0})}
      for(let j=i;j<end;j++){const {el,text,role}=snapshots[j];if(typeText&&text!==null){const words=text.match(/\s*\S+\s*/g)||[];for(let k=0;k<words.length;k+=typeWords)steps.push({kind:'type',el,role,text:words.slice(k,k+typeWords).join('')})}}
      i=end;
    }
    if(steps[0]?.delayBefore) schedule(run,steps[0].delayBefore); else tick(run);
  }
  function pause(){if(state==='running'){clear();state='paused';}}
  function resume(){if(state==='paused'){state='running';schedule(generation);}}
  function motionChanged(event){if(event.matches && (state==='running'||state==='paused')) complete('reduced-motion');}
  if(motion?.addEventListener) motion.addEventListener('change',motionChanged); else motion?.addListener?.(motionChanged);
  function destroy(){if(state==='destroyed')return;clear();generation++;restore();snapshots.forEach(({el,hadItem})=>{if(!hadItem)el.removeAttribute('data-ms-item');if(OWNERS.get(el)===owner)OWNERS.delete(el)});if(motion?.removeEventListener)motion.removeEventListener('change',motionChanged);else motion?.removeListener?.(motionChanged);style.remove();overlay.remove();state='destroyed';}
  function getState(){return {status:state,current:next,total:steps.length};}
  return {start,replay:start,pause,resume,skip:()=>{if(state!=='destroyed') complete('skipped');},destroy,getState};
}

