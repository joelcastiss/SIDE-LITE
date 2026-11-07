import {createHash} from 'node:crypto';
const hashed=value=>createHash('sha256').update(value).digest('hex');
/** Atomic, database-backed fixed windows. Keys contain no raw account or network identifiers. */
export async function consumeAuthLimit(pool,{scope,ip,email}){
  const keys=[[`ip:${scope}:${ip}`,100],[`account:${scope}:${email.toLowerCase().slice(0,200)}`,10]];
  let retry=0;
  for(const [key,limit] of keys){
    const {rows:[row]}=await pool.query(`INSERT INTO lite_auth_limits AS l(key_hash,attempts,expires_at) VALUES($1,1,clock_timestamp()+interval '10 minutes') ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN l.expires_at<=clock_timestamp() THEN 1 ELSE l.attempts+1 END,expires_at=CASE WHEN l.expires_at<=clock_timestamp() THEN clock_timestamp()+interval '10 minutes' ELSE l.expires_at END RETURNING attempts,GREATEST(1,CEIL(EXTRACT(EPOCH FROM (expires_at-clock_timestamp()))))::int AS retry_after`,[hashed(key)]);
    if(row.attempts>limit)retry=Math.max(retry,row.retry_after);
  }
  return {allowed:retry===0,retryAfter:retry};
}
