#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const help=`mouse-swarm init [--claude] [--codex] [--force]\n\nInstall the mouse-swarm-reveal skill into this project.\nWithout an agent flag, install for both Claude Code and Codex.\n--force replaces an existing skill directory.\n`;
if(!args.length || args.includes('--help') || args.includes('-h')) { console.log(help); process.exit(0); }
if(args[0]!=='init' || args.slice(1).some(a=>!['--claude','--codex','--force'].includes(a))) { console.error(help); process.exit(2); }
const chosen=args.includes('--claude')||args.includes('--codex');
const targets=[];
if(!chosen || args.includes('--claude'))targets.push(join(process.cwd(),'.claude','skills','mouse-swarm-reveal'));
if(!chosen || args.includes('--codex'))targets.push(join(process.cwd(),'.agents','skills','mouse-swarm-reveal'));
const source=resolve(dirname(fileURLToPath(import.meta.url)),'../skills/mouse-swarm-reveal');
const conflicts=targets.filter(existsSync);
if(conflicts.length && !args.includes('--force')) { console.error('Skill already exists. Use --force to replace it:'); conflicts.forEach(x=>console.error(x)); process.exit(1); }
for(const target of targets){ mkdirSync(dirname(target),{recursive:true}); cpSync(source,target,{recursive:true,force:true}); console.log(`Installed: ${target}`); }
