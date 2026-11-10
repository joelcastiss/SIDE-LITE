/* SIDE Enterprise World V7 - Visual integration layer */
(() => {
  const state = window.SIDE_ENTERPRISE_WORLD || {};
  state.v = 7;
  state.zones = state.zones || {
    warehouse: {label:'Almacén', active:true, stockVisual:0},
    production: {label:'Producción', active:true, machines:0},
    office: {label:'Oficina', active:true}
  };

  state.sync = function(data={}){
    const machines = Number(data.machinesInstalled || data.machines || 0);
    this.zones.production.machines = machines;
    this.zones.warehouse.stockVisual = Number(data.inventory || 0);
    this.updatedAt = Date.now();
    window.dispatchEvent(new CustomEvent('SIDE_WORLD_UPDATED_V7',{detail:this}));
  };

  state.getZone = function(id){ return this.zones[id] || null; };
  window.SIDE_ENTERPRISE_WORLD = state;
})();
