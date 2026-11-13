(function(global){
'use strict';
const selections=new WeakMap(), signatures=new WeakMap();
const num=new Intl.NumberFormat('es-PE',{maximumFractionDigits:2});
const safe=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const money=v=>safe(v)?'S/ '+num.format(Number(v)):'—';
const integer=v=>safe(v)?num.format(Number(v)):'—';
function node(tag,cls,value){const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e}
function metric(label,value,focus=false){const m=node('div','lite-result-metric'+(focus?' focus':''));m.append(node('span','',label),node('strong','',value));return m}
const quality={basic:'Básica',standard:'Media',premium:'Prémium'};
function render(target,snapshot){
 if(!target)return;
 const signature=JSON.stringify([snapshot?.game?.id,snapshot?.companies,snapshot?.cycles?.map(c=>[c.id,c.number,c.status,c.event_id]),snapshot?.results]);
 if(signatures.get(target)===signature)return;
 signatures.set(target,signature);
 const opened=new Set([...target.querySelectorAll('details[open][data-company]')].map(x=>x.dataset.company));
 target.classList.add('lite-result-view');target.replaceChildren();
 const companies=Array.isArray(snapshot?.companies)?snapshot.companies:[];
 const results=Array.isArray(snapshot?.results)?snapshot.results:[];
 const cycles=Array.isArray(snapshot?.cycles)?snapshot.cycles:[];
 const available=[...new Set(cycles.filter(c=>c.status==='closed').map(c=>Number(c.number)).filter(n=>Number.isSafeInteger(n)&&n>0))].sort((a,b)=>a-b);
 if(!available.length){
  const empty=node('div','lite-result-empty');empty.append(node('h4','','Resultados pendientes'),node('p','','Cuando el docente cierre el primer ciclo, aquí aparecerán las ventas, la utilidad y la caja de cada empresa.'));target.append(empty);return;
 }
 const selected=Number(selections.get(target)),cycle=available.includes(selected)?selected:available.at(-1);
 const bar=node('div','lite-result-toolbar'),left=node('div');
 left.append(node('h4','','Ciclo '+cycle),node('p','','Resultados oficiales al cierre de este ciclo.'));
 const label=node('label','lite-result-filter'),select=node('select');
 label.append(node('span','','Seleccionar ciclo'));select.setAttribute('aria-label','Seleccionar ciclo de resultados');
 for(const n of [...available].reverse()){const op=node('option','','Ciclo '+n);op.value=String(n);op.selected=n===cycle;select.append(op)}
 select.addEventListener('change',()=>{selections.set(target,select.value);signatures.delete(target);render(target,snapshot)});
 label.append(select);bar.append(left,label);target.append(bar);
 const byCompany=new Map(results.filter(x=>Number(x.number)===cycle).map(x=>[String(x.company_id),x]));
 const rows=companies.map(company=>({company,item:byCompany.get(String(company.id))}));
 const complete=rows.filter(r=>r.item?.result);
 const comparison=node('section','lite-result-comparison');
 comparison.append(node('h5','','Comparación del ciclo'),node('p','lite-result-caption','Mayores resultados del ciclo; no son las calificaciones del podio docente.'));
 for(const [key,label,format] of [['sold','Más bolsos vendidos',integer],['profit','Mayor utilidad',money]]){
  const eligible=complete.filter(r=>safe(r.item.result[key]));
  if(!eligible.length)continue;
  const max=Math.max(...eligible.map(r=>Number(r.item.result[key])));
  const names=eligible.filter(r=>Number(r.item.result[key])===max).map(r=>r.company.name||'Empresa').join(', ');
  comparison.append(node('p','',`${label}: ${names} · ${format(max)}`));
 }
 target.append(comparison);
 const list=node('div','lite-result-list');
 for(const {company,item} of rows){
  const card=node('article','lite-result-company'),heading=node('div','lite-result-company-head'),identity=node('div');
  identity.append(node('h5','',company.name||'Empresa'));
  if(company.district_name)identity.append(node('p','','Mercado: '+company.district_name));
  heading.append(identity);card.append(heading);
  if(!item?.result){heading.append(node('span','lite-result-caption','Resultado pendiente'));card.append(node('p','lite-result-caption','Esta empresa aún no tiene un resultado oficial para el ciclo.'));list.append(card);continue}
  const value=item.result,figures=node('div','lite-result-figures');
  figures.append(metric('Cantidad confirmada',item.decision?integer(item.decision.quantity):'—'),metric('Bolsos vendidos',integer(value.sold)),metric('Ingresos',money(value.revenue)),metric('Costo de ventas',money(value.costOfSales)),
    metric('Utilidad del ciclo',money(value.profit),true),metric('Caja final',money(value.cashEnd)));
  if(safe(value.profit)&&Number(value.profit)<0)figures.querySelector('.focus')?.classList.add('negative');
  card.append(figures);
  const explanation=node('div','lite-result-explanation');
  if(safe(value.sold)&&safe(value.revenue))explanation.append(node('p','',`Vendió ${integer(value.sold)} bolsos y recibió ${money(value.revenue)} en ingresos.`));
  if(safe(value.costOfSales))explanation.append(node('p','',`El costo de los bolsos vendidos fue ${money(value.costOfSales)}.`));
  if(safe(value.profit))explanation.append(node('p','',Number(value.profit)<0?`Registró una pérdida de ${money(Math.abs(Number(value.profit)))} después de costos y marketing.`:`Obtuvo ${money(value.profit)} de utilidad después de costos y marketing.`));
  if(safe(value.cashEnd))explanation.append(node('p','',`Al cierre quedaron ${money(value.cashEnd)} en caja.`));
  if(item.decision===null)explanation.append(node('p','','No confirmó sus decisiones. Sin una decisión confirmada, el motor no realiza compras ni ventas en este ciclo.'));
  card.append(explanation);
  const cycleData=cycles.find(c=>Number(c.number)===cycle);
  const id=cycleData?.event_id || value.event;
  if(id&&global.SIDELiteEvents?.describe){const event=global.SIDELiteEvents.describe(id,value);const note=node('p','lite-result-event');note.append(node('strong','','Evento: '+event.name+'. '),document.createTextNode(event.description));card.append(note)}

  const details=node('details','lite-result-details');details.dataset.company=String(company.id);
  if(opened.has(String(company.id)))details.open=true;
  details.append(node('summary','','Ver decisiones'));
  const body=node('div','lite-result-detail-grid'),decision=item.decision;
  body.append(metric('Calidad elegida',decision?(quality[decision.quality]||decision.quality):'Sin decisión confirmada'),
    metric('Cantidad planificada',decision?integer(decision.quantity):'—'),
    metric('Precio por bolso',decision?money(decision.price):'—'),
    metric('Marketing decidido',decision?money(decision.marketingAmount):'—'));
  details.append(body);
  card.append(details);list.append(card);
 }
 target.append(list);
}
global.SIDELiteTeacherResults={render};
})(window);
