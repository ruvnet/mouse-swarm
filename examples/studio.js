import { createSwarmReveal } from './mouse-swarm.js';

const OPTION_KEYS=['cursors','interval','typeWords','cursorSpeed','botEvery','selection','typeText','colors'];
const CONTENT_KEYS=['headline','description','action'];
const TARGET_KEYS=['eyebrow','headline','description','coordinate','compose','replay','action'];
const own=(value)=>value!==null && typeof value==='object' && !Array.isArray(value);
const only=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
const integer=(value,min,max)=>Number.isInteger(value) && value>=min && value<=max;

/** The exported format is deliberately bounded and contains no HTML or executable code. */
export function validateStudioConfig(value){
  if(!own(value)||!only(value,['version','options','content','targets'])||value.version!==1||!own(value.options)||!own(value.content)||!only(value.options,OPTION_KEYS)||!only(value.content,CONTENT_KEYS)) throw new TypeError('Invalid studio configuration');
  const o=value.options,c=value.content;
  if(!Array.isArray(value.targets)||value.targets.length<1||value.targets.length>TARGET_KEYS.length||value.targets.some(id=>!TARGET_KEYS.includes(id))||new Set(value.targets).size!==value.targets.length) throw new TypeError('Invalid reveal targets');
  if(!integer(o.cursors,0,80)||!integer(o.interval,20,1000)||o.interval%20!==0||!integer(o.typeWords,1,20)||!integer(o.cursorSpeed,0,2000)||o.cursorSpeed%50!==0||!integer(o.botEvery,0,20)||typeof o.selection!=='boolean'||typeof o.typeText!=='boolean'||!Array.isArray(o.colors)||o.colors.length!==1||typeof o.colors[0]!=='string'||!/^#[\da-f]{6}$/i.test(o.colors[0])) throw new TypeError('Invalid animation options');
  if(typeof c.headline!=='string'||c.headline.length>120||typeof c.description!=='string'||c.description.length>280||typeof c.action!=='string'||c.action.length>50) throw new TypeError('Invalid preview content');
  return {version:1,targets:[...value.targets],options:{cursors:o.cursors,interval:o.interval,typeWords:o.typeWords,cursorSpeed:o.cursorSpeed,botEvery:o.botEvery,selection:o.selection,typeText:o.typeText,colors:[o.colors[0]]},content:{headline:c.headline,description:c.description,action:c.action}};
}

if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id);
  let reveal=null;
  const read=()=>validateStudioConfig({version:1,targets:[...document.querySelectorAll('[data-target]')].filter(el=>el.checked).map(el=>el.dataset.target),options:{cursors:Number($('cursors').value),interval:Number($('interval').value),typeWords:Number($('words').value),cursorSpeed:Number($('speed').value),botEvery:Number($('bots').value),selection:$('selection').checked,typeText:$('typing').checked,colors:[$('color').value]},content:{headline:$('headline').value,description:$('description').value,action:$('action').value}});
  function counters(){for(const id of ['cursors','interval','words','speed','bots']){const value=$(id).value;$(id+'-output').textContent=id==='interval'||id==='speed'?value+' ms':id==='bots'?(value==='0'?'None':'Every '+value):value}}
  function populate(config){const {options:o,content:c}=config;$('cursors').value=o.cursors;$('interval').value=o.interval;$('words').value=o.typeWords;$('speed').value=o.cursorSpeed;$('bots').value=o.botEvery;$('selection').checked=o.selection;$('typing').checked=o.typeText;$('color').value=o.colors[0];$('headline').value=c.headline;$('description').value=c.description;$('action').value=c.action;for(const input of document.querySelectorAll('[data-target]'))input.checked=config.targets.includes(input.dataset.target);counters()}
  function run(){try{const config=read();reveal?.destroy();for(const el of $('reveal').querySelectorAll('[data-studio-target]'))el.toggleAttribute('data-swarm-item',config.targets.includes(el.dataset.studioTarget));$('preview-headline').textContent=config.content.headline;$('preview-description').textContent=config.content.description;$('preview-action').textContent=config.content.action;reveal=createSwarmReveal({...config.options,root:$('reveal'),onStep:({current,total})=>{$('status').textContent=`Building ${current} of ${total}.`},onComplete:({reason})=>{$('status').textContent=`Finished: ${reason}.`},onError:()=>{$('status').textContent='The reveal failed and content was restored.'}});reveal.start()}catch{$('status').textContent='Invalid configuration. Check the values and try again.'}}
  for(const id of ['cursors','interval','words','speed','bots'])$(id).addEventListener('input',counters);
  $('preview').addEventListener('click',run);
  for(const method of ['pause','resume','skip'])$(method).addEventListener('click',()=>{if(!reveal)return;reveal[method]();const state=reveal.getState();$('status').textContent=`${state.status}: ${state.current} of ${state.total}.`});
  $('export').addEventListener('click',()=>{try{const data=JSON.stringify(read(),null,2)+'\n';const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mouse-swarm-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Configuration downloaded.'}catch{$('status').textContent='Could not export this configuration.'}});
  $('import').addEventListener('change',async event=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>65536)throw new Error('File too large');const config=validateStudioConfig(JSON.parse(await file.text()));populate(config);run();$('status').textContent='Configuration loaded and preview started.'}catch{$('status').textContent='Could not load configuration. Use a valid studio JSON file under 64 KB.'}finally{event.target.value=''}});
  addEventListener('pagehide',event=>{if(!event.persisted)reveal?.destroy()});
  counters();run();
}
