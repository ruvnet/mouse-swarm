/** Structural interface: Playwright itself is an optional dependency. */
export interface RevealPage {
  evaluate<R, A>(fn: (arg:A)=>R, arg:A): Promise<R>;
  waitForFunction<A>(fn:(arg:A)=>unknown, arg:A, options:{timeout:number}): Promise<unknown>;
  emulateMedia(options:{reducedMotion:'reduce'|'no-preference'}):Promise<unknown>;
  locator(selector:string):{click():Promise<unknown>};
}
export interface RevealInspection {targets:number;hidden:number;visible:number;hiddenInert:number;overlays:number;overlayPointerTransparent:boolean|null;reducedMotion:boolean}
export interface PlaywrightRevealOptions {page:RevealPage;root?:string;targets?:string;overlay?:string;controls?:Partial<Record<'replay'|'pause'|'resume'|'skip',string>>}
export interface PlaywrightRevealHarness {
  inspect():Promise<RevealInspection>;
  /** Targets no longer have data-ms-hidden; text typing and callbacks may still be running. */
  waitForTargetsVisible(options?:{timeout?:number;minTargets?:number}):Promise<RevealInspection>;
  setReducedMotion(enabled:boolean):Promise<void>;
  press(action:'replay'|'pause'|'resume'|'skip'):Promise<void>;
}
export declare function createPlaywrightRevealHarness(options:PlaywrightRevealOptions):PlaywrightRevealHarness;
