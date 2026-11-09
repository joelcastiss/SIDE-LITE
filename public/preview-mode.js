export const staticPreview=new URLSearchParams(location.search).get('static')==='1';
const blocked=()=>Object.assign(new Error('Vista previa: esta acción requiere el backend y no guarda cambios.'),{status:403});
const now=()=>new Date().toISOString();
const game={id:'vista-previa',name:'Partida de demostración',code:'DEMO2026',cycle_count:3,duration_seconds:120,costs:{basic:50,standard:80,premium:120},enabled_events:[]};
const companies=[{id:'demo-a',name:'Empresa demostración A',store:'Plaza del Parque',cash:34500,initial_capital:30000,inventory:[]},{id:'demo-b',name:'Empresa demostración B',store:'Mercado Central',cash:32000,initial_capital:30000,inventory:[]}];
const result={sold:10,revenue:1200,profit:300,cashStart:30000,cashEnd:30300,purchase:700,costOfSales:700,marketing:200,demand:120,inventory:[]};
let role=null;
export function enterPreview(selected){role=selected;return {id:'demo-'+selected,display_name:selected==='teacher'?'Docente de demostración':'Estudiante de demostración',role:selected};}
export async function previewRequest(path,method='GET'){
 if(!staticPreview||!role)throw blocked();if(method!=='GET'){if(path==='/logout'){role=null;return {ok:true}}throw blocked()}
 if(path==='/me')return {id:'demo-'+role,role,display_name:role==='teacher'?'Docente de demostración':'Estudiante de demostración'};
 if(path==='/catalog')return [];
 if(path==='/games')return [game];
 if(path==='/games/'+game.id){const teacher=role==='teacher';const closed=[1,2,3].map(number=>({id:'c'+number,number,status:'closed',ends_at:now(),server_now:now()}));const active={id:'c3',number:3,status:'open',ends_at:new Date(Date.now()+120000).toISOString(),server_now:now()};const cycles=teacher?closed:[...closed.slice(0,2),active];return {game,isTeacher:teacher,company:teacher?null:companies[0],companies,cycles,decisions:[],ownDecision:null,results:(teacher?closed:closed.slice(0,2)).flatMap(c=>companies.filter(x=>teacher||x.id==='demo-a').map(x=>({cycle_id:c.id,company_id:x.id,number:c.number,result}))),ranking:companies.map((c,i)=>({id:c.id,name:c.name,returnPercent:15-i*8,cash:c.cash}))}}
 if(path.endsWith('/podium'))return {companies:companies.map(c=>({id:c.id,name:c.name,grade:17})),finished:true,podium:null};
 throw blocked();
}
if(staticPreview){document.addEventListener('click',event=>{const target=event.target.closest?.('#viewPdf,#downloadPdf,#downloadHistoryCsv');if(!target)return;event.preventDefault();event.stopImmediatePropagation();const status=document.querySelector('#report-status')||document.querySelector('#historyStatus')||document.querySelector('#error');if(status)status.textContent='Vista previa: la exportación oficial no está disponible.'},true)}
