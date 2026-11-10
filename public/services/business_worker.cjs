'use strict';
// Trusted server process. Never include this module or its credentials in HTML.
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {runOnce,remoteRpc}=require('./business_runtime.cjs');
async function main(){
  process.chdir(root);
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor del ejecutor.');
  const rpc=remoteRpc(url,key),once=process.argv.includes('--once');let stopping=false;
  process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
  do{
    try{const results=await runOnce(rpc);if(results.length)console.log(JSON.stringify({at:new Date().toISOString(),results}));}
    catch(error){console.error('Cierre automático:',error.message);if(once)process.exitCode=1;}
    if(!once&&!stopping)await new Promise(resolve=>setTimeout(resolve,10000));
  }while(!once&&!stopping);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={runOnce,remoteRpc};
