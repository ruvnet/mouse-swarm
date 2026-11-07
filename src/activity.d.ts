import type { AgentStatus, TaskStatus } from './ruflo.js';
export type ActivityEvent = { type: 'agent.upsert'; id: string; role?: string; status?: AgentStatus; revision?: number } | { type: 'agent.remove'; id: string; revision?: number } | { type: 'task.update'; id: string; taskId: string; status: TaskStatus; revision?: number };
export type ActivitySource = { kind: 'ruflo' | 'metaharness'; mode: 'snapshot' | 'event'; reference: string };
export type ActivityEntry = { readonly sequence: number; readonly observedAt: number; readonly source: ActivitySource; readonly event: ActivityEvent };
export type ActivityRecording = { readonly version: 1; readonly events: readonly ActivityEntry[] };
export declare function createActivityRecorder(options?: {maxEvents?: number}): {record(input: {source: ActivitySource; observedAt: number; event: ActivityEvent}): ActivityEntry; recordSnapshot(input: {source: ActivitySource; observedAt: number; events: ActivityEvent[]}): readonly ActivityEntry[]; snapshot(): ActivityRecording; dispose(): void};
export declare function validateActivityRecording(recording: unknown): ActivityRecording;
export declare function replayActivity(recording: ActivityRecording, options: {reset: () => void; apply: (entry: ActivityEntry) => void; through?: number}): number;
export declare function createActivityPlayer(options: {recording: ActivityRecording; reset: () => void; apply: (entry: ActivityEntry) => void; setTimer?: (callback: () => void, ms: number) => unknown; clearTimer?: (timer: unknown) => void; now?: () => number; onError?: (error: unknown) => void}): {play(): void; pause(): void; seek(count: number): void; destroy(): void; getState(): {readonly state: string; readonly index: number; readonly total: number}};
