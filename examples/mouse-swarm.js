/** A visual-only swarm. No analytics, network calls, OS input, or agents. */
const palette = ['#cef575','#70c9f9','#c9acff','#ffb37a','#ed81ba','#8ee6ce','#f8d66a'];
const css = `
[data-ms-item]{transition:opacity .35s ease,transform .4s ease,filter .35s ease}
[data-ms-item][data-ms-hidden]{opacity:0;transform:translateY(7px);filter:blur(2px)}
.ms-overlay{position:fixed;inset:0;z-index:2147483646;pointer-events:none;overflow:hidden}
.ms-cursor{position:absolute;left:50%;top:50%;opacity:0;transition:left .7s ease,top .7s ease,opacity .3s ease;filter:drop-shadow(0 2px 3px #0009)}
.ms-cursor svg{display:block;width:15px;height:18px}.ms-cursor.bot svg{width:22px;height:24px;filter:drop-shadow(0 0 4px #259ef2)}
.ms-selection{position:absolute;border:1px solid #70bdff;background:#80baff10;box-shadow:0 0 12px #68b6ff22;opacity:0;transition:left .18s,top .18s,width .18s,height .18s,opacity .18s}
.ms-selection[data-active]{opacity:1}.ms-selection::before,.ms-selection::after{content:'';position:absolute;width:6px;height:6px;background:#b5e7ff;border:1px solid #3180b1}.ms-selection::before{left:-4px;top:-4px}.ms-selection::after{right:-4px;bottom:-4px}
@media(prefers-reduced-motion:reduce){[data-ms-item]{transition:none!important}.ms-overlay{display:none!important}}
`;
const arrow = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M2 2 L2 21 L7 17 L11 25 L15 23 L11 15 L19 15 Z" fill="currentColor" stroke="#10151b" stroke-width="1.5"/></svg>';
const bot = '<svg viewBox="0 0 24 26" aria-hidden="true"><path fill="#3dc7ff" stroke="#bdeeff" stroke-width=".7" d="M6 5h12v3h3v11h-3v4H6v-4H3V8h3z"/><path fill="#efffff" d="M7 9h3v3H7zm7 0h3v3h-3z"/><path stroke="#dafaff" d="M9 16h6M12 5V2M5 23h4m6 0h4"/></svg>';

/**
 * Reveal descendants selected by `selector` in document order.
 * Returns start, replay, skip, and destroy controls. A caller owns one instance
 * per root. Text typing is opt-in and only applies to elements with no children.
 */
export function createSwarmReveal({ root = document, selector = '[data-swarm-item]', cursors = 20, interval = 280, typeText = true, onComplete } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') throw new TypeError('root must support querySelectorAll');
  if (typeof selector !== 'string' || !selector) throw new TypeError('selector must be a non-empty string');
  if (!Number.isFinite(interval) || interval < 20) throw new RangeError('interval must be at least 20ms');
  if (!Number.isInteger(cursors) || cursors < 0 || cursors > 80) throw new RangeError('cursors must be an integer from 0 to 80');
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc.defaultView;
  const items = [...root.querySelectorAll(selector)];
  const snapshots = items.map(el => ({el, text: el.hasAttribute('data-swarm-type') && el.children.length === 0 ? el.textContent : null, hadItem: el.hasAttribute('data-ms-item'), hidden: el.hasAttribute('data-ms-hidden')}));
  const reduced = !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
  const overlay = doc.createElement('div'); overlay.className = 'ms-overlay'; overlay.setAttribute('aria-hidden','true');
  const box = doc.createElement('div'); box.className = 'ms-selection'; overlay.append(box);
  const agents = Array.from({length:cursors}, (_, i) => {const c = doc.createElement('div'); c.className = 'ms-cursor' + (i % 5 === 4 ? ' bot' : ''); c.style.color = palette[i % palette.length]; c.style.transitionDuration = `${.5 + (i % 5) * .13}s`; c.innerHTML = i % 5 === 4 ? bot : arrow; overlay.append(c); return c;});
  doc.body.append(overlay);
  let timer = null, generation = 0, next = 0, steps = [], target = null, destroyed = false;
  function clear() { if (timer !== null) win.clearTimeout(timer); timer = null; }
  function placeAgents(el) {
    if (!el || reduced) return;
    const r = el.getBoundingClientRect(), w = win.innerWidth, h = win.innerHeight;
    if (r.bottom < 0 || r.top > h) { box.removeAttribute('data-active'); return; }
    const x = Math.max(8,Math.min(w-30,r.left+Math.min(r.width,220)*.6));
    const y = Math.max(8,Math.min(h-30,r.top+Math.min(r.height,50)*.5));
    Object.assign(box.style,{left:`${Math.max(0,r.left)}px`,top:`${Math.max(0,r.top)}px`,width:`${Math.min(Math.max(r.width,25),w*.7,520)}px`,height:`${Math.min(Math.max(r.height,18),200)}px`}); box.setAttribute('data-active','');
    agents.forEach((c,i)=>{ const near = i%3 !== 0; c.style.opacity='1'; c.style.left=`${Math.max(4,Math.min(w-20,near?x+(Math.random()-.5)*170:Math.random()*w))}px`; c.style.top=`${Math.max(4,Math.min(h-20,near?y+(Math.random()-.5)*110:Math.random()*h))}px`; });
  }
  function restore() { snapshots.forEach(({el,text})=>{el.removeAttribute('data-ms-hidden'); if(text !== null) el.textContent=text;}); box.removeAttribute('data-active'); agents.forEach(c=>c.style.opacity='0'); }
  function complete(notify=true) { clear(); generation++; restore(); if (notify && typeof onComplete === 'function') onComplete(); }
  function start() {
    if(destroyed) throw new Error('swarm reveal has been destroyed');
    clear(); const run=++generation; restore(); next=0; steps=[];
    if(reduced || items.length===0){ if(typeof onComplete==='function') onComplete(); return; }
    snapshots.forEach(({el,text})=>{
      el.setAttribute('data-ms-item',''); el.setAttribute('data-ms-hidden','');
      steps.push({kind:'show',el});
      if(typeText && text !== null){el.textContent=''; const words=text.match(/\s*\S+\s*/g)||[]; for(let i=0;i<words.length;i+=3) steps.push({kind:'type',el,text:words.slice(i,i+3).join('')});}
    });
    const tick=()=>{if(run!==generation||destroyed)return; if(next>=steps.length){complete();return;}const s=steps[next++]; target=s.el; if(s.kind==='show')s.el.removeAttribute('data-ms-hidden');else s.el.textContent+=s.text; placeAgents(target);timer=win.setTimeout(tick,interval)};
    tick();
  }
  function destroy(){if(destroyed)return;clear();generation++;restore();snapshots.forEach(({el,hadItem,hidden})=>{if(!hadItem)el.removeAttribute('data-ms-item');if(hidden)el.setAttribute('data-ms-hidden','')});style.remove();overlay.remove();destroyed=true;}
  return {start,replay:start,skip:()=>{if(!destroyed)complete();},destroy};
}
