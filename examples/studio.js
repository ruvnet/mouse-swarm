import { createSwarmReveal } from './mouse-swarm.js';

const OPTION_KEYS=['cursors','interval','typeWords','cursorSpeed','botEvery','selection','typeText','colors'];
const CONTENT_KEYS=['headline','description','action'];
const TARGET_KEYS=['eyebrow','headline','description','coordinate','compose','replay','action'];
const IMPORT_TAGS=['h1','h2','h3','h4','h5','h6','p','li','button','a','blockquote'];
const IGNORED_TAGS=new Set(['script','style','template','noscript','svg','math','iframe','object','embed','textarea','select','title','head']);
const own=(value)=>value!==null && typeof value==='object' && !Array.isArray(value);
const only=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
const integer=(value,min,max)=>Number.isInteger(value) && value>=min && value<=max;
function cleanOptions(o){
  if(!own(o)||!only(o,OPTION_KEYS)||!integer(o.cursors,0,80)||!integer(o.interval,20,1000)||o.interval%20!==0||!integer(o.typeWords,1,20)||!integer(o.cursorSpeed,0,2000)||o.cursorSpeed%50!==0||!integer(o.botEvery,0,20)||typeof o.selection!=='boolean'||typeof o.typeText!=='boolean'||!Array.isArray(o.colors)||o.colors.length!==1||typeof o.colors[0]!=='string'||!/^#[\da-f]{6}$/i.test(o.colors[0])) throw new TypeError('Invalid animation options');
  return {cursors:o.cursors,interval:o.interval,typeWords:o.typeWords,cursorSpeed:o.cursorSpeed,botEvery:o.botEvery,selection:o.selection,typeText:o.typeText,colors:[o.colors[0]]};
}
/** The exported format is bounded and contains text, never HTML or executable code. */
export function validateStudioConfig(value){
  if(!own(value))throw new TypeError('Invalid studio configuration');
  const options=cleanOptions(value.options);
  if(value.version===2){
    if(!only(value,['version','options','items'])||!Array.isArray(value.items)||value.items.length<1||value.items.length>50)throw new TypeError('Invalid imported items');
    const items=value.items.map(item=>{
      if(!own(item)||!only(item,['tag','text','enabled'])||!IMPORT_TAGS.includes(item.tag)||typeof item.text!=='string'||!item.text.trim()||item.text.length>500||typeof item.enabled!=='boolean')throw new TypeError('Invalid imported item');
      return {tag:item.tag,text:item.text,enabled:item.enabled};
    });
    if(!items.some(item=>item.enabled))throw new TypeError('Select at least one item');
    return {version:2,options,items};
  }
  if(!only(value,['version','options','content','targets'])||value.version!==1||!own(value.content)||!only(value.content,CONTENT_KEYS))throw new TypeError('Invalid studio configuration');
  const c=value.content;
  if(!Array.isArray(value.targets)||value.targets.length<1||value.targets.length>TARGET_KEYS.length||value.targets.some(id=>!TARGET_KEYS.includes(id))||new Set(value.targets).size!==value.targets.length)throw new TypeError('Invalid reveal targets');
  if(typeof c.headline!=='string'||c.headline.length>120||typeof c.description!=='string'||c.description.length>280||typeof c.action!=='string'||c.action.length>50)throw new TypeError('Invalid preview content');
  return {version:1,targets:[...value.targets],options,content:{headline:c.headline,description:c.description,action:c.action}};
}

/** Extract a bounded text-only outline without parsing HTML into a live or detached DOM. */
export function extractHtmlItems(html){
  if(typeof html!=='string'||html.length>524288)throw new RangeError('HTML must be under 512 KB');
  const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(full,key)=>{
    if(key[0]!=='#')return entities[key.toLowerCase()]??full;
    const hex=key[1]?.toLowerCase()==='x',n=parseInt(key.slice(hex?2:1),hex?16:10);
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';
  });
  const items=[];let current=null,ignore=0,ignoredRoot=null;
  const tokens=html.match(/<!--[\s\S]*?(?:-->|$)|<![^>]*(?:>|$)|<\/?[A-Za-z][^>]*(?:>|$)|[^<]+|</g)||[];
  for(const token of tokens){
    if(token.startsWith('<!--')||token.startsWith('<!'))continue;
    const tagMatch=token.match(/^<\s*(\/?)\s*([a-zA-Z][\w:-]*)\b/);
    if(tagMatch){
      const closing=!!tagMatch[1],tag=tagMatch[2].toLowerCase();
      if(ignore){if(tag===ignoredRoot){if(closing)ignore--;else if(!/\/\s*>$/.test(token))ignore++}if(!ignore)ignoredRoot=null;continue}
      if(!closing&&IGNORED_TAGS.has(tag)){ignore=1;ignoredRoot=tag;continue}
      if(!current&&!closing&&IMPORT_TAGS.includes(tag)){current={tag,text:''};continue}
      if(current&&closing&&tag===current.tag){const text=decode(current.text).replace(/\s+/g,' ').trim().slice(0,500);if(text)items.push({tag:current.tag,text,enabled:true});current=null;if(items.length===50)break;continue}
      if(current&&tag==='br')current.text+=' ';
    } else if(!ignore&&current&&token!=='<') current.text+=' '+token;
  }
  return items;
}

if(typeof document!=='undefined'){
  const $=id=>document.getElementById(id);
  let reveal=null,importItems=null;
  const options=()=>({cursors:Number($('cursors').value),interval:Number($('interval').value),typeWords:Number($('words').value),cursorSpeed:Number($('speed').value),botEvery:Number($('bots').value),selection:$('selection').checked,typeText:$('typing').checked,colors:[$('color').value]});
  const read=()=>validateStudioConfig(importItems?{version:2,options:options(),items:importItems.map((item,i)=>({...item,enabled:$('import-target-list').querySelectorAll('input')[i].checked}))}:{version:1,targets:[...document.querySelectorAll('[data-target]')].filter(el=>el.checked).map(el=>el.dataset.target),options:options(),content:{headline:$('headline').value,description:$('description').value,action:$('action').value}});
  function counters(){for(const id of ['cursors','interval','words','speed','bots']){const value=$(id).value;$(id+'-output').textContent=id==='interval'||id==='speed'?value+' ms':id==='bots'?(value==='0'?'None':'Every '+value):value}}
  function displayItems(items){
    importItems=items.map(item=>({...item}));const list=$('import-target-list');list.replaceChildren();
    for(const item of importItems){const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');label.className='check';input.type='checkbox';input.checked=item.enabled;text.textContent=`${item.tag.toUpperCase()}: ${item.text.slice(0,80)}`;label.append(input,text);list.append(label)}
    $('sample-content').hidden=true;$('sample-targets').hidden=true;$('import-targets').hidden=false;$('import-state').textContent=`Imported ${items.length} text items. Original styling, links, images, scripts and layout are omitted.`;
  }
  function useSample(){importItems=null;$('sample-content').hidden=false;$('sample-targets').hidden=false;$('import-targets').hidden=true;$('import-state').textContent='Using the sample page.';run()}
  function populate(config){const o=config.options;$('cursors').value=o.cursors;$('interval').value=o.interval;$('words').value=o.typeWords;$('speed').value=o.cursorSpeed;$('bots').value=o.botEvery;$('selection').checked=o.selection;$('typing').checked=o.typeText;$('color').value=o.colors[0];if(config.version===2)displayItems(config.items);else{importItems=null;$('sample-content').hidden=false;$('sample-targets').hidden=false;$('import-targets').hidden=true;const c=config.content;$('headline').value=c.headline;$('description').value=c.description;$('action').value=c.action;for(const input of document.querySelectorAll('[data-target]'))input.checked=config.targets.includes(input.dataset.target);$('import-state').textContent='Using the sample page.'}counters()}
  function run(){try{
    const config=read();reveal?.destroy();let root;
    if(config.version===2){
      $('reveal').hidden=true;root=$('import-preview');root.hidden=false;root.replaceChildren();
      for(const item of config.items){const el=document.createElement(item.tag==='a'?'span':item.tag);el.textContent=item.text;if(item.enabled){el.setAttribute('data-swarm-item','');el.setAttribute('data-swarm-type','')}root.append(el)}
    }else{
      root=$('reveal');root.hidden=false;$('import-preview').hidden=true;for(const el of root.querySelectorAll('[data-studio-target]'))el.toggleAttribute('data-swarm-item',config.targets.includes(el.dataset.studioTarget));$('preview-headline').textContent=config.content.headline;$('preview-description').textContent=config.content.description;$('preview-action').textContent=config.content.action;
    }
    reveal=createSwarmReveal({...config.options,root,onStep:({current,total})=>{$('status').textContent=`Building ${current} of ${total}.`},onComplete:({reason})=>{$('status').textContent=`Finished: ${reason}.`},onError:()=>{$('status').textContent='The reveal failed and content was restored.'}});reveal.start();
  }catch{$('status').textContent='Invalid configuration. Check the values and try again.'}}
  for(const id of ['cursors','interval','words','speed','bots'])$(id).addEventListener('input',counters);
  $('preview').addEventListener('click',run);$('use-sample').addEventListener('click',useSample);
  for(const method of ['pause','resume','skip'])$(method).addEventListener('click',()=>{if(!reveal)return;reveal[method]();const state=reveal.getState();$('status').textContent=`${state.status}: ${state.current} of ${state.total}.`});
  $('export').addEventListener('click',()=>{try{const data=JSON.stringify(read(),null,2)+'\n';const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mouse-swarm-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('status').textContent='Configuration downloaded.'}catch{$('status').textContent='Could not export this configuration.'}});
  $('import').addEventListener('change',async event=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>65536)throw new Error('File too large');const config=validateStudioConfig(JSON.parse(await file.text()));populate(config);run();$('status').textContent='Configuration loaded and preview started.'}catch{$('status').textContent='Could not load configuration. Use a valid studio JSON file under 64 KB.'}finally{event.target.value=''}});
  $('html-import').addEventListener('change',async event=>{try{const file=event.target.files?.[0];if(!file)return;if(file.size>524288)throw new Error('File too large');const items=extractHtmlItems(await file.text());if(!items.length)throw new Error('No supported text items found');displayItems(items);run()}catch{$('import-state').textContent='Could not import HTML. Choose a file under 512 KB with heading, paragraph, list, button, or link text.'}finally{event.target.value=''}});
  addEventListener('pagehide',event=>{if(!event.persisted)reveal?.destroy()});
  counters();run();
}
