import {closeCycle} from '../js/engine.js';

/** Close each due cycle atomically. A broken cycle must not block other games. */
export async function closeDue(pool){
  let closed=0;const failures=[];
  let cursor=null;
  for(;;){
   // Preserve PostgreSQL's microsecond precision; JS Date would truncate the cursor.
   const {rows:due}=await pool.query("SELECT id, ends_at::text AS cursor_ends_at FROM lite_cycles WHERE status='open' AND paused_at IS NULL AND (ends_at<=now() OR close_requested_at IS NOT NULL) AND ($1::timestamptz IS NULL OR (ends_at,id)>($1::timestamptz,$2::uuid)) ORDER BY ends_at,id LIMIT 100",cursor?[cursor.ends_at,cursor.id]:[null,null]);
   if(!due.length)break;
   for(const {id} of due){
    const c=await pool.connect();
    try{
      await c.query('BEGIN');
      const {rows:[cy]}=await c.query("SELECT * FROM lite_cycles WHERE id=$1 AND status='open' AND paused_at IS NULL AND (ends_at<=now() OR close_requested_at IS NOT NULL) FOR UPDATE SKIP LOCKED",[id]);
      if(!cy){await c.query('COMMIT');continue}
      const {rows:[g]}=await c.query('SELECT * FROM lite_games WHERE id=$1',[cy.game_id]);
      const {rows:companies}=await c.query('SELECT * FROM lite_companies WHERE game_id=$1 FOR UPDATE',[g.id]);
      for(const co of companies){
        const {rows:[d]}=await c.query('SELECT * FROM lite_decisions WHERE cycle_id=$1 AND company_id=$2 AND confirmed',[cy.id,co.id]);
        const decision=d?{quality:d.quality,quantity:d.quantity,price:d.price,marketingAmount:d.marketing_amount}:null;
        const result=closeCycle({cash:co.cash,batches:co.inventory,costs:g.costs,event:cy.event_id,seed:cy.seed,companyId:co.id,decision});
        await c.query('INSERT INTO lite_results(cycle_id,company_id,result) VALUES($1,$2,$3)',[cy.id,co.id,JSON.stringify(result)]);
        await c.query('UPDATE lite_companies SET cash=$1,inventory=$2 WHERE id=$3',[result.cashEnd,JSON.stringify(result.inventory),co.id]);
      }
      await c.query("UPDATE lite_cycles SET status='closed' WHERE id=$1",[cy.id]);
      await c.query('COMMIT');closed++;
    }catch(e){try{await c.query('ROLLBACK')}catch{}failures.push(e)}finally{c.release()}
   }
   if(due.length<100)break;
   const last=due.at(-1);cursor={ends_at:last.cursor_ends_at,id:last.id};
  }
  if(failures.length)throw new AggregateError(failures,'No se pudieron cerrar todos los ciclos vencidos');
  return closed;
}
