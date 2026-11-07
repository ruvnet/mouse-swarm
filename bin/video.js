#!/usr/bin/env node
/** Export a trusted local HTML page. Does not fetch third-party websites. */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {exportSwarmVideo,VIDEO_PRESETS,isLocalVideoRequest} from '../src/video.js';

const help='Usage: node bin/video.js --input path/to/page.html --output output.mp4 [--preset portrait|square|vertical] [--duration 10] [--fps 24] [--chromium /path/to/chromium]\nRequires Playwright and FFmpeg with libx264. Only use HTML you trust. Output is not overwritten.';
const args=process.argv.slice(2);if(args.includes('--help')||args.includes('-h')){console.log(help);process.exit(0)}
const allowed=new Set(['--input','--output','--preset','--duration','--fps','--chromium']);const options={};
for(let i=0;i<args.length;i+=2){if(!allowed.has(args[i])||!args[i+1]||args[i+1].startsWith('--')||options[args[i]]!==undefined){console.error(help);process.exit(2)}options[args[i]]=args[i+1]}
if(!options['--input']||!options['--output']){console.error(help);process.exit(2)}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
let browser,server;
try{
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
  const require=createRequire(import.meta.url);let chromium;try{({chromium}=require('playwright'))}catch{throw Error('Playwright is required; install playwright and a Chromium browser')}
  browser=await chromium.launch({headless:true,...(options['--chromium']?{executablePath:options['--chromium']}:{})});
  const preset=options['--preset']||'portrait';const size=VIDEO_PRESETS[preset];if(!size)throw Error('unknown video preset');
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1,serviceWorkers:'block',acceptDownloads:false});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await context.route('**/*',route=>{let permitted=false;try{permitted=new URL(route.request().url()).origin===origin}catch{};return permitted?route.continue():route.abort()});
  if(typeof context.routeWebSocket!=='function')throw Error('Playwright with WebSocket routing support is required');
  await context.routeWebSocket('**/*',socket=>socket.close());
  const page=await context.newPage();await page.goto(origin+'/',{waitUntil:'load'});
  const result=await exportSwarmVideo({page,outputPath:resolve(options['--output']),preset,duration:Number(options['--duration']??10),fps:Number(options['--fps']??24)});
  console.log(`Created ${result.outputPath} (${result.width}x${result.height}, ${result.frames} frames at ${result.fps} fps)`);
}catch(error){console.error('Video export failed:',error.message);process.exitCode=1}
finally{if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok))}
