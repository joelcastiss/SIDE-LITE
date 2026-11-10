/* SIDE cycle settlement: production, unsold goods and cash share one receipt. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./production_model.js'):root.SIDE_PRODUCTION_MODEL,node?require('./financial_model.js'):root.SIDE_FINANCIAL_MODEL,node?require('./revenue_model.js'):root.SIDE_REVENUE_MODEL,node?require('./engine/cierre.js'):root.SIDE_ECONOMIC_CLOSURE,node?require('./decision_review_model.js'):root.SIDE_REVIEW_MODEL,node?require('./side_rules.js'):root.SIDE_RULES);if(node)module.exports=api;else root.SIDE_CYCLE_MODEL=api;})(typeof globalThis!=='undefined'?globalThis:this,function(PRO,FIN,REV,ECON,REVIEW,RULES){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v)),n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0,money=v=>Math.round(v*100)/100;
  function restoreState(saved={},live={}){return {...saved,...Object.fromEntries(Object.entries(live).filter(([key])=>key.startsWith('__')))};}
  function economicLedger(ledger={},state={}){
    return Object.fromEntries(Object.entries(ledger).filter(([key])=>{
      const [round,kind]=key.split(':');
      return !['SIM_VENTAS','SIM_GASTOS','SIM_INVERSION','SIM_DEVOLUCIONES','COMISION_VENTAS'].includes(kind)||state.__cycleSettlements?.[round]||state.__financialSnapshots?.[round]||Number(round)<=Number(state.__openingBalance?.round||0);
    }));
  }
  function close({state={},ledger={},catalog=[],round=1,capital=0,sectionsByRound={},production,prices={},allocation,financialPolicy={},events=[],economicResult}={}){
    state=clone(state);ledger=economicLedger(ledger,state);
    const previous=state.__cycleSettlements?.[round];
    if(previous)return {state,ledger,receipt:previous,reused:true,financialSections:clone(sectionsByRound),financial:FIN.calculate({capital,ledger,sectionsByRound,catalog,round,openingBalance:state.__openingBalance,state,financialPolicy})};
    if(state.__materialOrders&&(!financialPolicy.verifiedMaterialContext||!['cash','credit'].includes(financialPolicy.materialPaymentMode)))throw new Error('El cierre de pedidos temporales aún no admite valoración ni persistencia autoritativa.');
    if(state.__materialOrders&&Object.values(state.__inventarioMP||{}).some(q=>n(q)>0)){
      const previousFinancial=state.__financialSnapshots?.[Number(round)-1],quantities=previousFinancial?.inventoryQuantities,values=previousFinancial?.inventoryValues?.materials;
      if(!quantities||!values||Object.entries(state.__inventarioMP||{}).some(([sku,q])=>n(q)>0&&(!Object.hasOwn(values,sku)||!Number.isFinite(Number(values[sku]))||Number(values[sku])<0||Math.abs(n(quantities[sku])-n(q))>1e-7)))throw new Error('Inventario inicial temporal sin valoración verificable.');
    }
    // Only a settled receipt makes a financial snapshot authoritative. An old
    // preview for this open round must not mask the sales we are about to post.
    if(state.__financialSnapshots)delete state.__financialSnapshots[round];
    // A replicated plan may arrive without a browser-generated section ledger.
    // Reconstruct each missing section once from the same decision cost model.
    sectionsByRound=clone(sectionsByRound);
    for(const category of catalog.filter(category=>!category.summaryOnly)){
      const key=`${round}:${category.cat}`;
      if(Object.hasOwn(ledger,key)||!category.items.some(item=>Number(state[item.id]?.round)===Number(round)))continue;
      const section=REVIEW.section(category,{state,drafts:{},catalog,round,capital,ledger,rules:RULES,config:financialPolicy});
      ledger[key]=section.net;sectionsByRound[round]={...sectionsByRound[round],[category.cat]:{...section,recordedNet:section.net}};
    }
    const economic=economicResult||ECON.closeMany([{id:'self',state,catalog,round,prices,events,financialPolicy}]).self;
    const plan=economic.plan;
    const channels=state.CANALES||{},ids=channels.optionIds||[],hasChannel=ids.some(id=>['web','los_olivos','miraflores','sjl'].includes(id));
    const assigned=economic.allocation;
    const demandFactor=events.reduce((factor,event)=>factor*Math.max(0,1+Number(event.effect?.revenuePct||0)/100),1);
    const goods=economic.goods,sales=economic.sales;
    const market=Object.values(assigned.products).reduce((sum,row)=>sum+n(row.asignado),0);
    const revenue=money(sales.reduce((sum,row)=>sum+row.revenue,0));
    // Only the decision model can record economic sales; world receipts are ignored.
    ledger[`${round}:SIM_VENTAS`]=revenue;
    ledger[`${round}:COMISION_VENTAS`]=revenue?-money(revenue*ECON.config.commission):0;
    ledger[`${round}:VENTAS_CREDITO`]=-economic.receivable;
    ledger[`${round}:COBRO_CREDITO`]=economic.collections;
    ledger[`${round}:ALMACENAJE`]=-economic.storage;
    const businessRules=typeof module==='object'&&module.exports?require('./business_rules.js'):globalThis.SIDE_BUSINESS_RULES;
    const maintenance=money(businessRules.maintenance(state,catalog,round));
    const recordedMaintenance=Object.entries(sectionsByRound[round]||{}).filter(([cat,s])=>Object.hasOwn(ledger,`${round}:${cat}`)&&Math.abs(Number(s.recordedNet??s.net)-Number(ledger[`${round}:${cat}`]))<.02).flatMap(([,s])=>s.items||[]).filter(i=>i.id==='MANTENIMIENTO'&&(i.automaticMaintenance===true||i.type==='info')).reduce((s,i)=>s+n(i.outflow),0);
    ledger[`${round}:MANTENIMIENTO_AUTO`]=-money(Math.max(0,maintenance-recordedMaintenance))||0;
    const openingInventory=clone(state.__inventarioMP||{}),inventory={...state.__inventarioMP};
    const temporalFacts=state.__materialOrders?{receivedBySku:{},receivedValueBySku:{},ordersBySku:{},receipts:[],paymentMode:financialPolicy.materialPaymentMode,supplierCreditTermCycles:Number(financialPolicy.supplierCreditTermCycles??1)}:null;
    if(temporalFacts){
      const events=Object.values(state.__materialOrders.events||{}),allOrders=events.filter(e=>e.type==='order'),startDay=(Number(round)-1)*30,orders=allOrders.filter(e=>Number(e.orderedDay)===startDay),items=catalog.flatMap(c=>c.items||[]),seen=new Set();
      const analyst=(state.ANALISTA_COMPRAS?.optionIds||[]).includes('si_analista')?Math.max(2,12-(round-1)*2):0;
      for(const order of orders){
        const item=items.find(i=>i.material&&(i.options||[]).some(o=>o.id===order.sku)),option=item?.options?.find(o=>o.id===order.sku);
        const expected=n(state[item?.id]?.quantities?.[order.sku]),price=businessRules.materialUnitPrice(option,expected,analyst,{...ECON.config,materials:{...ECON.config.materials,...financialPolicy.materials}});
        if(!item||Number(state[item.id]?.round)!==Number(round)||seen.has(order.sku)||n(order.orderedDay)!==startDay||n(order.quantity)!==expected||Math.abs(n(order.unitCost)-price)>1e-7)throw new Error('Orden temporal incompatible con la decisión confirmada.');
        seen.add(order.sku);temporalFacts.ordersBySku[order.sku]={quantity:expected,unitCost:price};
      }
      for(const item of items.filter(i=>i.material))for(const [sku,q] of Object.entries(state[item.id]?.quantities||{}))if(Number(state[item.id]?.round)===Number(round)&&n(q)>0&&!seen.has(sku))throw new Error('Falta una orden verificada para la compra.');
      for(const event of events.filter(e=>e.type==='receipt'&&n(e.day)>=startDay&&n(e.day)<startDay+30)){
        const order=allOrders.find(o=>o.orderId===event.orderId);if(!order)throw new Error('Recepción sin orden verificada.');
        temporalFacts.receivedBySku[order.sku]=n(temporalFacts.receivedBySku[order.sku])+n(event.quantity);
        temporalFacts.receivedValueBySku[order.sku]=money(n(temporalFacts.receivedValueBySku[order.sku])+money(n(event.quantity)*n(order.unitCost)));
        temporalFacts.receipts.push({receiptId:event.id,orderId:order.orderId,sku:order.sku,quantity:n(event.quantity),value:money(n(event.quantity)*n(order.unitCost)),receivedDay:n(event.day),dueCycle:Math.floor(n(event.day)/30)+1+temporalFacts.supplierCreditTermCycles});
      }
    }
    if(temporalFacts?.paymentMode==='credit')ledger[`${round}:PROVEEDOR_CREDITO`]=money(Object.values(temporalFacts.ordersBySku).reduce((sum,o)=>sum+n(o.quantity)*n(o.unitCost),0));
    for(const material of plan.materials||[]){
      const definition=catalog.flatMap(c=>c.items||[]).find(item=>item.id===material.id),entries=definition?.options||[];
      let consumption=n(material.consumption);
      for(const option of entries){if(plan.temporal){inventory[option.id]=n(plan.temporal.stockBySku?.[option.id]);continue;}const available=n(state.__inventarioMP?.[option.id])+n(Number(state[material.id]?.round)===Number(round)?state[material.id]?.quantities?.[option.id]:0),used=Math.min(available,consumption);inventory[option.id]=Number(Math.max(0,available-used).toPrecision(15));consumption=Number(Math.max(0,consumption-used).toPrecision(15));}
    }
    state.__inventarioMP=inventory;state.__finishedGoods=goods;state.__storeInventory=economic.storeInventory;state.__accountsReceivable=economic.receivable;
    const pendingRate=n(state.__economicHistory?.nextLoanRatePP),newLoan=n(state.PRESTAMO?.amount||state.PRESTAMO?.value);
    if(newLoan&&pendingRate)financialPolicy={...financialPolicy,nextLoanPenaltyPP:pendingRate};
    state.__economicHistory={reputation:economic.reputation.valor,reputationScale:40,lowReputationCycles:economic.lowReputationCycles,nextLoanRatePP:Math.max(economic.nextLoanRatePP,newLoan?0:pendingRate),goodsQuality:Object.fromEntries(sales.map(line=>[line.id,line.quality]))};
    const decisions=clone(state);for(const key of Object.keys(decisions))if(key.startsWith('__'))delete decisions[key];
    // Canonicalize legacy acquisition history and numeric cycle identifiers so
    // equivalent saved decisions produce identical, reproducible receipts.
    for(const [key,entry] of Object.entries(decisions)){
      if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;
      if(Number.isSafeInteger(Number(entry.round))&&Number(entry.round)>0)entry.round=Number(entry.round);
      const definition=catalog.flatMap(category=>category.items||[]).find(item=>item.id===key);
      if(definition?.asset)entry.purchases=businessRules.assetPurchaseHistory(entry,definition);
    }
    const receipt={round,catalogSelection:clone(state.__catalogSelection||[]),modelVersion:ECON.config.version,capacityRulesVersion:'one-worker-per-resource-20261029',...(temporalFacts?{materialReceiptFacts:temporalFacts}:{}),reputation:economic.reputation,regimen:businessRules.regime({state}),maintenanceCost:maintenance,scores:economic.scores,consequences:economic.messages,accountsReceivable:economic.receivable,creditCollections:economic.collections,cashRevenue:economic.cashRevenue,storageCost:economic.storage,events:clone(events),demandFactor:economic.demandFactor,openingInventory,financialPolicy:clone(financialPolicy),production:clone(plan),materialLots:clone(economic.materialLots),decisions,produced:n(plan.producibleUnits),sold:sales.reduce((sum,row)=>sum+row.sold,0),revenue,sales,market,marketAllocation:assigned,inventory,goods,storeInventory:economic.storeInventory,distributions:economic.distributions};
    state.__cycleSettlements={...state.__cycleSettlements,[round]:receipt};
    const financial=FIN.calculate({capital,ledger,sectionsByRound,catalog,round,openingBalance:state.__openingBalance,state,financialPolicy});
    if(temporalFacts)ledger[`${round}:PROVEEDOR_PAGO`]=-n(financial.flujoCaja?.pagosProveedores)||0;
    state.__goodsLots=clone(financial.goodsLots||[]);receipt.lotMovements=clone(financial.lotMovements||[]);
    const snapshot=clone(financial);delete snapshot.history;state.__financialSnapshots={...state.__financialSnapshots,[round]:snapshot};
    return {state,ledger,receipt,reused:false,financial,financialSections:sectionsByRound};
  }
  function closeMany(inputs=[]){
    const prepared=inputs.map(input=>({...input,production:input.production||PRO.calculate({state:input.state||{},drafts:{},catalog:input.catalog||[],round:input.round,config:input.financialPolicy})}));
    const active=prepared.filter(input=>!input.state?.__cycleSettlements?.[input.round]);
    const economics=ECON.closeMany(active);
    return Object.fromEntries(prepared.map(input=>[input.id,close({...input,economicResult:economics[input.id]})]));
  }
  // Estimate a confirmed plan without exposing a state/ledger to persist.
  // Final sales still use closeMany and its shared market at the cycle close.
  function project(input={}){
    const round=input.round||1;
    if(input.state?.__cycleSettlements?.[round])return null;
    const state=clone(input.state||{});
    if(state.__financialSnapshots)delete state.__financialSnapshots[round];
    const result=close({...input,state,ledger:clone(input.ledger||{}),sectionsByRound:clone(input.sectionsByRound||{})});
    return {provisional:true,marketScope:'individual',receipt:result.receipt,financial:result.financial};
  }
  function closeReports({reports=[],game,round,catalog=[],financialPolicy={}}={}){
    const active=reports.filter(report=>report.partida===game&&report.estado!=='eliminada'&&report.enviado&&report.gameState);
    const results=closeMany(active.map(report=>{
      const saved=report.gameState.__cyclePlans?.[round];
      const business={events:report.gameState.__cycleBusiness?.[round]?.events||[]};
      return {id:report.id,state:saved?restoreState(saved.state,report.gameState):report.gameState,ledger:report.cashLedger,catalog,round,capital:report.capital,sectionsByRound:report.financialSections,production:saved?.production||report.produccion,financialPolicy,...business};
    }));
    for(const report of active){
      const result=results[report.id],f=result.financial;
      Object.assign(report,{gameState:{...report.gameState,__economicHistory:result.state.__economicHistory,__accountsReceivable:result.state.__accountsReceivable,__financialSnapshots:result.state.__financialSnapshots,__cycleSettlements:result.state.__cycleSettlements,__finishedGoods:result.state.__finishedGoods,__goodsLots:result.state.__goodsLots,__storeInventory:result.state.__storeInventory,__inventarioMP:result.state.__inventarioMP},cashLedger:result.ledger,cycleReceipt:result.receipt,ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,estadoResultados:f.estadoResultados,balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral});
    }return reports;
  }
  function migrate({state={},ledger={},catalog=[],capital=0,round=1}={}){
    const previous=Object.entries(state).find(([key,value])=>key.startsWith('__')&&value?.habilitado&&value?.decisiones&&typeof value.decisiones==='object');
    if(!previous)return {state,ledger,migrated:false};
    const [key,old]=previous;
    state=clone(state);ledger={...ledger};const d=old.decisiones||{},r=Number(old.round)||round;
    const map={MESA_CORTE:['INF-01'],ENSAMBLE:['INF-02','INF-03','INF-04'],ACABADOS:['INF-05','INF-06','INF-07'],MOLDE:['INF-08','INF-09','INF-10'],PERS_CORTE:['RH-01','RH-02','RH-03'],PERS_ENSAMBLE:['RH-04','RH-05','RH-06'],PERS_ACABADO:['RH-07','RH-08','RH-09'],CUERO:['INS-01','INS-02','INS-03'],ACCESORIOS:['INS-04','INS-05'],HILO:['INS-06','INS-07','INS-08']};
    const conversion={'INS-01':1,'INS-02':2,'INS-03':2,'INS-04':1,'INS-05':1,'INS-06':270,'INS-07':250,'INS-08':200};
    const history=old.historial||old.transicion||{},holdings={...history.maquinariaActivos,...d.maquinaria},inventory=history.inventarioMP||old.resultado?.produccion?.inventarioFinal||{},selected=d.seleccion||[];
    state.__inventarioMP={...state.__inventarioMP};
    for(const item of catalog.flatMap(c=>c.items||[])){
      const codes=map[item.id];if(!codes)continue;const quantities={},optionIds=[];
      for(const [index,option] of (item.options||[]).entries()){
        const code=codes[index];let qty=0;
        if(item.material){qty=n(d.compras?.[code])+n(d.comprasUnidades?.[code])*conversion[code];state.__inventarioMP[option.id]=n(inventory[code]);}
        else if(item.asset)qty=n(holdings[item.id==='MESA_CORTE'?'mesa':code]);
        else if(item.id==='MOLDE')qty=n(holdings[code])||Number(selected.includes(code));
        else {const area={PERS_CORTE:'corte',PERS_ENSAMBLE:'ensamble',PERS_ACABADO:'acabado'}[item.id];qty=(d.personal?.[area]?.[index]||[]);qty=Array.isArray(qty)?qty.reduce((s,v)=>s+n(v),0):n(qty);}
        if(qty){quantities[option.id]=qty;optionIds.push(option.id);}
      }
      if(optionIds.length)state[item.id]={round:r,optionIds,quantities,...(item.asset?{purchases:{[Math.max(1,r-1)]:quantities}}:{})};
    }
    const targets={molde_1:0,molde_2:0,molde_3:0};for(const lot of d.lotes||[]){const id={'INF-08':'molde_1','INF-09':'molde_2','INF-10':'molde_3'}[lot.molde];if(id)targets[id]+=n(lot.cantidad);}
    if(Object.values(targets).some(Boolean))state.PRODUCCION_META={round:r,moldTargets:targets,value:Object.values(targets).reduce((s,v)=>s+v,0)};
    const channelIds=selected.includes('COM-01B')?['web']:[],channelQuantities={};for(const [id,qty] of Object.entries(d.tiendasPorDistrito||{}))if(n(qty)){channelIds.push(id);channelQuantities[id]=n(qty);}if(channelIds.length)state.CANALES={round:r,optionIds:channelIds,quantities:channelQuantities};
    const latest=old.resultado?.financial,closedHistory=clone(history.financialHistory||[]);if(latest&&!closedHistory.some(h=>Number(h.round)===Number(old.resultado.ciclo||r)))closedHistory.push({...clone(latest),round:Number(old.resultado.ciclo||r)});
    const last=closedHistory.sort((a,b)=>Number(a.round)-Number(b.round)).at(-1);
    const actual=latest?.balanceCaja?.cajaFinal??history.cajaFinal??old.cajaTransicion;
    const seedRound=latest?Number(old.resultado.ciclo||r):Math.max(0,r-1);
    if(Number.isFinite(Number(actual))){const bg=last?.balanceGeneral||{efectivo:Number(actual),activosFijos:n(history.activosCosto)-n(history.depreciacionAcumulada),deuda:n(history.deudaPrincipal),capital:Number(capital)};if(bg.activos==null)bg.activos=Number(actual)+n(bg.activosFijos);if(bg.resultadosAcumulados==null)bg.resultadosAcumulados=bg.activos-n(bg.deuda)-n(bg.capital);if(bg.patrimonio==null)bg.patrimonio=n(bg.capital)+n(bg.resultadosAcumulados);if(bg.pasivoPatrimonio==null)bg.pasivoPatrimonio=n(bg.deuda)+n(bg.patrimonio);state.__openingBalance={round:seedRound,cash:Number(actual),balanceGeneral:bg,history:closedHistory};}
    if(Number.isFinite(Number(actual))){const prior=Object.values(ledger).reduce((s,v)=>s+Number(v||0),0);ledger[`${seedRound}:CAPITAL_ADJUSTMENT`]=Number(ledger[`${seedRound}:CAPITAL_ADJUSTMENT`]||0)+Number(actual)-Number(capital)-prior;}
    state.__previousFinancialHistory=clone(history.financialHistory||[]);
    state.JEFATURA=state.JEFATURA||{round:r,optionIds:[n(d.jefes)||selected.includes('RH-10A')?'si_jefatura':'no_jefatura']};
    const result=old.resultado,closedRound=result?.financial?Number(result.ciclo||r):0;
    if(closedRound){state.__cycleSettlements={...state.__cycleSettlements,[closedRound]:{round:closedRound,produced:n(result.produccion?.totalProducido),revenue:n(result.ingresos),migrated:true}};state.__cycleCosts={...state.__cycleCosts,[closedRound]:{round:closedRound,total:0,acknowledged:true}};}
    delete state[key];state.__migrationVersion=1;return {state,ledger,migrated:true,archive:old,closedRound};
  }
  return {economicLedger,close,closeMany,project,closeReports,migrate,restoreState};
});
