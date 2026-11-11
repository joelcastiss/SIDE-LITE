// Configure ONLY the freshly generated, disposable Supabase CLI project in CI.
import {copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

if (process.env.CI !== 'true' || process.env.SIDE_TEST_DISPOSABLE !== 'YES') throw Error('Solo para CI desechable');
const root=path.join(os.tmpdir(),'side-lite-validation-20261110');
const configPath=path.join(root,'supabase','config.toml');
let config=await readFile(configPath,'utf8');
const replace=(before,after)=>{if(!config.includes(before))throw Error('Plantilla CLI inesperada: '+before); config=config.replace(before,after)};
replace('project_id = "side-lite-validation-20261110"','project_id = "side-lite-validation-20261110"');
for(const [before,after] of [['port = 54321','port = 56721'],['port = 54322','port = 56722'],['shadow_port = 54320','shadow_port = 56720'],['port = 54323','port = 56723'],['port = 54324','port = 56724'],['site_url = "http://127.0.0.1:3000"','site_url = "http://127.0.0.1:4178"'],['enable_anonymous_sign_ins = false','enable_anonymous_sign_ins = true'],['enable_confirmations = false','enable_confirmations = true']])replace(before,after);
config+='\n[functions.side-lite-api]\nverify_jwt = false\n[functions.close-cycle]\nverify_jwt = false\n';
await writeFile(configPath,config);
const migrations=path.join(root,'supabase','migrations');await mkdir(migrations,{recursive:true});
for(const file of (await readdir('supabase-side-lite/supabase/migrations')).filter(f=>/^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort()) await copyFile(path.join('supabase-side-lite/supabase/migrations',file),path.join(migrations,file));
console.log('Configuración y migraciones copiadas al stack local desechable.');
