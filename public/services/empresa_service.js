/**
 * empresa_service.js
 * ---------------------------------------------------------------------------
 * Servicio de empresas (compañías de los estudiantes).
 *
 * Responsabilidad ÚNICA: operaciones sobre `empresas` y `participantes`.
 * No toca decisiones, reportes ni UI.
 *
 * Funciones:
 *   - ingresar(datos)                    → RPC unirse_partida_por_codigo
 *   - obtenerEstado(datos)                       → RPC obtener_estado_estudiante
 *   - guardarEstado(datos, snapshot, revision)  → RPC guardar_estado_estudiante
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/empresa_service
 */
(function initEmpresaService(global) {
  'use strict';

  /** @returns {object|null} Cliente Supabase o null si offline. */
  function client() {
    const c = global.SIDE && global.SIDE.SupabaseClient
      ? (global.SIDE.SupabaseClient.getStudent ? global.SIDE.SupabaseClient.getStudent() : global.SIDE.SupabaseClient.get())
      : null;
    return c;
  }

  /** Respuesta estándar cuando no hay conexión. */
  function offline() {
    return {
      success: false,
      offline: true,
      technical: true,
      code: 'CLIENTE_SUPABASE_NO_DISPONIBLE',
      error: 'Supabase no disponible (modo local).'
    };
  }

  const ADMISSION_REJECTION_CODES = new Set(['CREDENCIALES_INVALIDAS', 'PARTIDA_INICIADA', 'CODIGO_INVALIDO', 'PARTIDA_NO_ENCONTRADA', 'CODIGO_AMBIGUO', 'PARTIDA_CANCELADA', 'PARTIDA_FINALIZADA','CODIGO_RETIRADO','EMPRESA_EXPULSADA','ACCESO_RESERVADO','SESION_REQUERIDA']);
  const CODE_MESSAGES={PARTIDA_CANCELADA:'La partida fue cancelada. Solicita el código de la nueva sala al docente.',PARTIDA_FINALIZADA:'La partida ya finalizó. Solicita el código de la nueva sala al docente.',CODIGO_RETIRADO:'Este código pertenece a una sala anterior y ya no puede utilizarse. Solicita el código de la nueva sala.',PARTIDA_NO_ENCONTRADA:'No existe una partida con ese código. Comprueba el código que compartió tu docente.',CODIGO_AMBIGUO:'Este código está duplicado en la base de datos. El docente debe revisar los códigos de las salas.'};
  async function rejectedCodeStatus(sb,codigo){
    try{
      const {data,error}=await request(sb, 'side_estado_codigo_sala',{p_codigo:codigo});
      if(error){console.warn?.('SIDE: diagnóstico de código no disponible; conserva rechazo original',error);return null;}
      if(data?.codigo===codigo&&CODE_MESSAGES[data.code])return {success:false,technical:false,code:data.code,error:CODE_MESSAGES[data.code]};
    }catch(error){console.warn?.('SIDE: no se pudo consultar el estado del código',error);}
    return null;
  }

  /** Conserva el diagnostico de PostgREST sin convertirlo en un rechazo de identidad. */
  function technicalFailure(error, fallbackCode) {
    const failure = {
      success: false,
      technical: true,
      code: cleanText(error && error.code) || fallbackCode,
      error: cleanText(error && error.message) || 'Error de comunicacion con Supabase.'
    };
    if (error && error.details != null) failure.details = String(error.details);
    if (error && error.hint != null) failure.hint = String(error.hint);
    if (error && error.status != null) failure.status = error.status;
    return failure;
  }

  async function admissionReady(sb) {
    try {
      const {data,error}=await request(sb, 'side_admission_features');
      if(error&&!/PGRST202|42883/.test(error.code||''))return technicalFailure(error,'RPC_CAPABILITY_ERROR');
      if(error||data?.waitingRoomVersion!==3||data?.exactIdentityVersion!==2)return {success:false,code:'MIGRACION_PENDIENTE',error:'Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase.'};
      return null;
    }catch(error){return technicalFailure(error,'RPC_CAPABILITY_ERROR');}
  }

  function cleanText(value) {
    return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function cleanCode(value) {
    const code = String(value || '').replace(/\s+/g, '').toUpperCase();
    if (/^SIDE[A-Z0-9]+$/.test(code)) return code.replace(/^SIDE/, 'SIDE-');
    if (code !== 'SIDE' && /^(?:[A-Z0-9]{3,4}|[A-Z0-9]{6})$/.test(code)) return 'SIDE-' + code;
    return code;
  }

  // Bound every network operation, including capability checks and polling.
  // Abort the fetch when supported; Promise.race also covers custom clients.
  async function request(sb, name, args) {
    let query = sb.rpc(name, args);
    if (typeof setTimeout !== 'function') return query;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    if (controller && typeof query?.abortSignal === 'function') query = query.abortSignal(controller.signal);
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller?.abort();
        reject(Object.assign(new Error('La conexión tardó demasiado. Intenta ingresar nuevamente.'), {code:'CONEXION_TIMEOUT'}));
      }, 15000);
    });
    try { return await Promise.race([query, timeout]); }
    finally { clearTimeout(timer); }
  }

  /**
   * Valida el código y la identidad empresarial en una sola transacción.
   * El servidor decide si crea una empresa o reingresa a la existente.
   * @param {object} datos { codigo, nombreLegal, nombreComercial }
   * @returns {Promise<{success: boolean, data?: object, code?: string, error?: string}>}
   */
  async function ingresar(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    if (!codigo || !nombreLegal || !nombreComercial) {
      return { success: false, code: 'DATOS_INCOMPLETOS', error: 'Faltan datos de ingreso.' };
    }
    if (!/^SIDE-(?:[A-Z0-9]{3,4}|[A-Z0-9]{6})$/.test(codigo)) {
      return { success: false, code: 'CODIGO_INVALIDO', error: 'Usa un código como SIDE-PTV6 o PTV6. También se aceptan los códigos anteriores de 6 caracteres y SIDE-000.' };
    }
    try {
      const readiness=await admissionReady(sb);if(readiness)return readiness;
      if(!sb.auth?.getSession||!sb.auth?.signInAnonymously)return {success:false,technical:true,code:'AUTH_NO_DISPONIBLE',error:'No se pudo iniciar la sesión de estudiante.'};
      const session=await sb.auth.getSession();if(session.error)return technicalFailure(session.error,'AUTH_SESSION_ERROR');
      if(!session.data?.session){const signIn=await sb.auth.signInAnonymously();if(signIn.error)return technicalFailure(signIn.error,'AUTH_ANONIMO_ERROR');}
      const { data: response, error } = await request(sb, 'side_ingresar_empresa_segura', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial,
        p_clave: null
      });
      if (error) {
        console.error('SIDE EmpresaService: fallo tecnico en unirse_partida_por_codigo', error);
        return technicalFailure(error, 'RPC_INGRESAR_EMPRESA_ERROR');
      }
      const data = Array.isArray(response) ? response[0] : response;
      if (!data || typeof data !== 'object') {
        const failure = technicalFailure(null, 'RESPUESTA_INGRESO_INVALIDA');
        console.error('SIDE EmpresaService: respuesta invalida de unirse_partida_por_codigo', { response });
        return failure;
      }
      if (data.success === false || data.error) {
        const code = cleanText(data.code || data.codigo_error);
        if(code==='CREDENCIALES_INVALIDAS'||code==='PARTIDA_INICIADA'){
          const reason=await rejectedCodeStatus(sb,codigo);if(reason)return reason;
        }
        return {
          success: false,
          code,
          error: cleanText(data.error) || 'No se pudo validar el ingreso.',
          technical: !ADMISSION_REJECTION_CODES.has(code)
        };
      }
      const game=data.partida,config=game?.configuracion||{};
      const cancelled=config.cancelledAt!=null&&!['','null','false','0'].includes(String(config.cancelledAt).trim().toLowerCase());
      if(game?.estado==='cancelada'||cancelled||config.phase==='cancelled'||config.runtime?.phase==='cancelled')return {success:false,technical:false,code:'PARTIDA_CANCELADA',error:CODE_MESSAGES.PARTIDA_CANCELADA};
      if(game?.estado==='finalizada'||config.phase==='finished'||config.runtime?.phase==='finished')return {success:false,technical:false,code:'PARTIDA_FINALIZADA',error:CODE_MESSAGES.PARTIDA_FINALIZADA};
      if(!Number.isFinite(Date.parse(data?.partida?.serverTime||'')))return {success:false,code:'MIGRACION_PENDIENTE',error:'Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase (respuesta sin hora del servidor).'};
      return { success: true, data };
    } catch (err) {
      console.error('SIDE EmpresaService: excepcion en unirse_partida_por_codigo', err);
      return technicalFailure(err, 'RPC_INGRESAR_EMPRESA_EXCEPCION');
    }
  }

  /**
   * Obtiene el estado completo del juego para un estudiante.
   * @param {object} datos { codigo, nombreLegal, nombreComercial }
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa, partida, ciclo_partida, decisiones_ciclo }.
   */
  async function obtenerEstado(datos) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    if (!codigo || !nombreLegal || !nombreComercial) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    try {
      const readiness=await admissionReady(sb);if(readiness)return readiness;
      const { data, error } = await request(sb, 'obtener_estado_estudiante', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial
      });
      if (error) return technicalFailure(error, 'RPC_ESTUDIANTE_ERROR');
      if (data && (data.success === false || data.error)) return { success: false, code: data.code, error: data.error };
      // Only the server may expose a due, unexpired podium. Fail closed.
      data.podio=null;
      try{
        const podium=await request(sb,'side_podio_estudiante',{p_codigo:codigo,p_nombre_legal:nombreLegal,p_nombre_comercial:nombreComercial});
        if(!podium.error&&podium.data?.success===true)data.podio=podium.data.publication;
      }catch(error){console.warn?.('SIDE: podio pendiente de consulta',error);}
      if(!Number.isFinite(Date.parse(data?.partida?.serverTime||'')))return {success:false,code:'MIGRACION_PENDIENTE',error:'Falta aplicar la migración 20261009_sala_espera_identidad_exacta.sql en Supabase (respuesta sin hora del servidor).'};
      return { success: true, data };
    } catch (err) {
      return technicalFailure(err, 'RPC_ESTUDIANTE_EXCEPCION');
    }
  }

  async function guardarEstado(datos, snapshot, expectedRevision) {
    const sb = client();
    if (!sb) return offline();
    const d = datos || {};
    const codigo = cleanCode(d.codigo);
    const nombreLegal = cleanText(d.nombreLegal);
    const nombreComercial = cleanText(d.nombreComercial);
    const revision = Number(expectedRevision);
    if (!codigo || !nombreLegal || !nombreComercial || !snapshot || typeof snapshot !== 'object' || !Number.isSafeInteger(revision) || revision < 0) {
      return { success: false, error: 'No se pudo preparar el estado del estudiante.' };
    }
    try {
      const { data, error } = await request(sb, 'guardar_estado_estudiante', {
        p_codigo: codigo,
        p_nombre_legal: nombreLegal,
        p_nombre_comercial: nombreComercial,
        p_snapshot: snapshot,
        p_expected_revision: revision
      });
      if (error) return technicalFailure(error, 'RPC_ESTUDIANTE_ERROR');
      if (data && (data.success === false || data.error)) return { success: false, code: data.code, error: data.error };
      return { success: true, data };
    } catch (err) {
      return technicalFailure(err, 'RPC_ESTUDIANTE_EXCEPCION');
    }
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.EmpresaService = { ingresar, obtenerEstado, guardarEstado, cleanText, cleanCode };
})(window);
