export interface CaptureTarget {x:number;y:number;width:number;height:number;label:string}
export interface CaptureOptions {width?:number;height?:number;selector?:string;maxTargets?:number;cursors?:number;interval?:number}
export declare const DEFAULT_CAPTURE_SELECTOR:string;
export declare function validateCaptureSpec(options?:CaptureOptions):Readonly<Required<CaptureOptions>>;
export declare function buildCaptureDocument(spec:CaptureOptions,targets:CaptureTarget[]):string;
export declare function captureViewport(options:CaptureOptions & {page:{setViewportSize(value:{width:number;height:number}):Promise<unknown>;evaluate<T>(fn:(...args:any[])=>T,arg?:unknown):Promise<Awaited<T>>;screenshot(options:{type:'png';animations:'disabled'}):Promise<Uint8Array>};outputDir:string}):Promise<Readonly<{outputDir:string;width:number;height:number;targets:number}>>;
