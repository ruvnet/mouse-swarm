import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker from '../site/worker.mjs';

test('worker serves the same studio assets as the repository',async()=>{
  for(const [route,file,type] of [
    ['/studio/','../examples/studio.html','text/html'],
    ['/studio/studio.js','../examples/studio.js','text/javascript'],
    ['/studio/mouse-swarm.js','../examples/mouse-swarm.js','text/javascript']
  ]){
    const response=await worker.fetch(new Request('https://example.test'+route));
    assert.equal(response.status,200);assert.ok(response.headers.get('content-type').includes(type));
    assert.equal(await response.text(),await readFile(new URL(file,import.meta.url),'utf8'));
  }
  const redirect=await worker.fetch(new Request('https://example.test/studio'));
  assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'https://example.test/studio/');
});
