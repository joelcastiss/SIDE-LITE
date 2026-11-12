import './lite-events.js';
import {renderLaboratory} from '../laboratory.js';
import {EVENTS,closeCycle,rank} from '../laboratory-engine.js';
const $=id=>document.getElementById(id);
const tabs=[...document.querySelectorAll('.nav-btn[data-tab]')];
const titles={configuracion:'Configuración de la simulación',rondas:'Ciclos y eventos',empresas:'Empresas participantes',resultados:'Resultados',podio:'Ganador y podio',historial:'Historial · última partida',laboratorio:'Laboratorio Estratégico'};
for(const button of tabs)button.addEventListener('click',()=>{
 tabs.forEach(item=>item.classList.toggle('active',item===button));
 document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id==='tab-'+button.dataset.tab));
 $('pageTitle').textContent=titles[button.dataset.tab]||'Panel docente';
});
$('backHome').addEventListener('click',()=>location.href='index.html');
const toast=message=>{const el=$('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4000)};
$('saveAll').addEventListener('click',()=>toast('Configuración de demostración disponible durante esta visita. No se ha creado una partida real.'));
// Only SIDE-LITE settings are offered; the cards and design are from the original panel.
for(const id of ['demandLosOlivos','taxRegime','startDate'])$(id).closest('article').remove();
$('financeConfigHelp').textContent='El capital inicial se utiliza en esta demostración local.';
const cycleCard=$('cycles').closest('article');
cycleCard.innerHTML='<div class="card-title"><h3>Duración y ciclos</h3><span>120 segundos por ciclo</span></div><label>Número de ciclos<select id="cycles"><option value="3">3</option><option value="6" selected>6</option></select></label><label>Duración por ciclo<input value="120 segundos" readonly></label><p class="hint">Cada ciclo de SIDE-LITE dura 120 segundos.</p>';
for(const radio of document.querySelectorAll('[name="capitalMode"]'))radio.addEventListener('change',()=>{$('fixedCapitalFields').classList.toggle('hidden',$('capitalModeRandom').checked);$('randomCapitalFields').classList.toggle('hidden',!$('capitalModeRandom').checked)});
$('tab-configuracion').querySelector('.hero-card p').textContent='Configura una demostración independiente. Para administrar una sala real inicia sesión con autorización docente.';
$('configReadySummary').textContent='Revisa la configuración de la demostración.';
$('configReadySummary').nextElementSibling.textContent='Los datos se mantienen solo durante esta visita.';
const selected=new Set();
const summary=()=>{$('enabledEventsSummary').textContent=selected.size?EVENTS.filter(e=>selected.has(e.id)).map(e=>e.label).join(' · '):'Sin eventos habilitados.';$('eventSelectionCount').textContent=`${selected.size} seleccionados`};
const dialog=$('eventPicker');
dialog.querySelector('.event-bank-card').innerHTML='<div class="card-title"><div><h3 id="eventPickerTitle">Seleccionar eventos</h3><p>Eventos del motor SIDE-LITE para esta demostración.</p></div><span id="eventSelectionCount">0 seleccionados</span></div><div id="demo-events" class="grid two"></div>';
for(const event of EVENTS){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=event.id;box.addEventListener('change',()=>{box.checked?selected.add(event.id):selected.delete(event.id);summary()});label.append(box,document.createTextNode(' '+event.label));$('demo-events').append(label)}
$('openEventPicker').onclick=()=>dialog.showModal();$('closeEventPicker').onclick=()=>dialog.close();$('eventSelectAll').onclick=()=>{const boxes=[...$('demo-events').querySelectorAll('input')],check=boxes.some(b=>!b.checked);for(const b of boxes){b.checked=check;check?selected.add(b.value):selected.delete(b.value)}summary()};
const money=n=>'S/ '+Number(n).toLocaleString('es-PE');
let game=null,interval=null,seconds=120;
const button=id=>$(id);function updateClock(){const min=Math.floor(seconds/60),sec=seconds%60;$('roundTimer').textContent=`00:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function beginDemo(){
 const fixed=Number($('capital').value),min=Number($('capitalMin').value),max=Number($('capitalMax').value),random=$('capitalModeRandom').checked;
 if(!Number.isSafeInteger(fixed)||fixed<1||!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<1||max<min){toast('Revisa los valores del capital inicial.');return}
 clearInterval(interval);interval=null;seconds=120;
 const capital=()=>random?min+Math.floor(Math.random()*(max-min+1)):fixed;
 game={round:1,limit:Number($('cycles').value),companies:['Empresa ejemplo A','Empresa ejemplo B'].map((name,i)=>{const initialCapital=capital();return {id:'demo-'+i,name,initialCapital,cash:initialCapital,inventory:[],results:[],decision:{quality:'standard',quantity:10,price:100,marketingAmount:0}}}),history:[]};
 $('gameStatusBanner').textContent='Demostración local en curso. Las empresas y los resultados son ejemplos; no participan estudiantes reales.';
 $('roundState').textContent='Listo para simular';$('roundDisplay').textContent=`1 / ${game.limit}`;updateClock();renderDemo();document.querySelector('[data-tab="rondas"]').click();
}
$('demo-start').onclick=beginDemo;
function closeDemoCycle(){
 if(!game){toast('Inicia primero una demostración.');return}if(game.round>game.limit){toast('La demostración terminó.');return}
 clearInterval(interval);interval=null;seconds=120;const events=[...selected],event=events.length?events[(game.round-1)%events.length]:null;
 let computed;try{computed=game.companies.map(c=>closeCycle({cash:c.cash,batches:c.inventory,costs:{basic:50,standard:80,premium:120},event,decision:c.decision,seed:'SIDE-LITE-DEMO-'+game.round,companyId:c.id}))}catch(error){$('roundState').textContent='Revisa las decisiones de ejemplo';toast(error.message);return}
 game.companies.forEach((c,i)=>{const result=computed[i];c.cash=result.cashEnd;c.inventory=result.inventory;c.results.push(result)});
 game.history.push(game.round);game.round++;$('roundDisplay').textContent=`${Math.min(game.round,game.limit)} / ${game.limit}`;$('roundState').textContent=game.round>game.limit?'Demostración finalizada':'Ciclo cerrado · listo para el siguiente';$('roundSummary').textContent='Resultados simulados localmente con el motor SIDE-LITE.';updateClock();renderDemo();
}
$('startTimer').onclick=()=>{if(!game){toast('Inicia primero una demostración.');return}if(game.round>game.limit){toast('La demostración terminó.');return}if(interval)return;$('roundState').textContent='Ciclo de demostración en curso';interval=setInterval(()=>{seconds--;updateClock();if(seconds<=0)closeDemoCycle()},1000)};
$('cutRound').onclick=closeDemoCycle;$('advanceRound').onclick=closeDemoCycle;
function renderDemo(){
 if(!game)return;
 $('companiesLiveStatus').textContent='Empresas de ejemplo locales; no hay estudiantes conectados.';
 $('companiesGrid').innerHTML=game.companies.map(c=>`<article class="card"><h3>${c.name}</h3><p>Empresa simulada · edita una decisión de ejemplo</p><p>Caja: <strong>${money(c.cash)}</strong></p><form class="demo-decision" data-company="${c.id}"><label>Calidad<select name="quality"><option value="basic">Básica</option><option value="standard">Estándar</option><option value="premium">Prémium</option></select></label><label>Cantidad<input name="quantity" type="number" min="0" max="100000" step="1" value="${c.decision.quantity}" required></label><label>Precio de venta<input name="price" type="number" min="1" max="100000" step="1" value="${c.decision.price}" required></label><label>Marketing (S/ 0 o 200–10.000)<input name="marketingAmount" type="number" min="0" max="10000" step="1" value="${c.decision.marketingAmount}" required></label></form></article>`).join('');
 for(const form of document.querySelectorAll('.demo-decision')){const c=game.companies.find(item=>item.id===form.dataset.company);form.elements.quality.value=c.decision.quality;form.addEventListener('input',()=>{c.decision={quality:form.elements.quality.value,quantity:Number(form.elements.quantity.value),price:Number(form.elements.price.value),marketingAmount:Number(form.elements.marketingAmount.value)}});form.addEventListener('submit',event=>event.preventDefault())}
 const completed=game.companies.some(c=>c.results.length);
 $('resultStats').innerHTML=completed?game.companies.map(c=>{const r=c.results.at(-1);return `<article class="card"><h3>${c.name}</h3><p>Unidades vendidas: ${r.sold}</p><p>Ingresos: ${money(r.revenue)}</p><p>Costo de ventas: ${money(r.costOfSales)}</p><p>Utilidad: ${money(r.profit)}</p><p>Caja: ${money(r.cashEnd)}</p><p>${globalThis.SIDELiteEvents.text(r.event,r)}</p></article>`}).join(''):'<p>Los resultados simulados aparecerán al cerrar un ciclo de demostración.</p>';
 $('detailReports').textContent='Estos datos son simulados y no corresponden a una partida oficial.';
 const ranking=rank(game.companies.map(c=>({...c,inventoryValue:c.inventory.reduce((n,b)=>n+b.quantity*b.unitCost,0)})));
 $('sidePodium').innerHTML=ranking.map((c,i)=>`<p>${i+1}. ${c.name} · ${c.returnPercent.toFixed(1)} %</p>`).join('');$('podiumPreview').textContent='Clasificación de ejemplo, no publicada.';
 $('historyStatus').textContent=game.history.length?'Ciclos simulados durante esta visita.':'Aún no hay ciclos simulados.';
 $('historyContent').innerHTML=game.history.map(n=>`<article class="card"><h3>Ciclo ${n} · demostración</h3><p>${globalThis.SIDELiteEvents.text(game.companies[0].results[n-1].event)}</p>${game.companies.map(c=>`<p>${c.name}: utilidad ${money(c.results[n-1].profit)}, caja ${money(c.results[n-1].cashEnd)}</p>`).join('')}</article>`).join('');
}
$('roundSummary').textContent='Inicia una demostración local para probar el ciclo.';updateClock();
$('cycleNews').textContent='Sin eventos simulados.';$('eventLog').textContent='Aún no hay eventos.';
$('companiesLiveStatus').textContent='Sin estudiantes conectados. Inicia una demostración para ver empresas de ejemplo.';
$('detailReports').textContent='Inicia una demostración y cierra un ciclo para ver resultados simulados.';
$('sidePodium').textContent='La clasificación de ejemplo aparecerá al iniciar una demostración.';$('podiumPreview').textContent='Sin clasificación publicada.';
$('historyStatus').textContent='Aún no hay ciclos simulados.';
$('refreshReports').onclick=()=>{renderDemo();toast('Vista de demostración actualizada.')};$('refreshHistory').onclick=()=>{renderDemo();toast('Historial de demostración actualizado.')};$('clearEvents').onclick=()=>{$('eventLog').textContent='Aún no hay eventos.'};
for(const id of ['publishPodium','podiumPublishNow','podiumCancelSchedule','podiumReschedule','viewPdf','downloadPdf']){const el=$(id);if(el){el.disabled=true;el.title='Disponible en una partida real autorizada.'}}
$('sidePodium').closest('article').querySelector('.hint').textContent='La clasificación de ejemplo se ordena por rentabilidad, utilizando el motor SIDE-LITE.';
$('tab-podio').querySelector('.hero-card p').textContent='Clasificación simulada según la rentabilidad del motor SIDE-LITE. No es un resultado oficial.';
$('tab-podio').querySelector('.podium-publish').innerHTML='<div class="card-title"><h3>Publicación del podio</h3></div><p>La publicación está disponible al administrar una partida real con autorización docente.</p><a href="index.html?acceso=docente" class="secondary">Administrar partidas reales</a>';
renderLaboratory($('demo-laboratorio'));
// Without historical data, the laboratory must not describe example results as official.
for(const b of document.querySelectorAll('#demo-laboratorio [data-lab-tab]'))b.addEventListener('click',()=>{if(b.dataset.labTab!=='simulate')$('lab-status').textContent='No hay resultados reales en esta demostración.'});
