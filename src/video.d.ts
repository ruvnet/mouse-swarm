export declare const VIDEO_PRESETS: Readonly<Record<'portrait'|'square'|'vertical', Readonly<{width:number;height:number}>>>;
export declare function isLocalVideoRequest(headers: {host?:string;origin?:string;'sec-fetch-site'?:string}, port:number): boolean;
export interface VideoSettings {preset?:'portrait'|'square'|'vertical';width?:number;height?:number;duration?:number;fps?:number;jpegQuality?:number;crf?:number;encoderPreset?:'ultrafast'|'superfast'|'veryfast'|'faster'|'fast'|'medium'|'slow'|'slower'|'veryslow';browser?:'chromium'|'firefox'|'webkit';browserExecutable?:string;colorScheme?:'light'|'dark'|'no-preference';reducedMotion?:'reduce'|'no-preference';waitMs?:number}
export declare function resolveVideoSettings(config?:VideoSettings,overrides?:VideoSettings): Readonly<Required<Omit<VideoSettings,'browserExecutable'>> & Pick<VideoSettings,'browserExecutable'>>;
export interface SwarmVideoOptions {
  page: {setViewportSize(size:{width:number;height:number}):Promise<unknown>;screenshot(options:{type:'jpeg';quality:number;animations:'allow'}):Promise<Uint8Array>};
  outputPath:string; preset?:'portrait'|'square'|'vertical'; width?:number; height?:number; duration?:number; fps?:number; jpegQuality?:number; crf?:number; encoderPreset?:VideoSettings['encoderPreset']; ffmpeg?:string; signal?:AbortSignal;
}
export declare function exportSwarmVideo(options:SwarmVideoOptions):Promise<{outputPath:string;width:number;height:number;fps:number;frames:number;duration:number}>;
