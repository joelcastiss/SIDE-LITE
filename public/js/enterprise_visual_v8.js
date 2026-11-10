/* SIDE V8 - Visual enterprise layer
   Connects business state with visible world objects.
*/
(function(){
  window.SIDEVisualV8 = {
    sync(sceneState={}){
      window.dispatchEvent(new CustomEvent('SIDE_VISUAL_SYNC_V8',{detail:sceneState}));
    },
    machineSlots(count){
      return Array.from({length:Math.max(0,count)},(_,i)=>({id:i+1,zone:'production'}));
    },
    warehouseBoxes(stock){
      return Math.min(30, Math.ceil(Number(stock||0)/5));
    },
    enabledStores(stores=[]){
      return stores.map(s=>({name:s,active:true}));
    }
  };
})();
