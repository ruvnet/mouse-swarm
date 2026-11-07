import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateCaptureSpec,buildCaptureDocument,captureViewport} from '../src/capture.js';

test('capture options reject unsafe or unbounded settings',()=>{
 assert.equal(validateCaptureSpec({width:1080,height:1320}).width,1080);
 for(const bad of [{width:0},{height:2000},{maxTargets:201},{interval:19},{cursors:81},{selector:''}])assert.throws(()=>validateCaptureSpec(bad));
});

test('reconstruction escapes source text and produces parseable reorder controls',()=>{
 const html=buildCaptureDocument({width:320,height:320},[{x:2,y:3,width:120,height:30,label:'<script>bad()</script>'}]);
 assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));assert.ok(!html.includes('<script>bad()</script>'));
 assert.match(html,/Edit sequence/);assert.match(html,/Apply and replay/);assert.match(html,/Original links and controls are not interactive/);
 const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 const check=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 assert.throws(()=>buildCaptureDocument({width:320,height:320},[{x:300,y:0,width:30,height:5,label:'x'}]),/invalid capture target/);
});

test('capture writes a portable asset bundle and leaves existing destinations untouched',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mouse-capture-'));
 let screenshots=0,evaluations=0;
 const page={setViewportSize:async()=>{},evaluate:async()=>++evaluations===1?[{x:4,y:6,width:30,height:20,label:'Heading'}]:undefined,screenshot:async()=>Buffer.from(++screenshots===1?'page':'background')};
 try{
  const output=join(dir,'capture');const result=await captureViewport({page,outputDir:output,width:320,height:320});
  assert.equal(result.targets,1);assert.equal(await readFile(join(output,'page.png'),'utf8'),'page');assert.equal(await readFile(join(output,'background.png'),'utf8'),'background');
  assert.match(await readFile(join(output,'sequence.js'),'utf8'),/sequence = \[0\]/);assert.equal(JSON.parse(await readFile(join(output,'capture.json'),'utf8')).targets[0].label,'Heading');await access(join(output,'mouse-swarm.js'));
  await writeFile(join(output,'sentinel'),'keep');evaluations=0;screenshots=0;
  await assert.rejects(captureViewport({page,outputDir:output,width:320,height:320}),/EEXIST/);assert.equal(await readFile(join(output,'sentinel'),'utf8'),'keep');
 }finally{await rm(dir,{recursive:true,force:true})}
});
