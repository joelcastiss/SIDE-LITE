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

/** Original SIDE laboratory, backed only by authorized closed results and a local Lite simulation. */
export function renderLaboratory(container,{cash=30000,costs={basic:50,standard:80,premium:120},inventory=[],game=null,companies=[],cycles=[],results=[],onRefresh=null}={}){
 if(!container)throw new Error('Falta el contenedor del laboratorio');
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'S/ '+Number(n??0).toLocaleString('es-PE');
 const closedNumbers=new Set(cycles.filter(c=>c.status==='closed').map(c=>Number(c.number)));
 const closed=results.filter(r=>closedNumbers.has(Number(r.number)));
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
    const graph=chart==='finance'?bars('Resultado económico',[['Ingresos',v.revenue],['Costo de ventas',-v.costOfSales],['Marketing',-v.marketing],['Utilidad',v.profit]]):chart==='production'?bars('Unidades del ciclo',[['Vendidas',v.sold],['Demanda potencial',v.demand],['Inventario final',(v.inventory||[]).reduce((n,b)=>n+b.quantity,0)]],'unidades'):bars('Utilidad por ciclo',history.map(r=>['Ciclo '+r.number,r.result.profit]));
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
  content.innerHTML=`<p class="lab-context">Situación hipotética independiente. No modifica la partida ni anticipa resultados oficiales.</p><form id="lab-lite-form"><div class="lab-options"><label>Caja disponible (S/)<input name="cash" type="number" min="0" step="1" required></label><label>Calidad<select name="quality"><option value="basic">Básica</option><option value="standard">Estándar</option><option value="premium">Prémium</option></select></label><label>Cantidad<input name="quantity" type="number" min="0" max="100000" step="1" required value="10"></label><label>Precio de venta (S/)<input name="price" type="number" min="1" max="100000" step="1" required value="100"></label><label>Inversión en marketing (S/)<input name="marketingAmount" type="number" min="0" max="10000" step="1" required value="0"></label><label>Evento<select name="event"><option value="">Sin evento</option>${EVENTS.map(x=>`<option value="${escape(x.id)}">${escape(x.label)}</option>`).join('')}</select></label><label>Costo básico (S/)<input name="basic" type="number" min="1" step="1" required></label><label>Costo estándar (S/)<input name="standard" type="number" min="1" step="1" required></label><label>Costo prémium (S/)<input name="premium" type="number" min="1" step="1" required></label></div><button type="submit">Simular</button></form><p id="lab-lite-error" role="alert"></p><div id="lab-lite-result" aria-live="polite"></div>`;
  const form=container.querySelector('#lab-lite-form'),result=container.querySelector('#lab-lite-result'),error=container.querySelector('#lab-lite-error');
  form.elements.cash.value=String(cash);for(const q of ['basic','standard','premium'])form.elements[q].value=String(costs[q]);
  form.addEventListener('submit',e=>{e.preventDefault();error.textContent='';result.replaceChildren();try{
   const v=Object.fromEntries(new FormData(form));const outcome=simulateLaboratory({cash:Number(v.cash),costs:{basic:Number(v.basic),standard:Number(v.standard),premium:Number(v.premium)},inventory,event:v.event||null,decision:{quality:v.quality,quantity:Number(v.quantity),price:Number(v.price),marketingAmount:Number(v.marketingAmount)}});
   const rows=[['Ventas',outcome.sold+' unidades'],['Ingresos',money(outcome.revenue)],['Compra',money(outcome.purchase)],['Marketing',money(outcome.marketing)],['Costo de ventas',money(outcome.costOfSales)],['Utilidad',money(outcome.profit)],['Caja final',money(outcome.cashEnd)]];
   const h=document.createElement('h3');h.textContent='Resultado de la simulación';const dl=document.createElement('dl');for(const [label,value] of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}result.append(h,dl);
  }catch(ex){error.textContent=ex.message}});
 }
 container.querySelectorAll('[data-lab-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.labTab;show()}));
 company.addEventListener('change',show);cycle.addEventListener('change',show);
 container.querySelector('#lab-refresh')?.addEventListener('click',onRefresh);
 container.querySelector('#lab-present').addEventListener('click',e=>{const lab=container.querySelector('.lab'),active=lab.classList.toggle('lab-presenting');e.currentTarget.setAttribute('aria-pressed',String(active));e.currentTarget.textContent=active?'Volver al panel docente':'Mostrar al estudiante'});
 show();return container.querySelector('#lab-lite-form');
}
