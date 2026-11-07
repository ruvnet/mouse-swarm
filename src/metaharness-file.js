/** Read an explicitly selected local MetaHarness SessionLog JSONL snapshot.
 * No discovery, network access, task execution, polling, or raw-data export.
 */
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {TextDecoder} from 'node:util';

const safeBranch=/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,31}$/;
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const loneSurrogate=/(?:[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF])/;
function containsLoneSurrogate(root){
 const stack=[root];
 while(stack.length){
  const value=stack.pop();
  if(typeof value==='string'){if(loneSurrogate.test(value))return true;continue}
  if(value===null||typeof value!=='object')continue;
  if(Array.isArray(value)){for(const item of value)stack.push(item)}
  else for(const [key,item] of Object.entries(value)){if(loneSurrogate.test(key))return true;stack.push(item)}
 }
 return false;
}

/**
 * Import a bounded complete JSONL snapshot into a host-configured MetaHarness
 * adapter. SessionLog writes one UTF-8 JSON object followed by a newline per
 * event. Structural validation precedes adapter calls; this reader does not
 * verify MetaHarness state hashes, source authenticity, or event semantics.
 * If mapping or recording throws, already ingested entries remain committed.
 */
export async function importMetaHarnessSessionFile({path,adapter,maxBytes=2097152,maxEvents=10000,maxBranches=32}={}){
 if(typeof path!=='string'||!path||path.includes('\0'))throw new TypeError('path must be a local file path');
 if(!adapter||typeof adapter.ingest!=='function')throw new TypeError('a configured MetaHarness adapter is required');
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16777216)throw new RangeError('maxBytes must be from 1 to 16777216');
 if(!Number.isSafeInteger(maxEvents)||maxEvents<1||maxEvents>10000)throw new RangeError('maxEvents must be from 1 to 10000');
 if(!Number.isSafeInteger(maxBranches)||maxBranches<1||maxBranches>256)throw new RangeError('maxBranches must be from 1 to 256');
 const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 let bytes;
 try{
  const stat=await file.stat();
  if(!stat.isFile())throw new TypeError('session path must be a regular file');
  if(stat.size>maxBytes)throw new RangeError('session file exceeds byte limit');
  const chunks=[];let total=0;
  for(;;){
   const buffer=Buffer.allocUnsafe(Math.min(65536,maxBytes+1-total));
   const {bytesRead}=await file.read(buffer,0,buffer.length,null);
   if(!bytesRead)break;
   total+=bytesRead;if(total>maxBytes)throw new RangeError('session file exceeds byte limit');
   chunks.push(buffer.subarray(0,bytesRead));
  }
  bytes=Buffer.concat(chunks,total);
 }finally{await file.close()}
 let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new TypeError('session file must be valid UTF-8')}
 if(raw&&!raw.endsWith('\n'))throw new TypeError('session file ends with an incomplete line');
 const events=[],next=new Map(),seen=new Map();let lineNumber=0;
 for(const line of raw.split('\n')){
  lineNumber++;if(!line.trim())continue;
  if(events.length>=maxEvents)throw new RangeError('session file exceeds event limit');
  let event;try{event=JSON.parse(line)}catch{throw new TypeError(`invalid session JSON at line ${lineNumber}`)}
  if(containsLoneSurrogate(event))throw new TypeError(`invalid session Unicode at line ${lineNumber}`);
  if(!isRecord(event)||!Number.isSafeInteger(event.index)||event.index<0||typeof event.branch!=='string'||!safeBranch.test(event.branch)||typeof event.kind!=='string'||event.kind.length<1||event.kind.length>128||!Object.hasOwn(event,'payload'))throw new TypeError(`invalid session event at line ${lineNumber}`);
  if(event.parent!==undefined&&(!isRecord(event.parent)||typeof event.parent.branch!=='string'||!safeBranch.test(event.parent.branch)||!Number.isSafeInteger(event.parent.index)||event.parent.index<0))throw new TypeError(`invalid session parent at line ${lineNumber}`);
  const expected=next.get(event.branch)??0;
  if(event.index!==expected)throw new TypeError(`invalid session index at line ${lineNumber}`);
  if(expected===0){
   if(next.size>=maxBranches)throw new RangeError('session file exceeds branch limit');
   if(events.length===0&&event.parent!==undefined)throw new TypeError(`invalid root parent at line ${lineNumber}`);
   if(events.length>0&&(!event.parent||!seen.get(event.parent.branch)?.has(event.parent.index)))throw new TypeError(`missing session parent at line ${lineNumber}`);
   seen.set(event.branch,new Set());
  }
  seen.get(event.branch).add(event.index);next.set(event.branch,expected+1);events.push(event);
 }
 let accepted=0;
 for(const event of events)if(adapter.ingest(event))accepted++;
 return Object.freeze({records:events.length,accepted,ignored:events.length-accepted});
}
