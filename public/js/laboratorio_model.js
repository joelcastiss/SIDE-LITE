(function(g,f){if(typeof module==='object'&&module.exports)module.exports=f();else g.SIDE_LAB_MODEL=f();})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
const num=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?null:Number(x);
function read(row){
  if(!row?.receipt)return null;
  const r=row.receipt,p=r.production||{},e=row.financial?.estadoResultados||{},b=row.financial?.balanceCaja||{};
  const revenue=num(e.ingresos),profit=num(e.utilidadNeta),before=num(e.utilidadAntesImpuestos),tax=num(e.impuestoRenta),receiptRevenue=num(r.revenue);
  const salesCost=num(e.costoVentas),operating=num(e.gastosOperacion),finExpense=num(e.gastosFinancieros),finIncome=num(e.ingresosFinancieros);
  const warnings=Array.isArray(e.policyWarnings)&&e.policyWarnings.length>0;
  const inconsistent=warnings||(revenue!==null&&receiptRevenue!==null&&Math.abs(revenue-receiptRevenue)>0.02)||(profit!==null&&before!==null&&tax!==null&&Math.abs(profit-(before-tax))>0.02);
  const parts=[revenue,salesCost,operating,finExpense,finIncome,tax,profit];
  const breakdownOk=!inconsistent&&parts.every(v=>v!==null)&&Math.abs(revenue+finIncome-salesCost-operating-finExpense-tax-profit)<=0.03;
  const planned=num(p.target),produced=num(r.produced);
  return {planned,produced,sold:num(r.sold),revenue,costs:num(e.costos),profit,cash:num(b.cajaFinal),inconsistent,
    margin:!inconsistent&&revenue!==null&&revenue!==0&&profit!==null?profit/revenue*100:null,
    fulfillment:planned>0&&produced!==null?produced/planned*100:null,
    breakdown:breakdownOk?{revenue,salesCost,operating,finExpense,finIncome,tax,profit}:null};
}
function diagnose(x){if(!x)return 'No hay datos de cierre para esta empresa.';if(x.planned!==null&&x.produced!==null){if(x.planned>0){const pct=(100*x.produced/x.planned).toLocaleString('es-PE',{maximumFractionDigits:1});const gap=x.planned-x.produced;return `Cumplió el ${pct} % de su meta. ${gap>0?`Produjo ${gap} unidades menos de lo planificado.`:gap<0?`Produjo ${-gap} unidades más de lo planificado.`:'Alcanzó su meta de producción.'}`;}return `La meta fue ${x.planned} y la producción fue ${x.produced} unidades.`;}return 'Faltan datos para comparar la producción con la meta.';}
function delta(now,before,key){if(!now||!before||((key==='revenue'||key==='profit'||key==='margin')&&(now.inconsistent||before.inconsistent))||now[key]==null||before[key]==null)return null;return now[key]-before[key];}
return {read,diagnose,delta};});
