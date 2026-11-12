import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {marketingFactor} from '../../js/engine.js';
import {allocateDistrictDemand} from '../../js/market-engine-v3.js';
const url=new URL(process.env.SIDE_LITE_TEST_DATABASE_URL || '');
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||!['127.0.0.1','localhost'].includes(url.hostname)) throw Error('Disposable local database required');
const client=new pg.Client({connectionString:url.href});await client.connect();
try {
 await client.query('create temporary table side_marketing_factors(amount integer primary key, factor double precision not null)');
 const factors=[{amount:0,factor:marketingFactor(0)}];for(let amount=200;amount<=10000;amount++)factors.push({amount,factor:marketingFactor(amount)});
 await client.query('insert into side_marketing_factors select x.amount,x.factor from jsonb_to_recordset($1::jsonb) x(amount integer, factor double precision)',[JSON.stringify(factors)]);
 await client.query(await readFile(new URL('./market-v3.sql',import.meta.url),'utf8'));
 for(let i=0;i<1000;i++){
  const shares=i%2?[.55,.35,.1]:[.2,.4,.4],companies=Array.from({length:1+i%7},(_,j)=>({id:`company-${j}`,decision:(i+j)%17===0?null:{quality:['basic','standard','premium'][(i+j)%3],price:1+(i*137+j*17)%1000,marketingAmount:(i+j)%5===0?0:200+(i*811+j*37)%9801}}));
  const input={baseDemand:10+i%991,shares,companies,demandFactor:i%2?1:1.15};
  const actual=(await client.query('select pg_temp.side_market_demand($1,$2,$3,$4) result',[input.baseDemand,shares,JSON.stringify(companies),input.demandFactor])).rows[0].result;
  assert.deepEqual(actual,allocateDistrictDemand(input),`case ${i}`);
 }
 console.log('v3 allocation parity: 1000 cases passed');
}finally{await client.end()}
