/**
 * SIDE Visual V10
 * Puente entre estado empresarial y mundo 3D.
 * Preparado para spawner de maquinaria, zonas y entidades visuales.
 */
(function(){
  window.SIDE_VISUAL_V10 = {
    zones:{
      warehouse:{id:'warehouse',name:'Almacen',position:{x:-8,y:0,z:0}},
      production:{id:'production',name:'Produccion',position:{x:0,y:0,z:0}},
      office:{id:'office',name:'Oficina',position:{x:8,y:0,z:0}}
    },
    getMachines(state){
      return Number(state?.machines || state?.maquinaria || 0);
    },
    buildMachineSlots(count){
      const slots=[];
      for(let i=0;i<count;i++) slots.push({id:`machine_${i+1}`,zone:'production',active:true});
      return slots;
    },
    getInventoryBoxes(stock){
      return Math.max(0, Math.ceil(Number(stock||0)/10));
    },
    sync(state){
      const data={
        machines:this.getMachines(state),
        machineSlots:this.buildMachineSlots(this.getMachines(state)),
        inventoryBoxes:this.getInventoryBoxes(state?.inventory?.products || state?.stock || 0),
        zones:this.zones
      };
      window.dispatchEvent(new CustomEvent('SIDE_VISUAL_SYNC_V10',{detail:data}));
      return data;
    }
  };
})();
