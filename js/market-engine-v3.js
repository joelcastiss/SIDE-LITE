/** Provisional v3 allocation. Each segment has a finite pool of consumers.
 * This module does not change the official v2 close path. */
import { marketingFactor } from './engine.js';

const qualities = ['basic', 'standard', 'premium'];
const affinity = {
  basic: [1, .35, .12],
  standard: [.35, 1, .35],
  premium: [.12, .35, 1]
};

/** Return integer demand per company; inventory limits sales in the close engine.
 * Unallocated fractions and stockouts are not redistributed. */
export function allocateDistrictDemand({baseDemand, shares, companies, demandFactor=1, event=null}) {
  if (!Number.isSafeInteger(baseDemand) || baseDemand < 0 || !Number.isFinite(demandFactor) || demandFactor < 0 ||
      !Array.isArray(shares) || shares.length !== 3 || shares.some(x=>!Number.isFinite(x) || x<=0) ||
      Math.abs(shares.reduce((a,b)=>a+b,0)-1)>1e-9 || !Array.isArray(companies)) throw new Error('Mercado inválido');
  const ids = new Set();
  const eligible = companies.map(c=>{
    if (typeof c.id !== 'string' || !c.id || ids.has(c.id)) throw new Error('Empresa inválida');
    ids.add(c.id);
    if (!c.decision) return {id:c.id, weights:[0,0,0]};
    const {quality,price,marketingAmount}=c.decision;
    if (!qualities.includes(quality) || !Number.isSafeInteger(price) || price<1) throw new Error('Decisión inválida');
    const marketing=1+(marketingFactor(marketingAmount)-1)*(event?.marketingStrength ?? 1);
    const priceFactor=Math.pow(Math.max(.1,Math.min(2,100/price)),event?.priceSensitivity ?? 1);
    const qualityFactor=event?.quality?.[quality] ?? 1;
    return {id:c.id,weights:affinity[quality].map(a=>a*priceFactor*marketing*qualityFactor)};
  });
  const allocations=Object.fromEntries(eligible.map(c=>[c.id,0]));
  const total=Math.floor(baseDemand*demandFactor);
  // Largest remainder gives the three segments exactly the available total.
  const raw=shares.map(s=>s*total), pools=raw.map(Math.floor);
  let remainder=total-pools.reduce((a,b)=>a+b,0);
  for (const i of [0,1,2].sort((a,b)=>(raw[b]-pools[b])-(raw[a]-pools[a]) || a-b)) {
    if (remainder-- > 0) pools[i]++;
  }
  for (let segment=0;segment<3;segment++) {
    // The outside option represents shoppers who buy elsewhere or do not buy.
    // It prevents price and marketing from cancelling out for a sole seller.
    const weight=1+eligible.reduce((sum,c)=>sum+c.weights[segment],0);
    for (const c of eligible) allocations[c.id]+=Math.floor(pools[segment]*c.weights[segment]/weight+1e-9);
  }
  return allocations;
}
