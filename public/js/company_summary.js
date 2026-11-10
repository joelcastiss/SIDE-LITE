/* SIDE V3: Empresa summary, immutable local receipts and explicit final review. */
const reviewModel=window.SIDE_REVIEW_MODEL;
let companySummaryRound='current',companySummaryFilter='all',summaryOwner='',activeReview=null,reviewCommitBusy=false;
const reviewMoney=value=>'S/ '+Number(value||0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
function receiptKey(round=currentRound()){return `SIDE_DECISION_RECEIPTS_${storageKey()}_${round}`;}
function readReviewReceipts(round=currentRound()){
  try{const value=JSON.parse(localStorage.getItem(receiptKey(round))||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([cat,r])=>categoryByCat(cat)&&r&&Array.isArray(r.items)&&r.items.every(i=>i&&Array.isArray(i.rows)))):{};}catch{return {};}
}
function receiptRounds(){
  const prefix=`SIDE_DECISION_RECEIPTS_${storageKey()}_`,rounds=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(prefix)){const r=Number(key.slice(prefix.length));if(Number.isInteger(r)&&r>0)rounds.push(r);}}
  return [...new Set(rounds)].sort((a,b)=>b-a);
}
function confirmedContext(){
  const ctx=decisionModelContext(),receipts=readReviewReceipts();
  for(const cat of decisionCategories()){
    if(!(sectionSubmitted(cat.cat)||decisionsSubmitted()))continue;
    const receipt=receipts[cat.cat];
    if(receipt?.drafts){Object.assign(ctx.drafts,deepClone(receipt.drafts));continue;}
    // Legacy V2 submissions have flags but no immutable receipts. Read saved values,
    // never an unsent working draft, and do not invent an original submission time.
    for(const item of cat.items)ctx.drafts[item.id]=reviewModel.draft(item,{...ctx,drafts:{}});
  }
  return ctx;
}
function migrateCurrentReceipts(){
  const receipts=readReviewReceipts(),ctx=confirmedContext();let changed=false;
  for(const cat of decisionCategories()){
    if(receipts[cat.cat]||!(sectionSubmitted(cat.cat)||decisionsSubmitted()))continue;
    const model=reviewModel.section(cat,ctx),drafts={};cat.items.forEach(i=>{drafts[i.id]=deepClone(ctx.drafts[i.id])});
    receipts[cat.cat]={...model,drafts,submitted:true,source:'legacy',sentAt:null,company:currentStudent.company,game:currentStudent.game?.codigo,recordedNet:Number(cashLedger[sectionLedgerKey(cat.cat)]||0)};
    changed=true;
  }
  if(changed)writeDecisionBatch({[receiptKey()]:JSON.stringify(receipts)});
}
function comparableSummaryDraft(item,d){
  if(item.type==='production-plan')return {moldTargets:Object.entries(d.moldTargets||{}).map(([id,value])=>[id,Number(value)||0]).filter(([,value])=>value!==0).sort(),prices:{...defaultSegmentPrices(),...d.prices}};
  if(item.type==='number')return {value:Number(d.value)||0};
  if(item.type==='loan')return {amount:Number(d.amount)||0};
  if(item.asset||item.type==='quantity'||item.type==='quantity-choice')return (item.options||[]).map(o=>[o.id,Number(d.quantities?.[o.id])||0]);
  if(item.id==='CANALES')return {ids:[...(d.optionIds||[])].sort(),quantities:RULES.STORE_IDS.map(id=>[id,RULES.storeQuantity(d,id)])};
  return {ids:[...(d.optionIds||[])].sort()};
}
function liveCompanyReview(){
  const context=confirmedContext(),receipts=readReviewReceipts();
  const sections=decisionCategories().map(cat=>{
    const submitted=sectionSubmitted(cat.cat)||decisionsSubmitted(),saved=cat.items.some(i=>Number(decisionState[i.id]?.round)===currentRound());
    const frozen=submitted?receipts[cat.cat]:null;
    const section=frozen?.items?deepClone(frozen):reviewModel.section(cat,context);
    const dirty=!submitted&&cat.items.some(item=>JSON.stringify(comparableSummaryDraft(item,context.drafts[item.id]))!==JSON.stringify(comparableSummaryDraft(item,reviewModel.draft(item,{...context,drafts:{}}))));
    return {...section,submitted,status:submitted?'sent':dirty?'draft':saved?'saved':'pending',sentAt:frozen?.sentAt||null,source:frozen?.source||'local'};
  });
  return {round:currentRound(),context,sections,financial:reviewModel.finances(sections,context),warnings:reviewModel.warnings(context)};
}
function reviewProblems(review,cats=decisionCategories().map(c=>c.cat)){
  const issues=[],ctx=review.context;
  for(const cat of decisionCategories().filter(c=>cats.includes(c.cat)&&!sectionSubmitted(c.cat))){
    for(const item of cat.items){
      if(item.type==='info')continue;
      const d=ctx.drafts[item.id]||{};
      if(itemRequired(item)&&!draftItemComplete(item))issues.push({cat:cat.cat,item:item.id,text:`Falta completar: ${item.name}.`});
      if(item.options){
        for(const id of d.optionIds||[])if(!item.options.some(o=>o.id===id))issues.push({cat:cat.cat,item:item.id,text:`Opci\u00f3n no v\u00e1lida en ${item.name}.`});
        for(const [id,value] of Object.entries(d.quantities||{})){
          const q=Number(value),floor=item.asset?-getOwned(item,id):item.id==='CANALES'?1:0;
          if(!(item.material?Number.isFinite(q):Number.isSafeInteger(q))||q<floor)issues.push({cat:cat.cat,item:item.id,text:`Cantidad no v\u00e1lida en ${item.name}.`});
        }
      }
      if(item.type==='number'&&draftItemComplete(item)&&(!Number.isFinite(Number(d.value))||Number(d.value)<Number(item.min||0)||Number(d.value)>(item.max??Infinity)))issues.push({cat:cat.cat,item:item.id,text:`Revisa el valor de ${item.name}.`});
      if(item.type==='production-plan')for(const value of Object.values(d.moldTargets||{}))if(!Number.isSafeInteger(Number(value))||Number(value)<0)issues.push({cat:cat.cat,item:item.id,text:'Revisa las cantidades de producción por molde.'});
      if(item.type==='loan'&&(!Number.isFinite(Number(d.amount))||Number(d.amount)<0||Number(d.amount)>loanMaximum()))issues.push({cat:cat.cat,item:item.id,text:'El pr\u00e9stamo est\u00e1 fuera del l\u00edmite permitido.'});
      if(item.id==='CANALES')for(const id of RULES.STORE_IDS){try{RULES.nextStoreBatches(decisionState.CANALES,id,RULES.storeQuantity(d,id),ctx.round);}catch{issues.push({cat:'D',item:'CANALES',text:'No puedes reducir tiendas con un compromiso vigente.'});}}
    }
  }
  const completing=decisionCategories().every(category=>sectionSubmitted(category.cat)||cats.includes(category.cat));
  const plan=window.SIDE_PRODUCTION_MODEL.calculate(ctx);
  if(completing||plan.target){
    if(completing&&!plan.target)issues.push({cat:'B',item:'PRODUCCION_META',text:'Indica una meta de producción mayor que cero.'});
    for(const line of plan.productLines.filter(line=>line.target>0&&!line.available))issues.push({cat:'B',item:'MOLDE',text:`${line.label}: falta adquirir el molde para producir ${line.target} unidades.`});
    // Temporal rooms must confirm the order before a provider can receive it.
    // Capacity and received-stock shortfalls remain visible as warnings, but
    // cannot make that confirmation impossible.
    if(ctx.config?.materialRulesVersion!=='receipts-v1'){
      for(const process of plan.processes.filter(process=>process.shortfall>0))issues.push({cat:process.id==='cut'?'B':'C',text:`${process.label}: capacidad ${process.cycleCapacity} unidades; la meta requiere ${plan.target}. Revisa personal y equipos.`});
      for(const material of plan.materials.filter(material=>material.shortfall>0))issues.push({cat:'F',item:material.id,text:`${material.label}: faltan ${material.shortfall.toLocaleString('es-PE')} ${material.unit} para la meta.`});
      if(plan.target&&plan.producibleUnits<plan.target&&!issues.some(issue=>['B','C','F'].includes(issue.cat)))issues.push({cat:'B',text:`Solo se pueden producir ${plan.producibleUnits} de ${plan.target} unidades; revisa la meta y los recursos.`});
    }
    const channels=ctx.drafts.CANALES?.optionIds||[];
    if(completing&&!channels.some(id=>['web','los_olivos','miraflores','sjl'].includes(id)))issues.push({cat:'D',item:'CANALES',text:'Falta un canal de venta activo.'});
  }
  const delta=review.sections.filter(s=>cats.includes(s.cat)&&!s.submitted).reduce((sum,s)=>sum+s.net-Number(cashLedger[`${ctx.round}:${s.cat}`]||0),0);
  if(review.financial.currentCash+delta<-0.005)issues.push({cat:'E',text:'La caja al confirmar ser\u00eda negativa. Reduce gastos o revisa el financiamiento.'});
  return issues.filter((x,index,array)=>array.findIndex(y=>y.text===x.text&&y.cat===x.cat)===index);
}
function reviewFingerprint(){
  return JSON.stringify({company:storageKey(),round:currentRound(),drafts:decisionModelContext().drafts,config:teacherConfig(),
    state:localStorage.getItem(decisionKey()),ledger:localStorage.getItem(ledgerKey()),receipts:localStorage.getItem(receiptKey()),
    flags:decisionCategories().map(c=>sectionSubmitted(c.cat)),all:decisionsSubmitted()});
}
function commitReviewedSections(cats,finalize){
  if(!studentAccess().canOperate){toast(studentAccess().reason);return false;}
  if(reviewCommitBusy||decisionsSubmitted())return false;
  reviewCommitBusy=true;
  try{
    const review=liveCompanyReview(),problems=reviewProblems(review,cats);
    if(problems.length){toast(problems[0].text);return false;}
    const selected=decisionCategories().filter(c=>cats.includes(c.cat)&&!sectionSubmitted(c.cat));
    const plans=selected.map(cat=>prepareSectionSave(cat,review.context));
    const state=deepClone(decisionState),ledger=deepClone(cashLedger),receipts=readReviewReceipts(),writes={},sentAt=new Date().toISOString();
    const draftKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let draftStore={};try{draftStore=JSON.parse(localStorage.getItem(draftKey)||'{}')||{}}catch{}
    for(const plan of plans){
      Object.assign(state,plan.entries);ledger[sectionLedgerKey(plan.cat)]=plan.net;
      const drafts={};categoryByCat(plan.cat).items.forEach(i=>{drafts[i.id]=deepClone(review.context.drafts[i.id])});
      // Do not overwrite a prior submitted receipt. New cycles use a new key.
      receipts[plan.cat]={...plan.model,drafts,submitted:true,sentAt,source:'local',company:currentStudent.company,game:currentStudent.game?.codigo,recordedNet:plan.net};
      delete draftStore[plan.cat];writes[sectionSubmissionKey(plan.cat)]='1';
    }
    const complete=finalize||decisionCategories().every(category=>sectionSubmitted(category.cat)||plans.some(plan=>plan.cat===category.cat));
    if(complete)writes[submissionKey()]='1';
    writes[decisionKey()]=JSON.stringify(state);writes[ledgerKey()]=JSON.stringify(ledger);writes[receiptKey()]=JSON.stringify(receipts);writes[draftKey]=JSON.stringify(draftStore);
    if(!writeDecisionBatch(writes))return false;
    const delta=Object.values(ledger).reduce((a,b)=>a+Number(b||0),0)-ledgerTotal();
    decisionState=state;cashLedger=ledger;decisionDrafts={};restoreDraftsForRound();
    let planSync=null;
    if(simulationSubmissionComplete()){
      captureCyclePlan();
      // Queue the confirmed plan before optional report rendering can fail.
      try{if(currentStudent.empresaId){setCyclePlanSyncPending(true);planSync=queueStudentSnapshot(buildStudentSnapshot(currentRound()));}}
      catch(error){console.error('SIDE: plan confirmado localmente; sincronización pendiente',error);}
    }
    if(finalize){currentCategory='A';companySummaryRound='current';companySummaryFilter='sent';closeCompanyReview();}
    try{syncReportToSupabase(syncStudentReportPreview());}catch(error){console.error('SIDE: preview report refresh failed',error);}
    // Fase B-fix: el envío también sincroniza con Supabase (no solo el borrador).
    // Fire-and-forget con guard: syncSectionToSupabase nunca rechaza.
    try{if(typeof syncSectionToSupabase==='function'){for(const plan of plans){syncSectionToSupabase(plan.cat);}}}catch(error){console.error('SIDE: supabase round sync failed',error);}
    animateCash(delta);renderTabs();renderDecisionCategory();updateHud();
    toast(finalize?'Decisiones confirmadas en este equipo. Verificando el envío al servidor…':`Secci\u00f3n ${categoryByCat(cats[0])?.short} enviada en este equipo.`,6000);
    if(planSync){
      Promise.resolve(planSync).then(synced=>{
        if(synced){
          setCyclePlanSyncPending(false);
          toast('El servidor confirmó las decisiones del ciclo.',8000);
          showCompanyAfterConfirmation();
        }else{
          toast('El servidor aún no confirmó el plan. Tus decisiones siguen en este equipo; reintenta la sincronización antes de entrar al mundo 3D.',8000);
          currentCategory='A';companySummaryRound='current';
          renderTabs();renderDecisionCategory();
        }
      }).catch(error=>console.error('SIDE: verificación de plan pendiente',error));
    }else if(typeof simulationSubmissionComplete==='function'&&simulationSubmissionComplete())showCompanyAfterConfirmation();
    return true;
  }catch(error){console.error('SIDE: review confirmation failed',error);toast('No se pudo confirmar. Revisa tus decisiones e intenta nuevamente.');return false;}
  finally{reviewCommitBusy=false;}
}
function showCompanyAfterConfirmation(){
  if(!simulationSubmissionComplete())return;
  closeCompanyReview();
  currentCategory='A';companySummaryRound='current';companySummaryFilter='sent';
  renderTabs();renderDecisionCategory();
}
function summaryStatus(section){return section.submitted?'ENVIADA':section.status==='draft'?'BORRADOR SIN GUARDAR':section.status==='saved'?'GUARDADA, NO ENVIADA':'PENDIENTE';}
function summaryDate(section){
  if(!section.submitted)return 'No confirmada en este ciclo';
  if(!section.sentAt)return 'Registro anterior; fecha original no disponible';
  const d=new Date(section.sentAt);return Number.isFinite(d.getTime())?`Enviada el ${d.toLocaleString('es-PE')}`:'Fecha no disponible';
}
function financialCardsHtml(financial){
  const f=financial,cards=[
    ['Caja actual',reviewMoney(f.currentCash),'Saldo guardado antes de los cambios pendientes. Los borradores guardados ya est\u00e1n reflejados.','current'],
    ['Desembolso de estas decisiones',reviewMoney(f.outflow),'Costo total elegido para este ciclo. Incluye lo enviado y lo guardado; no se cobra dos veces.','outflow'],
    ['Compromisos futuros',reviewMoney(f.contracts.total),'Alquileres m\u00ednimos de tiendas posteriores a este ciclo. No se descuentan ahora.','commitments'],
    ['Resultado estimado',reviewMoney(f.projectedCash),'Caja proyectada al confirmar, sin ventas futuras. Es una estimaci\u00f3n de caja, no de utilidad.','estimate']
  ];
  return `<div class="cs-financial-grid">${cards.map(([title,value,help,key])=>`<article class="cs-metric cs-metric-${key}"><span>${title}</span><strong data-summary-metric="${key}">${value}</strong><p>${help}</p>${key==='estimate'?'<b class="cs-estimate-tag">PROYECCI\u00d3N \u00b7 NO GARANTIZADA</b>':''}</article>`).join('')}</div>
    <div class="cs-cash-bridge"><span>Ajuste pendiente sobre la caja guardada: <b>${f.pendingDelta>=0?'+':''}${reviewMoney(f.pendingDelta)}</b></span><span>Pr\u00e9stamos elegidos: <b>${reviewMoney(f.financing)}</b></span><span>Ingreso por liquidaci\u00f3n: <b>${reviewMoney(f.assetIncome)}</b></span></div>`;
}
function futureHtml(financial){
  const f=financial;
  return `<details class="cs-future"><summary>Detalle de compromisos y supuestos de la proyecci\u00f3n</summary><div class="cs-future-body">
    <p><b>Costos de continuidad: ${reviewMoney(f.recurring)} por ciclo</b> si mantienes los locales, las tiendas y la dotaci\u00f3n elegidos. Es una referencia, no una obligaci\u00f3n contractual completa; excluye nuevas compras de insumos, marketing y capacitaci\u00f3n.</p>
    ${f.contracts.contracts.length?`<div class="cs-contracts">${f.contracts.contracts.map(c=>`<p><b>${escapeHtml(c.label)}: ${c.quantity} tienda(s).</b> ${reviewMoney(c.perCycle)} por ciclo; ${reviewMoney(c.total)} de alquileres m\u00ednimos futuros. \u00daltimo compromiso hasta el ciclo ${c.lastRound}.</p>`).join('')}</div>`:'<p>Sin contratos de tiendas f\u00edsicas seleccionados.</p>'}
    ${f.contracts.beyondGame>0?`<p class="cs-warning-text">${reviewMoney(f.contracts.beyondGame)} de esos alquileres quedan despu\u00e9s del \u00faltimo ciclo configurado. Se informan, pero este resumen no inventa una liquidaci\u00f3n al terminar la partida.</p>`:''}
    <p>El modelo de producci\u00f3n usa 1 ciclo como un mes de 30 d\u00edas, de acuerdo con el modelo de planificación de referencia. La duraci\u00f3n real del temporizador es independiente. La proyecci\u00f3n solo aplica los movimientos elegidos a la caja guardada: no anticipa ventas, eventos futuros, devoluciones ni intereses.</p>
    ${f.financing>0?'<p>El pr\u00e9stamo figura como ingreso de financiamiento, no como venta ni utilidad. El proyecto a\u00fan no define plazo ni cuotas; por eso no se presenta una amortizaci\u00f3n ficticia.</p>':''}
    <p>Guardar un borrador ya actualiza el saldo guardado en SIDE. Confirmar aplica \u00fanicamente la diferencia pendiente y bloquea las decisiones del ciclo.</p>
  </div></details>`;
}
function productionItemOutflow(review,id){
  const item=review.sections.flatMap(section=>section.items||[]).find(entry=>entry.id===id);
  return Number(item?.outflow||0);
}
function cumulativeResourceQuantity(review){
  let total=0;
  for(const section of review.sections||[])for(const item of section.items||[]){
    if(!['quantity','quantity-choice'].includes(item.type))continue;
    for(const row of item.rows||[])if(Number.isFinite(Number(row.quantity))&&Number(row.quantity)>0)total+=Number(row.quantity);
  }
  return total;
}
function productionSummaryHtml(review){
  const plan=window.SIDE_PRODUCTION_MODEL.calculate(review.context);
  const previewState={...review.context.state,...Object.fromEntries(Object.entries(review.context.drafts||{}).map(([id,draft])=>[id,{...review.context.state[id],...draft,round:review.context.round}]))};
  const reputation=window.SIDE_ECONOMIC_CLOSURE.reputation(previewState,plan,review.context.round);
  const materialCost=['CUERO','ACCESORIOS','HILO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const laborCost=['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const supportCost=['JEFATURA','LIMPIEZA','ANALISTA_COMPRAS','LOCAL_PROD','MANTENIMIENTO'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const investmentCost=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'].reduce((total,id)=>total+productionItemOutflow(review,id),0);
  const cycleProductionCost=materialCost+laborCost+supportCost;
  const unitCost=plan.producibleUnits?cycleProductionCost/plan.producibleUnits:0;
  const stateClass=plan.productionGap?'limited':'ready';
  return `<section class="cs-production cs-production-${stateClass}" aria-labelledby="companyProductionTitle">
    <header class="cs-production-heading"><div><span class="cs-kicker">PLAN PRODUCTIVO DEL CICLO</span><h3 id="companyProductionTitle">De la compra a la producción terminada</h3><p>La cantidad final depende del menor resultado entre corte, ensamblado, acabado y materia prima disponible.</p></div><span class="cs-production-state">${plan.productionGap?'CAPACIDAD INSUFICIENTE':'META CUBIERTA'}</span></header>
    ${typeof productionChecklistHtml==='function'?productionChecklistHtml(plan):''}
    <div class="cs-production-kpis">
      <div><span>Meta elegida</span><strong>${plan.target.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Producción posible</span><strong>${plan.producibleUnits.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Faltante</span><strong>${plan.productionGap.toLocaleString('es-PE')} u.</strong></div>
      <div><span>Eficiencia aplicada</span><strong>${Math.round(plan.efficiency*100)}%</strong></div>
    </div>
    <div class="cs-mold-selection"><span>MOLDES SEGÚN INFRAESTRUCTURA</span><strong>${plan.availableMoldIds.length?plan.availableMoldIds.map(id=>plan.productLines.find(line=>line.id===id)?.label||id).map(escapeHtml).join(' · '):'Aún no se ha adquirido un molde'}</strong></div>
    <div class="cs-product-mix">${plan.productLines.map(line=>`<article class="${line.target?'has-target':''}"><span>${escapeHtml(line.label)}</span><strong>${line.target.toLocaleString('es-PE')} u. deseadas</strong><small>${line.plannedUnits.toLocaleString('es-PE')} u. posibles · cuero ${line.requirements.CUERO.toLocaleString('es-PE')} m² · accesorios ${line.requirements.ACCESORIOS.toLocaleString('es-PE')} · hilo ${line.requirements.HILO.toLocaleString('es-PE')} m</small><b>${line.available?'Molde disponible':'Escenario calculado; molde no adquirido'}</b></article>`).join('')}</div>
    <div class="cs-process-grid">${plan.processes.map((process,index)=>`<article class="cs-process-card ${process.shortfall?'is-limited':''}"><span class="cs-process-step">${index+1}</span><div><h4>${escapeHtml(process.label)}</h4><strong>Debe procesar ${process.plannedUnits.toLocaleString('es-PE')} unidades</strong><p>Capacidad máxima: ${process.cycleCapacity.toLocaleString('es-PE')} u./ciclo · ${process.dailyCapacity.toLocaleString('es-PE')} u./día</p><small>${process.staff} trabajador(es) · ${process.machines} equipo(s) emparejados · personal ${reviewMoney(process.payroll)}</small></div></article>`).join('')}</div>
    <div class="cs-material-table" role="table" aria-label="Conversión y uso de insumos">
      <div class="cs-material-head" role="row"><span>Insumo</span><span>Disponible por compras</span><span>Necesario para la meta</span><span>Uso en producción posible</span><span>Saldo</span></div>
      ${plan.materials.map(material=>`<div class="cs-material-row ${material.shortfall?'is-limited':''}" role="row"><strong>${escapeHtml(material.label)}</strong><span>${material.available.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.neededForTarget.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.consumption.toLocaleString('es-PE')} ${escapeHtml(material.unit)}</span><span>${material.remaining.toLocaleString('es-PE')} ${escapeHtml(material.unit)}${material.shortfall?`<small>Faltan ${material.shortfall.toLocaleString('es-PE')}</small>`:''}</span></div>`).join('')}
    </div>
    <div class="cs-production-costs">
      <div><span>Materia prima comprada</span><strong>${reviewMoney(materialCost)}</strong></div>
      <div><span>Personal directo</span><strong>${reviewMoney(laborCost)}</strong></div>
      <div><span>Soporte productivo</span><strong>${reviewMoney(supportCost)}</strong></div>
      <div><span>Inversión en planta</span><strong>${reviewMoney(investmentCost)}</strong><small>Se muestra aparte del costo operativo.</small></div>
      <div class="cs-unit-cost"><span>Desembolso operativo por unidad posible</span><strong>${plan.producibleUnits?reviewMoney(unitCost):'No calculable'}</strong><small>Incluye compras de materia prima; el consumo valorizado se reconoce al cierre.</small></div>
    </div>
    <p class="cs-production-method">Reputación prevista: <strong>${reputation.valor.toFixed(2)} / 40</strong>. Factores en escala 0–10: producción ${reputation.factorProduccion.toFixed(2)}, personal ${reputation.factorMO.toFixed(2)}, material consumido ${reputation.factorMP.toFixed(2)} y publicidad ${reputation.factorPublicidad.toFixed(2)}. La reputación es la suma de estos cuatro factores; para el reparto se expresa en escala 0–10.</p>
    <p class="cs-production-method">Modelo de producción: 30 días por ciclo, 90% de eficiencia base, +1 punto porcentual por trabajador de nivel 3 y +4 puntos con jefatura. Se fabrica primero el molde básico, después el mejorado y finalmente el premium, usando solo los materiales disponibles.</p>
  </section>`;

}
function sectionSummaryHtml(section,{history=false,compact=false}={}){
  const hasSelection=section.items.some(i=>i.rows?.some(r=>r.outflow||r.income||Number(r.quantity)>0));
  return `<details class="cs-section cs-status-${section.submitted?'sent':section.status||'pending'}" data-summary-section="${section.cat}" ${!compact||hasSelection?'open':''}>
    <summary><img src="${escapeHtml(categoryByCat(section.cat)?.icon||'')}" alt=""><span class="cs-section-name"><b>${escapeHtml(section.title)}</b><small>${escapeHtml(summaryDate(section))}</small></span><span class="cs-badge">${summaryStatus(section)}</span><span class="cs-section-total">${reviewMoney(section.outflow)}<small>desembolso del ciclo</small></span></summary>
    <div class="cs-section-body">${!history?section.submitted&&!decisionsSubmitted()?`<button type="button" class="cs-link" data-summary-reopen="${section.cat}">Corregir ${escapeHtml(section.title)}</button>`:!section.submitted?`<button type="button" class="cs-link" data-summary-goto="${section.cat}">Revisar ${escapeHtml(section.title)}</button>`:'':''}
    <div class="cs-items">${section.items.map(item=>`<article class="cs-item" data-summary-item="${item.id}"><h4>${escapeHtml(item.name)}</h4>${item.rows.length?item.rows.map(row=>`<div class="cs-detail-row"><div><strong>${escapeHtml(row.label)}${row.quantity!==null?` <span class="cs-quantity">\u00d7 ${escapeHtml(row.quantity)}</span>`:''}</strong>${row.detail?`<p>${escapeHtml(row.detail)}</p>`:''}${row.unitCost>0?`<small>Referencia por unidad: ${reviewMoney(row.unitCost)}</small>`:''}</div><div class="cs-row-money">${row.outflow?reviewMoney(row.outflow):row.income?`+ ${reviewMoney(row.income)}`:'Sin desembolso'}</div></div>`).join(''):`<p class="cs-empty-item">${escapeHtml(item.note)}</p>`}</article>`).join('')}</div>
    <div class="cs-section-footer"><span>Desembolso: <b>${reviewMoney(section.outflow)}</b></span>${section.financing?`<span>Financiamiento: <b>+ ${reviewMoney(section.financing)}</b></span>`:''}${section.assetIncome?`<span>Liquidaci\u00f3n: <b>+ ${reviewMoney(section.assetIncome)}</b></span>`:''}</div></div></details>`;
}
function noticesHtml(problems,warnings){
  return `${problems.length?`<div class="cs-notice cs-notice-error"><h3>Antes de enviar, completa lo siguiente</h3>${problems.map(p=>`<p>${escapeHtml(p.text)} <button class="cs-link" type="button" ${sectionSubmitted(p.cat)&&!decisionsSubmitted()?`data-summary-reopen="${p.cat}"`:`data-summary-goto="${p.cat}"`}>${sectionSubmitted(p.cat)&&!decisionsSubmitted()?'Corregir':'Ir a'} ${escapeHtml(categoryByCat(p.cat)?.short||'la sección')}</button></p>`).join('')}</div>`:''}
    ${warnings.length?`<details open class="cs-notice cs-notice-warning"><summary>${warnings.length} advertencia(s) de operaci\u00f3n \u00b7 no bloquean el env\u00edo</summary>${warnings.map(w=>`<p>${escapeHtml(w.text)}</p>`).join('')}</details>`:''}`;
}
function reopenSubmittedSection(cat){
  if(!studentAccess().canOperate||decisionsSubmitted()||!sectionSubmitted(cat))return false;
  if(!writeDecisionBatch({[sectionSubmissionKey(cat)]:null}))return false;
  for(const item of categoryByCat(cat)?.items||[])delete decisionDrafts[item.id];
  restoreDraftsForRound();
  try{if(currentStudent.empresaId)queueStudentSnapshot(buildStudentSnapshot(currentRound()));}
  catch(error){console.error('SIDE: corrección de sección pendiente de sincronización',error);}
  return true;
}
function navigateFromSummary(cat,{reopen=false}={}){
  closeCompanyReview();persistCurrentDraftOnly();
  if(reopen&&!reopenSubmittedSection(cat))return;
  currentCategory=cat;renderTabs();renderDecisionCategory();
  scrollDecisionContentToTop();
}
function bindSummaryLinks(root){
  root.querySelectorAll('[data-summary-goto]').forEach(b=>b.addEventListener('click',()=>navigateFromSummary(b.dataset.summaryGoto)));
  root.querySelectorAll('[data-summary-reopen]').forEach(b=>b.addEventListener('click',()=>navigateFromSummary(b.dataset.summaryReopen,{reopen:true})));
}
function renderCompanySummary(){
  const mount=$('companySummaryMount');if(!mount)return;
  const owner=`${storageKey()}_${currentRound()}`;if(summaryOwner!==owner){summaryOwner=owner;companySummaryRound='current';companySummaryFilter='all';}
  migrateCurrentReceipts();
  const history=companySummaryRound!=='current'&&Number(companySummaryRound)!==currentRound(),review=liveCompanyReview();
  const statement=history?null:financialReport({projection:true});
  const old=history?readReviewReceipts(Number(companySummaryRound)):null;
  let sections=history?decisionCategories().map(c=>old[c.cat]).filter(Boolean):review.sections;
  if(companySummaryFilter==='sent')sections=sections.filter(s=>s.submitted);
  const sent=(history?decisionCategories().map(category=>old[category.cat]).filter(Boolean):review.sections).filter(s=>s.submitted).length;
  const rounds=receiptRounds().filter(r=>r!==currentRound());
  const heading=history?`Decisiones enviadas \u00b7 ciclo ${companySummaryRound}`:'Resumen de decisiones de tu empresa';
  mount.innerHTML=`<section class="company-summary" aria-labelledby="companySummaryTitle"><header class="cs-heading"><div><span class="cs-kicker">EMPRESA \u00b7 CICLO ${history?companySummaryRound:currentRound()}</span><h2 id="companySummaryTitle">${heading}</h2><p>Decisiones, proceso productivo, compras, costos y financiamiento en un solo lugar.</p></div><span class="cs-progress">${sent} / ${decisionCategories().length}<small>apartados enviados</small></span></header>
      ${!history&&currentStudent.empresaId&&cyclePlanSyncPending()?'<div class="cs-notice cs-notice-error" role="status"><p>El Servidor todavía no confirmó el plan de este ciclo. Reintenta el envío para que pueda calcular las ventas al cierre.</p><button id="retryCyclePlanSync" type="button" class="cs-secondary">REINTENTAR ENVÍO AL SERVIDOR</button></div>':''}
      ${!history&&canStartSimulation()&&simulationSubmissionComplete()?'<div class="cs-world-ready"><div><strong>Decisiones del ciclo enviadas</strong><p>Puedes quedarte en este resumen o entrar al mundo 3D. Entrar es opcional.</p></div><button id="companyStartWorld" data-start-world type="button" class="cs-primary">ENTRAR AL MUNDO 3D</button></div>':''}
      <div class="cs-toolbar"><div class="cs-filters" role="group" aria-label="Filtrar decisiones"><button type="button" data-summary-filter="all" aria-pressed="${companySummaryFilter==='all'}">Todas las decisiones</button><button type="button" data-summary-filter="sent" aria-pressed="${companySummaryFilter==='sent'}">Solo enviadas</button></div><label>Ciclo <select id="companySummaryCycle"><option value="current">Actual \u00b7 ciclo ${currentRound()}</option>${rounds.map(r=>`<option value="${r}" ${history&&Number(companySummaryRound)===r?'selected':''}>Ciclo ${r} \u00b7 historial enviado</option>`).join('')}</select></label></div>
    ${!history&&(decisionState.__cycleSettlements?.[currentRound()]||statement?.provisional)?`<div class="cs-financial-scope"><strong>Ingresos ${statement.provisional?'estimados del':'del'} ciclo: ${reviewMoney(statement.estadoResultados.ingresos)}</strong><p>Unidades vendidas${statement.provisional?' estimadas':''}: ${Number((statement.projectionReceipt||decisionState.__cycleSettlements?.[currentRound()])?.sold||0)}. ${statement.provisional?'Proyección individual con el plan confirmado. El reparto entre empresas se consolida al cierre.':'Ventas registradas al cierre.'} Caja ${statement.provisional?'estimada':'final'}: ${reviewMoney(statement.balanceCaja.cajaFinal)}.</p></div>`:''}
    ${!history?'<p class="cs-financial-scope">Vista financiera del ciclo completo: decisiones enviadas y borradores. El filtro inferior corresponde al detalle.</p>':''}
    ${!history?noticesHtml([],review.warnings):''}
    ${history?'<p class="cs-local-note">Historial de env\u00edos guardados: las cantidades y costos permanecen como se confirmaron. No se recalcula la caja actual de un ciclo anterior.</p>':financialCardsHtml(review.financial)+`<div class="cs-cumulative-resource"><span>CANTIDAD ACUMULADA</span><strong>${cumulativeResourceQuantity(review).toLocaleString('es-PE')}</strong><small>Suma de las cantidades registradas de ciclos anteriores y del ciclo actual.</small></div>`+productionSummaryHtml(review)+`<details class="financial-details"><summary>${statement.provisional?'Proyección financiera':'Reportes financieros guardados'} · ciclo ${currentRound()}</summary><p>Utilidad${statement.provisional?' estimada':''}: ${reviewMoney(statement.estadoResultados.utilidad)} · Caja${statement.provisional?' estimada':''}: ${reviewMoney(statement.balanceCaja.cajaFinal)}</p>${financialDetailsHtml(statement)}</details>`+futureHtml(review.financial)}
    <p class="cs-local-note">Las etiquetas ENVIADA indican confirmación en este equipo. El aviso de envío indica cuándo el servidor la recibe. Los borradores no se presentan como enviados.</p>
    ${!history?`<div class="cs-status-strip">${review.sections.map(s=>`<span class="cs-mini-${s.submitted?'sent':'pending'}">${escapeHtml(s.title)}: ${s.submitted?'enviada':'pendiente de env\u00edo'}</span>`).join('')}</div>`:''}
    <div class="cs-sections">${sections.length?sections.map(s=>sectionSummaryHtml(s,{history})).join(''):'<div class="cs-empty"><h3>A\u00fan no hay decisiones enviadas</h3><p>Guardar borrador no confirma una decisi\u00f3n. Usa ENVIAR DECISI\u00d3N en cada apartado o revisa el env\u00edo completo.</p></div>'}</div>
    ${!history?`<footer class="cs-main-actions"><span>${decisionsSubmitted()?'Ciclo completo confirmado. Este resumen sigue disponible para consulta.':'Revisa lo elegido y los apartados pendientes antes de confirmar.'}</span><button id="companyReviewAll" type="button" class="cs-primary">${decisionsSubmitted()?'VER REVISI\u00d3N DEL CICLO':'REVISAR Y ENVIAR TODO'}</button></footer>`:''}
  </section>`;
  mount.querySelectorAll('[data-summary-filter]').forEach(b=>b.addEventListener('click',()=>{companySummaryFilter=b.dataset.summaryFilter;renderCompanySummary();}));

  mount.querySelector('#retryCyclePlanSync')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent='ENVIANDO…';
    const synced=await retryStudentSync({force:true});
    if(synced){setCyclePlanSyncPending(false);toast('El servidor confirmó las decisiones del ciclo.',8000);renderCompanySummary();}
    else{toast('El Servidor todavía no confirmó el envío. Se conservaron tus decisiones; vuelve a intentarlo cuando haya conexión.',8000);renderCompanySummary();}
  });
  mount.querySelector('#companySummaryCycle').addEventListener('change',e=>{companySummaryRound=e.target.value;renderCompanySummary();});
    mount.querySelector('#companyReviewAll')?.addEventListener('click',openCompanyReview);bindSummaryLinks(mount);
    mount.querySelector('#companyStartWorld')?.addEventListener('click',requestWorldEntry);
  if($('companySummaryJump'))$('companySummaryJump').onclick=()=>{
    const stage=$('decisionMenu'),head=$('decisionStickyHead');
    window.scrollBy(0,mount.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12);
    requestAnimationFrame(()=>{window.scrollBy(0,mount.getBoundingClientRect().top-head.getBoundingClientRect().bottom-12);});
  };
}
function ensureReviewDialog(){
  let dialog=$('companyReviewDialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='companyReviewDialog';dialog.className='cs-review-dialog';dialog.setAttribute('aria-labelledby','companyReviewTitle');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{activeReview=null;});
  dialog.addEventListener('cancel',()=>{activeReview=null;});
  return dialog;
}
function paintReviewDialog(message=''){
  const dialog=ensureReviewDialog(),review=liveCompanyReview(),problems=decisionsSubmitted()?[]:reviewProblems(review),complete=decisionsSubmitted();
  activeReview={fingerprint:reviewFingerprint(),round:currentRound()};
  dialog.innerHTML=`<div class="cs-dialog-frame"><header class="cs-dialog-heading"><div><span class="cs-kicker">EMPRESA \u00b7 CICLO ${currentRound()}</span><h2 id="companyReviewTitle">${complete?'Decisiones del ciclo confirmado':'Revisi\u00f3n final antes de enviar'}</h2><p id="companyReviewDescription">${complete?'Consulta las decisiones confirmadas en este equipo.':'Revisar no guarda, no cobra y no bloquea. Solo el bot\u00f3n de confirmaci\u00f3n env\u00eda el ciclo.'}</p></div><button type="button" id="closeCompanyReview" class="cs-close" aria-label="Cerrar revisi\u00f3n">\u00d7</button></header>
    <div class="cs-dialog-body" tabindex="0">${message?`<p class="cs-notice cs-notice-warning" role="status">${escapeHtml(message)}</p>`:''}${financialCardsHtml(review.financial)}${productionSummaryHtml(review)}${futureHtml(review.financial)}${noticesHtml(problems,review.warnings)}
    <div class="cs-sections">${review.sections.map(s=>sectionSummaryHtml(s,{compact:true,history:complete})).join('')}</div><p class="cs-local-note">Las decisiones quedan guardadas en este equipo. Un aviso separado confirma cuándo el servidor recibe el plan del ciclo.</p></div>
    <footer class="cs-dialog-footer"><p>${complete?'Las decisiones no se vuelven a cobrar.':problems.length?`${problems.length} punto(s) por resolver antes de confirmar.`:'Se bloquear\u00e1n los apartados pendientes hasta el pr\u00f3ximo ciclo. Las advertencias no impiden continuar.'}</p><div><button type="button" id="cancelCompanyReview" class="cs-secondary">${complete?'CERRAR':'VOLVER A EDITAR'}</button>${!complete?`<button type="button" id="confirmCompanyReview" class="cs-primary" ${problems.length?'disabled':''}>CONFIRMAR Y ENVIAR TODO</button>`:''}</div></footer></div>`;
  dialog.querySelector('#closeCompanyReview').addEventListener('click',closeCompanyReview);dialog.querySelector('#cancelCompanyReview').addEventListener('click',closeCompanyReview);
  dialog.querySelector('#confirmCompanyReview')?.addEventListener('click',()=>{
    if(!activeReview||activeReview.round!==currentRound()){closeCompanyReview();toast('El ciclo ha cambiado. Revisa las decisiones del nuevo ciclo.');return;}
    if(activeReview.fingerprint!==reviewFingerprint()){paintReviewDialog('Los datos cambiaron mientras revisabas. Verifica los valores actualizados y confirma nuevamente.');return;}
    commitReviewedSections(decisionCategories().map(c=>c.cat),true);
  });
  bindSummaryLinks(dialog);
}
function openCompanyReview(){
  // Working drafts are already persisted by the existing input handlers. This
  // read-only path does not call saveCurrentSection or mark anything submitted.
  migrateCurrentReceipts();paintReviewDialog();const dialog=ensureReviewDialog();if(!dialog.open)dialog.showModal();
}
function closeCompanyReview(){const dialog=$('companyReviewDialog');if(dialog?.open)dialog.close();activeReview=null;}
window.addEventListener('storage',event=>{
  if(!playerIsDeciding)return;
  if([decisionKey(),ledgerKey(),'SIDE_ACTIVE_ROUND',receiptKey()].includes(event.key)){
    closeCompanyReview();loadDecisionState();restoreDraftsForRound();renderTabs();renderDecisionCategory();
  }
});
