import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, delimiter} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('observe launches the CLI and returns only projected agent data', {skip:process.platform==='win32',timeout:15000}, async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mouse-swarm-process-'));
  const fixture=join(dir,'ruflo');
  await writeFile(fixture, '#!/bin/sh\nprintf \'%s\\n\' \'{"agents":[{"agentId":"realistic-1","agentType":"coder","status":"idle","name":"private-name","health":1,"taskCount":12}]}\'\n', {mode:0o755});
  const bin=fileURLToPath(new URL('../bin/mouse-swarm.js',import.meta.url));
  const child=spawn(process.execPath,[bin,'observe','--port','0'],{cwd:dir,env:{...process.env,PATH:dir+delimiter+process.env.PATH},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stderr.on('data',data=>stderr+=data);
  try{
    const url=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('server start timed out')),5000);
      child.on('error',error=>{clearTimeout(timeout);reject(error)});
      child.on('exit',code=>{clearTimeout(timeout);reject(Error(`server exited: ${code} ${stderr}`))});
      child.stdout.on('data',chunk=>{stdout+=chunk;const match=stdout.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timeout);resolve(match[0])}});
    });
    const response=await fetch(url+'api/ruflo/agents');
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{events:[{type:'agent.upsert',id:'realistic-1',label:'realistic-1',role:'coder',status:'idle'}]});
  }finally{
    if(child.exitCode===null){child.kill();await once(child,'exit')}
    await rm(dir,{recursive:true,force:true});
  }
});
