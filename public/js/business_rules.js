/* Reglas de Costos De Producción y correcciones del documento SIDE (27/10/2026). */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_BUSINESS_RULES=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='md-20261027',n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const salaries={corte_basico:1500,corte_exp:2000,corte_maestro:3800,ens_personal_basico:1500,ens_personal_ind:2800,ens_personal_esp:4500,aca_personal_basico:1500,aca_personal_tec:2800,aca_personal_art:4500,si_jefatura:3000,limpieza:600};
  const regimes={MYPE:{installation:.03,training:.02,moldTraining:.01,maintenance:.05,residual:.05,divisor:12.5,grati:1,vacation:.5,cts:750},NO_MYPE:{installation:.05,training:.03,moldTraining:.02,maintenance:.08,residual:.10,divisor:13,grati:2,vacation:1,cts:1500}};
  function regime(ctx={}){const ids=ctx.drafts?.REGIMEN_LABORAL?.optionIds??ctx.state?.REGIMEN_LABORAL?.optionIds??[];return ids.includes('no_mype')?'NO_MYPE':'MYPE';}
  function laborCost(option,regimen='MYPE',fallback=0){const base=salaries[option],r=regimes[regimen]||regimes.MYPE;if(base==null)return n(fallback);
    // Se preservan los importes del documento: no define una nueva regla universal de CTS.
    const cts=option==='corte_exp'?base*(regimen==='NO_MYPE'?1:.5):r.cts;
    return (base*12+base*.09+base*r.grati+cts+base*r.vacation)/r.divisor;
  }
  function materialUnitPrice(option,quantity,analystDiscount=0,config={}){
    const rules=config.materials||{},threshold=Number(rules.quantityDiscountThreshold??100),rate=Number(rules.quantityDiscountRate??.08);
    const quantityRate=n(quantity)>=Math.max(0,threshold)?Math.min(1,Math.max(0,rate)):0;
    return n(option.cost)*(1-quantityRate)*(1-Math.min(100,n(analystDiscount))/100);
  }
  function assetCost(item,option,regimen='MYPE'){const r=regimes[regimen]||regimes.MYPE,base=n(option.cost),mold=item.id==='MOLDE';return base*(1+(mold?0:r.installation)+(mold?r.moldTraining:r.training));}
  function advertising(ctx={}){const entry=ctx.drafts?.INV_MARKETING??ctx.state?.INV_MARKETING??{};if(Object.hasOwn(entry,'value'))return Math.min(10000,n(entry.value));const legacy={mkt_baja:1500,mkt_media:6000,mkt_alta:10000};return legacy[entry.optionIds?.[0]]||0;}
  function assetPurchaseHistory(entry,definition){
    if(entry?.purchases&&typeof entry.purchases==='object'&&!Array.isArray(entry.purchases))return entry.purchases;
    const round=Number(entry?.round);
    if(!Number.isSafeInteger(round)||round<1)return {};
    const quantities=Object.fromEntries((definition?.options||[]).map(option=>[option.id,Math.floor(n(entry?.quantities?.[option.id]))||Number(entry?.optionIds?.includes(option.id)||false)]).filter(([,quantity])=>quantity>0));
    return Object.keys(quantities).length?{[round]:quantities}:{};
  }
  function quantity(state,id,option,round){return Math.max(0,Object.entries(assetPurchaseHistory(state[id],{options:[{id:option}]})).filter(([r])=>Number(r)<=round).reduce((s,[,row])=>s+(Number(row?.[option])||0),0));}
  function maintenance(state,catalog,round=1){const r=regimes[regime({state})];return (catalog||[]).flatMap(c=>c.items||[]).filter(i=>i.asset||i.id==='MOLDE').reduce((s,item)=>s+(item.options||[]).reduce((t,o)=>t+quantity(state,item.id,o.id,round)*n(o.cost)*r.maintenance/12,0),0);}
  function maintenanceEstimate(ctx={}){
    const state={...ctx.state},round=ctx.round||1;
    for(const item of (ctx.catalog||[]).flatMap(c=>c.items||[])){
      const d=ctx.drafts?.[item.id];if(!d)continue;
      if(item.asset)state[item.id]={...state[item.id],purchases:{...assetPurchaseHistory(state[item.id],item),[round]:d.quantities||{}}};
      if(item.id==='MOLDE'){
        const entry=state.MOLDE||{},old={...entry.purchases};
        if(!Object.keys(old).length&&Number(entry.round)<round)old[entry.round]=Object.fromEntries((entry.optionIds||[]).map(id=>[id,1]));
        const owned=new Set(Object.entries(old).filter(([r])=>Number(r)<round).flatMap(([,row])=>Object.entries(row).filter(([,q])=>n(q)>0).map(([id])=>id)));
        delete old[round];const bought=(d.optionIds||[]).filter(id=>!owned.has(id));
        if(bought.length)old[round]=Object.fromEntries(bought.map(id=>[id,1]));
        state.MOLDE={...entry,purchases:old};
      }
      if(item.id==='REGIMEN_LABORAL')state[item.id]=d;
    }
    return maintenance(state,ctx.catalog,round);
  }
  return Object.freeze({VERSION,regimes,regime,laborCost,materialUnitPrice,assetCost,advertising,assetPurchaseHistory,quantity,maintenance,maintenanceEstimate});
});
