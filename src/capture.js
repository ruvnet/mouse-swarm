/** Render a bounded, visual reconstruction of one trusted local page viewport. */
import {mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

export const DEFAULT_CAPTURE_SELECTOR='h1,h2,h3,h4,h5,h6,p,li,button,a,img,svg,canvas,input,[role="button"]';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;

/** Validate numbers and text separately from source HTML: no original markup enters the output. */
export function validateCaptureSpec({width=1280,height=800,selector=DEFAULT_CAPTURE_SELECTOR,maxTargets=100,cursors=20,interval=280}={}){
 if(!integer(width,320,1920)||!integer(height,320,1920))throw new RangeError('viewport dimensions must be integers from 320 to 1920');
 if(typeof selector!=='string'||!selector.trim()||selector.length>512)throw new TypeError('selector must be a nonempty CSS selector under 513 characters');
 if(!integer(maxTargets,1,200))throw new RangeError('maxTargets must be from 1 to 200');
 if(!integer(cursors,0,80)||!integer(interval,20,10000))throw new RangeError('invalid reveal timing or cursor count');
 return Object.freeze({width,height,selector,maxTargets,cursors,interval});
}
function cleanTargets(input,spec){
 if(!Array.isArray(input)||input.length>spec.maxTargets)throw new TypeError('invalid capture targets');
 return input.map((t,i)=>{
  if(!t||![t.x,t.y,t.width,t.height].every(Number.isFinite)||!integer(t.x,0,spec.width-1)||!integer(t.y,0,spec.height-1)||!integer(t.width,1,spec.width)||!integer(t.height,1,spec.height)||t.x+t.width>spec.width||t.y+t.height>spec.height)throw new TypeError(`invalid capture target ${i}`);
  if(typeof t.label!=='string'||t.label.length>160)throw new TypeError('invalid target label');
  return {x:t.x,y:t.y,width:t.width,height:t.height,label:t.label};
 });
}
/** HTML contains only escaped labels and validated geometry, never source scripts or URLs. */
export function buildCaptureDocument(spec,input){
 spec=validateCaptureSpec(spec);const targets=cleanTargets(input,spec);
 const parts=targets.map((t,i)=>`<div class="fragment" data-swarm-item data-capture-index="${i}" aria-hidden="true" style="z-index:${i};left:${t.x}px;top:${t.y}px;width:${t.width}px;height:${t.height}px;background-position:-${t.x}px -${t.y}px"></div>`).join('\n');
 const accessible=targets.map(t=>`<li>${esc(t.label||'Visual element')}</li>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Captured page reveal</title><style>*{box-sizing:border-box}body{margin:0;background:#101510;color:#fff;font:14px system-ui,sans-serif}.canvas{position:relative;width:${spec.width}px;height:${spec.height}px;background:url('./background.png') 0 0 / ${spec.width}px ${spec.height}px no-repeat;overflow:hidden}.fragment{position:absolute;background-image:url('./page.png');background-size:${spec.width}px ${spec.height}px;background-repeat:no-repeat}.controls{position:fixed;z-index:2147483647;bottom:12px;left:50%;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:8px;background:#101b17ee;border:1px solid #41584a;border-radius:10px}.controls button,.sequence button{font:inherit;border:1px solid #728978;color:#fff;background:#21352a;border-radius:6px;padding:8px}.sequence{position:fixed;z-index:2147483647;right:12px;top:12px;width:min(390px,95vw);max-height:75vh;overflow:auto;padding:16px;background:#101b17f5;border:1px solid #728978;border-radius:10px}.sequence li{margin-bottom:8px}.sequence li span{display:block;overflow-wrap:anywhere}.sequence li button{margin:4px 4px 0 0}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:${spec.width-1}px){.canvas{max-width:100%;overflow:hidden}}</style></head><body><main aria-label="Visual reconstruction of the captured page"><div class="canvas" id="captured">${parts}</div><div class="sr-only"><p>This is a static visual reconstruction. Original links and controls are not interactive.</p><ol id="capture-labels">${accessible}</ol></div></main><nav class="controls" aria-label="Reveal controls"><button id="replay">Replay</button><button id="pause">Pause</button><button id="resume">Resume</button><button id="skip">Skip</button><button id="edit-sequence" aria-controls="sequence-panel" aria-expanded="false">Edit sequence</button></nav><section class="sequence" id="sequence-panel" aria-label="Edit reveal sequence" hidden><h2>Edit sequence</h2><p>Move items, then apply. Download sequence.js and replace the file in the capture folder to retain your changes.</p><ol id="sequence-list"></ol><button id="apply-sequence">Apply and replay</button> <button id="download-sequence">Download sequence.js</button> <button id="close-sequence">Close</button><p id="sequence-status" role="status" aria-live="polite"></p></section><script type="module">import {createSwarmReveal} from './mouse-swarm.js';import {sequence} from './sequence.js';const canvas=document.querySelector('#captured'),items=Array.from(canvas.querySelectorAll('[data-swarm-item]')),labels=Array.from(document.querySelectorAll('#capture-labels li'),e=>e.textContent);let order=Array.isArray(sequence)&&sequence.length===items.length&&new Set(sequence).size===items.length&&sequence.every(i=>Number.isInteger(i)&&i>=0&&i<items.length)?[...sequence]:items.map((_,i)=>i);let reveal;const panel=document.getElementById('sequence-panel'),edit=document.getElementById('edit-sequence'),list=document.getElementById('sequence-list'),status=document.getElementById('sequence-status');function draw(){list.replaceChildren();order.forEach((id,index)=>{const row=document.createElement('li'),label=document.createElement('span'),up=document.createElement('button'),down=document.createElement('button');label.textContent=labels[id]||('Visual element '+(id+1));up.textContent='Move up';down.textContent='Move down';up.disabled=index===0;down.disabled=index===order.length-1;up.addEventListener('click',()=>{[order[index-1],order[index]]=[order[index],order[index-1]];draw();status.textContent='Moved item up.'});down.addEventListener('click',()=>{[order[index+1],order[index]]=[order[index],order[index+1]];draw();status.textContent='Moved item down.'});row.append(label,up,down);list.append(row)})}function close(){panel.hidden=true;edit.setAttribute('aria-expanded','false')}function apply(){reveal?.destroy();for(const id of order)canvas.append(items[id]);reveal=createSwarmReveal({root:canvas,cursors:${spec.cursors},interval:${spec.interval},labels:['Scout','Builder','Reviewer']});reveal.start()}edit.addEventListener('click',()=>{reveal?.pause();panel.hidden=false;edit.setAttribute('aria-expanded','true');draw()});document.getElementById('close-sequence').addEventListener('click',close);document.getElementById('apply-sequence').addEventListener('click',()=>{apply();close()});document.getElementById('download-sequence').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob(['export const sequence = '+JSON.stringify(order)+';\\n'],{type:'text/javascript'})),a=document.createElement('a');a.href=url;a.download='sequence.js';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Sequence downloaded. Replace sequence.js in the capture folder.'});for(const id of ['replay','pause','resume','skip'])document.getElementById(id).addEventListener('click',()=>reveal?.[id]());await Promise.all(['./background.png','./page.png'].map(src=>new Promise(resolve=>{const image=new Image();image.onload=resolve;image.onerror=resolve;image.src=src})));apply();</script></body></html>`;
}
/** page must be an already loaded Playwright page with deviceScaleFactor 1. */
export async function captureViewport({page,outputDir,...options}={}){
 const spec=validateCaptureSpec(options);
 if(!page||typeof page.evaluate!=='function'||typeof page.screenshot!=='function'||typeof page.setViewportSize!=='function')throw new TypeError('a Playwright page is required');
 if(typeof outputDir!=='string'||!outputDir||outputDir.includes('\0'))throw new TypeError('output directory required');
 await page.setViewportSize({width:spec.width,height:spec.height});
 // Input is trusted local HTML; caller must prevent external network and script execution unless explicitly enabled.
 const targets=await page.evaluate(({selector,maxTargets,width,height})=>{
  const nodes=Array.from(document.querySelectorAll(selector)).slice(0,5000),chosen=[];
  for(const element of nodes){
   if(chosen.length>=maxTargets)break;
   const style=getComputedStyle(element),rect=element.getBoundingClientRect();
   if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0||rect.width<2||rect.height<2||rect.right<=0||rect.bottom<=0||rect.left>=width||rect.top>=height)continue;
   if(chosen.some(x=>x.element.contains(element)))continue;
   const x=Math.max(0,Math.floor(rect.left)),y=Math.max(0,Math.floor(rect.top));
   const right=Math.min(width,Math.ceil(rect.right)),bottom=Math.min(height,Math.ceil(rect.bottom));
   if(right<=x||bottom<=y||(right-x)*(bottom-y)>width*height*.8)continue;
   const label=(element.getAttribute('alt')||element.getAttribute('aria-label')||element.textContent||'Visual element').replace(/\s+/g,' ').trim().slice(0,160);
   chosen.push({element,x,y,width:right-x,height:bottom-y,label});
  }
  window.__mouseSwarmCaptureTargets=chosen.map(x=>x.element);
  return chosen.map(({element,...box})=>box);
 },spec);
 cleanTargets(targets,spec);
 if(!targets.length)throw new Error('no visible capture targets found');
 const pageImage=await page.screenshot({type:'png',animations:'disabled'});
 let backgroundImage;
 try{
  await page.evaluate(()=>{for(const e of window.__mouseSwarmCaptureTargets||[]){e.__mouseSwarmOriginalVisibility=[e.style.getPropertyValue('visibility'),e.style.getPropertyPriority('visibility')];e.style.setProperty('visibility','hidden','important')}});
  backgroundImage=await page.screenshot({type:'png',animations:'disabled'});
 }finally{
  await page.evaluate(()=>{for(const e of window.__mouseSwarmCaptureTargets||[]){const original=e.__mouseSwarmOriginalVisibility;if(original){if(original[0])e.style.setProperty('visibility',original[0],original[1]);else e.style.removeProperty('visibility');delete e.__mouseSwarmOriginalVisibility}}delete window.__mouseSwarmCaptureTargets}).catch(()=>{});
 }
 // A new, exclusive directory avoids replacing a user's existing page.
 await mkdir(outputDir,{recursive:false});
 try{
  await writeFile(join(outputDir,'index.html'),buildCaptureDocument(spec,targets),{flag:'wx'});
  await writeFile(join(outputDir,'page.png'),pageImage,{flag:'wx'});
  await writeFile(join(outputDir,'background.png'),backgroundImage,{flag:'wx'});
  await writeFile(join(outputDir,'capture.json'),JSON.stringify({version:1,viewport:{width:spec.width,height:spec.height},targets},null,2)+'\n',{flag:'wx'});
  await writeFile(join(outputDir,'sequence.js'),'// Reorder these zero-based target indices to change the reveal sequence.\nexport const sequence = '+JSON.stringify(targets.map((_,i)=>i))+';\n',{flag:'wx'});
  await copyFile(fileURLToPath(new URL('./index.js',import.meta.url)),join(outputDir,'mouse-swarm.js'),1);
 }catch(error){await rm(outputDir,{recursive:true,force:true});throw error}
 return Object.freeze({outputDir,width:spec.width,height:spec.height,targets:targets.length});
}
