/* SIDE V6 - Mundo visual empresarial: zonas, spawner y sincronización */
(function(){
 const KEY='side_enterprise_visual_v6';
 function get(){try{return JSON.parse(localStorage.getItem(KEY))||{machines:0,stores:[],inventory:0, zones:{warehouse:true,production:true,office:true}}}catch(e){return {machines:0,stores:[],inventory:0,zones:{}}}}
 function set(v){localStorage.setItem(KEY,JSON.stringify(v));}
 function emit(v){document.dispatchEvent(new CustomEvent('SIDE_WORLD_VISUAL_UPDATE',{detail:v}));}
 window.SIDEVisualWorld={
  state:get,
  installMachine(n=1){let s=get();s.machines+=Number(n);set(s);emit(s);return s;},
  setInventory(n){let s=get();s.inventory=Math.max(0,Number(n));set(s);emit(s);return s;},
  unlockStore(name){let s=get();if(name&&!s.stores.includes(name))s.stores.push(name);set(s);emit(s);return s;},
  zones(){return get().zones;},
  refresh(){let s=get();emit(s);return s;}
 };
 document.addEventListener('SIDE_WORLD_VISUAL_UPDATE',e=>{
   const s=e.detail;
   const el=document.getElementById('enterpriseWorldStatus');
   if(el) el.textContent=`Planta: ${s.machines} máquinas | Stock: ${s.inventory} | Locales: ${s.stores.length}`;
 });
 window.addEventListener('load',()=>emit(get()));
})();
