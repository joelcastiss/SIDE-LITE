import crypto from 'node:crypto';
// Per-account limiter for /api/join. Only pass identities verified server-side.
// Ten attempts per fixed five-minute window; a boundary can allow a short burst
// of twenty. A separate trusted-edge IP limit remains necessary.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createJoinLimiter({pool} = {}) {
  if (typeof pool?.query !== 'function') throw new TypeError('Falta el pool de base de datos.');
  return async ({userId,code} = {}) => {
    if (typeof userId !== 'string' || !UUID.test(userId)) return false;
    // A single atomic upsert serializes concurrent requests for this user.
    // Database errors propagate, so the caller must reject rather than bypass.
    const {rows:[row]} = await pool.query(`
      insert into side_lite_private.lite_join_attempt_windows as w
        (user_id, window_started_at, attempts)
      values ($1, clock_timestamp(), 1)
      on conflict (user_id) do update set
        window_started_at = case
          when w.window_started_at <= excluded.window_started_at - interval '5 minutes'
          then excluded.window_started_at else w.window_started_at end,
        attempts = case
          when w.window_started_at <= excluded.window_started_at - interval '5 minutes'
          then 1 else least(w.attempts + 1, 11) end
      returning attempts`, [userId]);
    if (!row || !Number.isInteger(row.attempts)) throw new Error('No se pudo comprobar el límite.');
    if (row.attempts > 10) return false;
    if (typeof code !== 'string' || !/^[0-9a-f]{8}$/i.test(code)) return false;
    const digest=crypto.createHash('sha256').update(code.toUpperCase()).digest();
    const {rows:[shared]}=await pool.query(`
      insert into side_lite_private.lite_admission_code_windows as w (code_hash,window_started_at,attempts)
      values ($1,clock_timestamp(),1)
      on conflict (code_hash) do update set
        window_started_at=case when w.window_started_at<=excluded.window_started_at-interval '5 minutes' then excluded.window_started_at else w.window_started_at end,
        attempts=case when w.window_started_at<=excluded.window_started_at-interval '5 minutes' then 1 else least(w.attempts+1,121) end
      returning attempts`,[digest]);
    if(!shared||!Number.isInteger(shared.attempts))throw new Error('No se pudo comprobar el límite.');
    return shared.attempts <= 120;
  };
}
