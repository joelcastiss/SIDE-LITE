import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {closeDue} from '../remote/close-cycle.js';
const settings=JSON.parse(await readFile('.neon-dev-secrets.json','utf8'));const conn=new URL(settings.NEON_DATABASE_URL);conn.searchParams.set('sslmode','verify-full');const pool=new pg.Pool({connectionString:conn.toString(),max:4});const id=process.env.SIDE_LITE_TEST_CYCLE_ID;if(!id)throw Error('SIDE_LITE_TEST_CYCLE_ID requerida');
try{await Promise.all([closeDue(pool),closeDue(pool)]);const {rows:[row]}=await pool.query('SELECT cy.status,count(r.id)::int AS count FROM lite.lite_cycles cy LEFT JOIN lite.lite_results r ON r.cycle_id=cy.id WHERE cy.id=$1 GROUP BY cy.id',[id]);assert.equal(row.status,'closed');assert.equal(row.count,1);console.log('PASS: dos cierres concurrentes en Neon produjeron un solo resultado')}finally{await pool.end()}
