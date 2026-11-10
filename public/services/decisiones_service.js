/**
 * decisiones_service.js
 * ---------------------------------------------------------------------------
 * Servicio de decisiones (elecciones del estudiante por ciclo).
 *
 * Responsabilidad ÚNICA: persistir y leer `empresas_decisiones`.
 * No toca empresas, partidas ni UI.
 *
 * Funciones:
 *   - guardar(identidad, ciclo, decisiones, revision) → RPC guardar_decisiones_estudiante
 *   - obtenerReporte(empresaId, ciclo?)     → RPC obtener_reporte_empresa
 *   - obtenerCatalogo()                     → catálogo para mapear IDs a etiquetas
 *   - guardarReporte(identidad, ciclo, reporte, revision) → RPC guardar_reporte_estudiante
 *
 * Formato de cada decisión en el array:
 *   { decision_id: 'MOLDE', opcion_id: 'molde_2', cantidad: 1, costo_total: 1200 }
 *
 * Todas retornan { success: boolean, data?: any, error?: string }.
 * Si Supabase no está disponible retornan { success: false, offline: true }.
 *
 * @module services/decisiones_service
 */
(function initDecisionesService(global) {
  'use strict';

  /** @returns {object|null} Cliente Supabase o null si offline. */
  function client(student=false) {
    const c = global.SIDE && global.SIDE.SupabaseClient
      ? (student && global.SIDE.SupabaseClient.getStudent ? global.SIDE.SupabaseClient.getStudent() : global.SIDE.SupabaseClient.get())
      : null;
    return c;
  }

  /** Respuesta estándar cuando no hay conexión. */
  function offline() {
    return { success: false, offline: true, error: 'Supabase no disponible (modo local).' };
  }

  function identityParams(identidad) {
    const clean = value => String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
    const d = identidad || {};
    return {
      p_codigo: clean(d.codigo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
      p_nombre_legal: clean(d.nombreLegal),
      p_nombre_comercial: clean(d.nombreComercial)
    };
  }

  function validIdentity(params) {
    return Boolean(params.p_codigo && params.p_nombre_legal && params.p_nombre_comercial);
  }

  // Keep transport errors distinct from an explicit rejection by the RPC.
  // The outbox and its status message need the original PostgREST code.
  function technicalFailure(error) {
    const failure = { success: false, technical: true,
      code: String(error?.code || 'RPC_DECISIONES_ERROR'),
      error: String(error?.message || error || 'No se pudo comunicar con Supabase.') };
    for (const key of ['details', 'hint', 'status']) if (error?.[key] != null) failure[key] = error[key];
    return failure;
  }

  function writeResult(data, error) {
    if (error) return technicalFailure(error);
    if (data?.success === false || data?.error) return { success: false, code: data.code, error: data.error };
    if (data?.success !== true) return technicalFailure({ code: 'RESPUESTA_GUARDADO_INVALIDA', message: 'El servidor no confirmó el guardado.' });
    return { success: true, data };
  }

  /**
   * Guarda (inserta o actualiza) las decisiones de una empresa en un ciclo.
   * @param {object} identidad { codigo, nombreLegal, nombreComercial }.
   * @param {number} ciclo Número de ciclo (1..N).
   * @param {Array<object>} decisiones Array de decisiones (ver formato arriba).
   * @param {number} expectedRevision Revisión confirmada por el CAS de snapshot.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { success: true, guardadas: number }.
   */
  async function guardar(identidad, ciclo, decisiones, expectedRevision) {
    const sb = client(true);
    if (!sb) return offline();
    const identidadRpc = identityParams(identidad);
    const revision = Number(expectedRevision);
    if (!validIdentity(identidadRpc)) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    if (!ciclo) return { success: false, error: 'Falta ciclo.' };
    if (!Number.isSafeInteger(revision) || revision < 0) return { success: false, code: 'ESTADO_DESACTUALIZADO', error: 'No se pudo validar la revisión del estado.' };
    if (!Array.isArray(decisiones) || decisiones.length === 0) {
      return { success: false, error: 'No hay decisiones para guardar.' };
    }
    try {
      const { data, error } = await sb.rpc('guardar_decisiones_estudiante', {
        ...identidadRpc,
        p_ciclo: ciclo,
        p_decisiones: decisiones,
        p_expected_revision: revision
      });
      return writeResult(data, error);
    } catch (err) {
      return technicalFailure(err);
    }
  }

  /**
   * Obtiene el reporte completo de una empresa (para el panel docente).
   * @param {number} empresaId ID de la empresa (flujo autenticado del docente).
   * @param {number|null} ciclo Ciclo específico o null para todos.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { empresa, reportes, decisiones }.
   */
  async function obtenerReporte(empresaId, ciclo) {
    const sb = client();
    if (!sb) return offline();
    if (!empresaId) return { success: false, error: 'Falta empresaId.' };
    try {
      const { data, error } = await sb.rpc('obtener_reporte_empresa', {
        p_empresa_id: empresaId,
        p_ciclo: ciclo || null
      });
      if (error) return { success: false, error: error.message };
      if (data?.success === false || data?.error) return { success: false, code: data?.code, error: data?.error || 'No se pudo consultar el reporte.' };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Obtiene el catálogo de decisiones y opciones para mapear IDs a etiquetas.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   *   data = { decisions: [{id, decision_id, decision_nombre, categoria,
   *            tipo, es_obligatoria, es_recurrente}],
   *            options: [{id, decision_id, opcion_id, etiqueta}] }.
   */
  async function obtenerCatalogo() {
    const sb = client();
    if (!sb) return offline();
    try {
      const [dec, ops] = await Promise.all([
        sb.from('decisiones_catalogo').select('id, decision_id, decision_nombre, categoria, tipo, es_obligatoria, es_recurrente').eq('activo', true),
        sb.from('decisiones_opciones').select('id, decision_id, opcion_id, etiqueta').eq('activo', true)
      ]);
      if (dec.error) return { success: false, error: dec.error.message };
      if (ops.error) return { success: false, error: ops.error.message };
      return { success: true, data: { decisions: dec.data || [], options: ops.data || [] } };
    } catch (err) {
      return { success: false, error: String((err && err.message) || err) };
    }
  }

  /**
   * Guarda (inserta o actualiza) el reporte financiero de una empresa en un ciclo.
   * @param {object} identidad { codigo, nombreLegal, nombreComercial }.
   * @param {number} ciclo Número de ciclo (1..N).
   * @param {object} reporte { capital, ingresos, costos, utilidad, caja_final,
   *   balance_caja, flujo_caja, estado_resultados, decisiones, eventos,
   *   score, progreso }.
   * @param {number} expectedRevision Revisión confirmada por el CAS de snapshot.
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async function guardarReporte(identidad, ciclo, reporte, expectedRevision) {
    const sb = client(true);
    if (!sb) return offline();
    const identidadRpc = identityParams(identidad);
    const revision = Number(expectedRevision);
    if (!validIdentity(identidadRpc)) return { success: false, code: 'CREDENCIALES_INVALIDAS', error: 'No se pudo validar el ingreso.' };
    if (!ciclo) return { success: false, error: 'Falta ciclo.' };
    if (!Number.isSafeInteger(revision) || revision < 0) return { success: false, code: 'ESTADO_DESACTUALIZADO', error: 'No se pudo validar la revisión del estado.' };
    if (!reporte || typeof reporte !== 'object') {
      return { success: false, error: 'Reporte vacío.' };
    }
    // Las proyecciones siguen en la interfaz local. El cierre de servidor es
    // el único que persiste reportes, para impedir resultados falsificados.
    return { success: true, data: { provisional: true, persisted: false } };
  }

  // Solo lectura: el servidor decide si el usuario tiene derecho a la empresa.
  async function obtenerContextoMaterial(partidaId, empresaId, ciclo, estudiante = false) {
    const sb = client(estudiante);
    if (!sb) return offline();
    if (!partidaId || !empresaId || !Number.isInteger(Number(ciclo)) || Number(ciclo) < 1 || Number(ciclo) > 6)
      return { success: false, code: 'CONTEXTO_INVALIDO', error: 'Datos de recepción no verificados / proyección no disponible.' };
    try {
      const { data, error } = await sb.rpc('side_material_preview_v1', { p_partida_id: partidaId, p_empresa_id: empresaId, p_ciclo: Number(ciclo) });
      if (error) return technicalFailure(error);
      if (!data || data.version !== 'receipts-v1' || String(data.companyId) !== String(empresaId) ||
          Number(data.cycle) !== Number(ciclo) || Number(data.cutoffDay) !== Number(ciclo) * 30 - 1 ||
          !/^[a-f0-9]{32}$/.test(String(data.revision || '')) || !data.events || typeof data.events !== 'object' || Array.isArray(data.events))
        return { success: false, code: 'CONTEXTO_INVALIDO', error: 'Datos de recepción no verificados / proyección no disponible.' };
      return { success: true, data };
    } catch (error) { return technicalFailure(error); }
  }

  async function registrarEntregaProveedor(partidaId, orderId, receiptId, cantidad) {
    const sb=client();
    if(!sb)return offline();
    const quantity=Number(cantidad);
    if(!partidaId||!orderId||!receiptId||!Number.isFinite(quantity)||quantity<=0)return {success:false,error:'Entrega inválida.'};
    try {
      const args={p_partida_id:partidaId,p_order_id:orderId,p_receipt_id:receiptId,p_quantity:quantity};
      // 55P03 aborts the database statement. Reuse the event identity so a
      // retry cannot create a second delivery even if the first result is lost.
      let result;
      for(let attempt=0;attempt<3;attempt++){
        result=await sb.rpc('side_registrar_entrega_proveedor_v1',args);
        if(result?.error?.code!=='55P03'||attempt===2)break;
        await new Promise(resolve=>global.setTimeout(resolve,100*(attempt+1)));
      }
      const {data,error}=result;
      if(error)return technicalFailure(error);
      if(!data||data.receiptId!==receiptId||!Number.isInteger(Number(data.day)))return {success:false,error:'El servidor no confirmó la entrega.'};
      return {success:true,data};
    } catch(error){return technicalFailure(error);}
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.DecisionesService = { guardar, obtenerReporte, obtenerCatalogo, guardarReporte, obtenerContextoMaterial, registrarEntregaProveedor };
})(window);
