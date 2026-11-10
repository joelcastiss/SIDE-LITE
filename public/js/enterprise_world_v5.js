/* SIDE V5 - Integración visual empresa 3D
   Capa adicional para conectar decisiones con mundo.
*/
(function(){
  const KEY='side_enterprise_visual_v5';
  const state=()=>{
    try{return JSON.parse(localStorage.getItem(KEY))||{machines:0,stores:[],inventory:0};}
    catch(e){return {machines:0,stores:[],inventory:0};}
  };
  function save(s){localStorage.setItem(KEY,JSON.stringify(s));}

  window.SIDEEnterpriseWorld={
    getState:state,
    installMachine(){
      const s=state(); s.machines++; save(s); return s;
    },
    unlockStore(name){
      const s=state(); if(!s.stores.includes(name)) s.stores.push(name); save(s); return s;
    },
    updateInventory(amount){
      const s=state(); s.inventory=Math.max(0,(s.inventory||0)+amount); save(s); return s;
    },
    refreshWorld(){
      const s=state();
      document.dispatchEvent(new CustomEvent('SIDE_WORLD_UPDATE',{detail:s}));
      return s;
    }
  };

  document.addEventListener('SIDE_WORLD_UPDATE',e=>{
    const s=e.detail||state();
    const info=document.getElementById('enterpriseWorldStatus');
    if(info){
      info.textContent=`Máquinas: ${s.machines} | Tiendas: ${s.stores.length} | Stock: ${s.inventory}`;
    }
  });
})();
