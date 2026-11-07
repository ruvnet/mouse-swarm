import type {MetaHarnessSessionEvent} from './metaharness.js';
/** The host explicitly selects and authenticates a local session file and maps its events. */
export interface MetaHarnessFileOptions {
 path: string;
 adapter: {ingest(event:MetaHarnessSessionEvent):boolean};
 maxBytes?:number;
 maxEvents?:number;
 maxBranches?:number;
}
/** The reader checks structural framing, not a MetaHarness state hash or source authenticity. */
export declare function importMetaHarnessSessionFile(options:MetaHarnessFileOptions):Promise<Readonly<{records:number;accepted:number;ignored:number}>>;
