// Local preparation only; mount this router on the trusted server and provide
// the same verified-token implementation used by the game API.
import express from 'express';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,message)=>Object.assign(new Error(message),{status});

async function transaction(pool, fn) {
  const c=await pool.connect();
  try { await c.query('begin'); const value=await fn(c); await c.query('commit'); return value; }
  catch(e) { try {await c.query('rollback')} catch {} throw e; }
  finally { c.release(); }
}

async function lockAuthorizedGame(c,identity,id) {
  const {rows:[user]}=await c.query('select side_lite_private.lock_active_identity($1,$2) as active',[identity.id,identity.sessionId]);
  if (!user?.active) throw fail(403,'Cuenta o sesión no autorizada.');
  const {rows:[mfa]}=await c.query('select side_lite_private.api_mfa_ready($1,$2,$3) as allowed',[identity.id,identity.sessionId,identity.aal || 'aal1']);
  if (mfa?.allowed !== true) throw fail(403,'Verificación multifactor requerida.');
  const {rows:[grant]}=await c.query('select side_lite_private.api_lock_teacher($1,$2) as authorized',[identity.id,identity.sessionId]);
  if (!grant?.authorized) throw fail(403,'Docente no autorizado.');
  // Lock order: game then cycle. Decision and closer lock only cycle then companies.
  const {rows:[game]}=await c.query('select id,teacher_id,ended_at from public.lite_games where id=$1 for update',[id]);
  if (!game || game.teacher_id !== identity.id) throw fail(403,'Sin acceso a esta partida.');
  return game;
}

export function createCycleControlsRouter({pool,verifyToken}={}) {
  if(typeof pool?.connect!=='function' || typeof verifyToken!=='function') throw new TypeError('Faltan dependencias seguras.');
  const router=express.Router();
  router.use(async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const m=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.get('authorization') || '');
    if(!m) return res.status(401).json({error:'Inicia sesión.'});
    try {req.identity=await verifyToken(m[1]);} catch {return res.status(401).json({error:'Sesión inválida o vencida.'});}
    if(!UUID.test(req.identity?.id || '') || !UUID.test(req.identity?.sessionId || '')) return res.status(401).json({error:'Sesión inválida o vencida.'});
    return next();
  });
  for (const action of ['pause','resume','finish']) router.post(`/api/games/:id/${action}`,async(req,res,next)=>{
    try {
      if(!UUID.test(req.params.id)) throw fail(400,'Partida inválida.');
      const result=await transaction(pool,async c=>{
        const game=await lockAuthorizedGame(c,req.identity,req.params.id);
        if(game.ended_at) throw fail(409,'La partida ya finalizó anticipadamente.');
        const {rows:[cycle]}=await c.query(`select id,paused_at,close_requested_at from public.lite_cycles
          where game_id=$1 and status='open' for update`,[game.id]);
        if(action==='finish') {
          // A paused cycle is unpaused and queued for the same idempotent closer.
          const {rows:[ended]}=await c.query('update public.lite_games set ended_at=clock_timestamp() where id=$1 returning ended_at',[game.id]);
          if(cycle) await c.query(`update public.lite_cycles set paused_at=null,close_requested_at=coalesce(close_requested_at,clock_timestamp()) where id=$1`,[cycle.id]);
          return {ended_at:ended.ended_at,cycle_id:cycle?.id || null,results_pending:Boolean(cycle)};
        }
        if(!cycle || cycle.close_requested_at) throw fail(409,'No hay un ciclo activo disponible.');
        if(action==='pause') {
          if(cycle.paused_at) throw fail(409,'El ciclo ya está pausado.');
          const {rows:[updated]}=await c.query(`update public.lite_cycles set paused_at=clock_timestamp()
            where id=$1 and status='open' and paused_at is null and close_requested_at is null
            and clock_timestamp()<ends_at returning id,starts_at,ends_at,paused_at`,[cycle.id]);
          if(!updated) throw fail(409,'El ciclo ha vencido.');
          return updated;
        }
        if(!cycle.paused_at) throw fail(409,'El ciclo no está pausado.');
        // The same captured server instant controls both deadline shift and resume.
        const {rows:[updated]}=await c.query(`with tick as (select clock_timestamp() as at)
          update public.lite_cycles c set ends_at=c.ends_at+(tick.at-c.paused_at),paused_at=null
          from tick where c.id=$1 and c.status='open' and c.paused_at is not null and c.close_requested_at is null
          returning c.id,c.starts_at,c.ends_at,c.paused_at`,[cycle.id]);
        if(!updated) throw fail(409,'No se pudo reanudar el ciclo.');
        return updated;
      });
      return res.status(action==='finish' && result.results_pending?202:200).json(result);
    } catch(e) {return next(e);}
  });
  router.use((err,req,res,next)=>{if(res.headersSent)return next(err);return res.status(err.status||500).json({error:err.status?err.message:'Error interno.'});});
  return router;
}
