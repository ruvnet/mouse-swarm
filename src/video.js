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

const SETTINGS=new Set(['preset','width','height','duration','fps','jpegQuality','crf','encoderPreset','browser','browserExecutable','colorScheme','reducedMotion','waitMs']);
const ENCODER_PRESETS=new Set(['ultrafast','superfast','veryfast','faster','fast','medium','slow','slower','veryslow']);

/** Validate declarative settings before launching a browser or creating output. */
export function resolveVideoSettings(config={},overrides={}){
  for(const value of [config,overrides]){
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!SETTINGS.has(key)))throw new TypeError('unknown video setting');
  }
  const input={...config,...overrides},preset=input.preset??'portrait';
  if(typeof preset!=='string'||!Object.hasOwn(VIDEO_PRESETS,preset))throw new RangeError('unknown video preset');
  const size=VIDEO_PRESETS[preset];
  const out={preset,width:input.width??size.width,height:input.height??size.height,duration:input.duration??10,fps:input.fps??24,jpegQuality:input.jpegQuality??85,crf:input.crf??23,encoderPreset:input.encoderPreset??'medium',browser:input.browser??'chromium',colorScheme:input.colorScheme??'light',reducedMotion:input.reducedMotion??'no-preference',waitMs:input.waitMs??0};
  if(input.browserExecutable!==undefined)out.browserExecutable=input.browserExecutable;
  if(!Number.isInteger(out.width)||!Number.isInteger(out.height)||out.width<2||out.height<2||out.width>1920||out.height>1920||out.width%2||out.height%2)throw new RangeError('video dimensions must be even integers between 2 and 1920');
  if(!Number.isFinite(out.duration)||out.duration<0.1||out.duration>60)throw new RangeError('duration must be between 0.1 and 60 seconds');
  if(!Number.isInteger(out.fps)||out.fps<1||out.fps>60)throw new RangeError('fps must be an integer between 1 and 60');
  if(!Number.isInteger(out.jpegQuality)||out.jpegQuality<1||out.jpegQuality>100)throw new RangeError('JPEG quality must be an integer from 1 to 100');
  if(!Number.isInteger(out.crf)||out.crf<0||out.crf>51)throw new RangeError('CRF must be an integer from 0 to 51');
  if(!ENCODER_PRESETS.has(out.encoderPreset))throw new RangeError('invalid encoder preset');
  if(!['chromium','firefox','webkit'].includes(out.browser))throw new RangeError('invalid browser');
  if(out.browserExecutable!==undefined&&(typeof out.browserExecutable!=='string'||!out.browserExecutable||out.browserExecutable.includes('\0')))throw new TypeError('invalid browser executable');
  if(!['light','dark','no-preference'].includes(out.colorScheme))throw new RangeError('invalid color scheme');
  if(!['reduce','no-preference'].includes(out.reducedMotion))throw new RangeError('invalid reduced motion');
  if(!Number.isInteger(out.waitMs)||out.waitMs<0||out.waitMs>10000)throw new RangeError('waitMs must be an integer from 0 to 10000');
  return Object.freeze(out);
}

/** Restrict the temporary asset server to its loopback origin. */
export function isLocalVideoRequest(headers,port){
  const host=`127.0.0.1:${port}`;
  return headers.host===host&&(!headers.origin||headers.origin===`http://${host}`)&&headers['sec-fetch-site']!=='cross-site';
}

/** No shell or implicit page navigation. Requires FFmpeg with libx264. Output is never overwritten. */
export async function exportSwarmVideo({page,outputPath,preset='portrait',width,height,duration=10,fps=24,jpegQuality=85,crf=23,encoderPreset='medium',ffmpeg='ffmpeg',signal}={}) {
  if(!page||typeof page.screenshot!=='function'||typeof page.setViewportSize!=='function')throw new TypeError('a Playwright page is required');
  if(typeof outputPath!=='string'||!outputPath.toLowerCase().endsWith('.mp4')||outputPath.includes('\0'))throw new TypeError('outputPath must be an MP4 path');
  if(typeof ffmpeg!=='string'||!ffmpeg||ffmpeg.includes('\0'))throw new TypeError('ffmpeg must be an executable');
  if(typeof preset!=='string'||!Object.hasOwn(VIDEO_PRESETS,preset))throw new RangeError('unknown video preset');
  const defaults=VIDEO_PRESETS[preset];
  width??=defaults.width;height??=defaults.height;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2||width>1920||height>1920||width%2||height%2)throw new RangeError('video dimensions must be even integers between 2 and 1920');
  if(!Number.isFinite(duration)||duration<0.1||duration>60)throw new RangeError('duration must be between 0.1 and 60 seconds');
  if(!Number.isInteger(fps)||fps<1||fps>60)throw new RangeError('fps must be an integer between 1 and 60');
  if(!Number.isInteger(jpegQuality)||jpegQuality<1||jpegQuality>100)throw new RangeError('JPEG quality must be from 1 to 100');
  if(!Number.isInteger(crf)||crf<0||crf>51)throw new RangeError('CRF must be from 0 to 51');
  if(!ENCODER_PRESETS.has(encoderPreset))throw new RangeError('invalid encoder preset');
  if(signal?.aborted)throw new Error('video export aborted');
  try { await stat(outputPath); throw new Error('output already exists'); } catch(error) {if(error.code!=='ENOENT')throw error}
  await page.setViewportSize({width,height});
  const count=Math.ceil(duration*fps);
  const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-n','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf',String(crf),'-preset',encoderPreset,'-pix_fmt','yuv420p','-movflags','+faststart',outputPath],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let stderr='',processError=null; child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-4096)});child.on('error',err=>{processError=err});child.stdin.on('error',err=>{processError??=err});
  const exit=new Promise(resolve=>{child.once('close',(code,sig)=>resolve({code,sig}))});
  const abort=()=>child.kill('SIGTERM');signal?.addEventListener('abort',abort,{once:true});
  try{
    const start=performance.now();
    for(let i=0;i<count;i++){
      if(signal?.aborted)throw new Error('video export aborted');
      if(processError)throw processError;
      const remaining=start+i*1000/fps-performance.now();if(remaining>0)await delay(remaining,undefined,{signal});
      const frame=await page.screenshot({type:'jpeg',quality:jpegQuality,animations:'allow'});
      if(!child.stdin.write(frame))await Promise.race([once(child.stdin,'drain'),exit.then(()=>{throw new Error('FFmpeg exited before all frames were written')})]);
    }
    child.stdin.end();const result=await exit;
    if(processError||result.code!==0)throw new Error('FFmpeg failed: '+(processError?.message||stderr.trim()||String(result.sig||result.code)));
    return {outputPath,width,height,fps,frames:count,duration:count/fps};
  }catch(error){child.stdin.destroy();child.kill('SIGTERM');await exit;throw error}
  finally{signal?.removeEventListener('abort',abort)}
}
