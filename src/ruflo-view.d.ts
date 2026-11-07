import type { SwarmSnapshot } from './ruflo.js';

export type RufloSourceState = 'unverified' | 'connected' | 'stale' | 'error' | 'disconnected';
export interface RufloSwarmViewOptions {
  adapter: { subscribe(listener: (snapshot: SwarmSnapshot) => void): () => void };
  container: Element;
  maxAgents?: number;
  maxMarkers?: number;
  showTaskTitles?: boolean;
}
export interface RufloSwarmView {
  setSourceState(state: RufloSourceState): void;
  destroy(): void;
}
export declare function createRufloSwarmView(options: RufloSwarmViewOptions): RufloSwarmView;
