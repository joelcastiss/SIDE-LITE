(function (global) {
  'use strict';
  const valid = n => n !== null && n !== undefined && Number.isFinite(Number(n));
  const number = n => new Intl.NumberFormat('es-PE', {maximumFractionDigits: 2}).format(Number(n));
  const money = n => 'S/ ' + number(n);
  function metrics(v, capital) {
    v ||= {};
    const batches = Array.isArray(v.inventory) && v.inventory.every(b => valid(b.quantity) && valid(b.unitCost)) ? v.inventory : null;
    const inventory = batches ? batches.reduce((n,b)=>n+Number(b.quantity),0) : null;
    const value = batches ? batches.reduce((n,b)=>n+Number(b.quantity)*Number(b.unitCost),0) : null;
    const produced = valid(v.purchase) && valid(v.unitCost) && Number(v.unitCost)>0 && Number(v.purchase)%Number(v.unitCost)===0 ? Number(v.purchase)/Number(v.unitCost) : null;
    const unsold = produced!==null && inventory!==null ? Math.min(produced,inventory) : null;
    const returnPercent = valid(capital) && Number(capital)>0 && valid(v.cashEnd) && value!==null ? 100*(Number(v.cashEnd)+value-Number(capital))/Number(capital) : null;
    return {inventory,value,produced,unsold,returnPercent};
  }
  function render(target,data) {
    target.replaceChildren();
    const add=(parent,tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;parent.append(el);return el;};
    const own=data.company||{}, ranking=Array.isArray(data.ranking)?data.ranking:[];
    add(target,'h3','Clasificación');
    const position=ranking.findIndex(row=>row.id===own.id), mine=ranking[position];
    if(mine && valid(mine.returnPercent)) add(target,'p',`Tu posición: ${position+1} de ${ranking.length} · Rentabilidad: ${number(mine.returnPercent)} %`,'lite-result-highlight');
    const list=add(target,'ol');for(const row of ranking)add(list,'li',`${row.name} · ${valid(row.returnPercent)?number(row.returnPercent)+' %':'—'}${row.id===own.id?' · Tu empresa':''}`);
    add(target,'h3','Resultados por ciclo');
    const rows=(Array.isArray(data.results)?data.results:[]).filter(row=>row.company_id===own.id).slice().sort((a,b)=>Number(a.number)-Number(b.number));
    if(!rows.length){add(target,'p','Aún no hay resultados oficiales.');return;}
    for(const row of rows.slice().reverse()){
      const v=row.result||{},m=metrics(v,own.initial_capital),section=add(target,'section',undefined,'lite-cycle-result');
      add(section,'h4',`Ciclo ${row.number}`);
      add(section,'h5','Resumen económico');
      let grid=add(section,'div',undefined,'lite-result-grid');
      const card=(label,value)=>{const el=add(grid,'div',undefined,'lite-result-card');add(el,'span',label);add(el,'strong',value);};
      const amount=key=>valid(v[key])?money(v[key]):'—';
      card('Ganancia del ciclo',amount('profit'));card('Dinero disponible',amount('cashEnd'));card('Ingresos por ventas',amount('revenue'));card('Marketing',amount('marketing'));
      add(section,'h5','Tus bolsos');grid=add(section,'div',undefined,'lite-result-grid');
      const sold=valid(v.sold)?Number(v.sold):null, demand=valid(v.demand)?Number(v.demand):null;
      const available=sold!==null&&m.inventory!==null?sold+m.inventory:null;
      const unmet=demand!==null&&sold!==null?Math.max(0,demand-sold):null;
      for(const [label,value] of [['Disponibles para vender',available],['Bolsos vendidos',sold],['Bolsos restantes',m.inventory],['Demanda potencial',demand],['Demanda sin atender',unmet]])card(label,value===null?'—':number(value));
      add(section,'h5','Resumen sencillo');
      const summary=[];
      if(sold!==null && valid(v.profit)) summary.push(`Vendiste ${available!==null && available>0 && sold===available?'todos tus ':''}${number(sold)} bolsos y ${Number(v.profit)<0?'tuviste una pérdida de':'obtuviste una ganancia de'} ${money(Math.abs(Number(v.profit)))}.`);
      else if(sold!==null) summary.push(`Vendiste ${number(sold)} bolsos.`);
      else if(valid(v.profit)) summary.push(`${Number(v.profit)<0?'Tuviste una pérdida de':'Obtuviste una ganancia de'} ${money(Math.abs(Number(v.profit)))}.`);
      if(unmet>0 && m.inventory===0) summary.push(`Quedaron ${number(unmet)} ventas potenciales sin atender por falta de inventario.`);
      else if(unmet>0) summary.push(`Quedaron ${number(unmet)} ventas potenciales sin atender${m.inventory!==null?` y ${number(m.inventory)} bolsos restantes`:''}.`);
      else if(m.inventory!==null) summary.push(`Quedaron ${number(m.inventory)} bolsos disponibles.`);
      add(section,'p',summary.join(' ')||'No hay suficientes datos para resumir este ciclo.','lite-result-explanation');
      const cycle=(data.cycles||[]).find(c=>c.id===row.cycle_id || Number(c.number)===Number(row.number));
      const event=global.SIDELiteEvents.describe(cycle?.event_id || v.event,v), eventCard=add(section,'div',undefined,'lite-result-event');
      add(eventCard,'h5','SOBRE EL EVENTO QUE OCURRIÓ');add(eventCard,'strong',event.name);add(eventCard,'p',`${event.description} ${event.effect}`);
    }
  }
  global.SIDELiteResults=Object.freeze({metrics,render});
})(window);
