// Adaptador de los informes PDF de SIDE1 para resultados oficiales de SIDE-LITE.
import './teacher-report-pdf-original.js';

/** Select only the latest closed cycle; never include an open-cycle decision or seed. */
export function reportSnapshot(data){
 if(!data?.isTeacher)throw new Error('Solo el docente de la partida puede generar informes.');
 const last=[...(data.cycles||[])].filter(c=>c.status==='closed').sort((a,b)=>a.number-b.number).at(-1);
 if(!last)throw new Error('Aún no hay resultados de ciclos cerrados.');
 const names=new Map((data.companies||[]).map(c=>[c.id,c.name]));
 const rows=(data.results||[]).filter(r=>r.cycle_id===last.id&&r.number===last.number&&names.has(r.company_id));
 if(!rows.length)throw new Error('Aún no hay resultados de ciclos cerrados.');
 const reports=rows.map(({company_id,result:v})=>({empresa:names.get(company_id),ronda:last.number,ingresos:v.revenue,utilidad:v.profit,caja:v.cashEnd,capital:v.cashStart,
  estadoResultados:{ventasNetas:v.revenue,costoVentas:v.costOfSales,gastosVentas:v.marketing,utilidad:v.profit,utilidadNeta:v.profit},
  balanceCaja:{cajaInicial:v.cashStart,cajaFinal:v.cashEnd},eventos:v.event?[{titulo:v.event.label,cicloAfecta:last.number}]:[]}));
 return {reports,config:{nombre:data.game.name,codigo:data.game.code,round:last.number,cycles:data.game.cycle_count}};
}
let vendorPromise;
function loadPdf(){
 if(globalThis.jspdf?.jsPDF)return Promise.resolve(globalThis.jspdf.jsPDF);
 if(!vendorPromise)vendorPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='vendor/jspdf.umd.min.js';script.onload=()=>globalThis.jspdf?.jsPDF?resolve(globalThis.jspdf.jsPDF):reject(new Error('No se pudo cargar el generador PDF.'));
  script.onerror=()=>reject(new Error('No se pudo cargar el generador PDF.'));document.head.append(script);
 }).catch(error=>{vendorPromise=null;throw error});
 return vendorPromise;
}
/** Original SIDE result controls and PDF preview modal; data are supplied by the authorized game endpoint. */
export function renderTeacherReports(container,{getData}){
 container.innerHTML=`<div class="top-actions"><button id="viewPdf" class="secondary" type="button">Ver PDF</button><button id="downloadPdf" class="primary" type="button">Descargar PDF</button></div><p class="hint">El PDF incluye los resultados oficiales del último ciclo cerrado.</p><p id="report-status" role="status" aria-live="polite"></p><div id="pdfModal" class="modal hidden"><div class="modal-panel"><button id="closePdf" class="modal-close" type="button" aria-label="Cerrar vista previa">×</button><h2>Reporte PDF de la simulación</h2><iframe id="pdfFrame" title="Vista previa PDF"></iframe></div></div>`;
 const preview=container.querySelector('#viewPdf'),download=container.querySelector('#downloadPdf'),status=container.querySelector('#report-status'),modal=container.querySelector('#pdfModal'),frame=container.querySelector('#pdfFrame');let pdfUrl=null,busy=false;
 const close=()=>{modal.classList.add('hidden');frame.removeAttribute('src');if(pdfUrl){URL.revokeObjectURL(pdfUrl);pdfUrl=null}};
 container.querySelector('#closePdf').onclick=close;
 async function exportPdf(show){if(busy)return;busy=true;preview.disabled=download.disabled=true;status.textContent='';try{
  const data=await getData();const {reports,config}=reportSnapshot(data);const jsPDF=await loadPdf();const doc=globalThis.SIDE_TEACHER_PDF.create({jsPDF,reports,config});
  if(show){close();pdfUrl=URL.createObjectURL(doc.output('blob'));frame.src=pdfUrl;modal.classList.remove('hidden')}else{const code=String(config.codigo||'SIDE').replace(/[^a-z0-9_-]/gi,'');doc.save(`${code}-resultados.pdf`)}
 }catch(error){status.textContent=error.message||'No se pudo generar el PDF.'}finally{busy=false;preview.disabled=download.disabled=false}}
 preview.onclick=()=>exportPdf(true);download.onclick=()=>exportPdf(false);return {close};
}
