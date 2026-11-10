/* Pure podium calculations shared by the teacher page and its tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.SIDE_TEACHER_PODIUM=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const clamp=value=>Math.max(0,Math.min(1,value));
  function suggestedScore(report){
    const er=report.estadoResultados||{},bg=report.balanceGeneral||report.balanceCaja?.balanceGeneral||{};
    const sales=num(er.ventasNetas??er.ingresos??report.ingresos),profit=num(er.utilidad??report.utilidad);
    const assets=num(bg.activos),cash=num(bg.efectivo??report.caja),debt=num(bg.deuda);
    // SIDE suggestion, 0–100: profit margin 35 points (20% = full),
    // return on assets 25 (15% = full), cash/assets 25 (30% = full),
    // and low debt/assets 15 (zero debt = full, 100% debt = zero).
    // Missing denominators contribute zero; teacher grades never enter this formula.
    const margin=sales>0?clamp(profit/sales/0.20):0;
    const roa=assets>0?clamp(profit/assets/0.15):0;
    const liquidity=assets>0?clamp(cash/assets/0.30):0;
    const leverage=assets>0?clamp(1-debt/assets):0;
    return Math.round((35*margin+25*roa+25*liquidity+15*leverage)*100)/100;
  }
  function eligibleReports(reports,{finished=false}={}){return reports.filter(r=>!r.expulsadaAt&&(finished||r.estado!=='eliminada'));}
  function suggestedPodium(reports,options){return eligibleReports(reports,options).map(r=>({...r,sideScore:suggestedScore(r)})).sort((a,b)=>b.sideScore-a.sideScore||String(a.empresa).localeCompare(String(b.empresa),'es')).slice(0,3);}
  function finalPodium(reports,gradeFor,options){return eligibleReports(reports,options).map(r=>({...r,grade:gradeFor(r)})).filter(r=>r.grade!=null&&Number.isFinite(Number(r.grade))&&Number(r.grade)>=0&&Number(r.grade)<=20).sort((a,b)=>Number(b.grade)-Number(a.grade)||String(a.empresa).localeCompare(String(b.empresa),'es')).slice(0,3);}
  return {suggestedScore,suggestedPodium,finalPodium,eligibleReports};
});
