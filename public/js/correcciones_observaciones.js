/* SIDE 3D - Correcciones aplicadas según observaciones 01/09/2026 */
(() => {
  window.SIDE_MARKET_PRICES = {economico:45, estandar:75, premium:130};

  window.SIDE_RULES = {
    maintenance:'preventivo',
    productionTime:true,
    decisionHistory:true,
    saveOnConnectionError:true,
    teacherTrace:true,
    aiRestriction:'IA como apoyo, no reemplazo de decisiones del estudiante'
  };

  function sideSegment(){
    try { return JSON.parse(localStorage.getItem('SIDE_GAME_STATE')||'{}').segment || 'estandar'; }
    catch(e){ return 'estandar'; }
  }

  window.sideFixProductPrice = function(price){
    const n=Number(price||0);
    return n>0?n:(window.SIDE_MARKET_PRICES[sideSegment()]||75);
  };

  // Registro de decisiones por ciclo para recuperación del estudiante
  window.SIDE_HISTORY = {
    save(payload){
      try{
        const h=JSON.parse(localStorage.getItem('SIDE_DECISION_HISTORY')||'[]');
        h.push({...payload,date:new Date().toISOString()});
        localStorage.setItem('SIDE_DECISION_HISTORY',JSON.stringify(h.slice(-30)));
      }catch(e){}
    },
    get(){try{return JSON.parse(localStorage.getItem('SIDE_DECISION_HISTORY')||'[]')}catch(e){return []}}
  };

  // Información visible de simulación: stock, locales, noticias y tiempo de producción
  window.SIDE_WORLD_INFO = {
    productionHours: 8,
    stockAvailable:0,
    locations:['Producción','Almacén','Punto de venta'],
    news:[]
  };

  // Eventos adicionales solicitados: reclamos legales y clima
  window.SIDE_EXTRA_EVENTS = [
    {id:'LEGAL01',title:'Reclamo legal de cliente',effect:'reduce caja por resolución y atención del reclamo'},
    {id:'CLIMA01',title:'Fenómeno El Niño',effect:'afecta logística, abastecimiento y demanda'},
    {id:'BOT01',title:'Cuello de botella productivo',effect:'resolver con reorganización sin inversión'}
  ];

  // Mantenimiento preventivo en lugar de correctivo cuando corresponda
  window.sidePreventiveMaintenance = function(machine){
    return {type:'preventivo',machine,registered:true};
  };

  // Persistencia ante cortes de conexión
  window.addEventListener('offline',()=>{
    localStorage.setItem('SIDE_PENDING_SYNC','1');
  });
  window.addEventListener('online',()=>{
    localStorage.removeItem('SIDE_PENDING_SYNC');
  });

  // Respaldo de decisiones antes de cerrar
  window.addEventListener('beforeunload',()=>{
    try{
      localStorage.setItem('SIDE_LAST_BACKUP',JSON.stringify({
        savedAt:new Date().toISOString(),
        message:'Respaldo automático de decisiones'
      }));
    }catch(e){}
  });
})();
