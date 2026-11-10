// A scene owns its own shuffled bag. No selected player avatar belongs in a bag.
const PLAYER_IDS=new Set(['chico1','chico2','chico3','mona']);
export const NPC_ROLES=Object.freeze(['cliente','tienda','almacen','produccion','oficina','banco','cajero','proveedor','guardia']);
const ROLES=new Set(NPC_ROLES);
export const npcHasRole=(row,role)=>row?.rol===role||Array.isArray(row?.roles)&&row.roles.includes(role);
const shuffle=(items,random)=>{const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy};

export function validCityManifest(rows){
  if(!Array.isArray(rows))return [];
  const ids=new Set();
  return rows.filter(row=>{
    if(!row||typeof row.id!=='string'||PLAYER_IDS.has(row.id)||ids.has(row.id)||!ROLES.has(row.rol))return false;
    if(row.roles!==undefined&&(!Array.isArray(row.roles)||row.roles.some(role=>!ROLES.has(role))||new Set(row.roles).size!==row.roles.length))return false;
    const publicCC0=/^assets\/models\/npc\/[a-z0-9_-]+\.glb$/.test(row.archivo)&&/^CC0(?:-1\.0)?$/i.test(row.licencia||'');
    const privateMixamo=row.privado===true&&/^assets\/models\/npc\/private\/[a-z0-9_-]+\.glb$/i.test(row.archivo)&&row.licencia==='Mixamo';
    if(!publicCC0&&!privateMixamo)return false;
    if(!Number.isFinite(row.altura)||row.altura<1||row.altura>2.3)return false;
    ids.add(row.id);return true;
  });
}

export function createCityRoster(rows,{random=Math.random}={}){
  const approved=validCityManifest(rows),bags=new Map(),counts=new Map();
  function draw(scene,role,nearby=[],{unique=false}={}){
    const pool=approved.filter(row=>npcHasRole(row,role));
    if(!pool.length)return null;
    const key=`${scene}:${role}`;let bag=bags.get(key);
    if(!bag?.length){bag=shuffle(pool,random);bags.set(key,bag)}
    const near=new Set(nearby.map(item=>typeof item==='string'?item:item?.id));
    const different=bag.findIndex(row=>!near.has(row.id));
    // Interior staff cannot visually repeat a nearby actor, even when the
    // shuffled bag's remaining outfits are all already in the neighborhood.
    let uniqueModel=null;
    if(different<0){
      const eligible=pool.filter(row=>!near.has(row.id));
      if(!eligible.length&&unique)return null;
      if(eligible.length)uniqueModel=shuffle(eligible,random)[0];
    }
    const index=different>=0?different:0;
    const model=uniqueModel||bag.splice(index,1)[0];
    const count=counts.get(key)||0;counts.set(key,count+1);
    // Variation only begins after the first full pass through the pool.
    const repeated=count>=pool.length||near.has(model.id);
    return {model,repeated,heightScale:repeated?0.96+random()*.08:1,
      tint:repeated?Math.floor(random()*0xffffff):null,animationOffset:random()*8};
  }
  function reset(scene){for(const key of bags.keys())if(key.startsWith(`${scene}:`)){bags.delete(key);counts.delete(key)}}
  return {draw,reset,models:approved};
}
