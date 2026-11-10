(() => {
  'use strict';
  const teacher = !!document.querySelector('.app-shell [data-tab="configuracion"]');
  const root = teacher ? document.body : document.getElementById('decisionMenu');
  if (!root) return;
  const allSteps = teacher ? [
    ['[data-tab="configuracion"]','Configuración','Crea la partida y ajusta sus reglas y horarios.'],
    ['[data-tab="empresas"]','Empresas','Administra las empresas participantes y consulta sus decisiones y avance.'],
    ['[data-tab="rondas"], [data-tab="configuracion"]','Ciclos y eventos','Configura el avance manual o automático; con una partida activa podrás gestionar sus ciclos y eventos.'],
    ['[data-tab="resultados"]','Resultados','Consulta los resultados y el desempeño de las empresas.'],
    ['[data-tab="podio"]','Ganador y podio','Revisa la clasificación de la partida.'],
    ['[data-tab="laboratorio"]','Laboratorio Estratégico','Explora resultados y escenarios para apoyar el análisis.']
  ] : [
    ['[data-cat="quality"]','Calidad','Selecciona la calidad de los bolsos que producirá tu empresa.'],
    ['[data-cat="quantity"]','Cantidad','Elige cuántos bolsos producir.'],
    ['[data-cat="price"]','Precio','Establece el precio de venta por bolso.'],
    ['[data-cat="marketingAmount"]','Marketing','Decide cuánto invertir en publicidad.']
  ];
  let steps=[];
  const help = document.createElement('button');
  help.type='button'; help.className='coach-help'; help.textContent='?'; help.setAttribute('aria-label','Repetir guía interactiva');
  (teacher ? document.querySelector('.top-actions') : document.querySelector('.decision-topbar-actions')).prepend(help);
  const layer=document.createElement('div'); layer.className='coach-layer'; layer.hidden=true;
  layer.innerHTML='<div class="coach-spot" aria-hidden="true"></div><section class="coach-card" role="dialog" aria-labelledby="coach-title" aria-describedby="coach-description" tabindex="-1"><div class="coach-progress" aria-live="polite"></div><h2 id="coach-title"></h2><p id="coach-description"></p><div class="coach-actions"><button type="button" data-action="skip">Saltar</button><span></span><button type="button" data-action="back">Anterior</button><button type="button" data-action="next">Siguiente</button></div></section>';
  document.body.append(layer);
  const card=layer.querySelector('.coach-card'), spot=layer.querySelector('.coach-spot');
  let index=-1, key='', active=false, scheduled=false, lastFocus=null, invitation=false, identityReady=!teacher, suspended=false;
  const visible=el=>!!el && !!el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && !el.closest('[hidden], .hidden, [aria-hidden="true"]') && !el.matches(':disabled, [aria-disabled="true"]');
  function target(step){for(const selector of step[0].split(',')){const el=[...document.querySelectorAll(selector.trim())].find(visible);if(el)return el}}
  function otherDialog(){return [...document.querySelectorAll('[role=dialog][aria-modal=true], [role=alertdialog][aria-modal=true], dialog[open]')].some(el=>!layer.contains(el)&&visible(el))}
  function persist(){try{localStorage.setItem(key,'1')}catch{}}
  function end(){active=false;suspended=false;layer.hidden=true; spot.hidden=true; lastFocus?.focus({preventScroll:true})}
  function position(){
    if(!active || invitation || suspended)return;
    const el=target(steps[index]); if(!el){spot.hidden=true;return}
    const r=el.getBoundingClientRect(), pad=5, vw=innerWidth, vh=innerHeight;
    if(r.bottom<=0||r.top>=vh||r.right<=0||r.left>=vw){spot.hidden=true; card.style.left='12px';card.style.top='12px';return}
    spot.hidden=false;
    Object.assign(spot.style,{left:Math.max(0,r.left-pad)+'px',top:Math.max(0,r.top-pad)+'px',width:Math.min(vw,r.right+pad)-Math.max(0,r.left-pad)+'px',height:Math.min(vh,r.bottom+pad)-Math.max(0,r.top-pad)+'px'});
    const w=card.offsetWidth,h=card.offsetHeight,gap=14;
    let x=r.right+gap,y=r.top;
    if(el.closest('#decisionTabs')){x=Math.max(12,Math.min(vw-w-12,r.left));y=r.bottom+gap;if(y+h>vh-12)y=r.top-h-gap}
    else {if(x+w>vw-12)x=r.left-w-gap;if(x<12){x=Math.max(12,Math.min(vw-w-12,r.left));y=r.bottom+gap;if(y+h>vh-12)y=r.top-h-gap}}
    card.style.left=Math.max(12,Math.min(vw-w-12,x))+'px'; card.style.top=Math.max(12,Math.min(vh-h-12,y))+'px';
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;position()})}}
  function render(){
    const step=steps[index]; if(!step)return end();
    const el=target(step), nav=el?.closest('#decisionTabs');
    if(nav && (el.offsetLeft < nav.scrollLeft || el.offsetLeft + el.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft=el.offsetLeft;
    invitation=false; layer.querySelector('.coach-progress').textContent=`${index+1} de ${steps.length}`;
    layer.querySelector('#coach-title').textContent=step[1];layer.querySelector('#coach-description').textContent=step[2];
    layer.querySelector('[data-action="back"]').hidden=index===0;
    layer.querySelector('[data-action="next"]').textContent=index===steps.length-1?'Finalizar':'Siguiente';
    position();card.focus({preventScroll:true});
  }
  function open(invite){if(otherDialog())return;steps=allSteps.filter(step=>target(step));if(!steps.length)return;lastFocus=document.activeElement;active=true;invitation=invite;layer.hidden=false;index=0;
    if(!invite){render();return} spot.hidden=true;card.style.left='50%';card.style.top='50%';card.style.transform='translate(-50%, -50%)';
    layer.querySelector('.coach-progress').textContent='BIENVENIDA';layer.querySelector('#coach-title').textContent='Conoce SIDE';layer.querySelector('#coach-description').textContent='Descubre las secciones principales en una guía breve.';
    layer.querySelector('[data-action="back"]').hidden=true;layer.querySelector('[data-action="next"]').textContent='Iniciar';card.focus({preventScroll:true});
  }
  layer.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
    if(action==='skip'){persist();end();return}
    if(action==='back'){index=Math.max(0,index-1);render();return}
    if(invitation){card.style.transform='';render();return}
    if(index===steps.length-1){persist();end();return}index++;render();
  });
  document.addEventListener('keydown',e=>{if(!active || suspended)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();persist();end()}},true);
  document.addEventListener('click',e=>{if(!active||invitation||suspended||layer.contains(e.target))return;const nav=e.target.closest(teacher?'[data-tab]':'#decisionTabs [data-cat]');if(!nav)return;const next=steps.findIndex(step=>target(step)===nav);if(next>=0&&next!==index){index=next;requestAnimationFrame(()=>{if(active&&!suspended)render()})}},true);
  help.addEventListener('click',()=>{if(!identityReady)return;card.style.transform='';open(false)});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  // The navigation is rebuilt by SIDE; resolve the target again after each update.
  const observer=new MutationObserver(records=>{if(records.every(record=>layer.contains(record.target)))return;if(!teacher && !visible(root)){if(active)end();return}if(otherDialog()){if(active&&!suspended){suspended=true;layer.hidden=true}return}if(suspended){suspended=false;layer.hidden=false;if(invitation)card.focus({preventScroll:true});else render()}if(active&&!invitation){if(!target(steps[index])){steps.splice(index,1);if(!steps.length){end()}else{index=Math.min(index,steps.length-1);render()}}else schedule()}check()});
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled','aria-disabled','aria-hidden','open']});
  let checkedKey='';
  function check(){
    if(!identityReady || otherDialog() || (!teacher && (!visible(root)||!document.querySelector('#decisionTabs [data-cat]'))))return;
    let identity='local';
    if(!teacher){identity='lite';}
    else identity=window.__sideCoachTeacherId||'local';
    key=`SIDE_COACHMARK_V1_${teacher?'teacher':'student'}_${identity}`;
    if(checkedKey===key)return;checkedKey=key;
    try{if(!localStorage.getItem(key))open(true)}catch{open(true)}
  }
  if(teacher && window.SIDE?.SupabaseClient?.get()){
    window.SIDE.SupabaseClient.get().auth.getSession().then(({data})=>{window.__sideCoachTeacherId=data?.session?.user?.id||'local';identityReady=true;check()}).catch(()=>{identityReady=true;check()});
  }else {identityReady=true;check()}
})();
