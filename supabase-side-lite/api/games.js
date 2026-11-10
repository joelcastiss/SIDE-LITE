// PREPARATION ONLY: not wired to a deployed service. The host must provide a
// shared, durable rate limiter and a PostgreSQL pool with server-only access.
import express from 'express';
import crypto from 'node:crypto';
import {EVENTS, closeCycle, rank} from '../../js/engine.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const fail = (status, message) => Object.assign(new Error(message), {status});
const qualities = ['basic', 'standard', 'premium'];

async function transaction(pool, fn) {
  const c = await pool.connect();
  try { await c.query('begin'); const result = await fn(c); await c.query('commit'); return result; }
  catch (e) { try { await c.query('rollback'); } catch {} throw e; }
  finally { c.release(); }
}

// Recheck the actual session and verified email in the same transaction as the
// mutation; never accept roles, email, user IDs, or authorization from request JSON.
async function requireCurrentUser(c, identity, teacher = false) {
  const {rows:[user]} = await c.query('select side_lite_private.lock_active_identity($1,$2) as active', [identity.id,identity.sessionId]);
  if (!user?.active) throw fail(403,'Cuenta o sesión no autorizada.');
  const {rows:[assurance]}=await c.query('select side_lite_private.api_mfa_ready($1,$2,$3) as allowed',[identity.id,identity.sessionId,identity.aal || 'aal1']);
  if (!assurance?.allowed) throw fail(403,'Se requiere completar la verificación multifactor.');
  if (teacher) {
    // Lock the authoritative grant so revocation cannot race a game creation.
    const {rows:[grant]} = await c.query('select side_lite_private.api_lock_teacher($1,$2) as authorized',[identity.id,identity.sessionId]);
    if (!grant?.authorized) throw fail(403,'Docente no autorizado.');
  }
}

async function hasTeacherGrant(c, identity) {
  const {rows:[grant]}=await c.query('select side_lite_private.api_lock_teacher($1,$2) as authorized',[identity.id,identity.sessionId]);
  return !!grant?.authorized;
}

function validConfig(body) {
  const {name,cycleCount,duration=120,capitalMin=30000,capitalMax=100000,costs,events=[]}=body || {};
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 80 && [3,6].includes(cycleCount)
    && duration === 120 && integer(capitalMin,10000,1000000) && integer(capitalMax,capitalMin,1000000)
    && capitalMin%10000===0 && capitalMax%10000===0 && costs && typeof costs === 'object'
    && qualities.every(q=>integer(costs[q],1,100000)) && Array.isArray(events)
    && events.length <= EVENTS.length && new Set(events).size === events.length
    && events.every(id=>typeof id === 'string' && EVENTS.some(event=>event.id === id));
}

/** Verify token server-side; limitJoin must use a shared, durable store and fail closed. */
export function createGamesApp({pool, verifyToken, limitJoin} = {}) {
  if (typeof pool?.connect !== 'function' || typeof verifyToken !== 'function' || typeof limitJoin !== 'function') {
    throw new TypeError('Faltan dependencias seguras del servidor.');
  }
  const app = express(); app.disable('x-powered-by');
  app.use(express.json({limit:'16kb', strict:true}));
  app.use('/api', async (req,res,next)=>{
    res.set('Cache-Control','no-store');
    const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.get('authorization') || '');
    if (!match) return res.status(401).json({error:'Inicia sesión.'});
    try { req.identity=await verifyToken(match[1]); } catch { return res.status(401).json({error:'Sesión inválida o vencida.'}); }
    if (!UUID.test(req.identity?.id || '') || !UUID.test(req.identity?.sessionId || '')) return res.status(401).json({error:'Sesión inválida o vencida.'});
    next();
  });
  app.get('/api/catalog',async (req,res,next)=>{
    try {
      await transaction(pool,async c=>{await requireCurrentUser(c,req.identity);});
      return res.json(EVENTS);
    } catch(e) { return next(e); }
  });
  app.get('/api/games',async (req,res,next)=>{
    try {
      const games=await transaction(pool,async c=>{
        await c.query('set transaction isolation level repeatable read');
        await requireCurrentUser(c,req.identity);
        const teacher=await hasTeacherGrant(c,req.identity);
        const {rows}=await c.query(`select g.id,g.teacher_id,g.name,g.code,g.cycle_count,g.duration_seconds,
          g.capital_min,g.capital_max,g.costs,g.enabled_events,g.created_at,g.ended_at from public.lite_games g
          where (g.teacher_id=$1 and $2::boolean) or exists (
            select 1 from public.lite_companies co where co.game_id=g.id and co.student_id=$1)
          order by g.created_at desc`,[req.identity.id,teacher]);
        return rows;
      });
      return res.json(games);
    } catch(e) { return next(e); }
  });
  app.get('/api/games/:id',async (req,res,next)=>{
    try {
      if (!UUID.test(req.params.id)) throw fail(400,'Partida inválida.');
      const result=await transaction(pool,async c=>{
        // Use a coherent snapshot across cycle, decisions, results and balances.
        await c.query('set transaction isolation level repeatable read');
        await requireCurrentUser(c,req.identity);
        const teacher=await hasTeacherGrant(c,req.identity);
        const {rows:[game]}=await c.query(`select id,teacher_id,name,code,cycle_count,duration_seconds,
          capital_min,capital_max,costs,enabled_events,created_at,ended_at from public.lite_games where id=$1`,[req.params.id]);
        if (!game) throw fail(404,'Partida no encontrada.');
        const {rows:[ownCompany]}=await c.query('select id from public.lite_companies where game_id=$1 and student_id=$2',[game.id,req.identity.id]);
        const isTeacher=teacher && game.teacher_id===req.identity.id;
        if (!isTeacher && !ownCompany) throw fail(403,'Sin acceso a esta partida.');
        const {rows:allCompanies}=await c.query(`select co.id,co.name,co.initial_capital,co.cash,co.inventory,s.name as store
          from public.lite_companies co join public.lite_stores s on s.id=co.store_id
          where co.game_id=$1 order by co.name`,[game.id]);
        const {rows:cycles}=await c.query(`select id,game_id,number,starts_at,ends_at,status,event_id,paused_at,
          close_requested_at,clock_timestamp() as server_now from public.lite_cycles where game_id=$1 order by number`,[game.id]);
        const current=cycles.at(-1);
        const decisions=isTeacher && current ? (await c.query(`select company_id,confirmed from public.lite_decisions
          where game_id=$1 and cycle_id=$2`,[game.id,current.id])).rows : [];
        const ownDecision=ownCompany && current ? (await c.query(`select id,game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed,updated_at
          from public.lite_decisions where game_id=$1 and cycle_id=$2 and company_id=$3`,[game.id,current.id,ownCompany.id])).rows[0] || null : null;
        const {rows:results}=await c.query(`select r.cycle_id,r.company_id,r.result,cy.number from public.lite_results r
          join public.lite_cycles cy on cy.game_id=r.game_id and cy.id=r.cycle_id
          where r.game_id=$1 and cy.status='closed' and ($2::boolean or r.company_id=$3::uuid)
          order by cy.number`,[game.id,isTeacher,ownCompany?.id || null]);
        const ranking=rank(allCompanies.map(x=>({...x,initialCapital:x.initial_capital,
          inventoryValue:x.inventory.reduce((sum,b)=>sum+b.quantity*b.unitCost,0)})))
          .map(x=>({id:x.id,name:x.name,returnPercent:x.returnPercent,...(isTeacher?{cash:x.cash}:{})}));
        const companies=isTeacher?allCompanies:allCompanies.map(x=>x.id===ownCompany?.id?x:{id:x.id,name:x.name,store:x.store});
        return {game,company:ownCompany?companies.find(x=>x.id===ownCompany.id):null,isTeacher,companies,cycles,decisions,ownDecision,results,ranking};
      });
      return res.json(result);
    } catch(e) { return next(e); }
  });
  app.post('/api/games',async (req,res,next)=>{
    try {
      if (!validConfig(req.body)) throw fail(400,'Configuración inválida.');
      const {name,cycleCount,capitalMin=30000,capitalMax=100000,costs,events=[]}=req.body;
      const game=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity,true);
        let inserted;
        for(let n=0;n<8 && !inserted;n++) {
          const code=crypto.randomBytes(4).toString('hex').toUpperCase();
          const result=await c.query(`insert into public.lite_games(teacher_id,name,code,cycle_count,capital_min,capital_max,costs,enabled_events)
            values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(code) do nothing
            returning id,teacher_id,name,code,cycle_count,duration_seconds,capital_min,capital_max,costs,enabled_events,created_at`,
            [req.identity.id,name.trim(),code,cycleCount,capitalMin,capitalMax,JSON.stringify(costs),JSON.stringify(events)]);
          inserted=result.rows[0];
        }
        if (!inserted) throw fail(503,'No se pudo generar un código.');
        for(const q of qualities) await c.query('insert into public.lite_products(game_id,quality,unit_cost) values($1,$2,$3)',[inserted.id,q,costs[q]]);
        return inserted;
      });
      return res.status(201).json(game);
    } catch(e) { return next(e); }
  });
  app.post('/api/join',async (req,res,next)=>{
    try {
      // A failing limiter must deny requests. IP-based throttling should also be
      // enforced at the trusted edge; do not trust X-Forwarded-For directly.
      const allowed=await limitJoin({userId:req.identity.id,code:req.body?.code});
      if (allowed !== true) throw fail(429,'Demasiados intentos. Inténtalo más tarde.');
      const {code,name,brand,recoverySecret:providedSecret}=req.body || {};
      if (typeof code !== 'string' || !/^[0-9a-f]{8}$/i.test(code) || typeof name !== 'string' || name.trim().length<2 || name.length>80 || (req.identity.isAnonymous && (typeof brand !== 'string' || brand.trim().length<2 || brand.length>80)) || (brand !== undefined && (typeof brand !== 'string' || brand.trim().length<2 || brand.length>80))) throw fail(400,'Datos inválidos.');
      if(req.identity.isAnonymous && (typeof providedSecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(providedSecret)))throw fail(400,'No se pudo preparar la recuperación de la empresa.');
      const recoverySecret=req.identity.isAnonymous?providedSecret:null,recoveryHash=recoverySecret?crypto.createHash('sha256').update(recoverySecret).digest():null;
      const company=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity);
        // Serialize with cycle start, which must also lock this game row first.
        const {rows:[game]}=await c.query('select id,capital_min,capital_max,ended_at from public.lite_games where code=$1 for update',[code.toUpperCase()]);
        if (!game) throw fail(404,'Código no encontrado.');
        if(recoverySecret){const {rows:[previous]}=await c.query('select * from side_lite_private.api_find_guest_join($1,$2,$3,$4)',[req.identity.id,req.identity.sessionId,game.id,recoveryHash]);if(previous)return previous;}
        if (game.ended_at) throw fail(409,'La partida ha finalizado.');
        if ((await c.query('select 1 from public.lite_cycles where game_id=$1 limit 1',[game.id])).rowCount) throw fail(409,'La partida ya comenzó.');
        const {rows:stores}=await c.query('select id from public.lite_stores order by name');
        if (!stores.length) throw fail(503,'Catálogo no disponible.');
        const store=stores[crypto.randomInt(stores.length)];
        const capital=game.capital_min+10000*crypto.randomInt((game.capital_max-game.capital_min)/10000+1);
        try {
          const {rows:[result]}=await c.query(`insert into public.lite_companies(game_id,student_id,name,store_id,initial_capital,cash,brand_name)
            values($1,$2,$3,$4,$5,$5,$6) returning id,game_id,student_id,name,brand_name,store_id,initial_capital,cash,inventory`,
            [game.id,req.identity.id,name.trim(),store.id,capital,brand?.trim()||null]);
          if(recoverySecret)await c.query('insert into side_lite_private.lite_guest_recovery(company_id,secret_hash) values($1,$2)',[result.id,recoveryHash]);
          return result;
        } catch(e) { if(e.code==='23505') throw fail(409,'Ya participas en esta partida.'); throw e; }
      });
      return res.status(201).json(recoverySecret?{...company,recoverySecret}:company);
    } catch(e) { return next(e); }
  });
  app.post('/api/guest/recover',async(req,res,next)=>{
    try {
      if(!req.identity.isAnonymous)throw fail(403,'Se requiere una sesión de invitado.');
      if(await limitJoin({userId:req.identity.id,code:req.body?.code})!==true)throw fail(429,'Demasiados intentos. Inténtalo más tarde.');
      const {code,recoverySecret,newRecoverySecret}=req.body||{};
      if(typeof code!=='string'||!/^[0-9a-f]{8}$/i.test(code)||typeof recoverySecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)||typeof newRecoverySecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(newRecoverySecret)||newRecoverySecret===recoverySecret)throw fail(400,'Datos de recuperación inválidos.');
      const hash=crypto.createHash('sha256').update(recoverySecret).digest(),newHash=crypto.createHash('sha256').update(newRecoverySecret).digest();
      const company=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity);
        let company;try{({rows:[company]}=await c.query('select * from side_lite_private.api_recover_guest($1,$2,$3,$4,$5)',[req.identity.id,req.identity.sessionId,code.toUpperCase(),hash,newHash]))}catch(error){if(error.code==='23505')throw fail(409,'Esta sesión ya pertenece a otra empresa de la partida.');throw error}
        if(!company)throw fail(403,'No se pudo recuperar la empresa.');
        return company;
      });
      return res.json(company);
    }catch(error){return next(error)}
  });
  app.post('/api/games/:id/start',async (req,res,next)=>{
    try {
      if (!UUID.test(req.params.id)) throw fail(400,'Partida inválida.');
      const cycle=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity,true);
        // The same game-row lock is used by join to prohibit late enrollment.
        const {rows:[game]}=await c.query('select id,teacher_id,cycle_count,enabled_events,ended_at from public.lite_games where id=$1 for update',[req.params.id]);
        if (!game || game.teacher_id !== req.identity.id) throw fail(403,'Sin acceso a esta partida.');
        if (game.ended_at) throw fail(409,'La partida ha finalizado.');
        const {rows:[previous]}=await c.query('select number,status from public.lite_cycles where game_id=$1 order by number desc limit 1',[game.id]);
        if(previous?.status === 'open') throw fail(409,'Ya hay un ciclo abierto.');
        const number=(previous?.number || 0)+1;
        if(number>game.cycle_count) throw fail(409,'La partida ha terminado.');
        if(!(await c.query('select 1 from public.lite_companies where game_id=$1 limit 1',[game.id])).rowCount) throw fail(400,'La partida no tiene participantes.');
        const event=game.enabled_events.length ? game.enabled_events[crypto.randomInt(game.enabled_events.length)] : null;
        // The insert trigger sets the two timestamps from the database clock.
        const {rows:[created]}=await c.query(`insert into public.lite_cycles(game_id,number,ends_at,event_id)
          values($1,$2,clock_timestamp()+interval '120 seconds',$3)
          returning id,game_id,number,starts_at,ends_at,status,event_id,paused_at,close_requested_at`,[game.id,number,event]);
        await c.query('insert into side_lite_private.lite_cycle_secrets(cycle_id) values($1)',[created.id]);
        return created;
      });
      return res.status(201).json(cycle);
    } catch(e) { return next(e); }
  });
  app.put('/api/games/:id/decision',async (req,res,next)=>{
    try {
      if (!UUID.test(req.params.id)) throw fail(400,'Partida inválida.');
      const {quality,quantity,price,marketingAmount,confirmed}=req.body || {};
      if (!qualities.includes(quality) || !integer(quantity,0,100000) || !integer(price,1,100000)
        || !integer(marketingAmount,0,10000) || (marketingAmount>0 && marketingAmount<200)
        || typeof confirmed !== 'boolean') throw fail(400,'Decisión inválida.');
      const saved=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity);
        const {rows:[game]}=await c.query(`select g.id,g.costs from public.lite_games g
          join public.lite_companies co on co.game_id=g.id and co.student_id=$2 where g.id=$1`,[req.params.id,req.identity.id]);
        if (!game) throw fail(403,'Sin acceso a esta partida.');
        // Decision, pause, close and worker must all take this same row lock.
        const {rows:[cycle]}=await c.query(`select id,event_id,ends_at,paused_at,close_requested_at
          from public.lite_cycles where game_id=$1 and status='open' for update`,[game.id]);
        if (!cycle || cycle.paused_at || cycle.close_requested_at) throw fail(409,'El ciclo no recibe decisiones.');
        const {rows:[clock]}=await c.query('select clock_timestamp() >= ends_at as expired from public.lite_cycles where id=$1',[cycle.id]);
        if (clock.expired) throw fail(409,'El ciclo ha vencido.');
        const {rows:[company]}=await c.query('select * from public.lite_companies where game_id=$1 and student_id=$2 for update',[game.id,req.identity.id]);
        if (!company) throw fail(403,'Sin acceso a esta partida.');
        const {rows:[previous]}=await c.query('select confirmed from public.lite_decisions where cycle_id=$1 and company_id=$2',[cycle.id,company.id]);
        if (previous?.confirmed) throw fail(409,'La decisión ya está confirmada.');
        const {rows:[secret]}=await c.query('select seed from side_lite_private.lite_cycle_secrets where cycle_id=$1',[cycle.id]);
        if (!secret) throw fail(503,'El ciclo no está disponible.');
        // Use the unchanged economic engine for affordability/validation only.
        // Never send its calculated future result or the seed to this client.
        try { closeCycle({cash:company.cash,batches:company.inventory,costs:game.costs,event:cycle.event_id,
          seed:secret.seed,companyId:company.id,decision:{quality,quantity,price,marketingAmount}}); }
        catch { throw fail(400,'La decisión no es válida o supera el capital disponible.'); }
        const {rows:[decision]}=await c.query(`insert into public.lite_decisions(game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed)
          select $1,$2,$3,$4,$5,$6,$7,$8 where exists (
            select 1 from public.lite_cycles cy where cy.id=$2 and cy.status='open'
              and cy.paused_at is null and cy.close_requested_at is null and clock_timestamp()<cy.ends_at)
          on conflict(cycle_id,company_id) do update set quality=excluded.quality,quantity=excluded.quantity,
            price=excluded.price,marketing_amount=excluded.marketing_amount,confirmed=excluded.confirmed,updated_at=clock_timestamp()
          returning id,game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed,updated_at`,
          [game.id,cycle.id,company.id,quality,quantity,price,marketingAmount,confirmed]);
        if (!decision) throw fail(409,'El ciclo ha vencido.');
        return decision;
      });
      return res.json(saved);
    } catch(e) { return next(e); }
  });
  app.use((err,req,res,next)=>{if (res.headersSent) return next(err); return res.status(err.status || 500).json({error:err.status ? err.message : 'Error interno.'});});
  return app;
}
