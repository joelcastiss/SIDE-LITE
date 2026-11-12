import { closeCycle } from '../../../js/engine.js';
import { closeDistrictCycle } from '../../../js/district-cycle-v3.js';

// Every call owns a single transaction. All submit/pause/start operations MUST
// lock the same cycle row before checking its state, deadline or decisions.
export async function closeOne(sql, excluded = [], gameId = null) {
  return await sql.begin(async tx => {
    const cycles = await tx`
      select c.id, c.game_id, c.event_id, s.seed
      from public.lite_cycles c
      left join side_lite_private.lite_cycle_secrets s on s.cycle_id = c.id
      where c.status = 'open' and c.paused_at is null
        and c.ends_at <= clock_timestamp()
        and (${gameId}::uuid is null or c.game_id = ${gameId}::uuid)
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
      const [configuration] = await tx`select rule_version from public.lite_game_markets where game_id = ${game.id}`;
      const decisions = new Map();
      for (const company of companies) {
        const [d] = await tx`select quality, quantity, price, marketing_amount from public.lite_decisions where cycle_id = ${cycle.id} and game_id = ${game.id} and company_id = ${company.id} and confirmed`;
        decisions.set(company.id,d ? { quality:d.quality, quantity:d.quantity, price:d.price, marketingAmount:d.marketing_amount } : null);
      }
      let calculated;
      if (configuration?.rule_version === 'district-v3') {
        const markets = await tx`select cm.company_id, cm.district_id, gd.base_demand, gd.economic_share, gd.standard_share, gd.premium_share from public.lite_company_markets cm join public.lite_game_districts gd on gd.game_id=cm.game_id and gd.district_id=cm.district_id where cm.game_id=${game.id}`;
        const [eventRow] = cycle.event_id ? await tx`select effect from public.lite_events where id=${cycle.event_id}` : [];
        if(cycle.event_id && !eventRow) throw new Error('Missing event');
        const groups = new Map();
        for (const company of companies) {
          const market=markets.find(m=>m.company_id===company.id); if(!market) throw new Error('Missing district');
          if(!groups.has(market.district_id)) groups.set(market.district_id,{district:{id:market.district_id,baseDemand:market.base_demand,shares:[+market.economic_share,+market.standard_share,+market.premium_share]},companies:[]});
          groups.get(market.district_id).companies.push({id:company.id,cash:company.cash,batches:company.inventory,decision:decisions.get(company.id)});
        }
        calculated = [...groups.values()].flatMap(group=>closeDistrictCycle({...group,costs:game.costs,event:eventRow?.effect || null}));
      } else {
        calculated=companies.map(company=>({companyId:company.id,...closeCycle({cash:company.cash,batches:company.inventory,costs:game.costs,event:cycle.event_id,seed:cycle.seed,companyId:company.id,decision:decisions.get(company.id)})}));
      }
      for (const result of calculated) {
        const {companyId,...legacy}=result; const stored=configuration?.rule_version === 'district-v3' ? result : legacy;
        await tx`insert into public.lite_results (game_id, cycle_id, company_id, result) values (${game.id}, ${cycle.id}, ${companyId}, ${tx.json(stored)})`;
        await tx`update public.lite_companies set cash = ${stored.cashEnd}, inventory = ${tx.json(stored.inventory)} where id = ${companyId} and game_id = ${game.id}`;
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
