export interface RufloAgentEvent { type:'agent.upsert'; id:string; label:string; role:string; status:'idle'|'busy'|'terminated'|'unknown' }
export declare function normalizeRufloAgentList(value:unknown, options?:{limit?:number}):RufloAgentEvent[];
export declare function readRufloAgents(options?:{cwd?:string; executable?:string; timeout?:number; limit?:number}):Promise<RufloAgentEvent[]>;
