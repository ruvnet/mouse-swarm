import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportSwarmVideo,VIDEO_PRESETS} from '../src/video.js';

test('video presets include a 9:11 portrait and validate options',async()=>{
  assert.deepEqual(VIDEO_PRESETS.portrait,{width:1080,height:1320});
  const page={setViewportSize:async()=>{},screenshot:async()=>Buffer.alloc(0)};
  await assert.rejects(exportSwarmVideo({page,outputPath:'x.mp4',width:101,height:100}),/even/);
  await assert.rejects(exportSwarmVideo({page,outputPath:'x.mp4',duration:61}),/duration/);
  await assert.rejects(exportSwarmVideo({page,outputPath:'x.mp4',fps:0}),/fps/);
  await assert.rejects(exportSwarmVideo({page,outputPath:'x.mp4',preset:'bad'}),/preset/);
  await assert.rejects(exportSwarmVideo({page,outputPath:'x.webm'}),/MP4/);
});

test('FFmpeg encodes sampled frames and refuses to overwrite',async t=>{
  if(spawnSync('ffmpeg',['-version']).status!==0||spawnSync('ffprobe',['-version']).status!==0)return t.skip('requires ffmpeg and ffprobe');
  const dir=await mkdtemp(join(tmpdir(),'swarm-video-'));const dest=join(dir,'result.mp4');
  try{
    const generated=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=green:s=180x220:d=1','-frames:v','1','-c:v','mjpeg','-f','image2pipe','pipe:1']);
    assert.equal(generated.status,0,generated.stderr.toString());
    let viewport,frames=0;const page={setViewportSize:async size=>{viewport=size},screenshot:async()=>{frames++;return generated.stdout}};
    const result=await exportSwarmVideo({page,outputPath:dest,width:180,height:220,duration:0.5,fps:2});
    assert.deepEqual(viewport,{width:180,height:220});assert.equal(frames,1);assert.equal(result.frames,1);
    const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',dest]);
    assert.equal(probe.status,0);assert.deepEqual(JSON.parse(probe.stdout.toString()).streams[0],{codec_name:'h264',width:180,height:220});
    await assert.rejects(exportSwarmVideo({page,outputPath:dest,width:180,height:220,duration:0.5,fps:2}),/exists/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
