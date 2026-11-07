/** Helpers for inspecting an existing Playwright page; no browser is launched and no network calls are made. */
const ACTIONS=new Set(['replay','pause','resume','skip']);
function selector(value,name){if(typeof value!=='string'||!value.trim()||value.length>512)throw new TypeError(`${name} must be a non-empty CSS selector under 513 characters`);return value}
function configured(page,{root='body',targets='[data-swarm-item]',overlay='.ms-overlay',controls={}}={}){
  if(!page||typeof page.evaluate!=='function'||typeof page.waitForFunction!=='function'||typeof page.emulateMedia!=='function'||typeof page.locator!=='function')throw new TypeError('a Playwright Page is required');
  root=selector(root,'root');targets=selector(targets,'targets');overlay=selector(overlay,'overlay');
  if(!controls||typeof controls!=='object'||Array.isArray(controls))throw new TypeError('controls must be a selector map');
  const known={};for(const [key,value] of Object.entries(controls)){if(!ACTIONS.has(key))throw new TypeError('unknown control');known[key]=selector(value,key)}
  return {page,root,targets,overlay,controls:known};
}
/** Inspect DOM markers. `hidden` describes this module's markers, not full visual accessibility. */
export function createPlaywrightRevealHarness(options={}){
  const {page,root,targets,overlay,controls}=configured(options.page,options);
  async function inspect(){
    return page.evaluate(({root,targets,overlay})=>{
      const parent=document.querySelector(root);if(!parent)throw new Error('reveal root not found');
      const items=Array.from(parent.querySelectorAll(targets));
      const hidden=items.filter(el=>el.hasAttribute('data-ms-hidden'));
      const layers=Array.from(document.querySelectorAll(overlay));
      return {targets:items.length,hidden:hidden.length,visible:items.length-hidden.length,
        hiddenInert:hidden.filter(el=>el.hasAttribute('inert')).length,
        overlays:layers.length,overlayPointerTransparent:layers.length?layers.every(el=>getComputedStyle(el).pointerEvents==='none'):null,
        reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
    },{root,targets,overlay});
  }
  /** Wait for selected targets to lose the hidden marker. This does not prove typing or callbacks have completed. */
  async function waitForTargetsVisible({timeout=10000,minTargets=1}={}){
    if(!Number.isFinite(timeout)||timeout<1||timeout>120000)throw new RangeError('timeout must be from 1 to 120000 ms');
    if(!Number.isInteger(minTargets)||minTargets<1||minTargets>10000)throw new RangeError('minTargets must be from 1 to 10000');
    const handle=await page.waitForFunction(({root,targets,minTargets})=>{const parent=document.querySelector(root);if(!parent)return false;const items=Array.from(parent.querySelectorAll(targets));return items.length>=minTargets&&items.every(el=>!el.hasAttribute('data-ms-hidden'))},{root,targets,minTargets},{timeout});
    if(handle&&typeof handle.dispose==='function')await handle.dispose();
    return inspect();
  }
  async function setReducedMotion(enabled){if(typeof enabled!=='boolean')throw new TypeError('enabled must be a boolean');await page.emulateMedia({reducedMotion:enabled?'reduce':'no-preference'})}
  async function press(action){if(!ACTIONS.has(action)||!controls[action])throw new TypeError('control selector is not configured');await page.locator(controls[action]).click()}
  return Object.freeze({inspect,waitForTargetsVisible,setReducedMotion,press});
}
