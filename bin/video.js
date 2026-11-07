#!/usr/bin/env node
/** Export a trusted local HTML page. Does not fetch third-party websites. */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {exportSwarmVideo,resolveVideoSettings,isLocalVideoRequest} from '../src/video.js';

const help='Usage: mouse-swarm-video --input page.html --output output.mp4 [--config settings.json] [--preset portrait|square|vertical] [--width N --height N] [--duration N --fps N] [--browser chromium|firefox|webkit] [--browser-executable path] [--color-scheme light|dark|no-preference] [--reduced-motion reduce|no-preference] [--wait-ms N] [--jpeg-quality N --crf N --encoder-preset name]\nRequires Playwright, an installed browser and FFmpeg with libx264. Only use HTML you trust. Output is not overwritten.';
const args=process.argv.slice(2);if(args.includes('--help')||args.includes('-h')){console.log(help);process.exit(0)}
const allowed=new Set(['--input','--output','--config','--preset','--width','--height','--duration','--fps','--browser','--browser-executable','--chromium','--color-scheme','--reduced-motion','--wait-ms','--jpeg-quality','--crf','--encoder-preset']);const options={};
for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--')||options[args[i]]!==undefined){console.error(help);process.exit(2)}options[args[i]]=args[i+1]}
if(!options['--input']||!options['--output']){console.error(help);process.exit(2)}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
let browser,server;
try{
  let config={};
  if(options['--config']){const path=resolve(options['--config']);const info=await stat(path);if(!info.isFile()||info.size>65536)throw Error('configuration must be a JSON file under 64 KB');const data=await readFile(path);if(data.length>65536)throw Error('configuration must be a JSON file under 64 KB');try{config=JSON.parse(data.toString('utf8'))}catch{throw Error('configuration is not valid JSON')}}
  if(options['--chromium']&&options['--browser-executable'])throw Error('use only one browser executable option');
  const aliases={'--preset':'preset','--width':'width','--height':'height','--duration':'duration','--fps':'fps','--jpeg-quality':'jpegQuality','--crf':'crf','--encoder-preset':'encoderPreset','--browser':'browser','--browser-executable':'browserExecutable','--color-scheme':'colorScheme','--reduced-motion':'reducedMotion','--wait-ms':'waitMs'};
  const numbers=new Set(['width','height','duration','fps','jpegQuality','crf','waitMs']);const overrides={};for(const [flag,key] of Object.entries(aliases))if(options[flag]!==undefined)overrides[key]=numbers.has(key)?Number(options[flag]):options[flag];
  if(options['--chromium']){if((overrides.browser??config?.browser??'chromium')!=='chromium')throw Error('--chromium requires the Chromium browser');overrides.browserExecutable=options['--chromium']}
  const settings=resolveVideoSettings(config,overrides);
  const input=await realpath(resolve(options['--input']));if(extname(input).toLowerCase()!=='.html')throw Error('input must be a local HTML file');
  const root=await realpath(dirname(input));
  server=createServer(async(req,res)=>{try{
    if(!isLocalVideoRequest(req.headers,server.address().port)){res.writeHead(403);res.end();return}
    if(req.method!=='GET'&&req.method!=='HEAD')throw Error('method');
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const requested=path==='/'?input:resolve(root,'.'+path);
    const actual=await realpath(requested);if(actual!==input&&!actual.startsWith(root+sep))throw Error('outside root');
    const type=mime[extname(actual).toLowerCase()];if(!type)throw Error('unsupported file type');
    const bytes=await readFile(actual);res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end()}});
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
  const require=createRequire(import.meta.url);let engine;try{engine=require('playwright')[settings.browser]}catch{throw Error('Playwright is required; install playwright and the selected browser')}
  if(!engine||typeof engine.launch!=='function')throw Error('selected Playwright browser is unavailable');
  browser=await engine.launch({headless:true,...(settings.browserExecutable?{executablePath:settings.browserExecutable}:{})});
  const context=await browser.newContext({viewport:{width:settings.width,height:settings.height},deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false,colorScheme:settings.colorScheme,reducedMotion:settings.reducedMotion});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await context.route('**/*',route=>{let permitted=false;try{permitted=new URL(route.request().url()).origin===origin}catch{};return permitted?route.continue():route.abort()});
  if(typeof context.routeWebSocket!=='function')throw Error('Playwright with WebSocket routing support is required');
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage();await page.goto(origin+'/',{waitUntil:'load'});if(settings.waitMs)await page.waitForTimeout(settings.waitMs);
  const result=await exportSwarmVideo({page,outputPath:resolve(options['--output']),...settings});
  console.log(`Created ${result.outputPath} (${result.width}x${result.height}, ${result.frames} frames at ${result.fps} fps)`);
}catch(error){console.error('Video export failed:',error.message);process.exitCode=1}
finally{if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok))}
