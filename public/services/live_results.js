/* Read-only results from the same confirmed plan used by the student. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('../js/cycle_model.js'):root.SIDE_CYCLE_MODEL,node?require('../js/financial_model.js'):root.SIDE_FINANCIAL_MODEL,node?require('./finance_config.js'):root.SIDE_FINANCE_CONFIG);
  if(node)module.exports=api;else root.SIDE_LIVE_RESULTS=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(CYCLE,FIN,CONFIG){
  'use strict';
  function calculate({snapshot={},round=1,capital=0,catalog=[],config={},id='',phase='decisions'}={}){
    const state=snapshot.decision_state||{},receipt=state.__cycleSettlements?.[round];
    const ledger={...snapshot.cash_ledger};let previous=0;
    for(let cycle=1;cycle<=round;cycle++){
      const adjustment=CONFIG.adjustment(config,cycle,id,capital);
      if(adjustment!==previous)ledger[`${cycle}:CAPITAL_ADJUSTMENT`]=adjustment-previous;
      previous=adjustment;
    }
    const input={state,ledger,round,capital,catalog,sectionsByRound:snapshot.financial_sections||{},financialPolicy:CONFIG.resolve(config,round),events:state.__cycleBusiness?.[round]?.events||[]};
    // A closed cycle is displayed from its sealed financial snapshot. Replaying
    // the current model or mutable client ledger can change historical results.
    if(receipt){
      const financial=state.__financialSnapshots?.[round];
      return financial?{round,provisional:false,receipt,financial}:null;
    }
    const plan=state.__cyclePlans?.[round];
    if(phase!=='decisions'||!plan?.state||typeof plan.state!=='object')return null;
    return {...CYCLE.project({...input,state:CYCLE.restoreState(plan.state,state)}),round};
  }
  function apply(report,result){
    if(!result||Number(report.ronda)!==Number(result.round))return report;
    const f=result.financial;
    return Object.assign(report,{provisional:result.provisional,marketScope:result.marketScope,cycleReceipt:result.receipt,
      unidadesVendidas:Number(result.receipt?.sold||0),ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,
      utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,estadoResultados:f.estadoResultados,
      balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral});
  }
  // Compatibility transport: existing report JSON already accepts extra keys.
  // It keeps canonical revenue/cash unchanged and never supersedes a closure.
  function fromReport(report,{game,company,round,phase}={}){
    const p=report?.estado_resultados?.liveProjection;
    if(phase!=='decisions'||report?.estado_resultados?.cycleReceipt||!p?.provisional||p.marketScope!=='individual'
      ||p.game!==game||p.company!==String(company)||Number(p.round)!==Number(round)||Number(p.receipt?.round)!==Number(round)
      ||!p.financial?.estadoResultados||!p.financial?.balanceCaja)return null;
    return p;
  }
  return {calculate,apply,fromReport};
});
