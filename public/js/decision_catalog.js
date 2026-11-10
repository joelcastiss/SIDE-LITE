/* Costos v19: MP por unidad física (descuento separado); nómina MYPE con beneficios
 * según Costos De Producción y engine/costos.costoLaboral, no sueldo referencial. */
const SIDE_DECISION_CATALOG_DATA = [
  {
    cat:'A', title:'Resumen', short:'Resumen', icon:'assets/side_logo.png', summaryOnly:true,
    desc:'Consulta las decisiones del ciclo, el plan de producción por proceso y los costos estimados de tu empresa.',
    items:[]
  },
  {
    cat:'B', title:'Infraestructura', short:'Infraestructura', icon:'assets/icons/categories/infraestructura.svg',
    desc:'Compra activos, define el local de producción y administra el mantenimiento de la planta.',
    items:[
      // dailyCapacity = unidades/día que aporta CADA equipo de esa opción (valor referencial,
      // ajustar al modelo real del curso). liquidationRate = % del costo original que se
      // recupera al vender/liquidar una unidad ya adquirida (ver "Despido y liquidación").
      {id:'MESA_CORTE',required:false,name:'Mesas de corte',type:'quantity',asset:true,unlimited:true,options:[
        {id:'mesa',label:'Mesa de corte',desc:'Mesa de trabajo para la etapa de corte. Puedes adquirir más de una.',cost:2500,dailyCapacity:40,liquidationRate:0.4}
      ]},
      {id:'ENSAMBLE',required:false,name:'Máquinas de ensamblado',type:'quantity-choice',asset:true,unlimited:true,options:[
        {id:'ens_basica',label:'Básica / manual',desc:'Equipo básico para diseños sencillos.',cost:3500,dailyCapacity:15,liquidationRate:0.4},
        {id:'ens_semi',label:'Semi-industrial',desc:'Mayor estabilidad y velocidad de producción.',cost:7500,dailyCapacity:30,liquidationRate:0.4},
        {id:'ens_ind',label:'Industrial',desc:'Equipo de alto desempeño para producción intensiva.',cost:15000,dailyCapacity:55,liquidationRate:0.4}
      ]},
      {id:'ACABADOS',required:false,name:'Máquinas de acabados',type:'quantity-choice',asset:true,unlimited:true,options:[
        {id:'aca_basica',label:'Básica / manual',desc:'Acabado manual con herramientas básicas.',cost:1200,dailyCapacity:15,liquidationRate:0.4},
        {id:'aca_semi',label:'Semi-industrial',desc:'Pulido eléctrico y aplicación más uniforme.',cost:4500,dailyCapacity:30,liquidationRate:0.4},
        {id:'aca_ind',label:'Industrial',desc:'Línea de acabado para mayor volumen y consistencia.',cost:9500,dailyCapacity:55,liquidationRate:0.4}
      ]},
      {id:'MOLDE',name:'Molde de producto',type:'choice',fixed:false,lockAfterPurchase:false,noDepreciation:true,required:true,options:[
        {id:'molde_1',label:'Molde básico',desc:'Patrón sencillo para una línea de entrada.',cost:300},
        {id:'molde_2',label:'Molde mejorado',desc:'Patrón técnico con mejor aprovechamiento del material.',cost:1200},
        {id:'molde_3',label:'Molde premium',desc:'Patrón propio orientado a diferenciación y detalle.',cost:3500}
      ]},
      {id:'LOCAL_PROD',name:'Local de producción',type:'choice',required:true,recurring:true,mandatoryFixed:true,defaultOptionIds:['local_std'],options:[
        {id:'local_std',label:'Local de producción estándar',desc:'Costo operativo obligatorio para contar con un espacio de producción.',cost:2000}
      ]},
      {id:'MANTENIMIENTO',name:'Mantenimiento de maquinaria',type:'choice',required:false,options:[
        {id:'correctivo',label:'Mantenimiento preventivo',desc:'Intervención opcional para prevenir fallas. Vuelve a pulsar para dejarla sin selección.',cost:1500}
      ]}
    ]
  },
  {
    cat:'C', title:'Producción', short:'Producción', icon:'assets/icons/categories/recursos_humanos.svg',
    desc:'Define el volumen del ciclo y organiza el personal que opera la línea única de corte, ensamblado y acabado.',
    items:[
      {id:'PRODUCCION_META',name:'¿Cuánto deseas producir?',type:'production-plan',recurring:true,required:true,min:1,step:1,unit:'unidades',desc:'Indica cuánto deseas producir por cada tipo de molde. SIDE calcula los insumos necesarios para tu meta y luego los compara con tus recursos disponibles.',cost:0},
      {id:'PERS_CORTE',required:false,name:'Personal de corte',desc:'Costo mensual del personal elegido.',type:'quantity-choice',recurring:true,severanceEligible:true,options:[
        {id:'corte_basico',label:'Operario básico',desc:'Apoya tareas de corte con procesos estandarizados.',cost:1690.8},
        {id:'corte_exp',label:'Cortador con experiencia',desc:'Mejor aprovechamiento del material y mayor velocidad.',cost:2254.4},
        {id:'corte_maestro',label:'Maestro cortador',desc:'Especialista para materiales y diseños complejos.',cost:4191.36}
      ]},
      {id:'PERS_ENSAMBLE',required:false,name:'Personal de ensamble',desc:'Costo mensual del personal elegido.',type:'quantity-choice',recurring:true,severanceEligible:true,options:[
        {id:'ens_personal_basico',label:'Costurero básico',desc:'Adecuado para diseños simples y tareas repetitivas.',cost:1690.8},
        {id:'ens_personal_ind',label:'Maquinista industrial',desc:'Opera equipos industriales con mayor productividad.',cost:3104.16},
        {id:'ens_personal_esp',label:'Marroquinero especializado',desc:'Especialista para piezas complejas y líneas premium.',cost:4952.4}
      ]},
      {id:'PERS_ACABADO',required:false,name:'Personal de acabados',desc:'Costo mensual del personal elegido.',type:'quantity-choice',recurring:true,severanceEligible:true,options:[
        {id:'aca_personal_basico',label:'Operario de acabado',desc:'Realiza acabados básicos y tareas de apoyo.',cost:1690.8},
        {id:'aca_personal_tec',label:'Técnico en acabados',desc:'Maneja herramientas y equipos de acabado.',cost:3104.16},
        {id:'aca_personal_art',label:'Artesano acabador',desc:'Realiza acabados finos y detalles especiales.',cost:4952.4}
      ]},
      {id:'JEFATURA',required:false,name:'Jefatura de producción',desc:'Costo mensual del personal elegido.',type:'choice',recurring:true,options:[
        {id:'no_jefatura',label:'No contratar',desc:'La coordinación queda a cargo del equipo.',cost:0},
        {id:'si_jefatura',label:'Contratar',desc:'Incorpora una jefatura para coordinar la operación.',cost:3321.6}
      ]},
      {id:'LIMPIEZA',name:'Limpieza y servicios generales',type:'choice',required:true,recurring:true,mandatoryFixed:true,defaultOptionIds:['limpieza'],options:[
        {id:'limpieza',label:'Limpieza y servicios generales',desc:'Costo operativo fijo obligatorio para mantener el área de producción.',cost:712.32}
      ]},
      {id:'GARANTIA_PT',name:'Garantía de productos terminados',type:'choice',noCashEffect:true,recurring:true,required:true,showPrice:false,options:[
        {id:'pt_30',label:'Cobertura comercial 30 días',desc:'Política básica de respaldo al cliente para productos terminados.',cost:0,value:30},
        {id:'pt_90',label:'Cobertura comercial 90 días',desc:'Mayor respaldo posventa y confianza del cliente.',cost:0,value:90},
        {id:'pt_180',label:'Cobertura comercial 180 días',desc:'Política amplia de respaldo para líneas de mayor valor.',cost:0,value:180}
      ]}
    ]
  },
  {
    cat:'F', title:'Logística', short:'Logística', icon:'assets/icons/categories/insumos.svg',
    desc:'Planifica las compras y el abastecimiento de materias primas que alimentan el área productiva durante el ciclo.',
    items:[
      {id:'ANALISTA_COMPRAS',required:false,name:'Analista de compras',type:'choice',recurring:true,options:[
        {id:'no_analista',label:'No contratar',desc:'Compras sin negociación especializada.',cost:0},
        {id:'si_analista',label:'Contratar',desc:'S/ 5,000 por ciclo. Negocia mejores condiciones; el beneficio porcentual es mayor al inicio y luego se reduce.',cost:5000}
      ]},
      {id:'CUERO',name:'Compra de cuero',desc:'Cantidad en metros cuadrados (m²). El analista de compras aplica su descuento.',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
        {id:'cuero_sint',label:'Cuero sintético',desc:'Alternativa económica.',cost:25},
        {id:'cuero_std',label:'Cuero genuino estándar',desc:'Balance entre costo y durabilidad.',cost:45},
        {id:'cuero_prem',label:'Cuero genuino premium',desc:'Mayor durabilidad y acabado.',cost:80}
      ]},
      {id:'ACCESORIOS',name:'Compra de accesorios',desc:'Cantidad en unidades. El analista de compras aplica su descuento.',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
        {id:'acc_eco',label:'Aleación económica',desc:'Accesorio funcional de menor costo.',cost:4},
        {id:'acc_prem',label:'Metal premium',desc:'Mayor durabilidad y mejor acabado.',cost:9}
      ]},
      {id:'HILO',name:'Compra de hilo',desc:'Cantidad en metros de hilo. El analista de compras aplica su descuento.',type:'quantity-choice',material:true,recurring:true,requiredWhenProduction:true,options:[
        {id:'hilo_std',label:'Poliéster estándar',desc:'Opción de costo bajo y resistencia media.',cost:2},
        {id:'hilo_ref',label:'Encerado reforzado',desc:'Mayor resistencia a tensión.',cost:4},
        {id:'hilo_prem',label:'Alta tenacidad',desc:'Alta resistencia para acabados exigentes.',cost:7}
      ]},
      {id:'GARANTIA_PROV',required:false,name:'Garantía de proveedores',type:'choice',noCashEffect:true,recurring:true,showPrice:false,options:[
        {id:'gar_0',label:'Sin garantía',desc:'No hay porcentaje de devolución por material fallado.',cost:0,value:0},
        {id:'gar_80',label:'80% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 80% del valor correspondiente.',cost:0,value:80},
        {id:'gar_100',label:'100% de devolución',desc:'Ante una falla cubierta, el proveedor devuelve el 100% del valor correspondiente.',cost:0,value:100}
      ]}
    ]
  },
  {
    cat:'D', title:'Canales y ventas', short:'Ventas', icon:'assets/icons/categories/canales_ventas.svg',
    desc:'Elige dónde vender. La demanda cambia por distrito y el equipo comercial se activa cuando existe una tienda física.',
    items:[
      {id:'CANALES',name:'Canales de venta',type:'multi-choice',recurring:true,required:true,minSelections:1,options:[
        {id:'web',label:'Página web',desc:'Canal digital con cobertura amplia.',cost:500,channel:'web'},
        {id:'los_olivos',label:'Tienda · Los Olivos',desc:'Punto físico con demanda distrital propia. Compromiso mínimo de 12 meses: no se puede rescindir el contrato antes.',cost:1800,channel:'store',district:'Los Olivos',demand:1.00,minCommitCycles:12},
        {id:'miraflores',label:'Tienda · Miraflores',desc:'Punto físico con mayor demanda potencial y mayor costo. Compromiso mínimo de 12 meses: no se puede rescindir el contrato antes.',cost:3500,channel:'store',district:'Miraflores',demand:1.25,minCommitCycles:12},
        {id:'sjl',label:'Tienda · San Juan de Lurigancho',desc:'Punto físico con alta base poblacional y demanda distrital propia. Compromiso mínimo de 12 meses: no se puede rescindir el contrato antes.',cost:2200,channel:'store',district:'San Juan de Lurigancho',demand:1.10,minCommitCycles:12}
      ]},
      {id:'PERSONAL_VENTAS',name:'Personal básico de ventas',type:'info',desc:'Cada tienda física incluye automáticamente 1 vendedor básico. Su remuneración variable equivale al 1% de las ventas realizadas en el simulador.'},
      {id:'CREDITO_VENTAS',name:'Ventas a crédito',type:'info',desc:'El porcentaje inicia fijo y aumenta según avanzan los ciclos. No es una decisión del jugador.'},
      {id:'DEVOLUCIONES',name:'Producto fallado',type:'info',displayAsAsterisk:true,desc:'Si un producto vendido presenta una falla que corresponde devolver, la empresa reintegra el dinero al cliente.'}
    ]
  },
  {
    cat:'E', title:'Inversiones y finanzas', short:'Finanzas', icon:'assets/icons/categories/finanzas.svg',
    desc:'Decide inversiones de crecimiento y, si lo necesitas, solicita financiamiento bancario.',
    items:[
      {id:'INV_RRHH',name:'Capacitación del equipo',type:'choice',recurring:true,required:false,options:[
        {id:'cap_no',label:'No capacitar este ciclo',desc:'No se realiza inversión en capacitación durante este ciclo.',cost:0},
        {id:'cap_baja',label:'Baja',desc:'Capacitación técnica puntual.',cost:1000},
        {id:'cap_media',label:'Media',desc:'Programa de capacitación técnica intermedia.',cost:6000},
        {id:'cap_alta',label:'Alta',desc:'Capacitación avanzada y especializada.',cost:12000}
      ]},
      {id:'INV_MARKETING',name:'Inversión en marketing',type:'choice',recurring:true,required:false,options:[
        {id:'mkt_baja',label:'Baja',desc:'Presencia básica de marca.',cost:1500},
        {id:'mkt_media',label:'Media',desc:'Mayor alcance y frecuencia comercial.',cost:6000},
        {id:'mkt_alta',label:'Alta',desc:'Campaña intensiva para acelerar visibilidad y demanda.',cost:12000}
      ]},
      {id:'PRESTAMO',name:'Línea de crédito',type:'loan',required:false,desc:'La línea inicia en 70% de la caja. En los siguientes ciclos puede aumentar o disminuir según la caja y los activos; el monto utilizado reduce la línea disponible.'}
    ]
  }
];
if(typeof module==='object'&&module.exports)module.exports=SIDE_DECISION_CATALOG_DATA;
else window.SIDE_DECISION_CATALOG=SIDE_DECISION_CATALOG_DATA;
