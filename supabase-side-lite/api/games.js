import {reportApiError} from './error-reporting.js';
// PREPARATION ONLY: not wired to a deployed service. The host must provide a
// shared, durable rate limiter and a PostgreSQL pool with server-only access.
import express from 'express';
import crypto from 'node:crypto';
import {EVENTS, RULES, closeCycle, rank} from '../../js/engine.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const fail = (status, message) => Object.assign(new Error(message), {status});
const qualities = ['basic', 'standard', 'premium'];
const GAME_CODE = /^(?:[A-Z0-9]{5}|[A-F0-9]{8})$/i;
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const newGameCode = () => Array.from({length:5}, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

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
  const {name,cycleCount,duration=120,capitalMin=20000,capitalMax=100000,costs,events=[]}=body || {};
  return typeof name === 'string' && name.trim().length >= 2 && name.length <= 80 && [3,6].includes(cycleCount)
    && duration === 120 && integer(capitalMin,20000,100000) && integer(capitalMax,capitalMin,100000)
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
        const {rows:allCompanies}=await c.query(`select co.id,co.name,co.initial_capital,co.cash,co.inventory,s.name as store,
          cm.district_id,cm.assignment_mode,di.name as district_name
          from public.lite_companies co join public.lite_stores s on s.id=co.store_id
          left join public.lite_company_markets cm on cm.game_id=co.game_id and cm.company_id=co.id
          left join public.lite_districts di on di.id=cm.district_id
          where co.game_id=$1 order by co.name`,[game.id]);
        const {rows:districts}=await c.query(`select gd.district_id as id,d.name from public.lite_game_districts gd
          join public.lite_districts d on d.id=gd.district_id where gd.game_id=$1 order by d.name`,[game.id]);
        const {rows:cycles}=await c.query(`select id,game_id,number,starts_at,ends_at,status,event_id,paused_at,
          close_requested_at,clock_timestamp() as server_now from public.lite_cycles where game_id=$1 order by number`,[game.id]);
        const current=cycles.at(-1);
        const decisions=isTeacher && current ? (await c.query(`select company_id,confirmed from public.lite_decisions
          where game_id=$1 and cycle_id=$2`,[game.id,current.id])).rows : [];
        const ownDecision=ownCompany && current ? (await c.query(`select id,game_id,cycle_id,company_id,quality,quantity,price,marketing_amount,confirmed,updated_at
          from public.lite_decisions where game_id=$1 and cycle_id=$2 and company_id=$3`,[game.id,current.id,ownCompany.id])).rows[0] || null : null;
        const {rows:results}=await c.query(`select r.cycle_id,r.company_id,r.result,cy.number,
          case when d.confirmed then json_build_object('quality',d.quality,'quantity',d.quantity,
            'price',d.price,'marketingAmount',d.marketing_amount) else null end as decision
          from public.lite_results r
          join public.lite_cycles cy on cy.game_id=r.game_id and cy.id=r.cycle_id
          left join public.lite_decisions d on d.game_id=r.game_id and d.cycle_id=r.cycle_id and d.company_id=r.company_id
          where r.game_id=$1 and cy.status='closed' and ($2::boolean or r.company_id=$3::uuid)
          order by cy.number`,[game.id,isTeacher,ownCompany?.id || null]);
        const ranking=rank(allCompanies.map(x=>({...x,initialCapital:x.initial_capital,
          inventoryValue:x.inventory.reduce((sum,b)=>sum+b.quantity*b.unitCost,0)})))
          .map(x=>({id:x.id,name:x.name,returnPercent:x.returnPercent,...(isTeacher?{cash:x.cash}:{})}));
        const companies=isTeacher?allCompanies:allCompanies.map(x=>x.id===ownCompany?.id?x:{id:x.id,name:x.name,store:x.store});
        return {game,company:ownCompany?companies.find(x=>x.id===ownCompany.id):null,isTeacher,companies,cycles,decisions,ownDecision,results,ranking,districts:isTeacher?districts:[]};
      });
      return res.json(result);
    } catch(e) { return next(e); }
  });
  // Historical laboratory reads are restricted to the owner of the game and
  // to closed cycles. Simulation never writes decisions or official results.
  app.get('/api/games/:id/laboratory',async (req,res,next)=>{
    try {
      if (!UUID.test(req.params.id)) throw fail(400,'Partida inválida.');
      const data=await transaction(pool,async c=>{
        await c.query('set transaction isolation level repeatable read');
        await requireCurrentUser(c,req.identity,true);
        const {rows:[game]}=await c.query('select id from public.lite_games where id=$1 and teacher_id=$2',[req.params.id,req.identity.id]);
        if (!game) throw fail(403,'Sin acceso a esta partida.');
        const {rows:cycles}=await c.query("select id,number,event_id from public.lite_cycles where game_id=$1 and status='closed' order by number",[game.id]);
        const {rows:companies}=await c.query('select id,name from public.lite_companies where game_id=$1 order by name',[game.id]);
        const {rows}=await c.query(`select r.cycle_id,r.company_id,r.result,d.quality,d.quantity,d.price,d.marketing_amount,d.confirmed
          from public.lite_results r join public.lite_cycles cy on cy.id=r.cycle_id and cy.game_id=r.game_id
          left join public.lite_decisions d on d.game_id=r.game_id and d.cycle_id=r.cycle_id and d.company_id=r.company_id and d.confirmed
          where r.game_id=$1 and cy.status='closed' order by cy.number,r.company_id`,[game.id]);
        const records=rows.map(({quality,quantity,price,marketing_amount,confirmed,...row})=>({...row,
          decision:confirmed?{quality,quantity,price,marketingAmount:marketing_amount}:null}));
        return {cycles,companies,records};
      });
      return res.json(data);
    } catch(e) { return next(e); }
  });
  app.post('/api/games/:id/laboratory/simulate',async (req,res,next)=>{
    try {
      const {cycleId,companyId,decision}=req.body||{};
      if (!UUID.test(req.params.id)||!UUID.test(cycleId||'')||!UUID.test(companyId||'')) throw fail(400,'Selección inválida.');
      if (!decision || !qualities.includes(decision.quality)||!integer(decision.quantity,0,100000)||!integer(decision.price,1,100000)
        ||!integer(decision.marketingAmount,0,10000)||(decision.marketingAmount>0&&decision.marketingAmount<200)) throw fail(400,'Decisión inválida.');
      const result=await transaction(pool,async c=>{
        await c.query('set transaction isolation level repeatable read');
        await requireCurrentUser(c,req.identity,true);
        const {rows:[game]}=await c.query('select id,costs from public.lite_games where id=$1 and teacher_id=$2',[req.params.id,req.identity.id]);
        if (!game) throw fail(403,'Sin acceso a esta partida.');
        const {rows:[row]}=await c.query(`select cy.number,cy.event_id,r.result,s.seed
          from public.lite_cycles cy join public.lite_results r on r.game_id=cy.game_id and r.cycle_id=cy.id and r.company_id=$3
          join public.lite_companies co on co.id=r.company_id and co.game_id=cy.game_id
          join side_lite_private.lite_cycle_secrets s on s.cycle_id=cy.id
          where cy.game_id=$1 and cy.id=$2 and cy.status='closed'`,[game.id,cycleId,companyId]);
        if (!row) throw fail(404,'No hay un resultado cerrado para esta selección.');
        if (row.result?.ruleVersion!==RULES.version) throw fail(409,'La versión histórica del motor no está disponible para simulación.');
        let batches=[];
        if (row.number>1) {
          const {rows:[previous]}=await c.query(`select r.result from public.lite_results r join public.lite_cycles cy on cy.id=r.cycle_id and cy.game_id=r.game_id
            where r.game_id=$1 and r.company_id=$2 and cy.number=$3 and cy.status='closed'`,[game.id,companyId,row.number-1]);
          if (!previous || !Array.isArray(previous.result?.inventory) || previous.result.cashEnd!==row.result.cashStart)
            throw fail(409,'No está disponible el estado histórico de apertura.');
          batches=previous.result.inventory;
        }
        try { return closeCycle({cash:row.result.cashStart,batches,costs:game.costs,event:row.event_id,seed:row.seed,companyId,decision}); }
        catch { throw fail(400,'La decisión no es válida o supera la caja de apertura.'); }
      });
      return res.json({result});
    } catch(e) { return next(e); }
  });
  app.post('/api/games',async (req,res,next)=>{
    try {
      if (!validConfig(req.body)) throw fail(400,'Configuración inválida.');
      const {name,cycleCount,capitalMin=20000,capitalMax=100000,costs,events=[],markets=false}=req.body;
      if (typeof markets !== 'boolean') throw fail(400,'Configuración de mercados inválida.');
      const game=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity,true);
        let inserted;
        for(let n=0;n<8 && !inserted;n++) {
          const code=newGameCode();
          const result=await c.query(`insert into public.lite_games(teacher_id,name,code,cycle_count,capital_min,capital_max,costs,enabled_events)
            values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(code) do nothing
            returning id,teacher_id,name,code,cycle_count,duration_seconds,capital_min,capital_max,costs,enabled_events,created_at`,
            [req.identity.id,name.trim(),code,cycleCount,capitalMin,capitalMax,JSON.stringify(costs),JSON.stringify(events)]);
          inserted=result.rows[0];
        }
        if (!inserted) throw fail(503,'No se pudo generar un código.');
        for(const q of qualities) await c.query('insert into public.lite_products(game_id,quality,unit_cost) values($1,$2,$3)',[inserted.id,q,costs[q]]);
        if (markets) {
          await c.query("insert into public.lite_game_markets(game_id,assignment_mode) values($1,'random')",[inserted.id]);
          await c.query(`insert into public.lite_game_districts(game_id,district_id,base_demand,economic_share,standard_share,premium_share)
            select $1,id,base_demand,economic_share,standard_share,premium_share from public.lite_districts`,[inserted.id]);
        }
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
      if (typeof code !== 'string' || !GAME_CODE.test(code) || typeof name !== 'string' || name.trim().length<2 || name.length>80 || (req.identity.isAnonymous && (typeof brand !== 'string' || brand.trim().length<2 || brand.length>80)) || (brand !== undefined && (typeof brand !== 'string' || brand.trim().length<2 || brand.length>80))) throw fail(400,'Datos inválidos.');
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
          const {rows:districts}=await c.query('select district_id from public.lite_game_districts where game_id=$1 order by district_id',[game.id]);
          const {rows:[marketConfig]}=await c.query('select assignment_mode from public.lite_game_markets where game_id=$1',[game.id]);
          if (marketConfig && !districts.length) throw fail(409,'La partida no tiene distritos habilitados.');
          if (districts.length) await c.query("insert into public.lite_company_markets(game_id,company_id,district_id,assignment_mode) values($1,$2,$3,'random')",[game.id,result.id,districts[crypto.randomInt(districts.length)].district_id]);
          if(recoverySecret)await c.query('insert into side_lite_private.lite_guest_recovery(company_id,secret_hash) values($1,$2)',[result.id,recoveryHash]);
          return result;
        } catch(e) { if(e.code==='23505') throw fail(409,'Ya participas en esta partida.'); throw e; }
      });
      return res.status(201).json(recoverySecret?{...company,recoverySecret}:company);
    } catch(e) { return next(e); }
  });
  app.put('/api/games/:id/markets/:companyId',async (req,res,next)=>{
    try {
      if (!UUID.test(req.params.id) || !UUID.test(req.params.companyId)) throw fail(400,'Selección inválida.');
      const {mode,districtId}=req.body || {};
      if (!['manual','random'].includes(mode) || (mode==='manual' && typeof districtId!=='string')) throw fail(400,'Asignación inválida.');
      const assignment=await transaction(pool,async c=>{
        await requireCurrentUser(c,req.identity,true);
        const {rows:[game]}=await c.query('select id,teacher_id,ended_at from public.lite_games where id=$1 for update',[req.params.id]);
        if (!game || game.teacher_id!==req.identity.id) throw fail(403,'Sin acceso a esta partida.');
        if (game.ended_at || (await c.query('select 1 from public.lite_cycles where game_id=$1 limit 1',[game.id])).rowCount) throw fail(409,'La asignación está bloqueada después del inicio.');
        const {rows:districts}=await c.query('select district_id from public.lite_game_districts where game_id=$1 order by district_id',[game.id]);
        const district=mode==='random' ? districts[crypto.randomInt(districts.length || 1)]?.district_id : districtId;
        if (!districts.some(x=>x.district_id===district)) throw fail(400,'Distrito no habilitado.');
        const {rows:[row]}=await c.query(`update public.lite_company_markets set district_id=$3,assignment_mode=$4
          where game_id=$1 and company_id=$2 returning company_id,district_id,assignment_mode`,[game.id,req.params.companyId,district,mode]);
        if (!row) throw fail(404,'Empresa no encontrada.');
        return row;
      });
      return res.json(assignment);
    } catch(e) { return next(e); }
  });
  app.post('/api/guest/recover',async(req,res,next)=>{
    try {
      if(!req.identity.isAnonymous)throw fail(403,'Se requiere una sesión de invitado.');
      if(await limitJoin({userId:req.identity.id,code:req.body?.code})!==true)throw fail(429,'Demasiados intentos. Inténtalo más tarde.');
      const {code,recoverySecret,newRecoverySecret}=req.body||{};
      if(typeof code!=='string'||!GAME_CODE.test(code)||typeof recoverySecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)||typeof newRecoverySecret!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(newRecoverySecret)||newRecoverySecret===recoverySecret)throw fail(400,'Datos de recuperación inválidos.');
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
        const {rows:[unassigned]}=await c.query(`select exists(select 1 from public.lite_game_markets gm
          join public.lite_companies co on co.game_id=gm.game_id
          left join public.lite_company_markets cm on cm.game_id=co.game_id and cm.company_id=co.id
          where gm.game_id=$1 and cm.company_id is null) as missing`,[game.id]);
        if (unassigned?.missing) throw fail(409,'Todas las empresas deben tener un distrito asignado.');
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
  app.use(reportApiError);
  return app;
}
