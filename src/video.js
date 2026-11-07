/** Record an already-open trusted Playwright page. The caller controls navigation. */
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {stat} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';

export const VIDEO_PRESETS=Object.freeze({
  portrait:Object.freeze({width:1080,height:1320}),
  square:Object.freeze({width:1080,height:1080}),
  vertical:Object.freeze({width:1080,height:1920})
});

/** No shell or implicit page navigation. Requires FFmpeg with libx264. Output is never overwritten. */
export async function exportSwarmVideo({page,outputPath,preset='portrait',width,height,duration=10,fps=24,ffmpeg='ffmpeg',signal}={}) {
  if(!page||typeof page.screenshot!=='function'||typeof page.setViewportSize!=='function')throw new TypeError('a Playwright page is required');
  if(typeof outputPath!=='string'||!outputPath.toLowerCase().endsWith('.mp4')||outputPath.includes('\0'))throw new TypeError('outputPath must be an MP4 path');
  if(typeof ffmpeg!=='string'||!ffmpeg||ffmpeg.includes('\0'))throw new TypeError('ffmpeg must be an executable');
  const defaults=VIDEO_PRESETS[preset];if(!defaults)throw new RangeError('unknown video preset');
  width??=defaults.width;height??=defaults.height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>1920||height>1920||width%2||height%2)throw new RangeError('video dimensions must be even integers between 2 and 1920');
  if(!Number.isFinite(duration)||duration<0.1||duration>60)throw new RangeError('duration must be between 0.1 and 60 seconds');
  if(!Number.isInteger(fps)||fps<1||fps>60)throw new RangeError('fps must be an integer between 1 and 60');
  if(signal?.aborted)throw new Error('video export aborted');
  try { await stat(outputPath); throw new Error('output already exists'); } catch(error) {if(error.code!=='ENOENT')throw error}
  await page.setViewportSize({width,height});
  const count=Math.ceil(duration*fps);
  const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',outputPath],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let stderr='',processError=null; child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4096)});child.on('error',err=>{processError=err});child.stdin.on('error',err=>{processError??=err});
  const exit=new Promise(resolve=>{child.once('close',(code,sig)=>resolve({code,sig}))});
  const abort=()=>child.kill('SIGTERM');signal?.addEventListener('abort',abort,{once:true});
  try{
    const start=performance.now();
    for(let i=0;i<count;i++){
      if(signal?.aborted)throw new Error('video export aborted');
      if(processError)throw processError;
      const remaining=start+i*1000/fps-performance.now();if(remaining>0)await delay(remaining,undefined,{signal});
      const frame=await page.screenshot({type:'jpeg',quality:85,animations:'allow'});
      if(!child.stdin.write(frame))await Promise.race([once(child.stdin,'drain'),exit.then(()=>{throw new Error('FFmpeg exited before all frames were written')})]);
    }
    child.stdin.end();const result=await exit;
    if(processError||result.code!==0)throw new Error('FFmpeg failed: '+(processError?.message||stderr.trim()||String(result.sig||result.code)));
    return {outputPath,width,height,fps,frames:count,duration:count/fps};
  }catch(error){child.stdin.destroy();child.kill('SIGTERM');await exit;throw error}
  finally{signal?.removeEventListener('abort',abort)}
}
