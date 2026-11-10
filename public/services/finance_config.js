(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_FINANCE_CONFIG=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const defaults={interest:20,capitalMode:'fixed',capital:100000,capitalMin:80000,capitalMax:120000};
  const fields=Object.keys(defaults);
  function values(config={}){return Object.fromEntries(fields.map(key=>[key,config[key]??defaults[key]]));}
  function resolve(config={},round=1){const rows=(config.financialSchedule||[]).filter(row=>Number(row.effectiveRound)<=Number(round)).sort((a,b)=>a.effectiveRound-b.effectiveRound);return {...values(rows.at(-1)||config),...(config.tax?{tax:{...config.tax}}:{}),...(config.taxRegime?{taxRegime:config.taxRegime}:{}),...(config.materials?{materials:{...config.materials}}:{}),...(Number(config.cycles)>0?{cycles:Number(config.cycles),incomeTaxTiming:'final-cycle'}:{})};}
  function schedule(base={},next={},effectiveRound=1){const round=Math.max(1,Number(effectiveRound)||1);const rows=(base.financialSchedule||[{effectiveRound:1,...values(base)}]).filter(row=>Number(row.effectiveRound)<round);rows.push({effectiveRound:round,...values({...base,...next})});return {...base,...next,financialSchedule:rows};}
  function capitalFor(config={},round=1,identity='',originalCapital){
    const original=Number(originalCapital),hasOriginal=originalCapital!==undefined&&originalCapital!==null&&Number.isFinite(original);
    const baseline=resolve(config,1),current=resolve(config,round);
    if(hasOriginal&&['capitalMode','capital','capitalMin','capitalMax'].every(key=>current[key]===baseline[key]))return original;
    if(current.capitalMode!=='random')return Math.max(0,Number(current.capital)||0);
    let hash=0;for(const char of String(identity))hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
    const width=Number(baseline.capitalMax)-Number(baseline.capitalMin);
    const ratio=hasOriginal&&baseline.capitalMode==='random'&&width>0?Math.min(1,Math.max(0,(original-Number(baseline.capitalMin))/width)):(hash%10001)/10000;
    const min=Math.max(0,Number(current.capitalMin)||0),max=Math.max(min,Number(current.capitalMax)||min);
    return Math.min(max,Math.max(min,Math.round((min+(max-min)*ratio)/500)*500));
  }
  function adjustment(config,round,identity,originalCapital){if(!config?.financialSchedule?.length)return 0;return capitalFor(config,round,identity,originalCapital)-Number(originalCapital??capitalFor(config,1,identity));}
  return Object.freeze({resolve,schedule,capitalFor,adjustment});
});
