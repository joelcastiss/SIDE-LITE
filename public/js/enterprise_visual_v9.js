/* SIDE Visual V9 - conexiones visibles planta/ciudad */
(() => {
  window.SIDE_VISUAL_V9 = {
    machines: [],
    clear(){ this.machines=[]; },
    sync(state={}){
      const qty = Number(state.machines || state.maquinaria || 0);
      this.machines = Array.from({length: Math.max(0, qty)}, (_,i)=>({
        id:`machine_${i+1}`,
        zone:'production',
        slot:i
      }));
      window.dispatchEvent(new CustomEvent('SIDE_VISUAL_SYNC_V9',{detail:this.machines}));
    }
  };
})();
