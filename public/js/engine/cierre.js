/* Cierre económico según Costos De Producción (documento 27/10/2026): capacidad -> producción -> reputación -> calidad ->
 * demanda -> reparto -> MIN stock -> ingresos -> costos -> cobranza.
 * Sin DOM, red, reloj, aleatoriedad ni referencias al mundo recreativo. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./config.js'):root.SIDE_ECONOMIC_CONFIG,node?require('./catalogo_excel.js'):root.SIDE_EXCEL_CATALOGO,node?require('../production_model.js'):root.SIDE_PRODUCTION_MODEL,node?require('../business_rules.js'):root.SIDE_BUSINESS_RULES);if(node)module.exports=api;else root.SIDE_ECONOMIC_CLOSURE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(DEFAULT,CATALOG,PRO,BUS){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v)),n=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0,clamp=v=>Math.max(0,Math.min(10,Number(v)||0)),money=v=>Math.round(v*100)/100;
  const index=Object.fromEntries(CATALOG.map(row=>[row.codigo,row]));
  const mapping={MESA_CORTE:{mesa:'INF-01'},ENSAMBLE:{ens_basica:'INF-02',ens_semi:'INF-03',ens_ind:'INF-04'},ACABADOS:{aca_basica:'INF-05',aca_semi:'INF-06',aca_ind:'INF-07'},MOLDE:{molde_1:'INF-08',molde_2:'INF-09',molde_3:'INF-10'},PERS_CORTE:{corte_basico:'RH-01',corte_exp:'RH-02',corte_maestro:'RH-03'},PERS_ENSAMBLE:{ens_personal_basico:'RH-04',ens_personal_ind:'RH-05',ens_personal_esp:'RH-06'},PERS_ACABADO:{aca_personal_basico:'RH-07',aca_personal_tec:'RH-08',aca_personal_art:'RH-09'},JEFATURA:{si_jefatura:'RH-10A',no_jefatura:'RH-10B'},INV_RRHH:{cap_baja:'INV-01A',cap_media:'INV-01B',cap_alta:'INV-01C'},INV_MARKETING:{mkt_baja:'INV-02A',mkt_media:'INV-02B',mkt_alta:'INV-02C'},GARANTIA_PT:{pt_30:'COM-06B',pt_90:'COM-06C'},MANTENIMIENTO:{correctivo:'INF-11B'}};
  const materialCodes={CUERO:{cuero_sint:'INS-01',cuero_std:'INS-02',cuero_prem:'INS-03'},ACCESORIOS:{acc_eco:'INS-04',acc_prem:'INS-05'},HILO:{hilo_std:'INS-06',hilo_ref:'INS-07',hilo_prem:'INS-08'}};
  const chosen=(s,key)=>s[key]?.optionIds?.[0];
  function codes(state){
    const result=[];
    for(const [key,map] of Object.entries(mapping)){
      if(key==='MESA_CORTE')continue; // Not part of Motor_Puntajes selection blocks.
      const entry=state[key]||{},selected=Object.keys(map).filter(id=>n(entry.quantities?.[id])>0||(entry.optionIds||[]).includes(id));
      // SUPUESTO: dotación mixta aporta el mayor nivel presente una vez por grupo.
      if(selected.length)result.push(selected.map(id=>map[id]).sort((a,b)=>n(index[b]?.eficiencia)-n(index[a]?.eficiencia))[0]);
    }
    const channels=state.CANALES?.optionIds||[],web=channels.includes('web'),physical=channels.some(id=>['los_olivos','miraflores','sjl'].includes(id));
    if(web||physical)result.push(web&&physical?'COM-01C':web?'COM-01B':'COM-01A');
    result.push(n(state.PRESTAMO?.value||state.PRESTAMO?.amount)>0?'FIN-01A':'FIN-01B');
    for(const code of state.__catalogSelection||[])if(index[code]&&!result.some(other=>index[other]?.grupo===index[code].grupo))result.push(code);
    return [...new Set(result)];
  }
  const scoreGroups=new Set(['Maquina de ensamblado','Maquina de acabados','Molde','Personal de corte','Personal de ensamble','Personal de acabados','Jefatura','Canal de venta','Acceso a prestamo bancario','Numero de proveedores','Politica de pago a proveedores','Lead time','Inversion en RR.HH.','Inversion en marketing']);
  function scores(state){const selected=codes(state),scored=selected.filter(id=>scoreGroups.has(index[id]?.grupo));return {selected,efficiency:scored.reduce((s,id)=>s+Number(index[id]?.eficiencia||0),0),reputation:scored.reduce((s,id)=>s+Number(index[id]?.reputacion||0),0),health:scored.reduce((s,id)=>s+Number(index[id]?.financiero||0),0)};}
  function prices(state,provided={},config=DEFAULT){return Object.fromEntries(config.products.map(id=>{const segment=config.segments[id],raw=provided[id]??state.PRODUCCION_META?.prices?.[id]??segment.defaultPrice,value=Number(raw);if(raw===''||!Number.isFinite(value)||value<segment.min||value>(segment.max??Infinity))throw new RangeError(`Precio ${id}: introduce un importe válido igual o mayor que ${segment.min}.`);return [id,value];}));}
  function materialUse(state,plan,round){
    const use={},ratios={};
    for(const family of Object.keys(materialCodes)){
      let need=n(plan.materials.find(m=>m.id===family)?.consumption),total=0,premium=0;
      const ids=Object.keys(materialCodes[family]);
      for(const id of ids){const available=plan.temporal?n(plan.temporal.consumedBySku?.[id]):n(state.__inventarioMP?.[id])+n(Number(state[family]?.round)===Number(round)?state[family]?.quantities?.[id]:0),used=Math.min(available,need);use[id]=used;need=Math.max(0,Number((need-used).toPrecision(15)));total+=used;if(id===ids.at(-1))premium=used;}
      ratios[family]=total?premium/total:0;
    }
    return {use,ratios};
  }
  // SIDE asigna el consumo real en orden básico, mejorado y prémium.
  function materialLots(state,plan,round=1){
    const remaining={...materialUse(state,plan,round).use};
    return (plan.productLines||[]).filter(line=>n(line.plannedUnits)>0).map(line=>{
      const materials={},unknown=[],spec=PRO.constants.MOLD_REQUIREMENTS[line.id]||{};
      let excelQuality=Number(index[mapping.MOLDE[line.id]]?.calidad||0);
      for(const [family,options] of Object.entries(materialCodes)){
        let need=Number((n(line.plannedUnits)*n(spec[family])).toPrecision(15));
        const total=need;let score=0;materials[family]={};
        for(const [id,code] of Object.entries(options)){
          const modelKey={molde_1:'basic',molde_2:'medium',molde_3:'premium'}[line.id];
          const taken=plan.temporal?Math.min(n(plan.temporal.consumedByModelSku?.[modelKey]?.[id]),need):Math.min(n(remaining[id]),need);
          if(taken>0){materials[family][id]=taken;score+=taken*Number(index[code]?.calidad||0);remaining[id]=Math.max(0,Number((n(remaining[id])-taken).toPrecision(15)));need=Math.max(0,Number((need-taken).toPrecision(15)));}
        }
        if(need>1e-8)throw new RangeError('Insumos inconsistentes para '+line.id+': '+family);
        if(total>0)excelQuality+=score/total;
      }
      return {mold:line.id,units:n(line.plannedUnits),materials,unknown,excelQuality};
    });
  }
  function reputation(state,plan,round=1){
    const materials=materialUse(state,plan,round),total=plan.producibleUnits;
    const factorProduccion=total?plan.productLines[2].plannedUnits/total*10:0;
    const workers=plan.processes.reduce((sum,p)=>sum+p.staff,0),factorMO=workers?plan.levelThree/workers*10:0;
    const factorMP=Object.values(materials.ratios).reduce((a,v)=>a+v,0)/3*10;
    const advertising=BUS.advertising({state}),factorPublicidad=advertising/10000*10;
    const total40=factorProduccion+factorMO+factorMP+factorPublicidad;
    return {valor:total40,total40,factorProduccion,factorMO,factorMP,factorPublicidad,advertising,consumo:materials.use,proporciones:materials.ratios};
  }
  function quality(state,mold,round=state.PRODUCCION_META?.round||1,consumption=null){
    const plan=consumption&&consumption.productLines?consumption:PRO.calculate({state,catalog:[],round});
    const rep=reputation(state,plan,round);
    // Fórmula de calidad real sugerida por el documento, en escala 0–10.
    return clamp((rep.factorMP+rep.factorProduccion)/2);
  }
  function prepare(input,config=DEFAULT){
    const state=input.state||{},round=input.round||1,p=scores(state),messages=[];
    // Prices are resolved internally. Legacy hidden values must not prevent a
    // saved plan (or another company in the shared close) from generating sales.
    // Explicit caller overrides still pass through the strict price validator.
    const storedPrices=Object.fromEntries(config.products.map(id=>{
      const segment=config.segments[id],raw=state.PRODUCCION_META?.prices?.[id],value=Number(raw);
      const numeric=typeof raw==='number'||(typeof raw==='string'&&raw.trim()!=='');
      return [id,numeric&&Number.isFinite(value)&&value>=segment.min&&value<=(segment.max??Infinity)?value:segment.defaultPrice];
    }));
    // The trusted closure supplies this flag: prices are internal model
    // parameters, never a value chosen in the student snapshot.
    const authorizedPrices=input.financialPolicy?.authoritativePrices
      ? Object.fromEntries(config.products.map(id=>[id,config.segments[id].defaultPrice]))
      : {...storedPrices,...input.prices};
    const calc=(drafts={})=>PRO.calculate({state,drafts,catalog:input.catalog||[],round,config:input.financialPolicy});
    const originalPlan=calc(), rules=config.consequences;
    let plan=originalPlan;
    // CONS-03 se aplica a la meta, antes de los límites físicos. La asignación
    // entre moldes sigue la prioridad histórica de SIDE.
    if(p.efficiency<rules.lowEfficiency){
      let remaining=Math.floor(originalPlan.target*rules.lowProduction);
      const moldTargets=Object.fromEntries(originalPlan.productLines.map(line=>{const q=Math.min(line.target,remaining);remaining-=q;return [line.id,q];}));
      plan=calc({PRODUCCION_META:{moldTargets}});messages.push({id:'CONS-03',text:'La producción se limita al 70 % de la meta por baja eficiencia.'});
    }
    if(!originalPlan.hasLeadership&&p.efficiency<rules.noLeaderEfficiency){
      let remaining=Math.floor(plan.producibleUnits*rules.noLeaderProduction);
      const moldTargets=Object.fromEntries(plan.productLines.map(line=>{const q=Math.min(line.plannedUnits,remaining);remaining-=q;return [line.id,q];}));
      plan=calc({PRODUCCION_META:{moldTargets}});messages.push({id:'CONS-08',text:'Sin jefatura y con baja eficiencia, la producción se reduce un 5 % adicional.'});
    }
    // El cierre conserva la meta original; solo plannedUnits representa lo ejecutado.
    if(plan!==originalPlan){
      plan.target=originalPlan.target;plan.targets=originalPlan.targets;
      plan.productLines.forEach((line,i)=>{line.target=originalPlan.productLines[i].target;line.requirements=originalPlan.productLines[i].requirements;line.productionPercent=line.target?Math.round(line.plannedUnits/line.target*100):0;});
      plan.materials.forEach((material,i)=>{material.neededForTarget=originalPlan.materials[i].neededForTarget;material.shortfall=Math.max(0,material.neededForTarget-material.available);});
      plan.productionGap=Math.max(0,plan.target-plan.producibleUnits);
    }
    const price=prices(state,authorizedPrices,config),rep=reputation(state,plan,round);
    const prior=state.__economicHistory?.reputation;
    const prior40=prior==null?null:(state.__economicHistory?.reputationScale===40?n(prior):n(prior)*4);
    rep.valor=config.reputation?.smoothWithPrevious && prior40 != null ? Math.min(40,(prior40+rep.valor)/2) : Math.min(40,rep.valor);
    rep.valorMercado=rep.valor/4;
    const lots=materialLots(state,plan,round),qualityValue=clamp((rep.factorMP+rep.factorProduccion)/2),goodsQuality=state.__economicHistory?.goodsQuality||{};
    const lines=config.products.map((id,i)=>{
      const line=plan.productLines[i],produced=n(line.plannedUnits),opening=n(state.__finishedGoods?.[id]);
      const saved=(state.__goodsLots||[]).filter(l=>l.segment===id&&n(l.available)>0).map(clone);
      const tracked=saved.reduce((sum,l)=>sum+n(l.available),0);
      if(tracked>opening+1e-8)throw new RangeError('Lotes superiores al inventario '+id);
      // Un saldo antiguo agregado se conserva explícitamente como tal: no se
      // atribuyen materiales, fecha ni calidad que el historial no registró.
      if(opening>tracked)saved.unshift({id:`legacy-${id}`,segment:id,mold:line.id,cycle:null,produced:null,available:opening-tracked,quality:goodsQuality[id]!=null&&Number.isFinite(Number(goodsQuality[id]))?Number(goodsQuality[id]):null,legacy:true});
      const materialLot=lots.find(item=>item.mold===line.id);
      if(produced)saved.push({id:`${round}-${id}`,segment:id,mold:line.id,cycle:round,produced,available:produced,quality:materialLot.excelQuality,materials:materialLot.materials});
      const available=opening+produced,quality=available?saved.reduce((sum,l)=>sum+n(l.available)*n(l.quality),0)/available:0;
      return {id,quality,price:price[id],effectivePrice:price[id],produced,available,lots:saved};
    });
    if(plan.productionGap)messages.push({id:'CAPACIDAD',text:'La producción respeta la capacidad disponible y los materiales, en orden N1, N2 y N3.'});
    const premium=lines.find(line=>line.id==='premium'),activeConsequences=new Set();
    for(const lot of premium?.lots||[]){
      if(lot.quality==null)continue;
      if(lot.quality<4)activeConsequences.add('CONS-01');
      else if(lot.quality>=7)activeConsequences.add('CONS-02');
    }
    let reputationChange=0;
    if(activeConsequences.has('CONS-01')){reputationChange-=rules.reputationChange;messages.push({id:'CONS-01',text:'La calidad prémium reduce precio y reputación.'});}
    if(activeConsequences.has('CONS-02')){reputationChange+=rules.reputationChange;messages.push({id:'CONS-02',text:'La calidad prémium aumenta precio y reputación.'});}
    // Motor_Puntajes y la reputación operativa son indicadores distintos.
    const matrixReputation=p.reputation+reputationChange;
    rep.valorMercado=clamp(rep.valorMercado+reputationChange);
    const lowReputationCycles=matrixReputation<rules.lowReputation?n(state.__economicHistory?.lowReputationCycles)+1:0;
    const channels=state.CANALES?.optionIds||[],hasChannel=channels.some(id=>['web','los_olivos','miraflores','sjl'].includes(id));
    let demandFactor=(input.events||[]).reduce((f,e)=>f*Math.max(0,1+Number(e.effect?.revenuePct||0)/100),1);
    if(lowReputationCycles>=rules.lowReputationCycles){demandFactor*=rules.lowDemand;messages.push({id:'CONS-04',text:'Dos ciclos con reputación baja reducen la demanda.'});}
    const creditBase=input.financialPolicy?.creditPercentStart==null?config.credit.initial:Number(input.financialPolicy.creditPercentStart)/100;
    const creditRate=Math.max(0,Math.min(config.credit.max,Number(state.CREDITO_VENTAS?.value??(creditBase+(round-1)*config.credit.step+(chosen(state,'ANALISTA_COMPRAS')==='si_analista'?config.credit.analystBonus:0)))));
    return {id:input.id,state,round,plan,materialLots:lots,reputation:rep,scores:{...p,reputation:rep.valorMercado},lines,hasChannel,demandFactor,messages,lowReputationCycles,matrixReputation,creditRate,nextLoanRatePP:0};
  }
  // Excel ROUND: each company's share is rounded independently.
  function roundDemand(share,market){return Math.round(Math.max(0,share)*Math.max(0,market));}
  function allocate(prepared,config=DEFAULT){
    const result=Object.fromEntries(prepared.map(p=>[p.id,{reputation:p.reputation||{valor:p.scores.reputation},products:{}}]));
    for(const id of config.products){
      const segment=config.segments[id],participants=prepared.filter(p=>p.lines.find(line=>line.id===id)?.available>0);
      const market=Math.max(0,Math.round(segment.totalMarket!=null?segment.totalMarket*segment.penetration:segment.market));
      const simulated=[];
      if(participants.length && config.simulatedCompetitors?.enabled){
        const count=Math.max(0,Math.floor(Number(config.simulatedCompetitors.target)||0)-participants.length);
        const averagePrice=participants.reduce((sum,p)=>sum+p.lines.find(line=>line.id===id).price,0)/participants.length;
        const averageRep=participants.reduce((sum,p)=>sum+p.scores.reputation,0)/participants.length;
        for(let i=0;i<count;i++)simulated.push({id:`simulado-${id}-${i+1}`,simulated:true,scores:{reputation:averageRep},demandFactor:1,lines:[{id,price:averagePrice,available:market}]});
        participants.push(...simulated);
      }
      const allPrices=participants.map(p=>p.lines.find(line=>line.id===id).price),min=Math.min(...allPrices),max=Math.max(...allPrices);
      const repSum=participants.reduce((sum,p)=>sum+Math.max(0,Number(p.scores.reputation)||0),0);
      const rows=participants.map(p=>{const line=p.lines.find(line=>line.id===id),score=Math.max(0,Math.min(100,id==='esencial'?(max===min?100:100*(max-line.price)/(max-min)):100-100*Math.abs(line.price-segment.ideal)/segment.ideal)),total=segment.weights[0]*score+segment.weights[1]*p.scores.reputation*10+segment.weights[2]*(repSum?Math.round(p.scores.reputation/repSum*100):0);return {p,line,score,total};});
      if(!rows.length)continue;
      const sum=rows.reduce((s,row)=>s+row.total,0);
      for(const row of rows)row.share=sum?row.total/sum:1/rows.length;
      const rounded=apportion(market,Object.fromEntries(rows.map(row=>[String(row.p.id),row.share])));
      for(const row of rows)row.assigned=rounded[String(row.p.id)];
      for(const row of rows)if(!row.p.simulated)result[row.p.id].products[id]={simulatedCompetitors:rows.filter(r=>r.p.simulated).map(r=>({id:r.p.id,precio:r.line.price,reputacion:r.p.scores.reputation,stock:r.line.available,demanda:r.assigned,participacion:r.share,puntaje:r.total})),asignado:row.assigned,demandaAjustada:Math.floor(row.assigned*(row.p.demandFactor??1)),porcentaje:row.share,puntajePrecio:row.score,puntajeTotal:row.total,calidadMercado:repSum?Math.round(row.p.scores.reputation/repSum*100):0,reputacionEscalada:row.p.scores.reputation*10,mercadoReal:market};
    }return result;
  }
  // Reparto entero determinista; cada punto conserva su identidad.
  function apportion(total,weights){
    total=Math.floor(n(total));const entries=Object.entries(weights).filter(([,w])=>n(w)>0),sum=entries.reduce((a,[,w])=>a+n(w),0),out=Object.fromEntries(Object.keys(weights).map(id=>[id,0]));
    if(!sum)return out;const rows=entries.map(([id,w])=>{const raw=total*n(w)/sum,base=Math.floor(raw);out[id]=base;return {id,rem:raw-base};});
    const left=total-Object.values(out).reduce((a,v)=>a+v,0);rows.sort((a,b)=>b.rem-a.rem||a.id.localeCompare(b.id,'en'));for(let i=0;i<left;i++)out[rows[i].id]++;return out;
  }
  function points(state,config=DEFAULT){
    const entry=state.CANALES||{},ids=entry.optionIds||[],out=[];
    if(ids.includes('web'))out.push({id:'web',zone:'web'});
    for(const id of Object.keys(config.storeZones||{})){if(!ids.includes(id))continue;const count=Math.max(1,Math.floor(n(entry.quantities?.[id])||1));for(let i=1;i<=count;i++)out.push({id:`${id}:${i}`,zone:config.storeZones[id]});}
    return out;
  }
  function distributeProduct({id,demand,price,available,openingLocations={},activePoints=[],affinity={},manualTransfers=null}){
    const stocks=Object.fromEntries(Object.entries(openingLocations).map(([key,value])=>[key,Math.floor(n(value))]));
    const stored=Object.values(stocks).reduce((a,v)=>a+v,0);if(stored>Math.floor(n(available)))throw new RangeError('Inventario por punto supera inventario total');
    let central=Math.floor(n(available))-stored;
    const weights=Object.fromEntries(activePoints.map(p=>[p.id,n(affinity[p.zone])]));const demandByPoint=apportion(demand,weights);
    const needs=Object.fromEntries(activePoints.map(p=>[p.id,Math.max(0,(demandByPoint[p.id]||0)-(stocks[p.id]||0))]));
    let transfers;if(manualTransfers){transfers={};for(const p of [...activePoints].sort((a,b)=>a.id.localeCompare(b.id,'en'))){const raw=Number(manualTransfers[p.id]??0);if(!Number.isInteger(raw)||raw<0||raw>central)throw new RangeError('Transferencia manual inválida o superior al stock central');const q=raw;transfers[p.id]=q;central-=q;}}
    else {const totalNeed=Object.values(needs).reduce((a,v)=>a+v,0);transfers=totalNeed<=central?needs:apportion(central,needs);central-=Object.values(transfers).reduce((a,v)=>a+v,0);}
    const rows=activePoints.map(p=>{const opening=stocks[p.id]||0,received=transfers[p.id]||0,stock=opening+received,assigned=demandByPoint[p.id]||0,sold=Math.min(assigned,stock);stocks[p.id]=stock-sold;return {id:p.id,zone:p.zone,product:id,opening,received,available:stock,demand:assigned,sold,lostSales:assigned-sold,revenue:money(sold*price),closing:stocks[p.id]};});
    return {rows,central,locations:stocks,assignment:manualTransfers?'manual':'automatic',unservedWithoutChannel:activePoints.length?0:Math.floor(n(demand))};
  }
  // FIFO por ubicación: transferencias desde almacén y ventas desde el punto.
  function locateLots(lots,distribution,openingLocations,product,basePrice,config,round){
    const copies=lots.map(clone),unlocated=copies.filter(l=>!l.locations&&(l.legacy||Number(l.cycle)!==Number(round))),opening=Object.entries(openingLocations||{}).filter(([,q])=>n(q)>0);
    const missing=opening.map(([id,q])=>[id,n(q)-copies.reduce((a,l)=>a+n(l.locations?.[id]),0)]).filter(([,q])=>q>0);
    if(missing.length){
      // El único saldo agregado histórico se asigna solo a las cantidades ya
      // registradas por tienda. Con varios lotes no hay evidencia suficiente.
      if(unlocated.length!==1||missing.reduce((sum,[,q])=>sum+q,0)>n(unlocated[0].available))throw new RangeError('Inventario histórico por lote y tienda sin atribución verificable: '+product);
      unlocated[0].locations=Object.fromEntries(missing);
    }
    for(const lot of copies){lot.locations={...(lot.locations||{})};const held=Object.values(lot.locations).reduce((a,q)=>a+n(q),0);if(held>n(lot.available))throw new RangeError('Ubicaciones exceden el lote '+lot.id);}
    for(const [id,q] of opening){const sum=copies.reduce((a,l)=>a+n(l.locations[id]),0);if(sum!==n(q))throw new RangeError('Inventario por tienda no coincide con lotes: '+id);}
    for(const lot of copies)for(const [id,q] of Object.entries(lot.locations))if(n(q)>0&&!Object.hasOwn(openingLocations||{},id))throw new RangeError('Tienda de lote no reconocida: '+id);
    const price=lot=>money(basePrice*(product==='premium'&&lot.quality!=null?(lot.quality<4?config.consequences.lowQualityPrice:lot.quality>=7?config.consequences.premiumPrice:1):1));
    const soldById=Object.fromEntries(copies.map(l=>[l.id,0]));
    for(const point of distribution.rows){
      let needed=point.received;point.lotTransfers=[];
      for(const lot of copies){const held=Object.values(lot.locations).reduce((a,q)=>a+n(q),0),q=Math.min(needed,n(lot.available)-held);if(q>0){lot.locations[point.id]=n(lot.locations[point.id])+q;point.lotTransfers.push({id:lot.id,units:q});needed-=q;}}
      if(needed)throw new RangeError('Transferencia sin lotes suficientes: '+point.id);
    }
    for(const point of distribution.rows){let needed=point.sold;point.lotSales=[];let revenue=0;
      for(const lot of copies){const q=Math.min(needed,n(lot.locations[point.id]));if(q>0){const unitPrice=price(lot);lot.locations[point.id]-=q;soldById[lot.id]+=q;point.lotSales.push({id:lot.id,units:q,price:unitPrice,revenue:money(q*unitPrice)});revenue+=q*unitPrice;needed-=q;}}
      if(needed)throw new RangeError('Venta sin lote en el punto: '+point.id);point.revenue=money(revenue);
    }
    for(const lot of copies)lot.closingLocations=lot.locations;
    const lotSales=copies.map(l=>({id:l.id,units:soldById[l.id],price:price(l),revenue:money(soldById[l.id]*price(l))}));
    return {lots:copies,lotSales,revenue:money(lotSales.reduce((sum,l)=>sum+l.revenue,0))};
  }
  function closeMany(inputs=[],config=DEFAULT){const prepared=inputs.map(input=>prepare(input,config)),allocations=allocate(prepared,config);return Object.fromEntries(prepared.map(p=>{
    const pointList=points(p.state,config),locationInventory=clone(p.state.__storeInventory||{}),distributions={};
    const sales=p.lines.map(line=>{const a=allocations[p.id].products[line.id],demand=n(a?.demandaAjustada),distribution=distributeProduct({id:line.id,demand,price:line.effectivePrice,available:line.available,openingLocations:locationInventory[line.id]||{},activePoints:pointList,affinity:config.commercialAffinity[line.id],manualTransfers:(Number(p.state.CANALES?.round)===Number(p.round)?p.state.CANALES?.transfers?.[line.id]:null)??p.state.PRODUCCION_META?.transfers?.[line.id]??null});distributions[line.id]=distribution;const sold=distribution.rows.reduce((sum,row)=>sum+row.sold,0);
      const located=locateLots(line.lots,distribution,locationInventory[line.id]||{},line.id,line.price,config,p.round);
      line.lots=located.lots;locationInventory[line.id]=distribution.locations;const lotSales=located.lotSales,lotRevenue=located.revenue;
      let reason='';if(!sold){const source=p.plan.productLines.find(l=>l.id===`molde_${config.products.indexOf(line.id)+1}`);reason=!pointList.length?'Sin canal de venta':line.available>0&&!demand?'Sin demanda asignada':!source?.target?'No planificó producción en este segmento':!source?.available?'Sin molde para este segmento':p.plan.processCapacity===0?'Sin personal o equipos en '+p.plan.limitingProcesses.join(', '):p.plan.materialCapacity===0?'Sin insumos suficientes: '+p.plan.limitingMaterials.join(', '):!line.produced?'No produjo en este segmento':!line.available?'Sin stock':!demand?'Sin demanda asignada':'Sin unidades enteras disponibles';}return {...line,alreadySold:0,chosenPrice:line.price,price:sold?money(lotRevenue/sold):line.price,effectivePrice:sold?money(lotRevenue/sold):line.price,lotSales,demand,assignedDemand:n(a?.asignado),sold,points:distribution.rows,assignment:distribution.assignment,lostSales:Math.max(0,demand-sold),potentialRevenue:money(demand*line.effectivePrice),revenue:lotRevenue,reason};});
    const revenue=money(sales.reduce((s,line)=>s+line.revenue,0)),goods=Object.fromEntries(sales.map(line=>[line.id,line.available-line.sold])),storage=money(Object.values(goods).reduce((s,v)=>s+v,0)*config.storagePerUnit);
    if(storage)p.messages.push({id:'CONS-07',text:'Inventario sin vender: se conserva y genera almacenaje.'});
    const receivable=money(revenue*p.creditRate),collections=money(n(p.state.__accountsReceivable));
    if(p.nextLoanRatePP)p.messages.push({id:'CONS-05',text:`Salud financiera baja: próximo préstamo +${p.nextLoanRatePP} puntos porcentuales.`});
    return [p.id,{...p,sales,revenue,goods,storeInventory:locationInventory,distributions,storage,receivable,collections,cashRevenue:money(revenue-receivable+collections),allocation:allocations[p.id]}];
  }));}
  // Cell-level Excel oracle entry point. Same allocation function as runtime;
  // inputs represent lots already processed through physical production.
  function settleMarketCompanies(companies,segment,config=DEFAULT){
    const id=config.products.find(product=>product===segment||config.segments[product].code===segment);
    if(!id)throw new RangeError('Segmento desconocido');
    const prepared=companies.map(company=>{
      const rep=n(company.reputacion),price=Number(company.precio),q=clamp(company.calidad),produced=n(company.producido);
      return {id:String(company.id),hasChannel:true,scores:{reputation:rep},demandFactor:1,lines:[{id,price,quality:q,produced,available:n(company.stock)}],effective:price,reputationFinal:rep};
    }),allocations=allocate(prepared,{...config,simulatedCompetitors:{...config.simulatedCompetitors,enabled:false}});
    return prepared.map(p=>{const allocation=allocations[p.id].products[id],sold=Math.min(n(p.lines[0].available),n(allocation?.demandaAjustada));return {id:p.id,precioScore:n(allocation?.puntajePrecio),puntaje:n(allocation?.puntajeTotal),participacion:n(allocation?.porcentaje),demanda:n(allocation?.demandaAjustada),vendidas:sold,precioEfectivo:money(p.effective),ingresos:money(sold*p.effective),reputacionFinal:p.reputationFinal};});
  }
  return {config:DEFAULT,codes,scores,prices,quality,reputation,materialUse,materialLots,prepare,allocate,closeMany,settleMarketCompanies,roundDemand,apportion,points,distributeProduct};
});
