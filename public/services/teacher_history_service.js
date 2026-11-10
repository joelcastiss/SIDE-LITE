/** Read-only teacher history. Ownership and replacement are enforced by Supabase. */
(function initTeacherHistoryService(global) {
  'use strict';

  function client() {
    return global.SIDE?.SupabaseClient?.get() || null;
  }

  function failure(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || error || 'No se pudo consultar el historial.');
    if (/^(PGRST202|PGRST205|42P01|42883)$/.test(code) ||
        /(?:obtener_ultima_partida_docente|side_teacher_history).*(?:schema cache|does not exist)/i.test(message)) {
      return {
        success: false, unavailable: true, code: 'HISTORIAL_NO_CONFIGURADO',
        error: 'Aplica supabase/migrations/supabase_teacher_history.sql en Supabase para habilitar el apartado Historial.'
      };
    }
    return { success: false, code: code || undefined, error: message };
  }

  /** { success, data: null | { partida, empresas: [{ reportes, decisiones, ... }] } }. */
  async function obtenerUltima() {
    try {
      const sb = client();
      if (!sb) return { success: false, offline: true, error: 'Supabase no disponible (modo local).' };
      const { data, error } = await sb.rpc('obtener_ultima_partida_docente');
      if (error) return failure(error);
      if (data?.success === false || data?.error) return failure({ code: data.code, message: data.error });
      return { success: true, data: data || null };
    } catch (error) {
      return failure(error);
    }
  }

  global.SIDE = global.SIDE || {};
  global.SIDE.TeacherHistoryService = { obtenerUltima };
})(window);
