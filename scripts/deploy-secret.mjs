// Upload only the Jev key through stdin. Never print or pass it in argv.
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const vars = await readFile(new URL('../.dev.vars', import.meta.url), 'utf8');
const match = vars.match(/^JEV_API_KEY=(.+)$/m);
if (!match) throw new Error('Add JEV_API_KEY to the ignored .dev.vars file first.');
const secret=match[1].trim().replace(/^(['"])(.*)\1$/,'$2');
const child = spawn('node_modules/.bin/wrangler', ['secret','put','JEV_API_KEY','--name','borrow-feature-engine'], {stdio:['pipe','inherit','inherit']});
child.stdin.end(secret+'\n');
child.on('error',()=>{console.error('Could not start Wrangler.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
