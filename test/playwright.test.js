import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaywrightRevealHarness} from '../src/playwright.js';

function pageFixture(){
  const calls=[],attrs=(list)=>({hasAttribute:name=>list.includes(name)});
  const items=[attrs([]),attrs(['data-ms-hidden','inert']),attrs(['data-ms-hidden'])];
  const layer={};const document={querySelector:root=>root==='#root'?{querySelectorAll:()=>items}:null,querySelectorAll:()=>[layer]};
  let reduced=false;
  const page={evaluate:async(fn,arg)=>{const prior={document:globalThis.document,getComputedStyle:globalThis.getComputedStyle,matchMedia:globalThis.matchMedia};Object.assign(globalThis,{document,getComputedStyle:()=>({pointerEvents:'none'}),matchMedia:()=>({matches:reduced})});try{return fn(arg)}finally{for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}}},
    waitForFunction:async(fn,arg,options)=>calls.push({kind:'wait',arg,options}),
    emulateMedia:async options=>{calls.push({kind:'media',options});reduced=options.reducedMotion==='reduce'},
    locator:value=>({click:async()=>calls.push({kind:'click',value})})};
  return {page,calls};
}

test('reports reveal markers, inert hidden content and overlay pointer behavior',async()=>{
  const {page}=pageFixture(),h=createPlaywrightRevealHarness({page,root:'#root'});
  assert.deepEqual(await h.inspect(),{targets:3,hidden:2,visible:1,hiddenInert:1,overlays:1,overlayPointerTransparent:true,reducedMotion:false});
});
test('passes bounded wait options and controls to the existing page',async()=>{
  const {page,calls}=pageFixture(),h=createPlaywrightRevealHarness({page,root:'#root',controls:{pause:'#pause',skip:'#skip'}});
  await h.press('pause');await h.setReducedMotion(true);const result=await h.waitForTargetsVisible({timeout:1200,minTargets:2});
  assert.deepEqual(calls[0],{kind:'click',value:'#pause'});assert.equal(calls[1].options.reducedMotion,'reduce');assert.equal(calls[2].options.timeout,1200);assert.equal(calls[2].arg.minTargets,2);assert.equal(result.reducedMotion,true);
});
test('rejects invalid settings and unconfigured controls before page actions',async()=>{
  const {page,calls}=pageFixture();assert.throws(()=>createPlaywrightRevealHarness({page,controls:{launch:'#go'}}),/unknown/);assert.throws(()=>createPlaywrightRevealHarness({page,root:''}),/selector/);
  const h=createPlaywrightRevealHarness({page,root:'#root'});await assert.rejects(h.press('skip'),/not configured/);await assert.rejects(h.setReducedMotion('yes'),/boolean/);await assert.rejects(h.waitForTargetsVisible({timeout:0}),/timeout/);assert.equal(calls.length,0);
});
test('does not mistake a missing overlay for verified pointer transparency',async()=>{
  const {page}=pageFixture();page.evaluate=async fn=>{const old={document:globalThis.document,matchMedia:globalThis.matchMedia};Object.assign(globalThis,{document:{querySelector:()=>({querySelectorAll:()=>[]}),querySelectorAll:()=>[]},matchMedia:()=>({matches:false})});try{return fn({root:'body',targets:'x',overlay:'y'})}finally{for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}}};
  const info=await createPlaywrightRevealHarness({page}).inspect();assert.equal(info.overlays,0);assert.equal(info.overlayPointerTransparent,null);
});
