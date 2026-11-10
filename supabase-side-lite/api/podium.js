// Private podium routes. The browser never queries private tables directly.
import express from 'express';
import {createIdentityMiddleware} from './identity.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function transaction(pool,fn){const c=await pool.connect();try{await c.query('begin');const value=await fn(c);await c.query('commit');return value}catch(error){try{await c.query('rollback')}catch{}throw error}finally{c.release()}}
async function authorize(c,identity,gameId,requireTeacher=false){
 const {rows:[active]}=await c.query('select side_lite_private.lock_active_identity($1,$2) as active',[identity.id,identity.sessionId]);
 if(!active?.active)throw fail(403,'Cuenta o sesión no autorizada.');
 const {rows:[mfa]}=await c.query('select side_lite_private.api_mfa_ready($1,$2,$3) as allowed',[identity.id,identity.sessionId,identity.aal||'aal1']);
 if(mfa?.allowed!==true)throw fail(403,'Verificación multifactor requerida.');
 const {rows:[game]}=await c.query('select id,teacher_id,cycle_count from public.lite_games where id=$1 for update',[gameId]);
 if(!game)throw fail(403,'Sin acceso a esta partida.');
 const {rows:[grant]}=await c.query('select side_lite_private.api_lock_teacher($1,$2) as authorized',[identity.id,identity.sessionId]);
 const isTeacher=grant?.authorized===true&&game.teacher_id===identity.id;
 if(requireTeacher&&!isTeacher)throw fail(403,'Sin acceso a esta partida.');
 if(!isTeacher){const own=await c.query('select 1 from public.lite_companies where game_id=$1 and student_id=$2',[game.id,identity.id]);if(!own.rowCount)throw fail(403,'Sin acceso a esta partida.')}
 return {game,isTeacher};
}
function validId(value){if(!UUID.test(value||''))throw fail(400,'Identificador inválido.');return value}
export function createPodiumRouter({pool,verifyToken}={}){
 if(!pool?.connect||!pool?.query||typeof verifyToken!=='function')throw new TypeError('Faltan dependencias seguras.');
 const router=express.Router();router.use(express.json({limit:'16kb',strict:true}));router.use('/api',createIdentityMiddleware({pool,verifyToken}));
 router.get('/api/games/:id/podium',async(req,res,next)=>{try{const gameId=validId(req.params.id);const value=await transaction(pool,async c=>{
  const {game,isTeacher}=await authorize(c,req.identity,gameId);
  const {rows:[p]}=await c.query('select reason,scheduled_at,published_snapshot,clock_timestamp() as server_now from side_lite_private.teacher_podium where game_id=$1',[game.id]);
  if(!isTeacher){if(!p||new Date(p.server_now)<new Date(p.scheduled_at)||new Date(p.server_now)>=new Date(p.scheduled_at).getTime()+86400000)return {published:null};return {published:{reason:p.reason,scheduledAt:p.scheduled_at,ranking:p.published_snapshot}}}
  const {rows:companies}=await c.query('select co.id,co.name,gr.grade from public.lite_companies co left join side_lite_private.teacher_grades gr on gr.game_id=co.game_id and gr.company_id=co.id where co.game_id=$1 order by co.name',[game.id]);
  const {rows:[last]}=await c.query('select number,status from public.lite_cycles where game_id=$1 order by number desc limit 1',[game.id]);
  return {companies,finished:last?.number===game.cycle_count&&last?.status==='closed',podium:p?{reason:p.reason,scheduledAt:p.scheduled_at,ranking:p.published_snapshot,serverNow:p.server_now}:null};
 });return res.json(value)}catch(e){return next(e)}});
 router.put('/api/games/:id/grades/:companyId',async(req,res,next)=>{try{const gameId=validId(req.params.id),companyId=validId(req.params.companyId),grade=req.body?.grade;
  if(typeof grade!=='number'||!Number.isFinite(grade)||grade<0||grade>20||Math.abs(Math.round(grade*100)-grade*100)>1e-8)throw fail(400,'Nota inválida.');
  const value=await transaction(pool,async c=>{const {game}=await authorize(c,req.identity,gameId,true);const {rows:[company]}=await c.query('select id from public.lite_companies where id=$1 and game_id=$2',[companyId,game.id]);if(!company)throw fail(404,'Empresa no encontrada.');return (await c.query('insert into side_lite_private.teacher_grades(game_id,company_id,grade) values($1,$2,$3) on conflict(game_id,company_id) do update set grade=excluded.grade,updated_at=clock_timestamp() returning company_id,grade',[game.id,company.id,grade])).rows[0]});return res.json(value)}catch(e){return next(e)}});
 router.post('/api/games/:id/podium',async(req,res,next)=>{try{const gameId=validId(req.params.id),{reason='',delayMinutes=0}=req.body||{};
  if(typeof reason!=='string'||reason.length>1000||!Number.isSafeInteger(delayMinutes)||delayMinutes<0||delayMinutes>4320)throw fail(400,'Publicación inválida.');
  const value=await transaction(pool,async c=>{const {game}=await authorize(c,req.identity,gameId,true);const {rows:[last]}=await c.query('select number,status from public.lite_cycles where game_id=$1 order by number desc limit 1',[game.id]);if(last?.number!==game.cycle_count||last?.status!=='closed')throw fail(409,'La partida aún no ha terminado.');const {rows:companies}=await c.query('select co.id,co.name,gr.grade from public.lite_companies co left join side_lite_private.teacher_grades gr on gr.game_id=co.game_id and gr.company_id=co.id where co.game_id=$1',[game.id]);if(!companies.length||companies.some(x=>x.grade===null))throw fail(409,'Registra las notas de todas las empresas.');companies.sort((a,b)=>Number(b.grade)-Number(a.grade)||a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id));const ranking=companies.map((x,i)=>({position:i+1,companyId:x.id,name:x.name,grade:Number(x.grade)}));return (await c.query("insert into side_lite_private.teacher_podium(game_id,reason,scheduled_at,published_snapshot) values($1,$2,clock_timestamp()+($3 * interval '1 minute'),$4) on conflict(game_id) do update set reason=excluded.reason,scheduled_at=excluded.scheduled_at,published_snapshot=excluded.published_snapshot,created_at=clock_timestamp() returning reason,scheduled_at",[game.id,reason.trim(),delayMinutes,JSON.stringify(ranking)])).rows[0]});return res.json(value)}catch(e){return next(e)}});
 router.delete('/api/games/:id/podium',async(req,res,next)=>{try{const gameId=validId(req.params.id);await transaction(pool,async c=>{await authorize(c,req.identity,gameId,true);const result=await c.query('delete from side_lite_private.teacher_podium where game_id=$1 and scheduled_at>clock_timestamp()',[gameId]);if(!result.rowCount)throw fail(409,'No hay publicación programada pendiente.');});return res.json({ok:true})}catch(e){return next(e)}});
 router.use((err,req,res,next)=>{if(res.headersSent)return next(err);return res.status(err.status||500).json({error:err.status?err.message:'Error interno.'})});return router;
}
