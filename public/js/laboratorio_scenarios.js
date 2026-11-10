/* Escenarios aislados: solo recibos de la versión reproducible, sin red ni escrituras. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./engine/cierre.js'):root.SIDE_ECONOMIC_CLOSURE);if(node)module.exports=api;else root.SIDE_LAB_SCENARIO=api;})(typeof globalThis!=='undefined'?globalThis:this,function(engine){'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const unavailable=reason=>({available:false,reason});
const groups={materials:['CUERO','ACCESORIOS','HILO'],workers:['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO']};
function fingerprint(plan){if(!plan||!Array.isArray(plan.processes)||!Array.isArray(plan.materials)||!Array.isArray(plan.productLines))return null;return JSON.stringify({target:plan.target,producibleUnits:plan.producibleUnits,processCapacity:plan.processCapacity,materialCapacity:plan.materialCapacity,efficiency:plan.efficiency,processes:plan.processes.map(p=>[p.id,p.dailyCapacity,p.cycleCapacity,p.pairs,p.staff,p.machines]),materials:plan.materials.map(m=>[m.id,m.available,m.inventoryAvailable,m.purchasesAvailable,m.consumption]),lines:plan.productLines.map(l=>[l.id,l.target,l.available,l.plannedUnits])});}
function run({row,catalog,kind,group,option,amount,expectedCycle}){
 try{
  const r=row?.receipt,round=Number(r?.round),version=engine?.config?.version;
  if(!r||r.modelVersion!=='md-20261027'||version!==r.modelVersion||r.capacityRulesVersion!=='one-worker-per-resource-20261029')return unavailable('No se puede verificar la versión productiva del cierre.');
  if(!Number.isInteger(round)||round<1||round>6||(expectedCycle!=null&&round!==Number(expectedCycle))||!r.decisions||!r.openingInventory||!r.financialPolicy||!Array.isArray(r.catalogSelection)||!row.state||row.state.__materialOrders||(row.state.__materialRulesVersion&&row.state.__materialRulesVersion!=='legacy-instant')||r.materialReceiptFacts||r.financialPolicy.materialRulesVersion&&r.financialPolicy.materialRulesVersion!=='legacy-instant')return unavailable('Faltan el estado inicial verificable o las reglas de recepción del ciclo.');
  if(!Array.isArray(catalog)||!catalog.length||!groups[kind]?.includes(group))return unavailable('La alternativa o el catálogo no están disponibles.');
  const definition=catalog.flatMap(c=>c.items||[]).find(i=>i.id===group);if(!definition?.options?.some(o=>o.id===option))return unavailable('Selecciona un recurso válido.');
  const q=Number(amount);if(!Number.isFinite(q)||q<=0||q>1000000||(kind==='workers'&&!Number.isInteger(q)))return unavailable('Introduce una cantidad adicional positiva y válida.');
  const state=copy(r.decisions);state.__inventarioMP=copy(r.openingInventory);state.__catalogSelection=copy(r.catalogSelection);
  if(!state.PRODUCCION_META||!state.MOLDE||!state.JEFATURA||!['MESA_CORTE','ENSAMBLE','ACABADOS','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','CUERO','ACCESORIOS','HILO'].every(id=>state[id]&&state[id].quantities&&Number.isInteger(Number(state[id].round))))return unavailable('El cierre no conserva todos los recursos necesarios para reconstruir el ciclo.');
  const input={state,catalog,round,financialPolicy:copy(r.financialPolicy)};
  const original=engine.prepare(input).plan,expected=fingerprint(r.production);
  if(!expected||fingerprint(original)!==expected||original.producibleUnits!==r.produced)return unavailable('El motor actual no reproduce exactamente la producción oficial del ciclo.');
  const alternative=copy(state),entry=alternative[group];
  if(Number(entry.round)!==round)return unavailable('La decisión elegida no pertenece al ciclo seleccionado.');
  const current=Number(entry.quantities[option]??0);if(!Number.isFinite(current)||current<0)return unavailable('La cantidad original no es verificable.');
  entry.quantities[option]=current+q;
  if(Array.isArray(entry.optionIds)&&!entry.optionIds.includes(option))entry.optionIds.push(option);
  const projected=engine.prepare({...input,state:alternative}).plan;
  const difference=projected.producibleUnits-original.producibleUnits;
  return {available:true,original:original.producibleUnits,alternative:projected.producibleUnits,difference,percent:original.producibleUnits>0?difference/original.producibleUnits*100:null,limits:{material:projected.materialCapacity,process:projected.processCapacity},note:'La estimación se limita a producción; ventas, costos y utilidad no se recalculan.'};
 }catch(e){return unavailable('No se pudo reproducir el escenario con los datos sellados.');}
}
return {run};});
