/**
 * partida_service.js
 * ---------------------------------------------------------------------------
 * Servicio de partidas (sesiones de juego del profesor).
 *
 * Responsabilidad ÚNICA: operaciones sobre la tabla `partidas` y sus RPCs.
 * No toca empresas, decisiones ni UI.
 *
 * Funciones:
 *   - buscarPorCodigo(codigo)        → RPC buscar_partida_por_codigo
 *   - crear(datos)                   → INSERT en partidas
 *   - avanzarCiclo(partidaId)        → RPC avanzar_ciclo
 *   - finalizar(partidaId)           → estado 'finalizada' (libera el cupo)
 *   - listarParticipantes(partidaId) → participantes + empresa de la partida
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/partida_service
 */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory;else factory(window);})(function initPartidaService(global) {
  'use strict';

  /** @returns {object|null} Cliente Supabase o null si offline. */
  function client() {
    const c = global.SIDE && global.SIDE.SupabaseClient
      ? global.SIDE.SupabaseClient.get()
      : null;
    return c;
  }

  /** Respuesta estándar cuando no hay conexión. */
  function offline() {
    return { success: false, offline: true, error: 'Supabase no disponible (modo local).' };
  }

  const creationMigration = 'supabase/migrations/2026-10-11_fix_crear_partida.sql';
  const recoveryMigration = 'supabase/migrations/2026-10-11_recuperar_salas_compatibles.sql';
  function normalizeRoom(data){
    if(data?.configuracion){
      const config={...data.configuracion};
      if(config.lifecycleVersion==='2')config.lifecycleVersion=2;
      if('cancelledAt' in config&&(config.cancelledAt==null||['','null','false','0'].includes(String(config.cancelledAt).trim().toLowerCase())))delete config.cancelledAt;
      return {...data,configuracion:config};
    }
    return data;
  }
  function roomDetail(data) {
    return JSON.stringify({tipo:Array.isArray(data)?'array':typeof data,id:data?.id||null,codigo:data?.codigo||null,
      estado:data?.estado||null,lifecycleVersion:data?.configuracion?.lifecycleVersion||null,
      fase:data?.configuracion?.runtime?.phase||null,gameStartAt:data?.configuracion?.gameStartAt||null,
      serverTime:data?.serverTime||null},null,2);
  }
  function roomContractError(data,recoverable=false) {
    const identity=data?.id&&data.codigo&&['esperando','activa'].includes(data.estado);
    const legacy=identity&&data.configuracion?.lifecycleVersion!==2;
    if(recoverable&&identity){
      return creationError(null,{error:'La partida necesita recuperar su configuración y su reloj del servidor.',
        code:legacy?'SALA_ANTIGUA':'SALA_INCONSISTENTE',partida:data,technicalDetail:roomDetail(data)});
    }
    return creationError(null,{error:'Supabase devolvió una respuesta de sala incompleta. Verifica la instalación de 20261009_sala_espera_identidad_exacta.sql y 2026-10-11_fix_crear_partida.sql.',
      code:'CONTRATO_SALA',technicalDetail:roomDetail(data)});
  }
  function validRoom(data) {
    const phase=data?.configuracion?.runtime?.phase;
    return !!(data?.id&&data.codigo&&data.configuracion?.lifecycleVersion===2&&
      Number.isFinite(Date.parse(data.serverTime||''))&&
      (data.estado==='esperando'?phase==='integration'&&Number.isFinite(Date.parse(data.configuracion.gameStartAt||'')):
        data.estado==='activa'&&['decisions','results'].includes(phase)));
  }
  function creationError(error, data) {
    const code=error?.code||data?.code;
    const message=error?.message||data?.error||'El servidor no devolvió una sala válida.';
    const missing=/PGRST202|PGRST204|42883|42703/.test(code||'');
    console.error('SIDE: crear/recuperar sala:', error||data);
    return {success:false,code:missing?'MIGRACION_PENDIENTE':code,error:missing?'Falta actualizar la base de datos: ejecuta '+creationMigration+'.':message,data:data?.partida||data?.id&&data||undefined,migrationMissing:missing,technicalDetail:data?.technicalDetail};
  }
  function requestUuid() {
    if(global.crypto?.randomUUID)return global.crypto.randomUUID();
    if(!global.crypto?.getRandomValues)throw new Error('No se pudo generar la solicitud. Recarga el panel desde una conexión segura.');
    const bytes=global.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
    return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  }
  async function obtenerActiva() {
    const sb=client();if(!sb)return offline();
    try {
      const {data:response,error}=await sb.rpc('obtener_sala_docente');
      const data=normalizeRoom(response);
      if(error||data?.error)return creationError(error,data);
      if(data&&!validRoom(data))return roomContractError(data,true);
      return {success:true,data:data||null};
    } catch(error){return creationError(error);}
  }
  async function recuperarSala(partidaId,config=null){
    const sb=client();if(!sb)return offline();
    if(!partidaId)return {success:false,error:'No se pudo identificar la partida.'};
    try{
      const {data:response,error}=await sb.rpc('recuperar_sala_docente',{p_partida_id:partidaId,p_config:config});
      if(error||response?.error){
        if(/PGRST202|42883|42703/.test(error?.code||''))return {success:false,code:'MIGRACION_RECUPERACION_PENDIENTE',error:'Falta actualizar Supabase: ejecuta '+recoveryMigration+'.',technicalDetail:error.message};
        return creationError(error,response);
      }
      const data=normalizeRoom(response);
      if(data?.id===partidaId&&data.estado==='finalizada')return {success:true,data:null,terminal:true};
      if(!validRoom(data))return roomContractError(data,false);
      if(data.id!==partidaId)return {success:false,error:'Supabase devolvió otra partida al recuperar la sala.'};
      return {success:true,data};
    }catch(error){return creationError(error);}
  }

  /**
   * Busca una partida en estado 'esperando' por su código (ej. SIDE-WG2).
   * @param {string} codigo Código de partida.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { id, codigo, nombre, curso, estado, segmento } o null si no existe.
   */
  async function buscarPorCodigo(codigo) {
    const sb = client();
    if (!sb) return offline();
    const code = String(codigo || '').trim().toUpperCase();
    if (!code) return { success: false, error: 'Código vacío.' };
    try {
      const { data, error } = await sb.rpc('buscar_partida_por_codigo', { p_codigo: code });
      if (error) return { success: false, error: error.message };
      const found = Array.isArray(data) ? data[0] : data;
      return { success: true, data: found || null };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Crea una partida nueva para el profesor autenticado.
   * @param {object} datos { nombre, curso, segmento?, configuracion?, eventos_habilitados? }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = fila creada (incluye id y codigo generado SIDE-WG2).
   */
  async function crear(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    if (!d.nombre) return { success: false, error: 'Falta el nombre de la partida.' };
    try {
      const { data: userData, error: userError } = await sb.auth.getUser();
      if (userError || !userData || !userData.user) {
        if(userError)console.error('SIDE: sesión al crear sala:',userError);
        return { success: false, error: 'Debes iniciar sesión como profesor.' };
      }
      if(d.configuracion?.lifecycleVersion===2){
      const {data:admissionFeatures,error:admissionFeatureError}=await sb.rpc('side_admission_features');
      if(admissionFeatureError)console.error('SIDE: comprobar admisión:',admissionFeatureError);
      if(admissionFeatureError&&!/PGRST202|42883/.test(admissionFeatureError.code||''))return {success:false,error:'No se pudo comprobar la conexión con Supabase. Intenta nuevamente.',code:admissionFeatureError.code};
      if(admissionFeatureError||admissionFeatures?.waitingRoomVersion!==3||admissionFeatures?.exactIdentityVersion!==2)return {success:false,code:'MIGRACION_PENDIENTE',error:'Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase.'};

        const {data:features,error:featuresError}=await sb.rpc('side_game_features');
        if(featuresError)console.error('SIDE: comprobar lifecycle:',featuresError);
        if(featuresError&&!/PGRST202|42883/.test(featuresError.code||''))return {success:false,error:featuresError.message||'No se pudo comprobar Supabase. Vuelve a intentarlo.'};
        if(featuresError||features?.observationsVersion!==1)return {success:false,error:'Actualiza Supabase con supabase/migrations/supabase_game_lifecycle.sql para habilitar cancelación y eventos sin repetición.'};
        if(features?.gameCodeVersion!==2)return {success:false,error:'Actualiza Supabase con supabase/migrations/supabase_game_codes.sql para habilitar códigos como SIDE-WG2.'};
        // Read-only readiness check: do not leave an unusable lobby in an old DB.
        const {error:readinessError}=await sb.rpc('controlar_partida',{p_partida_id:null,p_accion:'sincronizar'});
        if(readinessError)console.error('SIDE: comprobar firma controlar_partida:',readinessError);
        if(readinessError)return {success:false,error:/PGRST202|42883/.test(readinessError.code||'')?'Aplica supabase/migrations/supabase_game_lifecycle.sql en Supabase antes de crear partidas.':readinessError.message};
      }
      const payload = {
        profesor_id: userData.user.id,
        nombre: d.nombre,
        curso: d.curso || null,
        segmento: d.segmento || 'Estandar',
        configuracion: d.configuracion || {},
        eventos_habilitados: d.eventos_habilitados || []
      };
      if(d.configuracion?.lifecycleVersion===2){
        const {data:response,error}=await sb.rpc('crear_sala_docente',{
          p_config:payload.configuracion,p_nombre:payload.nombre,p_curso:payload.curso||'',p_segmento:payload.segmento,
          p_request_id:d.requestId||requestUuid(),p_reemplazar_id:null
        });
        const data=normalizeRoom(response);
        if(error||data?.error)return creationError(error,data);
        const phase=data?.configuracion?.runtime?.phase;
        if(data?.estado==='finalizada'||['cancelled','finished'].includes(phase))return creationError(null,{error:'La sala de esa solicitud ya terminó. Pulsa Reintentar para crear una nueva.',code:'SOLICITUD_FINALIZADA',partida:data});
        if(!validRoom(data))return roomContractError(data,true);
        return {success:true,data};
      }
      const { data, error } = await sb.from('partidas').insert(payload).select().single();
      if (error) return creationError(error);
      return { success: true, data };
    } catch (err) {
      return creationError(err);
    }
  }

  /**
   * Avanza el ciclo de todas las empresas de una partida (solo el dueño).
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { success: true, nuevo_ciclo: number }.
   */
  async function avanzarCiclo(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { data, error } = await sb.rpc('avanzar_ciclo', { p_partida_id: partidaId });
      if (error) return { success: false, error: error.message };
      if (data && data.error) return { success: false, error: data.error };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Lista los participantes de una partida con los datos de su empresa.
   * Requiere sesión de profesor dueño (RLS "profesor ve participantes").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   *   data = [{ id, nombre, empresa, empresa_id,
   *             empresas: { id, nombre_legal, nombre_comercial,
   *                         caja_actual, ciclo_actual, reputacion } }].
   */
  async function listarParticipantes(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      let { data, error } = await sb
        .from('participantes')
        .select('id, nombre, empresa, empresa_id, puntaje_docente, last_seen_at, expulsada_at, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)')
        .eq('partida_id', partidaId)
        .order('created_at', { ascending: true });
      if(error&&/expulsada_at/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, puntaje_docente, last_seen_at, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if(error&&/last_seen_at/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, puntaje_docente, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if(error&&/puntaje_docente/.test(error.message||'')){
        ({data,error}=await sb.from('participantes').select('id, nombre, empresa, empresa_id, empresas(id, nombre_legal, nombre_comercial, caja_actual, ciclo_actual, reputacion)').eq('partida_id',partidaId).order('created_at',{ascending:true}));
      }
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  async function expulsarEmpresa(partidaId,empresaId,expulsar=true) {
    const sb=client();if(!sb)return offline();
    if(!partidaId||!empresaId)return {success:false,error:'No se pudo identificar la empresa de esta partida.'};
    try {
      const {data,error}=await sb.rpc('side_expulsar_empresa',{p_partida_id:partidaId,p_empresa_id:empresaId,p_expulsar:expulsar});
      if(error){const missing=/PGRST202|42883|42703/.test(error.code||'');return {success:false,migrationMissing:missing,error:missing?'Aplica supabase/migrations/2026-10-21_expulsion_empresa.sql en Supabase para eliminar empresas de la partida.':error.message};}
      if(!data?.success)return {success:false,code:data?.code,error:data?.error||'No se pudo confirmar la expulsión de la empresa.'};
      return {success:true,data};
    }catch(error){return {success:false,error:error?.message||'No se pudo conectar con el servidor.'};}
  }

  /**
   * Marca una partida como finalizada (libera el cupo de partida única).
   * Solo el profesor dueño puede (RLS "profesor actualiza sus partidas").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function finalizar(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { error } = await sb.from('partidas').update({ estado: 'finalizada' }).eq('id', partidaId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Lee una partida por id (para validar si sigue activa).
   * Solo el profesor dueño puede (RLS "profesor ve sus partidas").
   * @param {string} partidaId UUID de la partida.
   * @returns {Promise<{success: boolean, data?: object|null, error?: string}>}
   *   data = { id, codigo, nombre, curso, estado } o null si no existe.
   */
  async function obtener(partidaId) {
    const sb = client();
    if (!sb) return offline();
    if (!partidaId) return { success: false, error: 'Falta partidaId.' };
    try {
      const { data, error } = await sb.from('partidas')
        .select('id, codigo, nombre, curso, estado, configuracion')
        .eq('id', partidaId).maybeSingle();
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || null };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  async function actualizarConfiguracion(partidaId, configuracion, expectedRevision) {
    if(expectedRevision!==undefined){
      const sb=client();if(!sb)return offline();
      try{
        const {data,error}=await sb.rpc('side_guardar_configuracion_v19',{p_partida_id:partidaId,p_config:configuracion,p_expected_revision:expectedRevision});
        return error||data?.error?{success:false,error:error?.message||data.error,code:error?.code||data.code,configRevision:data?.config_revision}:{success:true,data};
      }catch(error){return {success:false,error:error.message};}
    }
    if(configuracion.lifecycleVersion===2)return controlar(partidaId,'guardar',configuracion);
    const sb=client();if(!sb)return offline();
    try{
      const {error}=await sb.from('partidas').update({configuracion,eventos_habilitados:configuracion.enabledEvents||[]}).eq('id',partidaId);
      return error?{success:false,error:error.message}:{success:true};
    }catch(error){return {success:false,error:error.message};}
  }
  global.SIDE = global.SIDE || {};
  async function guardarPuntaje(partidaId,empresaId,puntaje){
    const sb=client();if(!sb)return offline();
    if(!partidaId||!empresaId)return {success:false,error:'Falta identificar la partida o la empresa para guardar la nota.'};
    if(!Number.isFinite(puntaje)||puntaje<0||puntaje>20)return {success:false,error:'La nota debe estar entre 0 y 20.'};
    try{
      const {data,error}=await sb.rpc('guardar_puntaje_docente',{p_partida_id:partidaId,p_empresa_id:empresaId,p_puntaje:puntaje});
      if(error||data?.error){
        const missing=/^(PGRST202|PGRST204|42703|42883)$/.test(String(error?.code||''));
        return {success:false,error:missing?'Falta configurar las notas en Supabase. Aplica supabase/migrations/20260929_guardar_puntaje_docente.sql.':error?.message||data.error};
      }
      if(data?.success!==true||data.puntaje==null||Number(data.puntaje)!==Math.round(puntaje*100)/100)return {success:false,error:'Supabase no confirmó el guardado de la nota. Vuelve a intentarlo.'};
      return {success:true,puntaje:Number(data.puntaje)};
    }
    catch(error){return {success:false,error:error.message};}
  }
  async function controlar(partidaId,accion,config=null,expectedRound=null){
    const sb=client();if(!sb)return offline();
    try{
      const {data,error}=await sb.rpc('controlar_partida',{p_partida_id:partidaId,p_accion:accion,p_config:config,p_expected_round:expectedRound});
      if(!error&&!data?.error&&accion==='guardar'&&config?.eventRules&&JSON.stringify(config.eventRules)!==JSON.stringify(data?.configuracion?.eventRules||{})){
        // JSONB can reorder keys; compare each rule instead of its serialization.
        const saved=data?.configuracion?.eventRules||{};
        if(Object.entries(config.eventRules).some(([id,rule])=>saved[id]?.firstRound!==rule.firstRound||saved[id]?.repeat!==rule.repeat))return {success:false,error:'No se guardaron las reglas de eventos. Actualiza supabase/migrations/supabase_game_lifecycle.sql en Supabase.'};
      }
      return error||data?.error?{success:false,error:error?.message||data.error}:{success:true,data};
    }catch(error){return {success:false,error:error.message};}
  }
  async function cancelar(partidaId){
    const sb=client();if(!sb)return offline();
    if(!partidaId)return {success:false,error:'No se pudo identificar la partida.'};
    let timer;
    try{
      const response=await Promise.race([
        sb.rpc('cancelar_partida',{p_partida_id:partidaId}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La cancelación tardó demasiado. Comprueba la conexión y vuelve a intentarlo.')),15000);})
      ]);
      const {data,error}=response;
      if(error||data?.error){
        console.error('SIDE: cancelar partida:',error||data);
        const missing=/PGRST202|42883/.test(error?.code||'');
        return {success:false,code:error?.code||data?.code,error:missing?'Actualiza Supabase con supabase/migrations/2026-10-12_salas_codigo.sql para cancelar partidas.':error?.message||data.error};
      }
      if(data?.id!==partidaId||data?.estado!=='cancelada')return {success:false,error:'Supabase no confirmó la cancelación. Vuelve a consultar la sala antes de reintentar.'};
      return {success:true,data:normalizeRoom(data)};
    }catch(error){console.error('SIDE: cancelar partida:',error);return {success:false,error:error.message};}
    finally{clearTimeout(timer);}
  }
  async function consultarCierreNegocio(partidaId,ciclo){
    const sb=client();if(!sb)return offline();
    try{
      const {data,error}=await sb.rpc('side_consultar_cierre_negocio',{p_partida_id:partidaId,p_ciclo:ciclo});
      if(error||data?.error)return {success:false,error:/PGRST202|42883/.test(error?.code||'')?'Falta desplegar el cierre automático de servidor (20261028_cierre_servidor.sql).':error?.message||data.error,code:error?.code||data.code};
      return {success:true,pending:!!data.pending,data:data.cierre};
    }catch(error){return {success:false,error:error.message};}
  }
  async function cerrarNegocio(partidaId,ciclo){
    const sb=client();if(!sb)return offline();
    try{
      const context=await sb.rpc('side_contexto_cierre_negocio',{p_partida_id:partidaId,p_ciclo:ciclo});
      // No confirmed company is a provisional no-op, never an empty persisted
      // closure. The teacher can continue and synchronization retries later.
      if(!context.error&&['SIN_PLANES_CONFIRMADOS','PLANES_EN_GRACIA'].includes(context.data?.code))return {success:true,pending:true,data:null,code:context.data.code};
      if(context.error||context.data?.error)return {success:false,error:context.error?.message||context.data.error,code:context.error?.code||context.data.code,migrationMissing:/PGRST202|42883/.test(context.error?.code||'')};
      const ctx=context.data;if(ctx.cierre)return {success:true,data:ctx.cierre,reused:true};
      if(!['number','string'].includes(typeof ctx.financialConfig?.cycles)||!Number.isInteger(Number(ctx.financialConfig.cycles))||Number(ctx.financialConfig.cycles)<1||Number(ctx.financialConfig.cycles)>6)return {success:false,code:'DURACION_INVALIDA',error:'La sala no tiene una duración válida en ciclos; no se puede liquidar el impuesto.'};
      if(!Number.isInteger(Number(ciclo))||Number(ciclo)<1||Number(ciclo)>Number(ctx.financialConfig.cycles))return {success:false,code:'CICLO_INVALIDO',error:'El ciclo solicitado está fuera de la duración configurada.'};
      // No temporal game may silently fall back to instant purchases while
      // verified order persistence and financial settlement are unavailable.
      const temporal=!!ctx.financialConfig?.materialRulesVersion&&ctx.financialConfig.materialRulesVersion!=='legacy-instant',materialBooks={};
      if(temporal){
        if(ctx.financialConfig.materialRulesVersion!=='receipts-v1')return {success:false,code:'VERSION_MATERIALES_INVALIDA',error:'Versión de materiales desconocida.'};
        if(!['cash','credit'].includes(ctx.financialConfig.materialPaymentMode))return {success:false,code:'RECEPCIONES_NO_DISPONIBLES',error:'La modalidad de compra de materiales no está configurada.'};
        if(ctx.financialConfig.supplierCreditTermCycles!=null&&(!Number.isInteger(Number(ctx.financialConfig.supplierCreditTermCycles))||Number(ctx.financialConfig.supplierCreditTermCycles)<1))return {success:false,code:'PLAZO_PROVEEDOR_INVALIDO',error:'El plazo de crédito a proveedores debe ser un entero positivo.'};
        for(const company of ctx.empresas||[]){
          const facts=await sb.rpc('side_material_context_v1',{p_partida_id:partidaId,p_empresa_id:company.id,p_cutoff_day:Number(ciclo)*30-1});
          if(facts.error||facts.data?.error||!facts.data?.revision||String(facts.data.companyId)!==String(company.id)||!facts.data.events||typeof facts.data.events!=='object'||Array.isArray(facts.data.events))return {success:false,code:'ORDENES_NO_VERIFICADAS',error:'No se pudo recuperar el libro de órdenes verificado para la empresa.'};
          if(Object.values(facts.data.events).some(e=>e?.type==='order'&&e.paymentMode!==ctx.financialConfig.materialPaymentMode))return {success:false,code:'ORDENES_NO_VERIFICADAS',error:'La modalidad de pago de la orden no coincide con la configuración.'};
          materialBooks[String(company.id)]=facts.data;
        }
      }
      // Prior economic state comes only from the immutable server closure. The
      // snapshot is a transport for decisions, never an accounting authority.
      let prior={};
      if(Number(ciclo)>1){
        const previous=await sb.rpc('side_contexto_cierre_negocio',{p_partida_id:partidaId,p_ciclo:Number(ciclo)-1});
        if(previous.error||previous.data?.error||!previous.data?.cierre?.resultadosPorEmpresa)
          return {success:false,code:'CIERRE_ANTERIOR_REQUERIDO',error:'El cierre anterior no está disponible para verificar los saldos.'};
        prior=previous.data.cierre.resultadosPorEmpresa;
      }
      const inputs=[];
      for(const company of ctx.empresas||[]){
        const snapshot=company.snapshot||{},state=snapshot.decision_state||{},saved=state.__cyclePlans?.[ciclo];
        if(!saved)continue;
        // Event effects and migrated opening balances currently lack an independent
        // server-verifiable source. Refuse rather than discard legitimate amounts.
        if((state.__cycleBusiness?.[ciclo]?.events||[]).length || (Number(ciclo)===1&&state.__openingBalance))
          return {success:false,code:'DATOS_ECONOMICOS_NO_VERIFICADOS',error:'No se puede verificar el saldo inicial o los eventos de este ciclo.'};
        const previous=prior[company.id];
        if(Number(ciclo)>1&&!previous?.state)return {success:false,code:'SALDO_ANTERIOR_NO_VERIFICADO',error:'Falta el estado anterior de una empresa.'};
        if(temporal&&Number(ciclo)>1){
          const oldBook=previous?.state?.__materialOrders,currentBook=materialBooks[String(company.id)],start=(Number(ciclo)-1)*30;
          if(!oldBook?.events||!currentBook?.events)return {success:false,code:'ORDENES_NO_VERIFICADAS',error:'Falta el libro de órdenes del cierre anterior.'};
          const past=book=>Object.fromEntries(Object.entries(book.events).filter(([,e])=>e?.type==='order'?Number(e.orderedDay)<start:e?.type==='receipt'&&Number(e.day)<start).sort(([a],[b])=>a.localeCompare(b)).map(([id,e])=>[id,Object.fromEntries(Object.entries(e).sort(([a],[b])=>a.localeCompare(b)))]));
          if(JSON.stringify(past(oldBook))!==JSON.stringify(past(currentBook)))return {success:false,code:'RECEPCIONES_ANTERIORES_NO_VERIFICADAS',error:'El libro contiene cambios para un ciclo ya cerrado; requiere reconciliación.'};
        }
        // Purchase entries from earlier cycles describe assets already owned, not
        // decisions for this cycle. They may only reproduce the last closure.
        // Unverifiable legacy histories require review instead of creating assets.
        for(const item of global.SIDE_DECISION_CATALOG.flatMap(category=>category.items||[]).filter(item=>item.asset||item.id==='MOLDE')){
          const submitted=saved.state?.[item.id]?.purchases||{}, authoritative=previous?.state?.[item.id]?.purchases||{};
          if(Object.keys(submitted).some(r=>!/^[1-9]\d*$/.test(r)||!Number.isSafeInteger(Number(r))||String(Number(r))!==r))return {success:false,code:'DECISION_INVALIDA',error:'Ciclo de adquisición inválido.'};
          const older=value=>Object.fromEntries(Object.entries(value).filter(([r])=>Number.isInteger(Number(r))&&Number(r)<Number(ciclo)).map(([r,rows])=>[String(Number(r)),Object.fromEntries(Object.entries(rows||{}).filter(([,v])=>Number(v)!==0).sort(([a],[b])=>a.localeCompare(b)))]).sort(([a],[b])=>Number(a)-Number(b)));
          if(JSON.stringify(older(submitted))!==JSON.stringify(older(authoritative)))return {success:false,code:'HISTORIAL_ACTIVOS_NO_VERIFICADO',error:'El historial de adquisiciones no coincide con el último cierre y requiere revisión.'};
        }
        const decisions=Object.fromEntries(Object.entries(saved.state||{}).filter(([key])=>!key.startsWith('__')));
        // Validate submitted decision inputs at the trusted worker boundary. Do
        // not allow malformed quantities to be silently clamped by the model.
        const invalid=(message)=>({success:false,code:'DECISION_INVALIDA',error:message});
        const finiteNonnegative=value=>((typeof value==='number')||(typeof value==='string'&&value.trim()!==''))&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=Number.MAX_SAFE_INTEGER/100;
        const safeInteger=value=>((typeof value==='number')||(typeof value==='string'&&value.trim()!==''))&&Number.isSafeInteger(Number(value));
        // Selection ids are decisions, not a trusted catalog: reject unknown or
        // duplicate options before costs and production are evaluated.
        for(const item of global.SIDE_DECISION_CATALOG.flatMap(category=>category.items||[])){
          const selected=decisions[item.id]?.optionIds;if(selected==null)continue;
          const allowed=new Set((item.options||[]).map(option=>option.id));
          if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.some(id=>!allowed.has(id)))return invalid('Selección inválida en '+item.id+'.');
        }
        for(const id of ['PERS_CORTE','PERS_ENSAMBLE','PERS_ACABADO','CUERO','ACCESORIOS','HILO']){
          const entry=decisions[id];if(!entry)continue;
          const definition=global.SIDE_DECISION_CATALOG.flatMap(category=>category.items||[]).find(item=>item.id===id);
          const allowed=new Set((definition?.options||[]).map(option=>option.id));
          for(const [option,value] of Object.entries(entry.quantities||{}))if(!allowed.has(option)||!finiteNonnegative(value)||(!definition?.material&&!Number.isInteger(Number(value))))return invalid('Cantidad u opción inválida en '+id+'.');
        }
        // Validate the current asset ledger against the catalog and the previous
        // server closure. Sales of owned machinery remain allowed, but may not
        // dispose of more than the verified holdings.
        for(const item of global.SIDE_DECISION_CATALOG.flatMap(category=>category.items||[]).filter(item=>item.asset||item.id==='MOLDE')){
          const entry=decisions[item.id];if(!entry)continue;
          const allowed=new Set((item.options||[]).map(option=>option.id));
          if(!Array.isArray(entry.optionIds??[])||(entry.optionIds||[]).some(id=>!allowed.has(id)))return invalid('Opción de activo inválida en '+item.id+'.');
          const previousPurchases=previous?.state?.[item.id]?.purchases||{};
          const entryRound=Number(entry.round);
          if(!Number.isInteger(entryRound)||entryRound<1||entryRound>Number(ciclo))return invalid('Ciclo de activo inválido en '+item.id+'.');
          // Legacy entries without a purchase ledger must match the authoritative
          // previous closure. Otherwise their old round could mint free assets.
          if(entryRound<Number(ciclo)&&!entry.purchases){
            const past=previous?.state?.[item.id];
            if(!past||JSON.stringify(entry)!==JSON.stringify(past))return {success:false,code:'HISTORIAL_ACTIVOS_NO_VERIFICADO',error:'El activo antiguo requiere reconciliación.'};
          }

          for(const [round,rows] of Object.entries(entry.purchases||{})){
            if(!/^[1-9]\d*$/.test(round)||!Number.isSafeInteger(Number(round))||String(Number(round))!==round||Number(round)>Number(ciclo)||!rows||typeof rows!=='object'||Array.isArray(rows))return invalid('Historial de activo inválido en '+item.id+'.');
            for(const [option,value] of Object.entries(rows)){
              if(!allowed.has(option)||!safeInteger(value))return invalid('Cantidad de activo inválida en '+item.id+'.');
              if(Number(round)===Number(ciclo)){
                const owned=Object.entries(previousPurchases).filter(([r])=>Number(r)<Number(ciclo)).reduce((sum,[,r])=>sum+Number(r?.[option]||0),0);
                if(Number(value)<-Math.max(0,owned))return invalid('Venta de activo superior a la cantidad disponible.');
                if(item.id==='MOLDE'&&Number(value)<0)return invalid('No se puede liquidar un molde.');
              }
            }
          }
          for(const [option,value] of Object.entries(entry.quantities||{}))if(!allowed.has(option)||!safeInteger(value))return invalid('Cantidad de activo inválida en '+item.id+'.');
        }
        for(const [id,value] of Object.entries(decisions.PRODUCCION_META?.moldTargets||{}))if(!['molde_1','molde_2','molde_3'].includes(id)||!finiteNonnegative(value)||!Number.isInteger(Number(value)))return invalid('Plan de producción inválido.');
        for(const [id,value] of Object.entries(decisions.PRODUCCION_META?.prices||{}))if(!['esencial','urbano','premium'].includes(id)||!finiteNonnegative(value))return invalid('Precio de venta inválido.');
        if(decisions.INV_MARKETING?.value!=null&&(!finiteNonnegative(decisions.INV_MARKETING.value)||Number(decisions.INV_MARKETING.value)>10000))return invalid('La publicidad debe estar entre S/ 0 y S/ 10,000.');
        if(decisions.PRESTAMO?.amount!=null&&!finiteNonnegative(decisions.PRESTAMO.amount))return invalid('Préstamo inválido.');
        // The initial credit line is an explicit existing game rule; the UI
        // applies the same 70% of initial capital, rounded down to S/ 500.
        if(Number(ciclo)===1&&decisions.PRESTAMO?.amount!=null){const credit=Math.floor(Math.max(0,Number(company.capital)||0)*0.7/500)*500;if(Number(decisions.PRESTAMO.amount)>credit)return invalid('El préstamo supera la línea inicial disponible.');}
        const channels=decisions.CANALES||{},validPoints=new Set((channels.optionIds||[]).filter(x=>x==='web'));
        for(const zone of ['miraflores','los_olivos','sjl'])if((channels.optionIds||[]).includes(zone)){
          const quantity=channels.quantities?.[zone]??1;if(!finiteNonnegative(quantity)||!Number.isInteger(Number(quantity))||Number(quantity)<1)return invalid('Cantidad de tiendas inválida.');
          validPoints.add(zone);
        }
        if((channels.optionIds||[]).some(x=>!['web','miraflores','los_olivos','sjl'].includes(x)))return invalid('Canal de venta inválido.');
        for(const [product,rows] of Object.entries(channels.transfers||{})){
          if(!['esencial','urbano','premium'].includes(product)||!rows||typeof rows!=='object'||Array.isArray(rows))return invalid('Distribución inválida.');
          for(const [point,value] of Object.entries(rows)){const match=/^(miraflores|los_olivos|sjl):([1-9][0-9]*)$/.exec(point);const active=validPoints.has(point)||(match&&validPoints.has(match[1])&&Number(match[2])<=Number(channels.quantities?.[match[1]]??1));if(!active||!finiteNonnegative(value)||!Number.isInteger(Number(value)))return invalid('Transferencia inválida o punto inactivo.');}
        }
        const trusted=previous?.state||{};
        const preparedState={...decisions,...Object.fromEntries(Object.entries(trusted).filter(([key])=>key.startsWith('__')))};
        if(temporal)preparedState.__materialOrders=materialBooks[String(company.id)];
        // This is a decision selection, not a financial balance.
        if(Array.isArray(saved.state?.__catalogSelection))preparedState.__catalogSelection=saved.state.__catalogSelection;
        inputs.push({id:company.id,state:preparedState,ledger:previous?.ledger||{},catalog:global.SIDE_DECISION_CATALOG,round:ciclo,capital:Number(company.capital),sectionsByRound:previous?.financialSections||{},planSource:saved.source,fromRound:saved.fromRound,financialPolicy:{...(global.SIDE_FINANCE_CONFIG?.resolve(ctx.financialConfig||{},ciclo)||ctx.financialConfig||{}),authoritativePrices:true,...(temporal?{verifiedMaterialContext:true,materialPaymentMode:ctx.financialConfig.materialPaymentMode,supplierCreditTermCycles:Number(ctx.financialConfig.supplierCreditTermCycles??1)}:{})},events:[]});
      }
      const resultadosPorEmpresa=global.SIDE_CYCLE_MODEL.closeMany(inputs);
      for(const company of ctx.empresas||[]){
        if(!resultadosPorEmpresa[company.id])continue;
        const snapshot=company.snapshot||{},result=resultadosPorEmpresa[company.id],financialLedger={...result.ledger};let previous=0;
        // Rebuild the current-cycle line from server-generated section entries,
        // never from the snapshot ledger. The previous debt is from the sealed
        // closure; amounts from current sales/collections have not been made
        // when the financing decision is submitted.
        if(Number(ciclo)>1){
          const request=Number(result.receipt?.decisions?.PRESTAMO?.amount||0);
          const debt=Number(prior[company.id]?.financial?.balanceGeneral?.deuda);
          if(!Number.isFinite(debt)||debt<0)return {success:false,code:'SALDO_ANTERIOR_NO_VERIFICADO',error:'La deuda anterior requiere reconciliación.'};
          const items=global.SIDE_DECISION_CATALOG.flatMap(category=>category.items||[]);
          const assets=['MESA_CORTE','ENSAMBLE','ACABADOS','MOLDE'].reduce((sum,id)=>{
            const definition=items.find(item=>item.id===id),purchases=result.receipt?.decisions?.[id]?.purchases||{};
            return sum+(definition?.options||[]).reduce((a,option)=>a+Math.max(0,Object.values(purchases).reduce((v,row)=>v+Number(row?.[option.id]||0),0))*Number(option.cost||0),0);
          },0);
          const excluded=new Set(['SIM_VENTAS','COMISION_VENTAS','VENTAS_CREDITO','COBRO_CREDITO','ALMACENAJE','MANTENIMIENTO_AUTO']);
          const beforeSales=Object.entries(financialLedger).reduce((sum,[key,value])=>{const [r,kind]=key.split(':');return sum+(Number(r)===Number(ciclo)&&excluded.has(kind)?0:Number(value||0));},Number(company.capital)||0);
          const ownCash=Math.max(0,beforeSales-debt-request);
          const approved=Math.floor((ownCash*.70+assets*.20)/500)*500;
          if(request>Math.max(0,approved-debt))return {success:false,code:'DECISION_INVALIDA',error:'El préstamo supera la línea disponible verificada.'};
        }
        for(let round=1;round<=ciclo;round++){
          const adjustment=global.SIDE_FINANCE_CONFIG?.adjustment(ctx.financialConfig||{},round,company.id,Number(company.capital))||0;
          if(adjustment!==previous)financialLedger[`${round}:CAPITAL_ADJUSTMENT`]=adjustment-previous;
          previous=adjustment;
        }
        delete result.state.__financialSnapshots?.[ciclo];
        result.financialSections=result.financialSections||snapshot.financial_sections||{};
        result.ledger=financialLedger;
        result.financial=global.SIDE_FINANCIAL_MODEL.calculate({capital:Number(company.capital),ledger:result.ledger,sectionsByRound:result.financialSections,catalog:global.SIDE_DECISION_CATALOG,round:ciclo,openingBalance:result.state.__openingBalance,state:result.state,financialPolicy:result.receipt?.financialPolicy||global.SIDE_FINANCE_CONFIG?.resolve(ctx.financialConfig||{},ciclo)||ctx.financialConfig||{}});
        if(temporal)result.ledger[`${ciclo}:PROVEEDOR_PAGO`]=-Number(result.financial.flujoCaja?.pagosProveedores||0)||0;
        result.state.__goodsLots=JSON.parse(JSON.stringify(result.financial.goodsLots||[]));result.receipt.lotMovements=JSON.parse(JSON.stringify(result.financial.lotMovements||[]));
        const frozen={...result.financial};delete frozen.history;result.state.__financialSnapshots={...result.state.__financialSnapshots,[ciclo]:frozen};
      }
      const closeArgs={p_partida_id:partidaId,p_ciclo:ciclo,p_token:ctx.token,p_cierre:{ciclo,resultadosPorEmpresa}};
      if(temporal)closeArgs.p_revisiones=Object.fromEntries(Object.entries(materialBooks).map(([id,book])=>[id,book.revision]));
      const response=await sb.rpc(temporal?'side_guardar_cierre_temporal_v1':'side_guardar_cierre_negocio',closeArgs);
      if(response.error||response.data?.error)return {success:false,error:response.error?.message||response.data.error,code:response.error?.code||response.data?.code};
      return {success:true,data:response.data.cierre,reused:!!response.data.reused};
    }catch(error){return {success:false,error:error.message};}
  }
  async function podio(partidaId,accion='consultar',minutos=0,justificacion=''){
    const sb=client();if(!sb)return offline();
    let timer;
    try{
      const {data,error}=await Promise.race([
        sb.rpc('side_podio_docente',{p_partida_id:partidaId,p_accion:accion,p_minutos:minutos,p_justificacion:justificacion}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La publicación tardó demasiado. Consulta su estado antes de reintentar.')),15000);})
      ]);
      if(error||data?.error)return {success:false,error:/PGRST202|42883/.test(error?.code||'')?'Aplica supabase/migrations/2026-10-12_podio_programado.sql en Supabase.':error?.message||data.error};
      if(data?.success!==true)return {success:false,error:'Supabase no confirmó la publicación.'};
      return {success:true,data};
    }catch(error){return {success:false,error:error.message};}
    finally{clearTimeout(timer);}
  }
  global.SIDE.PartidaService = { buscarPorCodigo, crear, obtenerActiva, recuperarSala, avanzarCiclo, finalizar, obtener, listarParticipantes, expulsarEmpresa, actualizarConfiguracion, guardarPuntaje, controlar, cancelar,cerrarNegocio,consultarCierreNegocio,podio };
});
