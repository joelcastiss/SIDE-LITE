const cfg = window.SIDE_CONFIG || {};
const hasConfig = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('TU-PROYECTO') && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes('TU-PUBLISHABLE');
const supabaseClient = window.SIDE?.SupabaseClient?.get() || null;
const $ = id => document.getElementById(id);
const screens = ['landing','profiles','studentLoading','tutorial','studentLobby','characterSelection','simulationLoading','simulator3d','decisionMenu'];
const modals = ['teacherLoginModal','teacherRegisterModal','studentModal','creditsModal','studentExpelledModal','cycleCostsModal'];
const DEMO_GAME = {id:'demo-side-000',codigo:'SIDE-000',nombre:'SIDE — Simulación Principal',curso:'Finanzas Corporativas',estado:'esperando'};
const COMPANY_NAME = 'MI EMPRESA'; // respaldo visual; el estudiante define el nombre comercial al ingresar
const JOIN_STARTED_MESSAGE = 'La partida ya inició. Solo pueden reingresar quienes ya estaban registrados; verifica que el código, el nombre de empresa y el nombre comercial sean exactamente los registrados.';
const JOIN_INVALID_MESSAGE = 'No se pudo validar el ingreso. Comprueba el código de la sala con tu docente. Si ya participaste, usa los nombres registrados, respetando mayúsculas y tildes.';
const JOIN_CODE_MESSAGE = 'Usa un código como SIDE-PTV6 o PTV6. También se aceptan los códigos anteriores de 6 caracteres y SIDE-000. Copia solo el código de la sala del docente.';
function admissionCode(value){
  const code=String(value||'').replace(/\s+/g,'').toUpperCase();
  if(/^SIDE[A-Z0-9]+$/.test(code))return code.replace(/^SIDE/,'SIDE-');
  if(code!=='SIDE'&&/^(?:[A-Z0-9]{3,4}|[A-Z0-9]{6})$/.test(code))return 'SIDE-'+code;
  return code;
}
function validAdmissionCode(value){return /^[0-9A-F]{8}$/.test(String(value||'').trim().toUpperCase());}
function showAdmissionCodeError(text=''){
  const field=$('gameCode'),detail=$('gameCodeError');
  if(field)field.setAttribute('aria-invalid',text?'true':'false');
  if(detail){detail.textContent=text;message('gameCodeError',text,true);detail.classList.toggle('hidden',!text);}
}
const JOIN_SERVER_MESSAGE = 'No se pudo conectar con el servidor. Intenta nuevamente en unos minutos.';
const DECISION_CATALOG = Array.isArray(window.SIDE_DECISION_CATALOG) ? window.SIDE_DECISION_CATALOG : [];
const EVENT_CATALOG = Array.isArray(window.SIDE_EVENT_CATALOG) ? window.SIDE_EVENT_CATALOG : [];
const CREDIT_INITIAL_PERCENT = 70;
const CREDIT_ASSET_PERCENT = 20;
// Supuestos del modelo de producción: un ciclo representa 30 días de operación.
const WORKING_DAYS_PER_MONTH = 30;
// Indemnización por reducir personal de un ciclo a otro: medio "sueldo" (costo de la
// opción) por persona que se retira, como aproximación simple de liquidación laboral.
const SEVERANCE_RATE = 0.5;
// % de recuperación al vender/liquidar una máquina ya adquirida cuando la opción no
// define su propio liquidationRate.
const LIQUIDATION_RATE_DEFAULT = 0.4;
const RULES = window.SIDE_RULES;
const UI_ICONS = {check:'assets/icons/ui/check.svg',play:'assets/icons/ui/play.svg',lock:'assets/icons/ui/lock.svg'};
let currentStudent = {name:'Jugador',company:COMPANY_NAME,participantId:null,empresaId:null,game:DEMO_GAME};
let authoritativeStudentState=null,studentConnected=false;
let decisionState = {};
let decisionDrafts = {};
let cashLedger = {};
let currentCategory = null;
let playerIsDeciding = false;
let tutorialMarkupPromise=null,waitingTutorialCleanup=null,waitingTutorialRequest=0,waitingTutorialPending=false;

let admittedFunContext='';
function funAdmissionContext(){return `${currentStudent.game?.codigo||''}|${currentStudent.company||''}`;}
function canVisitFunWorld(){
  if(currentStudent.expulsada)return false;
  const admitted=Boolean(admittedFunContext&&admittedFunContext===funAdmissionContext());
  try {const access=studentAccess();if(access.expelled||access.cancelled)return false;return admitted||canExploreWorld();}
  catch {return admitted;}
}
function showScreen(id){
  if(['simulator3d','simulationLoading'].includes(id)&&!canVisitFunWorld())id='studentLobby';
  if(['decisionMenu','characterSelection'].includes(id)&&!canExploreWorld()&&!(id==='decisionMenu'&&studentAccess().canReview))id='studentLobby';
  screens.forEach(s=>$(s)?.classList.toggle('hidden',s!==id));window.scrollTo(0,0);
  if(['simulator3d','simulationLoading'].includes(id)&&$('studentCyclePause'))$('studentCyclePause').hidden=true;
  if(id!=='tutorial')window.stopSIDETutorial?.($('tutorialMount')?.querySelector('.tutorial-shell'));
  syncWaitingTutorial();
  return id;
}
let modalTrigger = null;
function showModal(id){
  if($('modalRoot')?.classList.contains('hidden'))modalTrigger=document.activeElement;
  $('modalRoot')?.classList.remove('hidden');
  modals.forEach(m=>$(m)?.classList.toggle('hidden',m!==id));
  setTimeout(()=>$(id)?.querySelector('input,button,a[href]')?.focus(),80);
}
function closeModal(){
  if(typeof acknowledgeCycleCostNotice==='function')acknowledgeCycleCostNotice();
  $('modalRoot')?.classList.add('hidden');
  modals.forEach(m=>$(m)?.classList.add('hidden'));
  const trigger=modalTrigger;modalTrigger=null;
  if(trigger?.isConnected)trigger.focus();
}
function renderCredits(){
  const list=$('creditsList'),credits=Array.isArray(window.SIDE_CREDITS)?window.SIDE_CREDITS:[];
  if(!list||list.dataset.rendered==='true')return;
  list.replaceChildren();
  for(const credit of credits){
    const item=document.createElement('article');item.className='credit-item';
    const heading=document.createElement('h3');heading.textContent=credit.title;
    const author=document.createElement('p');author.textContent=`Por ${credit.author}`;
    const links=document.createElement('p');links.className='credit-links';
    const source=document.createElement('a');source.href=credit.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent=credit.source;
    const separator=document.createTextNode(' · ');
    const license=document.createElement('a');license.href=credit.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';license.textContent=credit.license;
    const assets=document.createElement('small');assets.textContent=credit.assets.join(' · ');
    links.append(source,separator,license);item.append(heading,author,links,assets);list.append(item);
  }
  list.dataset.rendered='true';
}
function toast(msg,duration=2600,variant=''){const t=$('toast');if(!t)return;t.textContent=msg;t.classList.toggle('toast-cancellation',variant==='cancellation');t.classList.add('show');clearTimeout(window.__sideToast);window.__sideToast=setTimeout(()=>t.classList.remove('show'),Math.max(2600,Number(duration)||2600))}
function message(id,msg,error=false){const el=$(id);if(!el)return;el.textContent=msg;el.style.color=error?'#ff9d9d':'#ffe06a'}
function requireSupabase(){if(!supabaseClient){toast('Modo local activo: configura Supabase para sincronización.');return false}return true}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function money(n){return 'S/ '+(Number(n)||0).toLocaleString('es-PE',{maximumFractionDigits:2})}
function deepClone(v){return JSON.parse(JSON.stringify(v??{}))}

function scopedStudentState(){
  const s=typeof authoritativeStudentState==='undefined'?null:authoritativeStudentState;
  return s&&typeof studentConnected!=='undefined'&&studentConnected&&s.empresaId===currentStudent.empresaId&&s.gameId===currentStudent.game?.id&&s.code===admissionCode(currentStudent.game?.codigo)?s:null;
}
function teacherConfig(){
  const defaults={capitalMode:'fixed',capital:100000,capitalMin:80000,capitalMax:120000,interest:20,creditPercentStart:20,round:1,cycles:6,demandLosOlivos:1000,demandMiraflores:1250,demandSJL:1100,cycleCloseMode:'manual',roundHours:0,roundMinutes:10,roundSecs:0,scheduledStart:'',enabledEvents:[]};
  const own=scopedStudentState();let config={...defaults};
  try{config={...defaults,...(own?own.config:JSON.parse(localStorage.getItem('SIDE_TEACHER_CONFIG')||'{}'))}}catch{}
  const round=own?.runtime?.round||config.runtime?.round||localStorage.getItem('SIDE_ACTIVE_ROUND')||config.round||1;
  return {...config,...(window.SIDE_FINANCE_CONFIG?.resolve(config,round)||{})};
}
function stableHash(text){let h=2166136261;for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function initialCapital(){const source=currentStudent?.initialCapital,remote=Number(source);if(source!==null&&source!==undefined&&source!==''&&Number.isFinite(remote)&&remote>=0)return remote;const config=teacherConfig(),c=window.SIDE_FINANCE_CONFIG?.resolve(config,1)||config;if(c.capitalMode!=='random')return Math.max(0,Number(c.capital??100000));let min=Math.max(0,Number(c.capitalMin??80000)),max=Math.max(min,Number(c.capitalMax??120000));const ratio=(stableHash(storageKey())%10001)/10000;return Math.round((min+(max-min)*ratio)/500)*500}
function financialAdjustment(round=currentRound()){return window.SIDE_FINANCE_CONFIG?.adjustment(teacherConfig(),round,currentStudent.empresaId||currentStudent.participantId||storageKey(),initialCapital())||0;}
function financialLedger(){
  const ledger={...cashLedger};let previous=0;
  for(let round=1;round<=currentRound();round++){const adjustment=financialAdjustment(round);if(adjustment!==previous)ledger[`${round}:CAPITAL_ADJUSTMENT`]=adjustment-previous;previous=adjustment;}
  return ledger;
}
function creditOutstanding(){
  const prefix=`SIDE_DECISION_RECEIPTS_${storageKey()}_`;
  let total=Number(decisionState.__openingBalance?.balanceGeneral?.deuda||0);
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith(prefix)||Number(key.slice(prefix.length))<=Number(decisionState.__openingBalance?.round||0))continue;
    try{
      const receipt=JSON.parse(localStorage.getItem(key)||'{}')||{};
      const item=receipt.E?.items?.find(x=>x.id==='PRESTAMO');
      total+=Number(item?.financing||0);
    }catch{}
  }
  return Math.max(0,total);
}
function creditAssetValue(){
  let total=0;
  const assetIds=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'];
  for(const id of assetIds){
    const item=findDecisionItem(id); if(!item)continue;
    const e=savedEntry(item); if(!e?.purchases)continue;
    for(const opt of item.options||[]){
      const netQty=Object.values(e.purchases).reduce((sum,row)=>sum+(Number(row?.[opt.id])||0),0);
      total+=Math.max(0,netQty)*Number(opt.cost||0);
    }
  }
  return Math.max(0,total);
}
function creditApprovedLine(){
  const round=currentRound();
  if(round<=1)return Math.floor(initialCapital()*CREDIT_INITIAL_PERCENT/100/500)*500;
  const cash=Math.max(0,cashBalance()-creditOutstanding());
  const assets=creditAssetValue();
  return Math.floor((cash*CREDIT_INITIAL_PERCENT/100+assets*CREDIT_ASSET_PERCENT/100)/500)*500;
}
function currentCycleLoanReceipt(){
  try{
    const receipts=JSON.parse(localStorage.getItem(`SIDE_DECISION_RECEIPTS_${storageKey()}_${currentRound()}`)||'{}');
    return Math.max(0,Number(receipts?.E?.items?.find(item=>item.id==='PRESTAMO')?.financing||0));
  }catch{return 0;}
}
function creditAvailable(){
  // When revising Finance, the loan already in its receipt can be replaced.
  const replaceable=!sectionSubmitted('E')&&!decisionsSubmitted()?currentCycleLoanReceipt():0;
  return Math.max(0,creditApprovedLine()-creditOutstanding()+replaceable);
}
function loanMaximum(){return creditAvailable()}
function loanInitialReference(){return creditApprovedLine()}
function currentRound(){const own=scopedStudentState();if(own)return Math.max(1,Number(own.runtime?.round||own.config?.round||1));const config=teacherConfig();const scheduled=config.cycleCloseMode==='automatic'?readRoundRuntime()?.round:null;return Math.max(1,Number(scheduled||localStorage.getItem('SIDE_ACTIVE_ROUND')||config.round||1))}
function studentAccess(existing=true){
  if(currentStudent.expulsada||(!currentStudent.empresaId&&localStudentExpelled()))return {canOperate:false,canJoin:false,expelled:true,reason:STUDENT_EXPULSION_MESSAGE};
  let status={},r={};try{status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'{}')||{};r=JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'{}')||{}}catch{}
  if(currentStudent.empresaId&&studentConnected){
    if(studentSessionRecovering||!studentProgressHydrated||!authoritativeStudentState||authoritativeStudentState.empresaId!==currentStudent.empresaId||authoritativeStudentState.gameId!==currentStudent.game?.id||authoritativeStudentState.code!==admissionCode(currentStudent.game?.codigo))return {canOperate:false,canJoin:false,integration:true,reason:'Verificando el estado de la partida…'};
    const s=authoritativeStudentState;
    return RULES.gameAccess(s.config,s.status,s.runtime,existing,studentNow());
  }
  return RULES.gameAccess(teacherConfig(),status,{...r,round:currentRound()},existing,studentNow());
}
function updateIntegrationUI(){
  renderStudentConnection();
  const access=studentAccess(),button=$('enterDecisionsBtn'),notice=$('studentIntegrationNotice');
  if(access.expelled){if(studentConnected)showStudentExpulsion();return;}
  const decisionsComplete=simulationSubmissionComplete();
  const waiting=Boolean(access.integration&&!access.cancelled),waitingScreen=$('studentWaiting');
  waitingScreen?.classList.toggle('hidden',!waiting);
  $('studentLobby')?.classList.toggle('is-waiting',waiting);
  syncWaitingTutorial();
  const waitClock=$('waitingCountdown'),waitClockNote=$('waitingCountdownNote');
  if(waitClock){
    const seconds=Number.isFinite(access.remaining)?Math.max(0,Math.ceil(access.remaining)):null;
    const label=seconds===null?'--:--':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    if(waitClock.textContent!==label)waitClock.textContent=label;
    const note=seconds===null?'Esperando inicio del docente':seconds===0?'Sincronizando el inicio…':'La partida comenzará al terminar este tiempo';
    if(waitClockNote&&waitClockNote.textContent!==note)waitClockNote.textContent=note;
  }
  const waitingTitle=`${currentStudent.game?.nombre||'Partida SIDE'} · ${currentStudent.game?.codigo||''}`;
  if($('waitingGameName')&&$('waitingGameName').textContent!==waitingTitle)$('waitingGameName').textContent=waitingTitle;
  if(waiting&&$('waitingCompanies')&&Number.isFinite(studentJoinedCompanies)){
    const count=Math.max(1,studentJoinedCompanies);
    const label=`${count} ${count===1?'empresa unida':'empresas unidas'}`;
    if($('waitingCompanies').textContent!==label)$('waitingCompanies').textContent=label;
  }
  if(notice){
    if(waiting){const footer=waitingScreen?.querySelector('.waiting-footer');if(footer&&notice.parentElement!==footer)footer.prepend(notice);}
    else{const destination=$('lobbySegment');if(destination&&notice.previousElementSibling!==destination)destination.after(notice);}
  }
  $('studentLobby')?.classList.toggle('game-cancelled',Boolean(access.cancelled));
  $('cancelledBackToProfiles')?.classList.toggle('hidden',!access.cancelled);
  const cycleRuntime=readRoundRuntime();
  const paused=cycleRuntime?.status==='paused';
  for(const id of ['studentLobby','decisionMenu']){
    const host=$(id);if(!host)continue;
    let banner=host.querySelector('[data-cycle-paused]');
    if(!banner){banner=document.createElement('p');banner.dataset.cyclePaused='';banner.className='student-sync-status';banner.setAttribute('role','status');host.prepend(banner);}
    banner.hidden=!paused;banner.textContent=paused?'Ciclo pausado por el docente. El reloj económico está detenido; el modo diversión sigue disponible. Puedes revisar y preparar tus decisiones.':'';
  }
  renderCyclePause(paused);
  if($('lobbySegment'))$('lobbySegment').textContent=access.cancelled?'PARTIDA CANCELADA':access.integration?'SALA DE ESPERA':('EMPRESA: '+currentStudent.company+' · REVISA Y REGISTRA TUS DECISIONES');
  if($('resumeWorldBtn'))$('resumeWorldBtn').classList.toggle('hidden',!canStartSimulation()||!decisionsComplete);
  if(button){button.disabled=!access.canOperate&&!access.canReview;button.classList.toggle('hidden',(!access.canOperate&&!access.canReview)||decisionsComplete);button.textContent=paused?'Revisar decisiones':'Entrar a decisiones';}
  if(notice){
    notice.classList.toggle('hidden',access.canOperate||(waiting&&Number.isFinite(access.remaining)));
    const reason=access.reason||'';
    if(notice.dataset.reason!==reason){notice.dataset.reason=reason;notice.textContent=reason;}
    if(access.integration&&Number.isFinite(access.remaining)){
      let timer=$('integrationCountdown');
      if(!timer){timer=document.createElement('strong');timer.id='integrationCountdown';notice.appendChild(timer);}
      const seconds=Math.max(0,access.remaining),label=` ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
      if(timer.textContent!==label)timer.textContent=label;
      let suffix=$('integrationWaitSuffix');
      if(!suffix){suffix=document.createElement('span');suffix.id='integrationWaitSuffix';notice.appendChild(suffix);}
      const suffixText=seconds===0?' · Sincronizando el inicio…':' Puedes permanecer en esta pantalla.';
      if(suffix.textContent!==suffixText)suffix.textContent=suffixText;
    }
  }
  if(access.cancelled){
    autoEnterDecisions=false;
    if(!cancellationShown){cancellationShown=true;toast('La partida ha sido cancelada por el profesor. Solicita el código de una nueva sala.',9000,'cancellation');}
    if(typeof closeCompanyReview==='function')closeCompanyReview();
    if($('studentLobby')?.classList.contains('hidden'))showScreen('studentLobby');
    playerIsDeciding=false;window.__SIDE_RETURN_TO_3D=false;
    window.SIDE3D?.suspend?.();syncStudentTimer();stopStudentSync();
    studentConnected=false;renderStudentPodium(null);studentSessionRecovering=false;studentSnapshotEpoch++;
    try{sessionStorage.removeItem('SIDE_STUDENT_SESSION');}catch{}
    closeModal();showScreen('profiles');
    $('roomCancellationNotice')?.classList.add('hidden');
    return;
  }
  if(access.integration){autoEnterDecisions=true;preloadStudentWorld();}
  if(studentConnected&&autoEnterDecisions&&access.canOperate&&!$('studentLobby')?.classList.contains('hidden')){autoEnterDecisions=false;openDecisionMenu();}

  if(!access.canOperate&&!access.canReview&&['decisionMenu'].some(id=>!$(id)?.classList.contains('hidden'))){playerIsDeciding=false;window.SIDE3D?.suspend?.();showScreen('studentLobby');}
}
let lastPauseState=null,pauseDismissed=false;
function renderCyclePause(paused){
  let overlay=$('studentCyclePause');
  if(!overlay){
    overlay=document.createElement('section');overlay.id='studentCyclePause';overlay.className='cycle-pause-overlay';overlay.hidden=true;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','cyclePauseTitle');
    overlay.innerHTML='<div class="side-panel"><h2 id="cyclePauseTitle">Ciclo en pausa</h2><p>El docente detuvo el ciclo. El temporizador está congelado y no puedes guardar ni enviar decisiones.</p><p>Puedes revisar y preparar tu plan mientras esperas.</p><button type="button" class="primary-gold">Revisar mis decisiones</button></div>';
    overlay.querySelector('button').addEventListener('click',()=>{pauseDismissed=true;overlay.hidden=true;openDecisionMenu();});document.body.appendChild(overlay);
  }
  if(paused!==lastPauseState){
    if(!paused&&lastPauseState===true&&studentAccess().canOperate)toast('Ciclo reanudado. El reloj continúa; ya puedes guardar y enviar decisiones.');
    pauseDismissed=false;lastPauseState=paused;
    if(paused)setTimeout(()=>overlay.querySelector('button')?.focus(),0);
  }
  overlay.hidden=!paused||pauseDismissed||['simulator3d','simulationLoading'].some(id=>!$(id)?.classList.contains('hidden'));
}
let cancellationShown=false;
const STUDENT_EXPULSION_MESSAGE='Tu empresa fue eliminada de la partida por inactividad. Contacta a tu profesor si necesitas volver a participar.';
function localStudentExpelled(){
  if(currentStudent.empresaId||!currentStudent.game?.codigo||!currentStudent.company)return false;
  try{
    if(JSON.parse(localStorage.getItem('SIDE_COMPANY_EXCLUSIONS')||'{}')[storageKey()]===true)return true;
    return (JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')).some(r=>r.partida===currentStudent.game.codigo&&r.empresa===currentStudent.company&&r.estado==='eliminada');
  }catch{return false;}
}
function showStudentExpulsion(options={}){
  clearTimeout(window.__sideToast);$('toast')?.classList.remove('show');
  const explanation='El profesor eliminó tu empresa por inactividad. Ya no puedes participar ni enviar decisiones en esta partida. Contacta a tu profesor si necesitas volver a participar.';
  let summary;try{summary=financialReport();}catch{}
  $('studentCyclePause')?.setAttribute('hidden','');
  const identityKey=studentIdentityKey();
  studentOutbox?.discard(identityKey,true);
  currentStudent.expulsada=true;studentConnected=false;studentProgressHydrated=false;studentSessionRecovering=false;
  studentSnapshotEpoch++;stopStudentSync();autoEnterDecisions=false;playerIsDeciding=false;window.__SIDE_RETURN_TO_3D=false;
  clearTimeout(financialSyncTimer);financialSyncTimer=null;
  window.SIDE3D?.suspend?.();if(typeof closeCompanyReview==='function')closeCompanyReview();renderStudentPodium(null);
  try{sessionStorage.removeItem('SIDE_STUDENT_SESSION');}catch{}
  closeModal();showScreen('profiles');
  const notice=$('roomCancellationNotice');if(notice){notice.textContent=STUDENT_EXPULSION_MESSAGE;notice.classList.remove('hidden');}
  const modal=$('studentExpelledModal'),detail=$('studentExpelledMessage');if(detail)detail.textContent=explanation;
  let result=modal?.querySelector('[data-expelled-summary]');
  if(modal&&!result){result=document.createElement('div');result.dataset.expelledSummary='';result.className='financial-details';modal.querySelector('button')?.before(result);}
  if(result){const er=summary?.estadoResultados||{},cash=summary?.balanceCaja?.cajaFinal??cashBalance();result.innerHTML=`<strong>Resumen de ${escapeHtml(currentStudent.company)}</strong><p>Último estado disponible · ciclo ${summary?.round||currentRound()}</p><p>Caja: ${money(cash)} · Ingresos: ${money(er.ingresos)} · Utilidad: ${money(er.utilidad)}</p>${summary?.pendiente?'<p>El ciclo actual no tiene cierre. Estas cifras no constituyen un resultado definitivo.</p>':''}`;}
  showModal('studentExpelledModal');
}
let remoteStateBusy=false,remoteStateTask=null,studentProgressHydrated=false,studentSnapshotQueue=Promise.resolve(),studentSnapshotEpoch=0,autoEnterDecisions=false,studentClock=null,studentPoll=null,studentTick=null,zeroSyncDeadline=null,studentJoinedCompanies=null;
let studentMaterialBook=null,studentMaterialSequence=0,studentMaterialStatus='Datos de recepción no verificados / proyección no disponible.';
function temporalStudentRoom(){return teacherConfig().materialRulesVersion==='receipts-v1';}
function studentMaterialPhase(){return String(scopedStudentState()?.runtime?.phase||teacherConfig().runtime?.phase||'');}
function validStudentMaterialBook(){return studentMaterialBook&&studentMaterialBook.gameId===currentStudent.game?.id&&String(studentMaterialBook.companyId)===String(currentStudent.empresaId)&&studentMaterialBook.cycle===currentRound()&&studentMaterialBook.phase===studentMaterialPhase()?studentMaterialBook.book:null;}
async function refreshStudentMaterialBook(){
  const sequence=++studentMaterialSequence,gameId=currentStudent.game?.id,companyId=currentStudent.empresaId,cycle=currentRound(),phase=studentMaterialPhase();
  const previous=validStudentMaterialBook();
  if(!previous){studentMaterialBook=null;studentMaterialStatus='Verificando datos de recepción…';}
  if(!temporalStudentRoom())return true;
  if(!previous)requestMaterialViewRefresh();
  const result=await window.SIDE?.DecisionesService?.obtenerContextoMaterial(gameId,companyId,cycle,true);
  if(sequence!==studentMaterialSequence||gameId!==currentStudent.game?.id||String(companyId)!==String(currentStudent.empresaId)||cycle!==currentRound()||phase!==studentMaterialPhase()||!studentConnected)return false;
  if(!result?.success){studentMaterialBook=null;studentMaterialStatus='Datos de recepción no verificados / proyección no disponible.';requestMaterialViewRefresh();return false;}
  studentMaterialBook={gameId,companyId,cycle,phase,book:result.data};studentMaterialStatus=`Proyección provisional · revisión ${result.data.revision} · corte día ${result.data.cutoffDay}`;
  if(JSON.stringify(previous)!==JSON.stringify(result.data))requestMaterialViewRefresh();
  return true;
}
let materialViewRefreshPending=false;
function requestMaterialViewRefresh(){
  if($('decisionMenu')?.classList.contains('hidden'))return;
  if($('decisionCards')?.contains(document.activeElement)){materialViewRefreshPending=true;return;}
  materialViewRefreshPending=false;renderDecisionCategory();
}
document.addEventListener('focusout',()=>{if(materialViewRefreshPending)setTimeout(()=>{if(materialViewRefreshPending)requestMaterialViewRefresh();},0);});
function studentNow(){if(currentStudent.empresaId&&!studentClock)return NaN;return studentClock?studentClock.time+performance.now()-studentClock.at:Date.now();}
function studentIdentity(student=currentStudent){return {codigo:student?.game?.codigo||'',nombreLegal:student?.legalName||'',nombreComercial:student?.company||''}}
function studentIdentityKey(student=currentStudent){return JSON.stringify(studentIdentity(student))}
let studentOutbox=null,studentStateFailure=null,studentSessionRecovering=false,studentSessionRecoveryTask=null;
function pollStudentGame(){return studentSessionRecovering?resumeStudentSession():refreshStudentGame()}
function startStudentSync(){
  stopStudentSync();studentPoll=setInterval(pollStudentGame,3000);studentTick=setInterval(tickStudentGame,1000);
}
function stopStudentSync(){clearInterval(studentPoll);clearInterval(studentTick);studentPoll=null;studentTick=null;}

function applyStudentGameState(partida,round=1){
  if(currentStudent.empresaId&&(partida.id!==currentStudent.game?.id||admissionCode(partida.codigo)!==admissionCode(currentStudent.game?.codigo)))throw new Error('La respuesta del servidor corresponde a otra sala. Vuelve a intentar el ingreso con el código del docente.');
  if(!partida.configuracion||typeof partida.configuracion!=='object'||Array.isArray(partida.configuracion))return;
  const config={...partida.configuracion};
  if(partida.estado==='cancelada'){config.cancelledAt=partida.cancelled_at||partida.serverTime;config.phase='cancelled';config.runtime={...config.runtime,phase:'cancelled',running:false};}
  if(config&&'cancelledAt' in config&&!RULES.isCancellationMarker(config.cancelledAt))delete config.cancelledAt;
  if(!config||typeof config!=='object')return;
  if(currentStudent.empresaId&&!Number.isFinite(Date.parse(partida.serverTime||'')))throw new Error('Falta hora del servidor. Aplica la migración 20261009_sala_espera_identidad_exacta.sql en Supabase.');
  if(partida.serverTime)studentClock={time:Date.parse(partida.serverTime),at:performance.now()};
  localStorage.setItem('SIDE_TEACHER_CONFIG',JSON.stringify(config));
  localStorage.setItem('SIDE_EVENT_SCHEDULE',JSON.stringify(config.eventSchedule||{}));
  if(config.runtime)localStorage.setItem('SIDE_ROUND_RUNTIME',JSON.stringify(config.runtime));
  else localStorage.removeItem('SIDE_ROUND_RUNTIME');
  localStorage.setItem('SIDE_ACTIVE_ROUND',String(config.runtime?.round||round));
  localStorage.setItem('SIDE_GAME_STATUS',JSON.stringify({cancelledAt:config.cancelledAt||null,active:partida.estado!=='finalizada'&&!config.cancelledAt&&(config.lifecycleVersion===2||Boolean(config.gameStartedAt)),startedAt:config.gameStartedAt,finishedAt:partida.estado==='finalizada'?'finished':null,code:partida.codigo||currentStudent.game.codigo}));
  if(currentStudent.empresaId)authoritativeStudentState={empresaId:currentStudent.empresaId,gameId:partida.id,code:admissionCode(partida.codigo),config:deepClone(config),status:JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')),runtime:{...(config.runtime||{}),round:config.runtime?.round||round}};
}
function renderStudentPodium(publication){
  for(const id of ['studentLobby','decisionMenu']){
    const host=$(id);if(!host)continue;
    let panel=host.querySelector('[data-student-podium]');
    if(!panel){panel=document.createElement('article');panel.dataset.studentPodium='';panel.className='student-podium side-panel';host.appendChild(panel);}
    panel.hidden=!publication;
    if(!publication){panel.replaceChildren();delete panel.dataset.signature;continue;}
    const signature=JSON.stringify(publication);if(panel.dataset.signature===signature)continue;
    panel.dataset.signature=signature;panel.replaceChildren();
    const title=document.createElement('h2');title.textContent='Podio del docente';panel.appendChild(title);
    const list=document.createElement('ol');
    for(const row of publication.podium||[]){const item=document.createElement('li');item.textContent=`${row.empresa}: ${row.grade} / 20`;list.appendChild(item);}
    panel.appendChild(list);const reason=document.createElement('p');reason.textContent=publication.reason||'';panel.appendChild(reason);
    const retention=document.createElement('p');retention.textContent='Los datos de la partida se guardan como máximo 24 horas.';panel.appendChild(retention);
  }
}
function remoteSnapshot(data){
  const report=data?.reporte_ciclo||data?.reporteCiclo||null;
  return data?.snapshot||report?.snapshot||report?.estado_juego||report?.estadoJuego||null;
}
function legacyRemoteDecisionState(data){
  const rows=data?.decisiones_historial||data?.decisionesHistorial||data?.decisiones_ciclo||[];
  if(!Array.isArray(rows)||!rows.length)return {};
  const activeRound=Number(data?.ciclo_partida||data?.ciclo_inicial||data?.empresa?.ciclo_actual)||Infinity;
  const history=rows.filter(row=>Number(row.ciclo||1)<=activeRound),latest=new Map(),state={};
  for(const row of history){
    const id=row.decision_key||row.decisionKey||row.decision_codigo;
    latest.set(id,Math.max(latest.get(id)||0,Math.max(1,Number(row.ciclo)||1)));
  }
  for(const row of history){
    const itemId=row.decision_key||row.decisionKey||row.decision_codigo;
    const optionId=row.option_key||row.optionKey||row.opcion_key;
    const item=findDecisionItem(itemId);if(!item)continue;
    const round=Math.max(1,Number(row.ciclo)||1),quantity=Number(row.cantidad)||0,cost=Number(row.costo_total)||0;
    // Normalized RPC history contains every cycle. Only assets accumulate;
    // a new material/staff/channel/target selection replaces its older cycle.
    if(!item.asset&&item.id!=='MOLDE'&&round!==latest.get(itemId))continue;
    const entry=state[item.id]||(state[item.id]={round,label:item.name,cost:0});
    entry.round=Math.max(Number(entry.round)||1,round);entry.cost=Number(entry.cost||0)+cost;
    if(item.asset||item.id==='MOLDE'){
      if(!optionId)continue;
      entry.purchases=entry.purchases||{};entry.purchases[round]=entry.purchases[round]||{};entry.purchases[round][optionId]=quantity||1;
      if(item.id==='MOLDE'){entry.optionIds=entry.optionIds||[];if(!entry.optionIds.includes(optionId))entry.optionIds.push(optionId);entry.optionRounds={...(entry.optionRounds||{}),[optionId]:Math.min(Number(entry.optionRounds?.[optionId])||round,round)};}
    }else if(item.type==='production-plan'){
      entry.value=Number(entry.value||0)+Math.max(0,quantity);
      if(optionId)entry.moldTargets={...(entry.moldTargets||{}),[optionId]:Math.max(0,quantity)};
    }else if(item.type==='quantity'||item.type==='quantity-choice'){
      if(!optionId)continue;entry.quantities={...(entry.quantities||{}),[optionId]:quantity};
      if(item.type==='quantity-choice'){entry.optionIds=entry.optionIds||[];if(!entry.optionIds.includes(optionId))entry.optionIds.push(optionId);}
    }else if(item.type==='choice'||item.type==='multi-choice'){
      if(!optionId)continue;entry.optionIds=entry.optionIds||[];if(!entry.optionIds.includes(optionId))entry.optionIds.push(optionId);entry.optionRounds={...(entry.optionRounds||{}),[optionId]:round};
      if(item.id==='CANALES'&&quantity>0){entry.quantities={...(entry.quantities||{}),[optionId]:quantity};if((item.options||[]).find(option=>option.id===optionId)?.channel==='store')entry.storeContracts={...(entry.storeContracts||{}),[optionId]:[{round,quantity}]};}
    }else if(item.type==='loan')entry.amount=Math.max(Number(entry.amount)||0,cost);
    else if(item.type==='number')entry.value=quantity;
  }
  return state;
}
function hydrateRemoteProgress(data){
  const snapshot=remoteSnapshot(data);
  if(!data?.partida||!data?.empresa||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return false;
  if(data.expulsada_at||data.empresa.expulsada_at||data.empresa.estado==='eliminada'){showStudentExpulsion();return false;}
  const rawDecisionSnapshot=snapshot?.decision_state||snapshot?.decisionState,rawLedgerSnapshot=snapshot?.cash_ledger||snapshot?.cashLedger,rawSectionsSnapshot=snapshot?.financial_sections||snapshot?.financialSections;
  let decisionSnapshot=rawDecisionSnapshot;
  if(!decisionSnapshot||typeof decisionSnapshot!=='object'||!Object.keys(decisionSnapshot).length)decisionSnapshot=legacyRemoteDecisionState(data);
  const entryRounds=state=>Object.entries(state||{}).filter(([key,value])=>!key.startsWith('__')&&value&&typeof value==='object').map(([,value])=>Number(value.round)).filter(value=>Number.isSafeInteger(value)&&value>0);
  const activeRound=currentRound(),activePlan=decisionSnapshot?.__cyclePlans?.[activeRound],planRound=Math.max(0,...entryRounds(activePlan?.state));
  // A previous client could confirm cycle 2 using only cycle-1 decisions after
  // restoring unscoped flags. Recover that open plan; final receipts stay intact.
  const stalePlan=activePlan?.state&&planRound>0&&planRound<activeRound&&!decisionSnapshot.__cycleSettlements?.[activeRound];
  if(stalePlan){
    decisionSnapshot=deepClone(decisionSnapshot);
    delete decisionSnapshot.__cyclePlans[activeRound];
    decisionSnapshot.__snapshotRound=planRound;
  }
  // Older databases remove snapshot.round but retain its submission flags.
  // Attribute those flags to the saved decisions, never to the newer room clock.
  const decisionRounds=entryRounds(decisionSnapshot);
  const savedRound=stalePlan?planRound:Number(snapshot.round||snapshot.ciclo||decisionSnapshot?.__snapshotRound)||Math.max(0,...decisionRounds);
  const round=savedRound||Math.max(1,Number(data?.ciclo_partida||data?.empresa?.ciclo_actual||currentRound()));
  const ledgerSnapshot=rawLedgerSnapshot;
  const sectionsSnapshot=rawSectionsSnapshot;
  const writes={
    [decisionKey()]:JSON.stringify(decisionSnapshot&&typeof decisionSnapshot==='object'?decisionSnapshot:{}),
    [ledgerKey()]:JSON.stringify(ledgerSnapshot&&typeof ledgerSnapshot==='object'?ledgerSnapshot:{}),
    [financialSectionsKey()]:JSON.stringify(sectionsSnapshot&&typeof sectionsSnapshot==='object'?sectionsSnapshot:{})
  };
  if(stalePlan)writes[`SIDE_STALE_CYCLE_PLAN_BACKUP_${storageKey()}_${activeRound}`]=JSON.stringify(activePlan);
  const submissions=snapshot?.section_submissions||snapshot?.sectionSubmissions;
  for(const category of decisionCategories())writes[`SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${round}_${category.cat}`]=null;
  if(Array.isArray(submissions))for(const cat of submissions)writes[`SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${round}_${cat}`]='1';
  else if(submissions&&typeof submissions==='object')for(const [cat,submitted] of Object.entries(submissions))writes[`SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${round}_${cat}`]=submitted?'1':null;
  writes[`SIDE_DECISIONS_SUBMITTED_${storageKey()}_${round}`]=(snapshot.decisions_submitted??snapshot.decisionsSubmitted)?'1':null;
  if(round<currentRound()){
    for(const category of decisionCategories())writes[`SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${currentRound()}_${category.cat}`]=null;
    writes[submissionKey()]=null;
  }
  const character=snapshot?.selected_character||snapshot?.selectedCharacter;writes[characterSelectionKey()]=character?String(character):null;
  if(!ledgerSnapshot||typeof ledgerSnapshot!=='object'||!Object.keys(ledgerSnapshot).length){
    const caja=Number(data?.empresa?.caja_actual??data?.reporte_ciclo?.caja_final??data?.reporteCiclo?.caja_final);
    if(Number.isFinite(caja)&&Math.abs(caja-initialCapital())>0.005)writes[ledgerKey()]=JSON.stringify({[`${round}:REMOTE_SNAPSHOT`]:caja-initialCapital()});
  }
  if(Object.keys(writes).length&&!writeDecisionBatch(writes))return false;
  loadDecisionState();studentProgressHydrated=true;
  if(!$('decisionMenu')?.classList.contains('hidden')){restoreDraftsForRound();renderTabs();renderDecisionCategory();updateHud();}
  return true;
}
async function refreshStudentGame(options={}){
  if(!studentConnected)return false;
  const refreshEpoch=studentSnapshotEpoch;
  if(remoteStateBusy&&!options.forceHydrate)return false;
  const forceHydrate=Boolean(options.forceHydrate);
  if(!forceHydrate&&currentStudent.empresaId)await retryStudentSync();
  if(!studentConnected||refreshEpoch!==studentSnapshotEpoch)return false;
  const S=window.SIDE;
  let remoteValid=!currentStudent.empresaId;
  if(currentStudent.empresaId&&S?.EmpresaService){
    if(remoteStateBusy){
      if(!forceHydrate)return false;
      try{await remoteStateTask;}catch{}
      if(!studentConnected)return false;
    }
    remoteStateBusy=true;
    const identity=studentIdentity(),identityKey=studentIdentityKey(),epoch=studentSnapshotEpoch;
    remoteStateTask=(async()=>{
      try{
        const r=await S.EmpresaService.obtenerEstado(identity);
        if(epoch!==studentSnapshotEpoch||!studentConnected||studentIdentityKey()!==identityKey)return false;
        if(r?.code==='EMPRESA_EXPULSADA'){showStudentExpulsion();return false;}
        if(!r?.success||!r.data?.partida||!r.data?.empresa){studentMaterialSequence++;studentMaterialBook=null;studentMaterialStatus='Datos de recepción no verificados / proyección no disponible.';renderStudentPodium(null);studentStateFailure=r||{technical:true,error:JOIN_SERVER_MESSAGE};requestMaterialViewRefresh();return false;}
        studentStateFailure=null;studentConnectionConfirmedAt=performance.now();
        const data=r.data,partida=data.partida,empresa=data.empresa,config=partida.configuracion;
        if(data.expulsada_at||data.participante?.expulsada_at||empresa.expulsada_at||empresa.estado==='eliminada'){showStudentExpulsion();return false;}
        if(partida.id!==currentStudent.game?.id||admissionCode(partida.codigo)!==admissionCode(identity.codigo))throw new Error('La respuesta del servidor corresponde a otra sala. Vuelve a intentar el ingreso con el código del docente.');
        const joined=Number(data.empresas_unidas);
        if(Number.isSafeInteger(joined)&&joined>=1)studentJoinedCompanies=joined;
        const empresaId=data.empresa_id||empresa.id||currentStudent.empresaId;
        const previousRevision=Math.max(0,Number(currentStudent.snapshotRevision)||0),serverRevision=Math.max(0,Number(data.snapshot_revision??data.snapshotRevision??0)||0);
        // A read started before our acknowledged write must not roll it back.
        if(serverRevision<previousRevision)return false;
        const canonicalCompany=S.EmpresaService.cleanText(empresa.nombre_comercial||currentStudent.company),canonicalLegal=S.EmpresaService.cleanText(empresa.nombre_legal||currentStudent.legalName);
        currentStudent={...currentStudent,empresaId,participantId:data.participante_id||currentStudent.participantId,company:canonicalCompany,legalName:canonicalLegal,game:{...partida,codigo:S.EmpresaService.cleanCode(partida.codigo||identity.codigo)},snapshotRevision:(!forceHydrate&&studentSyncPending())?previousRevision:serverRevision};
        const round=Number(config?.runtime?.round||data.ciclo_partida||empresa.ciclo_actual||1);
        applyStudentGameState(partida,round);
        if(config?.materialRulesVersion==='receipts-v1')await refreshStudentMaterialBook();
        if(epoch!==studentSnapshotEpoch||!studentConnected||studentIdentityKey()!==identityKey)return false;
        renderStudentPodium(data.podio);
        if(!forceHydrate&&studentSyncPending())studentProgressHydrated=true;
        else if(forceHydrate||!studentProgressHydrated||serverRevision!==previousRevision){studentProgressHydrated=false;if(!hydrateRemoteProgress(data))return false;}
        if(config?.lifecycleVersion===2)localStorage.setItem('SIDE_INDIVIDUAL_EVENTS_'+storageKey(),JSON.stringify(data.individualEvents||{}));
        try{sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify(currentStudent));}catch{}
        return true;
      }catch(error){studentMaterialSequence++;studentMaterialBook=null;studentMaterialStatus='Datos de recepción no verificados / proyección no disponible.';studentStateFailure={technical:true,error:error?.message||JOIN_SERVER_MESSAGE};requestMaterialViewRefresh();console.warn('SIDE: estado remoto pendiente',error);return false;}
    })();
    try{remoteValid=await remoteStateTask;}finally{remoteStateBusy=false;remoteStateTask=null;}
  }
  if(!currentStudent.empresaId&&teacherConfig().lifecycleVersion===2){
    studentJoinedCompanies=1;
    const c=teacherConfig(),r=RULES.resolveRuntime(c,studentNow());
    applyStudentGameState({configuracion:{...c,runtime:r,phase:r.phase},estado:r.phase==='finished'?'finalizada':'esperando'});
  }
  updateIntegrationUI();
  if(!document.hidden)syncStudentReportPreview();
  return remoteValid;
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&studentConnected)pollStudentGame();});
window.addEventListener('pagehide',()=>{stopStudentSync();try{const reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]');const r=reports.find(row=>row.id===(currentStudent.participantId||('local-'+storageKey())));if(r){r.conectada=false;localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));}}catch{}});
window.addEventListener('pageshow',()=>{if(studentConnected){startStudentSync();pollStudentGame();}});
window.addEventListener('storage',event=>{if(['SIDE_GAME_STATUS','SIDE_ROUND_RUNTIME','SIDE_ACTIVE_ROUND','SIDE_COMPANY_EXCLUSIONS'].includes(event.key)&&studentConnected)updateIntegrationUI()});
function storageKey(){return `${currentStudent.game?.codigo||'SIDE-000'}_${currentStudent.company}`}
function decisionKey(){return 'SIDE_DECISIONS_'+storageKey()}
function ledgerKey(){return 'SIDE_CASH_LEDGER_'+storageKey()}
function loadDecisionState(){
  try{decisionState=JSON.parse(localStorage.getItem(decisionKey())||'{}')||{}}catch{decisionState={}}
  try{cashLedger=JSON.parse(localStorage.getItem(ledgerKey())||'{}')||{}}catch{cashLedger={}}
  const migrated=window.SIDE_CYCLE_MODEL?.migrate({state:decisionState,ledger:cashLedger,catalog:DECISION_CATALOG,capital:initialCapital(),round:currentRound()});
  if(migrated?.migrated){localStorage.setItem('SIDE_PREVIOUS_MODEL_BACKUP_'+storageKey(),JSON.stringify(migrated.archive));decisionState=migrated.state;cashLedger=migrated.ledger;if(migrated.closedRound===currentRound()){localStorage.setItem(submissionKey(),'1');for(const category of decisionCategories())localStorage.setItem(sectionSubmissionKey(category.cat),'1');}persistGameState();}
  const cleanLedger=window.SIDE_CYCLE_MODEL?.economicLedger?.(cashLedger,decisionState);
  if(cleanLedger&&JSON.stringify(cleanLedger)!==JSON.stringify(cashLedger)){
    localStorage.setItem('SIDE_WORLD_LEDGER_BACKUP_'+storageKey(),JSON.stringify(cashLedger));
    cashLedger=cleanLedger;persistGameState();
  }
  decisionDrafts={};
  publishWorldIdentity();
}
function persistGameState(){localStorage.setItem(decisionKey(),JSON.stringify(decisionState));localStorage.setItem(ledgerKey(),JSON.stringify(cashLedger))}
function ledgerTotal(){return Object.values(cashLedger).reduce((s,n)=>s+(Number(n)||0),0)+financialAdjustment()}
function ensureCycleFixedCosts(){
  if(!studentAccess().canOperate)return null;
  const round=currentRound(),previous=decisionState.__cycleCosts?.[round];
  if(previous&&Number(previous.round)===round)return previous.total>0?previous:null;
  const context=decisionModelContext(),state=deepClone(decisionState),ledger={...cashLedger},sections=deepClone(recordedFinancialSections());
  const before=initialCapital()+ledgerTotal(),items=[],prepared=[];
  for(const category of decisionCategories()){
    const key=`${round}:${category.cat}`;
    // A category net already saved in this cycle may mix many decisions. Never
    // add a second charge or infer a missing debit from an old partial record.
    if(Object.hasOwn(ledger,key))continue;
    const fixed=[];
    for(const item of category.items){
      if(item.type==='info'||item.asset||item.type==='loan')continue;
      const entry=decisionState[item.id];let draft;
      if(item.mandatoryFixed)draft={optionIds:[...(item.defaultOptionIds||[])]};
      else if(item.recurring&&entry&&Number(entry.round)<round){
        // Reuse the existing recurring-cost classification. Training, marketing,
        // materials and other one-cycle purchases have no recurring component.
        draft=window.SIDE_REVIEW_MODEL.draft(item,{...context,drafts:{}});
        if(item.type==='quantity'||item.type==='quantity-choice')draft={quantities:deepClone(entry.quantities||{})};
        const continuity=window.SIDE_REVIEW_MODEL.breakdown(item,{...context,drafts:{...context.drafts,[item.id]:draft}});
        if(!(continuity.recurring>0))continue;
      }else continue;
      context.drafts[item.id]=deepClone(draft);fixed.push(item);
    }
    if(!fixed.length)continue;
    const plan=prepareSectionSave({...category,items:fixed},context);
    const charges=plan.model.items.filter(item=>Number(item.outflow)>0);
    if(!charges.length)continue;
    // The partial category contains only the already-defined fixed/recurring
    // choices. A later save replaces this same ledger key with the full section.
    ledger[key]=plan.net;Object.assign(state,plan.entries);
    sections[round]={...(sections[round]||{}),[category.cat]:{...plan.model,recordedNet:plan.net}};
    items.push(...charges.map(item=>({id:item.id,label:item.name,amount:Number(item.outflow)})));prepared.push(...fixed.map(item=>item.id));
  }
  if(!items.length)return null;
  const total=items.reduce((sum,item)=>sum+item.amount,0),after=initialCapital()+Object.values(ledger).reduce((sum,value)=>sum+(Number(value)||0),0);
  const receipt={round,items,total,before,after,acknowledged:false,createdAt:new Date().toISOString()};
  state.__cycleCosts={...(state.__cycleCosts||{}),[round]:receipt};
  if(!writeDecisionBatch({[decisionKey()]:JSON.stringify(state),[ledgerKey()]:JSON.stringify(ledger),[financialSectionsKey()]:JSON.stringify(sections)}))return null;
  decisionState=state;cashLedger=ledger;
  for(const id of prepared)decisionDrafts[id]=deepClone(context.drafts[id]);
  try{queueStudentSnapshot(buildStudentSnapshot(round));}catch(error){console.warn('SIDE: costos del ciclo guardados; sincronización pendiente',error);}
  return receipt;
}
function cashBalance(){return initialCapital()+ledgerTotal()}
function submissionKey(){return `SIDE_DECISIONS_SUBMITTED_${storageKey()}_${currentRound()}`}
function decisionsSubmitted(){return localStorage.getItem(submissionKey())==='1'}
function simulationSubmissionComplete(){return decisionsSubmitted()||decisionCategories().every(category=>sectionSubmitted(category.cat))}
function worldAdmissionKey(){return `SIDE_WORLD_ADMITTED_${storageKey()}_${currentRound()}`;}
function cyclePlanSyncPendingKey(round=currentRound()){return `SIDE_CYCLE_PLAN_SYNC_PENDING_${storageKey()}_${round}`;}
function cyclePlanSyncPending(round=currentRound()){try{return localStorage.getItem(cyclePlanSyncPendingKey(round))==='1'}catch{return false}}
function setCyclePlanSyncPending(pending,round=currentRound()){try{if(pending)localStorage.setItem(cyclePlanSyncPendingKey(round),'1');else localStorage.removeItem(cyclePlanSyncPendingKey(round))}catch{}}
const CHARACTER_MODEL_IDS=Object.freeze({miguel:'chico2',joel:'chico3',gonzalo:'chico1',valeria:'mona'});
const CHARACTER_SLUGS=Object.freeze(Object.fromEntries(Object.entries(CHARACTER_MODEL_IDS).map(([slug,id])=>[id,slug])));
function characterSelectionKey(){return `SIDE_SELECTED_CHARACTER_${storageKey()}`}
function selectedCharacterSlug(){
  let value=null;try{value=localStorage.getItem(characterSelectionKey())}catch{}
  if(!CHARACTER_MODEL_IDS[value]){
    const current=window.CharacterSelection?.getSelected?.();if(CHARACTER_MODEL_IDS[current])value=current;
  }
  return CHARACTER_MODEL_IDS[value]?value:null;
}
function selectedCharacterModel(){return CHARACTER_MODEL_IDS[selectedCharacterSlug()]||null}
let characterSelectionConfirmed=false;
function canExploreWorld(){return studentAccess().canOperate&&(currentStudent.empresaId&&authoritativeStudentState?authoritativeStudentState.runtime:readRoundRuntime())?.status!=='paused'}
function canOperateWorld(){
  const explore=typeof canExploreWorld==='function'?canExploreWorld():studentAccess().canOperate&&readRoundRuntime()?.status!=='paused';
  const submitted=typeof simulationSubmissionComplete==='function'?simulationSubmissionComplete():true;
  return explore&&submitted;
}
function canStartSimulation(){return canVisitFunWorld()&&!cyclePlanSyncPending()}
function setDecisionsSubmitted(v){if(v)localStorage.setItem(submissionKey(),'1');else localStorage.removeItem(submissionKey())}
function sectionLedgerKey(cat){return `${currentRound()}:${cat}`}
// Navigation is deliberately separate from the read-only world data boundary.
window.SIDE_WORLD_NAVIGATION=Object.freeze({
  openDecisions(cat){
    if(['B','C','D','E','F'].includes(cat))currentCategory=cat;
    return openDecisionMenu();
  }
});
let worldAtmosphereEvents=[],worldAtmosphereContext='';
function publishWorldIdentity(){
  try {
    const context=funAdmissionContext()+'|'+currentRound(),changed=context!==worldAtmosphereContext;
    if(changed){worldAtmosphereEvents=[];worldAtmosphereContext=context;}
    window.SIDE_WORLD_PUBLISHER?.publish({company:{name:currentStudent.company||COMPANY_NAME,gameCode:currentStudent.game?.codigo||'SIDE',character:selectedCharacterModel()||'chico2'},cycle:currentRound(),...(changed?{events:[],news:[],products:[],approximateStock:24,storeLevel:{stores:1,visual:{}}}:{})});
  }catch{}
}
function publishWorldAtmosphere(){
 try {
  const context=funAdmissionContext()+'|'+currentRound();if(context!==worldAtmosphereContext){worldAtmosphereEvents=[];worldAtmosphereContext=context;}
  const visual={};
  // Only equipment/staff silhouettes and channel appearance cross the boundary.
  for(const id of ['ENSAMBLE','ACABADOS','MESA_CORTE','MOLDE','PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','INV_RRHH','CANALES']){
    const entry=decisionState[id];if(!entry)continue;
    visual[id]={optionIds:entry.optionIds||[],quantities:entry.quantities||{},purchases:entry.purchases||{},label:entry.label||''};
  }
  const plan=productionPlan();
  return window.SIDE_WORLD_PUBLISHER?.publish({company:{name:currentStudent.company||COMPANY_NAME,gameCode:currentStudent.game?.codigo||'SIDE',character:selectedCharacterModel()||'chico2'},cycle:currentRound(),
    products:(plan?.productLines||[]).map(line=>({id:line.id,name:line.label,approximateStock:Math.max(0,Math.round(Number(line.plannedUnits)||0))})),
    approximateStock:Math.max(0,Math.round(Number(plan?.producibleUnits)||24)),
    storeLevel:{stores:window.SIDE_RULES.storeCount(decisionState.CANALES),visual},
    news:[],events:worldAtmosphereEvents});
 } catch {return false;}
}

// Landing / acceso
$('startBtn')?.addEventListener('click',()=>showScreen('profiles'));
$('openCreditsBtn')?.addEventListener('click',()=>{renderCredits();showModal('creditsModal')});
document.querySelector('.modal-backdrop')?.addEventListener('click',closeModal);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
document.querySelectorAll('[data-switch]').forEach(b=>b.addEventListener('click',()=>showModal(b.dataset.switch==='register'?'teacherRegisterModal':'teacherLoginModal')));
function openStudentAdmission(){
  // Opening a new admission form supersedes a pending recovery of the last room.
  studentSnapshotEpoch++;studentConnected=false;renderStudentPodium(null);studentSessionRecovering=false;studentProgressHydrated=false;
  authoritativeStudentState=null;studentClock=null;studentStateFailure=null;autoEnterDecisions=false;stopStudentSync();
  message('studentMessage','');showModal('studentModal');
}
document.querySelectorAll('.profile-card').forEach(card=>card.addEventListener('click',()=>{if(card.dataset.profile==='teacher'){showModal('teacherLoginModal');void teacherSession().catch(()=>{});}else openStudentAdmission();}));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!$('modalRoot')?.classList.contains('hidden')){closeModal();return;}
  if(e.key!=='Escape')return;
  if($('decisionMenu')?.classList.contains('hidden'))return;
  // The review dialog keeps its native Escape behavior; a second Escape exits the tablet.
  if($('companyReviewDialog')?.open)return;
  e.preventDefault();e.stopImmediatePropagation();closeDecisionMenu();
});
function openTeacherPanel(){closeModal();window.location.href='docente.html?v=20261012-sesion-codigos'}
// Reuse SIDE Lite's session adapter: the API, not client metadata, decides the role.
let teacherSessionPromise;
function teacherSession(){
  if(!supabaseClient)throw new Error('No se pudo conectar con el servicio de acceso.');
  if(teacherSessionPromise)return teacherSessionPromise;
  teacherSessionPromise=Promise.all([
    import('../supabase-session.js?v=20261110-login-fast3'), import('../turnstile-provider.js?v=20261110-captcha-visible'), import('../captcha-config.js')
  ]).then(([{createSupabaseSession},{createTurnstileProvider},{turnstileSiteKey,teacherCaptchaEnabled}])=>{
    const captcha=teacherCaptchaEnabled ? createTurnstileProvider({siteKey:turnstileSiteKey}) : null;
    if(teacherCaptchaEnabled&&!captcha)throw new Error('No está disponible la verificación de acceso.');
    // Load the Turnstile script while the professor fills the form; the token
    // is still requested fresh and verified by Supabase when submitting.
    if(captcha?.preload)void captcha.preload().catch(()=>{});
    return createSupabaseSession(supabaseClient,fetch,{captchaTokenProvider:captcha});
  }).catch(error=>{teacherSessionPromise=null;throw error;});
  return teacherSessionPromise;
}
async function teacherIdentity(session){
  let identity;
  try{identity=await session.identity()}
  catch(error){
    if(error.status!==409)throw error;
    const current=await session.session(),name=String(current?.session?.user?.user_metadata?.display_name||'').trim();
    if(name.length<2||name.length>80)throw new Error('El perfil no está configurado. Contacta al administrador.');
    try{await session.request('/profile','POST',{display_name:name})}catch(profileError){if(profileError.status!==409)throw profileError;}
    identity=await session.identity();
  }
  if(identity.role!=='teacher')throw new Error('Tu cuenta necesita autorización docente. Contacta al administrador.');
  return identity;
}
async function teacherWithMfa(session, action){
  try{return await action()}
  catch(error){
    if(error.code!=='MFA_REQUIRED')throw error;
    const factors=await session.mfaFactors();
    if(factors.length!==1)throw new Error('Completa la verificación multifactor en tu cuenta antes de continuar.');
    const code=window.prompt('Ingresa el código de seis dígitos de tu aplicación autenticadora:');
    if(!code)throw new Error('La verificación multifactor fue cancelada.');
    await session.verifyMfa({factorId:factors[0].id,code:code.trim()});
    return action();
  }
}
$('loginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const email=$('loginEmail').value.trim().toLowerCase(),password=$('loginPassword').value;
  if(!/^[^@\s]+@upch\.pe$/i.test(email)){message('loginMessage','Ingresa un correo institucional @upch.pe.',true);return;}
  const button=e.currentTarget.querySelector('[type="submit"]');if(button)button.disabled=true;let session;
  try{
    message('loginMessage','Preparando acceso seguro...');
    session=await teacherSession();
    message('loginMessage','Verificando seguridad y credenciales...');
    await session.signIn({email,password});
    message('loginMessage','Comprobando autorización docente...');
    await teacherWithMfa(session,()=>teacherIdentity(session));
    openTeacherPanel();
  }
  catch(error){
    // Explain a failed login immediately, even if session cleanup is slow.
    message('loginMessage',error.message||'No se pudo iniciar sesión.',true);
    if(session)await session.signOut().catch(()=>{});
  }
  finally{if(button)button.disabled=false;}
});
// Keep SIDE Lite's existing minimum for new passwords in the original form.
if($('registerPassword'))$('registerPassword').minLength=12;
$('registerForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const first=$('registerName').value.trim(),last=$('registerLastName').value.trim(),course=$('registerCourse').value.trim(),email=$('registerEmail').value.trim().toLowerCase(),password=$('registerPassword').value,name=`${first} ${last}`;
  if(!first||!last||!course||name.length>80||course.length>100||!/^[^@\s]+@upch\.pe$/i.test(email)){message('registerMessage','Completa los datos e ingresa un correo institucional @upch.pe.',true);return;}
  if(password.length<12){message('registerMessage','La contraseña debe tener al menos 12 caracteres.',true);return;}
  const form=e.currentTarget,button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
  try{
    message('registerMessage','Creando cuenta...');const session=await teacherSession();const result=await session.register({email,password,name,firstName:first,lastName:last,course});
    if(!result?.session){message('registerMessage','No se pudo completar el registro sin confirmación. Contacta al administrador.',true);return;}
    try{await session.identity()}catch(error){if(error.status===409){try{await session.request('/profile','POST',{display_name:name})}catch(profileError){if(profileError.status!==409)throw profileError;}}else throw error;}
    await session.signOut();form.reset();showModal('teacherLoginModal');$('loginEmail').value=email;
    message('loginMessage','Cuenta creada. Para administrar partidas necesitas autorización docente.');
  }catch(error){message('registerMessage',error.message||'No se pudo crear la cuenta.',true);}
  finally{if(button)button.disabled=false;}
});
$('studentForm')?.addEventListener('submit',async e=>{
  e.preventDefault();studentSessionRecovering=false;studentStateFailure=null;stopStudentSync();studentProgressHydrated=false;studentSnapshotEpoch++; const S=window.SIDE||{},cleanText=S.EmpresaService?.cleanText||(value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ')),cleanCode=S.EmpresaService?.cleanCode||(value=>cleanText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase());
  const joinEpoch=studentSnapshotEpoch;
  const code=admissionCode($('gameCode').value);
  showAdmissionCodeError();
  if(!validAdmissionCode(code)){showAdmissionCodeError(JOIN_CODE_MESSAGE);message('studentMessage',JOIN_CODE_MESSAGE,true);$('gameCode').focus();return;}
  $('gameCode').value=code;
  const legalName=cleanText($('companyLegalName')?.value);
  const brandName=cleanText($('companyBrandName')?.value)||legalName||COMPANY_NAME;
  if(!legalName||!brandName){message('studentMessage','Ingresa el nombre y el nombre comercial de tu empresa.',true);return}
  const localCfg=teacherConfig(),localCode=String(localCfg.codigo||'SIDE-000').toUpperCase();
  if(!hasConfig&&code===localCode&&!localStorage.getItem('SIDE_REMOTE_GAME_'+code)&&!localStorage.getItem('SIDE_PARTIDA_ID')){
    let reports=[];try{reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')}catch{}
    const comparable=value=>String(value||'').replace(/\s+/g,'').toUpperCase(),previous=reports.find(r=>admissionCode(r.partida)===code&&comparable(r.empresa)===comparable(brandName)&&(!r.legalName||comparable(r.legalName)===comparable(legalName)));
    let excluded={};try{excluded=JSON.parse(localStorage.getItem('SIDE_COMPANY_EXCLUSIONS')||'{}');}catch{}
    if(excluded[`${code}_${previous?.empresa||brandName}`]){showStudentExpulsion();return;}
    const access=RULES.gameAccess(teacherConfig(),JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'{}'),readRoundRuntime()||{},Boolean(previous),studentNow());
    if(!access.canJoin){message('studentMessage',access.reason,true);return;}

    const localGame={...DEMO_GAME,codigo:code,nombre:localCfg.nombre||DEMO_GAME.nombre,curso:localCfg.curso||DEMO_GAME.curso,estado:'activa'};
    currentStudent={name:'Jugador',company:previous?.empresa||brandName,legalName:previous?.legalName||legalName,participantId:null,game:localGame,returning:Boolean(previous)};
  }else{
    if(!requireSupabase()){const error={code:'CLIENTE_SUPABASE_NO_DISPONIBLE'};console.error('SIDE: no se pudo iniciar la validación de ingreso',error);message('studentMessage',JOIN_SERVER_MESSAGE,true);return}message('studentMessage','Validando ingreso...');
    if(!S.EmpresaService?.ingresar){const error={code:'SERVICIO_EMPRESA_NO_DISPONIBLE'};console.error('SIDE: no se pudo iniciar la validación de ingreso',error);message('studentMessage',JOIN_SERVER_MESSAGE,true);return}
    let ingreso;
    const joinButton=$('studentForm')?.querySelector?.('[type="submit"]');if(joinButton){joinButton.disabled=true;joinButton.setAttribute('aria-busy','true');}

    try{ingreso=await S.EmpresaService.ingresar({codigo:code,nombreLegal:legalName,nombreComercial:brandName})}catch(error){console.error('SIDE: error técnico no controlado al validar el ingreso',error);message('studentMessage',JOIN_SERVER_MESSAGE,true);return}finally{if(joinButton){joinButton.disabled=false;joinButton.removeAttribute('aria-busy');}}
    if(joinEpoch!==studentSnapshotEpoch)return;
    if(!ingreso?.success){
      if(ingreso?.code==='ACCESO_RESERVADO'){message('studentMessage',ingreso.error||'Solicita al docente que libere el acceso.',true);return;}
      if(ingreso?.code==='EMPRESA_EXPULSADA'){showStudentExpulsion();return;}
      if(['CODIGO_INVALIDO','PARTIDA_NO_ENCONTRADA','CODIGO_AMBIGUO','CODIGO_RETIRADO'].includes(ingreso?.code)){
        const text=ingreso.code==='CODIGO_INVALIDO'?JOIN_CODE_MESSAGE:ingreso.code==='CODIGO_RETIRADO'?'Este código pertenece a una sala anterior y ya no se puede utilizar. Pide al docente el código de una sala nueva.':ingreso.code==='CODIGO_AMBIGUO'?'El código corresponde a más de una partida. Pide al docente el código de una sala nueva.':'No existe una partida con ese código. Revisa el código de la sala con tu docente.';
        showAdmissionCodeError(text);message('studentMessage',text,true);return;
      }
      if(['PARTIDA_CANCELADA','PARTIDA_FINALIZADA'].includes(ingreso?.code)){message('studentMessage',ingreso.code==='PARTIDA_CANCELADA'?'Esta partida fue cancelada. Pide al docente el código de una sala nueva.':'Esta partida ya finalizó. Pide al docente el código de una sala nueva.',true);return;}
      if(ingreso?.code==='MIGRACION_PENDIENTE'){message('studentMessage',ingreso.error,true);return}
      if(ingreso?.code==='PARTIDA_INICIADA'){message('studentMessage',JOIN_STARTED_MESSAGE,true);return}
      if(ingreso?.code==='SALA_LLENA'){message('studentMessage','La sala está llena. Pide al docente que revise su capacidad.',true);return}
      if(ingreso?.code==='CREDENCIALES_INVALIDAS'){message('studentMessage',JOIN_INVALID_MESSAGE,true);return}
      console.error('SIDE: error técnico al validar el ingreso',ingreso);

      message('studentMessage',ingreso?.code==='anonymous_provider_disabled'?'El acceso de estudiantes no está habilitado. Pide al docente activar los inicios de sesión anónimos en Supabase.':ingreso?.code==='CONEXION_TIMEOUT'?'La conexión tardó demasiado. Intenta ingresar nuevamente.':/PGRST202|42883/.test(ingreso?.code||'')?'La sala requiere actualizar Supabase. El docente debe ejecutar 2026-10-12_salas_codigo.sql.':ingreso?.code==='42501'?'Supabase rechazó el permiso de ingreso. Pide al docente revisar la migración de salas.':JOIN_SERVER_MESSAGE,true);return
    }
    const data=ingreso.data||{},found=data.partida||{},empresa=data.empresa||{};
    if(admissionCode(found.codigo)!==code){console.error('SIDE: ingresar_empresa devolvió otra sala');message('studentMessage','El servidor devolvió otra sala. Revisa el código e intenta nuevamente.',true);return}
    const empresaId=data.empresa_id||empresa.id||null,participantId=data.participante_id||null,returning=Boolean(data.reingreso);
    if(!empresaId||!found.id){console.error('SIDE: respuesta incompleta de ingresar_empresa');message('studentMessage',JOIN_SERVER_MESSAGE,true);return}
    const canonicalBrand=cleanText(empresa.nombre_comercial||data.nombre_comercial||brandName),canonicalLegal=cleanText(empresa.nombre_legal||data.nombre_legal||legalName);
    const capitalSource=empresa.caja_inicial??data.caja_inicial,currentCapital=Number(capitalSource);
    currentStudent={name:'Jugador',company:canonicalBrand,legalName:canonicalLegal,participantId,empresaId,snapshotRevision:Math.max(0,Number(data.snapshot_revision??data.snapshotRevision??0)||0),...(capitalSource!==null&&capitalSource!==undefined&&Number.isFinite(currentCapital)?{initialCapital:currentCapital}:{}),game:{...found,codigo:cleanCode(found.codigo||code)},returning};
    const round=Number(data.ciclo_partida||empresa.ciclo_actual||data.ciclo_inicial||1);
    try{applyStudentGameState(currentStudent.game,round);if(!studentSyncPending())hydrateRemoteProgress(data);}catch(error){console.error('SIDE: no se pudo restaurar por completo el estado remoto',error);message('studentMessage',error.message||JOIN_SERVER_MESSAGE,true);return}
    if(returning)toast('Bienvenido de vuelta. Tu progreso fue restaurado.');
    localStorage.setItem('SIDE_REMOTE_GAME_'+code,'1');
  }
  studentConnected=true;studentProgressHydrated=!currentStudent.empresaId||studentProgressHydrated;autoEnterDecisions=false;cancellationShown=false;studentJoinedCompanies=null;
  $('roomCancellationNotice')?.classList.add('hidden');
  try{sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify(currentStudent));}catch{}
  startStudentSync();
  loadDecisionState();
  await refreshStudentGame();
  if(joinEpoch!==studentSnapshotEpoch)return;
  const joinedReport=syncStudentReportPreview();if(currentStudent.empresaId&&studentProgressHydrated)syncReportToSupabase(joinedReport);
  closeModal();startJoinLoading();
});
function startJoinLoading(){return prepareLobby()}
function preloadStudentWorld(){
  const preload=window.SIDE3D?.preloadBase||window.SIDE3D?.preload;
  if(typeof preload==='function')preload().catch(error=>console.warn('SIDE: precarga pendiente',error));
}
window.addEventListener('side3d:ready',()=>{if(studentConnected&&studentAccess().integration)preloadStudentWorld();});
async function prepareLobby(){
  $('lobbyCode').textContent=currentStudent.game.codigo;$('lobbyGameName').textContent=currentStudent.game.nombre;
  $('lobbyStudent').textContent=currentStudent.legalName&&currentStudent.legalName!==currentStudent.company?`${currentStudent.company} · ${currentStudent.legalName}`:currentStudent.company;
  renderStudentStatus();syncStudentTimer();showScreen('studentLobby');
  autoEnterDecisions=true;updateIntegrationUI();
}
function tutorialMarkup(){
  if(!tutorialMarkupPromise)tutorialMarkupPromise=fetch('tutorial.html?v=20261010-waiting-tutorial').then(response=>{if(!response.ok)throw new Error('No se pudo cargar tutorial.html');return response.text()}).catch(error=>{tutorialMarkupPromise=null;throw error});
  return tutorialMarkupPromise;
}
function syncWaitingTutorial(){
  const mount=$('waitingTutorialMount'),visible=mount&&!$('studentLobby')?.classList.contains('hidden')&&!$('studentWaiting')?.classList.contains('hidden');
  if(!visible){
    if(waitingTutorialCleanup||waitingTutorialPending){waitingTutorialRequest++;waitingTutorialCleanup?.();waitingTutorialCleanup=null;waitingTutorialPending=false;}
    return;
  }
  if(waitingTutorialCleanup||waitingTutorialPending)return;
  const request=++waitingTutorialRequest;waitingTutorialPending=true;
  (async()=>{
    try{
      if(!mount.dataset.loaded){
        const html=await tutorialMarkup();
        if(request!==waitingTutorialRequest)return;
        mount.innerHTML=html;
        mount.querySelectorAll('[id]').forEach(element=>{element.id=`waiting-${element.id}`});
        const required=mount.querySelector('.tutorial-required');if(required)required.textContent='APRENDE MIENTRAS ESPERAS';
        mount.dataset.loaded='1';
      }
      if(request!==waitingTutorialRequest)return;
      waitingTutorialCleanup=window.initSIDETutorial?.(null,{root:mount.querySelector('.tutorial-shell'),loop:true})||null;
    }catch(error){
      console.error(error);
      if(request===waitingTutorialRequest)mount.textContent='No se pudo cargar el tutorial. La sala de espera sigue conectada.';
    }finally{if(request===waitingTutorialRequest)waitingTutorialPending=false;}
  })();
}
async function openStudentTutorial(){
  showScreen('tutorial'); const mount=$('tutorialMount');
  if(!mount.dataset.loaded){try{mount.innerHTML=await tutorialMarkup();mount.dataset.loaded='1'}catch(error){console.error(error);showScreen('studentLobby');return}}
  if($('tutorial')?.classList.contains('hidden'))return;
  if(typeof window.initSIDETutorial==='function')window.initSIDETutorial(()=>showScreen('studentLobby'),{root:mount.querySelector('.tutorial-shell')});
}
$('enterDecisionsBtn')?.addEventListener('click',openDecisionMenu);
$('cancelledBackToProfiles')?.addEventListener('click',()=>$('backToProfiles').click());
$('resumeWorldBtn')?.addEventListener('click',requestWorldEntry);
$('reopenTutorialBtn')?.addEventListener('click',openStudentTutorial);
$('backToProfiles')?.addEventListener('click',()=>{studentConnected=false;renderStudentPodium(null);studentSessionRecovering=false;studentSnapshotEpoch++;playerIsDeciding=false;autoEnterDecisions=false;characterSelectionConfirmed=false;studentClock=null;studentJoinedCompanies=null;stopStudentSync();try{sessionStorage.removeItem('SIDE_STUDENT_SESSION');}catch{}showScreen('profiles')});
$('waitingBackToProfiles')?.addEventListener('click',()=>$('backToProfiles')?.click());
function updateDecisionReturnButton(){
  const button=$('exitDecisions');if(!button)return;
  const returning=Boolean(window.__SIDE_RETURN_TO_3D),label=returning?'Volver al mundo':'Volver a la sala';
  button.setAttribute('aria-label',label);button.title=`${label} (Esc)`;
  button.classList.toggle('returns-to-world',returning);
  const text=$('decisionReturnLabel');if(text)text.textContent=label;
}
function closeDecisionMenu(){
  if(!$('decisionMenu')||$('decisionMenu').classList.contains('hidden'))return false;
  document.activeElement?.blur?.();
  if(typeof closeCompanyReview==='function')closeCompanyReview();
  playerIsDeciding=false;syncStudentReportPreview();
  if(window.__SIDE_RETURN_TO_3D){window.__SIDE_RETURN_TO_3D=false;window.SIDE3D?.returnFromDecisions?.();}
  else showScreen('studentLobby');
  return true;
}
$('exitDecisions')?.addEventListener('click',closeDecisionMenu);
$('restartDecisionMenu')?.addEventListener('click',()=>{$('decisionSummary').classList.add('hidden');renderDecisionCategory()});

function allDecisionItems(){return DECISION_CATALOG.flatMap(c=>c.items)}
function decisionCategories(){return DECISION_CATALOG.filter(category=>!category.summaryOnly)}
function navigationCategories(){
  const summary=DECISION_CATALOG.find(category=>category.summaryOnly),decisions=decisionCategories();
  return currentRound()<=1?[...decisions,...(summary?[summary]:[])]:[...(summary?[summary]:[]),...decisions];
}
function categoryByCat(cat){return DECISION_CATALOG.find(c=>c.cat===cat)}
function findDecisionItem(id){return allDecisionItems().find(i=>i.id===id)}
function savedEntry(item){return decisionState[item.id]||null}
function sectionSubmissionKey(cat=currentCategory){return `SIDE_DECISION_SECTION_SUBMITTED_${storageKey()}_${currentRound()}_${cat}`}
function sectionSubmitted(cat=currentCategory){return localStorage.getItem(sectionSubmissionKey(cat))==='1'}
function setSectionSubmitted(cat,v=true){const k=sectionSubmissionKey(cat);if(v)localStorage.setItem(k,'1');else localStorage.removeItem(k)}
function isLocked(item){const e=savedEntry(item);return sectionSubmitted(currentCategory) || decisionsSubmitted() || !!(item.lockAfterPurchase&&e&&Number(e.round)<currentRound())}
function cycleDecisionsLocked(){return decisionsSubmitted()}
function decisionEditingBlocked(){if(decisionsSubmitted()){toast('Todas las decisiones de este ciclo ya fueron enviadas. Podrás modificarlas cuando comience el próximo ciclo.');return true}if(sectionSubmitted(currentCategory)){toast('Esta sección ya fue enviada y está bloqueada hasta el próximo ciclo.');return true}return false}
function itemRequired(item){
  if(item?.id==='MOLDE')return ownedMolds().length===0;
  if(item?.requiredWhenProduction){const plan=productionPlan();return plan.target>0&&(plan.materials.find(material=>material.id===item.id)?.shortfall??0)>0;}
  return item?.required===true;
}
function itemComplete(item){
  if(item.type==='info')return true;
  const e=savedEntry(item); if(!e)return false;
  if(item.recurring&&Number(e.round)!==currentRound())return false;
  if(item.asset&&e.purchases)return Object.values(e.purchases).some(r=>Object.values(r||{}).some(q=>Number(q)>0));
  if(item.type==='production-plan')return (e.moldTargets?Object.values(e.moldTargets).reduce((total,value)=>total+Number(value||0),0):Number(e.value||0))>=Number(item.min||0);
  if(item.type==='number')return Number(e.value)>=Number(item.min||0);
  if(item.type==='loan')return e.amount!==undefined;
  if(item.type==='sales-staff')return true;
  if(item.type==='multi-choice')return (e.optionIds||[]).length>=Number(item.minSelections||1);
  return (e.optionIds||[]).length>0 || Object.values(e.quantities||{}).some(q=>Number(q)>0);
}
function getOwned(item,optId){
  const purchases=window.SIDE_PRODUCTION_MODEL.assetPurchaseHistory(savedEntry(item),item);
  return Object.entries(purchases).reduce((s,[round,row])=>s+(Number(round)<currentRound()?(Number(row?.[optId])||0):0),0);
}
function currentPurchase(item,optId){return Number(window.SIDE_PRODUCTION_MODEL.assetPurchaseHistory(savedEntry(item),item)[currentRound()]?.[optId]||0)}
function ownedMolds(){
  const item=findDecisionItem('MOLDE'),e=savedEntry(item),owned=[];
  for(const [round,row] of Object.entries(e?.purchases||{})){
    if(Number(round)>=currentRound())continue;
    for(const [id,q] of Object.entries(row||{}))if(Number(q)>0&&!owned.some(x=>x.id===id))owned.push({id,round:Number(round)});
  }
  if(!owned.length&&e&&Number(e.round)<currentRound())for(const id of e.optionIds||[])if(item.options.some(option=>option.id===id))owned.push({id,round:Number(e.round)});
  return owned;
}
function nonnegativeDecisionNumber(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,number):0;}
function normalizeDecisionDraft(item,draft){
  const mapValues=values=>Object.fromEntries(Object.entries(values||{}).map(([key,value])=>[key,value===''?'':nonnegativeDecisionNumber(value)]));
  if(draft.quantities)draft.quantities=mapValues(draft.quantities);
  if(item.id==='MOLDE'&&item.type==='choice'&&draft.optionIds)draft.optionIds=draft.optionIds.filter(id=>item.options.some(option=>option.id===id)).slice(0,1);
  if(['PERS_ENSAMBLE','PERS_ACABADO'].includes(item.id))delete draft.assignments;
  if(item.type==='production-plan')draft.prices=normalizedProductionPrices(draft.prices);
  if(draft.moldTargets)draft.moldTargets=mapValues(draft.moldTargets);
  if(draft.staff)draft.staff=mapValues(draft.staff);
  for(const key of ['value','amount'])if(Object.hasOwn(draft,key)&&draft[key]!=='')draft[key]=nonnegativeDecisionNumber(draft[key]);
  return draft;
}
function initDraft(item){return normalizeDecisionDraft(item,createDecisionDraft(item));}
function createDecisionDraft(item){
  if(decisionDrafts[item.id]){
    return decisionDrafts[item.id];
  }
  const e=savedEntry(item),sameRound=Number(e?.round)===currentRound();
  if(item.asset){const quantities={};item.options.forEach(o=>quantities[o.id]=currentPurchase(item,o.id));return decisionDrafts[item.id]={quantities}}
  if(item.type==='quantity'||item.type==='quantity-choice'){const quantities={};item.options.forEach(o=>quantities[o.id]=Number(sameRound?e.quantities?.[o.id]||0:0));return decisionDrafts[item.id]={quantities}}
  if(item.type==='production-plan'){
    const moldTargets=window.SIDE_PRODUCTION_MODEL.resolveProductionTargets({state:decisionState,drafts:decisionDrafts,round:currentRound()});
    return decisionDrafts[item.id]={moldTargets,prices:normalizedProductionPrices(e?.prices)};
  }
  if(item.type==='number')return decisionDrafts[item.id]={value:item.id==='INV_MARKETING'?window.SIDE_BUSINESS_RULES.advertising({state:sameRound?decisionState:{}}):Number(sameRound?e.value:0)};
  if(item.id==='MOLDE')return decisionDrafts[item.id]={optionIds:sameRound?(e.optionIds||[]):[]};
  if(item.type==='loan')return decisionDrafts[item.id]={amount:Number(sameRound?e.amount:0)};
  if(item.type==='sales-staff')return decisionDrafts[item.id]={staff:deepClone(sameRound?e.staff:{})};
  if(item.id==='CANALES'){
    const optionIds=(e?.optionIds||[]).slice(),quantities={};
    RULES.STORE_IDS.forEach(id=>{if(optionIds.includes(id))quantities[id]=RULES.storeQuantity(e,id)});
    return decisionDrafts[item.id]={optionIds,quantities,...(sameRound&&e.transfers?{transfers:deepClone(e.transfers)}:{})};
  }
  const ids=(e?.optionIds||item.defaultOptionIds||[]).slice();return decisionDrafts[item.id]={optionIds:ids};
}
function selectedOptionIds(item){return initDraft(item).optionIds||[]}
function analystSelected(){const item=findDecisionItem('ANALISTA_COMPRAS');return selectedOptionIds(item).includes('si_analista')}
function analystDiscount(){return analystSelected()?Math.max(2,12-(currentRound()-1)*2):0}
function optionUnitCost(item,opt){return window.SIDE_REVIEW_MODEL.unitCost(item,opt,decisionModelContext())}
function currentProductionTarget(){return Object.values(initDraft(findDecisionItem('PRODUCCION_META')).moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)}
function productionPlan(){return window.SIDE_PRODUCTION_MODEL.calculate(decisionModelContext())}
function materialYieldLabel(itemId,optionId){
  const amount=window.SIDE_PRODUCTION_MODEL.yieldFor(itemId,optionId),unit=window.SIDE_PRODUCTION_MODEL.materialUnit(itemId);
  return amount?`Cada compra aporta ${amount.toLocaleString('es-PE')} ${unit}`:'';
}
function districtDemand(id){const c=teacherConfig();return id==='los_olivos'?Number(c.demandLosOlivos??1000):id==='miraflores'?Number(c.demandMiraflores??1250):id==='sjl'?Number(c.demandSJL??1100):0}
function chosenStores(){const item=findDecisionItem('CANALES');return selectedOptionIds(item).map(id=>item.options.find(o=>o.id===id)).filter(o=>o?.channel==='store')}
function channelDraft(){
  const item=findDecisionItem('CANALES'),d=initDraft(item);
  d.quantities=d.quantities||{};
  RULES.STORE_IDS.forEach(id=>{if((d.optionIds||[]).includes(id))d.quantities[id]=RULES.storeQuantity(d,id)});
  return d;
}
function storeMinimum(id){return RULES.committedQuantity(savedEntry(findDecisionItem('CANALES')),id,currentRound())}
function renderChannelChoices(item,locked){
  const d=channelDraft();
  return `<div class="choice-strip checkbox-options store-channel-grid">${item.options.map(option=>{
    const id=option.id,selected=(d.optionIds||[]).includes(id),physical=option.channel==='store';
    const remaining=optionCommitRemaining(item,id),disabled=locked||(physical&&storeMinimum(id)>0);
    return `<div class="store-channel-card ${selected?'selected':''}" data-channel-card="${id}">
      <label class="choice-pill ${selected?'selected':''} ${disabled?'fixed-choice':''}">
        <input data-choice="CANALES" data-option="${id}" type="checkbox" name="decision-channels" ${selected?'checked':''} ${disabled?'disabled':''}>
        <span class="choice-check"></span><strong>${escapeHtml(option.label)}</strong>
        <em>${money(optionUnitCost(item,option))}${physical?' <span class="store-unit-caption">/ ciclo</span>':''}</em>
        <p>${escapeHtml(option.desc)}</p>
        ${remaining?`<span class="lock-note">Compromiso vigente: ${remaining} ciclo(s)</span>`:''}
      </label>
    </div>`;
  }).join('')}</div><div class="micro-caption">Puedes seleccionar varias tiendas físicas en los distritos disponibles y activar también el canal web. Cada tienda incluye un vendedor básico.</div>`;
}
function validateChannelQuantities(){
  const d=channelDraft(),previous=savedEntry(findDecisionItem('CANALES'));
  for(const id of RULES.STORE_IDS){
    if(RULES.storeQuantity(d,id)<RULES.committedQuantity(previous,id,currentRound())){toast('Debes mantener las tiendas con contrato vigente.');return false}
  }
  return true;
}
function creditPercent(){const base=Number(teacherConfig().creditPercentStart??20);return Math.min(70,base+(currentRound()-1)*5+(analystSelected()?5:0))}
function recurringAlreadyPrevious(item){const e=savedEntry(item);return e&&Number(e.round)<currentRound()}
function priorQuantity(item,optId){const e=savedEntry(item);if(!e)return 0;return Number(Number(e.round)===currentRound()?e.previousQuantities?.[optId]||0:e.quantities?.[optId]||0)}
function severanceForItem(item){
  if(!item.severanceEligible)return 0;
  const d=initDraft(item);
  return (item.options||[]).reduce((sum,o)=>{
    const prev=priorQuantity(item,o.id),now=Number(d.quantities?.[o.id]||0);
    return now<prev?sum+(prev-now)*optionUnitCost(item,o)*SEVERANCE_RATE:sum;
  },0);
}
function optionCommitRemaining(item,optId){
  if(item.id==='CANALES'&&RULES.STORE_IDS.includes(optId))return RULES.remainingCommitment(savedEntry(item),optId,currentRound());
  const opt=(item.options||[]).find(o=>o.id===optId);
  if(!opt?.minCommitCycles)return 0;
  const e=savedEntry(item),firstRound=e?.optionRounds?.[optId];
  if(firstRound===undefined)return 0;
  return Math.max(0,Number(opt.minCommitCycles)-(currentRound()-Number(firstRound)));
}

function historicalQuantities(){
  const out={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i); if(!key?.startsWith(`SIDE_DECISION_RECEIPTS_${storageKey()}_`))continue;
    try{const receipt=JSON.parse(localStorage.getItem(key)||'{}')||{};for(const section of Object.values(receipt))for(const item of section?.items||[]){
      if(!['quantity','quantity-choice'].includes(item.type)||item.asset)continue;
      const dst=out[item.id]||(out[item.id]={});
      for(const row of item.rows||[])if(row.quantity!=null){
        const label=String(row.label||''); const def=findDecisionItem(item.id); const opt=def?.options?.find(o=>o.label===label); if(opt)dst[opt.id]=(dst[opt.id]||0)+Number(row.quantity)||0;
      }
    }}catch{}
  }
  return out;
}
function decisionModelContext(){
  const drafts={};allDecisionItems().forEach(item=>{drafts[item.id]=deepClone(initDraft(item))});
  const config=teacherConfig(),state=config.materialRulesVersion==='receipts-v1'?{...decisionState,__materialOrders:validStudentMaterialBook()}:decisionState;
  return {catalog:DECISION_CATALOG,state,drafts: drafts,round:currentRound(),config,rules:RULES,
    capital:initialCapital(),ledger:financialLedger(),workingDays:WORKING_DAYS_PER_MONTH,severanceRate:SEVERANCE_RATE,liquidationRate:LIQUIDATION_RATE_DEFAULT,
    creditOutstanding:creditOutstanding(),creditApprovedLine:creditApprovedLine(),creditAvailable:creditAvailable(),historyQuantities:historicalQuantities()};
}
function computeItemCost(item){
  const detail=window.SIDE_REVIEW_MODEL.breakdown(item,decisionModelContext());
  return detail.outflow-detail.assetIncome;
}
function categoryDraftNet(cat){
  const category=categoryByCat(cat);if(!category)return 0;
  let cost=0,loan=0;
  category.items.forEach(item=>{if(item.type==='loan')loan+=Number(initDraft(item).amount||0);else cost+=computeItemCost(item)});
  return loan-cost;
}
function projectedCash(){const old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0);return initialCapital()+ledgerTotal()-old+categoryDraftNet(currentCategory)}

function openDecisionMenu(){
  const access=studentAccess();if(!access.canOperate&&!access.canReview){showScreen('studentLobby');updateIntegrationUI();toast(access.reason);return false;}

  loadDecisionState();
  if(typeof ensureCycleFixedCosts==='function')ensureCycleFixedCosts();
  playerIsDeciding=true; currentCategory=currentCategory||navigationCategories()[0]?.cat; restoreDraftsForRound(); showScreen('decisionMenu');
  updateDecisionReturnButton();
  renderTabs(); renderDecisionCategory(); updateHud(); syncStudentReportPreview();
  updateDecisionLayout();
  if(typeof maybeShowCycleCostNotice==='function')maybeShowCycleCostNotice();
}
function updateDecisionLayout(){
  const screen=$('decisionMenu');
  if(!screen||screen.classList.contains('hidden'))return;
  let fixedHeight=0;
  [['decisionTopbar','top'],['decisionTabs','tabs'],['decisionStickyHead','head']].forEach(([id,name])=>{
    const height=$(id)?.getBoundingClientRect().height||0;
    screen.style.setProperty(`--decision-${name}-height`,`${height}px`);fixedHeight+=height;
  });
  screen.style.setProperty('--decision-fixed-height',`${fixedHeight}px`);
  const scroller=$('decisionFormScroll');
  if(scroller)screen.style.setProperty('--decision-content-top',`${scroller.getBoundingClientRect().top-screen.getBoundingClientRect().top}px`);
}
const decisionLayoutObserver=new ResizeObserver(updateDecisionLayout);
[$('decisionTopbar'),$('decisionTabs'),$('decisionStickyHead')].filter(Boolean).forEach(el=>decisionLayoutObserver.observe(el));
window.addEventListener('resize',updateDecisionLayout);
document.fonts?.ready.then(updateDecisionLayout);
function scrollDecisionContentToTop(){const scroller=$('decisionFormScroll');if(scroller)scroller.scrollTop=0;}
function renderTabs(){
  const nav=$('decisionTabs');
  nav.innerHTML=navigationCategories().map(c=>{const sent=!c.summaryOnly&&sectionSubmitted(c.cat),saved=!c.summaryOnly&&categoryHasSaved(c.cat);return `<button class="decision-tab ${c.cat===currentCategory?'active':''} ${sent?'section-sent':''}" data-cat="${c.cat}"><img src="${escapeHtml(c.icon)}" alt=""><span class="tab-label">${escapeHtml(c.short||c.title)}</span>${sent?'<b class="tab-status">✓ ENVIADA</b>':saved?'<b class="tab-status">BORRADOR</b>':''}</button>`}).join('');
  updateDecisionLayout();
  nav.querySelectorAll('.decision-tab').forEach(b=>b.addEventListener('click',()=>{currentCategory=b.dataset.cat;renderTabs();renderDecisionCategory();scrollDecisionContentToTop();nav.querySelector('.decision-tab.active')?.focus({preventScroll:true});}));
}
function categoryHasSaved(cat){const c=categoryByCat(cat);const req=c.items.filter(itemRequired);return req.length?req.every(itemComplete):c.items.filter(i=>i.type!=='info').some(itemComplete)}
function draftItemComplete(item){
  if(item.type==='info')return true;
  if(item.lockAfterPurchase&&itemComplete(item))return true;
  const d=initDraft(item);
  if(item.type==='production-plan')return Object.values(d.moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)>=Number(item.min||0);
  if(item.type==='number')return d.value!==''&&Number(d.value)>=Number(item.min||0);
  if(item.type==='loan')return d.amount!==undefined;
  if(item.type==='sales-staff')return true;
  if(item.type==='multi-choice')return (d.optionIds||[]).length>=Number(item.minSelections||1);
  if(item.type==='choice')return (d.optionIds||[]).length>0;
  if(item.type==='quantity'||item.type==='quantity-choice'||item.asset)return Object.values(d.quantities||{}).some(q=>Number(q)>0)||itemComplete(item);
  return true;
}
function sectionDraftReady(cat=currentCategory){const c=categoryByCat(cat);if(!c)return false;return c.items.filter(i=>i.type!=='info'&&itemRequired(i)).every(draftItemComplete)}
function sectionReady(cat=currentCategory){return sectionDraftReady(cat)}
function eventHint(){const ev=activeStudentEvents()[0];if(ev)return `${ev.title}: ${ev.implication}`;return 'No hay un evento activo confirmado para esta empresa en este ciclo.'}
function stationStats(itemId){
  const item=findDecisionItem(itemId);
  let count=0,capacity=0,buying=0;
  (item?.options||[]).forEach(o=>{
    const previous=getOwned(item,o.id),draftQty=Number(initDraft(item).quantities?.[o.id]||0);
    const total=Math.max(0,previous+draftQty);
    count+=total; capacity+=total*Number(o.dailyCapacity||0);
    if(draftQty>0)buying+=draftQty;
  });
  return {count,capacity,buying};
}
let disposeProductionDop=()=>{};
function productionDopHtml(plan=productionPlan()){
  return window.SIDE_PRODUCTION_DOP.render(plan,{round:currentRound(),producedPercent:plan.comparison?.compliancePercent??null});
}
function calculatorMoldLine(plan,draft){
  return plan.productLines.find(line=>line.id===draft.viewMoldId)||plan.productLines.find(line=>line.target>0)||plan.productLines.find(line=>line.available)||plan.productLines[0];
}
function defaultSegmentPrices(){return Object.fromEntries(Object.entries(window.SIDE_ECONOMIC_CONFIG.segments).map(([id,segment])=>[id,segment.defaultPrice]));}
function normalizedProductionPrices(prices={}){
  return Object.fromEntries(Object.entries(window.SIDE_ECONOMIC_CONFIG.segments).map(([id,segment])=>{const raw=prices?.[id],value=Number(raw);return [id,raw!==''&&raw!=null&&Number.isFinite(value)&&value>=segment.min&&value<=(segment.max??Infinity)?value:segment.defaultPrice];}));
}
function productionCalculatorHtml(plan,draft,locked){
  const line=calculatorMoldLine(plan,draft);draft.viewMoldId=line.id;
  return `<div class="production-calculator production-calculator-single"><header><div><strong>¿Cuánto deseas producir?</strong><p>Indica tu meta por molde y organiza los materiales, el personal y los equipos para producirla.</p></div><div class="production-total"><small>Meta total de todos los moldes</small><b data-production-total role="status" aria-live="polite" aria-atomic="true">${plan.target.toLocaleString('es-PE')} u.</b></div></header><div class="production-calculator-fields"><div class="production-calculator-quantity"><label for="production-${line.id}">Cantidad deseada con este molde</label><div class="mold-target-control"><button type="button" data-mold-step="${line.id}" data-delta="-10" aria-label="Reducir diez unidades" ${locked?'disabled':''}>−10</button><input id="production-${line.id}" data-mold-target="${line.id}" aria-describedby="productionPlanningHint" type="number" inputmode="numeric" min="0" step="1" value="${line.target}" ${locked?'disabled':''}><button type="button" data-mold-step="${line.id}" data-delta="10" aria-label="Agregar diez unidades" ${locked?'disabled':''}>+10</button><span>unidades</span></div></div><label for="productionMoldSelector">Molde a calcular<select id="productionMoldSelector" data-production-mold ${locked?'disabled':''}>${plan.productLines.map(entry=>`<option value="${entry.id}" ${entry.id===line.id?'selected':''}>${escapeHtml(entry.label)}</option>`).join('')}</select></label><p id="productionPlanningHint" class="production-calculator-reading" data-production-planning-hint>Requisitos para la cantidad indicada. Cambia de molde para revisar otra meta; las cantidades anteriores se conservan.</p><div class="mold-requirements" data-mold-requirements aria-live="polite" aria-atomic="true">${productionCalculatorRequirements(line)}</div></div><footer><small>La calculadora no realiza compras ni cambia tus recursos. Consulta los insumos necesarios y la capacidad de tu línea de producción.</small></footer></div>`;
}
function productionCalculatorRequirements(line){return `<span>${line.available?'Molde disponible':'Molde no adquirido: no se producirán unidades con este molde.'}</span><span>Insumos para ${line.target.toLocaleString('es-PE')} unidades de ${escapeHtml(line.label)}</span><b>Cuero: ${line.requirements.CUERO.toLocaleString('es-PE')} m²</b><b>Accesorios: ${line.requirements.ACCESORIOS.toLocaleString('es-PE')} u.</b><b>Hilo: ${line.requirements.HILO.toLocaleString('es-PE')} m</b>`;}
function normalizeProductionTargetInput(input){const value=input.value===''?'':Math.max(0,Math.trunc(Number(input.value)||0));if(input.value!=='')input.value=String(value);return value;}
function refreshProductionCalculator(plan){
  const calculator=document.querySelector('.production-calculator-single');if(!calculator)return;
  const line=calculatorMoldLine(plan,initDraft(findDecisionItem('PRODUCCION_META')));
  calculator.querySelector('[data-production-total]').textContent=plan.target.toLocaleString('es-PE')+' u.';
  calculator.querySelector('[data-mold-requirements]').innerHTML=productionCalculatorRequirements(line);
}
// Calculator and diagram read the same working draft after each control updates it.
function refreshProductionDop(){
  if(currentCategory!=='C')return;
  const plan=productionPlan();refreshProductionCalculator(plan);
  const mount=document.querySelector('.production-dop-mount');
  if(!mount)return;
  disposeProductionDop();mount.innerHTML=productionDopHtml(plan);
  disposeProductionDop=window.SIDE_PRODUCTION_DOP.mount(mount);
}

function renderDecisionCategory(){
  disposeProductionDop();
  const cat=categoryByCat(currentCategory)||DECISION_CATALOG[0];currentCategory=cat.cat;
  $('categoryTitle').textContent=cat.title;$('categoryDescription').textContent=cat.desc;$('detailCategoryIcon').src=cat.icon;$('roundLabel').textContent=`CICLO ${currentRound()} · ${currentStudent.company}`;
  if(temporalStudentRoom()&&!validStudentMaterialBook()){$('decisionCards').innerHTML=`<p role="status">${escapeHtml(studentMaterialStatus)}</p>`;return;}
  const items=cat.items.filter(item=>!(item.lockAfterPurchase&&isLocked(item)));
  const cardItems=items.filter(i=>!i.displayAsAsterisk),footnoteItems=items.filter(i=>i.displayAsAsterisk);
  let lead=cat.summaryOnly?'':`<div class="event-clue"><span>NOTICIA / CONTEXTO</span><strong>${escapeHtml(eventHint())}</strong><small>Los eventos aplicados aparecen en el resumen financiero.</small></div>`;
  if(temporalStudentRoom())lead+=window.SIDE_MATERIAL_PREVIEW.html(validStudentMaterialBook(),productionPlan());
  {
    const fixed=allDecisionItems().filter(item=>item.mandatoryFixed);
    lead+=`<aside class="event-clue" aria-label="Costos obligatorios previstos"><span>COSTOS OBLIGATORIOS PREVISTOS</span><strong>${fixed.map(item=>`${escapeHtml(item.name)}: − ${money(computeItemCost(item))}`).join(' · ')}</strong><small>Caja inicial del ciclo: ${money(financialReport().balanceCaja.cajaInicial)}. Los costos registrados al inicio ya están incluidos en tu caja; guardar después no los cobra otra vez.</small></aside>`;
  }
  if(cat.cat==='D')lead+=`<div class="required-alert"><strong>Canal de ventas obligatorio</strong><span>Debes marcar al menos un canal para poder enviar tus decisiones.</span></div>`;
  const totalCycles=Number(teacherConfig().cycles);
  if(totalCycles>0&&currentRound()>=Math.max(1,totalCycles-1)&&currentRound()<=totalCycles)lead+=`<aside class="event-clue" role="note"><strong>Impuesto a la renta</strong><small>En el ciclo ${totalCycles} se descontará el impuesto a la renta sobre tu utilidad acumulada.</small></aside>`;
  if(['B','D','F'].includes(cat.cat)&&window.SIDE_REVIEW_MODEL){
    const warnings=window.SIDE_REVIEW_MODEL.warnings(decisionModelContext()).filter(w=>w.cat===cat.cat);
    if(warnings.length)lead+=`<aside class="required-alert" role="status"><strong>Revisa la producción antes de enviar</strong>${warnings.map(w=>`<span>${escapeHtml(w.text)}</span>`).join('')}</aside>`;
  }

  const footnotes=footnoteItems.length?`<div class="asterisk-notes">${footnoteItems.map(i=>`<p class="asterisk-note">* ${escapeHtml(i.desc)}</p>`).join('')}</div>`:'';
  const cards=cat.cat==='C'?renderDecisionRow(cardItems.find(item=>item.id==='PRODUCCION_META'))+`<div class="production-dop-mount">${productionDopHtml()}</div>`+cardItems.filter(item=>item.id!=='PRODUCCION_META').map(renderDecisionRow).join(''):cardItems.map(renderDecisionRow).join('');
  $('decisionCards').innerHTML=lead+cards+footnotes+(cat.cat==='D'?manualDistributionHtml()+cycleSalesHtml():'')+(cat.cat==='A'?'<div id="companySummaryMount"></div>':'');
  document.querySelector('.section-save-bar')?.classList.toggle('hidden',!!cat.summaryOnly);
  bindDecisionControls(); updateHud(); updateSectionCost(); syncStudentTimer(); updateDecisionLayout();
  disposeProductionDop=window.SIDE_PRODUCTION_DOP.mount(document.querySelector('.production-dop-mount'));
}
function manualDistributionData(){
  const channels=channelDraft(),plan=productionPlan(),points=window.SIDE_ECONOMIC_CLOSURE.points({CANALES:channels}),ids=['esencial','urbano','premium'];
  return ids.map((id,i)=>{const locations=decisionState.__storeInventory?.[id]||{},held=Object.values(locations).reduce((a,v)=>a+Math.max(0,Number(v)||0),0),total=Math.max(0,Number(decisionState.__finishedGoods?.[id]||0))+Number(plan.productLines?.[i]?.plannedUnits||0);return {id,points,locations,central:Math.max(0,Math.floor(total-held)),assigned:Object.values(channels.transfers?.[id]||{}).reduce((a,v)=>a+Math.max(0,Number(v)||0),0)};});
}
function manualPointLabel(id){
  if(id==='web')return 'Canal web';
  const [optionId,number]=String(id).split(':');
  const option=findDecisionItem('CANALES')?.options?.find(row=>row.id===optionId);
  return option?`${option.label} · tienda ${number||'1'}`:String(id);
}
function manualDistributionHtml(){
  const d=channelDraft(),enabled=!!d.transfers,locked=cycleDecisionsLocked()||sectionSubmitted('D')||decisionsSubmitted(),labels={esencial:'Económico',urbano:'Medio',premium:'Premium'};
  const rows=manualDistributionData();
  return `<section class="decision-row"><h3>Distribución a puntos de venta</h3><p>La distribución automática cubre la demanda prevista. Activa la asignación manual para decidir cuánto sale del almacén a cada punto.</p><label><input type="checkbox" data-transfer-mode ${enabled?'checked':''} ${locked?'disabled':''}> Usar distribución manual</label>${enabled?rows.map(r=>`<div class="quantity-option"><strong>${labels[r.id]} · almacén disponible ${r.central} · asignado ${r.assigned}</strong>${r.assigned>r.central?'<p role="alert">La asignación supera el stock disponible.</p>':''}${r.points.map(p=>`<label>${escapeHtml(manualPointLabel(p.id))} · stock actual ${Number(r.locations[p.id]||0)} <input type="number" min="0" step="1" data-transfer-product="${r.id}" data-transfer-point="${escapeHtml(p.id)}" value="${Number(d.transfers?.[r.id]?.[p.id]||0)}" ${locked?'disabled':''}></label>`).join('')||'<p>Selecciona primero una tienda o canal web.</p>'}</div>`).join(''):''}</section>`;
}
function renderDecisionRow(item){
  const locked=isLocked(item)||cycleDecisionsLocked(),saved=itemComplete(item),cost=computeItemCost(item),d=initDraft(item),required=itemRequired(item);
  let body='';
  if(item.id==='CANALES'){
    body=renderChannelChoices(item,locked);
  } else if(item.id==='MOLDE'){
    const owned=ownedMolds(),ownedIds=owned.map(x=>x.id),selected=(d.optionIds||[])[0]||'';
    body=`<div class="choice-strip radio-options">${item.options.map(o=>{const already=ownedIds.includes(o.id),isSelected=selected===o.id&&!already;const disabled=locked||already;return `<label class="choice-pill ${isSelected?'selected':''} ${disabled?'fixed-choice':''}"><input data-choice="${item.id}" data-option="${o.id}" type="radio" name="decision-${item.id}" ${isSelected?'checked':''} ${disabled?'disabled':''}><span class="choice-check"></span><strong>${escapeHtml(o.label)}</strong><em>${money(optionUnitCost(item,o))}</em><p>${escapeHtml(o.desc)}</p>${already?'<span class="owned-badge">YA TIENES ESTE MOLDE · NO SE VUELVE A COMPRAR</span>':isSelected?'<span class="buying-badge">MOLDE ELEGIDO EN INFRAESTRUCTURA</span>':''}</label>`}).join('')}</div><div class="mandatory-note">Por reglamento debes adquirir al menos un molde antes de enviar el ciclo. Los moldes comprados permanecen disponibles y cada tipo se paga una sola vez.</div><div class="mold-owned-list"><strong>MOLDES DISPONIBLES</strong>${owned.length?owned.map(x=>{const o=item.options.find(v=>v.id===x.id);return `<span>${escapeHtml(o?.label||x.id)}</span>`}).join(''):'<span>Ninguno de ciclos anteriores</span>'}${selected?`<span>Elegido ahora: ${escapeHtml(item.options.find(o=>o.id===selected)?.label||selected)}</span>`:''}</div>`;
  } else if(item.type==='choice'||item.type==='multi-choice'){
    const multi=item.type==='multi-choice';
    body=`<div class="choice-strip ${multi?'checkbox-options':'radio-options'}">${item.options.map(o=>{const selected=(d.optionIds||[]).includes(o.id);const extra=o.district?`<small>Demanda base: ${districtDemand(o.id).toLocaleString('es-PE')} u./ciclo</small>`:'';const commitRemaining=multi?optionCommitRemaining(item,o.id):0;const disabled=locked||item.mandatoryFixed||(selected&&commitRemaining>0);const showPrice=item.showPrice!==false;const lockNote=commitRemaining>0?`<span class="lock-note">🔒 Compromiso vigente: ${commitRemaining} ciclo(s) más antes de poder retirarlo</span>`:'';return `<label class="choice-pill ${selected?'selected':''} ${disabled?'fixed-choice':''}"><input data-choice="${item.id}" data-option="${o.id}" type="${multi?'checkbox':'radio'}" name="decision-${item.id}" ${selected?'checked':''} ${disabled?'disabled':''}><span class="choice-check"></span><strong>${escapeHtml(o.label)}</strong>${showPrice?`<em>${money(optionUnitCost(item,o))}</em>`:''}<p>${escapeHtml(o.desc)}</p>${extra}${lockNote}</label>`}).join('')}</div>${multi?'<div class="micro-caption">Casillas: puedes seleccionar una o varias opciones.</div>':`<div class="micro-caption">${!required&&!item.mandatoryFixed?'Selecciona una alternativa; vuelve a pulsarla para dejarla sin selección.':'Botón de opción: solo puedes seleccionar una alternativa.'}</div>`}${item.mandatoryFixed?'<div class="mandatory-note">Este costo es obligatorio y permanece marcado durante la simulación.</div>':''}`;
  } else if(item.type==='quantity'||item.type==='quantity-choice'){
    body=`<div class="quantity-grid">${item.options.map(o=>{const q=Number(d.quantities?.[o.id]||0),owned=item.asset?getOwned(item,o.id):0;const floor=0;const sellValue=q<0?Math.abs(q)*Number(o.cost)*Number(o.liquidationRate??LIQUIDATION_RATE_DEFAULT):0;const prevHeadcount=item.severanceEligible?priorQuantity(item,o.id):0;const severance=item.severanceEligible&&q<prevHeadcount?(prevHeadcount-q)*optionUnitCost(item,o)*SEVERANCE_RATE:0;return `<div class="quantity-option"><div class="quantity-copy"><strong>${escapeHtml(o.label)}</strong><p>${escapeHtml(o.desc)}</p><small>${money(optionUnitCost(item,o))} ${item.material?'por '+escapeHtml(window.SIDE_PRODUCTION_MODEL.materialUnit(item.id)):'c/u'}${item.material&&analystDiscount()?` · −${analystDiscount()}% negociado`:''}</small>${item.asset?`<span class="owned-badge">YA TIENES: ${owned}</span>${q>0?`<span class="buying-badge">VAS A COMPRAR: ${q}</span>`:q<0?`<span class="selling-badge">VAS A VENDER (LIQUIDAR): ${Math.abs(q)} · recuperas ${money(sellValue)}</span>`:''}`:''}${item.material?`<span class="need-badge">${escapeHtml(materialYieldLabel(item.id,o.id))}</span>`:''}${severance>0?`<span class="severance-badge">DESPIDO: ${prevHeadcount-q} persona(s) · liquidación ${money(severance)}</span>`:''}</div><div class="stepper"><button data-step="${item.id}" data-option="${o.id}" data-delta="-1">−</button><input data-qty="${item.id}" data-option="${o.id}" aria-label="${escapeHtml(o.label)}: cantidad${item.material?' en '+escapeHtml(window.SIDE_PRODUCTION_MODEL.materialUnit(item.id)):''}" type="number" min="${floor}" step="${item.material?'0.01':'1'}" value="${q}"><button data-step="${item.id}" data-option="${o.id}" data-delta="1">+</button></div></div>`}).join('')}</div>${item.asset?'<div class="micro-caption">Ingresa cantidades iguales o mayores que cero.</div>':''}`;
  } else if(item.type==='production-plan'){
    body=productionCalculatorHtml(productionPlan(),d,locked);
  } else if(item.type==='number'){
    body=`<div class="number-decision"><button data-number-step="${item.id}" data-delta="-${item.step||1}">−${item.step||1}</button><input data-number="${item.id}" aria-label="${escapeHtml(item.name)}" type="number" min="${item.min||0}" ${item.max!=null?`max="${item.max}"`:''} step="${item.step||1}" value="${Number(d.value||0)}" ${locked?'disabled':''}><button data-number-step="${item.id}" data-delta="${item.step||1}">+${item.step||1}</button><span>${escapeHtml(item.unit||'')}</span></div><p class="micro-caption">${escapeHtml(item.desc||'')}</p>`;

  } else if(item.type==='sales-staff'){
    body=`<div class="info-decision"><strong>Personal automático por tienda</strong><p>Se asigna 1 vendedor básico a cada tienda física. La comisión es 1% de las ventas.</p></div>`;
  } else if(item.type==='loan'){
    const rate=Number(teacherConfig().interest??20),approved=creditApprovedLine(),available=creditAvailable(),amount=Math.min(available,Number(d.amount||0)),afterRequest=Math.max(0,available-amount);body=`<div class="loan-box"><div><span>TEA</span><strong>${rate.toFixed(1)}%</strong><small>Condición definida por el docente</small></div><div><span>LÍNEA APROBADA</span><strong>${money(approved)}</strong><small>${currentRound()===1?'70% de la caja inicial':'Se actualiza según caja y activos'}</small></div><div><span>LÍNEA DISPONIBLE</span><strong>${money(afterRequest)}</strong><small>Después de esta solicitud</small></div></div><div class="loan-control"><input data-loan="${item.id}" type="range" min="0" max="${available}" step="500" value="${amount}"><input data-loan-number="${item.id}" type="number" min="0" max="${available}" step="500" value="${amount}"><b>${money(amount)}</b></div><div class="micro-caption">La línea inicia en 70% de la caja. Al avanzar los ciclos puede aumentar o disminuir según la caja y los activos. Lo utilizado reduce la línea disponible.</div>`;
  } else if(item.type==='info'){
    let dynamic=item.id==='CREDITO_VENTAS'?`<strong>${creditPercent()}% de ventas a crédito</strong><small>${100-creditPercent()}% de ventas al contado</small>`:`<strong>Regla automática del juego</strong>`;if(item.id==='PERSONAL_VENTAS'){const n=RULES.storeCount(channelDraft());dynamic=`<strong data-basic-sales-staff>${n?`${n} vendedor(es) básico(s) · 1 por tienda · comisión total 1%`:'Sin tiendas físicas: no se asignan vendedores básicos.'}</strong>`;}body=`<div class="info-decision">${dynamic}<p>${escapeHtml(item.desc)}</p></div>`;
  }
  const costLabel=item.type==='loan'?'Financiamiento opcional':item.noCashEffect?'No afecta caja':cost>0?`${item.mandatoryFixed?'Costo obligatorio':'Costo actual'}: ${money(cost)}`:cost<0?`Ingreso por liquidación: ${money(Math.abs(cost))}`:'Sin salida de caja';
  const sent=sectionSubmitted(currentCategory)||decisionsSubmitted();
  return `<article class="decision-row ${saved?'saved':''} ${locked?'locked':''} ${required?'required-row':'optional-row'}" data-item="${item.id}"><div class="decision-row-head"><div><span class="row-state">${sent?'ENVIADA · BLOQUEADA':locked?'BLOQUEADA':saved?'GUARDADA':required?'OBLIGATORIA':'OPCIONAL'}</span><h3>${escapeHtml(item.name)}</h3>${item.desc?`<p>${escapeHtml(item.desc)}</p>`:''}</div><div class="row-cost">${costLabel}</div></div>${body}</article>`;
}
document.addEventListener('wheel',e=>{if(e.target?.matches?.('.number-decision input[type=number], .quantity-option input[type=number], [data-store-qty], [data-mold-target]')&&document.activeElement===e.target)e.preventDefault()},{passive:false});
// Captura antes de los editores: el valor visible y el borrador reciben lo mismo.
function studentNumberInput(input){return input?.matches?.('#decisionMenu input[type="number"], #simulator3d input[type="number"]');}
function normalizeStudentNumberInput(input,final=false){
  if(!studentNumberInput(input))return;
  if(!input.hasAttribute('min')||Number(input.min)<0)input.min='0';
  if(input.value===''&&!input.validity.badInput){if(final)input.value=String(Math.max(0,Number(input.min)||0));return;}
  if(input.validity.badInput||!Number.isFinite(input.valueAsNumber)||input.valueAsNumber<0)input.value='0';
}
document.addEventListener('keydown',event=>{if(studentNumberInput(event.target)&&['-','−'].includes(event.key))event.preventDefault();},true);
document.addEventListener('beforeinput',event=>{if(studentNumberInput(event.target)&&/[-−]/.test(event.data||''))event.preventDefault();},true);
document.addEventListener('paste',event=>{
  if(!studentNumberInput(event.target))return;
  const text=event.clipboardData?.getData('text')?.trim().replace(/−/g,'-');
  if(text?.startsWith('-')){event.preventDefault();event.target.value='0';event.target.dispatchEvent(new Event('input',{bubbles:true}));}
},true);
document.addEventListener('input',event=>normalizeStudentNumberInput(event.target),true);
document.addEventListener('change',event=>normalizeStudentNumberInput(event.target,true),true);
function bindDecisionControls(){
  document.querySelector('[data-transfer-mode]')?.addEventListener('change',event=>{if(decisionEditingBlocked())return;const d=channelDraft();if(event.target.checked)d.transfers={esencial:{},urbano:{},premium:{}};else delete d.transfers;persistCurrentDraftOnly();renderDecisionCategory();});
  document.querySelectorAll('[data-transfer-product]').forEach(input=>input.addEventListener('change',()=>{if(decisionEditingBlocked())return;const d=channelDraft(),product=input.dataset.transferProduct,point=input.dataset.transferPoint;d.transfers=d.transfers||{};d.transfers[product]=d.transfers[product]||{};d.transfers[product][point]=Math.max(0,Math.floor(Number(input.value)||0));persistCurrentDraftOnly();renderDecisionCategory();}));
  document.querySelectorAll('[data-choice]').forEach(input=>{
    input.addEventListener('click',event=>{
      const item=findDecisionItem(input.dataset.choice);
      if(item.type==='choice'&&!itemRequired(item)&&!item.mandatoryFixed&&!isLocked(item)&&selectedOptionIds(item).includes(input.dataset.option)){
        event.preventDefault();if(decisionEditingBlocked())return;
        initDraft(item).optionIds=[];persistCurrentDraftOnly();renderDecisionCategory();
      }
    });
    input.addEventListener('change',()=>{
      if(decisionEditingBlocked())return;
      const item=findDecisionItem(input.dataset.choice),id=input.dataset.option;
      if(item.mandatoryFixed){renderDecisionCategory();return}
      if(item.type==='multi-choice'&&!input.checked&&optionCommitRemaining(item,id)>0){toast('Este canal tiene tiendas con contrato vigente y no puede retirarse.');renderDecisionCategory();return}
      const d=initDraft(item);
      if(item.id==='CANALES'&&RULES.STORE_IDS.includes(id)){
        const set=new Set(d.optionIds||[]);input.checked?set.add(id):set.delete(id);d.optionIds=[...set];
        d.quantities=d.quantities||{};
        if(input.checked)d.quantities[id]=RULES.positiveInteger(d.quantities[id],1);else delete d.quantities[id];
      }else if(item.type==='multi-choice'){
        const set=new Set(d.optionIds||[]);input.checked?set.add(id):set.delete(id);d.optionIds=[...set];
      }else d.optionIds=[id];
      persistCurrentDraftOnly();renderDecisionCategory();
      const updated=document.querySelector(`[data-choice="${item.id}"][data-option="${id}"]`);
      updated?.focus({preventScroll:true});
    });
  });
  document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeQty(b.dataset.step,b.dataset.option,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-qty]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.qty),d=initDraft(item);d.quantities[i.dataset.option]=nonnegativeDecisionNumber(i.value);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.qty);refreshProductionDop()}));
  document.querySelectorAll('[data-production-mold]').forEach(select=>select.addEventListener('change',()=>{
    if(decisionEditingBlocked())return;
    const d=initDraft(findDecisionItem('PRODUCCION_META'));
    if(!productionPlan().productLines.some(line=>line.id===select.value))return;
    d.viewMoldId=select.value;persistCurrentDraftOnly();renderDecisionCategory();
    document.querySelector('[data-production-mold]')?.focus({preventScroll:true});
  }));
  document.querySelectorAll('[data-mold-step]').forEach(button=>button.addEventListener('click',()=>{
    if(decisionEditingBlocked())return;const item=findDecisionItem('PRODUCCION_META'),d=initDraft(item),id=button.dataset.moldStep;
    d.moldTargets[id]=Math.max(0,Math.trunc(Number(d.moldTargets[id]||0)+Number(button.dataset.delta)));persistCurrentDraftOnly();renderDecisionCategory();
    document.querySelector(`[data-mold-step="${id}"][data-delta="${button.dataset.delta}"]`)?.focus({preventScroll:true});
  }));
  document.querySelectorAll('[data-mold-target]').forEach(input=>{
    input.addEventListener('beforeinput',event=>{if(!/[-−]/.test(event.data||''))return;event.preventDefault();input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
    input.addEventListener('input',()=>{const value=normalizeProductionTargetInput(input);if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem('PRODUCCION_META'));d.moldTargets[input.dataset.moldTarget]=value;persistCurrentDraftOnly();updateHud();refreshProductionDop();});
    input.addEventListener('change',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem('PRODUCCION_META')),id=input.dataset.moldTarget;d.moldTargets[id]=Math.max(0,Math.trunc(Number(input.value)||0));input.value=String(d.moldTargets[id]);persistCurrentDraftOnly();updateHud();refreshProductionDop();});
  });
  document.querySelectorAll('[data-number-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(b.dataset.numberStep),d=initDraft(item);d.value=Math.min(item.max??Infinity,Math.max(Number(item.min||0),Number(d.value||0)+Number(b.dataset.delta)));persistCurrentDraftOnly();renderDecisionCategory()}));
  document.querySelectorAll('[data-number]').forEach(i=>{
    i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);const raw=i.value;d.value=raw===''?'':Math.min(item.max??Infinity,Math.max(Number(item.min||0),Number(raw)||0));persistCurrentDraftOnly();updateSectionCost();});
    i.addEventListener('change',()=>{if(decisionEditingBlocked())return;const item=findDecisionItem(i.dataset.number),d=initDraft(item);d.value=Math.min(item.max??Infinity,Math.max(Number(item.min||0),Number(i.value)||0));i.value=d.value;persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.number);});
  });
  document.querySelectorAll('[data-staff-step]').forEach(b=>b.addEventListener('click',()=>{if(decisionEditingBlocked())return;changeStaff(b.dataset.staffStep,b.dataset.store,Number(b.dataset.delta));persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-staff]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;const d=initDraft(findDecisionItem(i.dataset.staff));d.staff[i.dataset.store]=Math.max(0,Number(i.value)||0);persistCurrentDraftOnly();updateSectionCost();updateRowCost(i.dataset.staff);refreshProductionDop()}));
  document.querySelectorAll('[data-loan]').forEach(i=>i.addEventListener('input',()=>{if(decisionEditingBlocked())return;setLoan(i.dataset.loan,Number(i.value),true);persistCurrentDraftOnly();}));
  document.querySelectorAll('[data-loan-number]').forEach(i=>i.addEventListener('input',()=>{
    if(decisionEditingBlocked())return;
    const id=i.dataset.loanNumber;setLoan(id,Number(i.value),false);persistCurrentDraftOnly();
    const amount=Number(initDraft(findDecisionItem(id)).amount||0),range=document.querySelector(`[data-loan="${id}"]`),label=i.closest('.loan-control')?.querySelector('b');
    if(range)range.value=amount;if(label)label.textContent=money(amount);updateSectionCost();
  }));
}
function changeQty(itemId,optId,delta){const item=findDecisionItem(itemId),d=initDraft(item);d.quantities[optId]=nonnegativeDecisionNumber((Number(d.quantities[optId])||0)+delta);renderDecisionCategory()}
function changeStaff(itemId,store,delta){const item=findDecisionItem(itemId),d=initDraft(item);d.staff[store]=Math.max(0,(Number(d.staff[store])||0)+delta);renderDecisionCategory()}
function setLoan(itemId,value,rerender=false){const item=findDecisionItem(itemId),max=loanMaximum(),d=initDraft(item);d.amount=Math.max(0,Math.min(max,Number(value)||0));if(rerender)renderDecisionCategory()}
function updateRowCost(itemId){const row=document.querySelector(`[data-item="${itemId}"] .row-cost`),item=findDecisionItem(itemId);if(!row)return;const cost=computeItemCost(item);row.textContent=cost>0?`${item.mandatoryFixed?'Costo obligatorio':'Costo actual'}: ${money(cost)}`:cost<0?`Ingreso por liquidación: ${money(Math.abs(cost))}`:'Sin salida de caja'}
function updateSectionCost(){
  const locked=cycleDecisionsLocked()||sectionSubmitted(currentCategory);
  const net=categoryDraftNet(currentCategory),old=Number(cashLedger[sectionLedgerKey(currentCategory)]||0),delta=net-old,projected=projectedCash();
  $('sectionDraftCost').textContent=delta<0?`Gastado: ${money(Math.abs(delta))}`:delta>0?`Ingreso previsto: +${money(delta)}`:'Sin cambios pendientes';
  updateCashHud();
  $('sectionSaveHint').textContent=locked?'Decisiones enviadas: edición bloqueada hasta el próximo ciclo.':projected<0?'El gasto supera tu caja actual. Puedes guardar el borrador, pero no enviarlo hasta ajustar el presupuesto.':'Borrador local: guarda tus avances y envía el ciclo solo cuando estés seguro.';
  // El presupuesto puede impedir confirmar una decisión, pero nunca debe impedir
  // conservar el avance del jugador como borrador.
  $('saveDecisionSection').disabled=locked;
  if(currentCategory==='A'&&$('companySummaryMount'))renderCompanySummary();
  updateSectionSendButton();
}
function updateSectionSendButton(){
  const send=$('sendDecisionSection');if(!send)return;
  const category=categoryByCat(currentCategory),locked=cycleDecisionsLocked()||sectionSubmitted(currentCategory);
  const ready=!!category&&!category.summaryOnly&&sectionDraftReady(currentCategory),affordable=projectedCash()>=-0.005,access=studentAccess();
  send.disabled=locked||!ready||!affordable||!access.canOperate;
  send.classList.toggle('submitted',locked);
  send.querySelector('strong').textContent=locked?'DECISIÓN ENVIADA':'ENVIAR DECISIÓN';
  send.querySelector('small').textContent=locked?'Editable en el próximo ciclo':!access.canOperate?'Espera a que se habilite el ciclo':!ready?'Completa los datos obligatorios':!affordable?'Ajusta el presupuesto para enviar':'Confirmar; no editable en este ciclo';
}
function productionMaterialShortages(){
  if(!['C','F'].includes(currentCategory))return [];
  if(!currentProductionTarget())return [];
  return productionPlan().materials.filter(material=>material.shortfall>0).map(material=>({item:findDecisionItem(material.id),need:material.neededForTarget,total:material.available,missing:material.shortfall,unit:material.unit}));
}
function validateProductionMaterials(){return true;}
function warnProductionMaterialShortage(){
  const shortages=productionMaterialShortages();
  if(!shortages.length)return;
  const detail=shortages.map(x=>`${x.item.name}: faltan ${x.missing.toLocaleString('es-PE')} ${x.unit}`).join(' · ');
  toast(`Advertencia: tu producción supera los insumos comprados. ${detail}. Puedes continuar.`);
}
function validateRequiredSection(cat){
  if(cat.cat==='D'&&channelDraft().transfers){const rows=manualDistributionData(),invalid=rows.find(r=>r.assigned>r.central||Object.entries(channelDraft().transfers[r.id]||{}).some(([id,q])=>Number(q)>0&&!r.points.some(p=>p.id===id)));if(invalid){toast('Revisa la distribución: supera el stock o incluye un punto de venta inactivo.');return false;}}
  for(const item of cat.items){
    const preliminary=initDraft(item);
    if(item.type==='number'&&(!Number.isFinite(Number(preliminary.value))||Number(preliminary.value)<(item.min||0)||Number(preliminary.value)>(item.max??Infinity))){toast(`Revisa el importe de ${item.name}.`);return false;}
    if(!itemRequired(item)||item.type==='info'||(item.lockAfterPurchase&&isLocked(item)))continue;
    const d=initDraft(item);
    if(item.type==='choice'&&!(d.optionIds||[]).length){toast(`Debes completar: ${item.name}.`);return false}
    if(item.type==='multi-choice'&&(d.optionIds||[]).length<Number(item.minSelections||1)){toast(`Debes seleccionar al menos una opción en ${item.name}.`);return false}
    if(item.type==='production-plan'&&Object.values(d.moldTargets||{}).reduce((total,value)=>total+Number(value||0),0)<Number(item.min||0)){toast('Indica cuánto deseas producir en al menos uno de los tres moldes.');return false}
    if(item.type==='production-plan'){const plan=productionPlan();if(plan.unavailablePlannedMolds.length){const names=plan.productLines.filter(line=>plan.unavailablePlannedMolds.includes(line.id)).map(line=>line.label).join(', ');toast(`No puedes enviar esta meta: falta adquirir ${names}. Cambia la meta o compra el molde.`);return false;}}
    if(item.type==='number'&&Number(d.value)<Number(item.min||0)){toast(`${item.name} debe ser como mínimo ${item.min}.`);return false}
    if(item.requiredWhenProduction&&currentProductionTarget()>0){/* El faltante de insumos es una advertencia, no un bloqueo. */}
  }
  return true;
}
// Build entries before changing state so totals and severance are stable on re-save.
function prepareSectionSave(cat,context=decisionModelContext()){
  for(const item of cat.items)if(context.drafts[item.id])normalizeDecisionDraft(item,context.drafts[item.id]);
  const entries={},round=context.round,model=window.SIDE_REVIEW_MODEL.section(cat,context);
  cat.items.forEach(item=>{
    if(item.type==='info')return;
    const prev=decisionState[item.id],d=context.drafts[item.id]||{},detail=model.items.find(x=>x.id===item.id);
    if(item.lockAfterPurchase&&prev&&Number(prev.round)<round)return;
    const common={round,label:item.name,cost:detail.outflow-detail.assetIncome};
    if(item.asset){
      entries[item.id]={...deepClone(prev||{}),...common,purchases:{...deepClone(window.SIDE_PRODUCTION_MODEL.assetPurchaseHistory(prev,item)),[round]:deepClone(d.quantities||{})}};return;
    }
    if(item.type==='quantity'||item.type==='quantity-choice'){
      entries[item.id]={...common,quantities:deepClone(d.quantities||{})};
      if(item.severanceEligible)entries[item.id].previousQuantities=deepClone(Number(prev?.round)===round?prev?.previousQuantities||{}:prev?.quantities||{});
      return;
    }
    if(item.type==='production-plan'){
      const moldTargets=Object.fromEntries(Object.entries(d.moldTargets||{}).map(([id,value])=>[id,Math.max(0,Math.trunc(Number(value)||0))]));
      const value=Object.values(moldTargets).reduce((total,target)=>total+target,0);
      entries[item.id]={...common,moldTargets,prices:deepClone(d.prices||{}),value,label:`Producción deseada: ${value} unidades`};return;
    }
    if(item.type==='number'){entries[item.id]={...common,value:Number(d.value||0),label:`${item.name}: ${Number(d.value||0)} ${item.unit||''}`};return;}
    if(item.type==='sales-staff'){entries[item.id]={...common,staff:deepClone(d.staff||{})};return;}
    if(item.type==='loan'){entries[item.id]={...common,amount:Number(d.amount||0),label:`Línea de crédito utilizada: ${money(d.amount||0)}`};return;}
    if(item.id==='MOLDE'){
      const chosen=(d.optionIds||[]).find(id=>item.options.some(o=>o.id===id)&&!ownedMolds().some(x=>x.id===id))||null;
      const purchases=deepClone(prev?.purchases||{});
      delete purchases[round];
      if(chosen)purchases[round]={[chosen]:1};
      entries[item.id]={...common,optionIds:chosen?[chosen]:[],optionRounds:{...(prev?.optionRounds||{}),...(chosen?{[chosen]:round}:{})},purchases,label:chosen?item.options.find(o=>o.id===chosen)?.label:(prev?.label||'Sin compra nueva')};
      return;
    }
    const optionRounds={};(d.optionIds||[]).forEach(id=>{optionRounds[id]=prev?.optionRounds?.[id]??round});
    if(item.id==='CANALES'){
      const quantities={},storeContracts={};
      RULES.STORE_IDS.forEach(id=>{const q=RULES.storeQuantity(d,id);if(q){quantities[id]=q;storeContracts[id]=RULES.nextStoreBatches(prev,id,q,round);optionRounds[id]=Math.min(...storeContracts[id].map(b=>b.round));}});
      entries[item.id]={...common,optionIds:[...(d.optionIds||[])],quantities,storeContracts,optionRounds,...(d.transfers?{transfers:deepClone(d.transfers)}:{}),
        label:item.options.filter(o=>(d.optionIds||[]).includes(o.id)).map(o=>o.channel==='store'?`${o.label} x ${quantities[o.id]}`:o.label).join(' + ')};return;
    }
    entries[item.id]={...common,optionIds:[...(d.optionIds||[])],optionRounds,label:(item.options||[]).filter(o=>(d.optionIds||[]).includes(o.id)).map(o=>o.label).join(' + ')};
  });
  return {cat:cat.cat,entries,net:model.net,model};
}
// Local multi-key write with rollback; not a server receipt or distributed transaction.
function writeDecisionBatch(writes){
  const previous=new Map(),written=[];
  try{
    for(const key of Object.keys(writes))previous.set(key,localStorage.getItem(key));
    for(const [key,value] of Object.entries(writes)){written.push(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}
    return true;
  }catch(error){
    for(const key of written.reverse()){try{const value=previous.get(key);if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch(rollbackError){console.error('SIDE: storage rollback failed',rollbackError);}}
    console.error('SIDE: decision storage failed',error);toast('No se pudo guardar en este navegador. Libera espacio y vuelve a intentar. No se ha confirmado el envio.');return false;
  }
}
function saveCurrentSection(){
  if(!studentAccess().canOperate){toast(studentAccess().reason);return false;}

  if(decisionEditingBlocked())return false;
  const cat=categoryByCat(currentCategory);if(!cat)return false;
  if(currentCategory==='D'&&(!validateChannelQuantities()||!validateRequiredSection(cat)))return false;
  const context=decisionModelContext();let plan;
  try{plan=prepareSectionSave(cat,context);}catch(error){console.error('SIDE: no se pudo preparar el borrador',error);toast(`No se pudo preparar el borrador: ${error?.message||'revisa las opciones elegidas'}.`);return false;}
  const key=sectionLedgerKey(currentCategory),old=Number(cashLedger[key]||0);
  const affordable=cashBalance()-old+plan.net>=-0.005;
  const state={...decisionState,...plan.entries};
  // Un borrador que excede la caja conserva sus elecciones sin aplicar todavía
  // el movimiento financiero. El envío seguirá bloqueado hasta ajustar el gasto.
  const ledger=affordable?{...cashLedger,[key]:plan.net}:{...cashLedger};
  const draftKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let draftStore={};try{draftStore=JSON.parse(localStorage.getItem(draftKey)||'{}')||{}}catch{}
  delete draftStore[currentCategory];
  const sections=recordedFinancialSections();
  if(affordable)sections[currentRound()]={...(sections[currentRound()]||{}),[plan.cat]:{...plan.model,recordedNet:plan.net}};
  if(!writeDecisionBatch({[decisionKey()]:JSON.stringify(state),[ledgerKey()]:JSON.stringify(ledger),[draftKey]:JSON.stringify(draftStore),[financialSectionsKey()]:JSON.stringify(sections)}))return false;
  decisionState=state;cashLedger=ledger;decisionDrafts={};restoreDraftsForRound();
  // Las vistas derivadas no deben convertir un guardado exitoso en un fallo aparente.
  try{warnProductionMaterialShortage();}catch(error){console.error('SIDE: no se pudo actualizar la advertencia productiva',error)}
  try{syncReportToSupabase(syncStudentReportPreview());}catch(error){console.error('SIDE: no se pudo actualizar el resumen',error)}
  try{syncSectionToSupabase(cat.cat);}catch(error){console.error('SIDE: no se pudo sincronizar la sección',error)}
  try{if(affordable)animateCash(plan.net-old);renderTabs();renderDecisionCategory();updateHud();}catch(error){console.error('SIDE: el borrador se guardó, pero una vista no pudo refrescarse',error)}
  toast(affordable?'Borrador guardado sin enviar. Puedes continuar editando.':'Borrador guardado. Ajusta el presupuesto antes de enviar la decisión.');return true;
}
$('saveDecisionSection')?.addEventListener('click',saveCurrentSection);
function sendCurrentSection(){
  if(decisionsSubmitted()||sectionSubmitted(currentCategory)){toast('Esta sección ya fue enviada.');return false;}
  const category=categoryByCat(currentCategory);if(!category||category.summaryOnly)return false;
  if(!validateRequiredSection(category))return false;
  if(!sectionReady(currentCategory)){toast('Completa las decisiones obligatorias de esta pestaña.');return false;}
  return commitReviewedSections([currentCategory],false);
}
$('sendDecisionSection')?.addEventListener('click',sendCurrentSection);


let simulationLoadingActive=false;
function paintWorldLoading(){
  const status=window.SIDE3D?.loadingStatus?.()||{};
  if($('simulationLoadingPercent'))$('simulationLoadingPercent').textContent=status.total>0?`${status.loaded||0} / ${status.total} recursos`:'';
  if($('simulationLoadingStage'))$('simulationLoadingStage').textContent=status.phase||'Preparando escena y controles';
}
window.addEventListener('side3d:loading',paintWorldLoading);
function openCharacterSelection(){
  if(!canExploreWorld()){showScreen('studentLobby');updateIntegrationUI();toast(studentAccess().reason||'La partida está pausada.');return false;}
  const selector=window.CharacterSelection;
  if(!selector){console.error('SIDE: selector de personaje no disponible.');return startSimulationLoading({selectedCharacter:selectedCharacterModel()||'chico2'});}
  const selectorStorageKey=characterSelectionKey(),initialSelection=selectedCharacterSlug();
  selector.init({storageKey:selectorStorageKey,initialSelection,
    onSelectionChange(slug){
      const id=CHARACTER_MODEL_IDS[slug];if(!id)return;
      window.SIDE3D?.selectCharacter?.(id);
      window.SIDE3D?.preloadCharacter?.(id).catch(error=>console.warn(`SIDE: ${slug} usará el movimiento de respaldo.`,error));
    },
    onConfirm(slug){
      const id=CHARACTER_MODEL_IDS[slug];if(!id)return;
      characterSelectionConfirmed=true;publishWorldIdentity();selector.close();startSimulationLoading({selectedCharacter:id});
    }
  });
  showScreen('characterSelection');selector.open({storageKey:selectorStorageKey,initialSelection});
  const initialId=CHARACTER_MODEL_IDS[initialSelection];
  if(initialId){window.SIDE3D?.selectCharacter?.(initialId);window.SIDE3D?.preloadCharacter?.(initialId).catch(()=>{});}
  const preload=window.SIDE3D?.preloadBase||window.SIDE3D?.preload;
  preload?.().catch(error=>console.warn('SIDE: el mundo continuará cargando al confirmar.',error));
  return true;
}
function requestWorldEntry(){
  if(cyclePlanSyncPending()){toast('El servidor aún no confirmó el plan de este ciclo. Reintenta la sincronización antes de entrar al mundo 3D.');return false;}
  if(admittedFunContext&&admittedFunContext===funAdmissionContext()&&canVisitFunWorld())return startSimulationLoading({selectedCharacter:selectedCharacterModel()||'chico2'});
  if(!simulationSubmissionComplete())return openDecisionMenu();
  const admitted=localStorage.getItem(worldAdmissionKey())==='1';
  if((characterSelectionConfirmed||admitted)&&selectedCharacterModel())return startSimulationLoading({selectedCharacter:selectedCharacterModel()});
  return openCharacterSelection();
}
async function startSimulationLoading(options={}){
  if(simulationLoadingActive)return false;
  if(!canVisitFunWorld()){showScreen('studentLobby');updateIntegrationUI();toast(studentAccess().reason||'La partida no está disponible.');return false;}
  admittedFunContext=funAdmissionContext();
  const requestedCharacter=CHARACTER_SLUGS[options?.selectedCharacter]?options.selectedCharacter:(selectedCharacterModel()||'chico2');
  if(window.SIDE3D?.selectCharacter&&!window.SIDE3D.selectCharacter(requestedCharacter))return false;
  publishWorldIdentity();
  simulationLoadingActive=true;
  const gameId=currentStudent.game?.id,company=currentStudent.company;
  document.querySelectorAll('[data-start-world],#startSimulationBtn').forEach(button=>button.disabled=true);
  $('retryWorldBtn')?.classList.add('hidden');
  if($('simulationLoadingText'))$('simulationLoadingText').textContent='Preparando mundo 3D…';
  showScreen('simulationLoading');paintWorldLoading();
  try{
  if(typeof window.SIDE3D?.prepare!=='function')throw new Error('El motor 3D todavía no está disponible. Comprueba la conexión y vuelve a intentar.');
  const ok=await window.SIDE3D.prepare();
  if(currentStudent.game?.id!==gameId||currentStudent.company!==company||!canVisitFunWorld()){window.SIDE3D?.suspend?.();updateIntegrationUI();return false;}
  if(!ok)throw new Error(window.SIDE3D.getLastError?.()||'No se pudo preparar el mundo 3D. Revisa que el navegador permita WebGL.');
  if(!await window.SIDE3D.enter({autoStart:true}))throw new Error('No se pudo abrir el mundo 3D. Puedes volver a intentarlo.');
  localStorage.setItem(worldAdmissionKey(),'1');
  return true;
  }catch(error){
    console.error('SIDE: inicio del mundo 3D',error);
    if(canVisitFunWorld()){
      showScreen('simulationLoading');
      if($('simulationLoadingText'))$('simulationLoadingText').textContent=error.message||'No se pudo preparar el mundo 3D.';
      if($('simulationLoadingStage'))$('simulationLoadingStage').textContent='Carga interrumpida';
      $('retryWorldBtn')?.classList.remove('hidden');
    }else updateIntegrationUI();
    return false;
  }finally{
    simulationLoadingActive=false;
    document.querySelectorAll('[data-start-world],#startSimulationBtn').forEach(button=>button.disabled=false);
  }
}
$('retryWorldBtn')?.addEventListener('click',startSimulationLoading);
$('startSimulationBtn')?.addEventListener('click',requestWorldEntry);
function animateCash(netMovement,mandatoryCost=0){
  const fx=$('cashFx');if(!fx||!netMovement&&!mandatoryCost)return;fx.querySelector('span').textContent=(netMovement>0?'+ ':'− ')+money(Math.abs(netMovement))+(mandatoryCost?' · Incluye − '+money(mandatoryCost)+' obligatorios':'');fx.classList.remove('gain','spend','play');fx.classList.add(netMovement>0?'gain':'spend');void fx.offsetWidth;fx.classList.add('play');setTimeout(()=>fx.classList.remove('play'),1150);
  const cash=$('cashBalance');cash.classList.remove('cash-pulse');void cash.offsetWidth;cash.classList.add('cash-pulse');
}
function requiredDecisionItems(){return allDecisionItems().filter(i=>i.type!=='info'&&itemRequired(i))}
function decisionProgressPercent(){const actionable=requiredDecisionItems();const done=actionable.filter(itemComplete).length;return actionable.length?Math.round(done/actionable.length*100):100}
function categoryCompletionMap(){const out={};decisionCategories().forEach(cat=>{const req=cat.items.filter(i=>i.type!=='info'&&itemRequired(i));out[cat.cat]={title:cat.short||cat.title,done:req.filter(itemComplete).length,total:req.length,complete:req.length?req.every(itemComplete):true}});return out}
function updateCashHud(){
  const cash=cashBalance();
  $('cashBalance').textContent=money(cash);$('cashBalance').classList.toggle('danger',cash<0);$('cashMovement').textContent=`Caja inicial asignada: ${money(initialCapital())}`;
}
function updateHud(){
  publishWorldAtmosphere();
  updateCashHud();
  const top=$('topSubmitAllDecisions');if(top){top.disabled=false;top.innerHTML='<span>✓</span> ENVIAR TODO';}
  $('sendDecisionSection')?.classList.remove('hidden');
  const sections=decisionCategories(),submitted=sections.filter(category=>sectionSubmitted(category.cat)||decisionsSubmitted()).length,submittedPct=sections.length?Math.round(submitted/sections.length*100):0;
  $('decisionProgressText').textContent=`${submitted}/${sections.length} · ${submittedPct}%`;$('decisionProgressBar').style.width=submittedPct+'%';
  if($('decisionProgressHint'))$('decisionProgressHint').textContent=simulationSubmissionComplete()
    ?cyclePlanSyncPending()?'Esperando confirmación del servidor':'Apartados confirmados'
    :'Plan pendiente de confirmar';
  $('decisionProgressText').closest('.mission-meter')?.setAttribute('aria-label',`${submitted} de ${sections.length} apartados enviados, ${submittedPct}%`);
  const pct=decisionProgressPercent();
  const launch=$('simulationLaunch');if(launch){const ready=pct===100;launch.classList.toggle('hidden',!ready);launch.classList.toggle('ready',ready);const submitted=simulationSubmissionComplete();$('submitAllDecisionsBtn')?.classList.toggle('hidden',submitted);$('startSimulationBtn')?.classList.toggle('hidden',!submitted);}
  updateSectionSendButton();
}
function currentDecisionLabels(){return allDecisionItems().map(i=>savedEntry(i)?.label).filter(Boolean)}
function eventStoreKey(){return `SIDE_STUDENT_EVENTS_${storageKey()}`}
function eventSchedule(){try{return JSON.parse(localStorage.getItem('SIDE_EVENT_SCHEDULE')||'{}')||{}}catch{return {}}}
function deterministicChance(seed,pct){return stableHash(seed)%100 < Number(pct||0)}
function activeStudentEvents(){
  let stored={};try{stored=JSON.parse(localStorage.getItem(eventStoreKey())||'{}')||{}}catch{}
  const round=currentRound(),conf=teacherConfig(),enabled=new Set(conf.enabledEvents||[]),schedule=eventSchedule();
  if(conf.lifecycleVersion===2&&studentAccess().integration){worldAtmosphereEvents=[];window.SIDE_WORLD_PUBLISHER?.publish({events:[]});return [];}
  const remoteEvents=conf.lifecycleVersion===2&&currentStudent.empresaId;
  let individual={};if(remoteEvents){try{individual=JSON.parse(localStorage.getItem('SIDE_INDIVIDUAL_EVENTS_'+storageKey())||'{}');}catch{}stored={};}
  for(let r=Number(teacherConfig().integrationMinutes)===60?2:1;r<=round;r++)if(!stored[r]){const ids=[];(schedule[r]?.group||[]).forEach(id=>{if(enabled.has(id))ids.push(id)});if(remoteEvents){(individual[r]||[]).filter(id=>enabled.has(id)).forEach(id=>ids.push(id));}else EVENT_CATALOG.filter(e=>e.scope==='individual'&&enabled.has(e.id)&&r>=Number(conf.eventRules?.[e.id]?.firstRound||1)&&(conf.eventRules?.[e.id]?.repeat!==false||!Object.entries(stored).some(([cycle,ids])=>Number(cycle)<r&&ids.includes(e.id)))).forEach(e=>{if(ids.filter(id=>EVENT_CATALOG.find(x=>x.id===id)?.scope==='individual').length>=2)return;if(deterministicChance(`${storageKey()}|${r}|${e.id}`,e.probability))ids.push(e.id)});stored[r]=ids}
  localStorage.setItem(eventStoreKey(),JSON.stringify(stored));
  const active=[];Object.entries(stored).forEach(([trigger,ids])=>(ids||[]).forEach(id=>{const ev=EVENT_CATALOG.find(e=>e.id===id);if(!ev||!enabled.has(id))return;const effectiveStart=Number(trigger)+Number(ev.cycleOffset||0),effectiveEnd=effectiveStart+Math.max(1,Number(ev.cycles||1));if(round>=effectiveStart&&round<effectiveEnd)active.push({...ev,triggerRound:Number(trigger),startRound:effectiveStart})}));worldAtmosphereEvents=active.map(event=>({id:event.id,title:event.title,description:event.description,implication:event.implication,scope:event.scope}));window.SIDE_WORLD_PUBLISHER?.publish({events:worldAtmosphereEvents});return active;
}
function applyEventCashEffects(){
  if(studentAccess().cancelled)return;
  const events=activeStudentEvents();
  events.forEach(ev=>{const delta=Number(ev.effect?.cashDelta||0);if(!delta)return;const key=`${ev.startRound}:EVENT:${ev.id}`;if(cashLedger[key]===undefined)cashLedger[key]=delta;});
  if(events.some(ev=>ev.effect?.revenuePct||ev.effect?.costPct)||cashLedger[`${currentRound()}:EVENT:PERCENT`]!==undefined){
    if(decisionState.__cycleSettlements?.[currentRound()])return;
    const base=financialReport().estadoResultados;let cost=base.costos;
    events.forEach(ev=>{cost*=1+Number(ev.effect?.costPct||0)/100;});
    cashLedger[`${currentRound()}:EVENT:PERCENT`]=Math.round((-(cost-base.costos))*100)/100;
  }
  persistGameState();
}
function eventAdjustedFinancials(baseRevenue,baseCosts){let revenue=Number(baseRevenue||0),costs=Number(baseCosts||0);activeStudentEvents().forEach(ev=>{revenue*=1+Number(ev.effect?.revenuePct||0)/100;costs*=1+Number(ev.effect?.costPct||0)/100});return {revenue:Math.round(revenue),costs:Math.round(costs)}}
function financialSectionsKey(){return 'SIDE_FINANCIAL_SECTIONS_'+storageKey();}
function recordedFinancialSections(){
  let sections={};try{sections=JSON.parse(localStorage.getItem(financialSectionsKey())||'{}')||{}}catch{}
  if(typeof receiptRounds==='function')for(const round of receiptRounds())sections[round]={...(sections[round]||{}),...readReviewReceipts(round)};
  return sections;
}
let salesProjectionCache=null;
function cycleSalesProjection(round=currentRound()){
  if(temporalStudentRoom())return null;
  if(round!==currentRound()||!simulationSubmissionComplete()||decisionState.__cycleSettlements?.[round])return null;
  const model=window.SIDE_CYCLE_MODEL;if(!model?.project)return null;
  const saved=decisionState.__cyclePlans?.[round],state=saved?model.restoreState(saved.state,decisionState):decisionState;
  const input={state,ledger:financialLedger(),sectionsByRound:recordedFinancialSections(),catalog:DECISION_CATALOG,round,capital:initialCapital(),financialPolicy:window.SIDE_FINANCE_CONFIG?.resolve(teacherConfig(),round)||teacherConfig(),events:cycleBusinessData(round).events};
  const key=JSON.stringify([storageKey(),input]);
  if(salesProjectionCache?.key===key)return salesProjectionCache.value;
  try{const value=model.project(input);salesProjectionCache={key,value};return value;}
  catch(error){salesProjectionCache={key,value:null};console.warn('SIDE: no se pudo estimar el plan confirmado',error);return null;}
}
function financialReport({projection=false}={}){
  const actual=window.SIDE_FINANCIAL_MODEL.calculate({capital:initialCapital(),ledger:financialLedger(),sectionsByRound:recordedFinancialSections(),catalog:DECISION_CATALOG,round:currentRound(),openingBalance:decisionState.__openingBalance,state:decisionState,financialPolicy:window.SIDE_FINANCE_CONFIG?.resolve(teacherConfig(),currentRound())||teacherConfig()});
  const estimate=projection?cycleSalesProjection():null;
  const history=actual.history.map(row=>({...row,cycleReceipt:decisionState.__cycleSettlements?.[row.round]||row.cycleReceipt||null,closureStatus:decisionState.__cycleSettlements?.[row.round]?'closed':'pending'}));
  return estimate?{...estimate.financial,history,provisional:true,projectionReceipt:estimate.receipt}:{...actual,history,pendiente:!decisionState.__cycleSettlements?.[currentRound()]};
}
let financialSyncTimer=null;
function queueFinancialSync(){
  if(financialSyncTimer)return;
  financialSyncTimer=setTimeout(()=>{financialSyncTimer=null;syncReportToSupabase(syncStudentReportPreview());},1500);
}
function cycleBusinessData(round=currentRound()){
  const events=round===currentRound()?activeStudentEvents():decisionState.__cycleBusiness?.[round]?.events||[];
  return {events:deepClone(events)};
}
function captureCyclePlan(){
  const round=currentRound(),state=deepClone(decisionState);delete state.__cyclePlans;
  decisionState.__cyclePlans={...decisionState.__cyclePlans,[round]:{state,production:productionPlan()}};persistGameState();
}
function settleCycle(round=currentRound()){
  if(!window.SIDE_CYCLE_MODEL||decisionState.__cycleSettlements?.[round])return false;
  // The trusted server worker settles the shared market even with all browsers closed.
  if(currentStudent.empresaId)return false;
  const saved=decisionState.__cyclePlans?.[round];
  if(!saved)return false;
  const live=decisionState,ctx=cycleBusinessData(round),id=currentStudent.participantId||('local-'+storageKey()),game=currentStudent.game?.codigo||'SIDE-000';
  let peers=[];try{peers=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]');}catch{}
  const inputs=peers.filter(r=>r.id!==id&&r.partida===game&&r.estado!=='eliminada'&&r.enviado&&r.gameState?.__cyclePlans?.[round]).map(r=>{
    const plan=r.gameState.__cyclePlans[round];return {id:r.id,state:plan.state,production:plan.production,round,events:r.gameState.__cycleBusiness?.[round]?.events||[]};
  });
  inputs.push({id,state:window.SIDE_CYCLE_MODEL.restoreState(saved.state,live),ledger:cashLedger,catalog:DECISION_CATALOG,round,capital:initialCapital(),sectionsByRound:recordedFinancialSections(),production:saved.production,financialPolicy:window.SIDE_FINANCE_CONFIG?.resolve(teacherConfig(),round)||teacherConfig(),...ctx});
  const result=window.SIDE_CYCLE_MODEL.closeMany(inputs)[id];
  decisionState={...live,__economicHistory:result.state.__economicHistory,__accountsReceivable:result.state.__accountsReceivable,__financialSnapshots:result.state.__financialSnapshots,__cycleSettlements:result.state.__cycleSettlements,__finishedGoods:result.state.__finishedGoods,__goodsLots:result.state.__goodsLots,__storeInventory:result.state.__storeInventory,__inventarioMP:result.state.__inventarioMP};cashLedger=result.ledger;persistGameState();
  try{queueStudentSnapshot(buildStudentSnapshot(currentRound()));syncReportToSupabase(syncStudentReportPreview());}catch(error){console.warn('SIDE: cierre guardado; sincronización pendiente',error);}
  return true;
}
function syncStudentReportPreview(){
  if(currentStudent.expulsada||localStudentExpelled())return null;
  if(temporalStudentRoom()&&!validStudentMaterialBook())return null;
  decisionState.__cycleBusiness={...decisionState.__cycleBusiness,[currentRound()]:cycleBusinessData()};
  applyEventCashEffects();
  const entries=allDecisionItems().filter(i=>savedEntry(i));
  const financial=financialReport(),er=financial.estadoResultados;
  const estimate=cycleSalesProjection();
  const utilidad=er.utilidad,cajaFinal=financial.balanceCaja.cajaFinal;
  const events=activeStudentEvents();
  const report={
    id:currentStudent.participantId||('local-'+storageKey()),nombre:'Jugador',empresa:currentStudent.company,legalName:currentStudent.legalName,
    partida:currentStudent.game?.codigo||'SIDE-000',ronda:currentRound(),capital:initialCapital(),
    ingresos:er.ingresos,costos:er.costos,utilidad,rondasActivas:currentRound(),actividad:entries.length,
    cycleReceipt:deepClone(decisionState.__cycleSettlements?.[currentRound()]||null),
    unidadesVendidas:decisionState.__cycleSettlements?.[currentRound()]?.sold??null,
    cierrePendiente:!decisionState.__cycleSettlements?.[currentRound()],
    liveProjection:estimate?{...estimate,round:currentRound(),game:currentStudent.game?.codigo,company:String(currentStudent.empresaId||''),financial:{...estimate.financial,history:undefined}}:null,
    canalesVenta:{cantidades:deepClone(savedEntry(findDecisionItem('CANALES'))?.quantities||{}),tiendasFisicas:RULES.storeCount(savedEntry(findDecisionItem('CANALES')))},
    produccion:productionPlan(),
    resumenEnviado:typeof readReviewReceipts==='function'?readReviewReceipts():null,
    decisiones:currentDecisionLabels(),apartados:categoryCompletionMap(),progreso:decisionProgressPercent(),enviado:decisionsSubmitted(),
    eventos:events.map(e=>({id:e.id,titulo:e.title,descripcion:e.description,afectados:e.scope==='group'?'Todos':'Empresa individual',ciclos:e.cycles,cicloAfecta:(Number(e.cycleOffset||0)===0?'+0 · mismo ciclo':Number(e.cycleOffset||0)===1?'+1 · siguiente ciclo':`+${Number(e.cycleOffset||0)} · después de ${Number(e.cycleOffset||0)} ciclos`),implicancia:e.implication,ocurrencia:e.probability})),
    estadoResultados:financial.estadoResultados,
    gameState:deepClone(decisionState),cashLedger:deepClone(cashLedger),financialSections:recordedFinancialSections(),
    balanceCaja:{...financial.balanceCaja,balanceGeneral:financial.balanceGeneral},
    balanceGeneral:financial.balanceGeneral,flujoCaja:financial.flujoCaja,
    score:Math.max(0,Math.round(utilidad/100+decisionProgressPercent())),estado:'activa',tomandoDecisiones:playerIsDeciding,conectada:studentConnected,integracion:studentAccess().integration,caja:cajaFinal,updatedAt:new Date().toISOString(),lastSeenAt:studentConnected?new Date().toISOString():null
  };
  let reports=[];try{reports=JSON.parse(localStorage.getItem('SIDE_STUDENT_REPORTS')||'[]')}catch{}
  const idx=reports.findIndex(r=>r.id===report.id);if(idx>=0)reports[idx]=report;else reports.push(report);
  localStorage.setItem('SIDE_STUDENT_REPORTS',JSON.stringify(reports));renderStudentStatus();
  return report;
}
function persistStudentSession(){try{sessionStorage.setItem('SIDE_STUDENT_SESSION',JSON.stringify(currentStudent));}catch{}}
function buildStudentSnapshot(round=currentRound()){
  // Recover a confirmation interrupted before its plan reached the durable outbox.
  if(round===currentRound()&&simulationSubmissionComplete()&&!decisionState.__cyclePlans?.[round])captureCyclePlan();
  decisionState.__cycleBusiness={...decisionState.__cycleBusiness,[round]:cycleBusinessData(round)};
  // This marker survives the whitelist used by already deployed databases.
  decisionState.__snapshotRound=round;
  return {
    version:1,round,updated_at:new Date().toISOString(),
    decision_state:deepClone(decisionState),cash_ledger:deepClone(cashLedger),financial_sections:recordedFinancialSections(),
    section_submissions:Object.fromEntries(decisionCategories().map(category=>[category.cat,sectionSubmitted(category.cat)])),
    decisions_submitted:simulationSubmissionComplete(),selected_character:selectedCharacterSlug()
  };
}
async function recoverStaleStudentState(){
  studentSnapshotEpoch++;studentProgressHydrated=false;
  const recovered=await refreshStudentGame({forceHydrate:true});
  studentSnapshotEpoch++;
  if(recovered)toast('La empresa se actualizó en otra sesión. Recuperamos el estado más reciente.');
  else toast('No se pudo sincronizar el estado. Vuelve a ingresar con los datos de tu empresa.');
  return false;
}
function studentSyncPending(){return Boolean(studentOutbox?.pending(studentIdentityKey())||getStudentOutbox()?.pending(studentIdentityKey()))}
let studentConnectionConfirmedAt=null;
function renderStudentConnection(){
  const el=$('studentConnectionStatus');if(!el)return;
  el.textContent=!studentConnected?'Sin conexión con la partida.':!currentStudent.empresaId?'Modo local · sin conexión a una sala remota.':navigator.onLine===false?'Sin conexión a internet. Tus avances guardados se conservan en este dispositivo.':studentStateFailure?'No se pudo confirmar la conexión con el servidor. Reintentando…':studentSessionRecovering||studentConnectionConfirmedAt===null?'Verificando conexión con la partida…':performance.now()-studentConnectionConfirmedAt>15000?'Conexión con el servidor sin confirmar. Reintentando…':'Conexión con el servidor confirmada. Al iniciar la partida entrarás al menú de decisiones.';
}
function showStudentSyncStatus(status,error){
  const labels={saving:'Sincronizando cambios…',pending:'Cambios guardados en este dispositivo. Sincronización pendiente.',conflict:'El estado cambió en otra sesión. Recuperando la versión del servidor.',rejected:JOIN_INVALID_MESSAGE,'storage-error':'No se pudo conservar la sincronización pendiente en este dispositivo.'};
  if(status==='pending'&&window.SIDE?.StudentSync?.pendingMessage)labels.pending=window.SIDE.StudentSync.pendingMessage(error);
  if(status==='synced'&&decisionState.__cyclePlans?.[currentRound()]){setCyclePlanSyncPending(false);if(temporalStudentRoom())refreshStudentMaterialBook();else if(currentCategory==='A'&&!$('decisionMenu')?.classList.contains('hidden'))queueMicrotask(()=>renderCompanySummary());}
  for(const el of document.querySelectorAll('[data-student-sync-status]')){el.textContent=labels[status]||'';el.classList.toggle('hidden',!currentStudent.empresaId||!el.textContent);}
  if(!$('decisionMenu')?.classList.contains('hidden'))updateHud();
  if(error)console.warn('SIDE: sincronización pendiente',error);
}
function rejectStudentSession(error){
  if(error?.code==='EMPRESA_EXPULSADA'){showStudentExpulsion();return;}
  studentConnected=false;renderStudentPodium(null);studentSessionRecovering=false;studentProgressHydrated=false;studentSnapshotEpoch++;stopStudentSync();
  try{sessionStorage.removeItem('SIDE_STUDENT_SESSION');}catch{}
  showScreen('profiles');showModal('studentModal');message('studentMessage',JOIN_INVALID_MESSAGE,true);
}
function getStudentOutbox(){
  if(studentOutbox)return studentOutbox;
  const S=window.SIDE||{};if(!S.StudentSync)return null;
  studentOutbox=S.StudentSync.createQueue({
    storage:localStorage,
    context:()=>({connected:studentConnected,identity:studentIdentity(),identityKey:studentIdentityKey(),revision:Math.max(0,Number(currentStudent.snapshotRevision)||0),epoch:studentSnapshotEpoch}),
    prepareSnapshot:snapshot=>S.StudentSync.withImplicitPrices(snapshot,defaultSegmentPrices()),
    saveSnapshot:async(identity,snapshot,expectedRevision)=>{
      const epoch=studentSnapshotEpoch;
      if(remoteStateBusy)await remoteStateTask;
      if(epoch!==studentSnapshotEpoch||!studentConnected||JSON.stringify(identity)!==studentIdentityKey())return {success:false,offline:true};
      return S.EmpresaService.guardarEstado(identity,snapshot,expectedRevision);
    },
    saveOperation:(identity,round,operation,newRevision)=>{
      if(operation.type==='decisions')return S.DecisionesService.guardar(identity,round,operation.payload,newRevision);
      // The teacher already persisted the final report. Never resend an older
      // queued preview over that closure, even against an older SQL deployment.
      if(decisionState.__cycleSettlements?.[round])return Promise.resolve({success:true,closed:true});
      return S.DecisionesService.guardarReporte(identity,round,operation.payload,newRevision);
    },
    readSnapshot:identity=>S.EmpresaService.obtenerEstado(identity),
    onRevision:revision=>{currentStudent.snapshotRevision=revision;persistStudentSession();},
    onConflict:recoverStaleStudentState,onRejected:rejectStudentSession,onStatus:showStudentSyncStatus
  });
  return studentOutbox;
}
function retryStudentSync({force=false}={}){
  const outbox=getStudentOutbox();
  if(!outbox||!studentConnected||navigator.onLine===false){
    if(force)showStudentSyncStatus('pending',{code:'FETCH_ERROR',error:'No se pudo conectar con el servidor.'});
    return Promise.resolve(false);
  }
  // A legacy/local confirmation can outlive its outbox entry (for example
  // after recovery). Rebuild the transport payload from the saved decisions;
  // never call the decision commit again or charge its ledger a second time.
  if(force&&!outbox.pending(studentIdentityKey())&&cyclePlanSyncPending()&&simulationSubmissionComplete()){
    const round=currentRound();
    queueStudentSnapshot(buildStudentSnapshot(round));
    syncReportToSupabase(syncStudentReportPreview());
    for(const category of decisionCategories())syncSectionToSupabase(category.cat);
  }
  if(!outbox.pending(studentIdentityKey()))return Promise.resolve(false);
  studentSnapshotQueue=outbox.flush({force});return studentSnapshotQueue;
}
function queueStudentSnapshot(snapshot,operation=null){
  if(!window.SIDE?.EmpresaService?.guardarEstado||!currentStudent.empresaId||!studentConnected)return Promise.resolve(false);
  const outbox=getStudentOutbox();if(!outbox)return Promise.resolve(false);
  studentSnapshotQueue=outbox.enqueue(snapshot,operation);return studentSnapshotQueue;
}
/**
 * Sincroniza el reporte financiero calculado con Supabase (reportes).
 * Solo se llama en puntos de guardado/confirmación del usuario, nunca en
 * loops de render ni ventas 3D (ahí el reporte se recalcula muy seguido).
 * Fire-and-forget con guard: silencioso si offline.
 * @param {object|null} report Reporte tal cual lo devuelve syncStudentReportPreview().
 */
function syncReportToSupabase(report){
  try{
    const S=window.SIDE||{};
    if(!currentStudent?.empresaId||!report)return;
    const round=Number(report.ronda)||currentRound();
    const payload={
      capital:report.capital,ingresos:report.ingresos,costos:report.costos,
      utilidad:report.utilidad,caja_final:report.caja,
      balance_caja:report.balanceCaja||{},flujo_caja:report.flujoCaja||{},
      estado_resultados:{...report.estadoResultados,...(report.cycleReceipt?{cycleReceipt:report.cycleReceipt}:{}),...(report.liveProjection?{liveProjection:report.liveProjection}:{})},
      decisiones:report.decisiones||[],eventos:report.eventos||[],
      score:report.score||0,progreso:report.progreso||0
    };
    if(S.EmpresaService?.guardarEstado){
      const snapshot=buildStudentSnapshot(round);
      queueStudentSnapshot(snapshot,S.DecisionesService?{key:'report',type:'report',payload}:null);
    }
  }catch(error){console.error('SIDE: no se pudo sincronizar el reporte',error)}
}
/**
 * Sincroniza la sección actual de decisiones con Supabase (Fase B).
 * Convierte el estado local a [{decision_id, opcion_id, cantidad, costo_total}]
 * y lo envía via DecisionesService.guardar(). Silencioso si offline.
 * @param {string} cat Código de categoría (B/C/D/E/F).
 */
async function syncSectionToSupabase(cat){
  try{
    const S=window.SIDE||{};
    if(!S.DecisionesService||!currentStudent?.empresaId)return;
    const categoria=categoryByCat(cat);if(!categoria||!categoria.items?.length)return;
    const round=currentRound(),decisiones=[],omitidas=[];
    for(const item of categoria.items){
      if(item.type==='info')continue;
      const st=decisionState[item.id];if(!st)continue;
      const entry=buildSupabaseDecision(item,st,round);
      if(!entry){omitidas.push(item.id);continue}
      if(Array.isArray(entry))decisiones.push(...entry);else decisiones.push(entry);
    }
    if(omitidas.length)console.info('SIDE: sync omite sin mapeo:',omitidas.join(','));
    if(!decisiones.length)return;
    const snapshot=buildStudentSnapshot(round);
    return await queueStudentSnapshot(snapshot,{key:'decisions:'+cat,type:'decisions',payload:decisiones});
  }catch(error){console.error('SIDE: no se pudo sincronizar la sección',error)}
}
/**
 * Convierte una decisión del estado local al formato del RPC guardar_decisiones.
 * @param {object} item Definición del catálogo (js/decision_catalog.js).
 * @param {object} st Estado local de la decisión (ver prepareSectionSave).
 * @param {number} round Ciclo actual (las compras de activos viven por ciclo).
 * @returns {object|Array|null} {decision_id, opcion_id, cantidad, costo_total},
 *   array si hay varias opciones, o null si no hay nada que sincronizar.
 */
function buildSupabaseDecision(item,st,round){
  if(!item||!st)return null;
  const ids=Array.isArray(st.optionIds)?st.optionIds:[];
  const quantities=st.quantities||{};
  const out=[];
  const push=(opId,qty,cost)=>{
    out.push({decision_id:item.id,opcion_id:opId||null,cantidad:Math.max(1,Number(qty)||1),costo_total:Math.round((Number(cost)||0)*100)/100});
  };
  // Activos (mesas, máquinas): las compras del ciclo están en
  // st.purchases[round]. Cantidad con signo (negativo = liquidación/venta).
  if(item.asset){
    const bought=(st.purchases&&st.purchases[round])||{};
    for(const[opId,qty]of Object.entries(bought)){
      const q=Number(qty)||0;if(q===0)continue;
      const opt=(item.options||[]).find(o=>o.id===opId);
      let unit=Number(opt?.cost)||0;
      try{if(typeof optionUnitCost==='function'&&opt)unit=optionUnitCost(item,opt)}catch{}
      out.push({decision_id:item.id,opcion_id:opId,cantidad:q,costo_total:Math.round(unit*q*100)/100});
    }
    return out.length?(out.length===1?out[0]:out):null;
  }
  // Plan de producción: meta total de unidades (sin opción ni costo).
  if(item.type==='production-plan'){
    const total=Math.max(0,Math.trunc(Number(st.value)||0));
    if(total<=0)return null;
    push(null,total,0);
    return out[0];
  }
  if(item.id==='INV_MARKETING'&&item.type==='number'){const value=window.SIDE_BUSINESS_RULES.advertising({state:{INV_MARKETING:st}});push(null,1,value);return out[0];}
  if(item.type==='choice'||item.type==='multi-choice'){
    if(!ids.length)return null;
    for(const opId of ids){
      const opt=(item.options||[]).find(o=>o.id===opId);
      push(opId,quantities[opId]||1,(opt?optionUnitCost(item,opt):0)*(quantities[opId]||1));
    }
    return out.length===1?out[0]:out;
  }
  if(item.type==='quantity'||item.type==='quantity-choice'){
    let any=false;
    for(const[opId,qty]of Object.entries(quantities)){
      if(Number(qty)>0){const opt=(item.options||[]).find(o=>o.id===opId);push(opId,qty,(opt?optionUnitCost(item,opt):0)*Number(qty));any=true}
    }
    if(!any&&ids.length){for(const opId of ids){const opt=(item.options||[]).find(o=>o.id===opId);push(opId,1,opt?.cost||0);any=true}}
    return any?(out.length===1?out[0]:out):null;
  }
  if(typeof st.cost==='number'&&st.cost>0){push(ids[0]||null,1,st.cost);return out[0]}
  if(typeof st.amount==='number'&&st.amount>0){push(null,1,st.amount);return out[0]}
  return null;
}


function persistCurrentDraftOnly(){
  const cat=categoryByCat(currentCategory);if(!cat)return false;
  const draftStoreKey=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;
  let store={};try{store=JSON.parse(localStorage.getItem(draftStoreKey)||'{}')||{}}catch{}
  store[currentCategory]={};cat.items.forEach(item=>{if(decisionDrafts[item.id])store[currentCategory][item.id]=deepClone(decisionDrafts[item.id])});
  localStorage.setItem(draftStoreKey,JSON.stringify(store));
  return true;
}
function restoreDraftsForRound(){
  const key=`SIDE_DECISION_DRAFTS_${storageKey()}_${currentRound()}`;let store={};try{store=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
  for(const cat of DECISION_CATALOG){if(sectionSubmitted(cat.cat))continue;const section=store[cat.cat]||{};cat.items.forEach(item=>{if(section[item.id])decisionDrafts[item.id]=deepClone(section[item.id])})}
}
function submitAllDecisions(){openCompanyReview();}
$('submitAllDecisionsBtn')?.addEventListener('click',submitAllDecisions);
$('topSubmitAllDecisions')?.addEventListener('click',submitAllDecisions);
function formatStudentTime(total){const s=Math.max(0,Math.floor(Number(total)||0));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function readRoundRuntime(){
  const own=scopedStudentState();if(own)return own.runtime;
  try{
    const r=JSON.parse(localStorage.getItem('SIDE_ROUND_RUNTIME')||'null');
    const status=JSON.parse(localStorage.getItem('SIDE_GAME_STATUS')||'{}')||{},config=teacherConfig();
    if(config.lifecycleVersion===2)return currentStudent.empresaId?r:RULES.resolveRuntime({...config,runtime:r},studentNow());
    if(status.active&&config.cycleCloseMode==='automatic'){
      const plan=RULES.cycleSchedule(config),position=RULES.schedulePosition(plan);
      if(position)return {...r,...position,mode:'automatic',scheduledStart:config.scheduledStart,running:position.status==='running',startedAt:new Date(position.startedAt).toISOString(),duration:(plan.cycles[position.round-1].end-plan.cycles[position.round-1].start)/1000};
    }
    return r&&Number(config.integrationMinutes)===60&&!status.active?{...r,running:false}:r;
  }catch{return null}
}
function syncStudentTimer(){
  const r=readRoundRuntime(),conf=teacherConfig();
  const configuredDuration=Number(conf.integrationMinutes)===60&&currentRound()===1?3600:Number(conf.roundHours||0)*3600+Number(conf.roundMinutes||0)*60;
  let remain=Number(r?.remaining??configuredDuration),note='Esperando inicio del docente';
  if(r?.running&&r.startedAt){
    const duration=Number(r.duration||configuredDuration||remain);
    remain=Math.max(0,duration-Math.floor((studentNow()-new Date(r.startedAt).getTime())/1000));
    note=remain>0?(Number(conf.integrationMinutes)===60&&currentRound()===1?'Período de integración · solo ingreso y espera':'Ciclo en curso'):'Tiempo finalizado';
  }else if(r?.status==='scheduled'){
    const wait=Math.max(0,Math.floor((new Date(r.scheduledStart).getTime()-studentNow())/1000));
    note=wait>0?`Inicio automático en ${formatStudentTime(wait)}`:'Inicio automático pendiente';
  }else if(r?.status==='finished')note='Tiempo finalizado';
  else if(r?.status==='simulation-finished')note='Simulación finalizada';
  else if(r?.status==='paused')note='Ciclo en pausa · reloj congelado';
  if(conf.lifecycleVersion===2&&r?.phase==='integration'){const access=studentAccess();remain=access.remaining||0;note='Sala de espera · el Ciclo 1 comenzará al terminar el tiempo configurado';}
  if(RULES.isCancellationMarker(conf.cancelledAt)||r?.phase==='cancelled'){remain=0;note='Partida cancelada';}
  const text=formatStudentTime(remain);
  if($('studentRoundTimer'))$('studentRoundTimer').textContent=text;
  if($('decisionRoundTimer'))$('decisionRoundTimer').textContent=text;
  if($('studentCycleLabel'))$('studentCycleLabel').textContent=r?.phase==='integration'?'Integración previa al Ciclo 1':`Ciclo ${currentRound()} / ${conf.cycles||6}`;
  if($('studentTimerNote'))$('studentTimerNote').textContent=note;
}
function renderStudentStatus(){
  if(!$('studentCashResult'))return;
  applyEventCashEffects();const f=financialReport({projection:true}),er=f.estadoResultados,bc=f.balanceCaja,fc=f.flujoCaja;
  const set=(id,val)=>{if($(id))$(id).textContent=money(val)};
  set('studentIncomeResult',er.utilidad);set('studentCashResult',bc.cajaFinal);set('studentFlowResult',fc.flujoNeto);
  for(const [id,normal,estimated]of [['studentIncomeResult','Utilidad del ciclo','Utilidad estimada del ciclo'],['studentCashResult','Caja disponible','Caja estimada al cierre'],['studentFlowResult','Flujo neto del ciclo','Flujo neto estimado']]){
    const label=$(id)?.parentElement.querySelector('small');if(label)label.textContent=f.provisional?estimated:normal;
  }
  for(const [id,val] of Object.entries({studentERIngresos:er.ingresos,studentERCostos:er.costos,studentEREventos:er.impactoEventos,studentERUtilidad:er.utilidad,studentERDevoluciones:er.devoluciones,studentERActivos:er.resultadoVentaActivos,studentEROtros:er.otros,studentBCInicial:bc.cajaInicial,studentBCPrestamos:bc.prestamos,studentBCEntradas:bc.entradas,studentBCSalidas:bc.salidas,studentBCFinal:bc.cajaFinal,studentFCOperacion:fc.operacion,studentFCFinanciamiento:fc.financiamiento,studentFCEventos:fc.eventos,studentFCInversion:fc.inversion,studentFCNeto:fc.flujoNeto}))set(id,val);
  if($('studentIncomeStatement')&&window.SIDE_STUDENT_FINANCIAL_VIEW)$('studentIncomeStatement').innerHTML='<strong>'+(f.provisional?'ESTADO DE RESULTADOS ESTIMADO':'ESTADO DE RESULTADOS')+'</strong>'+window.SIDE_STUDENT_FINANCIAL_VIEW.incomeHtml(er,fc,f.balanceGeneral);
  if($('studentFinancialDetail'))$('studentFinancialDetail').innerHTML=financialDetailsHtml(f);
  const historyMount=$('studentCycleHistory');
  if(historyMount&&window.SIDE_STUDENT_FINANCIAL_VIEW){
    const runtime=readRoundRuntime(),finished=['finished','results'].includes(runtime?.phase)||['finished','simulation-finished'].includes(runtime?.status);
    const signature=JSON.stringify([f.history,finished]);
    if(historyMount.dataset.signature!==signature){historyMount.innerHTML=window.SIDE_STUDENT_FINANCIAL_VIEW.summaryHtml(f,finished);historyMount.dataset.signature=signature;}
  }
  const events=activeStudentEvents();
  if($('studentEventImpactText'))$('studentEventImpactText').textContent=f.provisional?`Ciclo ${currentRound()}: proyección individual con las decisiones confirmadas. Las ventas definitivas dependen del reparto entre empresas al cierre; tu caja guardada aún no recibe estos cobros.`:f.pendiente?`Ciclo ${currentRound()} pendiente de cierre. Las ventas e ingresos se calculan al cerrar el ciclo; consulta los ciclos cerrados debajo.`:`Ciclo ${currentRound()}: movimientos guardados. El costo de ventas corresponde a unidades vendidas; inventarios y activos conservan su valor pendiente de consumo o depreciación. Préstamos como deuda.`;
  const news=$('studentNewsList');if(news)news.innerHTML=events.length?events.map(e=>`<article><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.implication)}</span></article>`).join(''):'<p>Sin eventos activos en este ciclo.</p>';
}
function renderOfficeFinances(){
  const mount=$('adminFinancialPanel');
  if(mount&&mount.dataset.signature!=='fun-only'){
    mount.textContent='Modo diversión: no afecta tus ingresos. Consulta tus finanzas económicas en la Tablet de decisiones.';
    mount.dataset.signature='fun-only';
  }
}
function financialDetailsHtml(f){
  const fc=f.flujoCaja,bg=f.balanceGeneral,row=(label,value)=>`<span>${label}<b>${money(value)}</b></span>`;
  return `${f.provisional?'<p>Proyección individual del ciclo. El reparto definitivo de ventas entre empresas se consolida al cierre.</p>':''}${cycleSalesHtml(f.round)}<details class="financial-details"><summary>Flujo de caja ${f.provisional?'estimado':'detallado'} · ciclo ${f.round}</summary>${row('Caja al inicio',fc.cajaInicial)}${row('Cobros por ventas',fc.cobrosVentas)}${row('Reembolsos',fc.reembolsos)}${row('Pagos operativos',fc.pagosOperacion)}${row('Eventos',fc.eventos)}${row('Otros movimientos registrados',fc.otros)}${row('Flujo de operación',fc.operacion)}${row('Compra de activos',fc.compraActivos)}${row('Venta de activos',fc.ventaActivos)}${row('Flujo de inversión',fc.inversion)}${row('Préstamos recibidos',fc.financiamiento)}${row('Variación neta de caja',fc.flujoNeto)}${row('Caja al cierre',fc.cajaFinal)}</details>
  <div class="financial-details"><strong>BALANCE GENERAL · ${f.provisional?'ESTIMADO AL CICLO '+f.round:f.pendiente?(f.balanceGeneralRound?'ÚLTIMO CIERRE: CICLO '+f.balanceGeneralRound:'INICIAL'):'AL CICLO '+f.round}</strong>${f.pendiente?'<p>El ciclo actual está pendiente de cierre.</p>':''}${row('Efectivo',bg.efectivo)}${row('Cuentas por cobrar',bg.cuentasPorCobrar)}${row('Inventarios',bg.inventarios)}${row('Equipos, moldes y mejoras (netos)',bg.activosFijos)}${row('Total activos',bg.activos)}${row('Deuda financiera',bg.deuda)}${row('Capital aportado',bg.capital)}${row('Resultados acumulados',bg.resultadosAcumulados)}${row('Patrimonio',bg.patrimonio)}${row('Pasivo + patrimonio',bg.pasivoPatrimonio)}</div>`;
}
function cycleSalesHtml(round=currentRound()){
  const actual=decisionState.__cycleSettlements?.[round],estimate=actual?null:cycleSalesProjection(round),receipt=actual||estimate?.receipt;
  if(!receipt?.sales)return '<section class="financial-details"><strong>Ventas por segmento</strong><p>El reparto estará disponible cuando se sincronice el cierre del ciclo.</p></section>';
  const labels={esencial:'Económico',urbano:'Medio',premium:'Premium'};
  return `<section class="financial-details"><strong>Ventas ${estimate?'estimadas ':''}por segmento · ciclo ${round}</strong>${estimate?'<p>Estimación individual. El reparto definitivo depende de las empresas del ciclo.</p>':''}${receipt.sales.map(sale=>{
    const assigned=Number(sale.demand??receipt.marketAllocation?.products?.[sale.id]?.asignado??0);
    const plan=receipt.production||{},causes=[];
    if(!sale.sold&&!sale.produced){
      const moldId={esencial:'molde_1',urbano:'molde_2',premium:'molde_3'}[sale.id];
      if(plan.unavailablePlannedMolds?.includes(moldId))causes.push('Falta el molde elegido');
      for(const process of plan.processes||[])if(!process.cycleCapacity)causes.push(`Sin personal o equipo operativo en ${process.label}`);
      for(const material of plan.materials||[])if(!material.supportedUnits)causes.push(`Sin ${material.label} suficiente`);
    }
    const reason=causes.join('. ')||sale.reason||sale.zeroReason||(!sale.sold?(!sale.available?'Sin stock: revisa insumos, personal, equipos y molde.':!assigned?'Sin demanda asignada en este segmento.':'Sin ventas en este ciclo.'):'');
    return `<div class="segment-sales"><h4>${labels[sale.id]||escapeHtml(sale.id)}</h4><span>Precio elegido <b>${money(sale.chosenPrice??sale.price)}</b></span><span>Precio efectivo <b>${money(sale.price)}</b></span><span>Demanda asignada ${estimate?'estimada':'efectiva'} <b>${assigned}</b></span><span>Unidades disponibles <b>${Number(sale.available||0)}</b></span><span>Unidades vendidas${estimate?' estimadas':''} <b>${Number(sale.sold||0)}</b></span><span>Ventas perdidas <b>${Math.max(0,Number(sale.lostSales??assigned-Number(sale.sold||0)))}</b></span><span>Stock final <b>${Number(receipt.goods?.[sale.id]??Math.max(0,Number(sale.available||0)-Number(sale.sold||0)))}</b></span><span>Participación <b>${(Number(receipt.marketAllocation?.products?.[sale.id]?.porcentaje||0)*100).toLocaleString('es-PE',{maximumFractionDigits:2})}%</b></span><span>Ingresos${estimate?' estimados':''} <b>${money(sale.revenue||0)}</b></span>${reason?`<p>${escapeHtml(reason)}</p>`:''}</div>`;
  }).join('')}</section>`;
}
let lastObservedRound=currentRound();
let lastDeadlineRefresh='';
function tickStudentGame(){
  if(!studentConnected)return;
  if(!currentStudent.empresaId&&teacherConfig().lifecycleVersion===2)refreshStudentGame();
  const access=studentAccess(),deadline=teacherConfig().gameStartAt;
  if(currentStudent.empresaId&&access.integration&&access.remaining===0&&zeroSyncDeadline!==deadline){zeroSyncDeadline=deadline;refreshStudentGame();}
  const round=currentRound();
  const runtime=readRoundRuntime();
  for(const pending of Object.keys(decisionState.__cyclePlans||{}).map(Number).filter(r=>r<round).sort((a,b)=>a-b))settleCycle(pending);
  if(currentStudent.empresaId&&teacherConfig().cycleCloseMode==='automatic'&&runtime?.running&&runtime.startedAt&&Number(runtime.duration)>0){
    const deadline=Date.parse(runtime.startedAt)+Number(runtime.duration)*1000;
    const key=`${round}:${deadline}`;
    if(Number.isFinite(deadline)&&studentNow()>=deadline&&lastDeadlineRefresh!==key){lastDeadlineRefresh=key;refreshStudentGame();}
  }
  if(round!==lastObservedRound)settleCycle(lastObservedRound);
  if(['finished','closed','results','simulation-finished'].includes(runtime?.status)||['finished','closed','results'].includes(runtime?.phase))settleCycle(round);
  if(round!==lastObservedRound){if(typeof closeCompanyReview==='function')closeCompanyReview();lastObservedRound=round;currentCategory=round>1?'A':navigationCategories()[0]?.cat;loadDecisionState();restoreDraftsForRound();if(!$('decisionMenu')?.classList.contains('hidden')){renderTabs();renderDecisionCategory()}}
  if(typeof ensureCycleFixedCosts==='function')ensureCycleFixedCosts();
  syncStudentTimer();if(studentConnected)updateIntegrationUI();if(!$('studentLobby')?.classList.contains('hidden'))renderStudentStatus();renderOfficeFinances();
  if(typeof maybeShowCycleCostNotice==='function')maybeShowCycleCostNotice();
}

function resumeStudentSession(){
  if(studentSessionRecoveryTask)return studentSessionRecoveryTask;
  studentSessionRecoveryTask=(async()=>{
    const epoch=studentSnapshotEpoch;
    // Recover a confirmed local plan before a queue-empty remote hydration can
    // replace it. CAS still protects changes made by the teacher/another device.
    if(cyclePlanSyncPending()&&simulationSubmissionComplete()&&!studentSyncPending())await retryStudentSync({force:true});
    if(epoch!==studentSnapshotEpoch||!studentConnected)return false;
    const validated=await refreshStudentGame({forceHydrate:!studentSyncPending()});
    if(epoch!==studentSnapshotEpoch||!studentConnected)return false;
    if(!validated&&currentStudent.empresaId){
      if(studentStateFailure?.code==='CREDENCIALES_INVALIDAS'&&!studentStateFailure.technical){rejectStudentSession();return false;}
      studentSessionRecovering=true;showScreen('profiles');showModal('studentModal');
      $('gameCode').value=currentStudent.game.codigo;$('companyLegalName').value=currentStudent.legalName||'';$('companyBrandName').value=currentStudent.company;
      message('studentMessage',studentStateFailure?.code==='MIGRACION_PENDIENTE'?studentStateFailure.error:JOIN_SERVER_MESSAGE+' Tu sesión se conserva; volveremos a intentar la conexión.',true);
      return false;
    }
    studentSessionRecovering=false;studentStateFailure=null;message('studentMessage','');closeModal();
    await prepareLobby();return true;
  })().finally(()=>{studentSessionRecoveryTask=null;});
  return studentSessionRecoveryTask;
}

(async function restoreStudentSession(){
  // SIDE Lite restores sessions through its own authenticated API.
  return;
  let saved;try{saved=JSON.parse(sessionStorage.getItem('SIDE_STUDENT_SESSION')||'null');}catch{}
  if(!saved?.game?.codigo||!saved.company)return;
  const invitedCode=new URLSearchParams(window.location.search).get('partida');
  // A shared link to another room takes precedence over a previous student session.
  if(invitedCode&&admissionCode(invitedCode)!==admissionCode(saved.game.codigo))return;
  studentSnapshotEpoch++;currentStudent=saved;studentConnected=true;studentSessionRecovering=Boolean(saved.empresaId);studentProgressHydrated=!saved.empresaId;loadDecisionState();
  await resumeStudentSession();if(studentConnected)startStudentSync();
})();

// Shared links fill the join form; the game code is still verified by the server.
const invitationCode=new URLSearchParams(window.location.search).get('partida');
if(invitationCode){
  $('gameCode').value=admissionCode(invitationCode);showScreen('profiles');showModal('studentModal');
  if(!validAdmissionCode(invitationCode)){showAdmissionCodeError(JOIN_CODE_MESSAGE);message('studentMessage',JOIN_CODE_MESSAGE,true);}
}
// Preserve incomplete input while typing SIDE; canonicalize the full code on blur/submit.
$('gameCode')?.addEventListener('input',()=>{$('gameCode').value=String($('gameCode').value).replace(/\s+/g,'').toUpperCase();showAdmissionCodeError();message('studentMessage','');});
$('gameCode')?.addEventListener('blur',()=>{$('gameCode').value=admissionCode($('gameCode').value);});
window.addEventListener('online',()=>{renderStudentConnection();if(studentConnected)pollStudentGame();});
window.addEventListener('offline',()=>{studentMaterialSequence++;studentMaterialBook=null;studentMaterialStatus='Sin conexión. Datos de recepción no verificados / proyección no disponible.';if(studentConnected&&temporalStudentRoom())requestMaterialViewRefresh();});
window.addEventListener('offline',()=>{
  renderStudentConnection();
  // Losing connectivity does not turn an already acknowledged save into an
  // unsent one. The connection indicator handles offline state without jobs.
  if(studentSyncPending())showStudentSyncStatus('pending',{code:'FETCH_ERROR',error:'Sin conexión con el servidor.'});
});
if(supabaseClient)supabaseClient.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')showScreen('profiles')});
