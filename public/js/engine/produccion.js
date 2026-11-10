(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./config_excel.js'));
  else root.SIDE_EXCEL_PRODUCCION = factory(root.SIDE_EXCEL_CONFIG);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (configModule) {
  'use strict';
  if (!configModule) throw new Error('Debe cargar config_excel.js antes del motor de producción.');
  const { CONFIG, excelRound, excelRoundDown } = configModule;
  const AREAS = ['corte', 'ensamble', 'acabado'];
  const FAMILIAS = ['cuero', 'accesorios', 'hilo'];
  const cantidad = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const suma = values => values.reduce((total, value) => total + value, 0);
  const tiene = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function configuracion(overrides) {
    return Object.assign({}, CONFIG, overrides, {
      PRODUCTIVIDAD: Object.assign({}, CONFIG.PRODUCTIVIDAD, overrides.PRODUCTIVIDAD),
      CONSUMO_MOLDE: Object.assign({}, CONFIG.CONSUMO_MOLDE, overrides.CONSUMO_MOLDE)
    });
  }

  function normalizarPersonal(personal) {
    const resultado = {};
    AREAS.forEach(area => {
      const niveles = personal[area] || [];
      resultado[area] = [0, 1, 2].map(nivel => {
        const fila = niveles[nivel];
        return Array.isArray(fila) ? [0, 1, 2].map(maquina => cantidad(fila[maquina])) : [cantidad(fila), 0, 0];
      });
    });
    return resultado;
  }

  /** Matriz de operarios: filas N1/N2/N3 y columnas manual/semi/industrial.
   * Corte usa únicamente la columna manual (F), como el Excel. */
  function calcularCapacidad(entrada = {}, overrides = {}) {
    const cfg = configuracion(overrides);
    const personal = normalizarPersonal(entrada.personal || {});
    const capacidadPorNivel = {}, capacidadPorArea = {};
    AREAS.forEach(area => {
      capacidadPorNivel[area] = personal[area].map((fila, nivel) => cfg.PRODUCTIVIDAD[area][nivel] *
        (area === 'corte' ? fila[0] : suma(fila.map((n, maquina) => n * cfg.MULTIPLICADORES_MAQUINA[maquina]))));
      capacidadPorArea[area] = suma(capacidadPorNivel[area]);
    });
    const trabajadoresPorNivel = [0, 1, 2].map(nivel => personal.corte[nivel][0] +
      suma(personal.ensamble[nivel]) + suma(personal.acabado[nivel]));
    const totalTrabajadores = suma(trabajadoresPorNivel);
    const trabajadoresN3 = trabajadoresPorNivel[2];
    const n3Eficiencia = cfg.EFICIENCIA_N3_LITERAL ? suma(AREAS.map(area => personal[area][2][0])) : trabajadoresN3;
    const jefes = cantidad(entrada.jefes);
    const factorEficienciaProduccion = cfg.EFICIENCIA_BASE + n3Eficiencia * cfg.BONO_N3 + jefes * cfg.BONO_JEFATURA;
    const capacidadDiaria = Math.min(...AREAS.map(area => capacidadPorArea[area]));
    const seleccion = entrada.seleccion || [];
    const capacitacion = entrada.inversionRRHH === 'INV-01B' || seleccion.includes('INV-01B');
    const factorCapacidad = capacitacion ? 1 + cfg.BONO_CAPACIDAD_RRHH : 1;
    const capacidadCicloBase = capacidadDiaria * cfg.DIAS_CICLO;
    const capacidadCiclo = capacidadCicloBase * factorCapacidad;
    return {
      personal, capacidadPorNivel, capacidadPorArea, capacidadDiaria, capacidadCicloBase, capacidadCiclo,
      factorCapacidad, factorEficienciaProduccion,
      produccionCapacidad: excelRound(capacidadCiclo * factorEficienciaProduccion, 0),
      cuelloBotella: AREAS.filter(area => capacidadPorArea[area] === capacidadDiaria),
      trabajadoresPorNivel, totalTrabajadores, trabajadoresN3,
      proporcionN3: totalTrabajadores ? trabajadoresN3 / totalTrabajadores : 0, n3Eficiencia, jefes
    };
  }

  function normalizarAsignacion(asignacion, codigos) {
    if (Array.isArray(asignacion)) return Object.fromEntries(codigos.map((codigo, i) => [codigo, cantidad(asignacion[i])]));
    if (asignacion && typeof asignacion === 'object') return Object.fromEntries(codigos.map(codigo => [codigo, cantidad(asignacion[codigo])]));
    return Object.fromEntries(codigos.map(codigo => [codigo, 0]));
  }

  /** Todos los inventarios y `compras` están en unidades de producción.
   * `comprasUnidades` está en rollos/pieles/juegos/carretes y se convierte una vez.
   * La asignación explícita puede ser matriz por nivel o mapa INS por familia.
   * Sin almacén explícito, esas asignaciones constituyen el stock del fixture.
   * Con almacén, son límites del lote y nunca crean materia prima. */
  function calcularProduccion(entrada = {}, overrides = {}) {
    const cfg = configuracion(overrides);
    const capacidad = calcularCapacidad(entrada, overrides);
    // Excel conserva quince cifras significativas: impedir que restas de stock
    // (0.6 + 0.3 - 0.6) pierdan una unidad al aplicar ROUNDDOWN al siguiente lote.
    const precisionInventario = valor => Number(valor.toPrecision(cfg.PRECISION_INVENTARIO));
    const lotesEntrada = entrada.lotes || [];
    if (lotesEntrada.length > cfg.MAX_LOTES) throw new RangeError('El Excel admite hasta tres lotes por ciclo.');
    const familias = cfg.INSUMOS_POR_FAMILIA;
    const codigos = FAMILIAS.flatMap(familia => familias[familia]);
    const inventarioInicial = {}, compras = {}, disponibleInicial = {}, saldo = {}, consumoPorInsumo = {};
    const almacenExplicito = tiene(entrada, 'inventario') || tiene(entrada, 'inventarioInicial') || tiene(entrada, 'compras') || tiene(entrada, 'comprasUnidades');
    codigos.forEach(codigo => {
      inventarioInicial[codigo] = cantidad((entrada.inventarioInicial || entrada.inventario || {})[codigo]);
      compras[codigo] = cantidad((entrada.compras || {})[codigo]) +
        cantidad((entrada.comprasUnidades || {})[codigo]) * cfg.CONVERSION_COMPRA[codigo];
      disponibleInicial[codigo] = precisionInventario(inventarioInicial[codigo] + compras[codigo]);
      consumoPorInsumo[codigo] = 0;
    });
    if (!almacenExplicito) lotesEntrada.forEach(lote => {
      FAMILIAS.forEach(familia => {
        const asignados = normalizarAsignacion((lote.asignacion || {})[familia], familias[familia]);
        familias[familia].forEach(codigo => { disponibleInicial[codigo] += asignados[codigo]; compras[codigo] += asignados[codigo]; });
      });
    });
    Object.assign(saldo, disponibleInicial);
    const totalPlaneado = suma(lotesEntrada.map(lote => cantidad(lote.cantidad)));
    const requerimientoTotal = { cuero: 0, accesorios: 0, hilo: 0 };
    const consumoTotal = { cuero: 0, accesorios: 0, hilo: 0 };
    const lotes = lotesEntrada.map((lote, indice) => {
      const deseado = cantidad(lote.cantidad);
      const consumoUnitario = cfg.CONSUMO_MOLDE[lote.molde];
      if (!consumoUnitario) throw new RangeError('Molde no reconocido: ' + lote.molde);
      const capacidadAsignada = totalPlaneado ? excelRoundDown(deseado * capacidad.produccionCapacidad / totalPlaneado, 0) : 0;
      const requerimiento = {}, asignacion = {}, limitesMateriaPrima = {};
      FAMILIAS.forEach(familia => {
        requerimiento[familia] = precisionInventario(deseado * consumoUnitario[familia]);
        requerimientoTotal[familia] += requerimiento[familia];
        const explicita = lote.asignacion && tiene(lote.asignacion, familia);
        const solicitados = explicita ? normalizarAsignacion(lote.asignacion[familia], familias[familia]) : null;
        const codigoElegido = typeof lote[familia] === 'string' ? lote[familia] : null;
        asignacion[familia] = Object.fromEntries(familias[familia].map(codigo => [codigo,
          Math.min(saldo[codigo], explicita ? solicitados[codigo] : (!codigoElegido || codigoElegido === codigo ? saldo[codigo] : 0))]));
        limitesMateriaPrima[familia] = suma(Object.values(asignacion[familia])) / consumoUnitario[familia];
      });
      const produccionSinRedondeo = Math.min(deseado, capacidadAsignada, ...Object.values(limitesMateriaPrima));
      const producido = excelRoundDown(produccionSinRedondeo, 0);
      const consumo = {}, consumoInsumos = {};
      FAMILIAS.forEach(familia => {
        consumo[familia] = precisionInventario(producido * consumoUnitario[familia]);
        consumoTotal[familia] += consumo[familia];
        let pendiente = consumo[familia];
        familias[familia].forEach(codigo => {
          const usado = Math.min(asignacion[familia][codigo], pendiente);
          consumoInsumos[codigo] = usado;
          consumoPorInsumo[codigo] += usado;
          saldo[codigo] = precisionInventario(Math.max(0, saldo[codigo] - usado));
          pendiente = precisionInventario(Math.max(0, pendiente - usado));
        });
      });
      return Object.assign({}, lote, { indice, cantidad: deseado, deseado, capacidadAsignada, requerimiento,
        consumoUnitario: Object.assign({}, consumoUnitario), asignacion, limitesMateriaPrima,
        produccionSinRedondeo, producido, consumo, consumoPorInsumo: consumoInsumos });
    });
    return Object.assign({}, capacidad, { totalPlaneado, lotes, requerimientoTotal, consumoTotal,
      totalProducido: suma(lotes.map(lote => lote.producido)), inventarioInicial, compras,
      disponibleInicial, consumoPorInsumo, inventarioFinal: saldo });
  }

  return Object.freeze({ calcularCapacidad, calcularProduccion, normalizarPersonal });
}));
