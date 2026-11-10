const cfg=window.SIDE_CONFIG||{};
const hasConfig=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_URL.includes('TU-PROYECTO');
const supabaseClient=window.SIDE?.SupabaseClient?.get()||null;
const $=id=>document.getElementById(id);
const RULES=window.SIDE_RULES;
const EVENT_CATALOG=Array.isArray(window.SIDE_EVENT_CATALOG)?window.SIDE_EVENT_CATALOG:[];
const state={reports:[],events:[],round:1,timer:null,scheduleWatcher:null,seconds:600,roundClosed:false,enabledEvents:new Set(),eventSelectionMode:'manual',eventRules:{},partidaId:null,integrationMinutes:0,lifecycleVersion:2,authoritative:null,starting:false,cancelling:false,startingCycle1:false};
try{state.partidaId=localStorage.getItem('SIDE_PARTIDA_ID')||null}catch{state.partidaId=null}

function toast(msg,tone='notice'){const t=$('toast');if(!t)return;t.textContent=msg;t.dataset.tone=tone;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2800)}
let previousRoom=null,creationRequest=null,roomGeneration=0,sharedRoom=null;
function rememberSharedRoom(room){
  if(['finalizada','cancelada'].includes(room?.estado)&&room.id===sharedRoom?.id)sharedRoom=null;
  if(!room?.id||!room.codigo||!['esperando','activa'].includes(room.estado))return false;
  sharedRoom={id:room.id,codigo:room.codigo,estado:room.estado,profesor_id:room.profesor_id};
  $('gameCode').value=room.codigo;$('gameCodeBadge').textContent=room.codigo;
  ['copyGameCode','copyGameLink'].forEach(id=>{if($(id))$(id).disabled=false;});return true;
}
async function loadUsableRoom(config=null){
  const service=window.SIDE.PartidaService;
  const generation=roomGeneration;
  let result=await service.obtenerActiva();
  if(generation!==roomGeneration||state.cancelling)return {success:false,code:'OPERACION_SUPERADA',error:'La partida cambió durante la recuperación.'};
  if(!result.success&&['SALA_ANTIGUA','SALA_INCONSISTENTE'].includes(result.code)&&result.data?.id){
    const row=result.data;rememberSharedRoom(row);
    result=await service.recuperarSala(row.id,row.estado==='esperando'?config:null);
  }
  if(generation!==roomGeneration||state.cancelling)return {success:false,code:'OPERACION_SUPERADA',error:'La partida cambió durante la recuperación.'};
  if(result.terminal)sharedRoom=null;
  if(result.success&&result.data)rememberSharedRoom(result.data);
  return result;
}
function newCreationRequest(){
  if(crypto.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function creationFeedback(message,tone='error',conflict=null,notify=true){
  previousRoom=conflict;
  const box=$('creationFeedback');if(!box)return;
  delete box.dataset.source;
  box.classList.remove('hidden');box.dataset.tone=tone;$('creationMessage').textContent=message;
  $('retryCreate').classList.toggle('hidden',tone!=='error'||!!conflict);
  $('cancelGame')?.classList.toggle('hidden',!canCancelRoom());
  if(notify)toast(message,tone);
}
function canCancelRoom(room=previousRoom||sharedRoom){
  const owner=localStorage.getItem('SIDE_PROFESOR_ID');
  return Boolean(owner&&room?.id&&['esperando','activa'].includes(room.estado)&&(!room.profesor_id||room.profesor_id===owner));
}
function creationError(result){
  if(result.code==='SOLICITUD_FINALIZADA'){creationRequest=null;localStorage.removeItem('SIDE_CREATION_REQUEST');}
  const manageable=['SALA_ACTIVA','SALA_ANTIGUA','SALA_INCONSISTENTE'].includes(result.code);
  const message=manageable?result.error:'No se pudo crear la sala: '+(result.error||'el servidor no confirmó la operación. Reintenta.');
  console.error('SIDE: creación de sala',result);creationFeedback(message,manageable?'notice':'error',result.partida||(manageable?result.data:null));
}
function clearRoomLink(){
  roomGeneration++;
  confirmedReportClosures.clear();
  ownConfigRevisions.clear();
  stopLiveCompanies();
  sharedRoom=null;
  $('gameCode').value='';$('gameCodeBadge').textContent='Código pendiente';
  state.partidaId=null;state.authoritative=null;state.configRevision=null;state.formConfigRevision=null;teacherClock=null;state.reports=[];publishedState='';
  ['SIDE_PARTIDA_ID','SIDE_GAME_STATUS','SIDE_ROUND_RUNTIME','SIDE_EVENT_SCHEDULE'].forEach(k=>localStorage.removeItem(k));
}
function renderTeacherLobby(){
  const r=runtime(),active=!!state.partidaId&&!!gameStatus()?.active;
  $('teacherLobby')?.classList.toggle('hidden',!active);
  if(!active)return;
  $('lobbyHeading').textContent=r?.phase==='integration'?'Sala de espera':'Sala en curso';
  $('lobbyCode').textContent=$('gameCode').value;
  $('lobbyCountdown').textContent=r?.phase==='integration'?`El Ciclo 1 comienza en ${formatStudentTime(state.seconds)}.`:`Ciclo ${state.round} · ${formatStudentTime(state.seconds)}`;
  $('lobbyNext').textContent=state.authoritative?.cycleCloseMode==='manual'?'El Ciclo 1 inicia automáticamente; tú controlas el cierre de cada ciclo.':'El Ciclo 1 inicia automáticamente; los ciclos avanzan según la programación.';
  const companies=state.reports.filter(x=>x.fuente==='supabase'&&x.estado!=='eliminada'),container=$('lobbyCompanies');
  if(!companies.length){
    const empty='Esperando empresas. Comparte el código para que ingresen.';
    if(container.textContent!==empty)container.textContent=empty;
    return;
  }
  let count=container.querySelector('strong'),list=container.querySelector('ul');
  if(!list){container.textContent='';count=document.createElement('strong');list=document.createElement('ul');container.append(count,list);}
  const label=`${companies.length} ${companies.length===1?'empresa unida':'empresas unidas'}`;
  if(count.textContent!==label)count.textContent=label;
  const current=new Map([...list.querySelectorAll('[data-company-id]')].map(node=>[node.dataset.companyId,node]));
  for(const company of companies){
    const key=companyNodeKey(company);let node=current.get(key);
    if(!node){node=document.createElement('li');node.dataset.companyId=key;list.appendChild(node);}
    const presence=companyPresence(company),text=`${company.empresa} · ${companyActivity(company,presence)}`;
    if(node.textContent!==text)node.textContent=text;
    node.dataset.presence=presence;current.delete(key);
  }
  for(const node of current.values())node.remove();
}
function validateCreation(config){
  document.querySelectorAll('.creation-field-error').forEach(x=>x.remove());
  document.querySelectorAll('[aria-invalid="true"]').forEach(x=>x.removeAttribute('aria-invalid'));
  const errors=[];
  const invalid=(id,message)=>{const field=$(id);if(!field)return;field.setAttribute('aria-invalid','true');const hint=document.createElement('small');hint.id=id+'Error';hint.className='creation-field-error';hint.textContent=message;field.setAttribute('aria-describedby',hint.id);field.after(hint);errors.push(field);};
  if(!Number.isInteger(config.integrationDurationMinutes)||config.integrationDurationMinutes<1||config.integrationDurationMinutes>60)invalid('integrationDurationMinutes','Indica un entero entre 1 y 60 minutos.');
  if(!Number.isInteger(config.cycles)||config.cycles<1||config.cycles>20)invalid('cycles','Indica entre 1 y 20 ciclos completos.');
  if(!Number.isSafeInteger(config.roundHours)||config.roundHours<0||!Number.isInteger(config.roundMinutes)||config.roundMinutes<0||config.roundMinutes>59||config.roundHours*60+config.roundMinutes<1)invalid('roundMinutes','Indica al menos 1 minuto; horas enteras y minutos entre 0 y 59.');
  if(config.cycleCloseMode==='automatic'&&config.scheduledStart&&!Number.isFinite(Date.parse(config.scheduledStart)))invalid('scheduledStart','Selecciona una fecha y hora válidas.');
  if(config.capitalMode==='random'&&config.capitalMax<config.capitalMin)invalid('capitalMax','La caja máxima debe ser mayor o igual a la mínima.');
  for(const field of ['interest',...(config.capitalMode==='random'?['capitalMin','capitalMax']:['capital'])]){
    if(!Number.isFinite(config[field])||config[field]<0||$(field)?.value.trim()==='')invalid(field,'Indica un monto o tasa válido, mayor o igual a cero.');
  }
  const plan=RULES.cycleSchedule(config);
  if(plan.error&&!errors.length)invalid(config.cycleCloseMode==='automatic'?'scheduledStart':'roundMinutes',plan.error);
  if(config.enabledEvents.some(id=>!EVENT_CATALOG.some(e=>e.id===id)||!Number.isInteger(Number(config.eventRules[id]?.firstRound||1))||Number(config.eventRules[id]?.firstRound||1)>config.cycles||Number(config.eventRules[id]?.firstRound||1)<1))invalid('cycles','Revisa los eventos: su primer ciclo debe estar dentro de los ciclos configurados.');
  if(errors.length){creationFeedback(gameStatus()?.active?'Revisa los campos indicados antes de guardar la configuración.':'Revisa los campos indicados antes de crear la sala.');if($('creationFeedback'))$('creationFeedback').dataset.source='validation';errors[0].focus();return false;}
  return true;
}
async function recoverServerRoom(){
  const S=window.SIDE||{};
  if(!S.SupabaseClient?.isReady()||!S.PartidaService?.obtenerActiva)return false;
  const generation=roomGeneration;
  const result=await loadUsableRoom();
  if(generation!==roomGeneration||state.cancelling)return false;
  if(!result.success){console.error('SIDE: recuperación de sala',result);creationFeedback('No se pudo recuperar la sala. Comprueba la conexión e inténtalo de nuevo.','error',null,false);return false;}
  if(!result.data){clearRoomLink();refreshSetupSummary();return true;}
  state.partidaId=result.data.id;localStorage.setItem('SIDE_PARTIDA_ID',state.partidaId);applyTeacherState(result.data);loadConfig();paintTeacherClock();
  watchTeacherGame();startLiveCompanies();await loadReports();refreshSetupSummary();
  if(generation!==roomGeneration||result.data.id!==state.partidaId)return false;
  $('creationFeedback')?.classList.add('hidden');previousRoom=null;return true;
}
function money(n){return 'S/ '+(Number(n)||0).toLocaleString('es-PE',{maximumFractionDigits:2})}
function formatStudentTime(total){const s=Math.max(0,Math.floor(Number(total)||0));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function escapeAttr(v){return escapeHtml(v)}
function gameStatus(){try{return JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{return null}}
function renderEnabledEvents(){
  const selected=EVENT_CATALOG.filter(e=>state.enabledEvents.has(e.id));
  if($('enabledEventsSummary'))$('enabledEventsSummary').innerHTML=selected.length?
    `<strong>${selected.length} habilitados</strong>`+selected.slice(0,3).map(e=>`<span class="enabled-event-chip">${escapeHtml(e.title)}</span>`).join('')+(selected.length>3?`<span>y ${selected.length-3} más · consulta la selección</span>`:''):'Sin eventos habilitados. Pulsa Seleccionar eventos para agregarlos.';
}
function refreshSetupSummary(){
  const status=gameStatus(),active=Boolean(status?.active),r=runtime();
  const count=Number($('cycles').value)||1;
  const integration=r?.phase==='integration',modern=state.lifecycleVersion===2;
  $('configCycleCount').textContent=`${state.round} / ${count}`;
  $('configReadySummary').textContent=`${count} ciclos operativos de ${$('roundHours').value||0} h ${$('roundMinutes').value||0} min. La integración es previa al Ciclo 1.`;
  const waitingText=`Sala de espera · el Ciclo 1 comienza en ${formatStudentTime(state.seconds)}.`;
  $('gameStatusBanner').textContent=integration?waitingText:active?`Partida iniciada · Ciclo ${state.round} de ${count}.`:status?.cancelledAt?'Partida cancelada. Puedes configurar otra partida.':status?.finishedAt?'Partida finalizada. Puedes configurar otra partida.':'Guarda la configuración y pulsa Iniciar partida para abrir la sala de espera.';
  const financeHelp=$('financeConfigHelp');
  if(financeHelp)financeHelp.textContent=!active?'La TEA y la caja se aplican desde el Ciclo 1.':state.round<count?`Guarda la TEA y la caja para aplicarlas desde el Ciclo ${state.round+1}. La caja se ajusta por la diferencia como aporte o retiro de capital; los ciclos actuales y cerrados conservan sus resultados.`:'Estás en el último ciclo. Los cambios financieros requieren un siguiente ciclo; puedes seguir gestionando los eventos.';
  document.querySelector('[data-tab="rondas"]')?.classList.toggle('hidden',!active&&!status?.finishedAt);
  document.querySelectorAll('#tab-configuracion input:not([readonly])').forEach(input=>input.disabled=active&&!editableFinancialInput(input));if($('taxRegime'))$('taxRegime').disabled=active;
  ['startTimer','cutRound','advanceRound'].forEach(id=>{if($(id))$(id).disabled=!active||cycleMode()==='automatic'||integration||(!modern&&state.round===1&&state.integrationMinutes===60&&state.seconds>0)});
  $('startCycle1Btn')?.classList.toggle('hidden',true);
  if(integration)$('roundState').textContent=waitingText;
  else if(active&&modern)$('roundState').textContent=r?.phase==='results'?'Ciclo cerrado':`Ciclo ${state.round} en curso`;
  $('cancelGame')?.classList.toggle('hidden',!canCancelRoom());
  ['copyGameCode','copyGameLink','copyLobbyCode'].forEach(id=>{if($(id))$(id).disabled=!sharedRoom;});
  refreshStartButton();
  renderTeacherLobby();
}
let publishedState='',publishChain=Promise.resolve();
const ownConfigRevisions=new Map();
function publishGameState(savedConfig=null){
  const service=window.SIDE?.PartidaService;
  if(!state.partidaId||!gameStatus()?.active)return Promise.resolve(true);
  if(!service?.actualizarConfiguracion){toast('No se pudo guardar: el servicio de la partida no está disponible.','error');return Promise.resolve(false);}
  const r=runtime(),config={...(savedConfig||getConfig()),runtime:r?{...r,remaining:r.running?r.duration:r.remaining}:null};
  if(!savedConfig&&state.authoritative){
    for(const key of ['interest','capitalMode','capital','capitalMin','capitalMax','financialSchedule'])config[key]=state.authoritative[key];
  }
  const signature=JSON.stringify(config),id=state.partidaId,expectedRevision=state.formConfigRevision??state.configRevision??null;
  publishChain=publishChain.catch(()=>{}).then(async()=>{
    if(signature===publishedState)return true;
    try{
      // Rebase only revisions acknowledged for our own queued writes. A newer
      // polling response never authorizes overwriting a stale form.
      let writeRevision=expectedRevision;
      while(ownConfigRevisions.has(`${id}:${writeRevision}`))writeRevision=ownConfigRevisions.get(`${id}:${writeRevision}`);
      const result=await service.actualizarConfiguracion(id,config,writeRevision);
      if(result.success){
        const accepted=Number(result.data?.config_revision);
        if(Number.isSafeInteger(accepted)&&accepted>writeRevision)ownConfigRevisions.set(`${id}:${writeRevision}`,accepted);
        const received=result.data?.configuracion;
        if(savedConfig?.financialSchedule?.length){
          const finance=window.SIDE_FINANCE_CONFIG,round=savedConfig.financialSchedule.at(-1).effectiveRound;
          const wanted=finance.resolve(savedConfig,round),actual=finance.resolve(received||{},round);
          const confirmed=received?.financialSchedule?.length&&Object.keys(wanted).every(key=>key==='capitalMode'?wanted[key]===actual[key]:Number(wanted[key])===Number(actual[key]));
          if(!confirmed){creationFeedback('El servidor no confirmó los cambios de TEA y caja. Aplica la migración supabase/migrations/2026-10-23_configuracion_financiera.sql y vuelve a guardar.','notice');return false;}
        }
        publishedState=signature;if(received)applyTeacherState(result.data);state.formConfigRevision=state.configRevision;return true;
      }
      if(result.code==='CONFIG_DESACTUALIZADA')creationFeedback(result.error,'error');
      else toast('No se guardó la configuración remota: '+result.error,'error');
    }catch(error){toast('No se guardó la configuración remota: '+error.message,'error');}
    return false;
  });
  return publishChain;
}
let companiesPoll=null,companiesChannel=null,companiesChannelId=null,companiesRealtime=false,companiesRetry=null,companiesFailures=0,companiesRefresh=null,companiesGeneration=0;
function stopLiveCompanies(){
  companiesGeneration++;
  clearInterval(companiesPoll);clearTimeout(companiesRetry);clearTimeout(companiesRefresh);
  companiesPoll=null;companiesRetry=null;companiesRefresh=null;companiesRealtime=false;
  // Reset identity before removing the old channel: CLOSED belongs to that
  // channel and must not schedule a reconnection after leaving the room.
  companiesChannelId=null;
  if(companiesChannel)window.SIDE?.SupabaseClient?.get()?.removeChannel(companiesChannel);
  companiesChannel=null;
}
function scheduleRosterRefresh(){
  if(companiesRefresh!==null)return;
  companiesRefresh=setTimeout(()=>{companiesRefresh=null;void loadReports();},250);
}
function startLiveCompanies(){
  // Financial snapshots are not in the roster publication. Reconcile every
  // three seconds even with Realtime connected so sales follow confirmations.
  if(!companiesPoll){let last=0;companiesPoll=setInterval(()=>{
    const interval=companiesRealtime?3000:Math.min(60000,3000*2**Math.min(companiesFailures,4));
    if(!document.hidden&&Date.now()-last>=interval){last=Date.now();void loadReports();}
  },1000);}
  gradeQueue?.flush();
  const sb=window.SIDE?.SupabaseClient?.get();
  if(!sb?.channel||!state.partidaId||companiesChannelId===state.partidaId)return;
  const channelGeneration=++companiesGeneration;
  if(companiesChannel)sb.removeChannel(companiesChannel);
  clearTimeout(companiesRetry);companiesRetry=null;companiesRealtime=false;
  companiesChannelId=state.partidaId;
  const channelId=state.partidaId;
  companiesChannel=sb.channel(`side-roster-${state.partidaId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'participantes',filter:`partida_id=eq.${state.partidaId}`},payload=>{
      const row=payload?.new;
      if(row?.empresa_id&&row.partida_id===state.partidaId){
        presenceTracker.observe(`${state.partidaId}:${row.empresa_id}`,row.last_seen_at);
        renderCompanies();renderTeacherLobby();
      }
      scheduleRosterRefresh();
    })
    .subscribe(status=>{
      if(channelGeneration!==companiesGeneration||channelId!==state.partidaId||channelId!==companiesChannelId)return;
      companiesRealtime=status==='SUBSCRIBED';
      if(companiesRealtime){companiesFailures=0;clearTimeout(companiesRetry);companiesRetry=null;scheduleRosterRefresh();return;}
      if(!['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)||companiesRetry!==null)return;
      rosterSyncError='Conexión en tiempo real interrumpida; consultando el servidor y reconectando.';
      renderCompanies();
      const delay=Math.min(60000,3000*2**Math.min(companiesFailures++,4));
      companiesRetry=setTimeout(()=>{companiesRetry=null;if(channelId!==state.partidaId)return;companiesChannelId=null;startLiveCompanies();},delay);
    });
}
function generateGameCode(){
  // Solo Supabase asigna códigos. Un borrador no representa una sala creada.
  return '';
}
function setDefaultDates(){const now=new Date(),end=new Date(now);end.setMonth(end.getMonth()+2);$('startDate').value=RULES.localDate(now);$('endDate').value=RULES.localDate(end)}
function roundSeconds(){if(state.round===1&&state.integrationMinutes===60)return 3600;if(state.integrationMinutes===0&&state.round===1)return Math.max(60,Number($('roundHours').value||0)*3600+Number($('roundMinutes').value||0)*60);return Math.max(60,Number($('roundHours').value||0)*3600+Number($('roundMinutes').value||0)*60)}
function cycleMode(){return document.querySelector('input[name="cycleMode"]:checked')?.value||'manual'}
function capitalMode(){return document.querySelector('input[name="capitalMode"]:checked')?.value||'fixed'}
function editableFinancialInput(input){return ['interest','capital','capitalMin','capitalMax'].includes(input.id)||input.name==='capitalMode'}
function eventSelectionMode(){return document.querySelector('input[name="eventSelectionMode"]:checked')?.value||state.eventSelectionMode||'manual'}
function cycleOffsetLabel(e){const n=Math.max(0,Number(e?.cycleOffset||0));return n===0?'+0 · mismo ciclo':n===1?'+1 · siguiente ciclo':`+${n} · después de ${n} ciclos`}
function filteredEvents(){const q=String($('eventSearch')?.value||'').trim().toLowerCase(),cat=$('eventCategoryFilter')?.value||'all',scope=$('eventScopeFilter')?.value||'all';return EVENT_CATALOG.filter(e=>(!q||`${e.title} ${e.description} ${e.implication} ${e.category||''}`.toLowerCase().includes(q))&&(cat==='all'||e.category===cat)&&(scope==='all'||e.scope===scope))}
function getConfig(){return {
  ...state.authoritative,lifecycleVersion:state.lifecycleVersion===2?2:undefined,
  integrationDurationMinutes:Number($('integrationDurationMinutes').value),
  integrationMinutes:state.integrationMinutes,gameStartedAt:gameStatus()?.startedAt||null,eventSchedule:eventSchedule(),
  nombre:$('gameName').value.trim(),curso:$('gameCourse').value.trim(),codigo:$('gameCode').value,
  capitalMode:capitalMode(),capital:Number($('capital').value||100000),capitalMin:Number($('capitalMin').value||80000),capitalMax:Number($('capitalMax').value||120000),
  demandLosOlivos:Number($('demandLosOlivos').value||0),demandMiraflores:Number($('demandMiraflores').value||0),demandSJL:Number($('demandSJL').value||0),
  taxRegime:$('taxRegime')?.value||'AUTO',materials:{...state.authoritative?.materials,quantityDiscountThreshold:Number($('quantityDiscountThreshold')?.value??100)},
  interest:Number($('interest').value||20),creditPercentStart:Number($('creditPercentStart').value||20),
  cycles:Number($('cycles').value),roundHours:Number($('roundHours').value),roundMinutes:Number($('roundMinutes').value),roundSecs:0,round:state.round,
  cycleCloseMode:cycleMode(),scheduledStart:$('scheduledStart').value||'',startDate:$('startDate').value,endDate:$('endDate').value,
  manualStartDate:state.manualDates?.start||'',manualEndDate:state.manualDates?.end||'',
  eventRules:state.eventRules,enabledEvents:[...state.enabledEvents],eventSelectionMode:eventSelectionMode(),randomEventCount:Math.max(1,Math.min(40,Number($('eventRandomCount')?.value||15))),loanMaxPercent:50,loanInitialPercent:25
}}
async function saveConfig(silent=false){
  renderAcademicCalendar();let c=getConfig();
  const active=!!gameStatus()?.active,base=state.authoritative||c;
  const financeFields=['interest','capitalMode','capital','capitalMin','capitalMax'];
  if(active){
    const values=Object.fromEntries(financeFields.map(key=>[key,silent?base[key]:c[key]]));
    const changed=financeFields.some(key=>values[key]!==base[key]);
    const effectiveRound=state.round+1;
    if(changed&&effectiveRound>Number(c.cycles)){toast('La partida está en su último ciclo. No hay un siguiente ciclo para aplicar la TEA y la caja.');return false;}
    const baseline={...c,...Object.fromEntries(financeFields.map(key=>[key,base[key]])),financialSchedule:base.financialSchedule};
    c=changed?window.SIDE_FINANCE_CONFIG.schedule(baseline,values,effectiveRound):baseline;
  }
  if(!validateCreation(c))return false;
  if(!Number.isSafeInteger(c.materials.quantityDiscountThreshold)||c.materials.quantityDiscountThreshold<0){if(!silent)toast('Indica un umbral de descuento entero mayor o igual a cero.');return false;}
  const numericPlan=RULES.cycleSchedule({...c,scheduledStart:c.scheduledStart||'2026-01-01T00:00'});
  if(c.lifecycleVersion===2&&(!Number.isInteger(c.integrationDurationMinutes)||c.integrationDurationMinutes<1||c.integrationDurationMinutes>60)){if(!silent)toast('Indica entre 1 y 60 minutos de integración.');return false}
  if(numericPlan.error){if(!silent)toast(numericPlan.error);return false}
  if(c.capitalMode==='random'&&c.capitalMax<c.capitalMin){toast('El rango máximo de caja debe ser mayor o igual al mínimo.');return false}
  if(state.partidaId&&gameStatus()?.active){
    if(!await publishGameState(c))return false;
  }else{
    localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(c));
    if(gameStatus()?.active)state.authoritative=c;
  }
  $('gameCodeBadge').textContent=c.codigo;updateRoundDisplay();refreshSetupSummary();
  const feedback=$('creationFeedback');if(feedback?.dataset.source==='validation'){feedback.classList.add('hidden');delete feedback.dataset.source;}
  if(!silent)toast(gameStatus()?.active?'Configuración guardada.':'Configuración guardada. Pulsa Iniciar partida para abrir la sala de espera.');return true;
}
function loadConfig(){state.formConfigRevision=state.configRevision;const raw=localStorage.getItem('SIDE_TEACHER_CONFIG');let c=null;if(raw){try{c=JSON.parse(raw)}catch{}}if(c&&gameStatus()?.active){state.integrationMinutes=Number(c.integrationMinutes)||0;state.lifecycleVersion=c.lifecycleVersion===2?2:1;state.authoritative=c;}else{state.lifecycleVersion=2;state.integrationMinutes=0;}if(!c){setDefaultDates();c={codigo:generateGameCode(),capitalMode:'fixed',cycleCloseMode:'manual',enabledEvents:[]}}const fields=['integrationDurationMinutes','gameName','gameCourse','capital','capitalMin','capitalMax','demandLosOlivos','demandMiraflores','demandSJL','interest','creditPercentStart','cycles','roundHours','roundMinutes','scheduledStart','startDate','endDate'];fields.forEach(k=>{const value=k==='gameName'?c.nombre:k==='gameCourse'?c.curso:c[k];if($(k)&&value!==undefined){if(k==='scheduledStart'&&value){const date=new Date(value);$(k).value=Number.isFinite(date.getTime())?new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16):'';}else $(k).value=value;}});$('gameCode').value=(state.partidaId||gameStatus()?.active)&&c.codigo?c.codigo:generateGameCode();localStorage.removeItem('SIDE_ASSIGNED_GAME_CODE');$('gameCodeBadge').textContent=$('gameCode').value||'Código pendiente';if($('taxRegime'))$('taxRegime').value=c.taxRegime||'AUTO';if($('quantityDiscountThreshold'))$('quantityDiscountThreshold').value=c.materials?.quantityDiscountThreshold??100;const capRadio=document.querySelector(`input[name="capitalMode"][value="${c.capitalMode||'fixed'}"]`);if(capRadio)capRadio.checked=true;const cycleRadio=document.querySelector(`input[name="cycleMode"][value="${c.cycleCloseMode||'manual'}"]`);if(cycleRadio)cycleRadio.checked=true;state.eventRules=c.eventRules||{};state.enabledEvents=new Set(c.enabledEvents||[]);state.eventSelectionMode=c.eventSelectionMode||'manual';const eventModeRadio=document.querySelector(`input[name="eventSelectionMode"][value="${state.eventSelectionMode}"]`);if(eventModeRadio)eventModeRadio.checked=true;if($('eventRandomCount'))$('eventRandomCount').value=Math.max(1,Math.min(40,Number(c.randomEventCount||15)));const catSel=$('eventCategoryFilter');if(catSel&&catSel.options.length===1){[...new Set(EVENT_CATALOG.map(e=>e.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')).forEach(cat=>{const o=document.createElement('option');o.value=cat;o.textContent=cat;catSel.appendChild(o)})}state.round=Math.max(1,Number(localStorage.getItem('SIDE_ACTIVE_ROUND')||c.round||1));state.seconds=roundSeconds();if(!$('startDate').value||!$('endDate').value)setDefaultDates();let status=null;try{status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{}if(status?.active){if($('startGame'))$('startGame').textContent='Partida iniciada'}state.manualDates={start:c.manualStartDate||$('startDate').value,end:c.manualEndDate||$('endDate').value};syncModeUI();renderEventBank()}
function syncModeUI(){$('fixedCapitalFields').classList.toggle('hidden',capitalMode()!=='fixed');$('randomCapitalFields').classList.toggle('hidden',capitalMode()!=='random');$('manualCycleDisclaimer').classList.toggle('hidden',cycleMode()!=='manual');$('scheduledStartLabel').classList.toggle('hidden',cycleMode()!=='automatic');$('integrationModeHeading').textContent=cycleMode()==='automatic'?'Modo automático':'Sala de espera';$('integrationModeHelp').textContent=cycleMode()==='automatic'?'El servidor inicia el Ciclo 1 al terminar la integración desde la fecha programada. Puedes cerrar el navegador.':'El servidor inicia el Ciclo 1 al terminar el tiempo de la sala de espera. El docente controla el cierre y avance de los ciclos.';$('cycleCloseMode').value=cycleMode();$('modeSummaryBadge').textContent=cycleMode()==='automatic'?'Automático':'Manual';$('modeRulesText').innerHTML=cycleMode()==='automatic'?'<strong>Automático:</strong> inicia a la hora programada y avanza solo al llegar a cero.':'<strong>Manual:</strong> el Ciclo 1 inicia al terminar la sala de espera; el docente decide cuándo cierra y avanza cada ciclo.';['startTimer','cutRound','advanceRound'].forEach(id=>{if($(id)){$(id).disabled=cycleMode()==='automatic';$(id).title=cycleMode()==='automatic'?'Controlado por la programación automática':''}});renderAcademicCalendar()}


function calendarDuration(milliseconds){
  const minutes=Math.round(milliseconds/60000),hours=Math.floor(minutes/60),rest=minutes%60;
  return `${hours?hours+' h':''}${hours&&rest?' ':''}${rest?rest+' min':''}`||'0 min';
}
function calendarDateTime(value){return new Date(value).toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}
function renderAcademicCalendar(){
  if(!$('automaticCalendar'))return;
  const automatic=cycleMode()==='automatic';
  if(automatic&&state.calendarMode!=='automatic'&&!state.manualDates)state.manualDates={start:$('startDate').value,end:$('endDate').value};
  if(!automatic&&state.calendarMode==='automatic'&&state.manualDates){$('startDate').value=state.manualDates.start;$('endDate').value=state.manualDates.end}
  state.calendarMode=cycleMode();
  ['startDate','endDate'].forEach(id=>{$(id).readOnly=automatic;$(id).setAttribute('aria-readonly',String(automatic))});
  $('automaticCalendar').classList.toggle('hidden',!automatic);
  $('calendarModeBadge').textContent=automatic?'Automático':'Referencia';
  if(!automatic){state.manualDates={start:$('startDate').value,end:$('endDate').value};$('academicCalendarHint').textContent='Las fechas son informativas en modo manual. El docente decide cuándo inicia y termina cada ciclo.';return}
  const config=getConfig(),plan=RULES.cycleSchedule(config),r=runtime();
  const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'hora local';
  $('academicCalendarHint').textContent=`Fechas calculadas desde el inicio programado, la duración y el número de ciclos. Zona horaria de este navegador: ${tz}.`;
  if(plan.error){$('startDate').value='';$('endDate').value='';$('calendarSummary').textContent=plan.error;$('cycleCalendarList').innerHTML='';return}
  $('startDate').value=RULES.localDate(plan.start);$('endDate').value=RULES.localDate(plan.end);
  const matches=config.lifecycleVersion===2?Boolean(config.gameStartAt&&r):r?.mode==='automatic'&&r?.scheduledStart===config.scheduledStart&&Number(r?.duration)===(plan.cycles[Math.max(0,Number(r?.round||1)-1)]?.end-plan.cycles[Math.max(0,Number(r?.round||1)-1)]?.start)/1000;
  const current=matches?Number(r.round||1):0,finished=matches&&r.status==='simulation-finished';
  const running=matches&&r.running,scheduled=matches&&(r.status==='scheduled'||r.phase==='integration');
  const label=finished?'Simulación finalizada':running?`Ciclo ${current} en curso`:scheduled?'Inicio automático programado':'Vista previa de la programación';
  const summaryHtml=`<strong>${plan.cycles.length} ciclos · ${config.integrationMinutes===60?'Ciclo 1: integración de 1 h · ':''}Total ${calendarDuration(plan.total)}</strong><span>${escapeHtml(label)}<br>Inicio: ${calendarDateTime(plan.start)}<br>Fin de simulación: ${calendarDateTime(plan.end)}</span>${!matches?`<small class="calendar-warning">Pulsa Iniciar partida para activar este horario.${plan.start<Date.now()?' El inicio está en el pasado: se retomará el ciclo correspondiente al horario, o se finalizará si ya transcurrió todo el plazo.':''}</small>`:''}`;
  if($('calendarSummary').innerHTML!==summaryHtml)$('calendarSummary').innerHTML=summaryHtml;
  const listHtml=plan.cycles.map(c=>{
    const ended=finished||(matches&&c.round<current),active=running&&c.round===current;
    return `<li class="cycle-calendar-row ${ended?'is-finished':active?'is-current':''}" data-cycle="${c.round}"><div class="cycle-calendar-title"><strong>Ciclo ${c.round}${c.round===1&&config.integrationMinutes===60?' · Integración':''}</strong><span class="cycle-calendar-state">${ended?'Finalizado':active?'En curso':'Programado'}</span></div><div class="cycle-calendar-times"><span><small>Inicio</small><time datetime="${new Date(c.start).toISOString()}">${calendarDateTime(c.start)}</time></span><span><small>Cierre</small><time datetime="${new Date(c.end).toISOString()}">${calendarDateTime(c.end)}</time></span></div><p class="cycle-calendar-action">${c.round===plan.cycles.length?'Al cerrar: fin de la simulación.':`Al cerrar: fin del ciclo e inicio automático del ciclo ${c.round+1}.`}</p></li>`;
  }).join('');
  const list=$('cycleCalendarList');if(list.innerHTML!==listHtml){const scroll=list.scrollTop;list.innerHTML=listHtml;list.scrollTop=scroll}
}

function runtime(){try{return JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'null')}catch{return null}}
function writeRuntime(extra={}){
  const base=runtime()||{};
  const data={...base,round:state.round,duration:roundSeconds(),remaining:state.seconds,running:false,status:'ready',mode:cycleMode(),scheduledStart:$('scheduledStart').value||'',...extra};
  localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(data));publishGameState();if(data.round!==base.round)syncRoundToSupabase();refreshSetupSummary();return data;
}
function updateRoundDisplay(){$('roundDisplay').textContent=`${state.round} / ${Number($('cycles').value||6)}`;$('currentRound').value=state.round;localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));$('roundSummary').textContent=`TEA inicial: ${Number($('interest').value||0).toFixed(1)}% · ${cycleMode()==='automatic'?'Avance automático':'Control manual'}`;renderAcademicCalendar()}
function updateTimer(){const seconds=Math.max(0,state.seconds),h=String(Math.floor(seconds/3600)).padStart(2,'0'),m=String(Math.floor(seconds%3600/60)).padStart(2,'0'),sec=String(seconds%60).padStart(2,'0');$('roundTimer').textContent=`${h}:${m}:${sec}`}
function stopTimer(status='paused'){if(state.timer){clearInterval(state.timer);state.timer=null}$('startTimer').textContent='Iniciar';const r=runtime();writeRuntime({running:false,remaining:state.seconds,status})}
function beginTimer(auto=false,referenceStart=null){
  if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return;}

  if(auto||cycleMode()==='automatic'){scheduleAutomaticStart();return}
  if(state.timer)return;
  if(state.roundClosed){toast('Este ciclo ya está cerrado. Avanza al siguiente.');return}
  if(state.seconds<=0)state.seconds=roundSeconds();
  $('roundState').textContent='Ciclo en curso';$('startTimer').textContent='Pausar';
  const started=referenceStart??Date.now(),duration=state.seconds;
  writeRuntime({running:true,status:'running',duration,remaining:duration,startedAt:new Date(started).toISOString(),mode:'manual'});
  state.timer=setInterval(()=>{state.seconds=Math.max(0,duration-Math.floor((Date.now()-started)/1000));updateTimer();if(state.seconds<=0)finishTime()},1000);
}
function startTimer(){if(state.lifecycleVersion===2){controlGame(runtime()?.running?'pausar':'reanudar');return;}if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return}if(state.round===1&&state.integrationMinutes===60){toast('El período de integración dura una hora y no se pausa.');return}if(cycleMode()==='automatic'){toast('El reloj se controla por la programación automática.');return}if(state.timer){stopTimer('paused');$('roundState').textContent='Pausado';return}beginTimer(false)}
function finishTime(){if(state.timer){clearInterval(state.timer);state.timer=null}if(!(state.round===1&&state.integrationMinutes===60))closeBusinessLocalRound();state.seconds=0;state.roundClosed=true;writeRuntime({running:false,remaining:0,status:'finished'});$('roundState').textContent='Tiempo finalizado';addEvent('Tiempo del ciclo agotado.','sistema');if(state.round===1&&state.integrationMinutes===60&&cycleMode()==='manual'){advanceRound(false);if(gameStatus()?.active)beginTimer(false)}else if(cycleMode()==='automatic')advanceRound(true);else toast('Tiempo agotado. El docente puede avanzar cuando quiera.')}
function cutRound(){if(state.lifecycleVersion===2){controlGame('cerrar');return;}if(!gameStatus()?.active||state.round===1&&state.integrationMinutes===60){toast('El ciclo de integración debe completar una hora.');return}if(cycleMode()!=='manual'){toast('En modo automático el ciclo se controla por programación.');return}closeBusinessLocalRound();if(state.timer){clearInterval(state.timer);state.timer=null}state.seconds=0;state.roundClosed=true;updateTimer();writeRuntime({running:false,remaining:0,status:'finished'});$('roundState').textContent='Ciclo cortado por docente';addEvent('El docente cerró el ciclo manualmente.','sistema');toast('Ciclo cerrado. Ya puedes avanzar.')}
function refreshAutomaticRuntime(){
  if(state.lifecycleVersion===2){refreshTeacherGame();return;}

  let c,status;try{c=JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')||'{}');status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{return}
  if(c.cycleCloseMode!=='automatic'||!status?.active){if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}return}
  const plan=RULES.cycleSchedule(c),position=RULES.schedulePosition(plan);if(!position)return;
  const previous=runtime(),changed=previous?.round!==position.round||previous?.status!==position.status;
  if(position.status!=='scheduled'){
    const from=previous?.status==='scheduled'||!previous?.running?1:Math.max(1,Number(previous?.round||1));
    for(let round=from;round<=position.round;round++)triggerGroupEvents(round);
  }
  state.round=position.round;state.seconds=position.remaining;state.roundClosed=position.status==='simulation-finished';
  writeRuntime({round:position.round,duration:(plan.cycles[position.round-1].end-plan.cycles[position.round-1].start)/1000,remaining:position.remaining,running:position.status==='running',status:position.status,mode:'automatic',scheduledStart:c.scheduledStart,startedAt:new Date(position.startedAt).toISOString()});
  $('roundState').textContent=position.status==='scheduled'?'Inicio automático programado':position.status==='running'?'Ciclo automático en curso':'Simulación finalizada';
  $('startTimer').textContent='Automático';
  if(position.status==='simulation-finished'){
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({...status,active:false,finishedAt:new Date(plan.end).toISOString()}));
    if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}
    finishSupabasePartida();
  }
  updateTimer();updateRoundDisplay();
  if(changed){renderCycleNews();loadReports();refreshSetupSummary()}
}
function scheduleAutomaticStart(){
  if(!gameStatus()?.active)return false;

  if(state.scheduleWatcher){clearInterval(state.scheduleWatcher);state.scheduleWatcher=null}
  if(state.timer){clearInterval(state.timer);state.timer=null}
  const plan=RULES.cycleSchedule(getConfig());
  if(plan.error){toast(plan.error);return false}
  refreshAutomaticRuntime();
  if(runtime()?.status!=='simulation-finished')state.scheduleWatcher=setInterval(refreshAutomaticRuntime,1000);
  return true;
}

function addEvent(text,type='sistema',meta={}){state.events.unshift({round:state.round,text,type,at:new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}),...meta});localStorage.setItem('SIDE_EVENT_LOG',JSON.stringify(state.events));renderEvents()}
function renderEvents(){$('eventLog').innerHTML=state.events.map(e=>`<div class="event-entry"><span><b>Ciclo ${e.round}</b> · ${escapeHtml(e.text)}</span><small>${e.at}</small></div>`).join('')||'<p class="hint">No hay eventos registrados.</p>'}
function eventSchedule(){try{return JSON.parse(localStorage.getItem('SIDE_EVENT_SCHEDULE')||'{}')||{}}catch{return {}}}
function setEventSchedule(s){localStorage.setItem('SIDE_EVENT_SCHEDULE',JSON.stringify(s))}
function triggerGroupEvents(round){
  // No generar eventos en ciclo 1 de integración (solo si hay integración de 60 min)
  if(!gameStatus()?.active||runtime()?.phase==='integration'||(state.lifecycleVersion===2&&state.partidaId)||(round===1&&state.integrationMinutes===60))return {group:[]};
  const schedule=eventSchedule();if(schedule[round])return schedule[round];
  // Solo usar eventos que estén habilitados; si no hay ninguno, retornar vacío sin error
  const candidates=EVENT_CATALOG.filter(e=>e.scope==='group'&&state.enabledEvents.has(e.id)&&round>=Number(state.eventRules[e.id]?.firstRound||1)&&(state.eventRules[e.id]?.repeat!==false||!Object.entries(schedule).some(([cycle,data])=>Number(cycle)<round&&(data.group||[]).includes(e.id))));
  if(!candidates.length){schedule[round]={group:[]};setEventSchedule(schedule);return schedule[round];}
  const selected=[];for(const e of candidates){if(Math.random()*100<e.probability)selected.push(e.id);if(selected.length>=2)break}
  schedule[round]={group:selected};setEventSchedule(schedule);
  selected.forEach(id=>{const e=EVENT_CATALOG.find(x=>x.id===id);if(!e)return;addEvent(`${e.title}: ${e.implication}`,'grupal',{eventId:id,impactRound:round+Number(e.cycleOffset||0)})});
  renderCycleNews();return schedule[round];
}
function eventsImpactingRound(round){const schedule=eventSchedule(),out=[];Object.entries(schedule).forEach(([trigger,data])=>(data?.group||[]).forEach(id=>{const e=EVENT_CATALOG.find(x=>x.id===id);if(!e||!state.enabledEvents.has(id))return;const start=Number(trigger)+Number(e.cycleOffset||0),end=start+Math.max(1,Number(e.cycles||1));if(round>=start&&round<end)out.push({...e,triggerRound:Number(trigger),impactRound:start})}));return out}
function renderCycleNews(){const els=eventsImpactingRound(state.round);$('cycleNews').innerHTML=els.length?els.map(e=>`<div class="news-entry"><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.implication)}</span><small>GRUPAL · ${escapeHtml(cycleOffsetLabel(e))} · ocurre ${e.probability}% · impacto en ciclo ${e.impactRound}</small></div>`).join(''):'<p class="hint">Sin noticia grupal activa en este ciclo. Los eventos individuales se evalúan por empresa según su probabilidad.</p>'}
function updateEventModeUI(){state.eventSelectionMode=eventSelectionMode();const panel=document.querySelector('.event-mode-panel');panel?.classList.toggle('random-mode',state.eventSelectionMode==='random');panel?.classList.toggle('manual-mode',state.eventSelectionMode==='manual');renderEventBank()}
function randomizeEventSelection(){const candidates=filteredEvents().filter(e=>state.enabledEvents.has(e.id));if(!candidates.length){toast('No hay eventos habilitados con los filtros actuales.');return}const count=Math.max(1,Math.min(candidates.length,Math.min(40,Number($('eventRandomCount')?.value||15))));const shuffled=candidates.slice();for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}state.enabledEvents=new Set(shuffled.slice(0,count).map(e=>e.id));state.eventSelectionMode='random';const radio=document.querySelector('input[name="eventSelectionMode"][value="random"]');if(radio)radio.checked=true;saveConfig(true);updateEventModeUI();toast(`${count} eventos fueron seleccionados aleatoriamente.`)}
function renderEventBank(){
  renderEnabledEvents();
  const body=$('eventBankBody');if(!body)return;
  if(body.contains(document.activeElement)&&document.activeElement.matches('.event-first-round'))return;
  const events=filteredEvents(),random=eventSelectionMode()==='random';
  body.innerHTML=events.map(e=>`<tr class="${random&&state.enabledEvents.has(e.id)?'random-picked':''}"><td><input class="event-enable" type="checkbox" data-event="${e.id}" ${state.enabledEvents.has(e.id)?'checked':''}  aria-label="Habilitar ${escapeAttr(e.title)}"></td><td><strong>${escapeHtml(e.title)}</strong><small>${escapeHtml(e.description)}</small><span class="event-category">${escapeHtml(e.category||'General')}</span></td><td><span class="scope-badge ${e.scope}">${e.scope==='group'?'GRUPAL':'INDIVIDUAL'}</span></td><td><span class="cycle-offset">${escapeHtml(cycleOffsetLabel(e))}</span></td><td>${escapeHtml(e.implication)}</td><td><b>${e.probability}%</b></td><td><input class="event-first-round" type="number" min="1" max="${Number($('cycles').value)||100}" step="1" value="${Number(state.eventRules[e.id]?.firstRound||1)}" data-event="${e.id}" aria-label="Desde ciclo: ${escapeAttr(e.title)}"></td><td><input class="event-repeat" type="checkbox" data-event="${e.id}" ${state.eventRules[e.id]?.repeat!==false?'checked':''} aria-label="Repetir ${escapeAttr(e.title)}"></td></tr>`).join('')||'<tr><td colspan="8"><p class="hint">No hay eventos que coincidan con los filtros.</p></td></tr>';
  body.querySelectorAll('.event-first-round,.event-repeat').forEach(input=>input.addEventListener('change',()=>{
    const id=input.dataset.event,rule={firstRound:1,repeat:true,...state.eventRules[id]};
    if(input.classList.contains('event-repeat'))rule.repeat=input.checked;
    else {if(!input.checkValidity()){input.reportValidity();return;}rule.firstRound=Number(input.value);}
    state.eventRules[id]=rule;saveConfig(true);
  }));
  body.querySelectorAll('.event-enable').forEach(i=>i.addEventListener('change',()=>{
    i.checked?state.enabledEvents.add(i.dataset.event):state.enabledEvents.delete(i.dataset.event);
    $('eventSelectionCount').textContent=`${state.enabledEvents.size} seleccionados`;
    updateSelectAllBtn();renderEnabledEvents();saveConfig(true);
  }));
  $('eventSelectionCount').textContent=`${state.enabledEvents.size} seleccionados de ${EVENT_CATALOG.length}`;
  if($('eventVisibleCount'))$('eventVisibleCount').textContent=`Mostrando ${events.length} de ${EVENT_CATALOG.length}`;
  updateSelectAllBtn();
}
function updateSelectAllBtn(){
  const btn=$('eventSelectAll');if(!btn)return;
  const all=EVENT_CATALOG,enabled=all.filter(e=>state.enabledEvents.has(e.id));
  const allSelected=all.length>0&&enabled.length===all.length;
  btn.textContent=allSelected?'Deseleccionar todos':'Seleccionar todos';
  btn.dataset.allSelected=allSelected?'1':'';
}
function toggleSelectAllEvents(){
  const btn=$('eventSelectAll');if(!btn)return;
  const all=EVENT_CATALOG;
  if(!all.length){toast('No hay eventos visibles con los filtros actuales.');return;}
  const allSelected=btn.dataset.allSelected==='1';
  if(allSelected){
    all.forEach(e=>state.enabledEvents.delete(e.id));
    toast(`${all.length} evento(s) deseleccionados.`);
  }else{
    all.forEach(e=>state.enabledEvents.add(e.id));
    toast(`${all.length} evento(s) seleccionados.`);
  }
  renderEventBank();saveConfig(true);
}

/**
 * Promesa de creación en curso (guard anti-doble-clic, Fase C1 fix).
 * Las llamadas concurrentes esperan la misma promesa en vez de crear duplicados.
 * @type {Promise<boolean>|null}
 */
let creatingPartida=null;
/**
 * Crea o reutiliza la partida en Supabase (Fase C1).
 * Guarda el partidaId y el código real generado por la base de datos.
 * Solo confirma éxito con una fila devuelta por el servidor.
 * Anti-doble-clic: una creación en curso se reutiliza, no se duplica.
 * @param {object} config Configuración del formulario (getConfig()).
 * @returns {Promise<boolean>} true si hay una partida confirmada en el servidor.
 */
async function ensureSupabasePartida(config){
  const S=window.SIDE||{};
  if(!S.PartidaService||!S.SupabaseClient?.isReady()){creationError({error:'Supabase no está disponible. Comprueba la conexión y la configuración; luego pulsa Reintentar.'});return false;}
  if(creatingPartida)return creatingPartida;
  const btn=$('startGame');
  if(btn)btn.disabled=true;
  creatingPartida=(async()=>{
    try{
      let r=await S.PartidaService.crear({
        requestId:creationRequest,
        nombre:config.nombre||'SIDE — Simulación Principal',
        curso:config.curso||'',
        configuracion:{...config,scheduledStart:config.scheduledStart?new Date(config.scheduledStart).toISOString():''},
        eventos_habilitados:config.enabledEvents||[]
      });
      if(!r.success&&r.code==='SALA_ACTIVA'){
        const available=await loadUsableRoom();
        if(available.success&&available.data)r={...available,reused:true};
      }
      if(!r.success){creationError(r);return false;}
      if(!r.data?.id||!r.data?.codigo||!r.data?.configuracion||!Number.isFinite(Date.parse(r.data.serverTime||''))){creationError({error:'El servidor no confirmó una sala utilizable. Falta actualizar la base de datos: ejecuta supabase/migrations/2026-10-11_fix_crear_partida.sql.'});return false;}
  state.partidaId=r.data.id;
  try{localStorage.setItem('SIDE_PARTIDA_ID',state.partidaId)}catch{}
  if(r.data.codigo){$('gameCode').value=r.data.codigo;$('gameCodeBadge').textContent=r.data.codigo;}
  if(config.lifecycleVersion===2){
    applyTeacherState(r.data);
    loadConfig();
  }else saveConfig(true);
  // El contador coincide con la fila, también al recuperar una petición previa.
  state.round=Number(r.data.configuracion?.runtime?.round||1);if(!state.authoritative)state.seconds=roundSeconds();
  try{localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round))}catch(error){console.warn('SIDE: no se pudo guardar el ciclo local',error);}
  paintTeacherClock();updateTimer();updateRoundDisplay();
      creationRequest=null;localStorage.removeItem('SIDE_CREATION_REQUEST');
      creationFeedback((r.reused?'Sala disponible. Código: ':'Sala creada. Código: ')+r.data.codigo,'success');return true;
    }finally{
      creatingPartida=null;
      if(btn)btn.disabled=false;
    }
  })();
  return creatingPartida;
}
// La configuración remota recibida es la fuente de verdad; no se vuelve a publicar
// un runtime calculado en el navegador sobre el estado del servidor.
let teacherClock=null,teacherPoll=null,teacherTick=null,teacherBusy=false,teacherRead=Promise.resolve();
function teacherNow(){if(state.partidaId&&!teacherClock)return NaN;return teacherClock?teacherClock.time+performance.now()-teacherClock.at:Date.now();}
function applyTeacherState(partida){
  if(partida.id)rememberSharedRoom(partida);
  const c=partida.configuracion;if(!c)return;
  if(Number.isSafeInteger(Number(partida.config_revision))&&partida.config_revision!=null){state.configRevision=Number(partida.config_revision);if(state.formConfigRevision==null)state.formConfigRevision=state.configRevision;}
  if(state.partidaId&&!Number.isFinite(Date.parse(partida.serverTime||'')))throw new Error('Falta hora del servidor. Aplica la migración 20261009_sala_espera_identidad_exacta.sql en Supabase.');
  if(partida.serverTime)teacherClock={time:Date.parse(partida.serverTime),at:performance.now()};
  if(partida.codigo){$('gameCode').value=partida.codigo;$('gameCodeBadge').textContent=partida.codigo;}
  state.authoritative=c;state.lifecycleVersion=c.lifecycleVersion===2?2:1;
  state.integrationMinutes=Number(c.integrationMinutes)||0;
  const r=c.runtime||{};state.round=Number(r.round||1);state.roundClosed=['results','finished'].includes(r.phase);
  state.eventRules=c.eventRules||{};state.enabledEvents=new Set(c.enabledEvents||[]);
  if(c.cancelledAt)$('roundState').textContent='Partida cancelada';
  if(c.runtime?.phase==='finished')$('roundState').textContent='Simulación finalizada';
  localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify({...c,codigo:partida.codigo||$('gameCode').value}));
  localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(r));
  localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));
  localStorage.setItem('SIDE_EVENT_SCHEDULE',JSON.stringify(c.eventSchedule||{}));
  localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({cancelledAt:c.cancelledAt||partida.cancelled_at||null,active:!['finalizada','cancelada'].includes(partida.estado)&&!c.cancelledAt,startedAt:c.gameStartedAt,finishedAt:['finalizada','cancelada'].includes(partida.estado)?new Date(teacherNow()).toISOString():null,code:partida.codigo||$('gameCode').value}));
  paintTeacherClock();updateRoundDisplay();refreshSetupSummary();renderCycleNews();renderEventBank();
}
function paintTeacherClock(){
  const r=runtime(),c=state.authoritative;if(!c||!r)return;
  state.seconds=r.phase==='integration'&&c.gameStartAt?Math.max(0,Math.ceil((Date.parse(c.gameStartAt)-teacherNow())/1000)):r.running?Math.max(0,Math.ceil((Date.parse(r.startedAt)+r.duration*1000-teacherNow())/1000)):Number(r.remaining||0);
  updateTimer();$('startTimer').textContent=r.running?'Pausar':'Reanudar';
  renderTeacherLobby();
  if(r.phase==='integration'){
    const label=`Sala de espera · el Ciclo 1 comienza en ${formatStudentTime(state.seconds)}.`;
    for(const id of ['gameStatusBanner','roundState'])if($(id)&&$(id).textContent!==label)$(id).textContent=label;
  }
}
async function refreshTeacherGame(){
  if(state.starting||state.cancelling||state.lifecycleVersion!==2||teacherBusy||!state.partidaId&&!gameStatus()?.active)return false;
  if(Date.now()<Number(state.syncRetryAt||0))return false;
  if(state.partidaId){
    teacherBusy=true;
    const id=state.partidaId,generation=roomGeneration;
    const stillCurrent=()=>id===state.partidaId&&generation===roomGeneration;
    try{teacherRead=window.SIDE.PartidaService.controlar(id,'sincronizar');const result=await teacherRead;if(!stillCurrent())return false;if(!result.success)throw new Error(result.error||'comprueba la conexión y reintenta.');const runtime=result.data?.configuracion?.runtime||{},next=Number(runtime.round||state.round),last=next-(['results','finished'].includes(runtime.phase)?0:1);if(runtime.phase!=='cancelled'&&runtime.phase!=='integration')for(let cycle=1;cycle<=last;cycle++){if(!stillCurrent()||!await closeBusinessRemoteRound(cycle)){state.syncFailures=Number(state.syncFailures||0)+1;state.syncRetryAt=Date.now()+Math.min(60000,3000*2**Math.min(state.syncFailures-1,4));return false;}}if(!stillCurrent())return false;state.syncFailures=0;state.syncRetryAt=0;applyTeacherState(result.data);return true;}
    catch(error){if(stillCurrent()){state.syncFailures=Number(state.syncFailures||0)+1;state.syncRetryAt=Date.now()+Math.min(60000,3000*2**Math.min(state.syncFailures-1,4));console.error('SIDE: sincronización de sala',error);creationFeedback('No se pudo sincronizar la sala: '+error.message+' Se reintentará automáticamente.','error');}return false;}
    finally{teacherBusy=false;}
  }else{
    const c={...state.authoritative,runtime:RULES.resolveRuntime(state.authoritative,teacherNow())};
    if(c.runtime.phase!=='integration'){c.phase=c.runtime.phase;c.gameStartedAt=c.gameStartedAt||c.gameStartAt;}
    applyTeacherState({configuracion:c,estado:['finished','cancelled'].includes(c.runtime.phase)?'finalizada':c.runtime.phase==='integration'?'esperando':'activa'});
    if(c.runtime.phase!=='integration'){triggerGroupEvents(c.runtime.round);state.authoritative.eventSchedule=eventSchedule();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(state.authoritative));}
  }
}
function watchTeacherGame(){
  if(teacherPoll)clearInterval(teacherPoll);if(teacherTick)clearInterval(teacherTick);
  teacherPoll=setInterval(refreshTeacherGame,3000);
  teacherTick=setInterval(()=>{paintTeacherClock();if($('tab-empresas')?.classList.contains('active'))renderCompanies();if(!state.partidaId)refreshTeacherGame();},1000);
}
async function prepareGame(){
  await teacherRead;
  if(!window.SIDE?.SupabaseClient?.isReady()){creationError({error:'Supabase no está disponible. Comprueba la conexión y pulsa Reintentar.'});return false;}
  const config={...getConfig(),lifecycleVersion:2,integrationMinutes:0};
  if(!validateCreation(config))return false;
  const service=window.SIDE?.PartidaService;
  if(service?.obtenerActiva&&window.SIDE?.SupabaseClient?.isReady()){
    const existing=await loadUsableRoom(config);
    if(!existing.success){creationError(existing);return false;}
    const pendingRequest=creationRequest||localStorage.getItem('SIDE_CREATION_REQUEST');
    if(existing.data&&(!pendingRequest||existing.data.creation_request_id!==pendingRequest)){
      state.partidaId=existing.data.id;localStorage.setItem('SIDE_PARTIDA_ID',state.partidaId);applyTeacherState(existing.data);loadConfig();paintTeacherClock();watchTeacherGame();startLiveCompanies();
      creationFeedback(`Sala disponible. Código: ${existing.data.codigo}.`,'success');return true;
    }
  }
  // La consulta confirmó el estado; ningún indicador local autoriza éxito.
  clearRoomLink();state.lifecycleVersion=2;state.integrationMinutes=0;
  if(!creationRequest){creationRequest=localStorage.getItem('SIDE_CREATION_REQUEST')||newCreationRequest();localStorage.setItem('SIDE_CREATION_REQUEST',creationRequest);}
  state.round=1;state.roundClosed=false;
  const {runtime:oldRuntime,gameStartAt:oldDeadline,gameStartedAt:oldStarted,cancelledAt:oldCancelled,...fresh}=config;
  if(!await ensureSupabasePartida({...fresh,eventSchedule:{},phase:'integration',round:1}))return false;
  watchTeacherGame();startLiveCompanies();return true;
}
async function controlGame(action){
  if(state.cancelling)return false;
  const expectedRound=state.round;
  await teacherRead;
  if(teacherBusy||state.cancelling)return false;
  teacherBusy=true;
  try{
    if(state.partidaId){
      const settles=['cerrar','avanzar'].includes(action)&&state.authoritative?.runtime?.phase!=='integration';
      const result=await window.SIDE.PartidaService.controlar(state.partidaId,action,null,expectedRound);
      if(!result.success){toast(result.error||'No se pudo actualizar la partida.');return false;}
      if(action==='cancelar'&&!result.data?.configuracion?.cancelledAt){toast('La cancelación no se aplicó. Actualiza Supabase con supabase/migrations/supabase_game_lifecycle.sql.');return false;}
      applyTeacherState(result.data);
      if(settles)for(let cycle=1;cycle<=expectedRound;cycle++){if(!await closeBusinessRemoteRound(cycle))return false;}
    }else{
      const c={...state.authoritative},r={...c.runtime},now=new Date().toISOString(),duration=roundSeconds();
      if(action==='cerrar'||action==='avanzar'&&r.phase==='decisions')closeBusinessLocalRound();
      if(action==='cancelar'){c.cancelledAt=now;Object.assign(r,{phase:'cancelled',status:'simulation-finished',running:false,remaining:0});}
      else if(action==='iniciar'&&r.phase==='integration'&&cycleMode()==='manual'){
        c.gameStartAt=now;c.gameStartedAt=now;Object.assign(r,{phase:'decisions',status:'running',running:true,startedAt:now,duration,remaining:duration});
      }else if(cycleMode()==='manual'&&['decisions','results'].includes(r.phase)){
        if(action==='avanzar')Object.assign(r,r.round>=c.cycles?{phase:'finished',status:'simulation-finished',running:false,remaining:0}:{round:r.round+1,phase:'decisions',status:'running',running:true,startedAt:now,duration,remaining:duration});
        if(action==='cerrar')Object.assign(r,{phase:'results',status:'finished',running:false,remaining:0});
        if(action==='pausar'&&r.running)Object.assign(r,{status:'paused',running:false,remaining:state.seconds});
        if(action==='reanudar'&&r.status==='paused')Object.assign(r,{status:'running',running:true,startedAt:now,duration:r.remaining});
      }
      c.runtime=r;c.phase=r.phase;c.round=r.round;
      applyTeacherState({configuracion:c,estado:['finished','cancelled'].includes(r.phase)?'finalizada':r.phase==='integration'?'esperando':'activa'});
      if(r.phase==='decisions'){triggerGroupEvents(r.round);state.authoritative.eventSchedule=eventSchedule();localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(state.authoritative));}
    }
    return true;
  }finally{teacherBusy=false;}
}
async function startGame(){
  if(state.starting||state.cancelling)return;
  state.starting=true;refreshStartButton();
  try{
    if(!await prepareGame())return;
    switchTab('rondas');
  }catch(error){creationError({error:error.message});}
  finally{state.starting=false;refreshSetupSummary();}
}
async function startCycle1(){return startGame();}
/**
 * Propaga el avance de ciclo a Supabase (Fase C3).
 * Sube ciclo_actual de todas las empresas de la partida vía RPC avanzar_ciclo.
 * Fire-and-forget con guard: no bloquea el flujo local ni cambia firmas.
 */
function syncRoundToSupabase(){
  if(state.lifecycleVersion===2)return;

  try{
    const S=window.SIDE||{};
    if(!S.PartidaService||!S.SupabaseClient?.isReady()||!state.partidaId)return;
    publishGameState().then(()=>S.PartidaService.avanzarCiclo(state.partidaId)).then(r=>{
      if(!r.success&&!r.offline)console.warn('SIDE: avanzar ciclo:',r.error);
    });
  }catch(error){console.error('SIDE: supabase advance failed',error)}
}
/**
 * Aísla la sesión local por profesor (equipos compartidos).
 * Si la sesión actual es de otro profesor que el que dejó datos en este
 * navegador, se purgan las claves de partida/config/juego para no mostrarle
 * datos ajenos. Sin sesión (demo) u offline no se toca nada. Solo purga ante
 * confirmación positiva de cambio de cuenta; nunca por error de red.
 */
async function purgeForeignProfessorState(){
  try{
    const S=window.SIDE||{};
    const sb=S.SupabaseClient?.get();
    if(!sb||!S.SupabaseClient?.isReady())return;
    const {data}=await sb.auth.getUser();
    const uid=data?.user?.id||null;
    if(!uid)return;
    let stored=null;
    try{stored=localStorage.getItem('SIDE_PROFESOR_ID')}catch{}
    if(stored&&stored!==uid){
      ['SIDE_PARTIDA_ID','SIDE_CREATION_REQUEST','SIDE_TEACHER_CONFIG','SIDE_ASSIGNED_GAME_CODE','SIDE_GAME_STATUS','SIDE_ACTIVE_ROUND','SIDE_ROUND_RUNTIME','SIDE_EVENT_LOG','SIDE_EVENT_SCHEDULE','SIDE_STUDENT_REPORTS','SIDE_PUBLISHED_PODIUM','SIDE_TEACHER_GRADES'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});
    }
    try{localStorage.setItem('SIDE_PROFESOR_ID',uid)}catch{}
  }catch(error){console.error('SIDE: professor isolation check failed',error)}
}
/**
 * Texto del botón principal según haya partida activa vinculada o no.
 * Sin partida → Iniciar partida; con partida → Partida iniciada.
 */
function refreshStartButton(){
  const btn=$('startGame');if(!btn)return;
  const active=Boolean(gameStatus()?.active);
  btn.textContent=state.cancelling?'Cancelando partida…':state.starting?'Creando sala…':active?'Partida iniciada':'Iniciar partida';
  btn.disabled=state.starting||state.cancelling||active;
}
/**
 * Cierra la partida en Supabase al finalizar la simulación.
 * Conserva el vínculo para consultar resultados; el próximo inicio crea otra partida.
 */
let finishingPartida=Promise.resolve();
function finishSupabasePartida(){
  try{
    const S=window.SIDE||{};
    if(S.PartidaService&&S.SupabaseClient?.isReady()&&state.partidaId){
      const id=state.partidaId;
      finishingPartida=publishChain.catch(()=>{}).then(()=>S.PartidaService.finalizar(id)).then(r=>{
        if(!r.success&&!r.offline)console.warn('SIDE: finalizar partida:',r.error);
      });
    }
  }catch(error){console.error('SIDE: supabase finish failed',error)}
  // Keep the completed game linked so its online companies and results remain available.
  const active=Boolean(gameStatus()?.active);
  $('cancelGame')?.classList.toggle('hidden',!canCancelRoom());
  ['copyGameCode','copyGameLink'].forEach(id=>{if($(id))$(id).disabled=!active;});
  refreshStartButton();
}
function advanceRound(fromAuto=false){
  if(state.lifecycleVersion===2){controlGame('avanzar');return;}

  if(!gameStatus()?.active){toast('Primero pulsa Iniciar partida.');return}
  // Bloquear avance solo si hay integración de 60 min Y quedan segundos en round 1
  if(state.round===1&&state.integrationMinutes===60&&state.seconds>0){
    toast('Espera a que termine la hora de integración.');return;
  }
  if(cycleMode()==='automatic'&&!fromAuto){toast('Los ciclos avanzan según el calendario automático.');return}
  closeBusinessLocalRound();
  const max=Number($('cycles').value||6);
  if(state.round>=max){
    if(state.timer){clearInterval(state.timer);state.timer=null}
    state.roundClosed=true;
    writeRuntime({running:false,status:'simulation-finished',remaining:0});
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false,finishedAt:new Date().toISOString(),code:$('gameCode').value}));
    finishSupabasePartida();refreshSetupSummary();
    $('roundState').textContent='Simulación finalizada';
    toast('La simulación llegó al último ciclo.');return;
  }
  if(state.timer){clearInterval(state.timer);state.timer=null}
  state.round++;state.roundClosed=false;state.seconds=roundSeconds();
  localStorage.setItem('SIDE_ACTIVE_ROUND',String(state.round));
  triggerGroupEvents(state.round);saveConfig(true);updateTimer();updateRoundDisplay();loadReports();
  if(cycleMode()==='automatic'||fromAuto){
    writeRuntime({round:state.round,running:false,status:'ready',remaining:state.seconds});
    beginTimer(true);$('roundState').textContent='Nuevo ciclo automático';
  }else{
    writeRuntime({round:state.round,running:false,status:'ready',remaining:state.seconds});
    $('roundState').textContent='Nuevo ciclo listo';
    toast(`Ciclo ${state.round} disponible.`);
  }
}

/** Caché del catálogo Supabase para mapear IDs a etiquetas (Fase C2). @type {object|null} */
let catalogCache=null;
/**
 * Catálogo Supabase cacheado en memoria.
 * @returns {Promise<object|null>} {decisions, decById: Map, optById: Map} o null si offline.
 */
async function supabaseCatalog(){
  const S=window.SIDE||{};
  if(!S.DecisionesService||!S.SupabaseClient?.isReady())return null;
  if(catalogCache)return catalogCache;
  const r=await S.DecisionesService.obtenerCatalogo();
  if(!r.success)return null;
  catalogCache={
    decisions:r.data.decisions||[],
    decById:new Map((r.data.decisions||[]).map(d=>[d.id,d])),
    optById:new Map((r.data.options||[]).map(o=>[o.id,o]))
  };
  return catalogCache;
}
/**
 * Calcula apartados y progreso desde decisiones sincronizadas (no local).
 * Obligatorio = catálogo con es_obligatoria=true y tipo distinto de 'info'.
 * Nota: MOLDE es condicional en local (solo si no hay moldes propios); aquí
 * cuenta siempre como obligatorio (aproximación documentada).
 * @param {object|null} cat Catálogo cacheado {decisions, decById}.
 * @param {Array} rows Filas de empresas_decisiones del ciclo actual.
 * @returns {{apartados: object, progreso: number, total: number}} total = obligatorias del catálogo.
 */
function remoteProgress(cat,rows){
  const oblig=new Map();
  for(const d of (cat?.decisions||[])){
    if(d.tipo==='info'||d.es_obligatoria!==true)continue;
    if(!oblig.has(d.categoria))oblig.set(d.categoria,new Set());
    oblig.get(d.categoria).add(d.decision_id);
  }
  const synced=new Map();
  for(const r of (rows||[])){
    const dd=cat?.decById.get(r.decision_id);
    if(!dd?.decision_id)continue;
    const c=dd.categoria||'?';
    if(!synced.has(c))synced.set(c,new Set());
    synced.get(c).add(dd.decision_id);
  }
  const apartados={};let doneAll=0,totalAll=0;
  for(const c of ['B','C','D','E','F']){
    const tot=oblig.get(c)||new Set();
    const don=[...(synced.get(c)||new Set())].filter(x=>tot.has(x));
    doneAll+=don.length;totalAll+=tot.size;
    apartados[c]={complete:tot.size?don.length>=tot.size:true,done:don.length,total:tot.size};
  }
  return{apartados,progreso:totalAll?Math.round(100*doneAll/totalAll):0,total:totalAll};
}
/**
 * Construye reportes desde Supabase para la partida actual (Fase C2).
 * Fusión: Supabase manda en campos sincronizados (decisiones, caja, ciclo,
 * enviado, apartados y progreso calculados del ciclo actual); local conserva
 * lo vivo (actividad, financieros, puntaje) y sirve de respaldo sin filas.
 * @returns {Promise<Array|null>} Reportes fusionados o null si offline/sin partida.
 */
async function supabaseReports(reportsBase=state.reports){
  const S=window.SIDE||{};
  if(!S.PartidaService||!S.DecisionesService||!S.SupabaseClient?.isReady())return null;
  if(!state.partidaId)return null;
  const partidaId=state.partidaId,generation=roomGeneration,code=$('gameCode').value,localBase=reportsBase.slice();
  const stillCurrent=()=>partidaId===state.partidaId&&generation===roomGeneration;
  const parts=await S.PartidaService.listarParticipantes(partidaId);
  if(!stillCurrent())return null;
  if(!parts.success){rosterSyncError=parts.error||'Error de conexión';return null;}
  rosterSyncError='';
  const roster=(parts.data||[]).filter(p=>p.empresa_id).map(p=>({id:'sb-'+p.empresa_id,empresaId:p.empresa_id,teacherScore:p.puntaje_docente??null,partida:$('gameCode').value,empresa:p.empresas?.nombre_comercial||p.empresa,legalName:p.empresas?.nombre_legal||null,nombre:p.nombre||'Jugador',ronda:p.empresas?.ciclo_actual||1,caja:p.empresas?.caja_actual||0,fuente:'supabase',estado:'activa'}));
  // Reconcile presence immediately, before slow financial report requests.
  for(const p of parts.data||[])if(p.empresa_id)presenceTracker.observe(`${partidaId}:${p.empresa_id}`,p.last_seen_at);
  const known=new Set(localBase.map(r=>r.empresaId||r.empresa));
  localBase.push(...roster.filter(r=>!known.has(r.empresaId||r.empresa)));
  const cat=await supabaseCatalog();
  if(!stillCurrent())return null;
  const out=[];
  // Fetch independent financial reports concurrently; avoid N serial network
  // timeouts freezing the whole roster. Each failure keeps its last snapshot.
  const reportRows=new Map();
  const participants=(parts.data||[]).filter(p=>p.empresa_id);
  let nextReport=0;
  await Promise.all(Array.from({length:Math.min(4,participants.length)},async()=>{
    while(nextReport<participants.length){const p=participants[nextReport++];
      try{reportRows.set(p.empresa_id,await S.DecisionesService.obtenerReporte(p.empresa_id));}
      catch(error){reportRows.set(p.empresa_id,{success:false,error:error.message});}
    }
  }));
  if(!stillCurrent())return null;
  const failures=[];
  for(const p of (parts.data||[])){
    if(!p.empresa_id)continue;
    const rr=reportRows.get(p.empresa_id)||{success:false,error:'Reporte no disponible'};
    if(!rr.success)failures.push(`${p.empresas?.nombre_comercial||p.empresa||p.empresa_id}: ${rr.error||'No se pudo leer el reporte'}`);
    if(!stillCurrent())return null;
    const info=rr.success?rr.data:null;
    const emp=info?.empresa||p.empresas||{};
    const context=info?.contexto_juego;
    const scopedContext=context&&context.partida_id===partidaId&&context.codigo===code?context:null;
    const cicloActual=Number(scopedContext?.ciclo||runtime()?.round||emp.ciclo_actual)||1;
    const rows=(info?.decisiones||[]).filter(d=>Number(d.ciclo)===cicloActual);
    const labels=rows.map(d=>{
      const dd=cat?.decById.get(d.decision_id);
      const codeName=dd?.decision_id||('decisión '+d.decision_id);
      const op=cat?.optById.get(d.opcion_id);
      const qty=Number(d.cantidad)||1;
      return op?`${codeName} · ${op.etiqueta}${qty>1?` ×${qty}`:''}`:`${codeName}${qty>1?` ×${qty}`:''}`;
    });
    // Financial fallbacks belong to this exact company and cycle.
    const local=localBase.find(x=>x.empresaId===p.empresa_id&&Number(x.ronda)===cicloActual&&!x.provisional);
    const prog=rows.length?remoteProgress(cat,rows):{apartados:{},progreso:0,total:0};
    const rep=((info?.reportes)||[]).find(r=>Number(r.ciclo)===cicloActual)||null;
    out.push({
      id:local?.id||('sb-'+p.empresa_id),empresaId:p.empresa_id,teacherScore:p.puntaje_docente??null,
      nombre:p.nombre||local?.nombre||'Jugador',
      empresa:emp.nombre_comercial||p.empresa,
      legalName:emp.nombre_legal||p.empresas?.nombre_legal||local?.legalName||null,
      partida:code,
      ronda:cicloActual,rondasActivas:cicloActual,
      capital:rep?Number(rep.capital):(emp.caja_inicial??local?.capital??0),
      caja:rep?Number(rep.caja_final):(emp.caja_actual??local?.caja??0),
      ingresos:rep?Number(rep.ingresos):(local?.ingresos??0),
      cycleReceipt:rep?.estado_resultados?.cycleReceipt||local?.cycleReceipt||null,
      cycleHistory:(info?.reportes||[]).map(h=>({round:Number(h.ciclo),closureStatus:h.estado_resultados?.cycleReceipt?'closed':'pending',cycleReceipt:h.estado_resultados?.cycleReceipt||null,estadoResultados:h.estado_resultados||{},balanceCaja:h.balance_caja||{},flujoCaja:h.flujo_caja||{},balanceGeneral:h.estado_resultados?.balanceGeneral||{}})).filter(h=>h.cycleReceipt).sort((a,b)=>a.round-b.round),
      unidadesVendidas:rep?.estado_resultados?.cycleReceipt?.sold??local?.unidadesVendidas??null,provisional:false,
      costos:rep?Number(rep.costos):(local?.costos??0),
      utilidad:rep?Number(rep.utilidad):(local?.utilidad??0),
      decisiones:labels.length?labels:(local?.decisiones||[]),
      enviado:rows.some(d=>d.enviada)||!!local?.enviado,
      eventos:local?.eventos||[],
      estadoResultados:rep?.estado_resultados||local?.estadoResultados||{},
      balanceCaja:rep?.balance_caja||local?.balanceCaja||{},
      balanceGeneral:rep?.estado_resultados?.balanceGeneral||rep?.balance_caja?.balanceGeneral||rep?.estado_resultados?.excel?.financial?.balanceGeneral||local?.balanceGeneral||{},
      flujoCaja:rep?.flujo_caja||local?.flujoCaja||{},
      apartados:prog.total>0?prog.apartados:(local?.apartados||{}),progreso:prog.total>0?prog.progreso:(local?.progreso||0),
      score:rep?Number(rep.score):(local?.score||0),
      estado:p.expulsada_at||emp.estado==='eliminada'?'eliminada':'activa',expulsadaAt:p.expulsada_at||null,tomandoDecisiones:!p.expulsada_at&&!!local?.tomandoDecisiones,
      conectada:Boolean(p.last_seen_at),lastSeenAt:p.last_seen_at||null,integracion:runtime()?.phase==='integration',
      updatedAt:rep?.updated_at||rep?.created_at||local?.updatedAt||null,fuente:'supabase'
    });
    const report=out[out.length-1];
    if(scopedContext?.configuracion?.materialRulesVersion==='receipts-v1'){
      report.materialPreview='<p role="status">Datos de recepción no verificados / proyección no disponible.</p>';
      try{
        const context=await S.DecisionesService.obtenerContextoMaterial(partidaId,p.empresa_id,cicloActual,false);
        if(!stillCurrent())return null;
        const latestRuntime=runtime();
        if(latestRuntime?.round!=null&&Number(latestRuntime.round)!==cicloActual)return null;
        if(latestRuntime?.phase&&scopedContext.phase&&latestRuntime.phase!==scopedContext.phase)return null;
        const snap=scopedContext.snapshot,plan=snap?.decision_state?.__cyclePlans?.[cicloActual]?.state;
        if(context?.success&&snap?.decisions_submitted===true&&plan){
          const restored=window.SIDE_CYCLE_MODEL.restoreState(plan,snap.decision_state);
          const production=window.SIDE_PRODUCTION_MODEL.calculate({state:{...restored,__materialOrders:context.data},catalog:window.SIDE_DECISION_CATALOG,round:cicloActual,config:scopedContext.configuracion});
          report.materialPreview=window.SIDE_MATERIAL_PREVIEW.html(context.data,production);
          if(scopedContext.configuracion.deliveryPolicy==='explicit_provider_event_v1'){
            const events=Object.values(context.data.events||{});
            report.materialDeliveryForms=events.filter(e=>e.type==='order').map(o=>{
              const received=events.filter(e=>e.type==='receipt'&&e.orderId===o.orderId).reduce((sum,e)=>sum+Number(e.quantity||0),0),pending=Number(o.quantity)-received;
              return pending>0?`<form data-provider-delivery="${escapeAttr(o.orderId)}"><label>Entrega efectiva de ${escapeHtml(o.sku)} (pendiente ${escapeHtml(pending)} ${escapeHtml(o.unit)}): <input type="number" min="0.01" max="${escapeAttr(pending)}" step="0.01" required></label><button type="submit">Registrar entrega del proveedor</button><span role="status"></span></form>`:'';
            }).join('');
          }
        }
      }catch(error){console.warn('SIDE: previsualización de recepción no disponible',error);}
    }
    // A report can precede the durable plan or lag behind it. Calculate from
    // the same confirmed snapshot as the student, scoped to this room/cycle.
    if(scopedContext&&scopedContext.configuracion?.materialRulesVersion!=='receipts-v1'&&window.SIDE_LIVE_RESULTS&&!p.expulsada_at&&emp.estado!=='eliminada'){
      try{
        const result=window.SIDE_LIVE_RESULTS.calculate({snapshot:scopedContext.snapshot,round:cicloActual,capital:Number(emp.caja_inicial)||0,
          catalog:window.SIDE_DECISION_CATALOG,config:scopedContext.configuracion,id:p.empresa_id,
          phase:scopedContext.estado==='activa'?scopedContext.phase:'integration'});
        if(result&&!result.provisional&&!report.cycleReceipt){
          window.SIDE_LIVE_RESULTS.apply(report,result);
          report.updatedAt=scopedContext.updated_at||report.updatedAt;
        }
      }catch(error){failures.push(`${report.empresa}: no se pudo calcular el plan confirmado`);console.warn('SIDE: resultados en vivo pendientes',error);}
    }else if(info&&!context){
      const compatible=window.SIDE_LIVE_RESULTS?.fromReport(rep,{game:code,company:p.empresa_id,round:cicloActual,phase:runtime()?.phase});
      if(compatible&&!p.expulsada_at&&emp.estado!=='eliminada')window.SIDE_LIVE_RESULTS.apply(report,compatible);
      else failures.push('Aplica supabase/migrations/20261027_resultados_en_vivo.sql para leer el plan en vivo');
    }
  }
  if(failures.length)rosterSyncError='Reportes pendientes de sincronizar: '+failures.join('; ');
  const ids=new Set(out.map(r=>r.empresaId));
  const names=new Set(out.map(r=>r.empresa));
  for(const l of localBase){if(l.empresaId?!ids.has(l.empresaId):!names.has(l.empresa))out.push({...l,localOnly:true})}
  return out;
}
// Closed financial results are authoritative for their room, company and cycle.
// Keep them across roster refreshes, which may still return an older snapshot.
const confirmedReportClosures=new Map();
function applyConfirmedReportClosures(reports){
  for(const report of reports){
    const key=JSON.stringify([roomGeneration,state.partidaId,Number(report.ronda),String(report.empresaId)]);
    const financial=confirmedReportClosures.get(key);
    if(!financial)continue;
    const f=JSON.parse(JSON.stringify(financial));
    Object.assign(report,{provisional:false,cycleReceipt:f.cycleReceipt||report.cycleReceipt,unidadesVendidas:Number(f.cycleReceipt?.sold??report.cycleReceipt?.sold??0),ingresos:f.estadoResultados.ingresos,costos:f.estadoResultados.costos,utilidad:f.estadoResultados.utilidad,caja:f.balanceCaja.cajaFinal,estadoResultados:f.estadoResultados,balanceCaja:f.balanceCaja,flujoCaja:f.flujoCaja,balanceGeneral:f.balanceGeneral});
  }
  return reports;
}
let rosterSyncError='',reportsBusy=false,reportsAgain=false,reportsRevision=0,providerDeliveryPending=0;
function providerDeliveryEditing(){return !!document.activeElement?.closest?.('[data-provider-delivery]');}
async function loadReports(){
  if(providerDeliveryPending||providerDeliveryEditing()){reportsAgain=true;return;}
  if(reportsBusy){reportsAgain=true;return;}reportsBusy=true;
  const partidaId=state.partidaId,generation=roomGeneration,code=$('gameCode').value,revision=reportsRevision;
  const stillCurrent=()=>partidaId===state.partidaId&&generation===roomGeneration&&code===$('gameCode').value;
  try{
  const cached=state.reports;
  if(state.authoritative?.materialRulesVersion==='receipts-v1'){for(const report of cached){report.materialPreview='<p role="status">Datos de recepción no verificados / proyección no disponible.</p>';report.materialDeliveryForms='';}renderResults();}
  let local=[];try{local=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')||[]}catch{}
  local=local.filter(r=>r.partida===code);
  if(!partidaId&&window.SIDE_LIVE_RESULTS)for(const report of local){
    try{
      const result=window.SIDE_LIVE_RESULTS.calculate({snapshot:{decision_state:report.gameState,cash_ledger:report.cashLedger,financial_sections:report.financialSections},
        round:Number(report.ronda),capital:report.capital,catalog:window.SIDE_DECISION_CATALOG,config:state.authoritative||{},id:report.empresaId||report.id,
        phase:runtime()?.phase||'integration'});
      window.SIDE_LIVE_RESULTS.apply(report,result);
    }catch(error){console.warn('SIDE: resultados locales pendientes',error);}
  }
  const base=partidaId?cached.filter(r=>r.fuente==='supabase'&&r.partida===code):[];
  const keys=new Set(base.map(r=>r.empresaId||r.id));
  base.push(...local.filter(r=>!keys.has(r.empresaId||r.id)));
  // Keep the displayed roster intact until the whole next snapshot is ready.
  // Replacing it with localStorage while awaiting Supabase made the lobby blink.
  try{
    const remote=await supabaseReports(base);
    if(!stillCurrent())return;
    if(providerDeliveryPending||providerDeliveryEditing()){reportsAgain=true;return;}
    // A closure received while this read was pending owns the newer results.
    if(revision!==reportsRevision){reportsAgain=true;return;}
    state.reports=applyConfirmedReportClosures(remote||base);
  }catch(error){if(!stillCurrent())return;rosterSyncError=error.message;console.error('SIDE: no se pudieron cargar reportes de Supabase',error)}
  renderCompanies();renderResults();renderWinnerSelect();renderTeacherLobby();
  }finally{reportsBusy=false;if(reportsAgain){reportsAgain=false;setTimeout(loadReports,100);}}
}
function sectionBadges(r){const a=r.apartados||{};return Object.entries(a).map(([k,v])=>`<span class="section-status ${v.complete?'done':'pending'}">${escapeHtml(k)} ${v.complete?'✓':`${v.done||0}/${v.total||0}`}</span>`).join('')||'<span class="section-status pending">Sin datos</span>'}
const presenceTracker=window.SIDE.TeacherSync.createPresenceTracker({now:teacherNow});
function companyNodeKey(r){return String(r.empresaId||r.id);}
function companyPresenceKey(r){return `${state.partidaId||$('gameCode').value}:${companyNodeKey(r)}`;}
const gradeUiStatus=new Map();
const gradeUiErrors=new Map();
const gradeFailureNotified=new Set();
function companyPresence(r){
  if(r.fuente!=='supabase'){if(!r.conectada)return 'idle';presenceTracker.observe(companyPresenceKey(r),r.lastSeenAt||r.updatedAt);}
  return presenceTracker.get(companyPresenceKey(r));
}
function companyActivity(r,presence){
  if(r.estado==='eliminada')return r.expulsadaAt?'ELIMINADA POR INACTIVIDAD · FUERA DE LA PARTIDA':'ELIMINADA SEGÚN REGLAS DEL MODELO · FUERA DE LA PARTIDA';
  if(podiumOptions().finished)return 'PARTICIPACIÓN FINALIZADA';
  if(presence==='online')return r.integracion?'CONECTADA · EN SALA DE ESPERA':r.tomandoDecisiones?'CONECTADA · TOMANDO DECISIONES':'CONECTADA · EN PARTIDA';
  return presence==='idle'?'SIN ACTIVIDAD RECIENTE':'REGISTRADA · PRESENCIA SIN CONFIRMAR';
}
function gradeKey(r){return `${$('gameCode').value}:${r.empresaId||r.empresa.trim().toUpperCase()}`;}
function grades(){try{return JSON.parse(localStorage.getItem('SIDE_TEACHER_GRADES')||'{}')||{}}catch{return {}}}
function gradeValue(r){const local=grades()[gradeKey(r)];return local?.value??r.teacherScore??null;}
function gradeLabel(r){const value=gradeValue(r);return value==null?'Sin calificar':`${Number(value).toLocaleString('es-PE')} / 20`;}
const gradeQueue=window.SIDE.TeacherSync.createGradeQueue({
  storage:localStorage,
  save:({partidaId,empresaId,puntaje})=>window.SIDE.PartidaService.guardarPuntaje(partidaId,empresaId,puntaje),
  onStatus:(key,status,error)=>{
    gradeUiStatus.set(key,status);
    if(error)gradeUiErrors.set(key,error);else gradeUiErrors.delete(key);
    if(status==='saving'||status==='saved')gradeFailureNotified.delete(key);
    if(status==='saved'){
      const latest=grades(),entry=latest[key];
      if(entry){entry.pending=false;try{localStorage.setItem('SIDE_TEACHER_GRADES',JSON.stringify(latest));}catch(error){console.warn('SIDE: nota remota guardada; copia local no disponible',error);}}
      const report=state.reports.find(r=>gradeKey(r)===key);
      if(report&&entry)report.teacherScore=entry.value;
    }
    if(status==='failed'&&!gradeFailureNotified.has(key)){
      gradeFailureNotified.add(key);
      toast('No se pudo sincronizar la nota. Reintentando…');
    }
    const form=[...document.querySelectorAll('[data-grade-form]')].find(f=>{
      const r=state.reports.find(x=>x.id===f.dataset.gradeForm);return r&&gradeKey(r)===key;
    });
    if(form)form.querySelector('[data-grade-status]').textContent=gradeStatus(key);
    if(status==='saved'){renderResults();renderWinnerSelect();}
  }
});
function gradeStatus(key){
  const status=gradeUiStatus.get(key);
  if(status==='storage-error')return gradeUiErrors.get(key)||'Mantén esta página abierta hasta sincronizar la nota.';
  if(status==='retrying'||status==='failed')return (gradeUiErrors.get(key)||'No se pudo sincronizar la nota.')+' · Pendiente de guardar; reintentando…';
  const local=grades()[key],report=state.reports.find(r=>gradeKey(r)===key);
  if(status==='saving'||local?.pending)return 'Guardando…';
  if(status==='saved'||local||report?.teacherScore!=null)return 'Guardado ✓'+(report?.empresaId?' · Supabase':' · en este navegador');
  return 'Sin calificar';
}
function saveCompanyGrade(id,value){
  const report=state.reports.find(r=>r.id===id);if(!report)return;
  if(report.fuente==='supabase'&&(!report.empresaId||!state.partidaId)){toast('No se pudo identificar la partida de esta empresa. Recarga antes de guardar la nota.');return false;}
  if(String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>20){toast('Escribe una nota entre 0 y 20.');return false;}
  const note=Math.round(Number(value)*100)/100,all=grades(),key=gradeKey(report),entry={value:note,pending:Boolean(report.empresaId&&state.partidaId),updatedAt:new Date().toISOString()};
  all[key]=entry;
  try{localStorage.setItem('SIDE_TEACHER_GRADES',JSON.stringify(all));}
  catch(error){
    toast('No se pudo conservar la nota en este dispositivo. Mantén esta página abierta hasta sincronizar.');
    if(!entry.pending)return false;
  }
  if(entry.pending){
    gradeQueue.enqueue(key,{partidaId:state.partidaId,empresaId:report.empresaId,puntaje:note});
  }else gradeUiStatus.set(key,'saved');
  renderCompanies();renderResults();renderWinnerSelect();return true;
}
function renderCompanies(force=false){
  if($('companiesLiveStatus'))$('companiesLiveStatus').textContent=`${state.reports.filter(r=>r.estado!=='eliminada').length} empresa(s) en partida · ${state.reports.filter(r=>r.estado==='eliminada').length} eliminada(s) · ${rosterSyncError?'Sincronización pendiente: '+rosterSyncError+' · Reintentando…':'actualización automática cada 3 segundos'}`;
  const grid=$('companiesGrid');
  const expelledGrid=$('companiesExpelledGrid'),expelledCount=state.reports.filter(r=>r.estado==='eliminada').length;
  $('expelledCompanies')?.classList.toggle('hidden',!expelledCount);
  if($('expelledCompaniesCount'))$('expelledCompaniesCount').textContent=expelledCount;
  const current=new Map([...grid.querySelectorAll('[data-company-id]'),...(expelledGrid?.querySelectorAll('[data-company-id]')||[])].map(card=>[card.dataset.companyId,card]));
  if(!state.reports.length){if(grid.textContent!=='Aún no hay empresas reportadas en esta partida.')grid.innerHTML='<div class="card">Aún no hay empresas reportadas en esta partida.</div>';expelledGrid?.replaceChildren();return;}
  grid.querySelector('.card:not([data-company-id])')?.remove();
  for(const [i,r] of state.reports.entries()){
    const key=companyNodeKey(r);let card=current.get(key);
    if(!card){
      card=document.createElement('article');card.className='company-card';card.dataset.companyId=key;
      card.innerHTML=`<div class="company-status-line"><span class="live-dot"></span><b data-field="presence"></b></div><h3 data-field="company"></h3><small data-field="student"></small><div class="section-status-row" data-field="sections"></div><div class="score" data-field="progress"></div><div class="metric"><span>Caja</span><b data-field="cash"></b></div><div class="metric"><span>Utilidad del ciclo</span><b data-field="profit"></b></div><div class="metric"><span>Ingresos</span><b data-field="income"></b></div><div class="metric"><span>Unidades vendidas</span><b data-field="sold"></b></div><small data-field="resultScope"></small><p class="company-result-alert" data-field="resultAlert" role="status" hidden></p><form class="company-grade" data-grade-form="${escapeAttr(r.id)}"><label for="grade-${escapeAttr(key)}">Puntaje del profesor · 0 a 20</label><div><input id="grade-${escapeAttr(key)}" data-grade type="number" min="0" max="20" step="0.01" required placeholder="Sin calificar"><button class="secondary" type="submit">Guardar nota</button></div><small data-grade-status></small></form><button class="secondary company-results-button" type="button" data-view-results="${escapeAttr(r.id)}">Ver resultados</button><button class="secondary" type="button" data-release-company>Liberar acceso de empresa</button><button class="eliminate" type="button" data-eliminate></button>`;
      card.querySelector('[data-eliminate]').addEventListener('click',()=>toggleElimination(state.reports.findIndex(x=>companyNodeKey(x)===key)));
      card.querySelector('[data-release-company]')?.addEventListener('click',()=>releaseCompanyAccess(state.reports.find(x=>companyNodeKey(x)===key)));
      card.querySelector('[data-view-results]').addEventListener('click',()=>{state.resultCompanyId=card.dataset.reportId;switchTab('resultados');renderResults();});
      const form=card.querySelector('[data-grade-form]'),input=form.querySelector('input');
      input.addEventListener('input',()=>{input.dataset.dirty='true';});
      form.addEventListener('submit',event=>{event.preventDefault();if(saveCompanyGrade(card.dataset.reportId,input.value))input.dataset.dirty='';});
    }
    const destination=r.estado==='eliminada'&&expelledGrid?expelledGrid:grid;
    if(card.parentElement!==destination)destination.appendChild(card);
    card.dataset.reportId=r.id;
    card.querySelector('[data-grade-form]').dataset.gradeForm=r.id;
    card.querySelector('[data-view-results]').dataset.viewResults=r.id;
    current.delete(key);
    const setText=(field,value)=>{const el=card.querySelector(`[data-field="${field}"]`);if(el.textContent!==value)el.textContent=value;};
    const presence=r.estado==='eliminada'?'idle':companyPresence(r);
    card.classList.toggle('company-expelled',r.estado==='eliminada');
    card.querySelector('.live-dot').classList.toggle('online',presence==='online');
    card.querySelector('.live-dot').classList.toggle('idle',presence!=='online');
    setText('presence',companyActivity(r,presence));
    setText('company',r.empresa);
    setText('student',`${r.nombre||'Jugador'} · ciclo ${r.rondasActivas||r.ronda||0}`);
    setText('progress',`${Number(r.progreso||0)}% decisiones obligatorias`);
    const remotePending=state.partidaId&&(!r.cycleReceipt||r.provisional);
    setText('cash',remotePending?'Pendiente':money(r.caja??r.capital));setText('profit',remotePending?'Pendiente':money(r.utilidad));
    setText('income',!remotePending&&(r.cycleReceipt||r.provisional)?money(r.ingresos):'Pendiente');setText('sold',remotePending?'Pendiente':String(r.unidadesVendidas??r.cycleReceipt?.sold??'Pendiente'));
    setText('resultScope',r.provisional?'Estimación individual · ciclo en juego':r.cycleReceipt?'Resultado definitivo del ciclo':'Esperando plan confirmado o cierre del ciclo');
    const rec=r.cycleReceipt, reasons=window.SIDE_STUDENT_FINANCIAL_VIEW?.zeroReasons(rec)||[];
    const purchases=Number(rec?.production?.costs?.materials||0)>0||Number(rec?.production?.costs?.labor||0)>0||(rec?.production?.materials||[]).some(m=>Number(m.purchasesAvailable)>0)||(rec?.production?.processes||[]).some(p=>Number(p.machines)>0)||Number(rec?.production?.availableMoldIds?.length)>0;
    const warning=rec&&((purchases&&!Number(rec.produced))||(Number(rec.produced)>0&&!Number(rec.revenue)));
    const alert=card.querySelector('[data-field="resultAlert"]');alert.hidden=!warning;
    if(warning)setText('resultAlert',`${!Number(rec.produced)?'Compras o plan sin producción':'Producción sin ingresos'}: ${reasons.join(' ')||'Revisa el detalle del cierre.'}`);

    for(const [field,label]of [['cash',r.provisional?'Caja estimada al cierre':'Caja'],['profit',r.provisional?'Utilidad estimada':'Utilidad del ciclo'],['income',r.provisional?'Ingresos estimados':'Ingresos'],['sold',r.provisional?'Unidades vendidas estimadas':'Unidades vendidas']])card.querySelector(`[data-field="${field}"]`).previousElementSibling.textContent=label;
    const sections=sectionBadges(r),sectionEl=card.querySelector('[data-field="sections"]');if(sectionEl.innerHTML!==sections)sectionEl.innerHTML=sections;
    const input=card.querySelector('[data-grade]'),value=gradeValue(r);
    if(document.activeElement!==input&&input.dataset.dirty!=='true'&&input.value!==String(value??''))input.value=value??'';
    const status=gradeStatus(gradeKey(r)),statusEl=card.querySelector('[data-grade-status]');if(statusEl.textContent!==status)statusEl.textContent=status;
    const busy=eliminationPending.has(`${state.partidaId||$('gameCode').value}:${key}`);
    const release=card.querySelector('[data-release-company]');if(release)release.hidden=!state.partidaId||!r.empresaId;
    const eliminate=card.querySelector('[data-eliminate]'),label=busy?'Confirmando…':r.estado==='eliminada'?'Reactivar empresa':'Eliminar por inactividad';if(eliminate.textContent!==label)eliminate.textContent=label;
    eliminate.disabled=busy;eliminate.setAttribute('aria-busy',String(busy));
    eliminate.classList.toggle('hidden',podiumOptions().finished);
  }
  for(const card of current.values())card.remove();
  if(!state.reports.some(r=>r.estado!=='eliminada'))grid.innerHTML='<div class="card">No hay empresas activas en la partida.</div>';
}
const eliminationPending=new Set();
async function toggleElimination(i){
  const r=state.reports[i];if(!r||podiumOptions().finished)return false;
  const partidaId=state.partidaId,generation=roomGeneration,key=companyNodeKey(r),code=$('gameCode').value;
  const pendingKey=`${partidaId||code}:${key}`,expulsar=r.estado!=='eliminada';
  if(eliminationPending.has(pendingKey))return false;
  eliminationPending.add(pendingKey);renderCompanies();
  try{
    let expulsadaAt=expulsar?new Date().toISOString():null;
    if(partidaId||r.empresaId||r.fuente==='supabase'){
      const response=await window.SIDE.PartidaService.expulsarEmpresa(partidaId,r.empresaId,expulsar);
      if(generation!==roomGeneration||partidaId!==state.partidaId)return false;
      if(!response?.success){toast(response?.error||'No se pudo confirmar el cambio de participación.','error');return false;}
      expulsadaAt=response.data.expulsada_at;
    }else{
      const exclusions=JSON.parse(localStorage.getItem('SIDE_COMPANY_EXCLUSIONS')||'{}');
      if(expulsar)exclusions[`${code}_${r.empresa}`]=true;else delete exclusions[`${code}_${r.empresa}`];
      localStorage.setItem('SIDE_COMPANY_EXCLUSIONS',JSON.stringify(exclusions));
    }
    // Una actualización en vivo puede haber reemplazado el objeto del reporte.
    const current=state.reports.find(x=>companyNodeKey(x)===key);
    if(current){current.estado=expulsadaAt?'eliminada':'activa';current.expulsadaAt=expulsadaAt;if(expulsadaAt)current.tomandoDecisiones=false;}
    persistReports();renderResults();renderWinnerSelect();renderTeacherLobby();
    if(expulsadaAt&&$('expelledCompanies'))$('expelledCompanies').open=true;
    toast(r.empresa+(expulsadaAt?' fue eliminada de la partida.':' fue reactivada.'));
    return true;
  }catch(error){toast(error?.message||'No se pudo confirmar el cambio de participación.','error');return false;}
  finally{eliminationPending.delete(pendingKey);if(generation===roomGeneration)renderCompanies();}
}
async function releaseCompanyAccess(report){
  if(!state.partidaId||!report?.empresaId)return;
  if(!window.confirm(`¿Liberar el acceso de ${report.empresa}? El próximo estudiante que ingrese podrá reclamar la empresa.`))return;
  const client=window.SIDE?.SupabaseClient?.get?.();if(!client){toast('No hay conexión a Supabase.','error');return;}
  try{const {data,error}=await client.rpc('side_liberar_empresa',{p_partida_id:state.partidaId,p_empresa_id:report.empresaId});if(error||data?.error||data?.success===false){toast(error?.message||data?.error||'No se pudo liberar el acceso.','error');return;}toast('Acceso liberado. El próximo estudiante puede reclamar la empresa.');}
  catch(error){console.error('SIDE: error al liberar empresa',error);toast(error?.message||'No se pudo liberar el acceso.','error');}
}
function persistReports(){localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(state.reports))}

function eventReportTable(r){const events=r.eventos||[];if(!events.length)return '<p class="hint">Sin eventos reportados.</p>';return `<div class="mini-event-report"><div class="mini-event-head"><span>Descripción</span><span>Afectados</span><span>Ciclos</span><span>Implicancia</span><span>Ocurrencia</span></div>${events.map(e=>`<div><span><b>${escapeHtml(e.titulo||'Evento')}</b><small>${escapeHtml(e.descripcion||'')}</small></span><span>${escapeHtml(e.afectados||'')}</span><span>${escapeHtml(e.cicloAfecta||String(e.ciclos||1))}</span><span>${escapeHtml(e.implicancia||'')}</span><span>${Number(e.ocurrencia||0)}%</span></div>`).join('')}</div>`}

function teacherFinancialDetail(r){
  const fc=r.flujoCaja||{},bg=r.balanceGeneral||r.balanceCaja?.balanceGeneral;
  const row=(label,value)=>`<div class="metric"><span>${label}</span><b>${money(value)}</b></div>`;
  return `<details><summary>Flujo de caja y balance general</summary>${row('Caja al inicio',fc.cajaInicial??r.balanceCaja?.cajaInicial)}${row('Cobros por ventas',fc.cobrosVentas)}${row('Devoluciones',fc.reembolsos)}${row('Pagos operativos',fc.pagosOperacion)}${row('Eventos',fc.eventos)}${row('Otros movimientos',fc.otros)}${row('Compra de activos',fc.compraActivos)}${row('Venta de activos',fc.ventaActivos)}${row('Préstamos recibidos',fc.financiamiento)}${row('Caja al cierre',fc.cajaFinal??r.caja)}<h4>Balance general</h4>${bg?row('Efectivo',bg.efectivo)+row('Inventarios',bg.inventarios)+row('Equipos, moldes y mejoras (netos)',bg.activosFijos)+row('Total activos',bg.activos)+row('Deuda financiera',bg.deuda)+row('Patrimonio',bg.patrimonio)+row('Pasivo + patrimonio',bg.pasivoPatrimonio):'<p>El alumno aún no ha sincronizado este balance.</p>'}</details>`;
}
function teacherSalesDetail(r){
  if(!r.cycleReceipt)return '<p class="hint">Ciclo no cerrado: resultados pendientes.</p>';
  const products=r.cycleReceipt.marketAllocation?.products||{};
  const simulated=Object.entries(products).filter(([,row])=>row.simulatedCompetitors?.length).map(([id,row])=>`<li>${escapeHtml(id)}: ${row.simulatedCompetitors.length} participantes sintéticos. ${row.simulatedCompetitors.map(c=>`Precio ${money(c.precio)}, reputación ${Number(c.reputacion||0).toFixed(2)}, stock ${Number(c.stock||0)}`).join('; ')}</li>`).join('');
  return `<section class="financial-section"><h4>Ventas del ciclo</h4>${window.SIDE_STUDENT_FINANCIAL_VIEW.salesHtml({round:r.ronda,cycleReceipt:r.cycleReceipt})}${simulated?`<details><summary>Participantes sintéticos del mercado</summary><ul>${simulated}</ul></details>`:''}</section>`;
}
let resultSort='empresa';
function renderResults(){
  const active=state.reports.filter(r=>r.estado!=='eliminada'&&(!state.partidaId||!r.localOnly)),totalProfit=active.reduce((s,r)=>s+(state.partidaId&&(!r.cycleReceipt||r.provisional)?0:Number(r.utilidad||0)),0),graded=active.filter(r=>gradeValue(r)!=null),best=graded.sort((a,b)=>gradeValue(b)-gradeValue(a))[0];
  $('resultStats').innerHTML=[['Empresas en partida',active.length],['Calificadas',graded.length],[active.some(r=>r.provisional)?'Utilidad estimada del ciclo':'Utilidad del ciclo',money(totalProfit)],['Mayor nota',best?gradeLabel(best):'Sin calificar']].map(x=>`<div class="stat"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join('');
  const compare=[...active].sort((a,b)=>resultSort==='empresa'?String(a.empresa).localeCompare(String(b.empresa),'es'):Number(b[resultSort]||0)-Number(a[resultSort]||0));
  let table=$('resultComparison');if(!table&&typeof document!=='undefined'&&$('resultStats')?.after){table=document.createElement('section');table.id='resultComparison';$('resultStats').after(table);}
  if(table){
  table.className='financial-section';table.innerHTML=`<h3>Comparación por empresa</h3><label>Ordenar por <select id="resultComparisonSort"><option value="empresa">Empresa</option><option value="ingresos">Ingresos</option><option value="costos">Costos</option><option value="utilidad">Utilidad</option></select></label><div class="table-wrap"><table><thead><tr><th>Empresa</th><th>Ciclo</th><th>Vendidas</th><th>Ingresos</th><th>Costos operativos</th><th>Utilidad antes de impuestos</th><th>Impuesto a la renta</th><th>Utilidad neta</th><th>Caja</th></tr></thead><tbody>${compare.map(r=>r.cycleReceipt?`<tr><td>${escapeHtml(r.empresa)}</td><td>${Number(r.ronda)||0}</td><td>${Number(r.cycleReceipt.sold||0)}</td><td>${money(r.ingresos)}</td><td>${money(r.estadoResultados?.desgloseCostos?.total??r.costos)}</td><td>${money(r.estadoResultados?.utilidadAntesImpuestos)}</td><td>${money(r.estadoResultados?.impuestoRenta)}</td><td>${money(r.estadoResultados?.utilidadNeta??r.utilidad)}</td><td>${money(r.caja)}</td></tr>`:`<tr><td>${escapeHtml(r.empresa)}</td><td colspan="8">Ciclo pendiente de cierre</td></tr>`).join('')}</tbody></table></div>`;
  table.querySelector('#resultComparisonSort').value=resultSort;table.querySelector('#resultComparisonSort').onchange=e=>{resultSort=e.target.value;renderResults();};}

  const sel=$('resultCompanySelect');
  const selectable=state.partidaId?state.reports.filter(r=>!r.localOnly):state.reports;
  const selected=selectable.find(r=>r.id===state.resultCompanyId)||selectable[0];
  if(!selected){sel.innerHTML='';$('detailReports').innerHTML='<p class="hint">Sin resultados recibidos.</p>';return;}
  state.resultCompanyId=selected.id;
  sel.innerHTML=selectable.map(r=>`<option value="${escapeAttr(r.id)}"${r.id===selected.id?' selected':''}>${escapeHtml(r.empresa)}</option>`).join('');
  const r=selected,pending=state.partidaId&&(!r.cycleReceipt||r.provisional),er=pending?{}:r.estadoResultados||{},bc=pending?{}:r.balanceCaja||{},fc=pending?{}:r.flujoCaja||{},bg=pending?{}:r.balanceGeneral||bc.balanceGeneral||{};
  const section=(title,entries,income=false)=>`<section class="financial-section"><h4>${title}</h4><div class="financial-rows">${entries.map(([label,value],i)=>`<div class="${income?window.SIDE_STUDENT_FINANCIAL_VIEW.incomeRowClass(i):''}"><span class="financial-row-label">${label}</span><strong>${money(value)}</strong></div>`).join('')}</div></section>`;
  $('detailReports').innerHTML=`<div class="individual-report"><h3>${escapeHtml(r.empresa)}</h3><p class="hint">${escapeHtml(r.nombre||'Jugador')} · Ciclo ${Number(r.ronda)||1} · Nota docente: ${gradeLabel(r)}</p><div class="section-status-row">${sectionBadges(r)}</div>${r.materialPreview||''}${r.cycleHistory?.length?window.SIDE_STUDENT_FINANCIAL_VIEW.summaryHtml({history:r.cycleHistory},false):teacherSalesDetail(r)}${section(r.provisional?'Estado de resultados estimado':'Estado de resultados',window.SIDE_STUDENT_FINANCIAL_VIEW.incomeEntries(er),true)}${window.SIDE_STUDENT_FINANCIAL_VIEW.policyWarningsHtml(er)}${section('Balance de caja',[['Caja inicial',bc.cajaInicial??r.capital],['Entradas',bc.entradas],['Salidas',bc.salidas],['Caja final',bc.cajaFinal??r.caja]])}${section('Flujo de caja',[['Operación',fc.operacion],['Inversión',fc.inversion],['Financiamiento',fc.financiamiento],['Flujo neto',fc.flujoNeto]])}${section('Balance general',[['Efectivo',bg.efectivo],['Cuentas por cobrar',bg.cuentasPorCobrar],['Anticipos a proveedores',bg.anticiposMateriales],['Inventarios',bg.inventarios],['Activos fijos netos',bg.activosFijos],['Total activos',bg.activos],['Deuda',bg.deuda],['Cuentas por pagar a proveedores',bg.cuentasPorPagarProveedores],['Impuestos por pagar',bg.impuestosPorPagar],['Intereses por pagar',bg.interesesPorPagar],['Provisión por garantías',bg.provisionGarantias],['Patrimonio',bg.patrimonio],['Pasivo + patrimonio',bg.pasivoPatrimonio]])}<p class="hint">Actualizado: ${r.updatedAt?new Date(r.updatedAt).toLocaleString('es-PE'):'—'}</p>${eventReportTable(r)}</div>`;
  if(r.materialDeliveryForms)$('detailReports').querySelector('.individual-report').insertAdjacentHTML('beforeend',r.materialDeliveryForms);
  ($('detailReports').querySelectorAll?.('[data-provider-delivery]')||[]).forEach(form=>form.addEventListener('submit',async event=>{
    event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]'),quantity=Number(form.querySelector('input').value),game=state.partidaId,generation=roomGeneration,order=form.dataset.providerDelivery;
    if(button.disabled||!Number.isFinite(quantity)||quantity<=0)return;
    const key=`SIDE_DELIVERY_${game}_${order}_${quantity}`;let receiptId;
    try{receiptId=sessionStorage.getItem(key);if(!receiptId){receiptId=crypto.randomUUID();sessionStorage.setItem(key,receiptId);}}catch{status.textContent='No se pudo conservar el identificador de la entrega.';return;}
    button.disabled=true;status.textContent='Registrando entrega…';providerDeliveryPending++;
    let result;try{result=await window.SIDE.DecisionesService.registrarEntregaProveedor(game,order,receiptId,quantity);}
    finally{providerDeliveryPending--;}
    if(game!==state.partidaId||generation!==roomGeneration)return;
    if(!result?.success){button.disabled=false;status.textContent=result?.error||'No se pudo registrar la entrega.';return;}
    try{sessionStorage.removeItem(key);}catch{}
    status.textContent=`Entrega confirmada en el día ${result.data.day}.`;button.blur();await loadReports();
  }));
}
function closeBusinessLocalRound(){
  if(state.partidaId||!window.SIDE_CYCLE_MODEL)return null;
  let reports=[];try{reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]');}catch{}
  const closure=window.SIDE_CYCLE_MODEL.closeReports({reports,game:$('gameCode').value||'SIDE-000',round:state.round,catalog:window.SIDE_DECISION_CATALOG,financialPolicy:window.SIDE_FINANCE_CONFIG?.resolve(state.authoritative||{},state.round)||state.authoritative||{}});
  localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));
  state.reports=reports;renderResults();return closure;
}
async function closeBusinessRemoteRound(ciclo){
  if(!state.partidaId)return true;
  const partidaId=state.partidaId,generation=roomGeneration;
  const response=await window.SIDE.PartidaService.consultarCierreNegocio(partidaId,ciclo);
  if(partidaId!==state.partidaId||generation!==roomGeneration)return false;
  if(!response.success){
    toast(response.migrationMissing?'Aplica la migración 20261023_cierre_negocio.sql para habilitar el cierre de ciclos.':response.error||'No se pudo guardar el cierre del ciclo.');
    const status=$('roundState');if(status)status.textContent=`Cierre del ciclo ${ciclo} pendiente de sincronización.`;
    return false;
  }
  if(response.pending){
    const status=$('roundState');if(status)status.textContent=`Ciclo ${ciclo}: el servidor está procesando el cierre económico. Puedes continuar; los resultados se actualizarán automáticamente.`;
    return true;
  }
  reportsRevision++;
  for(const [empresaId,result] of Object.entries(response.data?.resultadosPorEmpresa||{})){
    const f=result.financial;
    if(!f?.estadoResultados||!f?.balanceCaja)continue;
    const key=JSON.stringify([generation,partidaId,Number(ciclo),String(empresaId)]);
    confirmedReportClosures.set(key,JSON.parse(JSON.stringify({...f,cycleReceipt:result.receipt})));
  }
  applyConfirmedReportClosures(state.reports);
  persistReports();renderResults();return true;
}
function renderWinnerSelect(){renderPodium();
}
let remotePodium=null,podiumGame=null,podiumClock=null,podiumBusy=false,podiumRead=0,podiumLoadError='';
function publishedPodium(){return podiumGame===state.partidaId?remotePodium:null;}
function podiumNow(){return podiumClock?podiumClock.time+(performance.now()-podiumClock.at):Date.now();}
function podiumDelay(){const h=Number($('podiumHours').value),m=Number($('podiumMinutes').value);if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||m<0||m>59||h*60+m<1||h*60+m>4320)throw new Error('Elige entre 1 minuto y 72 horas, con minutos de 0 a 59.');return h*60+m;}
function podiumDate(value){return new Date(value).toLocaleString('es-PE',{timeZoneName:'short'});}
function updatePodiumPreview(){const scheduled=$('podiumPublishMode').value==='schedule';$('podiumDelayFields').classList.toggle('hidden',!scheduled);try{const minutes=scheduled?podiumDelay():0;$('podiumPublishPreview').textContent=minutes?'Publicación prevista: '+podiumDate(podiumNow()+minutes*60000)+'. El plazo comienza al confirmar.':'Se publicará al confirmar, durante 24 horas.';$('podiumPublishError').textContent='';}catch(error){$('podiumPublishError').textContent=error.message;}}
function podiumOptions(){return {finished:Boolean(gameStatus()?.finishedAt&&!gameStatus()?.cancelledAt)};}
function gradingReports(){return window.SIDE_TEACHER_PODIUM.eligibleReports(state.reports,podiumOptions());}
function gradeSignature(){return JSON.stringify(gradingReports().map(r=>[String(r.empresaId||r.id||r.empresa),gradeValue(r)==null?null:Number(gradeValue(r))]).sort((a,b)=>a[0].localeCompare(b[0])));}
function podiumCandidates(){
  return window.SIDE_TEACHER_PODIUM.finalPodium(state.reports,gradeValue,podiumOptions());
}
function renderPodium(){
  const publication=publishedPodium(),sameGame=publication&&(!publication.code||publication.code===$('gameCode').value);
  const visible=Boolean(sameGame&&publication.visible),scheduled=Boolean(sameGame&&publication.scheduled);
  $('podiumSchedule').classList.toggle('hidden',!scheduled);
  if(scheduled){$('podiumScheduledAt').textContent='Publicación: '+podiumDate(publication.publishedAt);const secs=Math.max(0,Math.ceil((Date.parse(publication.publishedAt)-podiumNow())/1000));$('podiumCountdown').textContent=secs?`${Math.floor(secs/3600)} h ${Math.floor(secs%3600/60)} min ${secs%60} s`:'Verificando publicación con el servidor…';}
  // La vista del profesor refleja siempre las notas actuales, incluso al vencer
  // una publicación. El snapshot publicado sólo cambia al volver a publicar.
  const list=podiumCandidates();
  const changed=Boolean(sameGame&&(publication.gradeSignature?publication.gradeSignature!==gradeSignature():JSON.stringify((publication.podium||[]).map(r=>[r.empresa,Number(r.grade)]))!==JSON.stringify(list.map(r=>[r.empresa,Number(r.grade)]))));
  const pending=gradingReports().some(r=>grades()[gradeKey(r)]?.pending||gradeQueue.has(gradeKey(r)));
  const names=['🥇','🥈','🥉'],classes=['first','second','third'];
  $('podiumState').textContent=scheduled?'Publicación programada':visible?(changed?'Notas actualizadas · vista previa':'Publicado · 24 horas'):sameGame?'Publicación vencida · vista previa':'Vista previa';
  $('publishStatus').textContent=podiumLoadError||(scheduled?'El podio se publicará automáticamente y estará disponible durante 24 horas.':pending?'Hay notas pendientes de sincronizar. Espera a que aparezcan como guardadas antes de publicar.':changed?'Las notas cambiaron. Pulsa PUBLICAR PODIO para publicar las calificaciones actuales.':visible?'Disponible hasta: '+podiumDate(publication.expiresAt):sameGame?'La publicación venció a las 24 horas. Las notas se conservan; puedes volver a publicar.':'El podio será visible durante 24 horas desde su publicación.');
  const previewHtml=list.map((r,i)=>`<div class="podium-place ${classes[i]}"><span>${names[i]}</span><strong>${escapeHtml(r.empresa)}</strong><small>${Number(r.grade).toLocaleString('es-PE')} / 20</small></div>`).join('')||`<p>${gradingReports().length?'Aún no hay notas. Guarda las calificaciones en Empresas para ver el podio.':'Aún no hay empresas participantes.'}</p>`;
  const sideHtml=window.SIDE_TEACHER_PODIUM.suggestedPodium(state.reports,podiumOptions()).map((r,i)=>`<div class="suggestion-row"><span>${names[i]}</span><strong>${escapeHtml(r.empresa)}</strong><b>${r.sideScore.toLocaleString('es-PE')} / 100</b></div>`).join('')||'<p class="hint">Aún no hay empresas participantes.</p>';
  if($('podiumPreview').innerHTML!==previewHtml)$('podiumPreview').innerHTML=previewHtml;
  if($('sidePodium').innerHTML!==sideHtml)$('sidePodium').innerHTML=sideHtml;
}
function publishPodium(){
  const participants=gradingReports();
  if(!participants.length||participants.some(r=>gradeValue(r)==null)){toast('Califica a todas las empresas participantes antes de publicar.');return;}
  if(participants.some(r=>grades()[gradeKey(r)]?.pending||gradeQueue.has(gradeKey(r)))){toast('Espera a que todas las notas se sincronicen antes de publicar el podio.');return;}
  const podium=podiumCandidates();
  if(!podium.length){toast('No hay calificaciones válidas para publicar.');return;}
  $('podiumPublishError').textContent='';updatePodiumPreview();$('podiumDialog').showModal();
}
async function podiumAction(accion,minutos=0){
  if(podiumBusy)return false;
  const id=state.partidaId;
  if(!id){toast('Selecciona una partida guardada en Supabase.');return false;}
  podiumBusy=true;++podiumRead;
  ['confirmPodiumPublish','podiumPublishNow','podiumCancelSchedule','publishPodium'].forEach(id=>$(id).disabled=true);
  try{
    const result=await window.SIDE.PartidaService.podio(id,accion,minutos,$('winnerReason').value);
    if(id!==state.partidaId)return false;
    if(!result.success){$('podiumPublishError').textContent=result.error;toast(result.error);return false;}
    applyPodiumResponse(id,result.data);$('winnerReason').dataset.dirty='';renderPodium();
    toast(accion==='cancelar'?'Programación cancelada.':minutos?'Publicación programada.':'Podio publicado por 24 horas.');return true;
  }finally{podiumBusy=false;['confirmPodiumPublish','podiumPublishNow','podiumCancelSchedule','publishPodium'].forEach(id=>$(id).disabled=false);}
}
function applyPodiumResponse(id,data){
  podiumLoadError='';podiumGame=id;remotePodium=data.publication;podiumClock={time:Date.parse(data.serverTime),at:performance.now()};
}
async function loadPublished(){
  const id=state.partidaId,read=++podiumRead;
  if(!id){remotePodium=null;podiumLoadError='';renderPodium();return;}
  const result=await window.SIDE.PartidaService.podio(id);
  if(id!==state.partidaId||read!==podiumRead||podiumBusy)return;
  if(!result.success){podiumLoadError=result.error;renderPodium();return;}
  applyPodiumResponse(id,result.data);
  if(remotePodium&&!$('winnerReason').dataset.dirty&&document.activeElement!==$('winnerReason'))$('winnerReason').value=remotePodium.reason||'';
  renderPodium();
}
$('podiumPublishForm').addEventListener('submit',async event=>{event.preventDefault();try{const delay=$('podiumPublishMode').value==='schedule'?podiumDelay():0;if(await podiumAction('publicar',delay))$('podiumDialog').close();}catch(error){$('podiumPublishError').textContent=error.message;}});
$('cancelPodiumPublish').addEventListener('click',()=>$('podiumDialog').close());
$('winnerReason').addEventListener('input',()=>{$('winnerReason').dataset.dirty='true';});
['podiumPublishMode','podiumHours','podiumMinutes'].forEach(id=>$(id).addEventListener('input',updatePodiumPreview));
$('podiumPublishNow').addEventListener('click',()=>podiumAction('publicar'));
$('podiumCancelSchedule').addEventListener('click',()=>podiumAction('cancelar'));
$('podiumReschedule').addEventListener('click',()=>{$('podiumPublishMode').value='schedule';publishPodium();});
setInterval(()=>{if($('tab-podio').classList.contains('active'))renderPodium();},1000);
setInterval(()=>{if($('tab-podio').classList.contains('active')&&!podiumBusy)loadPublished();},5000);
const historyController=window.SIDE_TEACHER_HISTORY?.createController({mount:$('historyContent'),status:$('historyStatus'),refresh:$('refreshHistory'),service:window.SIDE?.TeacherHistoryService,catalog:window.SIDE_DECISION_CATALOG||[]});
function switchTab(tab){if(tab==='rondas'&&!gameStatus()?.active&&!gameStatus()?.finishedAt)return;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));const titles={configuracion:'Configuración de la simulación',rondas:'Ciclos y eventos',empresas:'Empresas participantes',resultados:'Resultados',podio:'Ganador y podio',historial:'Historial · última partida',laboratorio:'Laboratorio Estratégico'};$('pageTitle').textContent=titles[tab];if(['empresas','resultados','podio'].includes(tab))loadReports();if(tab==='podio')loadPublished();if(tab==='historial')historyController?.load();if(tab==='laboratorio')window.SIDE_LAB?.open()}
let pdfPreviewUrl=null,pdfBusy=false,pdfLogoPromise=null;
function pdfLogo(){
  if(!pdfLogoPromise)pdfLogoPromise=new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);resolve(canvas.toDataURL('image/png'));}catch{resolve(null)}};
    image.onerror=()=>resolve(null);image.src='assets/side_logo.png';
  });
  return pdfLogoPromise;
}
async function makePdf(){
  const reports=state.reports.filter(r=>r.estado!=='eliminada').map(r=>({...r,teacherScore:gradeValue(r)}));
  if(!reports.length)throw new Error('No hay empresas activas con resultados para descargar.');
  const config=getConfig(),generatedAt=new Date(),logo=await pdfLogo();
  return window.SIDE_TEACHER_PDF.create({jsPDF:window.jspdf?.jsPDF,reports,config,logo,generatedAt});
}
async function exportPdf(preview){
  if(pdfBusy)return;pdfBusy=true;
  ['viewPdf','downloadPdf'].forEach(id=>$(id).disabled=true);
  try{
    const filename=($('gameCode').value||'SIDE')+'-resultados.pdf';
    const doc=await makePdf();
    if(preview){
      const url=URL.createObjectURL(doc.output('blob'));
      if(pdfPreviewUrl)URL.revokeObjectURL(pdfPreviewUrl);
      pdfPreviewUrl=url;$('pdfFrame').src=url;$('pdfModal').classList.remove('hidden');
    }else doc.save(filename);
  }catch(error){console.error('SIDE: PDF export failed',error);toast(error.message||'No se pudo generar el PDF. Inténtalo de nuevo.');}
  finally{pdfBusy=false;['viewPdf','downloadPdf'].forEach(id=>$(id).disabled=false);}
}
function showPdf(){return exportPdf(true)}
function downloadPdf(){return exportPdf(false)}
function closePdfPreview(){
  $('pdfModal').classList.add('hidden');$('pdfFrame').removeAttribute('src');
  if(pdfPreviewUrl){URL.revokeObjectURL(pdfPreviewUrl);pdfPreviewUrl=null;}
}
window.addEventListener('pagehide',()=>{if(pdfPreviewUrl)URL.revokeObjectURL(pdfPreviewUrl);pdfPreviewUrl=null;});

window.addEventListener('storage',e=>{if(e.key==='SIDE_STUDENT_REPORTS'){loadReports()}if(e.key==='SIDE_ROUND_RUNTIME'){const r=runtime();if(r&&gameStatus()?.active){state.round=Number(r.round||state.round);state.seconds=Number(r.remaining??state.seconds);updateTimer();updateRoundDisplay()}}});

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
document.querySelectorAll('#tab-configuracion input').forEach(input=>{
  input.addEventListener(input.type==='radio'?'change':'input',()=>{
    if(gameStatus()?.active){
      if(editableFinancialInput(input)){if(input.name==='capitalMode')syncModeUI();}
      return;
    }
    if(['capitalMode','cycleMode'].includes(input.name))syncModeUI();
    if(['startDate','endDate'].includes(input.id)&&cycleMode()==='manual')state.manualDates={start:$('startDate').value,end:$('endDate').value};
    state.round=1;state.seconds=roundSeconds();updateTimer();updateRoundDisplay();refreshSetupSummary();saveConfig(true);
  });
});
$('openEventPicker')?.addEventListener('click',()=>{$('eventPicker').showModal();renderEventBank()});
$('closeEventPicker')?.addEventListener('click',()=>$('eventPicker').close());
// Visibility refresh is handled by the SIDE Lite controller.
window.addEventListener('online',()=>{
  gradeQueue?.flush();
  loadReports();
  refreshTeacherGame();
});
document.querySelectorAll('input[name="eventSelectionMode"]').forEach(i=>i.addEventListener('change',()=>{state.eventSelectionMode=i.value;saveConfig(true);updateEventModeUI()}));
$('eventRandomize')?.addEventListener('click',randomizeEventSelection);
$('eventClearSelection')?.addEventListener('click',()=>{state.enabledEvents.clear();renderEventBank();saveConfig(true);toast('Selección de eventos limpiada.');});
$('eventSelectAll')?.addEventListener('click',toggleSelectAllEvents);
['eventSearch','eventCategoryFilter','eventScopeFilter'].forEach(id=>$(id)?.addEventListener(id==='eventSearch'?'input':'change',()=>{renderEventBank();updateSelectAllBtn();}));
$('eventRandomCount')?.addEventListener('change',()=>saveConfig(true));
$('saveAll')?.addEventListener('click',async()=>{if(state.starting||state.cancelling||$('saveAll').disabled)return;$('saveAll').disabled=true;try{await saveConfig(false);}catch(error){toast('No se pudo guardar la configuración: '+error.message,'error');}finally{$('saveAll').disabled=false;refreshStartButton();}});
$('startGame')?.addEventListener('click',startGame);
$('retryCreate')?.addEventListener('click',startGame);
$('copyLobbyCode')?.addEventListener('click',event=>copyInvitation(false,event.currentTarget));
$('startCycle1Btn')?.addEventListener('click',startCycle1);
$('refreshReports')?.addEventListener('click',()=>{loadReports();toast('Información actualizada.');});
$('advanceRound')?.addEventListener('click',()=>advanceRound(false));
$('startTimer')?.addEventListener('click',startTimer);
$('cutRound')?.addEventListener('click',cutRound);
$('clearEvents')?.addEventListener('click',()=>{state.events=[];localStorage.removeItem('SIDE_EVENT_LOG');renderEvents();});
$('publishPodium')?.addEventListener('click',publishPodium);
$('resultCompanySelect')?.addEventListener('change',event=>{state.resultCompanyId=event.target.value;renderResults();});
$('viewPdf')?.addEventListener('click',showPdf);
$('downloadPdf')?.addEventListener('click',downloadPdf);
$('closePdf')?.addEventListener('click',closePdfPreview);
async function copyInvitation(link=false,button=null){
  if(!sharedRoom){toast('Inicia una partida para compartir el código.');return;}
  const code=sharedRoom.codigo;
  const url=new URL('index.html',window.location.href);url.searchParams.set('partida',code);
  const value=link?url.href:code;
  try{
    let copied=false;
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);copied=true;}catch(error){console.warn('SIDE: portapapeles, probando copia compatible',error);}}
    if(!copied){const focused=document.activeElement,field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';field.style.fontSize='16px';document.body.appendChild(field);try{field.focus?.();field.select();field.setSelectionRange?.(0,field.value.length);if(!document.execCommand('copy'))throw new Error('Clipboard unavailable');}finally{field.remove();focused?.focus?.();}}
    if(button){const label=button.dataset.copyLabel||button.textContent;button.dataset.copyLabel=label;button.textContent='Copiado';clearTimeout(button.copyTimer);button.copyTimer=setTimeout(()=>{button.textContent=label;},2500);}
    toast(link?'Enlace de partida copiado.':'Código de partida copiado.');
  }catch(error){console.error('SIDE: no se pudo copiar la invitación',error);toast('No se pudo copiar automáticamente. Copia el código desde Identificación.');$('gameCode').value=code;$('gameCode').focus();$('gameCode').select();}
}
$('copyGameCode')?.addEventListener('click',event=>copyInvitation(false,event.currentTarget));
$('copyGameLink')?.addEventListener('click',event=>copyInvitation(true,event.currentTarget));
$('cancelGame')?.addEventListener('click',()=>$('cancelGameDialog').showModal());
$('keepGame')?.addEventListener('click',()=>$('cancelGameDialog').close());
$('confirmCancelGame')?.addEventListener('click',async()=>{
  if(state.cancelling)return;
  state.cancelling=true;refreshStartButton();
  const btn=$('confirmCancelGame');btn.disabled=true;
  const targetRoom=previousRoom||(state.partidaId?{id:state.partidaId,codigo:$('gameCode').value}:null);
  const reportFailure=result=>{console.error('SIDE: cancelar partida',result);creationFeedback('No se pudo cancelar la partida: '+(result.error||'comprueba la conexión y reintenta.'),'error',targetRoom);};
  try{
    await publishChain;await teacherRead;
    teacherBusy=true;
    const target=targetRoom?.id;
    if(!target){creationFeedback('La partida ya terminó. Puedes iniciar una nueva.','notice');$('cancelGameDialog').close();return;}
    const result=await window.SIDE.PartidaService.cancelar(target);
    if(!result.success){reportFailure(result);return;}
    if(result.data?.id!==target||result.data?.estado!=='cancelada'){reportFailure({error:'Supabase no confirmó la cancelación. Ejecuta 2026-10-12_salas_codigo.sql y reintenta.'});return;}
    previousRoom=null;creationRequest=null;localStorage.removeItem('SIDE_CREATION_REQUEST');clearRoomLink();
    const terminalTime=result.data.serverTime||new Date().toISOString();
    localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({active:false,cancelledAt:result.data.cancelled_at||result.data.configuracion?.cancelledAt||terminalTime,finishedAt:terminalTime,code:targetRoom.codigo}));
    [teacherPoll,teacherTick].forEach(clearInterval);teacherPoll=null;teacherTick=null;
    $('cancelGameDialog').close();refreshSetupSummary();
    creationFeedback('Partida cancelada. Puedes configurar e iniciar una nueva.','success');
  }catch(error){reportFailure({error:error.message});}
  finally{teacherBusy=false;state.cancelling=false;btn.disabled=false;refreshSetupSummary();}
});
$('backHome')?.addEventListener('click',()=>window.location.href='index.html');
$('teacherLogout')?.addEventListener('click',async()=>{
  const button=$('teacherLogout');button.disabled=true;
  try{const result=await supabaseClient.auth.signOut({scope:'local'});if(result.error)throw result.error;window.location.href='index.html?acceso=docente';}
  catch(error){button.disabled=false;toast(error.message||'No se pudo cerrar sesión.');}
});

(async function init(){
  // Every entry to the teacher page must resolve the authoritative server role.
  try {
    if(!supabaseClient)throw new Error('No hay sesión docente.');
    const {createSupabaseSession}=await import('../supabase-session.js?v=20261110-login-fast3');
    const session=createSupabaseSession(supabaseClient);
    const identity=await Promise.race([session.identity(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('No se pudo comprobar la sesión docente. Revisa tu conexión.')),8000))]);
    if(identity.role!=='teacher')throw new Error('La cuenta no tiene autorización docente.');
    window.SIDLiteGame?.useRole('teacher');
    document.body.classList.remove('teacher-auth-pending');
    supabaseClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')setTimeout(()=>window.location.replace('index.html?acceso=docente'),0);});
  } catch(error) {
    console.error('SIDE: acceso docente no autorizado',error);
    window.location.replace('index.html?acceso=docente');
    return;
  }
  // SIDE Lite owns room state and polling through its API controller.
  // Do not start the original SIDE RPCs or local game clock here.
  return;
  await purgeForeignProfessorState();
  loadConfig();updateEventModeUI();
  try{state.events=JSON.parse(localStorage.getItem('SIDE_EVENT_LOG')||'[]')||[]}catch{}
  const r=runtime();
  if(r){state.round=Number(r.round||state.round);state.seconds=Number(r.remaining??roundSeconds());state.roundClosed=['finished','simulation-finished'].includes(r.status);}
  let game;try{game=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'null')}catch{}
  if(window.SIDE?.SupabaseClient?.isReady()&&window.SIDE?.PartidaService?.obtenerActiva){
    try{await recoverServerRoom();}catch(error){console.error('SIDE: recuperación de sala',error);creationFeedback('No se pudo recuperar la sala. Comprueba la conexión e inténtalo de nuevo.','error',null,false);}
  }
  else if(state.lifecycleVersion===2&&(game?.active||state.partidaId)){watchTeacherGame();await refreshTeacherGame();}
  else if(cycleMode()==='automatic'&&game?.active){scheduleAutomaticStart();}
  else if(game?.active&&r?.running&&r.startedAt){
    state.seconds=Math.max(0,Number(r.duration||roundSeconds())-Math.floor((Date.now()-new Date(r.startedAt).getTime())/1000));
    if(state.seconds>0){state.seconds=Number(r.duration||roundSeconds());beginTimer(false,Date.parse(r.startedAt));}
    else finishTime();
  }
  if(r?.status==='simulation-finished')$('roundState').textContent='Simulación finalizada';
  updateTimer();updateRoundDisplay();loadReports();renderEvents();renderCycleNews();loadPublished();renderAcademicCalendar();
  refreshSetupSummary();startLiveCompanies();
  updateSelectAllBtn();
  // La recuperación aguardada arriba resuelve también IDs ausentes o finalizados.
  // No lanzar otra lectura tardía que pueda borrar una sala recién creada.
})();

window.addEventListener('pagehide',()=>{[teacherPoll,teacherTick].forEach(clearInterval);teacherPoll=null;teacherTick=null;stopLiveCompanies();});
// SIDE Lite restores its own room via the authenticated API controller.
