import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile('.neon-dev-secrets.json','utf8'));
config.PORT='4196';
const child=spawn(process.execPath,['remote/dev-runner.js'],{stdio:['pipe','pipe','pipe']});
try {
  const ready=new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('El puente no inició')),20000);child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('listo')){clearTimeout(timeout);resolve()}});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('El puente terminó antes de iniciar'))})});
  child.stdin.end(JSON.stringify(config)+'\n');await ready;
  let response=await fetch('http://127.0.0.1:4196/api/games');assert.equal(response.status,401);
  response=await fetch('http://127.0.0.1:4196/api/teacher/activate',{method:'POST',headers:{'authorization':'Bearer fake','content-type':'application/json'},body:'{}'});assert.equal(response.status,401);
  console.log('PASS: puente Neon real rechaza solicitudes anónimas y tokens falsos');
} finally {child.kill();}
