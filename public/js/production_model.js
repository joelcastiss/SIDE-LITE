/* SIDE: autonomous production rules and physical inventory. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./business_rules.js'):root.SIDE_BUSINESS_RULES,node?require('./material_orders.js'):root.SIDE_MATERIAL_ORDERS,node?require('./temporal_production.js'):root.SIDE_TEMPORAL_PRODUCTION);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_PRODUCTION_MODEL=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(BUS,ORDERS,TEMP){
  'use strict';

  const WORKING_DAYS=30;
  const BASE_EFFICIENCY=0.90;
  const LEVEL_THREE_BONUS=0.01;
  const LEADERSHIP_BONUS=0.04;
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const whole=value=>Math.max(0,Math.floor(n(value)));
  const sum=values=>values.reduce((total,value)=>total+n(value),0);

  const STAFF_RATES={
    PERS_CORTE:{corte_basico:6,corte_exp:8,corte_maestro:12},
    PERS_ENSAMBLE:{ens_personal_basico:6,ens_personal_ind:8,ens_personal_esp:12},
    PERS_ACABADO:{aca_personal_basico:6,aca_personal_tec:8,aca_personal_art:12}
  };
  const MACHINE_MULTIPLIERS={
    MESA_CORTE:{mesa:1},
    ENSAMBLE:{ens_basica:1,ens_semi:1.2,ens_ind:1.5},
    ACABADOS:{aca_basica:1,aca_semi:1.2,aca_ind:1.5}
  };
  const LEVEL_THREE_IDS=new Set(['corte_maestro','ens_personal_esp','aca_personal_art']);
  const MATERIALS={
    CUERO:{label:'Cuero',unit:'m²',yields:{cuero_sint:1,cuero_std:1,cuero_prem:1}},
    ACCESORIOS:{label:'Accesorios',unit:'unidades',yields:{acc_eco:1,acc_prem:1}},
    HILO:{label:'Hilo',unit:'metros',yields:{hilo_std:1,hilo_ref:1,hilo_prem:1}}
  };
  const MOLD_REQUIREMENTS={
    molde_1:{label:'Molde básico',CUERO:0.3,ACCESORIOS:1,HILO:6},
    molde_2:{label:'Molde mejorado',CUERO:0.4,ACCESORIOS:1,HILO:7},
    molde_3:{label:'Molde premium',CUERO:0.7,ACCESORIOS:1,HILO:13}
  };
  const DOP_STEPS=[
    {id:'cut',type:'operation',number:1,label:'Corte de piezas'},
    {id:'accessories_classification',type:'inspection',number:1,label:'Clasificación de accesorios'},
    {id:'accessories_preparation',type:'operation',number:2,label:'Preparación de accesorios'},
    {id:'assembly_accessories',type:'combined',number:1,label:'Ensamblado y colocación de accesorios'},
    {id:'finish',type:'combined',number:2,label:'Acabado final'}
  ];

  function items(ctx){return (ctx.catalog||[]).flatMap(category=>category.items||[]);}
  function item(ctx,id){return items(ctx).find(entry=>entry.id===id);}
  function assetPurchaseHistory(entry,definition){
    return BUS.assetPurchaseHistory(entry,definition);
  }
  function draft(ctx,id){
    if(ctx.drafts?.[id])return ctx.drafts[id];
    const entry=ctx.state?.[id],definition=item(ctx,id),same=n(entry?.round)===n(ctx.round);
    if(definition?.asset)return {quantities:{...(assetPurchaseHistory(entry,definition)[ctx.round]||{})}};
    if(definition?.type==='quantity'||definition?.type==='quantity-choice')return {quantities:same?{...(entry?.quantities||{})}:{},...(same&&entry?.assignments?{assignments:entry.assignments}:{})};
    if(definition?.type==='number')return {value:same?n(entry?.value):0};
    if(definition?.type==='production-plan'){
      return {moldTargets:resolveProductionTargets(ctx)};
    }
    return {optionIds:[...(entry?.optionIds||definition?.defaultOptionIds||[])],quantities:{...(entry?.quantities||{})}};
  }
  function owned(ctx,id,optionId){
    return sum(Object.entries(assetPurchaseHistory(ctx.state?.[id],item(ctx,id))).filter(([round])=>n(round)<n(ctx.round)).map(([,row])=>row?.[optionId]));
  }
  function assetCounts(ctx,id){
    const definition=item(ctx,id),current=draft(ctx,id).quantities||{},out={};
    for(const option of definition?.options||[])out[option.id]=whole(owned(ctx,id,option.id)+n(current[option.id]));
    return out;
  }
  function quantityCounts(ctx,id){
    const definition=item(ctx,id),current=draft(ctx,id).quantities||{},out={};
    for(const option of definition?.options||[])out[option.id]=definition?.material?Math.max(0,n(current[option.id])):whole(current[option.id]);
    return out;
  }
  function selected(ctx,id){return draft(ctx,id).optionIds||[];}
  function ownedMoldIds(ctx){
    const entry=ctx.state?.MOLDE,ids=[];
    for(const [round,row] of Object.entries(entry?.purchases||{}))if(n(round)<n(ctx.round))for(const [id,q] of Object.entries(row||{}))if(whole(q)>0&&!ids.includes(id))ids.push(id);
    if(!ids.length&&entry&&n(entry.round)<n(ctx.round))for(const id of entry.optionIds||[])if(MOLD_REQUIREMENTS[id]&&!ids.includes(id))ids.push(id);
    return ids;
  }
  function resolveProductionTargets(ctx={}){
    const entry=ctx.state?.PRODUCCION_META;
    const d=ctx.drafts?.PRODUCCION_META??(n(entry?.round)===n(ctx.round)?entry:{}),targets={};
    for(const id of Object.keys(MOLD_REQUIREMENTS))targets[id]=whole(d?.moldTargets?.[id]);
    // A per-mold plan, including an explicit all-zero plan, is authoritative.
    // Older numeric plans did not store a moldId: recover their selected mold
    // instead of assigning every such plan to the basic mold.
    if(!d?.moldTargets&&whole(d?.value)){
      const explicit=[d.moldId,...(d.optionIds||[])].find(id=>MOLD_REQUIREMENTS[id]);
      const legacyId=explicit||selected(ctx,'MOLDE').find(id=>MOLD_REQUIREMENTS[id])||ownedMoldIds(ctx).at(-1)||'molde_1';
      targets[legacyId]=whole(d.value);
    }
    return targets;
  }
  function pairedDailyCapacity(staffCounts,staffRates,machineCounts,machineMultipliers,explicit){
    const assignments={},available=Object.fromEntries(Object.keys(machineMultipliers).map(id=>[id,whole(machineCounts[id])]));
    const remaining=Object.fromEntries(Object.keys(staffRates).map(id=>[id,whole(staffCounts[id])]));
    let capacity=0,pairs=0;
    for(const id of Object.keys(staffRates))assignments[id]=Object.fromEntries(Object.keys(machineMultipliers).map(machine=>[machine,0]));
    function assign(id,machine,wanted){
      const q=Math.min(remaining[id],available[machine],whole(wanted));
      assignments[id][machine]+=q;remaining[id]-=q;available[machine]-=q;
      capacity+=q*staffRates[id]*machineMultipliers[machine];pairs+=q;
    }
    // Honor saved assignments first, subject to both staff and machine availability.
    if(explicit)for(const id of Object.keys(staffRates))for(const machine of Object.keys(machineMultipliers))assign(id,machine,explicit[id]?.[machine]);
    // Assign remaining staff deterministically to the most productive resources.
    const staff=Object.keys(staffRates).sort((a,b)=>staffRates[b]-staffRates[a]);
    const machines=Object.keys(machineMultipliers).sort((a,b)=>machineMultipliers[b]-machineMultipliers[a]);
    for(const id of staff)for(const machine of machines)assign(id,machine,remaining[id]);
    return {capacity,pairs,assignments,staff:sum(Object.values(staffCounts)),machines:sum(Object.values(machineCounts))};
  }
  function payroll(ctx,id){
    const definition=item(ctx,id),counts=quantityCounts(ctx,id);
    return sum((definition?.options||[]).map(option=>Math.max(0,n(counts[option.id]))*BUS.laborCost(option.id,BUS.regime(ctx),option.cost)));
  }
  function materialCost(ctx,id){
    const definition=item(ctx,id),counts=quantityCounts(ctx,id);
    const hasAnalyst=selected(ctx,'ANALISTA_COMPRAS').includes('si_analista');
    const discount=hasAnalyst?Math.max(2,12-(n(ctx.round)-1)*2):0;
    const config=typeof module==='object'&&module.exports?require('./engine/config.js'):globalThis.SIDE_ECONOMIC_CONFIG;
    return sum((definition?.options||[]).map(option=>Math.max(0,n(counts[option.id]))*BUS.materialUnitPrice(option,counts[option.id],discount,{...config,materials:{...config?.materials,...ctx.config?.materials}})));
  }
  function calculate(ctx={}){
    const materialVersion=ctx.config?.materialRulesVersion||ctx.state?.__materialRulesVersion;
    if(materialVersion&&materialVersion!=='legacy-instant'&&!ctx.state?.__materialOrders)throw new Error('La versión temporal requiere un libro de órdenes verificable.');
    const targets=resolveProductionTargets(ctx),target=sum(Object.values(targets)),days=whole(ctx.workingDays||WORKING_DAYS)||WORKING_DAYS;
    const staff={
      cut:quantityCounts(ctx,'PERS_CORTE'),
      assembly:quantityCounts(ctx,'PERS_ENSAMBLE'),
      finish:quantityCounts(ctx,'PERS_ACABADO')
    };
    const machines={
      cut:assetCounts(ctx,'MESA_CORTE'),
      assembly:assetCounts(ctx,'ENSAMBLE'),
      finish:assetCounts(ctx,'ACABADOS')
    };
    const levelThree=sum(Object.values(staff).flatMap(counts=>Object.entries(counts).filter(([id])=>LEVEL_THREE_IDS.has(id)).map(([,value])=>value)));
    const hasLeadership=selected(ctx,'JEFATURA').includes('si_jefatura');
    const efficiency=Math.round((BASE_EFFICIENCY+levelThree*LEVEL_THREE_BONUS+(hasLeadership?LEADERSHIP_BONUS:0))*100)/100;
    const specs=[
      ['cut','Corte','PERS_CORTE','MESA_CORTE'],
      ['assembly','Ensamblado','PERS_ENSAMBLE','ENSAMBLE'],
      ['finish','Acabado','PERS_ACABADO','ACABADOS']
    ];
    const processes=specs.map(([id,label,staffId,machineId])=>{
      const pairing=pairedDailyCapacity(staff[id],STAFF_RATES[staffId],machines[id],MACHINE_MULTIPLIERS[machineId],draft(ctx,staffId).assignments);
      const cycleCapacity=Math.max(0,Math.round(pairing.capacity*days*efficiency));
      return {id,label,dailyCapacity:pairing.capacity,cycleCapacity,pairs:pairing.pairs,assignments:pairing.assignments,staff:pairing.staff,machines:pairing.machines,payroll:payroll(ctx,staffId)};
    });
    // Saved purchases are authoritative even when a synchronized record omits
    // optionIds. A live draft replaces the current cycle's saved selection.
    const currentPurchases=ctx.drafts?.MOLDE?[]:Object.entries(ctx.state?.MOLDE?.purchases?.[ctx.round]||{}).filter(([id,q])=>MOLD_REQUIREMENTS[id]&&whole(q)>0).map(([id])=>id);
    const selectedMoldIds=[...new Set([...selected(ctx,'MOLDE').filter(id=>MOLD_REQUIREMENTS[id]),...currentPurchases])];
    const ownedIds=ownedMoldIds(ctx),availableMoldIds=[...new Set([...ownedIds,...selectedMoldIds])];
    const moldId=selectedMoldIds[0]||ownedIds.at(-1)||'molde_1',requirements=MOLD_REQUIREMENTS[moldId]||MOLD_REQUIREMENTS.molde_1;
    const processCapacity=processes.length?Math.min(...processes.map(process=>process.cycleCapacity)):0;
    const suggestedTotal=processCapacity;
    const equalBase=Math.floor(suggestedTotal/Object.keys(MOLD_REQUIREMENTS).length),equalRemainder=suggestedTotal-equalBase*Object.keys(MOLD_REQUIREMENTS).length;
    const productLines=Object.entries(MOLD_REQUIREMENTS).map(([id,spec],index)=>{
      const lineTarget=targets[id],suggested=target?Math.round(suggestedTotal*(lineTarget/target)):equalBase+(index<equalRemainder?1:0);
      return {id,label:spec.label,target:lineTarget,suggested,owned:ownedIds.includes(id),selectedThisCycle:selectedMoldIds.includes(id),available:availableMoldIds.includes(id),requirements:{CUERO:lineTarget*spec.CUERO,ACCESORIOS:lineTarget*spec.ACCESORIOS,HILO:lineTarget*spec.HILO}};
    });
    const eligibleTarget=sum(productLines.filter(line=>line.available).map(line=>line.target));
    const materials=Object.entries(MATERIALS).map(([id,spec])=>{
      const counts=quantityCounts(ctx,id),purchasesAvailable=sum(Object.entries(spec.yields).map(([optionId,yieldValue])=>n(counts[optionId])*yieldValue)),inventoryAvailable=sum(Object.keys(spec.yields).map(optionId=>Math.max(0,n(ctx.state?.__inventarioMP?.[optionId])))),available=purchasesAvailable+inventoryAvailable;
      const neededForTarget=sum(productLines.map(line=>line.requirements[id])),perUnit=eligibleTarget?sum(productLines.filter(line=>line.available).map(line=>line.requirements[id]))/eligibleTarget:n(requirements[id]),supportedUnits=perUnit>0?Math.floor(available/perUnit):0;
      const definition=item(ctx,id),selections=(definition?.options||[]).map(option=>({id:option.id,label:option.label,quantity:Math.max(0,n(counts[option.id])),contribution:Math.max(0,n(counts[option.id]))*n(spec.yields[option.id])})).filter(selection=>selection.quantity>0);
      return {id,label:spec.label,unit:spec.unit,available,purchasesAvailable,inventoryAvailable,perUnit,neededForTarget,supportedUnits,selections,cost:materialCost(ctx,id)};
    });
    // Explicit, provisional receipt-ledger mode. Historical snapshots without a
    // ledger retain their original calculation until a versioned migration exists.
    let temporal=null;
    if(ctx.state?.__materialOrders){
      if(!ORDERS||!TEMP)throw new Error('El motor temporal de materiales no está disponible');
      const events=Object.values(ctx.state.__materialOrders.events||{}),ordered=[...events.filter(e=>e.type==='order'),...events.filter(e=>e.type!=='order')];
      let ledger={};for(const event of ordered)ledger=ORDERS.apply(ledger,event);
      const owner=ctx.state.__materialOrders.companyId;
      if(!owner||Object.values(ledger.orders||{}).some(order=>order.companyId!==owner))throw new RangeError('Órdenes de otra empresa o sin identidad');
      const families={CUERO:'leather',ACCESORIOS:'accessories',HILO:'thread'},startDay=(whole(ctx.round||1)-1)*WORKING_DAYS;
      const receipts=[];
      for(const order of Object.values(ledger.orders||{})){
        const family=Object.keys(MATERIALS).find(id=>Object.hasOwn(MATERIALS[id].yields,order.sku));
        if(!family)throw new RangeError('Insumo desconocido en pedido');
        for(const receipt of order.receipts){if(receipt.day>=startDay)receipts.push({id:receipt.id,day:receipt.day,material:families[family],sku:order.sku,quantity:receipt.quantity});}
      }
      const skuFamilies=Object.fromEntries(Object.entries(MATERIALS).flatMap(([family,spec])=>Object.keys(spec.yields).map(sku=>[sku,families[family]])));
      const opening=Object.fromEntries(Object.keys(skuFamilies).map(sku=>[sku,Math.max(0,n(ctx.state?.__inventarioMP?.[sku]))]));
      temporal=TEMP.calculateBySku({opening,receipts,skuFamilies,startDay,days,dailyCapacity:Math.min(...processes.map(p=>p.dailyCapacity)),efficiency,
        targets:{basic:targets.molde_1,medium:targets.molde_2,premium:targets.molde_3},
        molds:{basic:productLines[0].available,medium:productLines[1].available,premium:productLines[2].available}});
      for(const m of materials){
        const family=families[m.id],received=receipts.filter(r=>r.material===family&&r.day<startDay+days).reduce((sum,r)=>sum+r.quantity,0);
        m.purchasesAvailable=received;m.available=m.inventoryAvailable+received;m.supportedUnits=m.perUnit>0?Math.floor(m.available/m.perUnit):0;
        m.pending=Object.values(ledger.orders||{}).filter(o=>Object.hasOwn(MATERIALS[m.id].yields,o.sku)).reduce((sum,o)=>sum+o.quantity-o.cancelled-o.receipts.filter(r=>r.day<startDay+days).reduce((a,r)=>a+r.quantity,0),0);
      }
    }
    const remaining=Object.fromEntries(materials.map(m=>[m.id,m.available]));let capacityRemaining=processCapacity;
    for(const line of productLines){const spec=MOLD_REQUIREMENTS[line.id];line.plannedUnits=line.available?Math.max(0,Math.floor(Number(Math.min(line.target,capacityRemaining,...materials.map(m=>remaining[m.id]/spec[m.id])).toPrecision(15)))):0;capacityRemaining-=line.plannedUnits;for(const material of materials)remaining[material.id]=Number((remaining[material.id]-line.plannedUnits*spec[material.id]).toPrecision(15));line.productionPercent=line.target?Math.round(line.plannedUnits/line.target*100):0;}
    if(temporal){for(const [i,key] of ['basic','medium','premium'].entries()){const line=productLines[i];line.plannedUnits=temporal.produced[key];line.productionPercent=line.target?Math.round(line.plannedUnits/line.target*100):0;}}
    const producibleUnits=sum(productLines.map(l=>l.plannedUnits));
    const materialRemaining=Object.fromEntries(materials.map(m=>[m.id,m.available]));let materialCapacity=0;
    for(const line of productLines){const spec=MOLD_REQUIREMENTS[line.id],units=line.available?Math.max(0,Math.floor(Number(Math.min(line.target,...materials.map(m=>materialRemaining[m.id]/spec[m.id])).toPrecision(15)))):0;materialCapacity+=units;for(const m of materials)materialRemaining[m.id]=Number((materialRemaining[m.id]-units*spec[m.id]).toPrecision(15));}
    processes.forEach(process=>{process.plannedUnits=producibleUnits;process.shortfall=Math.max(0,target-process.cycleCapacity);});
    materials.forEach(material=>{material.consumption=Number(sum(productLines.map(l=>l.plannedUnits*MOLD_REQUIREMENTS[l.id][material.id])).toPrecision(15));material.remaining=Math.max(0,Number((material.available-material.consumption).toPrecision(15)));material.shortfall=Math.max(0,material.neededForTarget-material.available);});
    const limitingProcesses=processes.filter(process=>process.cycleCapacity===processCapacity).map(process=>process.label);
    const limitingMaterials=materials.filter(material=>material.supportedUnits===materialCapacity).map(material=>material.label);
    const unavailablePlannedMolds=productLines.filter(line=>line.target>0&&!line.available).map(line=>line.id);
    return {
      ...(temporal?{temporal}:{}),target,targets,productLines,days,efficiency,levelThree,hasLeadership,moldId,moldLabel:requirements.label,selectedMoldIds,ownedMoldIds:ownedIds,availableMoldIds,unavailablePlannedMolds,
      processes,materials,processCapacity,materialCapacity,producibleUnits,
      productionGap:Math.max(0,target-producibleUnits),limitingProcesses,limitingMaterials,
      dop:DOP_STEPS.map((step,index)=>({...step,sequence:index+1,units:producibleUnits})),
      costs:{labor:sum(processes.map(process=>process.payroll)),materials:sum(materials.map(material=>material.cost))}
    };
  }

  function yieldFor(materialId,optionId){return n(MATERIALS[materialId]?.yields?.[optionId]);}
  // Independent reference scenario: one basic machine per level-one worker.
  // Use the same capacity and rounding rules as calculate(), with no state writes.
  function planResources(target){
    target=whole(target);
    const specs=[['cut','Corte','PERS_CORTE','corte_basico','MESA_CORTE','mesa'],['assembly','Ensamblado','PERS_ENSAMBLE','ens_personal_basico','ENSAMBLE','ens_basica'],['finish','Acabado','PERS_ACABADO','aca_personal_basico','ACABADOS','aca_basica']];
    const processes=specs.map(([id,label,staffId,staffOption,machineId,machineOption])=>{
      const rate=STAFF_RATES[staffId][staffOption]*MACHINE_MULTIPLIERS[machineId][machineOption];
      let workers=target?Math.max(1,Math.ceil((target-0.5)/(rate*WORKING_DAYS*BASE_EFFICIENCY))):0;
      while(Math.round(workers*rate*WORKING_DAYS*BASE_EFFICIENCY)<target)workers++;
      while(workers>0&&Math.round((workers-1)*rate*WORKING_DAYS*BASE_EFFICIENCY)>=target)workers--;
      return {id,label,workers,machines:workers,cycleCapacity:Math.round(workers*rate*WORKING_DAYS*BASE_EFFICIENCY)};
    });
    const capacity=Math.min(...processes.map(p=>p.cycleCapacity));
    return {target,days:WORKING_DAYS,efficiency:BASE_EFFICIENCY,capacity,processes,limitingProcesses:processes.filter(p=>p.cycleCapacity===capacity).map(p=>p.label)};
  }
  function materialUnit(materialId){return MATERIALS[materialId]?.unit||'unidades';}
  function cycleProductivity(plan={},record=null,round=1){
    const target=Number(plan?.target),value=record?.producedUnits;
    const produced=record&&Number(record.round)===Number(round)&&value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
    return {produced,compliance:produced!==null&&Number.isFinite(target)&&target>0?produced/target*100:null,
      difference:produced!==null&&Number.isFinite(target)&&target>0?target-produced:null};
  }
  return Object.freeze({calculate,planResources,assetPurchaseHistory,resolveProductionTargets,yieldFor,materialUnit,cycleProductivity,constants:Object.freeze({WORKING_DAYS,BASE_EFFICIENCY,LEVEL_THREE_BONUS,LEADERSHIP_BONUS,MOLD_REQUIREMENTS,DOP_STEPS})});
});
