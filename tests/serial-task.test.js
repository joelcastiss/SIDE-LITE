import test from 'node:test';
import assert from 'node:assert/strict';
import {serialTask} from '../server/serial-task.js';

test('el barrido no se solapa y vuelve a ejecutarse tras un error',async()=>{
 let release,calls=0,errors=0;
 const first=new Promise(resolve=>{release=resolve});
 const run=serialTask(async()=>{calls++;if(calls===1)await first;if(calls===2)throw Error('prueba')},()=>errors++);
 const pending=run();
 assert.equal(await run(),false);
 assert.equal(calls,1);
 release();assert.equal(await pending,true);
 assert.equal(await run(),false);assert.equal(errors,1);
 assert.equal(await run(),true);assert.equal(calls,3);
});
