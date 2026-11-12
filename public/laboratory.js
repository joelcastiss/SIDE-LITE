// Simulation only: this module never sends decisions, changes games or reads cycle seeds.
// The bundled engine is checked against js/engine.js by tests/laboratory.test.js.
import {closeCycle, EVENTS} from './laboratory-engine.js';
const SAMPLE_SEED='SIDE-LITE-LABORATORIO-LOCAL';
const SAMPLE_COMPANY='empresa-de-ejemplo';

/** Run exactly the Lite economic engine on a hypothetical independent scenario. */
export function simulateLaboratory({cash=30000,costs={basic:50,standard:80,premium:120},inventory=[],event=null,decision}){
 if(!decision || !['basic','standard','premium'].includes(decision.quality))throw new Error('Selecciona una calidad válida');
 if(event!==null&&!EVENTS.some(x=>x.id===event))throw new Error('Selecciona un evento válido');
 for(const value of Object.values(costs))if(!Number.isSafeInteger(value)||value<1)throw new Error('Los costos deben ser enteros positivos');
 if(!['basic','standard','premium'].every(key=>Object.hasOwn(costs,key)))throw new Error('Faltan costos de calidad');
 return closeCycle({cash,batches:inventory,costs,event,decision,seed:SAMPLE_SEED,companyId:SAMPLE_COMPANY});
}

// Adapted from SIDE1 js/laboratorio.js: lineChart. Only the source of cycle
// numbers and monetary values differs; no SIDE1 backend or economic model is used.
export function laboratoryLineChart(title, rows, unit='S/', options={}) {
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(n,u)=>n==null?'No disponible':u==='S/'?'S/ '+n.toLocaleString('es-PE',{maximumFractionDigits:2}):n.toLocaleString('es-PE',{maximumFractionDigits:2})+' '+u;
 const normalized=rows.map(([cycle,value])=>[Number(cycle),value==null?null:Number(value)]).filter(([cycle,value])=>Number.isSafeInteger(cycle)&&cycle>0&&cycle<=6&&(value===null||Number.isFinite(value))).sort((a,b)=>a[0]-b[0]);
 if(!options.student){
 const valid=normalized.filter(r=>r[1]!=null);if(!valid.length)return `<div class="lab-chart"><h3>${esc(title)}</h3><p>No disponible: faltan cierres con este indicador.</p></div>`;
 const vals=valid.map(r=>r[1]),min=Math.min(0,...vals),max=Math.max(0,...vals),range=max-min||1;
 const last=Math.max(1,...normalized.map(r=>r[0])),x=c=>last===1?300:50+(c-1)*500/(last-1),y=v=>180-(v-min)/range*150;
 const points=normalized.map(([cycle,value])=>value==null?null:{cycle,value,x:x(cycle),y:y(value)});
 let segments='';for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a&&b&&b.cycle===a.cycle+1)segments+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#167f9d" stroke-width="3"/>`;}
 const dots=points.filter(Boolean).map(p=>`<g tabindex="0"><title>Ciclo ${p.cycle}: ${esc(fmt(p.value,unit))}</title><circle cx="${p.x}" cy="${p.y}" r="6" fill="#126582"/><text x="${p.x}" y="${Math.max(14,p.y-12)}" text-anchor="middle" class="lab-point-value">${esc(fmt(p.value,unit))}</text></g>`).join('');
 const labels=Array.from({length:last},(_,i)=>`<text x="${x(i+1)}" y="205" text-anchor="middle">${i+1}</text>`).join('');
 return `<div class="lab-chart"><div class="lab-chart-head"><h3>${esc(title)}</h3><span>Escala: ${esc(unit)} · eje horizontal: ciclo</span></div><svg class="lab-line-chart" viewBox="0 0 600 220" role="img" aria-label="${esc(title+': '+normalized.map(([c,v])=>'ciclo '+c+' '+fmt(v,unit)).join('; '))}"><line x1="50" y1="${y(0)}" x2="550" y2="${y(0)}" stroke="#55748a" stroke-width="1" stroke-dasharray="5 4"/><text x="12" y="${y(0)+4}">0</text>${segments}${dots}${labels}</svg><p class="lab-line-note">Cada punto es un cierre disponible; una interrupción indica datos ausentes.</p></div>`;
 }
 const valid=normalized.filter(r=>r[1]!=null);
 const head=`<div class="lab-chart-head"><h3>${esc(title)}</h3></div>`;
 if(!valid.length)return `<div class="lab-chart lab-evolution">${head}<p class="lab-evolution-empty">No disponible: faltan cierres con este indicador.</p></div>`;
 if(valid.length===1){const [cycle,value]=valid[0];return `<div class="lab-chart lab-evolution">${head}<div class="lab-evolution-single" role="img" aria-label="${esc(`Ciclo ${cycle}: ${fmt(value,unit)}`)}"><span class="lab-evolution-dot" aria-hidden="true"></span><div><strong>Ciclo ${cycle} · utilidad ${esc(fmt(value,unit))}</strong><p>La evolución aparecerá al cerrar más ciclos.</p></div></div></div>`;}
 const vals=valid.map(r=>r[1]),min=Math.min(0,...vals),max=Math.max(0,...vals),range=max-min||1;
 const last=Math.max(1,...normalized.map(r=>r[0])),x=c=>(c-1)*100/(last-1),y=v=>100-(v-min)/range*100;
 const points=normalized.map(([cycle,value])=>value==null?null:{cycle,value,x:x(cycle),y:y(value)});
 let segments='';for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(a&&b&&b.cycle===a.cycle+1)segments+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--lab-cyan)" vector-effect="non-scaling-stroke" stroke-width="3"/>`;}
 const dots=points.filter(Boolean).map(p=>`<i class="lab-evolution-mark" style="left:${p.x}%;top:${p.y}%"></i>`).join('');
 const ticks=[max,(max+min)/2,min];
 const desc=title+': '+normalized.map(([c,v])=>'Ciclo '+c+': '+fmt(v,unit)).join('; ');
 return `<div class="lab-chart lab-evolution">${head}<div class="lab-evolution-plot"><div class="lab-evolution-y">${ticks.map(v=>`<span>${esc(fmt(v,unit))}</span>`).join('')}</div><div class="lab-evolution-area" role="img" aria-label="${esc(desc)}"><div class="lab-evolution-grid"><i></i><i></i><i></i>${min<0&&max>0?`<i class="lab-evolution-zero" style="top:${y(0)}%"></i>`:''}</div><svg class="lab-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${segments}</svg>${dots}</div><div aria-hidden="true"></div><div class="lab-evolution-cycles" style="--lab-cycle-count:${last}">${Array.from({length:last},(_,i)=>{const row=normalized.find(r=>r[0]===i+1);return `<details><summary title="Ciclo ${i+1}: ${esc(fmt(row?.[1]??null,unit))}">C${i+1}</summary><span>Ciclo ${i+1}: ${esc(fmt(row?.[1]??null,unit))}</span></details>`;}).join('')}</div></div><p class="lab-line-note">Toca un ciclo para ver su valor. Las interrupciones indican datos ausentes.</p></div>`;
}

/** Original SIDE laboratory, backed only by authorized closed results and a local Lite simulation. */
export function renderLaboratory(container,{cash=30000,costs={basic:50,standard:80,premium:120},inventory=[],game=null,companies=[],cycles=[],results=[],onRefresh=null}={}){
 if(!container)throw new Error('Falta el contenedor del laboratorio');
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'S/ '+Number(n??0).toLocaleString('es-PE');
 const closedNumbers=new Set(cycles.filter(c=>c.status==='closed').map(c=>Number(c.number)));
 const closed=results.filter(r=>closedNumbers.has(Number(r.number))).slice().sort((a,b)=>Number(a.number)-Number(b.number)||String(a.company_id).localeCompare(String(b.company_id)));
 const options=(values,label)=>values.map(v=>`<option value="${escape(v.id)}">${escape(label(v))}</option>`).join('');
 container.innerHTML=`<article class="card lab" aria-labelledby="laboratory-title"><div class="section-head"><div><h2 id="laboratory-title">Laboratorio Estratégico</h2><p>Explora decisiones y resultados de ciclos cerrados.</p></div></div><div class="lab-controls"><label>Código de partida<select id="lab-game"><option value="">${game?escape(game.code):'Selecciona una partida'}</option></select></label><label>Empresa<select id="lab-company"><option value="">Todas las empresas</option>${options(companies,c=>c.name)}</select></label><label>Ciclo cerrado<select id="lab-cycle"><option value="">Todos los ciclos</option>${options(cycles.filter(c=>c.status==='closed').map(c=>({...c,id:c.number})),c=>'Ciclo '+c.number)}</select></label><button type="button" id="lab-present" class="secondary" aria-pressed="false">Mostrar al estudiante</button>${onRefresh?'<button id="lab-refresh" class="secondary" type="button">Actualizar datos</button>':''}</div><div class="lab-tabs" role="group" aria-label="Vistas del laboratorio"><button type="button" data-lab-tab="results">Ver resultados</button><button type="button" data-lab-tab="simulate">Probar otra decisión</button><button type="button" data-lab-tab="compare">Comparar empresas</button></div><p id="lab-status" aria-live="polite"></p><div id="lab-content"></div></article>`;
 const content=container.querySelector('#lab-content'),status=container.querySelector('#lab-status'),company=container.querySelector('#lab-company'),cycle=container.querySelector('#lab-cycle');
 let tab=game?'results':'simulate', chart='finance', other='', metric='profit';
 const filtered=()=>closed.filter(r=>(!company.value||r.company_id===company.value)&&(!cycle.value||Number(r.number)===Number(cycle.value)));
 const name=id=>companies.find(c=>c.id===id)?.name??'Empresa';
 const table=rows=>`<div class="lab-chart lab-simulation-result"><table><thead><tr><th>Empresa</th><th>Ciclo</th><th>Ventas</th><th>Ingresos</th><th>Utilidad</th><th>Caja final</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${escape(name(r.company_id))}</th><td>${escape(r.number)}</td><td>${escape(r.result.sold)}</td><td>${money(r.result.revenue)}</td><td>${money(r.result.profit)}</td><td>${money(r.result.cashEnd)}</td></tr>`).join('')}</tbody></table></div>`;
 const bars=(title,rows,unit='S/')=>{const numbers=rows.map(r=>Number(r[1])).filter(Number.isFinite),min=Math.min(0,...numbers),max=Math.max(0,...numbers),range=max-min||1,zero=(0-min)/range*100;return `<div class="lab-chart" role="img" aria-label="${escape(title)}"><div class="lab-chart-head"><h3>${escape(title)}</h3><span>Escala: ${escape(unit)}</span></div><div class="lab-axis"><span>${escape(unit==='S/'?money(min):min)}</span><span>${escape(unit==='S/'?money(max):max)}</span></div>${rows.map(([label,value],i)=>{const n=Number(value),end=Number.isFinite(n)?(n-min)/range*100:zero;return `<div class="lab-bar-row"><span class="lab-row-label">${escape(label)}</span><div class="lab-track"><i class="lab-zero" style="left:${zero}%"></i><i class="lab-bar lab-color-${i%3}" style="left:${Math.min(zero,end)}%;width:${Math.abs(end-zero)}%"></i></div><strong>${escape(unit==='S/'?money(n):n)}</strong></div>`}).join('')}</div>`};
 const chartButtons=()=>`<div class="lab-chart-tabs" role="group" aria-label="Elegir gráfico">${[['finance','Rentabilidad'],['production','Producción'],['trend','Evolución']].map(([id,label])=>`<button type="button" data-lab-chart="${id}" aria-pressed="${id===chart}">${label}</button>`).join('')}</div>`;
 const explain=(what,why,improve,question)=>`<div class="lab-explain"><div class="lab-explain-main"><strong>◉ &nbsp;¿Qué pasó?</strong><p>${escape(what)}</p></div><div class="lab-detail"><strong>◇ &nbsp;¿Por qué pasó?</strong><p>${escape(why)}</p></div><div class="lab-detail"><strong>↗ &nbsp;¿Qué podrías mejorar?</strong><p>${escape(improve)}</p></div><div class="lab-question"><strong>✦ &nbsp;Pregunta para el estudiante</strong><p>${escape(question)}</p></div></div>`;
 const graphArea=main=>`<div class="lab-chart-grid lab-chart-single"><div class="lab-main">${main}</div></div>`;
 function show(){
  container.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===tab)));
  status.textContent='';
  if(tab==='results'||tab==='compare'){
   const rows=filtered(),row=rows.at(-1);
   status.textContent=tab==='compare'?'Comparación de resultados oficiales de ciclos cerrados.':'Resultados oficiales de ciclos cerrados.';
   if(!row){content.innerHTML='<p class="lab-empty">No hay resultados cerrados para la selección.</p>';return}
   const v=row.result,context=`<p class="lab-context">${escape(name(row.company_id))} <span>·</span> Ciclo ${escape(row.number)}</p>`;
   if(tab==='results'){
    const margin=v.revenue?100*v.profit/v.revenue:null;
    const metrics=`<div class="lab-metrics"><div><span>◈ &nbsp;Ventas del ciclo</span><strong>${money(v.revenue)}</strong></div><div><span>↗ &nbsp;Utilidad</span><strong>${money(v.profit)}</strong></div><div><span>◉ &nbsp;Margen</span><strong>${margin===null?'No aplica':margin.toFixed(1)+' %'}</strong></div><div><span>◇ &nbsp;Unidades vendidas</span><strong>${escape(v.sold)}</strong></div></div>`;
    const history=closed.filter(r=>r.company_id===row.company_id&&Number(r.number)<=Number(row.number));
    const graph=chart==='finance'?bars('Resultado económico',[['Ingresos',v.revenue],['Costo de ventas',-v.costOfSales],['Marketing',-v.marketing],['Utilidad',v.profit]]):chart==='production'?bars('Unidades del ciclo',[['Vendidas',v.sold],['Demanda potencial',v.demand],['Inventario final',(v.inventory||[]).reduce((n,b)=>n+b.quantity,0)]],'unidades'):laboratoryLineChart('Utilidad por ciclo',history.map(r=>[r.number,r.result.profit]));
    content.innerHTML=context+metrics+chartButtons()+graphArea(graph)+explain('Resultados del ciclo cerrado.','La utilidad considera ventas, costo de ventas y marketing.','Revisa la relación entre precio, cantidad, calidad y marketing.','¿Qué decisión cambiarías para mejorar la utilidad?');
    container.querySelectorAll('[data-lab-chart]').forEach(b=>b.onclick=()=>{chart=b.dataset.labChart;show()});
   }else{
    const candidates=closed.filter(r=>r.number===row.number&&r.company_id!==row.company_id);if(!candidates.some(r=>r.company_id===other))other=candidates[0]?.company_id||'';const second=candidates.find(r=>r.company_id===other);const labels={revenue:'Ventas',profit:'Utilidad',cashEnd:'Caja final',sold:'Unidades vendidas'};
    const opts=`<div class="lab-options"><label>Comparar con<select id="lab-other">${candidates.map(r=>`<option value="${escape(r.company_id)}" ${r.company_id===other?'selected':''}>${escape(name(r.company_id))}</option>`).join('')}</select></label><label>Indicador<select id="lab-metric">${Object.entries(labels).map(([id,label])=>`<option value="${id}" ${id===metric?'selected':''}>${label}</option>`).join('')}</select></label></div>`;
    content.innerHTML=context+opts+(second?graphArea(bars(labels[metric]+' por empresa',[[name(row.company_id),v[metric]],[name(second.company_id),second.result[metric]]],metric==='sold'?'unidades':'S/')):'<p class="lab-empty">No hay otra empresa con resultados en este ciclo.</p>')+'<p class="lab-compare-note">Las condiciones iniciales y de mercado pueden ser distintas; compara con contexto.</p>'+explain('Compara los resultados de las empresas en el mismo ciclo.','Una diferencia por sí sola no demuestra su causa.','Revisa ventas, costos y caja.','¿Qué indicador muestra mejor el desempeño?');
    const select=container.querySelector('#lab-other');if(select)select.onchange=()=>{other=select.value;show()};const selectMetric=container.querySelector('#lab-metric');if(selectMetric)selectMetric.onchange=()=>{metric=selectMetric.value;show()};
   }
   return;
  }
  const selected=filtered().at(-1),previous=selected&&closed.find(r=>r.company_id===selected.company_id&&Number(r.number)===Number(selected.number)-1),historicalInventory=selected&&Number.isSafeInteger(selected.result.cashStart)&&(Number(selected.number)===1||Array.isArray(previous?.result.inventory))?(previous?.result.inventory??[]):null,selectedCycle=selected&&cycles.find(c=>Number(c.number)===Number(selected.number)&&c.status==='closed');
  const context=selected?`<p class="lab-context">${escape(name(selected.company_id))} <span>·</span> Ciclo ${escape(selected.number)} cerrado</p><p class="lab-simulation-label">Simulación educativa aislada; no modifica la partida oficial. La semilla hipotética es distinta de la oficial; las diferencias no se deben necesariamente solo a la decisión.</p>`:'<p class="lab-context">Situación hipotética independiente. No modifica la partida ni anticipa resultados oficiales.</p>';
  content.innerHTML=context+(selected&&historicalInventory===null?'<p class="lab-warning">Falta la caja inicial o el inventario del cierre anterior; la simulación usa un contexto hipotético y no permite comparar fielmente el ciclo seleccionado.</p>':'')+`<form id="lab-lite-form"><div class="lab-options"><label>Caja disponible (S/)<input name="cash" type="number" min="0" step="1" required></label><label>Calidad<select name="quality"><option value="basic">Básica</option><option value="standard">Estándar</option><option value="premium">Prémium</option></select></label><label>Cantidad<input name="quantity" type="number" min="0" max="100000" step="1" required value="10"></label><label>Precio de venta (S/)<input name="price" type="number" min="1" max="100000" step="1" required value="100"></label><label>Inversión en marketing (S/)<input name="marketingAmount" type="number" min="0" max="10000" step="1" required value="0"></label><label>Evento<select name="event"><option value="">Sin evento</option>${EVENTS.map(x=>`<option value="${escape(x.id)}">${escape(x.label)}</option>`).join('')}</select></label><label>Costo básico (S/)<input name="basic" type="number" min="1" step="1" required></label><label>Costo estándar (S/)<input name="standard" type="number" min="1" step="1" required></label><label>Costo prémium (S/)<input name="premium" type="number" min="1" step="1" required></label></div><button type="submit">Simular</button></form><p id="lab-lite-error" role="alert"></p><div id="lab-lite-result" aria-live="polite"></div>`;
  const form=container.querySelector('#lab-lite-form'),result=container.querySelector('#lab-lite-result'),error=container.querySelector('#lab-lite-error');
  form.elements.cash.value=String(selected?.result.cashStart??cash);for(const q of ['basic','standard','premium'])form.elements[q].value=String(costs[q]);if(selectedCycle?.event_id&&EVENTS.some(e=>e.id===selectedCycle.event_id))form.elements.event.value=selectedCycle.event_id;
  form.addEventListener('submit',e=>{e.preventDefault();error.textContent='';result.replaceChildren();try{
   const v=Object.fromEntries(new FormData(form));const outcome=simulateLaboratory({cash:Number(v.cash),costs:{basic:Number(v.basic),standard:Number(v.standard),premium:Number(v.premium)},inventory:historicalInventory??inventory,event:v.event||null,decision:{quality:v.quality,quantity:Number(v.quantity),price:Number(v.price),marketingAmount:Number(v.marketingAmount)}});
   // Reuse SIDE's chart/explanation layout, without implying that the fixed
   // hypothetical seed reproduces the official result of any real company.
   const rows=[['Unidades vendidas',outcome.sold+' unidades'],['Ingresos',money(outcome.revenue)],['Compra',money(outcome.purchase)],['Marketing',money(outcome.marketing)],['Costo de ventas',money(outcome.costOfSales)],['Utilidad',money(outcome.profit)],['Caja final',money(outcome.cashEnd)]];
   const detail=`<div class="lab-chart lab-simulation-result"><h3>Resultado de la simulación</h3><table><thead><tr><th>Indicador</th><th>Hipotético</th></tr></thead><tbody>${rows.map(([label,value])=>`<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('')}</tbody></table></div>`;
   const comparison=selected&&historicalInventory!==null?graphArea(bars('Utilidad oficial y alternativa hipotética',[['Resultado oficial',selected.result.profit],['Resultado hipotético',outcome.profit]])):'<p class="lab-context">Sin comparación oficial disponible.</p>';
   result.innerHTML=comparison+graphArea(bars('Resultado económico hipotético',[['Ingresos',outcome.revenue],['Costo de ventas',-outcome.costOfSales],['Marketing',-outcome.marketing],['Utilidad',outcome.profit]]))+detail+explain(`La simulación vendió ${outcome.sold} unidades y obtuvo ${money(outcome.profit)} de utilidad.`, 'El cálculo utiliza el motor de SIDE-LITE con una semilla hipotética independiente.', 'Compara precio, cantidad, calidad y marketing antes de tomar decisiones.', '¿Qué cambiarías para mejorar el resultado?');
  }catch(ex){error.textContent=ex.message}});
 }
 container.querySelectorAll('[data-lab-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.labTab;show()}));
 company.addEventListener('change',show);cycle.addEventListener('change',show);
 container.querySelector('#lab-refresh')?.addEventListener('click',onRefresh);
 container.querySelector('#lab-present').addEventListener('click',e=>{const lab=container.querySelector('.lab'),active=lab.classList.toggle('lab-presenting');e.currentTarget.setAttribute('aria-pressed',String(active));e.currentTarget.textContent=active?'Volver al panel docente':'Mostrar al estudiante'});
 show();return container.querySelector('#lab-lite-form');
}
