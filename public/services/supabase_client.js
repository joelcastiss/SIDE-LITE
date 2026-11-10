/**
 * supabase_client.js
 * ---------------------------------------------------------------------------
 * Módulo base: inicializa y expone el cliente Supabase para toda la app.
 *
 * Responsabilidad ÚNICA: crear el cliente una sola vez y decir si está
 * disponible. No contiene lógica de negocio ni acceso a tablas.
 *
 * Uso:
 *   const client = SupabaseClient.get();        // null si no hay config/SDK
 *   const ok = SupabaseClient.isReady();        // true/false
 *
 * @module services/supabase_client
 */
(function initSupabaseClientModule(global) {
  'use strict';

  /** @type {object|null} Cliente Supabase (singleton). */
  let client = null;
  let studentClient = null;

  // A stalled HTTP response must release polling/queue locks. Do not retry
  // writes here: a timeout does not prove that the server rejected the write.
  function boundedFetch(input, options = {}) {
    const controller = new global.AbortController();
    const source = options.signal || input?.signal;
    const abort = () => controller.abort(source.reason);
    if (source?.aborted) abort();
    else source?.addEventListener('abort', abort, { once: true });
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = global.setTimeout(() => {
        const error = Object.assign(new TypeError('La conexión con Supabase tardó demasiado. Vuelve a intentar.'), { code: 'CONEXION_TIMEOUT' });
        reject(error);
        controller.abort(error);
      }, 15000);
    });
    const operation = Promise.resolve().then(async () => {
      const response = await global.fetch(input, { ...options, signal: controller.signal });
      // Include a stalled response body in the deadline, preserving the original
      // Response for the SDK (status, headers and normal error handling).
      await response.clone().arrayBuffer();
      return response;
    });
    return Promise.race([operation, timeout]).finally(() => {
      global.clearTimeout(timer);
      source?.removeEventListener('abort', abort);
    });
  }

  /**
   * Lee la configuración global inyectada por config.js.
   * @returns {{url: string, key: string}|null} Config o null si inválida.
   */
  function readConfig() {
    const cfg = global.SIDE_CONFIG || {};
    const url = String(cfg.SUPABASE_URL || '').trim();
    const key = String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();
    if (!url || url.includes('TU-PROYECTO')) return null;
    if (!key || key.includes('TU-PUBLISHABLE')) return null;
    return { url, key };
  }

  /**
   * Inicializa el cliente Supabase (idempotente).
   * Debe llamarse una vez al arrancar; los servicios lo llaman solos.
   * @returns {object|null} Cliente Supabase o null si no se pudo crear.
   */
  function init() {
    if (client) return client;
    const cfg = readConfig();
    if (!cfg) return null;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      console.warn('SIDE: SDK de Supabase no cargado. Modo local activo.');
      return null;
    }
    try {
      const options = typeof global.fetch === 'function' && typeof global.AbortController === 'function'
        ? { global: { fetch: boundedFetch } } : {};
      client = global.supabase.createClient(cfg.url, cfg.key, options);
    } catch (err) {
      console.error('SIDE: no se pudo crear el cliente Supabase', err);
      client = null;
    }
    return client;
  }

  /**
   * Obtiene el cliente, inicializándolo si hace falta.
   * @returns {object|null} Cliente Supabase o null.
   */
  function get() {
    if (!client) init();
    return client;
  }

  // Una sesión del estudiante no debe compartir almacenamiento con la sesión
  // del docente: ambas pueden coexistir en el mismo navegador.
  function getStudent() {
    if (studentClient) return studentClient;
    const cfg=readConfig();
    if (!cfg || !global.supabase || typeof global.supabase.createClient !== 'function') return null;
    try {
      const options={auth:{storageKey:'side-student-auth',persistSession:true,autoRefreshToken:true}};
      if(typeof global.fetch==='function' && typeof global.AbortController==='function')options.global={fetch:boundedFetch};
      studentClient=global.supabase.createClient(cfg.url,cfg.key,options);
    } catch(err) { console.error('SIDE: no se pudo crear la sesión de estudiante',err); }
    return studentClient;
  }

  /**
   * Indica si el cliente está inicializado; no prueba la conexión de red.
   * @returns {boolean} true si el cliente existe.
   */
  function isReady() {
    return get() !== null;
  }

  // Expone el módulo en el namespace global SIDE.
  global.SIDE = global.SIDE || {};
  global.SIDE.SupabaseClient = { init, get, getStudent, isReady };
})(window);
