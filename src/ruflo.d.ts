/** Normalized host supplied data, not a native Ruflo wire protocol. */
export type AgentStatus = 'unknown' | 'idle' | 'active' | 'busy' | 'terminated' | 'working' | 'running' | 'paused' | 'blocked' | 'completed' | 'done' | 'failed' | 'error' | 'offline';
export type TaskStatus = 'open' | 'claimed' | 'blocked' | 'complete' | 'completed' | 'pending' | 'failed' | 'cancelled' | 'in_progress';
export interface ObservedPosition { readonly x: number; readonly y: number }
export interface ProjectedTask { readonly id: string; readonly title: string; readonly status: TaskStatus }
export interface ProjectedAgent { readonly id: string; readonly label: string; readonly role: string; readonly status: AgentStatus; readonly position: ObservedPosition | null; readonly task: ProjectedTask | null; readonly revision?: number }
export interface SwarmSnapshot { readonly version: number; readonly agents: readonly ProjectedAgent[] }
export type SwarmEvent =
  | { type: 'agent.upsert'; id: string; label?: string; role?: string; status?: AgentStatus; position?: ObservedPosition | null; revision?: number }
  | { type: 'agent.remove'; id: string; revision?: number }
  | { type: 'task.update'; id: string; taskId: string; title?: string; status: TaskStatus; revision?: number };
export interface RufloSwarmAdapter { ingest(event: SwarmEvent): boolean; replaceAgents(events: Extract<SwarmEvent, {type:'agent.upsert'}>[]): boolean; subscribe(listener: (snapshot: SwarmSnapshot) => void): () => void; snapshot(): SwarmSnapshot; remove(id: string): boolean; dispose(): void }
export interface RufloAdapterOptions { maxAgents?: number; onError?: (error: unknown) => void }
export declare function createRufloSwarmAdapter(options?: RufloAdapterOptions): RufloSwarmAdapter;
