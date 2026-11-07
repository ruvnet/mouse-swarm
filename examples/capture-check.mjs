/** Offline browser acceptance for the local capture and visual sequence editor. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const execFile=promisify(execFileCallback);
const dir=await mkdtemp(join(tmpdir(),'swarm-capture-check-'));
let server,browser;
try{
  const source=join(dir,'page.html'),output=join(dir,'result');
  await writeFile(source,'<!doctype html><html><head><style>body{background:#123;color:white;font:32px sans-serif}h1{color:#afff80}</style></head><body><h1>First heading</h1><p>Second paragraph</p><script>window.shouldNotRun=true</script></body></html>');
  const bin=fileURLToPath(new URL('../bin/capture.js',import.meta.url));
  const args=[bin,'--input',source,'--output',output,'--preset','portrait','--cursors','2','--interval','20'];
  if(process.env.SWARM_BROWSER_PATH)args.push('--browser-executable',process.env.SWARM_BROWSER_PATH);
  await execFile(process.execPath,args,{timeout:45000});
  const manifest=JSON.parse(await readFile(join(output,'capture.json'),'utf8'));
  assert.equal(manifest.viewport.width,1080);assert.equal(manifest.viewport.height,1320);
  assert.ok(manifest.targets.some(x=>x.label==='First heading'));assert.ok(manifest.targets.some(x=>x.label==='Second paragraph'));
  const files=new Map([['/','index.html'],['/mouse-swarm.js','mouse-swarm.js'],['/sequence.js','sequence.js'],['/page.png','page.png'],['/background.png','background.png']]);
  server=createServer(async(req,res)=>{try{const host=`127.0.0.1:${server.address().port}`;if(req.headers.host!==host||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==`http://${host}`)){res.writeHead(403).end();return}const file=files.get(new URL(req.url,`http://${host}`).pathname);if(!file){res.writeHead(404).end();return}const type=file.endsWith('.png')?'image/png':file.endsWith('.js')?'text/javascript':'text/html';res.writeHead(200,{'content-type':type}).end(await readFile(join(output,file)))}catch{res.writeHead(500).end()}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  browser=await chromium.launch({headless:true,...(process.env.SWARM_BROWSER_PATH?{executablePath:process.env.SWARM_BROWSER_PATH}:{})});
  const page=await browser.newPage({viewport:{width:1080,height:1320}});await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#edit-sequence').click();const rows=page.locator('#sequence-list li');assert.ok(await rows.count()>=2);
  const first=await rows.nth(0).locator('span').textContent(),second=await rows.nth(1).locator('span').textContent();await rows.nth(0).getByRole('button',{name:'Move down'}).click();assert.equal(await rows.nth(0).locator('span').textContent(),second);assert.equal(await rows.nth(1).locator('span').textContent(),first);
  await page.locator('#apply-sequence').click();assert.equal(await page.locator('#captured [data-swarm-item]').first().getAttribute('data-capture-index'),'1');
  await page.locator('#skip').click();assert.equal(await page.locator('[data-ms-hidden]').count(),0);
  const png=await readFile(join(output,'page.png'));assert.equal(png.subarray(1,4).toString(),'PNG');
  console.log('PASS: portrait capture, visual reorder and reveal restoration');
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
