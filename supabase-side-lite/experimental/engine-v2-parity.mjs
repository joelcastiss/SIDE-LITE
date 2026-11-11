// Disposable localhost database only; creates a function in a temporary schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {closeCycle, EVENTS, marketingFactor} from '../../js/engine.js';

const raw=process.env.SIDE_LITE_TEST_DATABASE_URL;
if (!raw || process.env.SIDE_TEST_DISPOSABLE!=='YES') throw Error('Disposable localhost PostgreSQL required');
const url=new URL(raw);
if (!['127.0.0.1','localhost','[::1]','::1'].includes(url.hostname)) throw Error('Refusing non-local database');
const client=new pg.Client({connectionString:raw});
await client.connect();
try {
  await client.query('create temporary table side_marketing_factors(amount integer primary key, factor double precision not null)');
  const factors=[{amount:0,factor:marketingFactor(0)}];
  for(let amount=200;amount<=10000;amount++) factors.push({amount,factor:marketingFactor(amount)});
  await client.query('insert into side_marketing_factors select x.amount,x.factor from jsonb_to_recordset($1::jsonb) x(amount integer, factor double precision)',[JSON.stringify(factors)]);
  await client.query(await readFile(new URL('./engine-v2.sql',import.meta.url),'utf8'));
  const inputs=[];
  for(let i=0;i<12000;i++) {
    const costs={basic:10+i%31,standard:50,premium:70};
    const event=EVENTS[i%13] || null;
    const decision=i%17===0?null:{quality:['basic','standard','premium'][i%3],quantity:i%300,
      price:1+(i*137)%1200,marketingAmount:i%5===0?0:200+(i*811)%9801};
    const cash=1000000, batches=i%2?[{quantity:i%50,unitCost:5+i%40},{quantity:10,unitCost:70}]:[];
    const seed=crypto.randomUUID(), companyId=crypto.randomUUID();
    inputs.push({cash,batches,decision,costs,event,seed,companyId});
  }
  let checked=0;
  for(let start=0;start<inputs.length;start+=500) {
    const chunk=inputs.slice(start,start+500);
    const {rows}=await client.query(`select ord,pg_temp.side_engine_v2((x->>'cash')::bigint,x->'batches',
      nullif(x->'decision','null'::jsonb),x->'costs',nullif(x->'event','null'::jsonb),x->>'seed',x->>'companyId') result
      from jsonb_array_elements($1::jsonb) with ordinality as t(x,ord) order by ord`,[JSON.stringify(chunk)]);
    for(let j=0;j<rows.length;j++) {
      const x=chunk[j]; const expected=closeCycle({...x,event:x.event?.id||null});
      assert.deepEqual(rows[j].result,expected,`case ${start+j}: ${JSON.stringify(x)}`); checked++;
    }
  }
  console.log(`Parity: ${checked} cases passed using exact precomputed JS marketing factors.`);
} finally {await client.end();}
