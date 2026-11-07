import {createHash} from 'node:crypto';
/** Atomic shared fixed window for authenticated game mutations, not a substitute for edge protection. */
export async function consumeGameMutation(pool,subject){
  if(typeof subject!=='string'||subject.length===0||subject.length>200)throw new Error('Identidad inválida');
  const key=createHash('sha256').update('game-mutation:'+subject).digest('hex');
  const {rows:[row]}=await pool.query(`INSERT INTO lite.lite_api_limits AS l(key_hash,attempts,expires_at) VALUES($1,1,clock_timestamp()+interval '1 minute') ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN l.expires_at<=clock_timestamp() THEN 1 ELSE l.attempts+1 END,expires_at=CASE WHEN l.expires_at<=clock_timestamp() THEN clock_timestamp()+interval '1 minute' ELSE l.expires_at END RETURNING attempts,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (expires_at-clock_timestamp()))))::int AS retry_after`,[key]);
  return {allowed:row.attempts<=60,retryAfter:row.retry_after};
}
