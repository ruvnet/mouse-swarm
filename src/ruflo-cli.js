/** Local, opt-in, read-only Ruflo CLI snapshot bridge. No shell, task text, or secrets. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const defaultExecute=promisify(execFile);
const statuses=new Set(['idle','busy','terminated']);

/** Convert the verified `ruflo agent list --format json` shape into minimal events. */
export function normalizeRufloAgentList(value,{limit=64}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>256) throw new RangeError('limit must be between 1 and 256');
  if(!value||typeof value!=='object'||!Array.isArray(value.agents)) throw new TypeError('expected a Ruflo agent list');
  if(value.error!==undefined&&value.error!==null&&value.error!=='') throw new TypeError('Ruflo reported an agent list error');
  if(value.agents.length>limit) throw new RangeError('agent list exceeds the configured limit');
  const seen=new Set();
  return value.agents.map(agent=>{
    if(!agent||typeof agent.agentId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(agent.agentId)) throw new TypeError('invalid Ruflo agent ID');
    if(seen.has(agent.agentId)) throw new TypeError('duplicate Ruflo agent ID');
    seen.add(agent.agentId);
    const role=typeof agent.agentType==='string'?agent.agentType.replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,64):'';
    const status=statuses.has(agent.status)?agent.status:'unknown';
    return {type:'agent.upsert',id:agent.agentId,label:agent.agentId,role:role||'agent',status};
  });
}

/** Run the CLI only when explicitly requested. cwd determines the Ruflo project state. */
export async function readRufloAgents({cwd=process.cwd(),executable='ruflo',timeout=5000,limit=64,execute=defaultExecute}={}) {
  if(typeof cwd!=='string'||!cwd) throw new TypeError('cwd must be a path');
  if(typeof executable!=='string'||!executable||executable.includes('\0')) throw new TypeError('executable must be a path');
  if(!Number.isInteger(timeout)||timeout<100||timeout>30000) throw new RangeError('timeout must be between 100 and 30000ms');
  if(typeof execute!=='function') throw new TypeError('execute must be a function');
  const {stdout}=await execute(executable,['agent','list','--format','json'],{cwd,timeout,maxBuffer:262144,encoding:'utf8',windowsHide:true});
  if(typeof stdout!=='string'||stdout.length>262144) throw new TypeError('invalid CLI output');
  let parsed;try{parsed=JSON.parse(stdout)}catch{throw new TypeError('Ruflo did not return a JSON agent list')}
  return normalizeRufloAgentList(parsed,{limit});
}
