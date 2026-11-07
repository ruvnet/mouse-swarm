/** Visual-only cursor choreography. No telemetry, network calls, OS input, or agents. */
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
  autoScroll = false, onStep, onComplete
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
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc.defaultView;
  const items = [...root.querySelectorAll(selector)];
  const snapshots = items.map(el => ({el, text: el.hasAttribute('data-swarm-type') && el.children.length === 0 ? el.textContent : null, hadItem: el.hasAttribute('data-ms-item'), hidden: el.hasAttribute('data-ms-hidden')}));
  const reduced = !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
  doc.body.append(overlay);
  let timer = null, generation = 0, next = 0, steps = [], state = 'idle';
  function clear() { if (timer !== null) win.clearTimeout(timer); timer = null; }
  function placeAgents(el) {
    if (!el || reduced) return;
    const r = el.getBoundingClientRect(), w = win.innerWidth, h = win.innerHeight;
    if (r.bottom < 0 || r.top > h) { box.removeAttribute('data-active'); return; }
    const x = Math.max(8,Math.min(w-30,r.left+Math.min(r.width,220)*.6));
    const y = Math.max(8,Math.min(h-30,r.top+Math.min(r.height,50)*.5));
    if (selection) { Object.assign(box.style,{left:`${Math.max(0,r.left)}px`,top:`${Math.max(0,r.top)}px`,width:`${Math.min(Math.max(r.width,25),w*.7,520)}px`,height:`${Math.min(Math.max(r.height,18),200)}px`}); box.setAttribute('data-active',''); }
    agents.forEach((c,i)=>{ const near = i%3 !== 0; c.style.opacity='1'; c.style.left=`${Math.max(4,Math.min(w-20,near?x+(Math.random()-.5)*170:Math.random()*w))}px`; c.style.top=`${Math.max(4,Math.min(h-20,near?y+(Math.random()-.5)*110:Math.random()*h))}px`; });
  }
  function restore() { snapshots.forEach(({el,text})=>{el.removeAttribute('data-ms-hidden'); if(text !== null) el.textContent=text;}); box.removeAttribute('data-active'); agents.forEach(c=>c.style.opacity='0'); }
  function complete(reason='completed') { clear(); generation++; restore(); next=steps.length; state='complete'; if (onComplete) onComplete({reason, current:steps.length, total:steps.length}); }
  function schedule(run) { if (state==='running' && run===generation) timer=win.setTimeout(()=>tick(run),interval); }
  function tick(run) {
    timer=null;
    if(run!==generation || state!=='running') return;
    if(next>=steps.length){complete();return;}
    const s=steps[next++];
    if(s.kind==='show') { s.el.removeAttribute('data-ms-hidden'); if(autoScroll) s.el.scrollIntoView?.({behavior:'smooth',block:'center'}); }
    else s.el.textContent+=s.text;
    placeAgents(s.el);
    if(onStep) onStep({kind:s.kind,element:s.el,current:next,total:steps.length});
    schedule(run);
  }
  function start() {
    if(state==='destroyed') throw new Error('swarm reveal has been destroyed');
    clear(); const run=++generation; restore(); next=0; steps=[]; state='running';
    if(reduced || items.length===0){complete(reduced?'reduced-motion':'empty'); return;}
    snapshots.forEach(({el,text})=>{
      el.setAttribute('data-ms-item',''); el.setAttribute('data-ms-hidden',''); steps.push({kind:'show',el});
      if(typeText && text !== null){el.textContent=''; const words=text.match(/\s*\S+\s*/g)||[]; for(let i=0;i<words.length;i+=typeWords) steps.push({kind:'type',el,text:words.slice(i,i+typeWords).join('')});}
    });
    tick(run);
  }
  function pause(){if(state==='running'){clear();state='paused';}}
  function resume(){if(state==='paused'){state='running';schedule(generation);}}
  function destroy(){if(state==='destroyed')return;clear();generation++;restore();snapshots.forEach(({el,hadItem,hidden})=>{if(!hadItem)el.removeAttribute('data-ms-item');if(hidden)el.setAttribute('data-ms-hidden','')});style.remove();overlay.remove();state='destroyed';}
  function getState(){return {status:state,current:next,total:steps.length};}
  return {start,replay:start,pause,resume,skip:()=>{if(state!=='destroyed') complete('skipped');},destroy,getState};
}
