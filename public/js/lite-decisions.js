(function (global) {
  'use strict';
  let dispose = null;
  const $ = id => document.getElementById(id);
  const number = n => new Intl.NumberFormat('es-PE', {maximumFractionDigits: 2}).format(Number(n) || 0);
  const money = n => 'S/ ' + number(n);
  const write = (id, value) => { const el = $(id); if (el) el.textContent = String(value); };
  function replaceButton(id, handler) {
    const old = $(id); if (!old) return null;
    const button = old.cloneNode(true); old.replaceWith(button); button.addEventListener('click', handler); return button;
  }
  function mount({ gameId, showScreen }) {
    if (!gameId || typeof showScreen !== 'function' || !global.SIDLiteGame) throw new Error('No se pudo abrir la partida.');
    dispose?.();
    $('decisionMenu')?.classList.add('lite-decision-mode');
    let active = true, data = null, draft = null, draftCycle = null, selected = 0, busy = false, deadline = null;
    let refreshing = false, touched = new Set(), editable = false, seenResultCycles = null, marketWheelStarted = false;
    const entries = [
      {key:'quality', label:'Calidad', icon:'insumos.svg', description:'Selecciona la calidad de los bolsos.'},
      {key:'quantity', label:'Cantidad', icon:'inversiones.svg', description:'Elige cuántos bolsos producir.'},
      {key:'price', label:'Precio', icon:'canales_ventas.svg', description:'Establece el precio de venta por bolso.'},
      {key:'marketingAmount', label:'Marketing', icon:'finanzas.svg', description:'Decide cuánto invertir en publicidad.'}
    ];
    const nav = $('decisionTabs'), cards = $('decisionCards');
    let bagViews = null;
    if (!nav || !cards) throw new Error('No está disponible el menú de decisiones.');
    nav.replaceChildren(); cards.replaceChildren();
    const controls = {};
    const context=document.createElement('aside'); context.className='lite-context';
    context.innerHTML='<section class="lite-summary"><h2>Resumen de tus decisiones</h2><div class="lite-summary-list"></div></section><section class="lite-impact" aria-live="polite"><h2>Impacto estimado</h2><div class="lite-impact-values"></div><div class="lite-cash-stack" aria-label="Distribución estimada de caja"><i></i><i></i><i></i></div><div class="lite-cash-legend"><span>Producción</span><span>Marketing</span><span>Caja restante</span></div><small>*Si se vende toda la producción. La validación final corresponde al servidor.</small></section><p class="lite-tip"></p>';
    cards.after(context);
    const formScroll=$('decisionFormScroll'), footer=formScroll.querySelector('.section-save-bar');
    const footerNext=footer.nextSibling; formScroll.after(footer);
    const summary=context.querySelector('.lite-summary-list');
    entries.forEach((entry,index)=>{const button=document.createElement('button');button.type='button';button.className='lite-summary-row';button.addEventListener('click',()=>select(index));summary.append(button);});
    const tips=['Una calidad mayor puede mejorar la demanda, pero también aumenta el costo.','Considera la caja disponible y evita producir más de lo que esperas vender.','Compara el precio con el costo: las ventas no están garantizadas.','La publicidad puede aumentar la demanda; reserva efectivo para producir.'];
    function select(index) {
      selected = index;
      nav.querySelectorAll('button').forEach((el,i) => {el.classList.toggle('active', i === index); el.setAttribute('aria-pressed',String(i === index));});
      cards.querySelectorAll('.decision-card').forEach((el,i) => {el.hidden = i !== index;});
      formScroll.scrollLeft=0; cards.scrollLeft=0; cards.querySelectorAll('.decision-card').forEach(el=>{el.scrollLeft=0;});
      bagViews?.sync();
      const entry = entries[index]; write('categoryTitle',entry.label); write('categoryDescription',entry.description);
      const icon=$('detailCategoryIcon'); if (icon) icon.src='assets/icons/categories/'+entry.icon; context.querySelector('.lite-tip').textContent='Consejo: '+tips[index]; if(data)updateEstimate();
    }
    for (const [index, entry] of entries.entries()) {
      const tab=document.createElement('button'); tab.type='button'; tab.className='decision-tab'; tab.dataset.cat=entry.key;
      const icon=document.createElement('img'); icon.alt=''; icon.src='assets/icons/categories/'+entry.icon;
      const label=document.createElement('span'); label.textContent=entry.label; tab.append(icon,label); tab.addEventListener('click',()=>select(index)); nav.append(tab);
      const card=document.createElement('div'); card.className='decision-card'; card.dataset.panel=entry.key;
      const heading=document.createElement('div');heading.className='lite-card-heading';heading.innerHTML=`<img src="assets/icons/categories/${entry.icon}" alt=""><div><h2>${entry.label}</h2><p>${entry.description}</p></div>`;card.append(heading);
      const field=document.createElement('label'); field.className='decision-field-label'; field.htmlFor='decision-'+entry.key;
      field.textContent=entry.key==='quality'?'Elige una calidad':entry.key==='quantity'?'Bolsos a producir':entry.key==='price'?'Precio por bolso':'Inversión en publicidad';
      const input=document.createElement('input'); input.id='decision-'+entry.key; input.name=entry.key;
      input.type=entry.key==='quality'?'hidden':'number';
      if(entry.key!=='quality') {input.step='1';input.min=entry.key==='price'?'1':'0';input.max=entry.key==='marketingAmount'?'10000':'100000';}
      const change=()=>{if(!draft)return;draft[entry.key]=input.value;touched.add(entry.key);updateEstimate();};
      input.addEventListener('input',change); controls[entry.key]=input; card.append(field);
      if(entry.key==='quality') {
        const group=document.createElement('div');group.className='quality-options';group.setAttribute('role','radiogroup');group.setAttribute('aria-label','Calidad de los bolsos');
        for(const [value,name,icon,description] of [['basic','Básica','◇','Menor costo de producción.'],['standard','Media','✦','Equilibrio entre costo y calidad.'],['premium','Premium','✧','Mayor calidad y reputación.']]) {
          const option=document.createElement('button');option.type='button';option.className='quality-option';option.setAttribute('role','radio');option.dataset.value=value;
          const symbol=document.createElement('span');symbol.className='bag-stage no-webgl';symbol.dataset.bag=({basic:'basica',standard:'media',premium:'premium'})[value];symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<canvas></canvas><span class="bag-fallback">▱</span>';
          const label=document.createElement('strong');label.textContent=name;
          const cost=document.createElement('span');cost.className='quality-cost';cost.dataset.qualityCost=value;
          const detail=document.createElement('small');detail.textContent=description;
          const badge=document.createElement('span');badge.className='quality-selected';badge.textContent='✓ Seleccionada';
          const levels={basic:[1,1,1],standard:[2,2,2],premium:[3,3,3]}[value];const attrs=document.createElement('div');attrs.className='quality-attributes';attrs.innerHTML=['Costo','Demanda','Reputación'].map((name,i)=>`<div><span>${name}</span><span class="quality-dots" aria-label="${levels[i]} de 3">${[1,2,3].map(n=>`<i class="${n<=levels[i]?'on':''}"></i>`).join('')}</span></div>`).join('');
          option.append(badge,symbol,label,cost,detail,attrs);option.addEventListener('click',()=>{input.value=value;change();bagViews?.spin(value);});
          option.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const options=[...group.querySelectorAll('button')];const delta=['ArrowRight','ArrowDown'].includes(event.key)?1:-1;const next=options[(options.indexOf(option)+delta+options.length)%options.length];next.focus();next.click();});group.append(option);
        }
        card.append(input,group); const comparison=document.createElement('div');comparison.className='quality-comparison';comparison.innerHTML='<strong>Costo total con tu cantidad actual</strong><div></div>';card.append(comparison);
      } else {
        const row=document.createElement('div');row.className='decision-number-row';
        const step=entry.key==='quantity'?10:entry.key==='price'?1:100;
        const button=(text,fn)=>{const el=document.createElement('button');el.type='button';el.textContent=text;el.addEventListener('click',fn);return el;};
        const adjust=delta=>{input.value=String(Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value||0)+delta)));change();};
        const minus=button('−',()=>adjust(-step));minus.setAttribute('aria-label','Reducir '+entry.label.toLowerCase());
        const plus=button('+',()=>adjust(step));plus.setAttribute('aria-label','Aumentar '+entry.label.toLowerCase());
        row.append(minus);
        if(entry.key!=='quantity'){const prefix=document.createElement('span');prefix.className='decision-prefix';prefix.textContent='S/';row.append(prefix);}
        row.append(input,plus);card.append(row);
        if(entry.key!=='price'){
          const range=document.createElement('input');range.type='range';range.className='decision-range';range.min='0';range.max=entry.key==='quantity'?'100000':'10000';range.step=entry.key==='quantity'?'1':'100';range.setAttribute('aria-label',entry.key==='quantity'?'Ajustar cantidad':'Ajustar inversión en marketing');
          range.addEventListener('input',()=>{input.value=range.value;change();});card.append(range);
          const shortcuts=document.createElement('div');shortcuts.className='decision-shortcuts';
          const values=entry.key==='quantity'?[['+10',10],['+50',50],['+100',100],['Máx.',null]]:[[money(0),0],[money(500),500],[money(1000),1000],[money(2500),2500]];
          for(const [text,value] of values) shortcuts.append(button(text,()=>{input.value=String(entry.key==='quantity'?Math.min(Number(range.max),value===null?Number(range.max):Number(input.value||0)+value):value);change();}));
          const marks=document.createElement('div');marks.className='lite-range-marks'; marks.dataset.marks=entry.key;card.append(marks,shortcuts);
          const bar=document.createElement('div');bar.className='lite-measure';bar.dataset.measure=entry.key;card.append(bar);
        }
        if(entry.key==='price'){const shortcuts=document.createElement('div');shortcuts.className='decision-shortcuts';[20,50,100].forEach(percent=>shortcuts.append(button('Costo +'+percent+'%',()=>{const factor={cost_discount:.9,cost_freight:1.1,cost_offer:.95,cost_shortage:1.15}[data?.cycles?.at(-1)?.event_id]||1;const unit=Math.round(Number(data?.game?.costs?.[draft.quality]||0)*factor);input.value=String(Math.round(unit*(1+percent/100)));change();})));card.append(shortcuts);const measure=document.createElement('div');measure.className='lite-measure';measure.dataset.measure='price';card.append(measure);}
        if(entry.key==='marketingAmount'){const hint=document.createElement('p');hint.className='lite-fixed-hint';hint.textContent='0 o entre '+money(200)+' y '+money(10000);row.after(hint);}
        const kpis=document.createElement('div');kpis.className='lite-control-kpis';kpis.dataset.kpis=entry.key;card.append(kpis);
        const feedback=document.createElement('p');feedback.className='decision-feedback';feedback.dataset.feedback=entry.key;feedback.setAttribute('aria-live','polite');card.append(feedback);
      }
      cards.append(card);
    }
    bagViews=global.SIDELiteBagViews?.create($('decisionMenu'), cards);
    const status=document.createElement('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); cards.after(status);
    let statusTimer; const showStatus = message => { status.textContent=message; write('studentConnectionStatus', message); global.clearTimeout(statusTimer); statusTimer=global.setTimeout(()=>{status.textContent='';},5000); };
    const save=replaceButton('saveDecisionSection',()=>submit(false));
    const send=replaceButton('sendDecisionSection',()=>submit(true));
    const top=replaceButton('topSubmitAllDecisions',()=>submit(true));
    if(save){save.querySelector('span').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l3 3v15H4V3h1zm3 0v6h8V3M8 21v-8h8v8"/></svg>';save.querySelector('small').textContent='Guarda la sección; puedes editar';}
    if(send){send.querySelector('span').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 21 3l-6.5 18-3-7-8.5-2.5zm8.5 2.5L21 3"/></svg>';send.querySelector('small').textContent='Confirma; no editable en este ciclo';}
    replaceButton('exitDecisions',()=>showScreen('studentLobby'));
    const enter=replaceButton('enterDecisionsBtn',()=>{showScreen('decisionMenu');select(selected);});
    const results=$('studentFinancialDetail');
    const retry=document.createElement('button');retry.type='button';retry.className='ghost-btn hidden';retry.textContent='Reintentar actualización';retry.addEventListener('click',()=>void refresh());$('studentConnectionStatus')?.after(retry);
    function refreshResults() { if (results && data) global.SIDELiteResults.render(results, data); }
    function updateEstimate() {
      if (!draft || !data) return;
      const quality=String(draft.quality), qty=Number(draft.quantity), price=Number(draft.price), marketing=Number(draft.marketingAmount);
      const fieldsValid=['quantity','price','marketingAmount'].every(key=>String(draft[key]).trim()!=='')&&Number.isInteger(qty)&&qty>=0&&qty<=100000&&Number.isInteger(price)&&price>=1&&price<=100000&&Number.isInteger(marketing)&&(marketing===0||(marketing>=200&&marketing<=10000));
      const factor={cost_discount:.9,cost_freight:1.1,cost_offer:.95,cost_shortage:1.15}[data.cycles?.at(-1)?.event_id] || 1;
      const unitCost=key=>Math.round(Number(data.game.costs?.[key] || 0)*factor);
      const cash=Number(data.company?.cash || 0), unit=unitCost(quality), cost=unit*qty+marketing;
      const valid=fieldsValid && Number.isFinite(cost) && cost<=cash;
      const invalid={quantity:String(draft.quantity).trim()===''||!Number.isInteger(qty)||qty<0||qty>100000,price:String(draft.price).trim()===''||!Number.isInteger(price)||price<1||price>100000,marketingAmount:String(draft.marketingAmount).trim()===''||!Number.isInteger(marketing)||(marketing!==0&&(marketing<200||marketing>10000))};
      for(const key of Object.keys(invalid)){controls[key].setAttribute('aria-invalid',String(invalid[key]));controls[key].setAttribute('aria-describedby','decision-error-'+key);const feedback=cards.querySelector('[data-feedback="'+key+'"]');if(feedback){feedback.id='decision-error-'+key;feedback.classList.toggle('is-error',invalid[key]);}}
      const labels={basic:'Básica',standard:'Media',premium:'Premium'};
      const values=[labels[quality],`${number(qty)} bolsos`,money(price),money(marketing)];
      const state=data.ownDecision?.confirmed?'Enviada':data.ownDecision?'Borrador':'Pendiente';
      summary.querySelectorAll('button').forEach((button,i)=>{button.replaceChildren(); const name=document.createElement('span'); name.textContent=`${entries[i].label}: ${values[i]}`; const chip=document.createElement('small'); chip.className='lite-state-chip'; chip.textContent=state; button.append(name,chip);});
      context.querySelector('.lite-impact-values').innerHTML=`<div><span>Inversión total</span><strong>${money(cost)}</strong></div><div><span>Caja restante</span><strong>${money(cash-cost)}</strong></div><div><span>Ingreso potencial máximo</span><strong>${money(qty*price)}</strong></div><div><span>Margen estimado*</span><strong>${money(qty*price-cost)}</strong></div>`;
      const completed=data.ownDecision?4:touched.size, progress=completed*25;
      write('decisionProgressText',progress+'%'); write('decisionProgressHint',`${completed}/4 revisadas`);
      const progressBar=$('decisionProgressBar'); if(progressBar)progressBar.style.width=progress+'%';
      nav.querySelectorAll('button').forEach((button,i)=>{button.dataset.state=data.ownDecision?.confirmed?'enviada':data.ownDecision?'borrador':touched.has(entries[i].key)?'borrador':'pendiente';button.setAttribute('aria-label',`${entries[i].label}: ${button.dataset.state}`);});
      for(const button of [save,send,top]) if(button)button.disabled=!editable || busy || !valid;
      const maxQty=unit>0?Math.max(0,Math.min(100000,Math.floor((cash-Math.max(0,marketing || 0))/unit))):100000;
      cards.querySelectorAll('.quality-option').forEach(option=>{const checked=option.dataset.value===quality;option.setAttribute('aria-checked',String(checked));option.classList.toggle('is-selected',checked);option.tabIndex=checked?0:-1;});
      cards.querySelectorAll('[data-quality-cost]').forEach(el=>{el.textContent=money(unitCost(el.dataset.qualityCost))+' / bolso';});
      const quantityRange=controls.quantity.closest('.decision-card')?.querySelector('.decision-range');
      if(quantityRange){quantityRange.max=String(maxQty);quantityRange.value=String(Math.min(maxQty,Math.max(0,qty || 0)));}
      const marketingRange=controls.marketingAmount.closest('.decision-card')?.querySelector('.decision-range');
      if(marketingRange){marketingRange.max=String(Math.max(0,Math.min(10000,Math.floor(cash-unit*Math.max(0,qty||0)))));marketingRange.value=String(Math.min(Number(marketingRange.max),Math.max(0,marketing||0)));}
      const comparison=cards.querySelector('.quality-comparison div');
      if(comparison) comparison.innerHTML=qty>0?['basic','standard','premium'].map(key=>`<span>${labels[key]} <strong>${money(unitCost(key)*qty)}</strong></span>`).join(''):'<span>Define la cantidad para comparar</span>';
      const percent=(part,total)=>total>0?Math.max(0,Math.min(100,part/total*100)):0;
      const quantityMarks=cards.querySelector('[data-marks="quantity"]');if(quantityMarks)quantityMarks.innerHTML=[25,50,75,100].map(n=>`<span>${n} %</span>`).join('');
      const marketingMarks=cards.querySelector('[data-marks="marketingAmount"]');if(marketingMarks)marketingMarks.innerHTML=`<span>${money(200)}</span><span>${money(10000)}</span>`;
      const measure=(key,title,value,label)=>{const el=cards.querySelector(`[data-measure="${key}"]`);if(el)el.innerHTML=`<div><span>${title}</span><strong>${label}</strong></div><div class="lite-meter"><i style="width:${value}%"></i></div>`;};
      measure('quantity','Producción vs. caja disponible',percent(qty,maxQty),`Máximo: ${number(maxQty)} bolsos`);
      measure('marketingAmount','% de la caja',percent(marketing,cash),`${number(cash>0?marketing/cash*100:0)} %`);
      const priceMeasure=cards.querySelector('[data-measure="price"]');if(priceMeasure)priceMeasure.innerHTML=`<div><span>Bajo</span><span>Competitivo</span><span>Alto</span></div><div class="lite-price-zones"><i></i><i></i><i></i><b style="left:${percent(price,unit*2)}%" aria-label="Precio ${price<unit?'bajo':price<unit*1.5?'competitivo':'alto'}"></b></div>`;
      const kpis=(key,items)=>{const el=cards.querySelector(`[data-kpis="${key}"]`);if(el)el.innerHTML=items.map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');};
      kpis('quantity',[['Costo unitario',money(unit)],['Cantidad',number(qty)],['Costo total',money(unit*qty)]]);
      kpis('price',[['Margen por bolso',money(price-unit)],['Margen',`${number(price?((price-unit)/price)*100:0)} %`],['Ingreso potencial',money(price*qty)]]);
      kpis('marketingAmount',[['% de la caja',`${number(cash?marketing/cash*100:0)} %`],['Caja restante',money(cash-marketing)]]);
      const parts=[unit*Math.max(0,qty||0),Math.max(0,marketing||0),Math.max(0,cash-cost)];context.querySelectorAll('.lite-cash-stack i').forEach((el,i)=>{el.style.width=percent(parts[i],cash)+'%';});
      const feedback=(key,text)=>{const el=cards.querySelector('[data-feedback="'+key+'"]');if(el)el.textContent=text;};
      feedback('quantity',invalid.quantity?`Ingresa una cantidad entera entre 0 y ${number(100000)}.`:`Producción: ${money(unit*qty)} · Máximo con caja disponible: ${number(maxQty)} bolsos.`);
      feedback('price',invalid.price?`Ingresa un precio entero entre ${money(1)} y ${money(100000)}.`:`Margen por bolso: ${money(price-unit)} · ${price<unit?'Por debajo del costo':price<unit*1.5?'Precio moderado':'Precio alto'} respecto al costo unitario.`);
      feedback('marketingAmount',invalid.marketingAmount?`Ingresa ${money(0)} o un monto entero entre ${money(200)} y ${money(10000)}.`:`${number(cash>0?(marketing/cash)*100:0)} % de la caja disponible.`);
      cards.querySelectorAll('.decision-card').forEach(card=>card.querySelectorAll('button, input').forEach(el=>{el.disabled=controls[card.querySelector('[name]')?.name]?.disabled ?? false;}));
      write('sectionDraftCost',Number.isFinite(cost)?money(selected===1?unit*qty:selected===3?marketing:0):'—');
      $('sectionSaveHint')?.setAttribute('aria-live','polite');
      write('sectionSaveHint',!fieldsValid?`Revisa los campos; marketing debe ser ${money(0)} o entre ${money(200)} y ${money(10000)}.`:cost>cash?'La inversión supera la caja disponible.':'La validación final la hace el servidor.');
    }
    function updateClock() {
      const cycle=data?.cycles?.at(-1); if (!cycle) {write('studentRoundTimer','--:--');write('decisionRoundTimer','--:--');return;}
      const seconds=cycle.paused_at?Math.max(0,Math.ceil((Date.parse(cycle.ends_at)-Date.parse(cycle.paused_at))/1000)) : deadline===null?0:Math.max(0,Math.ceil((deadline-performance.now())/1000));
      const text=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      write('studentRoundTimer',text);write('decisionRoundTimer',text); const timer=$('decisionRoundTimer'); if(timer){timer.classList.toggle('is-warning',seconds<120 && seconds>=30);timer.classList.toggle('is-critical',seconds<30);}
      if ((cycle.close_requested_at || seconds===0) && cycle.status==='open' && !cycle.paused_at) {if(enter)enter.disabled=true;if(save)save.disabled=true;if(send)send.disabled=true;if(top)top.disabled=true;const delay=cycle.close_requested_at?Date.now()-Date.parse(cycle.close_requested_at):performance.now()-deadline;const slow=Number.isFinite(delay)&&delay>30000;write('studentTimerNote',slow?'El cierre está demorando. Puedes reintentar; si continúa, avisa al docente.':'Procesando resultados oficiales');if(slow)retry.classList.remove('hidden');}
    }
    function render(next, started) {
      data=next; const game=data.game, company=data.company, cycle=data.cycles?.at(-1), own=data.ownDecision;
      if (!company) throw new Error('No hay una empresa asociada a esta sesión.');
      if (!marketWheelStarted && cycle && company.district_id && global.SideRuleta && !$('studentLobby')?.classList.contains('hidden')) {
        marketWheelStarted=true;
        void global.SideRuleta.playOnce({partidaId:gameId,companyId:company.id,marketId:company.district_id});
      }
      const ownResults=(data.results||[]).filter(row=>row.company_id===company.id).slice().sort((a,b)=>Number(a.number)-Number(b.number));
      const resultCycles=new Set(ownResults.map(row=>String(row.cycle_id || row.number)));
      const justClosed=seenResultCycles && [...resultCycles].some(id=>!seenResultCycles.has(id));
      seenResultCycles=resultCycles;
      if(justClosed && !$('decisionMenu')?.classList.contains('hidden'))showScreen('studentLobby');
      if (draftCycle !== (cycle?.id || null)) {
        draftCycle=cycle?.id || null; touched=new Set(); draft={quality:own?.quality || 'basic',quantity:own?.quantity ?? 0,price:own?.price ?? 100,marketingAmount:own?.marketing_amount ?? 0};
        for(const [key,input] of Object.entries(controls)) input.value=draft[key];
      }
      deadline=cycle && cycle.status==='open' && !cycle.paused_at ? started+Math.max(0,Date.parse(cycle.ends_at)-Date.parse(cycle.server_now)) : null;
      const open=!!cycle && cycle.status==='open' && !cycle.paused_at && !cycle.close_requested_at && !own?.confirmed && deadline>performance.now();
      editable=open;
      write('lobbyCode',game.code);write('lobbyGameName',game.name);write('lobbyStudent',company.name);write('lobbySegment',cycle && company.district_name ? 'Mercado: '+company.district_name : company.store || 'Empresa');
      write('studentCycleLabel',cycle?`Ciclo ${cycle.number} de ${game.cycle_count}`:'Esperando inicio');
      write('roundLabel',cycle?`CICLO ${cycle.number} · ${company.name}`:company.name);write('cashMovement',`Capital inicial: ${money(company.initial_capital)}`);write('cashBalance',money(company.cash));write('studentCashResult',money(company.cash));
      write('studentTimerNote',cycle?.paused_at?'Ciclo pausado':cycle?.close_requested_at?'Procesando resultados':cycle?.status==='closed'?'Ciclo cerrado':cycle?'Ciclo en curso':'Esperando inicio del docente');
      write('studentConnectionStatus',own?.confirmed?'Decisión confirmada.':open?'Puedes tomar tus decisiones.':'Espera la apertura del ciclo o los resultados.');
      if(enter){enter.classList.remove('hidden');enter.disabled=!open;}
      for(const button of [save,send,top]) if(button) button.disabled=!open || busy;
      for(const input of Object.values(controls)) input.disabled=!open || busy;
      const last=ownResults.at(-1)?.result;
      const flow=last ? Number(last.cashEnd)-Number(last.cashStart) : null;
      write('studentIncomeResult',last?money(last.profit):'—');write('studentFlowResult',last?money(flow):'—');
      for (const [id,value] of Object.entries({studentBCInicial:last?.cashStart,studentBCEntradas:last?.revenue,
        studentBCSalidas:last ? Number(last.purchase)+Number(last.marketing) : null,studentBCFinal:last?.cashEnd,
        studentFCOperacion:flow,studentFCInversion:last ? 0 : null,studentFCFinanciamiento:last ? 0 : null,studentFCNeto:flow}))
        write(id,value == null ? '—' : money(value));
      const statement=$('studentIncomeStatement');
      if(statement){statement.replaceChildren();const heading=document.createElement('strong');heading.textContent='ESTADO DE RESULTADOS';statement.append(heading);
        const line=document.createElement('span');line.textContent=last ? `Ingresos ${money(last.revenue)} · costo de ventas ${money(last.costOfSales)} · marketing ${money(last.marketing)} · utilidad ${money(last.profit)}` : 'Aún no hay resultados oficiales.';statement.append(line);}
      if (cycle?.status === 'open' && cycle.event_id && global.SideEventFlash) {
        const news = global.SIDELiteEvents.describe(cycle.event_id);
        global.SideEventFlash.show({partida:gameId, ciclo:cycle.id || cycle.number, id:cycle.event_id,
          titulo:news.name === 'Evento no disponible' ? 'Noticia del mercado' : news.name,
          texto:news.description+' '+news.effect, tono:news.classification.toLowerCase(),
          host:() => !$('decisionMenu')?.classList.contains('hidden') ? $('decisionFormScroll') : $('studentLobby')?.querySelector('.lobby-content')});
      }
      write('studentNewsList',global.SIDELiteEvents.text(cycle?.event_id));
      write('studentEventImpactText',last ? global.SIDELiteEvents.text(last.event || data.cycles?.find(c=>c.id===ownResults.at(-1)?.cycle_id)?.event_id,last) : 'Los resultados oficiales se muestran después del cierre del ciclo.');
      const history=$('studentCycleHistory'); if(history)history.replaceChildren();
      refreshResults();updateEstimate();updateClock();
    }
    async function refresh() {
      if (!active || refreshing) return;
      refreshing=true; const started=performance.now();let timeout;
      try { const next=await Promise.race([global.SIDLiteGame.getGame(gameId),new Promise((_,reject)=>{timeout=global.setTimeout(()=>reject(new Error('Tiempo de espera agotado')),12000);})]); if(active){render(next,started);retry.classList.add('hidden');} }
      catch(error) { if(active){write('studentConnectionStatus','No se pudo actualizar la partida. Comprueba tu conexión y vuelve a intentarlo.');if(!data && results)results.textContent='No se pudieron cargar los resultados. Comprueba tu conexión y vuelve a intentarlo.';retry.classList.remove('hidden');} }
      finally { global.clearTimeout(timeout);refreshing=false; }
    }
    async function submit(confirmed) {
      if (!data || busy) return;
      const payload={quality:String(draft.quality),quantity:Number(draft.quantity),price:Number(draft.price),marketingAmount:Number(draft.marketingAmount),confirmed};
      if (['quantity','price','marketingAmount'].some(key=>String(draft[key]).trim()==='')||!['basic','standard','premium'].includes(payload.quality)||!Number.isInteger(payload.quantity)||payload.quantity<0||payload.quantity>100000||!Number.isInteger(payload.price)||payload.price<1||payload.price>100000||!Number.isInteger(payload.marketingAmount)||(payload.marketingAmount!==0&&(payload.marketingAmount<200||payload.marketingAmount>10000))) {showStatus('Revisa los cuatro valores antes de enviar.');return;}
      const factor={cost_discount:.9,cost_freight:1.1,cost_offer:.95,cost_shortage:1.15}[data.cycles?.at(-1)?.event_id] || 1;
      if(Math.round(Number(data.game.costs?.[payload.quality] || 0)*factor)*payload.quantity+payload.marketingAmount>Number(data.company.cash)){showStatus('La inversión supera la caja disponible.');return;}
      if(deadline===null || performance.now()>=deadline) {showStatus('El ciclo no está recibiendo decisiones.');await refresh();return;}
      busy=true; showStatus(confirmed?'Enviando decisión…':'Guardando borrador…'); for(const button of [save,send,top]) if(button)button.disabled=true;
      try { await global.SIDLiteGame.request('/games/'+encodeURIComponent(gameId)+'/decision','PUT',payload); showStatus(confirmed?'Decisión confirmada.':'Borrador guardado.'); await refresh(); }
      catch(error) {showStatus(error.message || 'No se pudo guardar la decisión.');}
      finally {busy=false; void refresh();}
    }
    select(0); showScreen('studentLobby');
    const poll=global.setInterval(refresh,5000), clock=global.setInterval(updateClock,250);
    const back=$('backToProfiles'); const onBack=()=>dispose?.(); back?.addEventListener('click',onBack);
dispose=()=>{bagViews?.dispose();active=false;global.clearTimeout(statusTimer);global.clearInterval(poll);global.clearInterval(clock);back?.removeEventListener('click',onBack);status.remove();retry.remove();context.remove();formScroll.insertBefore(footer,footerNext);$('decisionMenu')?.classList.remove('lite-decision-mode');};
    void refresh();
    return {refresh, dispose};
  }
  global.SIDELiteDecisions={mount};
})(window);
