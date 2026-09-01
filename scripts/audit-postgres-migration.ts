import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = ['backend','src'];
const allowedSdkFiles = new Set(['backend/lib/auth.ts','src/lib/blink.ts']);
const forbiddenProviderUrl = /https?:\/\/[^\s"'`]*\.backend\.blink\.new/;
const sdkImport = /@blinkdotnew\/sdk/;
const failures: string[] = [];

function walk(dir:string){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()&&!['node_modules','.git','dist'].includes(entry.name))walk(full);
    else if(entry.isFile()&&/\.(ts|tsx|js|jsx)$/.test(entry.name))inspect(full);
  }
}
function inspect(full:string){
  const rel=path.relative(root,full).replaceAll(path.sep,'/');
  const text=fs.readFileSync(full,'utf8');
  if(sdkImport.test(text)&&!allowedSdkFiles.has(rel))failures.push(`${rel}: direct @blinkdotnew/sdk import`);
  if(forbiddenProviderUrl.test(text))failures.push(`${rel}: hard-coded Blink backend URL`);
}
for(const dir of roots)walk(path.join(root,dir));
const auth=fs.readFileSync(path.join(root,'backend/lib/auth.ts'),'utf8');
const frontendBlink=fs.readFileSync(path.join(root,'src/lib/blink.ts'),'utf8');
if(!auth.includes('createBlinkDbCompat'))failures.push('backend/lib/auth.ts: missing PostgreSQL DB compatibility boundary');
if(!frontendBlink.includes('/compat/db/'))failures.push('src/lib/blink.ts: missing PostgreSQL frontend DB compatibility boundary');
if(failures.length){console.error('PostgreSQL migration audit FAILED');for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}
console.log('PostgreSQL migration audit passed: Blink SDK usage is limited to the auth/realtime boundary and no hard-coded Blink backend URL remains in scanned source.');
