import { mkdir, readdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
const source=join(process.cwd(),'server','core');
const target=join(process.cwd(),'dist-server','core');
await mkdir(target,{recursive:true});
for(const name of await readdir(source)) if(name.endsWith('.mjs')) await copyFile(join(source,name),join(target,name));
