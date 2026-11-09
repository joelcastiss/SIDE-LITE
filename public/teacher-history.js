// Adaptador Lite para el historial de SIDE1. Solo procesa resultados oficiales cerrados.
import './teacher-history-original.js';

export function completedHistorySnapshot(data){
 if(!data?.isTeacher)throw new Error('Solo el docente propietario puede consultar el historial.');
 const game=data.game,cycles=data.cycles||[],last=cycles.at(-1);
 if(!last||last.status!=='closed'||last.number!==game.cycle_count)return null;
 const closed=new Set(cycles.filter(c=>c.status==='closed').map(c=>c.id));
 const results=(data.results||[]).filter(r=>closed.has(r.cycle_id));
 return {partida:{codigo:game.code,nombre:game.name,ciclos_jugados:last.number,finalizada_at:last.ends_at,fecha_aproximada:true},empresas:(data.companies||[]).map(company=>({
  id:company.id,nombre_comercial:company.name,caja_actual:company.cash,
  reportes:results.filter(r=>r.company_id===company.id).map(r=>({ciclo:r.number,ingresos:r.result.revenue,costos:r.result.costOfSales,utilidad:r.result.profit,caja_final:r.result.cashEnd,capital:r.result.cashStart,estado_resultados:{ingresos:r.result.revenue,costos:r.result.costOfSales,utilidad:r.result.profit},balance_caja:{cajaInicial:r.result.cashStart,cajaFinal:r.result.cashEnd}})),decisiones:[]
 }))};
}

// Quote every field and neutralize formulas even if the name starts with whitespace.
function csvCell(value){let s=String(value??'');if(typeof value==='string'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
export function completedResultsCsv(data){
 const snapshot=completedHistorySnapshot(data);if(!snapshot)throw new Error('Solo se pueden exportar partidas finalizadas.');
 const names=new Map((data.companies||[]).map(c=>[c.id,c.name]));const closed=new Set(data.cycles.filter(c=>c.status==='closed').map(c=>c.id));
 const rows=[['Partida','Código','Empresa','Ciclo','Ventas (unidades)','Ingresos (S/)','Costo de ventas (S/)','Marketing (S/)','Utilidad (S/)','Caja final (S/)']];
 for(const r of data.results||[]){if(!closed.has(r.cycle_id))continue;const v=r.result;rows.push([data.game.name,data.game.code,names.get(r.company_id)||'Empresa',r.number,v.sold,v.revenue,v.costOfSales,v.marketing,v.profit,v.cashEnd])}
 return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

// HTML markup directly adapted from SIDE1 docente.html section tab-historial.
export function renderTeacherHistory(container,{listGames,loadGame}){
 container.innerHTML=`<div class="section-head"><div class="teacher-section-title"><span class="teacher-section-icon" aria-hidden="true"><img src="assets/icons/teacher/resultados.svg" alt=""></span><div><h2 id="historyHeading">Historial</h2><p>Cierres oficiales de tus partidas anteriores.</p></div></div><button id="refreshHistory" class="secondary" type="button">Actualizar historial</button></div><div class="info-banner teacher-guide">Selecciona una empresa y despliega sus ciclos para revisar los resultados registrados. Esta consulta es de solo lectura.</div><label>Partida anterior<select id="historyGameSelect" aria-label="Partida del historial"></select></label><button id="downloadHistoryCsv" class="secondary" type="button" hidden>Descargar informe CSV</button><p id="historyStatus" class="history-status" role="status" aria-live="polite"></p><div id="historyContent" aria-busy="false"></div>`;
 const select=container.querySelector('#historyGameSelect'),mount=container.querySelector('#historyContent'),status=container.querySelector('#historyStatus'),refresh=container.querySelector('#refreshHistory'),download=container.querySelector('#downloadHistoryCsv');
 let generation=0,cache=new Map(),selected=null;
 function display(data){selected=data;const snapshot=data?completedHistorySnapshot(data):null;mount.innerHTML=globalThis.SIDE_TEACHER_HISTORY.snapshotHtml(snapshot,null,[]);download.hidden=!snapshot;mount.querySelector('#historyCompanySelect')?.addEventListener('change',e=>{mount.innerHTML=globalThis.SIDE_TEACHER_HISTORY.snapshotHtml(snapshot,e.target.value,[]);mount.querySelector('#historyCompanySelect')?.addEventListener('change',()=>displayCompany(snapshot))})}
 function displayCompany(snapshot){const current=mount.querySelector('#historyCompanySelect')?.value;mount.innerHTML=globalThis.SIDE_TEACHER_HISTORY.snapshotHtml(snapshot,current,[]);mount.querySelector('#historyCompanySelect')?.addEventListener('change',()=>displayCompany(snapshot))}
 async function load(){const version=++generation;refresh.disabled=true;mount.setAttribute('aria-busy','true');status.textContent='Cargando partidas finalizadas…';download.hidden=true;try{const games=await listGames();const results=await Promise.all(games.map(g=>loadGame(g.id)));if(version!==generation)return;cache=new Map(results.filter(d=>d?.isTeacher&&completedHistorySnapshot(d)).map(d=>[String(d.game.id),d]));select.replaceChildren();for(const [id,d] of cache){const option=document.createElement('option');option.value=id;option.textContent=`${d.game.name} · ${d.game.code}`;select.append(option)}status.textContent=cache.size?'Partidas finalizadas · consulta de solo lectura.':' ';display(cache.values().next().value||null)}catch{if(version===generation){status.textContent='No se pudo consultar el historial. Revisa tu conexión o sesión y pulsa Actualizar.';display(null)}}finally{if(version===generation){refresh.disabled=false;mount.setAttribute('aria-busy','false')}}}
 select.addEventListener('change',()=>display(cache.get(select.value)||null));refresh.addEventListener('click',load);
 download.addEventListener('click',()=>{if(!selected)return;const url=URL.createObjectURL(new Blob([completedResultsCsv(selected)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='resultados-side-lite.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
 void load();return {refresh:load};
}
