/* Small state machines used by the teacher roster. No DOM access here. */
(function (global) {
  'use strict';

  function createPresenceTracker(options = {}) {
    const now = options.now || Date.now;
    const onlineMs = options.onlineMs ?? 90000;
    const offlineMs = options.offlineMs ?? 120000;
    const idleSustainMs = options.idleSustainMs ?? 15000;
    const entries = new Map();

    function evaluate(entry, time) {
      if (!entry || !Number.isFinite(time) || !Number.isFinite(entry.lastSeen)) return entry?.status || 'unconfirmed';
      const age = Math.max(0, time - entry.lastSeen);
      if (age < offlineMs) entry.idleSince = null;
      else {
        // Wall time, rather than callback count: polling and Realtime can both
        // deliver the same stale snapshot within a single event-loop turn.
        if (entry.idleSince === null) entry.idleSince = time;
        if (time - entry.idleSince >= idleSustainMs) entry.status = 'idle';
      }
      return entry.status;
    }

    function observe(id, lastSeenAt) {
      let entry = entries.get(id);
      if (!entry) {
        entry = { status: 'unconfirmed', lastSeen: null, idleSince: null };
        entries.set(id, entry);
      }
      const time = now(), stamp = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
      // This is the single presence record, shared by snapshots and events.
      // Missing/older fields never erase a heartbeat or revive a stale session.
      if (Number.isFinite(stamp) && (entry.lastSeen === null || stamp > entry.lastSeen)) {
        entry.lastSeen = stamp;
        if (Number.isFinite(time) && Math.max(0, time - stamp) <= onlineMs) entry.status = 'online';
      }
      // A valid heartbeat may arrive before the initial server-clock response.
      if (entry.status === 'unconfirmed' && entry.lastSeen !== null && Number.isFinite(time) && Math.max(0, time - entry.lastSeen) <= onlineMs) entry.status = 'online';
      return evaluate(entry, time);
    }
    const get = id => evaluate(entries.get(id), now());
    return { observe, get, tick: get,
      lastSeen(id) { const stamp = entries.get(id)?.lastSeen; return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null; },
      clear(id) { if (id === undefined) entries.clear(); else entries.delete(id); } };
  }

  function createGradeQueue(options) {
    const { storage, save, onStatus = () => {}, schedule = setTimeout, clearSchedule = clearTimeout } = options;
    const storageKey = options.storageKey || 'SIDE_TEACHER_GRADE_QUEUE';
    const retryMs = options.retryMs || [2000, 5000, 15000];
    let jobs;
    try { jobs = JSON.parse(storage.getItem(storageKey) || '{}') || {}; }
    catch { jobs = {}; }
    let busy = false, timer = null;
    const persist = () => {
      try { storage.setItem(storageKey, JSON.stringify(jobs)); }
      catch (error) {
        // Keep the in-memory queue retryable even when storage is full/blocked.
        for (const key of Object.keys(jobs)) onStatus(key, 'storage-error', 'No se pudo conservar la nota en este dispositivo. Mantén esta página abierta hasta sincronizar.');
        console.warn('SIDE: no se pudo conservar la cola de notas', error);
      }
    };
    const pending = () => Object.keys(jobs).length;

    function plan(delay) {
      if (timer !== null) clearSchedule(timer);
      timer = schedule(() => { timer = null; flush(); }, delay);
    }

    function enqueue(key, payload) {
      if (!key) throw new Error('Grade queue key is required');
      jobs[key] = { payload, revision: (jobs[key]?.revision || 0) + 1, attempts: 0 };
      persist();
      onStatus(key, 'saving');
      void flush();
    }

    async function flush() {
      if (busy || !pending()) return;
      busy = true;
      let retryDelay = null;
      try {
        for (const [key, snapshot] of Object.entries(jobs)) {
          try {
            const result = await save(snapshot.payload);
            if (!result?.success) throw new Error(result?.error || 'Grade save failed');
            // A newer edit takes priority over the result of this request.
            if (jobs[key]?.revision === snapshot.revision) {
              delete jobs[key];
              persist();
              onStatus(key, 'saved');
            }
          } catch (error) {
            console.error('SIDE: no se pudo sincronizar el puntaje docente', error);
            if (jobs[key]?.revision !== snapshot.revision) continue;
            const attempts = ++jobs[key].attempts;
            persist();
            onStatus(key, attempts >= retryMs.length ? 'failed' : 'retrying', error.message);
            const wait = retryMs[Math.min(attempts - 1, retryMs.length - 1)];
            retryDelay = retryDelay === null ? wait : Math.min(retryDelay, wait);
          }
        }
      } finally {
        busy = false;
      }
      if (pending()) plan(retryDelay ?? 0);
    }

    return { enqueue, flush, pending, has: key => Boolean(jobs[key]) };
  }

  const api = { createPresenceTracker, createGradeQueue };
  global.SIDE = global.SIDE || {};
  global.SIDE.TeacherSync = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
