export declare const VIDEO_PRESETS: Readonly<Record<'portrait'|'square'|'vertical', Readonly<{width:number;height:number}>>>;
export interface SwarmVideoOptions {
  page: {setViewportSize(size:{width:number;height:number}):Promise<unknown>;screenshot(options:{type:'jpeg';quality:number;animations:'allow'}):Promise<Buffer>};
  outputPath:string; preset?:'portrait'|'square'|'vertical'; width?:number; height?:number; duration?:number; fps?:number; ffmpeg?:string; signal?:AbortSignal;
}
export declare function exportSwarmVideo(options:SwarmVideoOptions):Promise<{outputPath:string;width:number;height:number;fps:number;frames:number;duration:number}>;
