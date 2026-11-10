/* Parámetros contrastados con DECISIONES SIDE (16).xlsx y decisiones explícitas del pedido. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SIDE_EXCEL_CONFIG=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CONFIG={
    VERSION:'excel-16',DIAS_CICLO:24,CICLO_EQUIVALE_A_MESES:1,
    // Decisiones congeladas: 14 grupos de Seleccion_Ciclo0 y los dos temas ya presentes en 9fbe6ec.
    GRUPOS_MOTOR:['Maquina de ensamblado','Maquina de acabados','Molde','Personal de corte','Personal de ensamble','Personal de acabados','Jefatura','Canal de venta','Acceso a prestamo bancario','Numero de proveedores','Politica de pago a proveedores','Lead time','Inversion en RR.HH.','Inversion en marketing','Garantía del producto','Mantenimiento de maquinaria'],
    DECISIONES_VISIBLES:['Maquina de ensamblado','Maquina de acabados','Molde','Personal de corte','Personal de ensamble','Personal de acabados','Jefatura','Canal de venta','Acceso a prestamo bancario','Inversion en RR.HH.'],
    CAMPOS_LEGACY_VISIBLES:['garantiaDias','mantenimientoPreventivo','tiendasPorDistrito','marketingNivel','analistaCompras','garantiaProveedor'],
    GARANTIA_DIAS_BASE:[30,90,180],GARANTIA_MAPEO_EXACTO:{30:'COM-06B',90:'COM-06C'},COSTO_MANTENIMIENTO_BASE:200,
    MARKETING_BASE:{baja:{codigo:'INV-02A',costo:1500},media:{codigo:'INV-02B',costo:6000},alta:{codigo:'INV-02C',costo:12000}},
    ANALISTA_BASE:{costo:5000,descuentoInicialPct:12,reduccionPorCicloPct:2,descuentoMinimoPct:2},GARANTIA_PROVEEDOR_BASE:[0,80,100],
    DISTRITOS_TIENDAS:{los_olivos:'Los Olivos',miraflores:'Miraflores',sjl:'San Juan de Lurigancho'},
    PRODUCTIVIDAD:{corte:[5,7,9],ensamble:[6,8,12],acabado:[6,7,10]},
    MULTIPLICADORES_MAQUINA:[1,1.2,1.5],EFICIENCIA_BASE:0.9,BONO_N3:0.01,BONO_JEFATURA:0.04,
    EFICIENCIA_N3_LITERAL:true,ESSALUD_ANUAL_LITERAL:true,CONS08_MODO:'multiplicativo',
    REPUTACION_FUENTE_MERCADO:'operativa',CALIDAD_MERCADO_MODO:'excel_literal',ACCESORIOS_N3_HABILITADO:false,
    CONSUMO_MOLDE:{'INF-08':{cuero:0.3,accesorios:1,hilo:6},'INF-09':{cuero:0.4,accesorios:1,hilo:7},'INF-10':{cuero:0.7,accesorios:1,hilo:13}},
    CONVERSION_COMPRA:{'INS-01':1,'INS-02':2,'INS-03':2,'INS-04':1,'INS-05':1,'INS-06':270,'INS-07':250,'INS-08':200},
    INSUMOS_POR_FAMILIA:{cuero:['INS-01','INS-02','INS-03'],accesorios:['INS-04','INS-05'],hilo:['INS-06','INS-07','INS-08']},
    PRECISION_INVENTARIO:15,
    PRESTAMO_COBRAR_INTERES_CICLO:true,VALORIZACION_MP_MODO:'consumo_real',
    PORCENTAJE_CREDITO_MAX:100,
    PRECIO_MP:{'INS-01':25,'INS-02':45,'INS-03':80,'INS-04':4,'INS-05':9,'INS-06':2,'INS-07':4,'INS-08':7},
    DESCUENTO_CANTIDAD:0.08,DESCUENTO_PROVEEDOR_UNICO:0.02,DESCUENTO_CONTADO:0.03,
    BONO_CAPACIDAD_RRHH:0.08,BONO_DEMANDA_MARKETING:0.12,
    MAX_LOTES:3,PUBLICIDAD_MAX:10000,ESCALA_REPUTACION:10,UMBRAL_ALTO:7,UMBRAL_MEDIO:4,
    UMBRAL_SEGMENTO:{'SEG-01':0,'SEG-02':4,'SEG-03':7},
    CONSECUENCIAS:{CALIDAD_BAJA:4,CALIDAD_PREMIUM:7,PRECIO_BAJO:0.65,PRECIO_PREMIUM:1.4,REPUTACION_CAMBIO:2,EFICIENCIA_BAJA:4,PRODUCCION_BAJA:0.7,REPUTACION_BAJA:3,CICLOS_REPUTACION:2,DEMANDA_BAJA:0.8,SALUD_BAJA:3,EFICIENCIA_SIN_JEFE:5,PRODUCCION_SIN_JEFE:0.95},
    HORAS_EXTRA_PCT:0.25,COSTO_ALMACENAJE_UNIDAD:2,TEA_ADICIONAL_PP:3,TEA_BASE:20,UNIDADES_VIDA:100000,
    CODIGOS_COSTO_RECURRENTE:['COM-01A','COM-01B','COM-01C','INV-01A','INV-01B','INV-01C','INV-02A','INV-02B','INV-02C'],
    PENDIENTE_DEFINIR:['HORAS_EXTRA_PCT','COSTO_ALMACENAJE_UNIDAD','TEA_ADICIONAL_PP','UNIDADES_VIDA','DESCUENTOS_MULTIPLICATIVOS','LEAD_TIME_SOBRECOSTO','INVERSION_ALTA_BAJA','PRESTAMO_COBRAR_INTERES_CICLO','COM_02_03_04_COSTO_DEMANDA','COM_05N_CALENDARIO_COBROS'],
    LEAD_TIME_SOBRECOSTO:0,INVERSION_ALTA_BAJA:0,
    MERCADOS:{'SEG-01':{unidades:7000,penetracion:0.5,pesos:[0.7,0.2,0.1]},'SEG-02':{unidades:5000,penetracion:0.7,pesos:[0.4,0.35,0.25],precioIdeal:100},'SEG-03':{unidades:2000,penetracion:0.4,pesos:[0.1,0.5,0.4],precioIdeal:250}},
    PRECIO_EMPATE:100,ESCALA_MERCADO:100,MODELO1_DIVISOR:10,MODELO1_MAX_MULTIPLICADOR:2,
    MESES_ANIO:12,ESSALUD:0.09,DIVISOR_MO:{MYPE:12.5,NO_MYPE:13},
    SUELDOS:{corte:[1500,2000,3800],ensamble:[1500,2800,4500],acabado:[1500,2800,4500],jefatura:3000,limpieza:600,local:2000},
    // Costos!U8:AD36: CTS escrita a mano; corte N2 conserva fórmula sobre sueldo.
    CTS_LITERAL:{MYPE:750,NO_MYPE:1500},FACTOR_CTS_CORTE_N2:{MYPE:0.5,NO_MYPE:1},
    FACTOR_GRATIFICACION:{MYPE:1,NO_MYPE:2},FACTOR_VACACIONES:{MYPE:0.5,NO_MYPE:1},
    COSTO_POLITICA_MANTENIMIENTO:{'INF-11A':0,'INF-11B':1500,'INF-11C':3000},
    REPUTACION_PUBLICIDAD_DIVISOR:10000,REPUTACION_FACTORES_MP:3,REPUTACION_HILO_DENOMINADOR_LITERAL:true,
    MAQUINARIA:{mesa:{costo:2500,vida:10},'INF-02':{costo:3500,vida:10},'INF-03':{costo:7500,vida:10},'INF-04':{costo:15000,vida:10},'INF-05':{costo:1200,vida:8},'INF-06':{costo:4500,vida:8},'INF-07':{costo:9500,vida:8},'INF-08':{costo:300,vida:5,molde:true},'INF-09':{costo:1200,vida:5,molde:true},'INF-10':{costo:3500,vida:5,molde:true}},
    TASAS_ACTIVOS:{MYPE:{instalacion:0.03,capacitacion:0.02,capacitacionMolde:0.01,mantenimiento:0.05,residual:0.05},NO_MYPE:{instalacion:0.05,capacitacion:0.03,capacitacionMolde:0.02,mantenimiento:0.08,residual:0.1}}
  };
  function excelRound(value,digits=0){if(!Number.isFinite(value))throw new TypeError('Valor no finito');const factor=10**digits,scaled=Math.abs(value)*factor;return Math.sign(value)*Math.floor(scaled+0.5+Number.EPSILON*scaled)/factor;}
  function excelRoundDown(value,digits=0){if(!Number.isFinite(value))throw new TypeError('Valor no finito');const factor=10**digits;return Math.trunc(value*factor)/factor;}
  function configurar(overrides={}){return {...CONFIG,...overrides};}
  return {CONFIG,excelRound,excelRoundDown,configurar};
});
