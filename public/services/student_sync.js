/* Durable outbox for student snapshots and their normalized decisions/reports. */
(function(global){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  function snapshotSignature(value){
    const defaults={decision_state:{},cash_ledger:{},financial_sections:{},section_submissions:{},decisions_submitted:false,selected_character:null};
    return JSON.stringify(ordered(Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>[key,value?.[key]??fallback]))));
  }
  // Default prices belong to the engine configuration, not to student input.
  // An omitted key has exactly the same meaning in cierre.prices(). The older
  // database contract accepts implicit defaults but validates explicit prices
  // against the former editable ranges (including Medio >= 120).
  function withImplicitPrices(snapshot,defaults){
    const result=copy(snapshot);
    function compact(state){
      const meta=state?.PRODUCCION_META,prices=meta?.prices;
      if(!prices||typeof prices!=='object'||Array.isArray(prices))return;
      for(const [key,price] of Object.entries(prices)){
        if(Object.hasOwn(defaults,key)&&typeof price==='number'&&price===defaults[key])delete prices[key];
      }
      if(!Object.keys(prices).length)delete meta.prices;
    }
    compact(result.decision_state);
    for(const plan of Object.values(result.decision_state?.__cyclePlans||{}))compact(plan?.state);
    return result;
  }
  function pendingMessage(error){
    const base='Cambios guardados en este dispositivo. Sincronización pendiente.';
    if(!error)return base;
    const code=String(error.code||'').trim(),detail=String(error.error||error.message||'').replace(/\s+/g,' ').trim();
    if(code==='CICLO_PAUSADO')return base+' El docente debe reanudar el ciclo para recibir el envío.';
    if(/PGRST202|PGRST204|42883|42703/.test(code))return base+' El servidor necesita una actualización ('+code+'). Comunícalo al docente.';
    if(/CONEXION_TIMEOUT|FETCH_ERROR|CLIENTE_SUPABASE_NO_DISPONIBLE/.test(code)||/failed to fetch|network|timeout|conexión tardó|conexión con Supabase tardó/i.test(detail))return base+' No se pudo conectar con el servidor. Se reintentará automáticamente.';
    if(detail)return base+' Motivo: '+detail.slice(0,240)+(code?' ('+code+')':'');
    return base+(code?' Código: '+code+'.':'');
  }
  function createQueue(options){
    const {storage,context,saveSnapshot,saveOperation,readSnapshot,prepareSnapshot=value=>value,onRevision=()=>{},onConflict=()=>{},onRejected=()=>{},onStatus=()=>{}}=options;
    const storageKey='SIDE_STUDENT_SYNC_OUTBOX';
    let jobs=[];
    try{const stored=JSON.parse(storage.getItem(storageKey)||'[]');if(Array.isArray(stored))jobs=stored.filter(j=>j?.identityKey&&j.snapshot&&Array.isArray(j.operations));}catch{}
    let task=null,activeJob=null,retryTimer=null,attempts=0,nextAttempt=0;
    const now=options.now||Date.now,schedule=options.schedule||setTimeout,cancel=options.clearSchedule||clearTimeout;
    const retryMs=options.retryMs||[3000,6000,15000,30000,60000];
    function deferRetry(){
      const delay=retryMs[Math.min(attempts++,retryMs.length-1)];nextAttempt=now()+delay;
      if(retryTimer!==null)cancel(retryTimer);
      retryTimer=schedule(()=>{retryTimer=null;void flush();},delay);
      // A queued offline write must not keep a Node diagnostic process alive.
      retryTimer?.unref?.();
    }
    function persist(){
      try{storage.setItem(storageKey,JSON.stringify(jobs));return true;}
      catch(error){onStatus('storage-error',error);return false;}
    }
    const pending=(key=context().identityKey)=>jobs.some(j=>j.identityKey===key);
    function discard(key,backup=false){
      if(backup){
        try{storage.setItem('SIDE_STUDENT_SYNC_CONFLICT_'+key,JSON.stringify(jobs.filter(j=>j.identityKey===key)));}catch(error){onStatus('storage-error',error);}
      }
      jobs=jobs.filter(j=>j.identityKey!==key);persist();
    }
    function enqueue(snapshot,operation){
      const c=context();if(!c.connected||!c.identityKey)return Promise.resolve(false);
      const round=Math.max(1,Number(snapshot.round)||1);
      let job=jobs.find(j=>j!==activeJob&&j.identityKey===c.identityKey&&j.round===round);
      if(!job){job={identityKey:c.identityKey,identity:copy(c.identity),round,expectedRevision:c.revision,snapshot:copy(snapshot),operations:[],snapshotSaved:false};jobs.push(job);}
      job.snapshot=copy(prepareSnapshot(copy(snapshot)));job.snapshotSaved=false;
      if(operation){job.operations=job.operations.filter(op=>op.key!==operation.key);job.operations.push(copy(operation));}
      persist();onStatus('saving');return flush();
    }
    function mergeNewer(job){
      const newer=jobs.find(j=>j!==job&&j.identityKey===job.identityKey&&j.round===job.round);
      if(!newer)return;
      newer.expectedRevision=job.expectedRevision;
      const currentKeys=new Set(newer.operations.map(op=>op.key));
      newer.operations=[...job.operations.filter(op=>!currentKeys.has(op.key)),...newer.operations];
      jobs=jobs.filter(j=>j!==job);persist();
    }
    function flush({force=false}={}){
      if(task)return task;
      const c=context();
      if(!c.connected||!pending(c.identityKey))return Promise.resolve(!pending(c.identityKey));
      if(force){nextAttempt=0;if(retryTimer!==null)cancel(retryTimer);retryTimer=null;}
      if(now()<nextAttempt)return Promise.resolve(false);
      const active=()=>{const next=context();return next.connected&&next.identityKey===c.identityKey&&next.epoch===c.epoch;};
      task=Promise.resolve().then(async()=>{
        while(active()){
          const job=jobs.find(j=>j.identityKey===c.identityKey);if(!job)return true;
          activeJob=job;onStatus('saving');
          let result;
          try{
            if(!job.snapshotSaved){
              // Also repair durable jobs written by an older frontend. A reload
              // must retry the existing user's payload, not discard their work.
              job.snapshot=copy(prepareSnapshot(copy(job.snapshot)));persist();
              result=await saveSnapshot(copy(job.identity),copy(job.snapshot),job.expectedRevision);
              if(!active())return false;
              if(!result?.success)throw result||{error:'Respuesta de guardado vacía.'};
              const revision=Number(result.data?.snapshot_revision??result.data?.snapshotRevision??result.data?.revision);
              if(!Number.isSafeInteger(revision)||revision<=job.expectedRevision)throw {error:'Revisión de guardado inválida.'};
              job.expectedRevision=revision;job.snapshotSaved=true;
              for(const next of jobs)if(next.identityKey===job.identityKey)next.expectedRevision=revision;
              persist();onRevision(revision);
            }
            while(job.operations.length){
              result=await saveOperation(copy(job.identity),job.round,copy(job.operations[0]),job.expectedRevision);
              if(!active())return false;
              if(!result?.success)throw result||{error:'Respuesta de operación vacía.'};
              job.operations.shift();persist();
            }
            jobs=jobs.filter(j=>j!==job);persist();activeJob=null;
          }catch(error){
            if(!active())return false;
            if(error?.code==='ESTADO_DESACTUALIZADO'){
              // A server commit can succeed while its response is lost. A read
              // may acknowledge that exact snapshot; never adopt unrelated edits.
              if(!job.snapshotSaved&&readSnapshot){
                let remote;
                try{remote=await readSnapshot(copy(job.identity));}catch(readError){remote={success:false,error:readError};}
                if(!active())return false;
                if(!remote?.success){
                  if(remote?.code==='EMPRESA_EXPULSADA'&&!remote.technical){discard(c.identityKey,true);onStatus('rejected',remote);onRejected(remote);return false;}
                  mergeNewer(job);onStatus('pending',remote);deferRetry();return false;
                }
                const revision=Number(remote.data?.snapshot_revision);
                if(revision===job.expectedRevision+1&&remote.data?.snapshot&&snapshotSignature(prepareSnapshot(copy(remote.data.snapshot)))===snapshotSignature(job.snapshot)){
                  job.snapshotSaved=true;job.expectedRevision=revision;
                  for(const next of jobs)if(next.identityKey===job.identityKey)next.expectedRevision=revision;
                  persist();onRevision(revision);continue;
                }
              }
              discard(c.identityKey,true);onStatus('conflict',error);await onConflict();
            }else if(['CREDENCIALES_INVALIDAS','EMPRESA_EXPULSADA'].includes(error?.code)&&!error.technical){
              discard(c.identityKey,true);onStatus('rejected',error);onRejected(error);
            }else{mergeNewer(job);onStatus('pending',error);deferRetry();}
            return false;
          }
        }
        return false;
      }).then(result=>{if(result&&active()){attempts=0;nextAttempt=0;if(retryTimer!==null)cancel(retryTimer);retryTimer=null;onStatus('synced');}return result;}).finally(()=>{activeJob=null;task=null;});
      return task;
    }
    if(typeof global.addEventListener==='function')global.addEventListener('online',()=>{attempts=0;nextAttempt=0;if(retryTimer!==null)cancel(retryTimer);retryTimer=null;void flush();});
    return {enqueue,flush,pending,discard};
  }
  const api={createQueue,pendingMessage,withImplicitPrices};
  global.SIDE=global.SIDE||{};global.SIDE.StudentSync=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
