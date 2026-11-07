import {test} from 'node:test';import assert from 'node:assert/strict';import {createSwarmReveal} from '../src/index.js';
function fixture(reduced=false){let queue=[];const delays=[];class E{constructor(tag='div'){this.tag=tag;this.attrs=new Map;this.style={setProperty(k,v){this[k]=v}};this.children=[];this.textContent='';this.ownerDocument=doc} append(x){this.children.push(x)}remove(){this.removed=true}setAttribute(k,v){this.attrs.set(k,v)}removeAttribute(k){this.attrs.delete(k)}hasAttribute(k){return this.attrs.has(k)}getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null}getBoundingClientRect(){return{left:100,top:100,bottom:150,width:300,height:50}}}const media={matches:reduced,listener:null,addEventListener(name,fn){this.listener=fn},removeEventListener(){this.listener=null}};const win={innerWidth:1000,innerHeight:800,matchMedia:()=>media,setTimeout(fn,ms){delays.push(ms);queue.push(fn);return queue.length},clearTimeout(){queue=[]}};const doc={nodeType:9,defaultView:win,head:null,body:null,createElement:tag=>new E(tag),querySelectorAll:()=>items};doc.head=new E;doc.body=new E;const first=new E,second=new E;first.textContent='One two three four five';first.setAttribute('data-swarm-type','');second.textContent='Done';const items=[first,second];return {doc,items,media,delays,advance(){let n=0;while(queue.length&&n++<100)queue.shift()()}}}
test('reveals and types in order, replay, skip, and destroy restore content',()=>{const f=fixture();let calls=0;const r=createSwarmReveal({root:f.doc,cursors:3,interval:25,onComplete:()=>calls++});r.start();assert.equal(f.items[0].textContent,'');assert.equal(f.items[1].hasAttribute('data-ms-hidden'),true);f.advance();assert.equal(f.items[0].textContent,'One two three four five');assert.equal(f.items[1].hasAttribute('data-ms-hidden'),false);assert.equal(calls,1);r.replay();assert.equal(f.items[1].hasAttribute('data-ms-hidden'),true);r.skip();assert.equal(f.items[0].textContent,'One two three four five');r.destroy();assert.equal(f.items[0].hasAttribute('data-ms-item'),false);assert.throws(()=>r.start(),/destroyed/)});
test('reduced motion reveals immediately without scheduling',()=>{const f=fixture(true);const r=createSwarmReveal({root:f.doc,cursors:0});r.start();assert.equal(f.items[0].textContent,'One two three four five');assert.equal(f.items[0].hasAttribute('data-ms-hidden'),false)});
test('rejects invalid configuration',()=>{const f=fixture();assert.throws(()=>createSwarmReveal({root:f.doc,interval:0}),RangeError);assert.throws(()=>createSwarmReveal({root:f.doc,cursors:81}),RangeError)});

test('custom options configure cursors, labels, selection, typing and progress',()=>{const f=fixture(),events=[];let completed;const r=createSwarmReveal({root:f.doc,cursors:2,interval:25,colors:['#fff'],botEvery:1,cursorSize:24,cursorSpeed:400,selection:false,labels:['<safe>'],typeWords:1,onStep:e=>events.push(e),onComplete:e=>completed=e});r.start();const overlay=f.doc.body.children[0],box=overlay.children[0],bot=overlay.children[1];assert.equal(bot.className,'ms-cursor bot');assert.equal(bot.style.color,'#fff');assert.equal(bot.style['--ms-size'],'24px');assert.equal(bot.children[0].children[0].textContent,'<safe>');assert.equal(box.hasAttribute('data-active'),false);f.advance();assert.equal(events.filter(e=>e.kind==='type').length,5);assert.equal(events.at(-1).current,events.at(-1).total);assert.equal(completed.reason,'completed');assert.equal(r.getState().status,'complete')});
test('pause and resume preserve progress; skip emits a reason',()=>{const f=fixture(),reasons=[];const r=createSwarmReveal({root:f.doc,cursors:0,interval:25,onComplete:e=>reasons.push(e.reason)});r.start();assert.equal(r.getState().status,'running');r.pause();const current=r.getState().current;f.advance();assert.equal(r.getState().current,current);assert.equal(r.getState().status,'paused');r.resume();f.advance();assert.equal(r.getState().status,'complete');r.replay();r.skip();assert.equal(reasons.at(-1),'skipped');assert.equal(r.getState().status,'complete');assert.equal(r.getState().current,r.getState().total);r.destroy();assert.equal(r.getState().status,'destroyed')});
test('callbacks may pause or skip without a stale timer resuming the run',()=>{const f=fixture();let r;let calls=0;r=createSwarmReveal({root:f.doc,cursors:0,interval:25,onStep:()=>{calls++;if(calls===2)r.pause()}});r.start();f.advance();assert.equal(r.getState().status,'paused');assert.equal(calls,2);r.skip();f.advance();assert.equal(calls,2)});
test('custom option validation fails closed',()=>{const f=fixture();for(const opt of [{typeWords:0},{botEvery:-1},{cursorSize:7},{cursorSpeed:-1},{colors:[]},{labels:[42]},{selection:'yes'},{onStep:3}])assert.throws(()=>createSwarmReveal({root:f.doc,...opt}))});
test('optional autoScroll is called only for revealed elements',()=>{const f=fixture();let calls=0;f.items.forEach(x=>x.scrollIntoView=()=>calls++);const r=createSwarmReveal({root:f.doc,cursors:0,autoScroll:true});r.start();f.advance();assert.equal(calls,2)});

test('hidden targets are inert and retain pre-existing inert state',()=>{const f=fixture();f.items[1].setAttribute('inert','');const r=createSwarmReveal({root:f.doc,cursors:0});r.start();assert.equal(f.items[0].hasAttribute('inert'),false);assert.equal(f.items[1].hasAttribute('inert'),true);f.advance();assert.equal(f.items[1].hasAttribute('inert'),true);r.destroy();assert.equal(f.items[1].hasAttribute('inert'),true)});
test('callback errors restore all content, report an error, and stop the run',()=>{const f=fixture();let error;const r=createSwarmReveal({root:f.doc,cursors:0,onStep(){throw new Error('broken callback')},onError:e=>error=e});r.start();assert.equal(error.message,'broken callback');assert.equal(r.getState().status,'error');assert.equal(f.items[0].textContent,'One two three four five');assert.equal(f.items[1].hasAttribute('data-ms-hidden'),false);assert.equal(f.items[1].hasAttribute('inert'),false);f.advance();assert.equal(r.getState().status,'error')});
test('changing reduced motion during playback completes and releases the listener',()=>{const f=fixture(),reasons=[];const r=createSwarmReveal({root:f.doc,cursors:0,onComplete:e=>reasons.push(e.reason)});r.start();f.media.matches=true;f.media.listener({matches:true});assert.equal(r.getState().status,'complete');assert.equal(reasons[0],'reduced-motion');assert.equal(f.items[0].textContent,'One two three four five');r.destroy();assert.equal(f.media.listener,null)});
test('overlapping targets are rejected until their owner is destroyed',()=>{const f=fixture();const r=createSwarmReveal({root:f.doc,cursors:0});assert.throws(()=>createSwarmReveal({root:f.doc,cursors:0}),/already owned/);r.destroy();const next=createSwarmReveal({root:f.doc,cursors:0});next.destroy()});
test('existing hidden and inert attributes are restored on cleanup',()=>{const f=fixture();f.items[0].setAttribute('data-ms-hidden','');f.items[1].setAttribute('inert','');const r=createSwarmReveal({root:f.doc,cursors:0});r.start();r.skip();assert.equal(f.items[0].hasAttribute('data-ms-hidden'),true);assert.equal(f.items[1].hasAttribute('inert'),true);r.destroy();assert.equal(f.items[0].hasAttribute('data-ms-hidden'),true)});
test('completion callback errors are reported after content is restored',()=>{const f=fixture();let got;const r=createSwarmReveal({root:f.doc,cursors:0,onComplete(){throw Error('completion failed')},onError:e=>got=e.message});r.start();f.advance();assert.equal(got,'completion failed');assert.equal(r.getState().status,'complete');assert.equal(f.items[0].textContent,'One two three four five')});
test('an asynchronous step error restores content and cancels later steps',()=>{const f=fixture();let steps=0,errors=0;const r=createSwarmReveal({root:f.doc,cursors:0,onStep(){if(++steps===2)throw Error('failed after scheduling')},onError(){errors++}});r.start();f.advance();assert.equal(steps,2);assert.equal(errors,1);assert.equal(r.getState().status,'error');assert.equal(f.items[0].textContent,'One two three four five');assert.equal(f.items[1].hasAttribute('inert'),false)});
test('a reduced motion change also completes a paused reveal',()=>{const f=fixture(),reasons=[];const r=createSwarmReveal({root:f.doc,cursors:0,onComplete:e=>reasons.push(e.reason)});r.start();r.pause();f.media.matches=true;f.media.listener({matches:true});assert.equal(r.getState().status,'complete');assert.equal(reasons[0],'reduced-motion');assert.equal(f.items[1].hasAttribute('inert'),false);r.destroy()});



test('per-element ordering, delay and visual roles control a sequence without mutating content',()=>{
  const f=fixture(),seen=[];
  f.items[0].setAttribute('data-swarm-order','2');
  f.items[1].setAttribute('data-swarm-order','1');
  f.items[1].setAttribute('data-swarm-delay','300');
  f.items[1].setAttribute('data-swarm-role','<Designer>');
  const r=createSwarmReveal({root:f.doc,cursors:1,interval:25,typeText:false,onStep:e=>seen.push(e)});
  r.start();assert.equal(r.getState().current,0);assert.equal(f.items[1].hasAttribute('inert'),true);assert.deepEqual(f.delays,[300]);
  f.advance();assert.equal(seen[0].element,f.items[1]);assert.equal(seen[0].role,'<Designer>');assert.equal(seen[1].element,f.items[0]);
  const roleTag=f.doc.body.children[0].children.at(-1);assert.equal(roleTag.textContent,'<Designer>');assert.equal(f.items[0].textContent,'One two three four five');r.destroy();
});
test('sequence attributes are validated before any DOM mutation',()=>{
  for(const [name,value] of [['data-swarm-order','-1'],['data-swarm-order','100001'],['data-swarm-delay','1.5'],['data-swarm-delay','10001'],['data-swarm-role','x'.repeat(41)],['data-swarm-role','bad\nname']]){
    const f=fixture();f.items[0].setAttribute(name,value);assert.throws(()=>createSwarmReveal({root:f.doc,cursors:0}));assert.equal(f.doc.body.children.length,0);
  }
});
test('per-element delays do not block reduced-motion users',()=>{
  const f=fixture(true);f.items[0].setAttribute('data-swarm-delay','10000');const r=createSwarmReveal({root:f.doc,cursors:0});r.start();assert.equal(r.getState().status,'complete');assert.deepEqual(f.delays,[]);r.destroy();
});
test('element delay is applied once before its show step, not to typed chunks',()=>{
  const f=fixture();f.items[1].setAttribute('data-swarm-delay','500');const r=createSwarmReveal({root:f.doc,cursors:0,interval:25,typeWords:3});r.start();f.advance();assert.deepEqual(f.delays,[25,25,525,25]);r.destroy();
});
test('pause and resume retain an initial element delay',()=>{
  const f=fixture();f.items[0].setAttribute('data-swarm-delay','300');const r=createSwarmReveal({root:f.doc,cursors:0,interval:25});r.start();r.pause();f.advance();assert.equal(r.getState().current,0);r.resume();assert.deepEqual(f.delays.slice(0,2),[300,300]);f.advance();assert.equal(r.getState().status,'complete');r.destroy();
});
test('adjacent grouped elements reveal in one tick with independent role labels and drag ghosts',()=>{
  const f=fixture(),seen=[];let activeGhosts=0;
  for(const [i,el] of f.items.entries()){el.setAttribute('data-swarm-group','hero');el.setAttribute('data-swarm-role',i?'Reviewer':'Designer');el.setAttribute('data-swarm-effect','drag')}
  f.items[0].setAttribute('data-swarm-delay','70');f.items[1].setAttribute('data-swarm-delay','120');
  const r=createSwarmReveal({root:f.doc,cursors:4,interval:25,typeText:false,onStep:e=>{seen.push(e);activeGhosts=f.doc.body.children[0].children.filter(x=>x.className==='ms-ghost'&&x.hasAttribute('data-active')).length;assert.equal(f.items.every(x=>!x.hasAttribute('data-ms-hidden')),true)}});
  r.start();assert.equal(r.getState().current,0);assert.equal(f.delays[0],120);f.advance();
  assert.deepEqual(seen.map(e=>e.group),['hero','hero']);assert.deepEqual(seen.map(e=>e.effect),['drag','drag']);assert.deepEqual(seen.map(e=>e.current),[1,2]);
  const overlay=f.doc.body.children[0];const ghosts=overlay.children.filter(x=>x.className==='ms-ghost');const roles=overlay.children.filter(x=>x.className==='ms-role');
  assert.equal(ghosts.length,2);assert.equal(activeGhosts,2);assert.deepEqual(roles.map(x=>x.textContent),['Designer','Reviewer']);r.destroy();assert.equal(f.items.every(x=>!x.hasAttribute('inert')),true);
});
test('group callbacks describe each already-revealed member when paused',()=>{
  const f=fixture(),events=[];for(const el of f.items){el.setAttribute('data-swarm-group','g');el.setAttribute('data-swarm-delay','50')}
  let r;r=createSwarmReveal({root:f.doc,cursors:0,interval:25,typeText:false,onStep:e=>{events.push(e.current);if(e.current===1)r.pause()}});
  r.start();f.advance();assert.deepEqual(events,[1,2]);assert.equal(r.getState().status,'paused');assert.equal(f.items.every(el=>!el.hasAttribute('data-ms-hidden')),true);r.resume();f.advance();assert.equal(r.getState().status,'complete');r.destroy();
});
test('invalid group or effect settings fail before DOM mutation',()=>{
  for(const [name,value] of [['data-swarm-group','spaces not allowed'],['data-swarm-group',''],['data-swarm-group','a'.repeat(33)],['data-swarm-effect','script']]){
    const f=fixture();f.items[0].setAttribute(name,value);assert.throws(()=>createSwarmReveal({root:f.doc,cursors:0}));assert.equal(f.doc.body.children.length,0);
  }
});
