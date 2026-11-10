(function (global) {
  'use strict';
  let dispose = null;
  const $ = id => document.getElementById(id);
  const money = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', {maximumFractionDigits: 2});
  const write = (id, value) => { const el = $(id); if (el) el.textContent = String(value); };
  function replaceButton(id, handler) {
    const old = $(id); if (!old) return null;
    const button = old.cloneNode(true); old.replaceWith(button); button.addEventListener('click', handler); return button;
  }
  function mount({ gameId, showScreen }) {
    if (!gameId || typeof showScreen !== 'function' || !global.SIDLiteGame) throw new Error('No se pudo abrir la partida.');
    dispose?.();
    let active = true, data = null, draft = null, draftCycle = null, selected = 0, busy = false, deadline = null;
    let refreshing = false;
    const entries = [
      {key:'quality', label:'Calidad', icon:'insumos.svg', description:'Selecciona la calidad de los bolsos.'},
      {key:'quantity', label:'Cantidad', icon:'inversiones.svg', description:'Elige cuántos bolsos producir.'},
      {key:'price', label:'Precio', icon:'canales_ventas.svg', description:'Establece el precio de venta por bolso.'},
      {key:'marketingAmount', label:'Marketing', icon:'finanzas.svg', description:'Decide cuánto invertir en publicidad.'}
    ];
    const nav = $('decisionTabs'), cards = $('decisionCards');
    if (!nav || !cards) throw new Error('No está disponible el menú de decisiones.');
    nav.replaceChildren(); cards.replaceChildren();
    const controls = {};
    function select(index) {
      selected = index;
      nav.querySelectorAll('button').forEach((el,i) => {el.classList.toggle('active', i === index); el.setAttribute('aria-pressed',String(i === index));});
      cards.querySelectorAll('.decision-card').forEach((el,i) => {el.hidden = i !== index;});
      const entry = entries[index]; write('categoryTitle',entry.label); write('categoryDescription',entry.description);
      const icon=$('detailCategoryIcon'); if (icon) icon.src='assets/icons/categories/'+entry.icon;
    }
    for (const [index, entry] of entries.entries()) {
      const tab=document.createElement('button'); tab.type='button'; tab.className='decision-tab';
      const icon=document.createElement('img'); icon.alt=''; icon.src='assets/icons/categories/'+entry.icon;
      const label=document.createElement('span'); label.textContent=entry.label; tab.append(icon,label); tab.addEventListener('click',()=>select(index)); nav.append(tab);
      const card=document.createElement('div'); card.className='decision-card';
      const title=document.createElement('h3'); title.textContent=entry.label;
      const description=document.createElement('p'); description.textContent=entry.description;
      const field=document.createElement('label'); field.textContent=entry.label;
      const input=document.createElement(entry.key==='quality'?'select':'input'); input.name=entry.key; input.setAttribute('aria-label',entry.label);
      if (entry.key==='quality') {
        for (const [value,text] of [['basic','Básica'],['standard','Estándar'],['premium','Prémium']]) {const option=document.createElement('option'); option.value=value; option.textContent=text; input.append(option);}
      } else { input.type='number'; input.step='1'; input.min=entry.key==='price'?'1':'0'; input.max=entry.key==='marketingAmount'?'10000':'100000'; }
      input.addEventListener('input',()=>{if(!draft)return; draft[entry.key]=entry.key==='quality'?input.value:input.value; updateEstimate();});
      controls[entry.key]=input; field.append(input); card.append(title,description,field); cards.append(card);
    }
    const status=document.createElement('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite'); cards.after(status);
    const showStatus = message => { status.textContent=message; write('studentConnectionStatus', message); };
    const save=replaceButton('saveDecisionSection',()=>submit(false));
    const send=replaceButton('sendDecisionSection',()=>submit(true));
    const top=replaceButton('topSubmitAllDecisions',()=>submit(true));
    replaceButton('exitDecisions',()=>showScreen('studentLobby'));
    const enter=replaceButton('enterDecisionsBtn',()=>{showScreen('decisionMenu');select(selected);});
    const results=$('studentFinancialDetail');
    function refreshResults() {
      if (!results || !data) return;
      results.replaceChildren();
      const title=document.createElement('h3'); title.textContent='Clasificación'; results.append(title);
      const list=document.createElement('ol');
      for(const row of data.ranking || []) { const li=document.createElement('li'); li.textContent=`${row.name} · ${Number(row.returnPercent || 0).toFixed(1)} %`; list.append(li); }
      results.append(list);
      const heading=document.createElement('h3'); heading.textContent='Resultados por ciclo'; results.append(heading);
      if (!data.results?.length) { const p=document.createElement('p');p.textContent='Aún no hay resultados.';results.append(p); }
      for(const row of data.results || []) {
        const v=row.result || {}, p=document.createElement('p');
        p.textContent=`Ciclo ${row.number}: ${Number(v.sold||0)} bolsos vendidos · ingresos ${money(v.revenue)} · utilidad ${money(v.profit)} · caja ${money(v.cashEnd)}`;
        results.append(p);
      }
    }
    function updateEstimate() {
      if (!draft || !data) return;
      const quality=String(draft.quality), qty=Number(draft.quantity), price=Number(draft.price), marketing=Number(draft.marketingAmount);
      const valid=['quantity','price','marketingAmount'].every(key=>String(draft[key]).trim()!=='')&&Number.isInteger(qty)&&qty>=0&&qty<=100000&&Number.isInteger(price)&&price>=1&&price<=100000&&Number.isInteger(marketing)&&(marketing===0||(marketing>=200&&marketing<=10000));
      const cost=Number(data.game.costs?.[quality] || 0)*qty+marketing;
      write('sectionDraftCost',Number.isFinite(cost)?money(cost):'—');
      write('sectionSaveHint',!valid?'Revisa los campos; marketing debe ser S/ 0 o entre S/ 200 y S/ 10.000.':`Inversión estimada: ${money(cost)}. La validación final corresponde al servidor.`);
    }
    function updateClock() {
      const cycle=data?.cycles?.at(-1); if (!cycle) {write('studentRoundTimer','--:--');write('decisionRoundTimer','--:--');return;}
      const seconds=cycle.paused_at?Math.max(0,Math.ceil((Date.parse(cycle.ends_at)-Date.parse(cycle.paused_at))/1000)) : deadline===null?0:Math.max(0,Math.ceil((deadline-performance.now())/1000));
      const text=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
      write('studentRoundTimer',text);write('decisionRoundTimer',text);
      if (seconds===0 && cycle.status==='open' && !cycle.paused_at) {if(enter)enter.disabled=true;if(save)save.disabled=true;if(send)send.disabled=true;if(top)top.disabled=true;write('studentTimerNote','Procesando resultados oficiales');}
    }
    function render(next, started) {
      data=next; const game=data.game, company=data.company, cycle=data.cycles?.at(-1), own=data.ownDecision;
      if (!company) throw new Error('No hay una empresa asociada a esta sesión.');
      if (draftCycle !== (cycle?.id || null)) {
        draftCycle=cycle?.id || null; draft={quality:own?.quality || 'basic',quantity:own?.quantity ?? 0,price:own?.price ?? 100,marketingAmount:own?.marketing_amount ?? 0};
        for(const [key,input] of Object.entries(controls)) input.value=draft[key];
      }
      deadline=cycle && cycle.status==='open' && !cycle.paused_at ? started+Math.max(0,Date.parse(cycle.ends_at)-Date.parse(cycle.server_now)) : null;
      const open=!!cycle && cycle.status==='open' && !cycle.paused_at && !cycle.close_requested_at && !own?.confirmed && deadline>performance.now();
      write('lobbyCode',game.code);write('lobbyGameName',game.name);write('lobbyStudent',company.name);write('lobbySegment',company.store || 'Empresa');
      write('studentCycleLabel',cycle?`Ciclo ${cycle.number} de ${game.cycle_count}`:'Esperando inicio');
      write('roundLabel',cycle?`CICLO ${cycle.number} · ${company.name}`:company.name);write('cashBalance',money(company.cash));write('studentCashResult',money(company.cash));
      write('studentTimerNote',cycle?.paused_at?'Ciclo pausado':cycle?.close_requested_at?'Procesando resultados':cycle?.status==='closed'?'Ciclo cerrado':cycle?'Ciclo en curso':'Esperando inicio del docente');
      write('studentConnectionStatus',own?.confirmed?'Decisión confirmada.':open?'Puedes tomar tus decisiones.':'Espera la apertura del ciclo o los resultados.');
      if(enter){enter.classList.remove('hidden');enter.disabled=!open;}
      for(const button of [save,send,top]) if(button) button.disabled=!open || busy;
      for(const input of Object.values(controls)) input.disabled=!open || busy;
      const last=data.results?.at(-1)?.result;
      const flow=last ? Number(last.cashEnd)-Number(last.cashStart) : null;
      write('studentIncomeResult',last?money(last.profit):'—');write('studentFlowResult',last?money(flow):'—');
      for (const [id,value] of Object.entries({studentBCInicial:last?.cashStart,studentBCEntradas:last?.revenue,
        studentBCSalidas:last ? Number(last.purchase)+Number(last.marketing) : null,studentBCFinal:last?.cashEnd,
        studentFCOperacion:flow,studentFCInversion:last ? 0 : null,studentFCFinanciamiento:last ? 0 : null,studentFCNeto:flow}))
        write(id,value == null ? '—' : money(value));
      const statement=$('studentIncomeStatement');
      if(statement){statement.replaceChildren();const heading=document.createElement('strong');heading.textContent='ESTADO DE RESULTADOS';statement.append(heading);
        const line=document.createElement('span');line.textContent=last ? `Ingresos ${money(last.revenue)} · costo de ventas ${money(last.costOfSales)} · marketing ${money(last.marketing)} · utilidad ${money(last.profit)}` : 'Aún no hay resultados oficiales.';statement.append(line);}
      write('studentNewsList',cycle?.event_id ? `Evento activo: ${cycle.event_id}` : 'Sin evento activo.');
      write('studentEventImpactText','Los resultados oficiales se muestran después del cierre del ciclo.');
      const history=$('studentCycleHistory'); if(history)history.replaceChildren();
      refreshResults();updateEstimate();updateClock();
    }
    async function refresh() {
      if (!active || refreshing) return;
      refreshing=true; const started=performance.now();
      try { const next=await global.SIDLiteGame.getGame(gameId); if(active)render(next,started); }
      catch(error) { if(active)showStatus(error.message || 'No se pudo consultar la partida.'); }
      finally { refreshing=false; }
    }
    async function submit(confirmed) {
      if (!data || busy) return;
      const payload={quality:String(draft.quality),quantity:Number(draft.quantity),price:Number(draft.price),marketingAmount:Number(draft.marketingAmount),confirmed};
      if (['quantity','price','marketingAmount'].some(key=>String(draft[key]).trim()==='')||!['basic','standard','premium'].includes(payload.quality)||!Number.isInteger(payload.quantity)||payload.quantity<0||payload.quantity>100000||!Number.isInteger(payload.price)||payload.price<1||payload.price>100000||!Number.isInteger(payload.marketingAmount)||(payload.marketingAmount!==0&&(payload.marketingAmount<200||payload.marketingAmount>10000))) {showStatus('Revisa los cuatro valores antes de enviar.');return;}
      if(deadline===null || performance.now()>=deadline) {showStatus('El ciclo no está recibiendo decisiones.');await refresh();return;}
      busy=true; for(const button of [save,send,top]) if(button)button.disabled=true;
      try { await global.SIDLiteGame.request('/games/'+encodeURIComponent(gameId)+'/decision','PUT',payload); showStatus(confirmed?'Decisión confirmada.':'Borrador guardado.'); await refresh(); }
      catch(error) {showStatus(error.message || 'No se pudo guardar la decisión.');}
      finally {busy=false; void refresh();}
    }
    select(0); showScreen('studentLobby');
    const poll=global.setInterval(refresh,5000), clock=global.setInterval(updateClock,250);
    const back=$('backToProfiles'); const onBack=()=>dispose?.(); back?.addEventListener('click',onBack);
dispose=()=>{active=false;global.clearInterval(poll);global.clearInterval(clock);back?.removeEventListener('click',onBack);status.remove();};
    void refresh();
    return {refresh, dispose};
  }
  global.SIDELiteDecisions={mount};
})(window);



