/* Read-only presentation of the teacher's latest completed game. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.SIDE_TEACHER_HISTORY=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EMPTY='Aún no hay una partida anterior registrada';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const numeric=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const number=value=>numeric(value)===null?'Sin datos':numeric(value).toLocaleString('es-PE',{maximumFractionDigits:2});
  const money=value=>numeric(value)===null?'Sin datos':'S/ '+numeric(value).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2});
  const array=value=>Array.isArray(value)?value:[];
  function date(value){
    const parsed=value?new Date(value):null;
    return parsed&&Number.isFinite(parsed.getTime())?parsed.toLocaleString('es-PE',{timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Sin fecha registrada';
  }
  function metrics(entries){
    return '<div class="history-metrics">'+entries.map(([label,value])=>`<div><small>${escape(label)}</small><strong>${escape(value)}</strong></div>`).join('')+'</div>';
  }
  function statements(report){
    if(!report)return '<p class="hint">No se registraron resultados para este ciclo.</p>';
    const er=report.estado_resultados||{},bc=report.balance_caja||{},fc=report.flujo_caja||{},bg=bc.balanceGeneral||report.balance_general||{};
    const section=(title,rows)=>`<section class="financial-section"><h5>${escape(title)}</h5><div class="financial-rows">${rows.map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(money(value))}</strong></div>`).join('')}</div></section>`;
    let html=metrics([['Caja al cierre',money(bc.cajaFinal??report.caja_final)],['Ventas netas',money(er.ventasNetas??er.ingresos??report.ingresos)],['Utilidad del ciclo',money(er.utilidad??report.utilidad)]]);
    html+='<details class="history-financial"><summary>Ver estados financieros e indicadores registrados</summary><div class="history-statements">';
    html+=section('Estado de resultados',[['Ventas netas',er.ventasNetas??er.ingresos??report.ingresos],['Costos',er.costos??report.costos],['Devoluciones',er.devoluciones],['Impacto de eventos',er.impactoEventos],['Otros resultados',er.otros],['Resultado de venta de activos',er.resultadoVentaActivos],['Utilidad',er.utilidad??report.utilidad]]);
    html+=section('Balance de caja',[['Caja inicial',bc.cajaInicial??report.capital],['Entradas',bc.entradas],['Salidas',bc.salidas],['Caja final',bc.cajaFinal??report.caja_final]]);
    html+=section('Flujo de caja',[['Operación',fc.operacion],['Inversión',fc.inversion],['Financiamiento',fc.financiamiento],['Flujo neto',fc.flujoNeto]]);
    html+=section('Balance general',[['Efectivo',bg.efectivo],['Activos fijos',bg.activosFijos],['Total activos',bg.activos],['Deuda',bg.deuda],['Patrimonio',bg.patrimonio],['Resultados acumulados',bg.resultadosAcumulados],['Pasivo + patrimonio',bg.pasivoPatrimonio]]);
    const indicators=report.indicadores||er.indicadores||bc.indicadores;
    if(indicators&&typeof indicators==='object')html+=`<section class="financial-section"><h5>Indicadores registrados</h5><div class="financial-rows">${Object.entries(indicators).filter(([,value])=>value!==null&&typeof value!=='object').map(([label,value])=>`<div><span>${escape(label)}</span><strong>${escape(typeof value==='number'?number(value):value)}</strong></div>`).join('')}</div></section>`;
    if(numeric(report.score)!==null)html+=`<p class="hint">Puntaje financiero SIDE registrado: ${escape(number(report.score))}</p>`;
    return html+'</div></details>';
  }
  function decisionGroups(rows,catalog=[]){
    const groups=new Map(),items=new Map();
    for(const category of array(catalog)){
      if(category.summaryOnly)continue;
      groups.set(category.cat,{title:category.title,rows:[]});
      for(const item of array(category.items))items.set(item.id,{item,category:category.cat});
    }
    for(const row of array(rows)){
      const known=items.get(row.decision_id),cat=known?.category||row.categoria||'otras';
      if(!groups.has(cat))groups.set(cat,{title:cat==='otras'?'Otras decisiones':`Categoría ${cat}`,rows:[]});
      const option=known?.item.options?.find(candidate=>candidate.id===row.opcion_id);
      const valueLabel=known&&!known.item.options?`${number(row.cantidad)}${known.item.unit?' '+known.item.unit:''}`:'Valor registrado';
      groups.get(cat).rows.push({name:known?.item.name||row.decision_nombre||row.decision_id||'Decisión',option:row.etiqueta||option?.label||row.opcion_id||valueLabel,quantity:row.cantidad,cost:row.costo_total});
    }
    return [...groups.values()].filter(group=>group.rows.length);
  }
  function reportDecisionsHtml(report,catalog){
    const labels=array(report?.decisiones),groups=new Map();
    const candidates=array(catalog).filter(category=>!category.summaryOnly).flatMap(category=>array(category.items).map(item=>({category,item}))).sort((a,b)=>b.item.name.length-a.item.name.length);
    for(const label of labels){
      const text=typeof label==='string'?label:String(label?.decision_nombre||label?.decision_id||'Decisión registrada');
      const normalized=text.toLocaleLowerCase('es');
      const known=candidates.find(({item})=>normalized.startsWith(item.name.toLocaleLowerCase('es'))||normalized.startsWith(item.id.toLocaleLowerCase('es'))||(item.type==='production-plan'&&normalized.startsWith('producción deseada:'))||(item.type==='loan'&&normalized.startsWith('línea de crédito utilizada:')));
      const optionMatches=known?[]:candidates.filter(({item})=>array(item.options).some(option=>normalized.startsWith(option.label.toLocaleLowerCase('es'))));
      const optionCategories=new Set(optionMatches.map(match=>match.category.title));
      const title=known?.category.title||(optionCategories.size===1?optionMatches[0].category.title:'Otras decisiones registradas');
      if(!groups.has(title))groups.set(title,[]);
      groups.get(title).push(text);
    }
    return [...groups].map(([title,texts])=>`<section class="history-category"><h5>${escape(title)}</h5><ul class="history-fallback">${texts.map(text=>`<li>${escape(text)}</li>`).join('')}</ul></section>`).join('');
  }
  function decisionsHtml(rows,report,catalog){
    const groups=decisionGroups(rows,catalog);
    if(!groups.length){
      const original=reportDecisionsHtml(report,catalog);
      return original?'<p class="hint">Detalle de decisiones registrado en el reporte:</p>'+original:'<p class="hint">No se registraron decisiones para este ciclo.</p>';
    }
    const original=reportDecisionsHtml(report,catalog);
    return groups.map(group=>`<section class="history-category"><h5>${escape(group.title)}</h5><div class="history-decision-list">${group.rows.map(row=>`<div class="history-decision"><div><strong>${escape(row.name)}</strong><span>${escape(row.option)}</span></div><div class="history-decision-values"><span>Cantidad: ${escape(number(row.quantity))}</span><span>Costo: ${escape(money(row.cost))}</span></div></div>`).join('')}</div></section>`).join('')+(original?`<details class="history-financial"><summary>Detalle original de decisiones del reporte</summary>${original}</details>`:'');
  }
  function cycleNumbers(company,played){
    const cycles=new Set([...array(company.reportes),...array(company.decisiones)].map(row=>Number(row.ciclo)).filter(cycle=>Number.isInteger(cycle)&&cycle>0));
    const total=Number(played);
    if(Number.isInteger(total)&&total>0&&total<=1000)for(let cycle=1;cycle<=total;cycle++)cycles.add(cycle);
    return [...cycles].sort((a,b)=>a-b);
  }
  function companyHtml(company,played,catalog){
    const reports=array(company.reportes).slice().sort((a,b)=>Number(a.ciclo)-Number(b.ciclo));
    const last=reports.at(-1),lastEr=last?.estado_resultados||{},lastBc=last?.balance_caja||{};
    const sum=key=>{
      const values=reports.map(report=>numeric(key==='ingresos'?(report.estado_resultados?.ventasNetas??report.estado_resultados?.ingresos??report.ingresos):(report.estado_resultados?.[key]??report[key]))).filter(value=>value!==null);
      return values.length?values.reduce((total,value)=>total+value,0):null;
    };
    const grade=numeric(company.puntaje_docente),cycles=cycleNumbers(company,played);
    let html=`<div class="history-company-heading"><div><span class="eyebrow">RESUMEN FINAL</span><h3>${escape(company.nombre_comercial||company.nombre_legal||'Empresa sin nombre')}</h3>${company.nombre_legal?`<p class="hint">${escape(company.nombre_legal)}</p>`:''}</div><span class="history-grade">Puntaje del profesor: <strong>${grade===null?'Sin calificar':escape(number(grade))+' / 20'}</strong></span></div>`;
    const finalMetrics=[['Caja final registrada',money(lastBc.cajaFinal??last?.caja_final??company.caja_actual)],['Ventas netas registradas · total',money(sum('ingresos'))],['Utilidad registrada · total',money(sum('utilidad'))]];
    if(numeric(company.resumen_final?.reputacion)!==null)finalMetrics.push(['Reputación final registrada',number(company.resumen_final.reputacion)]);
    html+=metrics(finalMetrics);
    html+=`<p class="hint">${reports.length} de ${cycles.length} ciclos con resultados registrados.${last?` Último resultado: ciclo ${escape(last.ciclo)} · utilidad ${escape(money(lastEr.utilidad??last.utilidad))}.`:''}</p>`;
    if(!cycles.length)return html+'<p class="hint">Esta empresa participó sin registros de ciclos.</p>';
    html+='<div class="history-cycles">'+cycles.map((cycle,index)=>{
      const report=reports.find(row=>Number(row.ciclo)===cycle),rows=array(company.decisiones).filter(row=>Number(row.ciclo)===cycle);
      return `<details class="history-cycle"${index===0?' open':''}><summary><span>Ciclo ${escape(cycle)}</span><small>${rows.length} decisiones · ${report?'Resultados registrados':'Sin resultados registrados'}</small></summary><div class="history-cycle-content"><h4>Decisiones tomadas</h4>${decisionsHtml(rows,report,catalog)}<h4>Resultados del ciclo</h4>${statements(report)}</div></details>`;
    }).join('')+'</div>';
    return html;
  }
  function snapshotHtml(snapshot,selectedId,catalog=[]){
    if(!snapshot)return `<div class="history-empty"><h3>${EMPTY}</h3><p>Cuando finalice una partida, podrás consultar aquí sus empresas, decisiones y resultados.</p></div>`;
    const game=snapshot.partida||{},companies=array(snapshot.empresas);
    const key=(company,index)=>String(company.id??company.participante_id??index);
    const selected=companies.find((company,index)=>key(company,index)===String(selectedId))||companies[0];
    let html=metrics([['Código de partida',game.codigo||'Sin código'],[game.fecha_aproximada?'Fecha de referencia · hora de Lima':'Finalizada · hora de Lima',date(game.finalizada_at)],['Ciclos jugados',number(game.ciclos_jugados)],['Empresas participantes',number(companies.length)]]);
    if(game.fecha_aproximada)html+='<p class="hint">Esta partida antigua no tiene una fecha de cierre registrada. Se muestra la fecha de creación como referencia.</p>';
    if(game.nombre||game.curso)html+=`<p class="hint">${escape([game.nombre,game.curso].filter(Boolean).join(' · '))}</p>`;
    if(!selected)return html+'<article class="card"><p class="hint">La partida finalizada no tiene empresas participantes registradas.</p></article>';
    html+=`<article class="card history-company-card"><label class="history-company-selector" for="historyCompanySelect">Empresa participante<select id="historyCompanySelect">${companies.map((company,index)=>`<option value="${escape(key(company,index))}"${company===selected?' selected':''}>${escape(company.nombre_comercial||company.nombre_legal||'Empresa sin nombre')}</option>`).join('')}</select></label>${companyHtml(selected,game.ciclos_jugados,catalog)}</article>`;
    return html;
  }
  function createController({mount,status,refresh,service,catalog=[]}){
    let snapshot=null,selectedId=null,generation=0;
    function render(){mount.innerHTML=snapshotHtml(snapshot,selectedId,catalog);}
    mount.addEventListener('change',event=>{if(event.target.id==='historyCompanySelect'){selectedId=event.target.value;render();mount.querySelector('#historyCompanySelect')?.focus();}});
    async function load(){
      const request=++generation;
      snapshot=null;selectedId=null;mount.innerHTML='';mount.setAttribute('aria-busy','true');
      status.textContent='Cargando la última partida finalizada…';if(refresh)refresh.disabled=true;
      try{
        const result=service?.obtenerUltima?await service.obtenerUltima():{success:false,unavailable:true};
        if(request!==generation)return;
        if(!result.success){
          status.textContent=result.unavailable?'El apartado Historial aún no está habilitado. Aplica el SQL de historial en Supabase y pulsa Actualizar.':result.offline?'Conecta Supabase para consultar la partida anterior.':'No se pudo consultar el historial. Revisa tu conexión o sesión y pulsa Actualizar.';
          return;
        }
        snapshot=result.data;status.textContent=snapshot?'Última partida finalizada · consulta de solo lectura.':' ';render();
      }catch{
        if(request===generation)status.textContent='No se pudo consultar el historial. Revisa tu conexión o sesión y pulsa Actualizar.';
      }finally{
        if(request===generation){mount.setAttribute('aria-busy','false');if(refresh)refresh.disabled=false;}
      }
    }
    refresh?.addEventListener('click',load);
    return Object.freeze({load});
  }
  return Object.freeze({EMPTY,decisionGroups,cycleNumbers,companyHtml,snapshotHtml,createController});
});
