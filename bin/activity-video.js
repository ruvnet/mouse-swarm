#!/usr/bin/env node
/** Render a minimized, recorded activity session through the local MP4 exporter. */
import {spawn} from 'node:child_process';
import {readFile,mkdtemp,writeFile,copyFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateActivityRecording} from '../src/activity.js';
import {resolveVideoSettings} from '../src/video.js';

const help='Usage: mouse-swarm-activity-video --input recording.json --output replay.mp4 [--preset portrait|square|vertical] [--duration 10] [--fps 24] [--config settings.json] [--browser chromium|firefox|webkit] [--browser-executable path]\nRequires Playwright, Chromium and FFmpeg with libx264. Observation timing is scaled into the requested duration. Agent IDs and source references appear in the video.';
const args=process.argv.slice(2);if(args.includes('--help')||args.includes('-h')){console.log(help);process.exit(0)}
const allowed=new Set(['--input','--output','--config','--preset','--duration','--fps','--chromium','--browser','--browser-executable','--width','--height','--jpeg-quality','--crf','--encoder-preset','--color-scheme','--reduced-motion','--wait-ms']);const opts={};
for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--')||opts[args[i]]!==undefined){console.error(help);process.exit(2)}opts[args[i]]=args[i+1]}
if(!opts['--input']||!opts['--output']){console.error(help);process.exit(2)}
let dir,child,interrupted=false;
const stop=()=>{interrupted=true;child?.kill('SIGTERM')};process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
  let config={};
  if(opts['--config']){const info=await stat(opts['--config']);if(!info.isFile()||info.size>65536)throw Error('configuration must be a JSON file under 64 KB');const raw=await readFile(opts['--config']);if(raw.length>65536)throw Error('configuration must be a JSON file under 64 KB');try{config=JSON.parse(raw.toString('utf8'))}catch{throw Error('configuration is not valid JSON')}}
  if(opts['--chromium']&&opts['--browser-executable'])throw Error('use only one browser executable option');
  const aliases={'--preset':'preset','--width':'width','--height':'height','--duration':'duration','--fps':'fps','--jpeg-quality':'jpegQuality','--crf':'crf','--encoder-preset':'encoderPreset','--browser':'browser','--browser-executable':'browserExecutable','--color-scheme':'colorScheme','--reduced-motion':'reducedMotion','--wait-ms':'waitMs'};
  const numbers=new Set(['width','height','duration','fps','jpegQuality','crf','waitMs']),overrides={};for(const [flag,key] of Object.entries(aliases))if(opts[flag]!==undefined)overrides[key]=numbers.has(key)?Number(opts[flag]):opts[flag];
  if(opts['--chromium']){if((overrides.browser??config.browser??'chromium')!=='chromium')throw Error('--chromium requires the Chromium browser');overrides.browserExecutable=opts['--chromium']}
  const settings=resolveVideoSettings(config,overrides),duration=settings.duration;
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
  const videoArgs=[fileURLToPath(new URL('./video.js',import.meta.url)),'--input',join(dir,'index.html'),'--output',resolve(opts['--output'])];
  for(const [flag,key] of Object.entries(aliases))if(settings[key]!==undefined)videoArgs.push(flag,String(settings[key]));
  child=spawn(process.execPath,videoArgs,{stdio:'inherit'});
  const result=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal}))});
  if(interrupted||result.code!==0){process.exitCode=result.code||1;if(result.signal)console.error('Video exporter stopped:',result.signal)}
}catch(error){console.error('Activity video failed:',error.message);process.exitCode=1}
finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);if(dir)await rm(dir,{recursive:true,force:true})}
