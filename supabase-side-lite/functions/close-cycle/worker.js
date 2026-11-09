import { closeCycle } from '../../../js/engine.js';

// Every call owns a single transaction. All submit/pause/start operations MUST
// lock the same cycle row before checking its state, deadline or decisions.
export async function closeOne(sql, excluded = []) {
  return await sql.begin(async tx => {
    const cycles = await tx`
      select c.id, c.game_id, c.event_id, s.seed
      from public.lite_cycles c
      left join side_lite_private.lite_cycle_secrets s on s.cycle_id = c.id
      where c.status = 'open' and c.paused_at is null
        and (c.ends_at <= clock_timestamp() or c.close_requested_at is not null)
        and not (c.id = any(${excluded}::uuid[]))
      order by c.ends_at, c.id
      for update of c skip locked limit 1`;
    const cycle = cycles[0];
    if (!cycle) return null;
    try {
      if (cycle.seed == null) throw new Error('Missing cycle secret');
      const [game] = await tx`select id, costs from public.lite_games where id = ${cycle.game_id}`;
      if (!game) throw new Error('Missing game');
      const companies = await tx`select id, cash, inventory from public.lite_companies where game_id = ${game.id} order by id for update`;
      for (const company of companies) {
        const [d] = await tx`select quality, quantity, price, marketing_amount from public.lite_decisions where cycle_id = ${cycle.id} and game_id = ${game.id} and company_id = ${company.id} and confirmed`;
        const decision = d ? { quality: d.quality, quantity: d.quantity, price: d.price, marketingAmount: d.marketing_amount } : null;
        const result = closeCycle({ cash: company.cash, batches: company.inventory, costs: game.costs, event: cycle.event_id, seed: cycle.seed, companyId: company.id, decision });
        await tx`insert into public.lite_results (game_id, cycle_id, company_id, result) values (${game.id}, ${cycle.id}, ${company.id}, ${tx.json(result)})`;
        await tx`update public.lite_companies set cash = ${result.cashEnd}, inventory = ${tx.json(result.inventory)} where id = ${company.id} and game_id = ${game.id}`;
      }
      await tx`update public.lite_cycles set status = 'closed' where id = ${cycle.id} and status = 'open'`;
      return cycle.id;
    } catch (cause) {
      // Attaching the ID lets this sweep skip a broken cycle after rollback.
      throw new CycleCloseError(cycle.id, { cause });
    }
  });
}

export class CycleCloseError extends Error {
  constructor(cycleId, options) { super('Cycle close failed', options); this.cycleId = cycleId; }
}

// Bound work per invocation. Subsequent cron calls pick up due cycles after a
// crash or outage; one poisoned cycle does not starve other games in the sweep.
export async function sweep(close, limit = 20) {
  const excluded = []; let closed = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    try {
      const id = await close(excluded);
      if (!id) break;
      closed++;
    } catch (error) {
      if (!(error instanceof CycleCloseError)) throw error;
      excluded.push(error.cycleId); failed++;
    }
  }
  return { closed, failed };
}
