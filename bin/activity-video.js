#!/usr/bin/env node
/** Render a minimized, recorded activity session through the local MP4 exporter. */
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,writeFile,copyFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateActivityRecording} from '../src/activity.js';

const help='Usage: mouse-swarm-activity-video --input recording.json --output replay.mp4 [--preset portrait|square|vertical] [--duration 10] [--fps 24] [--chromium /path/to/chromium]\nRequires Playwright, Chromium and FFmpeg with libx264. Observation timing is scaled into the requested duration. Agent IDs and source references appear in the video.';
const args=process.argv.slice(2);if(args.includes('--help')||args.includes('-h')){console.log(help);process.exit(0)}
const allowed=new Set(['--input','--output','--preset','--duration','--fps','--chromium']);const opts={};
for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--')||opts[args[i]]!==undefined){console.error(help);process.exit(2)}opts[args[i]]=args[i+1]}
if(!opts['--input']||!opts['--output']){console.error(help);process.exit(2)}
const duration=Number(opts['--duration']??10),fps=Number(opts['--fps']??24),preset=opts['--preset']??'portrait';
if(!Number.isFinite(duration)||duration<0.1||duration>60||!Number.isInteger(fps)||fps<1||fps>60||!['portrait','square','vertical'].includes(preset)){console.error('Invalid duration, frame rate, or preset.');process.exit(2)}
let dir,child,interrupted=false;
const stop=()=>{interrupted=true;child?.kill('SIGTERM')};process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
  const path=resolve(opts['--input']);const info=await stat(path);if(!info.isFile()||info.size>2*1024*1024)throw Error('recording must be a file under 2 MB');
  const bytes=await readFile(path);if(bytes.length>2*1024*1024)throw Error('recording exceeds 2 MB');
  let raw;try{raw=JSON.parse(bytes.toString('utf8'))}catch{throw Error('recording is not valid JSON')}
  const recording=validateActivityRecording(raw);
  dir=await mkdtemp(join(tmpdir(),'mouse-swarm-replay-'));
  await Promise.all([
    copyFile(fileURLToPath(new URL('../examples/activity-replay.html',import.meta.url)),join(dir,'index.html')),
    copyFile(fileURLToPath(new URL('../examples/activity-replay.js',import.meta.url)),join(dir,'activity-replay.js')),
    writeFile(join(dir,'recording.js'),'globalThis.__MOUSE_SWARM_RECORDING__ = '+JSON.stringify({recording,durationMs:duration*1000})+';\n',{mode:0o600})
  ]);
  if(interrupted)throw Error('export interrupted');
  const videoArgs=[fileURLToPath(new URL('./video.js',import.meta.url)),'--input',join(dir,'index.html'),'--output',resolve(opts['--output']),'--preset',preset,'--duration',String(duration),'--fps',String(fps)];
  if(opts['--chromium'])videoArgs.push('--chromium',opts['--chromium']);
  child=spawn(process.execPath,videoArgs,{stdio:'inherit'});
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}))});
  if(interrupted||result.code!==0){process.exitCode=result.code||1;if(result.signal)console.error('Video exporter stopped:',result.signal)}
}catch(error){console.error('Activity video failed:',error.message);process.exitCode=1}
finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);if(dir)await rm(dir,{recursive:true,force:true})}
