import type { SwarmEvent } from './ruflo.js';
/** Native MetaHarness SessionEvent envelope; payload is untrusted and may contain private data. */
export interface MetaHarnessSessionEvent { index:number; branch:string; parent?:{branch:string;index:number}; kind:string; payload:unknown }
export type MinimalSwarmEvent = Omit<Extract<SwarmEvent,{type:'agent.upsert'}>,'label'|'position'> | Extract<SwarmEvent,{type:'agent.remove'}> | Omit<Extract<SwarmEvent,{type:'task.update'}>,'title'>;
export interface MetaHarnessObservation { source:{kind:'metaharness';mode:'event';reference:string}; observedAt:number; event:MinimalSwarmEvent }
/** Host is responsible for source authenticity and the semantics of its explicit mapping. */
export declare function createMetaHarnessAdapter(options:{sourceId:string;mapEvent:(event:MetaHarnessSessionEvent)=>MinimalSwarmEvent|null|undefined;record:(observation:MetaHarnessObservation)=>unknown;clock?:()=>number;maxBranches?:number}):{ingest(event:MetaHarnessSessionEvent):boolean;dispose():void};
