'use strict';
function service(rpc){
  const window={SIDE:{SupabaseClient:{get:()=>({rpc})}},
    SIDE_CYCLE_MODEL:require('../js/cycle_model.js'),
    SIDE_FINANCIAL_MODEL:require('../js/financial_model.js'),
    SIDE_FINANCE_CONFIG:require('./finance_config.js'),
    SIDE_DECISION_CATALOG:require('../js/decision_catalog.js')};
  require('./partida_service.js')(window);
  return window.SIDE.PartidaService;
}
async function runOnce(rpc,{deadline=Infinity}={}){
  const {data,error}=await rpc('side_cierres_pendientes',{});
  if(error||data?.error)throw new Error(error?.message||data.error);
  const api=service(rpc),results=[];
  for(const game of data||[]){
    // Always settle older cycles first: inventory, receivables and taxes carry over.
    for(const cycle of game.cycles){
      if(Date.now()>=deadline)return results;
      const result=await api.cerrarNegocio(game.id,cycle);
      results.push({game:game.id,cycle,success:result.success,pending:!!result.pending,code:result.code,error:result.error});
      if(!result.success||result.pending)break;
    }
  }
  return results;
}
function remoteRpc(url,key){
  return async(name,args)=>{
    const response=await fetch(url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(30000)});
    const data=await response.json();return response.ok?{data,error:null}:{data:null,error:{message:data.message||'RPC HTTP '+response.status,code:data.code}};
  };
}
module.exports={runOnce,remoteRpc};
