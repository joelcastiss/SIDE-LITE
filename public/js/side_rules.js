/* SIDE: shared, dependency-free rules for calendars and physical stores. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.SIDE_RULES = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORE_IDS = Object.freeze(['los_olivos', 'miraflores', 'sjl']);
  const COMMITMENT_CYCLES = 12;
  function positiveInteger(value, fallback = 1) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 1 ? n : fallback;
  }
  function localDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function cycleSchedule(config) {
    const count = Number(config.cycles), hours = Number(config.roundHours), minutes = Number(config.roundMinutes);
    if ((typeof config.cycles !== 'number' && typeof config.cycles !== 'string') || !Number.isInteger(count) || count < 1 || count > 6) return {error: 'El n\u00famero de ciclos debe ser un entero entre 1 y 6.', cycles: []};
    if (!Number.isSafeInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59 || hours*60+minutes < 1) {
      return {error: 'Indica una duraci\u00f3n de al menos 1 minuto; los minutos deben estar entre 0 y 59.', cycles: []};
    }
    const startValue = config.lifecycleVersion===2 ? config.gameStartAt||config.scheduledStart : config.scheduledStart;
    let start = startValue ? new Date(startValue).getTime() : NaN;
    if(config.lifecycleVersion===2&&!config.gameStartAt){
      start=(config.cycleCloseMode==='automatic'&&config.scheduledStart?start:Date.now())+Number(config.integrationDurationMinutes||5)*60000;
    }
    if (!Number.isFinite(start)) return {error: 'Selecciona la fecha y hora de inicio para ver el calendario por ciclos.', cycles: []};
    const duration = (hours*3600+minutes*60)*1000;
    const firstDuration = config.lifecycleVersion!==2&&Number(config.integrationMinutes)===60 ? 3600000 : duration;
    const end = start+firstDuration+(count-1)*duration;
    if (!Number.isFinite(new Date(end).getTime())) return {error: 'La duraci\u00f3n indicada supera el rango del calendario.', cycles: []};
    return {start, end, duration, total:end-start, cycles: Array.from({length:count}, (_,i)=>({round:i+1,start:i===0?start:start+firstDuration+(i-1)*duration,end:start+firstDuration+i*duration}))};
  }
  function schedulePosition(schedule, now = Date.now()) {
    if (!schedule || schedule.error || !schedule.cycles.length) return null;
    if (now < schedule.start) return {status:'scheduled',round:1,remaining:(schedule.cycles[0].end-schedule.start)/1000,startedAt:schedule.start};
    if (now >= schedule.end) return {status:'simulation-finished',round:schedule.cycles.length,remaining:0,startedAt:schedule.cycles.at(-1).start};
    const index = schedule.cycles.findIndex(c=>now<c.end), cycle=schedule.cycles[index];
    return {status:'running',round:index+1,remaining:Math.max(0,Math.ceil((cycle.end-now)/1000)),startedAt:cycle.start};
  }
  function isCancellationMarker(value){return value!=null&&!['','null','false','0'].includes(String(value).trim().toLowerCase());}
  function gameAccess(config={}, status={}, runtime={}, existing=false, now=Date.now()) {
    if(isCancellationMarker(config.cancelledAt)||isCancellationMarker(status.cancelledAt)||config.phase==='cancelled'||runtime.phase==='cancelled')return {round:Number(runtime.round||1),phase:'cancelled',cancelled:true,integration:false,canJoin:false,canOperate:false,reason:'La partida ha sido cancelada por el profesor. No se pueden enviar más decisiones. Puedes volver al inicio para ingresar a otra partida.'};
    if(runtime.status==='paused'&&!['results','finished','cancelled'].includes(runtime.phase))return {round:Number(runtime.round||config.round||1),phase:runtime.phase||'decisions',paused:true,canReview:true,integration:false,canJoin:existing,canOperate:false,remaining:Number(runtime.remaining)||0,reason:'Ciclo en pausa. Puedes revisar y preparar tus decisiones; guardar y enviar estará disponible cuando el docente reanude.'};
    if(config.lifecycleVersion===2){
      const phase=runtime.phase||config.phase||'integration',round=Number(runtime.round||config.round||1);
      const deadline=Date.parse(runtime.startedAt||'')+Number(runtime.duration)*1000;
      const expired=phase==='decisions'&&runtime.running&&((Number.isFinite(deadline)&&Number(runtime.duration)>0&&now>=deadline)||(!Number.isFinite(deadline)&&runtime.remaining!=null&&Number(runtime.remaining)===0));
      if(expired)return {round,phase,remaining:0,canReview:true,integration:false,canJoin:existing,canOperate:false,reason:'El tiempo del ciclo terminó. Tus decisiones guardadas se conservan; espera el cierre o el siguiente ciclo.'};
      const finished=phase==='finished'||Boolean(status.finishedAt);
      const integration=!finished&&phase==='integration';
      const remaining=integration&&config.gameStartAt?Math.max(0,Math.ceil((Date.parse(config.gameStartAt)-now)/1000)):null;
      return {round,phase,integration,remaining,canJoin:integration||existing,
        canOperate:!finished&&phase==='decisions',
        reason:finished?'La partida ha finalizado.':integration?'Sala de espera. El Ciclo 1 comenzará automáticamente al terminar el tiempo configurado.':phase==='results'?'Ciclo cerrado. Esperando el siguiente ciclo.':''};
    }
    // integrationMinutes===0 => sin período de integración; acceso inmediato al operar
    const intMin=Number(config.integrationMinutes);
    if(intMin!==60){
      const round=Number(runtime.round||config.round||1);
      const start=Date.parse(status.startedAt||config.gameStartedAt||runtime.startedAt||'');
      const started=Boolean(status.active)&&Number.isFinite(start)&&now>=start&&!['scheduled','simulation-finished'].includes(runtime.status);
      // En modo manual sin integración: canOperate apenas la partida esté activa
      // En modo automático sin integración: canOperate cuando el runtime dice round>=1 y está corriendo
      if(intMin===0){
        const phase=runtime.status;
        const canOp=started&&!['scheduled'].includes(phase)&&round>=1;
        return {round,integration:false,canJoin:started,canOperate:canOp,
          reason:status.finishedAt||phase==='simulation-finished'?'La partida ha finalizado.':!started?'La partida aún no está en curso. Espera a que el profesor la inicie.':'La partida está en curso. Puedes tomar decisiones.'};
      }
      return {canJoin:true,canOperate:true,integration:false,round};
    }
    let round=Number(runtime.round||config.round||1), phase=runtime.status;
    if(status.active&&config.cycleCloseMode==='automatic'){
      const position=schedulePosition(cycleSchedule(config),now);
      if(position){round=position.round;phase=position.status;}
    }
    const start=Date.parse(status.startedAt||config.gameStartedAt||runtime.startedAt||'');
    const started=Boolean(status.active)&&Number.isFinite(start)&&now>=start&&!['scheduled','simulation-finished'].includes(phase);
    const integration=started&&round===1;
    const admission=integration&&Number.isFinite(start)&&now<start+3600000&&phase!=='finished';
    return {round,integration,canJoin:started&&(existing||admission),canOperate:started&&round>1&&now>=start+3600000,
      reason:status.finishedAt||phase==='simulation-finished'?'La partida ha finalizado.':!started?'La partida aún no está en curso. Espera a que el profesor la inicie.':round===1?'Ciclo 1 · integración: solo ingreso y espera durante la primera hora.':'El ingreso de empresas nuevas cerró al terminar el ciclo 1.'};
  }
  // Proyección para la demostración local. En multijugador manda la respuesta RPC.
  function resolveRuntime(config, now=Date.now()) {
    let r={...config.runtime};
    if(config.lifecycleVersion!==2||['finished','cancelled'].includes(r.phase)||config.phase==='cancelled'||isCancellationMarker(config.cancelledAt))return r;
    if(config.cycleCloseMode==='automatic'){
      const plan=cycleSchedule(config),p=schedulePosition(plan,now);
      if(!p||p.status==='scheduled')return r;
      r={...r,...p,phase:p.status==='simulation-finished'?'finished':'decisions',running:p.status==='running',duration:plan.duration/1000,startedAt:new Date(p.startedAt).toISOString()};
    }else if(r.phase==='integration'&&config.gameStartAt&&now>=Date.parse(config.gameStartAt)){
      const duration=Math.max(60,(Number(config.roundHours??0)*60+Number(config.roundMinutes??10))*60);
      r={...r,phase:'decisions',status:'running',running:true,round:1,duration,remaining:duration,startedAt:config.gameStartAt};
      if(now>=Date.parse(r.startedAt)+duration*1000)r={...r,phase:'results',status:'finished',running:false,remaining:0};
    }else if(r.phase==='decisions'&&r.running&&now>=Date.parse(r.startedAt)+r.duration*1000){
      r={...r,phase:'results',status:'finished',running:false,remaining:0};
    }
    return r;
  }
  function podiumExpiry(publication) {
    return Date.parse(publication?.publishedAt||'')+24*60*60*1000;
  }
  function podiumVisible(publication, code, now=Date.now()) {
    return Boolean(publication)&&(!publication.code||publication.code===code)&&now<podiumExpiry(publication);
  }
  /* Old decisions only contain optionIds: a selected district means one store. */
  function storeQuantity(entry, id) {
    if (!STORE_IDS.includes(id) || !(entry?.optionIds || []).includes(id)) return 0;
    return positiveInteger(entry?.quantities?.[id], 1);
  }
  // Current decisions manage one physical store; legacy helpers remain available for history.
  function singleStoreSelection(entry = {}, round = 1) {
    const ids = [...new Set(entry.optionIds || [])];
    const stores = ids.filter(id => STORE_IDS.includes(id));
    const selected = stores.find(id => committedQuantity(entry,id,round)>0) || stores[0];
    const optionIds = ids.filter(id => !STORE_IDS.includes(id) || id === selected);
    const storeContracts = {};
    if (selected && entry.storeContracts?.[selected]) {
      const first = storeBatches(entry,selected,round).sort((a,b)=>a.round-b.round)[0];
      if (first) storeContracts[selected] = [{round:first.round,quantity:1}];
    }
    return {...entry,optionIds,quantities:selected?{[selected]:1}:{},storeContracts};
  }
  function storeCount(entry) { return STORE_IDS.reduce((sum,id)=>sum+storeQuantity(entry,id),0); }
  function storeBatches(entry, id, round = 1) {
    const quantity = storeQuantity(entry,id);
    if (!quantity) return [];
    const batches = entry?.storeContracts?.[id];
    if (Array.isArray(batches) && batches.length) {
      const valid = batches.filter(b=>Number.isInteger(b.round)&&b.round>=1&&Number.isSafeInteger(b.quantity)&&b.quantity>0);
      if (valid.reduce((s,b)=>s+b.quantity,0) === quantity) return valid.map(b=>({...b}));
    }
    return [{round:positiveInteger(entry?.optionRounds?.[id]??entry?.round,round),quantity}];
  }
  function committedQuantity(entry, id, round, term = COMMITMENT_CYCLES) {
    return storeBatches(entry,id,round).reduce((sum,b)=>sum+(b.round<round && round-b.round<term ? b.quantity : 0),0);
  }
  function remainingCommitment(entry, id, round, term = COMMITMENT_CYCLES) {
    return Math.max(0,...storeBatches(entry,id,round).filter(b=>b.round<round).map(b=>term-(round-b.round)));
  }
  /* Drafts saved again in the same cycle replace that cycle's openings. */
  function nextStoreBatches(previous, id, quantity, round, term = COMMITMENT_CYCLES) {
    const wanted = quantity === 0 ? 0 : positiveInteger(quantity,0);
    const floor = committedQuantity(previous,id,round,term);
    if (wanted < floor) throw new RangeError('No se pueden cerrar tiendas con contrato vigente.');
    let batches = storeBatches(previous,id,round).filter(b=>b.round<round);
    let remove = Math.max(0,batches.reduce((s,b)=>s+b.quantity,0)-wanted);
    batches = batches.map(b=>{
      if (round-b.round<term || !remove) return b;
      const cut=Math.min(remove,b.quantity);remove-=cut;
      return {...b,quantity:b.quantity-cut};
    }).filter(b=>b.quantity>0);
    const add=wanted-batches.reduce((s,b)=>s+b.quantity,0);
    if (add>0) batches.push({round,quantity:add});
    return batches;
  }
  return Object.freeze({STORE_IDS,COMMITMENT_CYCLES,positiveInteger,localDate,cycleSchedule,schedulePosition,isCancellationMarker,gameAccess,resolveRuntime,podiumExpiry,podiumVisible,storeQuantity,singleStoreSelection,storeCount,storeBatches,committedQuantity,remainingCommitment,nextStoreBatches});
});
