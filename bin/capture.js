#!/usr/bin/env node
/** Capture a trusted local HTML page. No arbitrary network URL fetching. */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {captureViewport,validateCaptureSpec} from '../src/capture.js';

const help=`Usage: mouse-swarm-capture --input page.html --output NEW_DIRECTORY [--preset portrait|desktop] [--width N --height N] [--selector CSS] [--max-targets N] [--cursors N] [--interval N] [--browser-executable PATH] [--wait-ms N] [--allow-scripts]\nCaptures one viewport of trusted local HTML. Scripts are disabled by default, external network is blocked, and the output is a static visual reconstruction with no working original links. Requires Playwright 1.48+ and Chromium. Never use untrusted HTML.`;
const args=process.argv.slice(2);if(args.includes('--help')||args.includes('-h')){console.log(help);process.exit(0)}
const flags=new Set(['--input','--output','--preset','--width','--height','--selector','--max-targets','--cursors','--interval','--browser-executable','--wait-ms']),opts={};
for(let i=0;i<args.length;i++){
 const flag=args[i];if(flag==='--allow-scripts'){if(opts[flag]!==undefined){console.error(help);process.exit(2)}opts[flag]=true;continue}
 if(!flags.has(flag)||opts[flag]!==undefined||!args[i+1]||args[i+1].startsWith('--')){console.error(help);process.exit(2)}opts[flag]=args[++i];
}
if(!opts['--input']||!opts['--output']){console.error(help);process.exit(2)}
const mime={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json; charset=utf-8'};
let server,browser;
try{
 const preset=opts['--preset']??'desktop';if(!['portrait','desktop'].includes(preset))throw Error('preset must be portrait or desktop');
 const defaults=preset==='portrait'?{width:1080,height:1320}:{width:1280,height:800};
 const spec=validateCaptureSpec({width:Number(opts['--width']??defaults.width),height:Number(opts['--height']??defaults.height),...(opts['--selector']?{selector:opts['--selector']}:{}),maxTargets:Number(opts['--max-targets']??100),cursors:Number(opts['--cursors']??20),interval:Number(opts['--interval']??280)});
 const wait=Number(opts['--wait-ms']??0);if(!Number.isInteger(wait)||wait<0||wait>10000)throw Error('wait-ms must be from 0 to 10000');
 const input=await realpath(resolve(opts['--input']));if(!['.html','.htm'].includes(extname(input).toLowerCase()))throw Error('input must be a local HTML file');
 const info=await stat(input);if(!info.isFile()||info.size>8*1024*1024)throw Error('HTML must be a regular file under 8 MB');
 const root=await realpath(dirname(input));
 server=createServer(async(req,res)=>{try{
  const host=`127.0.0.1:${server.address().port}`;
  if(req.headers.host!==host||(req.headers.origin&&req.headers.origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403).end();return}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return}
  const pathname=decodeURIComponent(new URL(req.url,`http://${host}`).pathname);
  const actual=await realpath(pathname==='/'?input:resolve(root,'.'+pathname));
  if(actual!==input&&!actual.startsWith(root===sep?root:root+sep))throw Error('outside input directory');
  const type=mime[extname(actual).toLowerCase()],metadata=await stat(actual);
  if(!type||!metadata.isFile()||metadata.size>16*1024*1024)throw Error('unavailable asset');
  const content=await readFile(actual);res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'}).end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404).end()}});
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)});
 const require=createRequire(import.meta.url);let chromium;try{({chromium}=require('playwright'))}catch{throw Error('Playwright is required; install playwright and Chromium')}
 browser=await chromium.launch({headless:true,...(opts['--browser-executable']?{executablePath:opts['--browser-executable']}:{})});
 const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,javaScriptEnabled:!!opts['--allow-scripts'],serviceWorkers:'block',acceptDownloads:false});
 const origin=`http://127.0.0.1:${server.address().port}`;
 await context.route('**/*',route=>{let permitted=false;try{permitted=new URL(route.request().url()).origin===origin}catch{}return permitted?route.continue():route.abort()});
 if(typeof context.routeWebSocket!=='function')throw Error('Playwright with WebSocket routing support is required');
 await context.routeWebSocket('**/*',socket=>socket.close());
 const page=await context.newPage();await page.goto(origin+'/',{waitUntil:'load',timeout:30000});if(wait)await page.waitForTimeout(wait);
 const result=await captureViewport({page,outputDir:resolve(opts['--output']),...spec});
 console.log(`Created ${result.outputDir}: ${result.width}x${result.height}, ${result.targets} visual targets. Edit sequence.js to reorder.`);
}catch(error){console.error('Capture failed:',error.message);process.exitCode=1}
finally{if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok))}
