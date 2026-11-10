/* Presentation-only DOP: existing cycle data in, markup and measured SVG paths out. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./production_model.js'):root.SIDE_PRODUCTION_MODEL);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SIDE_PRODUCTION_DOP=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(model){
  'use strict';
  const EDGES=Object.freeze([
    ['leather','cut'],['accessories','classification'],['classification','preparation'],
    ['cut','assembly'],['preparation','assembly'],['assembly','finish'],['finish','result']
  ].map(edge=>Object.freeze(edge)));
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const number=value=>Number(value||0).toLocaleString('es-PE');
  function render(plan,{round}={}){
    // Persisted plans from the Excel adapter keep resources in requirements and comparison.
    // Read these snapshots without mutating them or manufacturing resource availability.
    plan={...plan,materials:plan.materials||plan.requirements?.materials?.map(row=>({...row,neededForTarget:row.needs,available:plan.comparison?.items?.find(item=>item.id===row.id)?.available||0}))||[],processes:plan.processes||[],productLines:plan.productLines||[]};
    const material=id=>plan.materials.find(entry=>entry.id===id);
    const state=plan.target?'Proyección':'Sin meta definida';
    const source=(id,title,label,materialId)=>`<article class="pd-node pd-source pd-${id}" data-pd-node="${id}"><span class="pd-eyebrow">${title}</span><h4>${label}</h4><strong class="pd-value">${number(material(materialId)?.neededForTarget)} ${escape(material(materialId)?.unit||'')}</strong><span class="pd-state">Material necesario</span></article>`;
    const step=(id,type,index,name,value,detail)=>`<article class="pd-node pd-${id}" data-pd-node="${id}"><div class="pd-node-title"><i class="pd-symbol pd-${type}" aria-label="${{operation:'Operación',inspection:'Inspección',combined:'Combinada'}[type]} ${index}"><span>${index}</span></i><h4>${name}</h4></div><strong class="pd-value">${value}</strong><span class="pd-state">${state}</span><p>${detail}</p></article>`;
    const lines=plan.productLines.filter(line=>line.target>0);
    const output=plan.temporal?plan.producibleUnits:plan.target;
    const mix=lines.map(line=>`${escape(line.label)}: ${number(line.target)} u.`).join(' · ');
    const reference=model.planResources(plan.target);
    const resource=id=>reference.processes.find(p=>p.id===id);
    const resourceText=(id,machine)=>{const p=resource(id);return `${number(p.machines)} ${machine} y ${number(p.workers)} operarios de nivel 1 · Capacidad: ${number(p.cycleCapacity)} u./ciclo`};
    return `<section class="production-dop pd-panel" data-production-target="${plan.target}" aria-labelledby="productionDopTitle">
      <header class="pd-heading"><div><span class="pd-eyebrow">DOP · DIAGRAMA DE OPERACIONES DEL PROCESO</span><h3 id="productionDopTitle">Elaboración mensual de bolsos</h3><p>Área productiva única · Ciclo ${round}. Numeración independiente por tipo de actividad.</p><p>Planificación referencial. La producción real dependerá de los recursos que adquieras y de las condiciones del ciclo.</p></div><div class="pd-legend" aria-label="Leyenda de actividades">${[['operation','Operación'],['inspection','Inspección'],['combined','Combinada']].map(([type,label])=>`<span><i class="pd-symbol pd-${type}" aria-hidden="true"></i>${label}</span>`).join('')}</div></header>
      <div class="pd-plan"><div><h4>DOP consolidado de producción</h4><p>${mix||'Aún no hay producción para mostrar. Define una meta en la calculadora.'}</p></div><div><span class="pd-eyebrow">PRODUCCIÓN TOTAL DESEADA</span><strong>${number(plan.target)} u.</strong></div></div>
      <div class="pd-graph" data-pd-graph>
        <svg class="pd-connectors" data-pd-connectors aria-hidden="true" focusable="false"></svg>
        ${source('leather','MATERIA PRIMA PRINCIPAL','Cuero','CUERO')}
        ${step('cut','operation',1,'Corte de piezas',`${number(output)} juegos de piezas`, `Entrada: ${number(material('CUERO')?.neededForTarget)} m² de cuero. Necesarios: ${resourceText('cut','mesas')}`)}
        ${source('accessories','MATERIA PRIMA SECUNDARIA','Accesorios','ACCESORIOS')}
        ${step('classification','inspection',1,'Clasificación',`${number(material('ACCESORIOS')?.neededForTarget)} accesorios`,'Selección y conteo')}
        ${step('preparation','operation',2,'Preparación',`${number(output)} bolsos`,'Materiales preparados para ensamblado')}
        ${step('assembly','combined',1,'Ensamblado y colocación de accesorios',`${number(output)} bolsos`, `Piezas, accesorios e hilo: ${number(material('HILO')?.neededForTarget)} m. Necesarios: ${resourceText('assembly','máquinas básicas')}`)}
        ${step('finish','combined',2,'Acabado final',`${number(output)} bolsos`, `Necesarios: ${resourceText('finish','máquinas básicas')}`)}
        <section class="pd-result pd-node" data-pd-node="result" aria-label="Resultado de producción del ciclo">
          <div class="pd-output"><span class="pd-eyebrow">PRODUCCIÓN FINAL PROYECTADA</span><strong>${number(output)} unidades totales</strong><div class="pd-mix">${lines.map(line=>`<span><b>${escape(line.label)}</b> ${number(plan.temporal?line.plannedUnits:line.target)} u.</span>`).join('')}</div><p>${plan.temporal?'Producción factible provisional con recepciones verificadas.':'Proyección consolidada de las metas por molde.'}</p></div>
        </section>
      </div>
      <section class="pd-requirements-table"><h4>Recursos productivos recomendados</h4><p>Escenario: operarios de nivel 1, máquinas básicas, ${reference.days} días y eficiencia ${number(reference.efficiency*100)} %. Una máquina o mesa por operario.</p><p>Capacidad de la línea: ${number(reference.capacity)} unidades por ciclo · Cuello de botella: ${reference.limitingProcesses.join(', ')}.</p><h4>Materiales necesarios por molde</h4>${lines.map(line=>`<p><b>${escape(line.label)} (${number(line.target)} u.)</b>: Cuero ${number(line.requirements?.CUERO)} m² · Accesorios ${number(line.requirements?.ACCESORIOS)} unidades · Hilo ${number(line.requirements?.HILO)} metros</p>`).join('')}<h4>Insumos para la cantidad deseada</h4><div class="pd-table-scroll"><table><thead><tr><th>Insumo</th><th>Cantidad necesaria</th></tr></thead><tbody>${plan.materials.filter(row=>Number.isFinite(row.neededForTarget)).map(row=>`<tr><th>${escape(row.label)}</th><td>${number(row.neededForTarget)} ${escape(row.unit)}</td></tr>`).join('')}</tbody></table></div></section><footer class="pd-footer"><table><caption>Tabla de resumen</caption><thead><tr><th>Actividad</th><th>Cantidad</th></tr></thead><tbody><tr><td>Operaciones</td><td>2</td></tr><tr><td>Inspecciones</td><td>1</td></tr><tr><td>Combinadas</td><td>2</td></tr><tr><th>Total</th><th>5</th></tr></tbody></table><div class="pd-metrics"><div><span>UNIDADES PROYECTADAS POR OPERACIÓN</span><strong>${number(output)} unidades</strong></div></div></footer>
    </section>`;
  }
  // Points are measured from card borders in the SVG's coordinate space, never viewport constants.
  function routes(boxes,{stacked=false,rail=0}={}){
    const bottom=b=>({x:(b.left+b.right)/2,y:b.bottom});
    const top=b=>({x:(b.left+b.right)/2,y:b.top});
    const left=b=>({x:b.left,y:(b.top+b.bottom)/2});
    const right=b=>({x:b.right,y:(b.top+b.bottom)/2});
    return EDGES.flatMap(([from,to])=>{
      const a=boxes[from],b=boxes[to];if(!a||!b)return [];
      let start=bottom(a),end=top(b),d;
      if(stacked&&from==='cut'&&to==='assembly'){
        start=left(a);end=left(b);
        d=`M ${start.x} ${start.y} H ${rail} V ${end.y} H ${end.x}`;
      }else if(!stacked&&from==='preparation'&&to==='assembly'){
        start=right(a);end=left(b);
        const middle=(start.x+end.x)/2;
        d=`M ${start.x} ${start.y} H ${middle} V ${end.y} H ${end.x}`;
      }else{
        const middle=(start.y+end.y)/2;
        d=`M ${start.x} ${start.y} V ${middle} H ${end.x} V ${end.y}`;
      }
      return [{from,to,start,end,d}];
    });
  }
  function mount(container){
    const graph=container?.querySelector('[data-pd-graph]');
    if(!graph)return ()=>{};
    const svg=graph.querySelector('[data-pd-connectors]');
    if(!svg)return ()=>{};
    let frame=0,disposed=false;
    const draw=()=>{
      frame=0;if(disposed||!graph.isConnected)return;
      const bounds=graph.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const boxes={};
      graph.querySelectorAll('[data-pd-node]').forEach(node=>{
        const box=node.getBoundingClientRect();
        boxes[node.dataset.pdNode]={left:box.left-bounds.left,right:box.right-bounds.left,top:box.top-bounds.top,bottom:box.bottom-bounds.top};
      });
      const stacked=getComputedStyle(graph).getPropertyValue('--pd-stacked').trim()==='1';
      const rail=(boxes.leather?.left||0)/2;
      svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
      svg.innerHTML=routes(boxes,{stacked,rail}).map(({from,to,d})=>`<path data-from="${from}" data-to="${to}" class="${['accessories','classification','preparation'].includes(from)?'pd-branch-path':'pd-main-path'}" d="${d}"/>`).join('');
    };
    const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw)};
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
    observer?.observe(graph);
    graph.querySelectorAll('[data-pd-node]').forEach(node=>observer?.observe(node));
    window.addEventListener('resize',schedule);
    if(document.fonts)document.fonts.ready.then(schedule);
    schedule();
    return ()=>{disposed=true;observer?.disconnect();window.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame)};
  }
  return Object.freeze({render,routes,mount,edges:EDGES});
});
