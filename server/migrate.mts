import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from './db.mjs';
if(!db) throw new Error('DATABASE_URL is required to run migrations');
await db.query('create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())');
const dir=join(process.cwd(),'db','migrations');
for(const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()){
 const already=await db.query('select 1 from schema_migrations where filename=$1',[file]);
 if(already.rowCount) continue;
 const client=await db.connect();
 try {await client.query('begin');await client.query(await readFile(join(dir,file),'utf8'));await client.query('insert into schema_migrations(filename) values($1)',[file]);await client.query('commit');console.log(`Applied ${file}`);} catch(error){await client.query('rollback');throw error;} finally {client.release();}
}
await db.end();
