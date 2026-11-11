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
    // Zero-cost purchases do not reveal the quantity produced in the stored receipt.
    const produced = valid(v.purchase) && valid(v.unitCost) && Number(v.unitCost)>0 && Number(v.purchase)%Number(v.unitCost)===0 ? Number(v.purchase)/Number(v.unitCost) : null;
    const unsold = produced!==null && inventory!==null ? Math.min(produced,inventory) : null;
    const returnPercent = valid(capital) && Number(capital)>0 && valid(v.cashEnd) && value!==null ? 100*(Number(v.cashEnd)+value-Number(capital))/Number(capital) : null;
    return {inventory,value,produced,unsold,returnPercent};
  }
  function render(target,data) {
    target.replaceChildren();
    const add=(parent,tag,text,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;parent.append(el);return el;};
    const pct=n=>number(n)+' %', own=data.company||{}, ranking=Array.isArray(data.ranking)?data.ranking:[];
    add(target,'h3','Clasificación');
    const position=ranking.findIndex(row=>row.id===own.id), mine=ranking[position], first=ranking[0];
    if(mine && first && valid(mine.returnPercent) && valid(first.returnPercent)) add(target,'p',`Tu posición: ${position+1} de ${ranking.length} · Rentabilidad: ${pct(mine.returnPercent)} · Distancia al primer lugar: ${number(Math.max(0,Number(first.returnPercent)-Number(mine.returnPercent)))} puntos porcentuales.`,'lite-result-highlight');
    add(target,'p','La clasificación ordena la rentabilidad patrimonial: (caja + valor del inventario − capital inicial) / capital inicial. Si hay empate, se considera la caja y luego el nombre.','lite-result-explanation');
    const list=add(target,'ol');for(const row of ranking)add(list,'li',`${row.name} · ${valid(row.returnPercent)?pct(row.returnPercent):'—'}${row.id===own.id?' · Tu empresa':''}`);
    add(target,'h3','Resultados por ciclo');
    const rows=(Array.isArray(data.results)?data.results:[]).filter(row=>row.company_id===own.id).slice().sort((a,b)=>Number(a.number)-Number(b.number));
    if(!rows.length){add(target,'p','Aún no hay resultados oficiales.');return;}
    const evolution=rows.map(row=>({number:row.number,...metrics(row.result,own.initial_capital)})).filter(row=>row.returnPercent!==null);
    if(evolution.length>=2)add(target,'p','Evolución de tu rentabilidad: '+evolution.map(row=>`ciclo ${row.number}: ${pct(row.returnPercent)}`).join(' · '),'lite-result-explanation');
    for(const row of rows.slice().reverse()){
      const v=row.result||{},m=metrics(v,own.initial_capital),section=add(target,'section',undefined,'lite-cycle-result');add(section,'h4',`Ciclo ${row.number}`);
      let grid=add(section,'div',undefined,'lite-result-grid');
      const card=(label,value,description)=>{const el=add(grid,'div',undefined,'lite-result-card');add(el,'span',label);add(el,'strong',value);if(description)add(el,'small',description);};
      const amount=key=>valid(v[key])?money(v[key]):'—';
      card('Ingresos por ventas',amount('revenue'),'Dinero generado por los bolsos vendidos.');card('Costo de ventas',amount('costOfSales'),'Costo FIFO de los bolsos vendidos.');card('Marketing',amount('marketing'),'Inversión publicitaria registrada.');card('Utilidad o pérdida',amount('profit'),'Ingresos menos costo de ventas y marketing.');card('Caja disponible',amount('cashEnd'),'Efectivo al finalizar el ciclo.');card('Rentabilidad',m.returnPercent===null?'—':pct(m.returnPercent),'Variación patrimonial respecto al capital inicial.');
      add(section,'h5','Producción e inventario');
      grid=add(section,'div',undefined,'lite-result-grid');
      for(const [label,value] of [['Producidas',m.produced],['Vendidas',valid(v.sold)?Number(v.sold):null],['Producción no vendida',m.unsold],['Inventario acumulado',m.inventory]])card(label,value===null?'—':number(value));
      add(section,'p',`Valor del inventario FIFO: ${m.value===null?'—':money(m.value)}. La producción no vendida considera que se venden primero los lotes más antiguos.`,'lite-result-explanation');
      if(m.produced===null)add(section,'p','La cantidad producida no está disponible en este resultado.','lite-result-explanation');
      add(section,'h5','¿Qué pasó con mi empresa?');const explanations=[];
      if(m.inventory>0)explanations.push(`Quedaron ${number(m.inventory)} bolsos en inventario al cierre.`);
      if(valid(v.profit)&&Number(v.profit)<0&&valid(v.revenue)&&valid(v.costOfSales)&&valid(v.marketing))explanations.push(`La pérdida refleja que el costo de ventas (${money(v.costOfSales)}) y el marketing (${money(v.marketing)}) sumaron más que los ingresos (${money(v.revenue)}).`);
      if(m.returnPercent>0)explanations.push('La caja más el inventario valorado supera el capital inicial; la rentabilidad patrimonial es positiva.');
      if(valid(v.marketing)&&valid(v.revenue)&&Number(v.marketing)>0&&(Number(v.revenue)===0||Number(v.marketing)/Number(v.revenue)>=0.2))explanations.push(`El gasto en marketing fue ${money(v.marketing)} y se descuenta al calcular la utilidad.`);
      if(!explanations.length)explanations.push('Consulta ingresos, costos y caja para revisar el resultado registrado de este ciclo.');
      const bullets=add(section,'ul');explanations.forEach(text=>add(bullets,'li',text));
    }
  }
  global.SIDELiteResults=Object.freeze({metrics,render});
})(window);
