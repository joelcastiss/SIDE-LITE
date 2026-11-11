// Generate a reviewed migration after `supabase migration new` creates its file.
// Generated factors preserve the JavaScript engine's exact double values.
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, relative, sep} from 'node:path';
import {marketingFactor} from '../../js/engine.js';
const target=resolve(process.argv[2]||'');
const root=resolve('supabase-side-lite/supabase/migrations');
const rel=relative(root,target);
if (!rel || rel.startsWith('..'+sep) || !/^\d{14}_side_lite_sql_closer\.sql$/.test(rel)) throw Error('Expected new side_lite_sql_closer migration');
if ((await readFile(target,'utf8')).trim()) throw Error('Refusing to overwrite a nonempty migration');
const rows=[`(0,${marketingFactor(0)})`];
for(let i=200;i<=10000;i++) rows.push(`(${i},${marketingFactor(i)})`);
const files=['engine-v2.sql','close-one.sql','sweep.sql','cron-procedure.sql'];
const functions=[];
for(const file of files) {
  const text=await readFile(new URL(file,import.meta.url),'utf8');
  functions.push(text.replaceAll('pg_temp.','side_lite_private.').replaceAll('-- Experimental only: temporary functions, no deployment or grants.','').replaceAll('-- Experimental only: one failed cycle is rolled back without starving others.','').replaceAll('-- Experimental parity candidate only. Do not deploy or use for official closes.',''));
}
const sql=`-- Generated from js/engine.js v2 and experimental SQL. Review and validate before applying.
create table side_lite_private.side_marketing_factors(amount integer primary key, factor double precision not null);
alter table side_lite_private.side_marketing_factors enable row level security;
revoke all on side_lite_private.side_marketing_factors from public, anon, authenticated, service_role;
grant select on side_lite_private.side_marketing_factors to side_lite_closer;
grant select on public.lite_events to side_lite_closer;
insert into side_lite_private.side_marketing_factors(amount,factor) values\n${rows.join(',\n')};
${functions.join('\n')}
revoke all on function side_lite_private.side_engine_v2(bigint,jsonb,jsonb,jsonb,jsonb,text,text) from public, anon, authenticated, service_role;
revoke all on function side_lite_private.side_close_one(uuid) from public, anon, authenticated, service_role;
revoke all on function side_lite_private.side_sweep() from public, anon, authenticated, service_role;
revoke all on procedure side_lite_private.side_cron_sweep() from public, anon, authenticated, service_role;
grant execute on function side_lite_private.side_engine_v2(bigint,jsonb,jsonb,jsonb,jsonb,text,text) to side_lite_closer;
grant execute on function side_lite_private.side_close_one(uuid) to side_lite_closer;
grant execute on function side_lite_private.side_sweep() to side_lite_closer;
-- Cron is intentionally installed separately, after verification of this migration.
`;
await writeFile(target,sql);
console.log(`Generated ${rel} with ${rows.length} exact marketing factors; cron not activated.`);
