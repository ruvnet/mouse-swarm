import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStudioConfig,extractHtmlItems} from '../examples/studio.js';
const example=()=>({version:1,targets:['eyebrow','headline','description','coordinate','compose','replay','action'],options:{cursors:20,interval:220,typeWords:2,cursorSpeed:700,botEvery:5,selection:true,typeText:true,colors:['#c9f578']},content:{headline:'Build together',description:'A page reveal.',action:'Explore'}});
test('studio config round trips cleanly without sharing mutable state',()=>{const input=example();const result=validateStudioConfig(JSON.parse(JSON.stringify(input)));assert.deepEqual(result,input);input.options.colors[0]='#ffffff';assert.equal(result.options.colors[0],'#c9f578')});
test('studio rejects malformed, out of range, or executable config fields',()=>{for(const change of [x=>x.targets=[],x=>x.targets=['headline','headline'],x=>x.targets=['fake'],x=>x.options.cursors=81,x=>x.options.interval=0,x=>x.options.colors=['url(https://bad)'],x=>x.options.onStep='alert(1)',x=>x.content.headline='x'.repeat(121),x=>x.content.html='<script>',x=>x.version=2]){const v=example();change(v);assert.throws(()=>validateStudioConfig(v),TypeError)}});
test('studio treats markup as content and never executes it',()=>{const v=example();v.content.headline='<img src=x onerror=alert(1)>';assert.equal(validateStudioConfig(v).content.headline,v.content.headline)});
test('import extracts ordered text without executing or retaining active content',()=>{
  const items=extractHtmlItems('<html><head><title>secret</title><style>.x{}</style></head><body><h1 onclick="bad()">Build <em>together</em> &amp; grow</h1><script>evil()</script><p>Safe<img src="https://example.test/image" onerror="bad()"> words</p><a href="javascript:bad()">Go</a></body></html>');
  assert.deepEqual(items,[{tag:'h1',text:'Build together & grow',enabled:true},{tag:'p',text:'Safe words',enabled:true},{tag:'a',text:'Go',enabled:true}]);
  assert.doesNotMatch(JSON.stringify(items),/script|onclick|example\.test|javascript/);
});
test('import caps size and item count and accepts no executable fields in config',()=>{
  assert.throws(()=>extractHtmlItems('x'.repeat(524289)),RangeError);
  const items=extractHtmlItems('<p>item</p>'.repeat(55));assert.equal(items.length,50);
  const result=validateStudioConfig({version:2,options:example().options,items});assert.equal(result.items.length,50);
  const copy={...result,items:[{...result.items[0],html:'<script>'}]};assert.throws(()=>validateStudioConfig(copy),TypeError);
  assert.throws(()=>validateStudioConfig({...result,items:result.items.map(x=>({...x,enabled:false}))}),TypeError);
});
