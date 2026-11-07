import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {exportSwarmVideo,VIDEO_PRESETS,isLocalVideoRequest,resolveVideoSettings} from '../src/video.js';

test('video configuration preserves defaults and applies explicit overrides',()=>{
  const base=resolveVideoSettings();assert.equal(base.browser,'chromium');assert.equal(base.width,1080);assert.equal(base.height,1320);assert.equal(base.jpegQuality,85);assert.equal(base.crf,23);assert.equal(base.encoderPreset,'medium');
  const out=resolveVideoSettings({preset:'square',fps:12,browser:'firefox',colorScheme:'dark',reducedMotion:'reduce',waitMs:200},{fps:24,width:640,height:480});
  assert.equal(out.fps,24);assert.equal(out.width,640);assert.equal(out.height,480);assert.equal(out.browser,'firefox');assert.equal(out.reducedMotion,'reduce');
  for(const value of [{unknown:true},{browser:'chrome'}, {jpegQuality:101},{crf:52},{encoderPreset:'unexpected'},{waitMs:10001},{colorScheme:'blue'}, {width:101},{preset:'__proto__',width:640,height:480},JSON.parse('{"__proto__":{"x":1}}')])assert.throws(()=>resolveVideoSettings(value));
});

test('CLI rejects invalid configuration before launching the browser',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'swarm-video-config-'));
  try {const path=join(dir,'settings.json');await writeFile(path,JSON.stringify({browser:'invalid'}));const bin=new URL('../bin/video.js',import.meta.url);const r=spawnSync(process.execPath,[bin.pathname,'--input','missing.html','--output',join(dir,'out.mp4'),'--config',path]);assert.notEqual(r.status,0);assert.match(r.stderr.toString(),/invalid browser/)}
  finally{await rm(dir,{recursive:true,force:true})}
});

test('video asset server accepts only its loopback host and origin',()=>{
  assert.equal(isLocalVideoRequest({host:'127.0.0.1:4312'},4312),true);
  assert.equal(isLocalVideoRequest({host:'example.test:4312'},4312),false);
  assert.equal(isLocalVideoRequest({host:'127.0.0.1:4312',origin:'https://example.test'},4312),false);
  assert.equal(isLocalVideoRequest({host:'127.0.0.1:4312','sec-fetch-site':'cross-site'},4312),false);
});

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
    let viewport,frames=0,quality;const page={setViewportSize:async size=>{viewport=size},screenshot:async options=>{frames++;quality=options.quality;return generated.stdout}};
    const result=await exportSwarmVideo({page,outputPath:dest,width:180,height:220,duration:0.5,fps:2,jpegQuality:60,crf:30,encoderPreset:'fast'});
    assert.deepEqual(viewport,{width:180,height:220});assert.equal(frames,1);assert.equal(result.frames,1);assert.equal(quality,60);
    const probe=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=codec_name,width,height','-of','json',dest]);
    assert.equal(probe.status,0);assert.deepEqual(JSON.parse(probe.stdout.toString()).streams[0],{codec_name:'h264',width:180,height:220});
    await assert.rejects(exportSwarmVideo({page,outputPath:dest,width:180,height:220,duration:0.5,fps:2}),/exists/);
  }finally{await rm(dir,{recursive:true,force:true})}
});
