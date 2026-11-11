// Isolated PostgreSQL experiment only; not an application implementation.
// The gate limits claims, not inbound HTTP requests or Edge invocations.
import assert from 'node:assert/strict';
import pg from 'pg';
const url=process.env.SIDE_WAKEUP_TEST_URL;
if(process.env.SIDE_TEST_DISPOSABLE!=='YES'||url!=='postgresql://postgres@127.0.0.1:55481/postgres') throw Error('Se requiere el clúster aislado designado.');
const pool=new pg.Pool({connectionString:url,max:25});
try {
 await pool.query(`create table wakeup_gate_experiment (id boolean primary key default true check(id), due_at timestamptz not null, claimed boolean not null default false); insert into wakeup_gate_experiment(due_at) values(clock_timestamp()+interval '1 hour')`);
 const claim=`update wakeup_gate_experiment set claimed=true where id=true and not claimed and due_at<=clock_timestamp() returning id`;
 assert.equal((await pool.query(claim)).rowCount,0,'no se autoriza trabajo futuro');
 await pool.query("update wakeup_gate_experiment set due_at=clock_timestamp()-interval '1 second'");
 const results=await Promise.all(Array.from({length:50},()=>pool.query(claim)));
 assert.equal(results.reduce((sum,r)=>sum+r.rowCount,0),1,'solo una solicitud obtiene el trabajo vencido');
 assert.equal((await pool.query(claim)).rowCount,0,'no se acepta repetición');
 await pool.query('update wakeup_gate_experiment set claimed=false');
 const client=await pool.connect();
 try{await client.query('begin');assert.equal((await client.query(claim)).rowCount,1);await client.query('rollback');}finally{client.release();}
 assert.equal((await pool.query(claim)).rowCount,1,'rollback permite recuperar el trabajo');
 console.log('PASS: vencimiento, 50 solicitudes concurrentes, repetición y recuperación tras rollback.');
 console.log('LÍMITE: las 50 solicitudes alcanzaron PostgreSQL; el experimento no limita invocaciones públicas ni consumo de Edge.');
} finally {await pool.end();}
