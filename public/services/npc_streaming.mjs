import {validCityManifest,npcHasRole} from './npc_city_roster.mjs';

export const NPC_TIER_LIMITS=Object.freeze({low:4,medium:8,high:16,auto:8});
export const NPC_ZONE_ROLES=Object.freeze({
  tienda:['tienda','cajero','cliente'],almacen:['almacen','proveedor'],
  produccion:['produccion','proveedor'],oficina:['oficina','banco'],
  banco:['banco','cajero','guardia'],proveedores:['proveedor','almacen'],
  calle:['cliente','guardia']
});

// Pure loading plan. The caller may evict a template only after its live clone
// count reaches zero; this function never disposes shared Three.js resources.
export function planNpcStreaming(rows,{tier='auto',zone='calle',loadedIds=[],busyIds=[]}={}){
  const approved=validCityManifest(rows);
  const roles=NPC_ZONE_ROLES[zone]||NPC_ZONE_ROLES.calle;
  const cap=NPC_TIER_LIMITS[tier]||NPC_TIER_LIMITS.auto;
  const loaded=new Set(loadedIds),busy=new Set(busyIds);
  const priority=row=>{
    const roleIndex=roles.findIndex(role=>npcHasRole(row,role));
    return (roleIndex<0?roles.length:roleIndex)*1_000_000+
      (loaded.has(row.id)?-100_000:0)+(Number(row.bytes)||1_500_000);
  };
  const desired=[...approved].sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id)).slice(0,cap);
  const keep=new Set(desired.map(row=>row.id));
  return {
    cap,desired,
    load:desired.filter(row=>!loaded.has(row.id)),
    evictCandidates:approved.filter(row=>loaded.has(row.id)&&!keep.has(row.id)&&!busy.has(row.id)).map(row=>row.id)
  };
}
