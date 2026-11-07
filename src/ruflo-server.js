/** Opt-in loopback-only example server for a local Ruflo registration snapshot. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readRufloAgents} from './ruflo-cli.js';
const routes={
 '/':{url:new URL('../examples/ruflo-live.html',import.meta.url),type:'text/html; charset=utf-8'},
 '/client.js':{url:new URL('../examples/ruflo-live.js',import.meta.url),type:'text/javascript; charset=utf-8'},
 '/ruflo.js':{url:new URL('./ruflo.js',import.meta.url),type:'text/javascript; charset=utf-8'},
 '/ruflo-view.js':{url:new URL('./ruflo-view.js',import.meta.url),type:'text/javascript; charset=utf-8'}
};
const common={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"};
function send(res,status,text,type='text/plain; charset=utf-8',method='GET'){res.writeHead(status,{...common,'content-type':type});res.end(method==='HEAD'?undefined:text)}
export function createLocalRufloServer({cwd=process.cwd(),readAgents=readRufloAgents,cacheMs=2000,now=Date.now}={}){
 if(typeof readAgents!=='function')throw new TypeError('readAgents must be a function');
 if(!Number.isFinite(cacheMs)||cacheMs<0||cacheMs>30000)throw new RangeError('cacheMs must be between 0 and 30000ms');
 let cached=null,checkedAt=0,pending=null;
 async function poll(){if(cached && now()-checkedAt<cacheMs)return cached;if(pending)return pending;pending=(async()=>{const events=await readAgents({cwd});if(!Array.isArray(events)||events.length>64)throw new TypeError('invalid agent snapshot');cached=events;checkedAt=now();return events})();try{return await pending}finally{pending=null}}
 const server=createServer(async(req,res)=>{try{
  const address=server.address();const host=`127.0.0.1:${address.port}`;const origin=`http://${host}`;
  if(req.headers.host!==host || (req.headers.origin && req.headers.origin!==origin) || req.headers['sec-fetch-site']==='cross-site')return send(res,403,'Forbidden');
  if(req.method!=='GET'&&req.method!=='HEAD')return send(res,405,'Method not allowed');
  const path=new URL(req.url,origin).pathname;
  if(path==='/api/ruflo/agents'){try{const events=await poll();return send(res,200,JSON.stringify({events}),'application/json; charset=utf-8',req.method)}catch{return send(res,503,JSON.stringify({error:'Ruflo status unavailable'}),'application/json; charset=utf-8',req.method)}}
  const route=routes[path];if(!route)return send(res,404,'Not found');
  const content=await readFile(fileURLToPath(route.url),'utf8');return send(res,200,content,route.type,req.method);
 }catch{if(!res.headersSent)send(res,500,'Server error');else res.end()}});
 return server;
}
export async function startLocalRufloServer({port=4173,cwd=process.cwd()}={}){
 if(!Number.isInteger(port)||port<0||port>65535)throw new RangeError('port must be between 0 and 65535');
 const server=createLocalRufloServer({cwd});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);resolve()})});return server;
}
