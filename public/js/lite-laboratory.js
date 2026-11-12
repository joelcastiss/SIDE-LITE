import {laboratoryLineChart} from '../laboratory.js?v=20261112';

// El servidor entrega únicamente cierres del docente y ejecuta escenarios sin persistirlos.
const api=window.SIDLiteGame;
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>'S/ '+Number(x??0).toLocaleString('es-PE',{maximumFractionDigits:2});
const status=$('lab-status'), content=$('lab-content');
let data=null, tab='results', requestNumber=0, opened=false;
const selected=()=>data?.records.find(r=>r.cycle_id===$('lab-cycle').value && r.company_id===$('lab-company').value);
function options(el,items,label,preferred){el.replaceChildren();for(const item of items){const option=document.createElement('option');option.value=item.id;option.textContent=label(item);el.append(option)}if(items.some(i=>String(i.id)===String(preferred)))el.value=preferred;}
function metrics(r){return `<div class="lab-metrics">${[['Ingresos',money(r.revenue)],['Utilidad',money(r.profit)],['Caja final',money(r.cashEnd)],['Unidades vendidas',Number(r.sold??0).toLocaleString('es-PE')]].map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;}
function detail(r){
 const signed=(value,forceSign=false)=>{const n=Number(value??0);return (n<0?'−':forceSign&&n>0?'+':'')+money(Math.abs(n));};
 const rows=[['Ingresos',r.revenue,'income'],['Costo de ventas',-Math.abs(Number(r.costOfSales??0)),'expense'],['Marketing',-Math.abs(Number(r.marketing??0)),'expense'],['Utilidad',r.profit,'profit'],['Caja final',r.cashEnd,'cash']];
 return `<div class="lab-chart lab-finance"><h3>Resultado económico</h3><table aria-label="Resultado económico"><tbody>${rows.map(([label,value,kind])=>`<tr class="lab-finance-${kind}${kind==='profit'?(Number(value)<0?' is-negative':Number(value)>0?' is-positive':''):''}"><th scope="row">${esc(label)}</th><td>${esc(signed(value,kind==='profit'))}</td></tr>`).join('')}</tbody></table></div>`;
}
function render(){
 document.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===tab)));
 const row=selected(); content.replaceChildren();
 if(!data){status.textContent='Selecciona una partida para consultar sus cierres.';return}
 if(!data.cycles.length){status.textContent='Esta partida todavía no tiene ciclos cerrados.';return}
 if(!row){status.textContent='No hay resultado para esta empresa en el ciclo seleccionado.';return}
 status.textContent='Cierre oficial · los escenarios no modifican la partida.';
 const company=data.companies.find(c=>c.id===row.company_id);const cycle=data.cycles.find(c=>c.id===row.cycle_id);
 const heading=`<p class="lab-context">${esc(company?.name)} <span>·</span> Ciclo ${esc(cycle?.number)}</p>`;
 if(tab==='results'){
  const previous=data.cycles.filter(c=>c.number<=cycle.number).map(c=>[c.number,data.records.find(r=>r.cycle_id===c.id&&r.company_id===row.company_id)?.result?.profit??null]);
  const d=row.decision;content.innerHTML=heading+metrics(row.result)+detail(row.result)+(d?`<p class="lab-decision-summary"><strong>Decisión confirmada:</strong> ${esc(({basic:'Básica',standard:'Estándar',premium:'Prémium'})[d.quality]||d.quality)} · ${esc(d.quantity)} unidades · Precio ${esc(money(d.price))} · Marketing ${esc(money(d.marketingAmount))}</p>`:'<p>No hubo decisión confirmada en este ciclo.</p>')+laboratoryLineChart('Evolución de la utilidad',previous,'S/',{student:true});return;
 }
 if(tab==='compare'){
  const rows=data.records.filter(r=>r.cycle_id===cycle.id);content.innerHTML=heading+`<div class="lab-chart"><h3>Comparación de empresas</h3><table><thead><tr><th>Empresa</th><th>Ventas</th><th>Ingresos</th><th>Utilidad</th><th>Caja final</th></tr></thead><tbody>${rows.map(r=>`<tr><th>${esc(data.companies.find(c=>c.id===r.company_id)?.name||'Empresa')}</th><td>${esc(r.result.sold)}</td><td>${esc(money(r.result.revenue))}</td><td>${esc(money(r.result.profit))}</td><td>${esc(money(r.result.cashEnd))}</td></tr>`).join('')}</tbody></table><p>Las condiciones de cada empresa pueden ser diferentes.</p></div>`;return;
 }
 const d=row.decision||{quality:'standard',quantity:0,price:100,marketingAmount:0};
 content.innerHTML=heading+`<p>Prueba otra decisión con la caja, inventario y condiciones del inicio de este ciclo. La simulación no guarda cambios.</p><form id="lite-lab-scenario" class="lab-options"><label>Calidad<select name="quality"><option value="basic">Básica</option><option value="standard">Estándar</option><option value="premium">Prémium</option></select></label><label>Cantidad<input name="quantity" type="number" min="0" max="100000" step="1" required value="${esc(d.quantity)}"></label><label>Precio (S/)<input name="price" type="number" min="1" max="100000" step="1" required value="${esc(d.price)}"></label><label>Marketing (S/)<input name="marketingAmount" type="number" min="0" max="10000" step="1" required value="${esc(d.marketingAmount)}"></label><button class="secondary" type="submit">Simular decisión</button></form><p id="lite-lab-error" role="status"></p><div id="lite-lab-outcome"></div>`;
 const form=$('lite-lab-scenario');form.elements.quality.value=d.quality;
 form.addEventListener('submit',async event=>{event.preventDefault();const values=new FormData(form),button=form.querySelector('button'),err=$('lite-lab-error'),out=$('lite-lab-outcome');button.disabled=true;err.textContent='Calculando…';out.replaceChildren();try{const decision={quality:values.get('quality'),quantity:Number(values.get('quantity')),price:Number(values.get('price')),marketingAmount:Number(values.get('marketingAmount'))};const response=await api.request('/games/'+$('lab-game').value+'/laboratory/simulate','POST',{cycleId:cycle.id,companyId:company.id,decision},'teacher');if(!form.isConnected)return;err.textContent='Simulación educativa; la partida oficial no se ha modificado.';out.innerHTML='<h3>Escenario alternativo</h3>'+metrics(response.result)+detail(response.result)+'<h3>Resultado oficial</h3>'+metrics(row.result);}catch(error){if(form.isConnected)err.textContent=error.message||'No se pudo calcular el escenario.'}finally{button.disabled=false}});
}
async function loadGame(){const token=++requestNumber,id=$('lab-game').value;data=null;content.replaceChildren();options($('lab-company'),[],()=> '');options($('lab-cycle'),[],()=> '');if(!id){status.textContent='No hay partidas disponibles.';return}status.textContent='Consultando ciclos cerrados…';try{const result=await api.request('/games/'+id+'/laboratory','GET',undefined,'teacher');if(token!==requestNumber)return;data=result;options($('lab-company'),data.companies,c=>c.name);options($('lab-cycle'),data.cycles,c=>'Ciclo '+c.number);render()}catch(error){if(token===requestNumber)status.textContent=error.message||'No se pudo consultar el laboratorio.'}}
async function loadGames(){const token=++requestNumber;status.textContent='Consultando partidas…';try{const games=await api.request('/games','GET',undefined,'teacher');if(token!==requestNumber)return;let remembered='';try{remembered=sessionStorage.getItem('side-lite-teacher-game')||''}catch{}options($('lab-game'),games,g=>`${g.name} · ${g.code}`,$('lab-game').value||remembered);await loadGame()}catch(error){if(token===requestNumber)status.textContent=error.message||'No se pudieron consultar las partidas.'}}
document.addEventListener('side-lite-laboratory-open',()=>{if(!opened){opened=true;void loadGames()}});
$('lab-refresh').addEventListener('click',()=>void loadGames());$('lab-game').addEventListener('change',()=>void loadGame());$('lab-company').addEventListener('change',render);$('lab-cycle').addEventListener('change',render);
document.querySelectorAll('[data-lab-tab]').forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.labTab;render()}));

if ($('tab-laboratorio')?.classList.contains('active') && !opened) { opened=true; void loadGames(); }
