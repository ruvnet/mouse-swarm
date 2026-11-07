/** Install Playwright and its Chromium browser first, then run this file from a repository checkout. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import * as playwright from 'playwright';
import {createPlaywrightRevealHarness} from '../src/playwright.js';

// Serve only two bundled files on loopback. No external URLs are needed.
const files={'/':{path:new URL('./demo.html',import.meta.url),type:'text/html; charset=utf-8'},'/mouse-swarm.js':{path:new URL('./mouse-swarm.js',import.meta.url),type:'text/javascript; charset=utf-8'}};
const server=createServer(async(req,res)=>{
  const host=`127.0.0.1:${server.address().port}`;
  if(req.method!=='GET'||req.headers.host!==host||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${host}`)){res.writeHead(403).end();return}
  const file=files[new URL(req.url,'http://127.0.0.1').pathname];if(!file){res.writeHead(404).end();return}
  try{res.writeHead(200,{'content-type':file.type,'x-content-type-options':'nosniff'}).end(await readFile(file.path))}catch{res.writeHead(500).end()}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
let browser;
try{
  const name=process.env.SWARM_BROWSER||'chromium';
  if(!['chromium','firefox','webkit'].includes(name))throw new Error('SWARM_BROWSER must be chromium, firefox, or webkit');
  const path=process.env.SWARM_BROWSER_PATH||(name==='chromium'?process.env.CHROMIUM_PATH:undefined);
  browser=await playwright[name].launch({headless:true,...(path?{executablePath:path}:{})});
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  const reveal=createPlaywrightRevealHarness({page,root:'#reveal',controls:{replay:'#apply',pause:'#pause',resume:'#resume',skip:'#skip'}});
  await reveal.press('pause');assert.match(await page.locator('#progress').textContent(),/Paused|Status: complete/);
  await reveal.press('resume');await reveal.press('skip');
  const result=await reveal.waitForTargetsVisible({timeout:5000});
  assert.equal(result.hidden,0);assert.equal(result.overlayPointerTransparent,true);assert.ok(result.targets>0);
  assert.match(await page.locator('#progress').textContent(),/Finished: skipped/);
  await reveal.setReducedMotion(true);await reveal.press('replay');
  const reduced=await reveal.waitForTargetsVisible({timeout:5000});assert.equal(reduced.reducedMotion,true);
  assert.match(await page.locator('#progress').textContent(),/Finished: reduced-motion/);
  console.log(`PASS ${name}: playback controls, restored targets, pointer transparency and reduced motion`);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
