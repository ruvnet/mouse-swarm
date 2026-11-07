export type RevealStatus = 'idle' | 'running' | 'paused' | 'complete' | 'error' | 'destroyed';
export type CompletionReason = 'completed' | 'skipped' | 'reduced-motion' | 'empty';
export interface RevealProgress { current: number; total: number }
/** role is a visual label supplied by data-swarm-role, not agent telemetry. */
export interface RevealStep extends RevealProgress { kind: 'show' | 'type'; element: Element; role?: string }
export interface RevealCompletion extends RevealProgress { reason: CompletionReason }
export interface RevealOptions {
  root?: Document | Element;
  selector?: string;
  cursors?: number;
  interval?: number;
  typeText?: boolean;
  typeWords?: number;
  colors?: string[];
  botEvery?: number;
  cursorSize?: number;
  cursorSpeed?: number;
  selection?: boolean;
  labels?: string[];
  autoScroll?: boolean;
  onStep?: (event: RevealStep) => void;
  onComplete?: (event: RevealCompletion) => void;
  onError?: (error: unknown) => void;
}
export interface SwarmReveal {
  start(): void;
  replay(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  destroy(): void;
  getState(): RevealProgress & { status: RevealStatus };
}
export declare function createSwarmReveal(options?: RevealOptions): SwarmReveal;

