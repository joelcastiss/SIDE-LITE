import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {assertLocalDatabase} from './database-url.js';
const pool=new pg.Pool({connectionString:assertLocalDatabase(process.env.DATABASE_URL)});
try { const folder=new URL('../supabase/migrations/',import.meta.url);for(const name of (await readdir(folder)).filter(x=>/^\d+.*\.sql$/.test(x)).sort()){await pool.query(await readFile(new URL(name,folder),'utf8'));console.log(`Aplicada: ${name}`)} } finally { await pool.end(); }
