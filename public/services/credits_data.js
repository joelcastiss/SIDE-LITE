(function exposeSideCredits(global) {
  'use strict';

  // Fuente única para la pantalla de créditos. Añadir futuras atribuciones como
  // objetos nuevos mantiene el contenido desacoplado del HTML y de Supabase.
  global.SIDE_CREDITS = Object.freeze([
    Object.freeze({
      id: 'shop-cash-register',
      title: 'Cash register',
      author: 'Poly by Google',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/crXBxFOkCIp',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['shop_cash_register.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-pallet-truck',
      title: 'Pallet Truck',
      author: 'KolosStudios',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/snDq7v3GRO',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_pallet_truck.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-fabric-rolls',
      title: 'Rolls of towels',
      author: 'Poly by Google',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/fvvbrnh-Gmr',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_fabric_rolls.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'warehouse-fire-extinguisher',
      title: 'Fire Extinguisher',
      author: 'dook',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/LtrzDvRya9',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['warehouse_fire_extinguisher.glb']),
      attributionRequired: true
    }),
    Object.freeze({
      id: 'shop-atm',
      title: 'ATM',
      author: 'J-Toastie',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/p4U0tSF5WN',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      assets: Object.freeze(['shop_atm.glb']),
      attributionRequired: true,
      modification: 'Escala, origen y materiales normalizados para SIDE.'
    }),
    Object.freeze({
      id: 'shop-furniture-kit',
      title: 'Furniture Kit 2.0',
      author: 'Kenney',
      source: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets/furniture-kit',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze([
        'shop_table_display.glb',
        'shop_checkout_counter.glb',
        'shop_checkout_counter_end.glb',
        'shop_shelf_tall.glb',
        'shop_shelf_low.glb',
        'shop_mirror_wall.glb',
        'shop_entry_door.glb',
        'shop_window_panel.glb',
        'shop_ceiling_light.glb',
        'production_garment_rack.glb'
      ]),
      attributionRequired: false
    }),
    Object.freeze({
      id: 'production-mannequin',
      title: 'Mannequin',
      author: 'reyshapes',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/tYwjQJvcFX',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze(['production_mannequin.glb']),
      attributionRequired: false,
      modification: 'Escala, origen y materiales normalizados para SIDE.'
    }),
    Object.freeze({
      id: 'outdoor-kenney-nature-kit',
      title: 'Nature Kit',
      author: 'Kenney',
      source: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets/nature-kit',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze([
        'outdoor_tree_default.glb',
        'outdoor_tree_oak.glb',
        'outdoor_tree_tall.glb',
        'outdoor_bush.glb'
      ]),
      attributionRequired: false
    }),
    Object.freeze({
      id: 'outdoor-kenney-city-roads',
      title: 'City Kit (Roads)',
      author: 'Kenney',
      source: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets/city-kit-roads',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze([
        'outdoor_traffic_light.glb',
        'outdoor_street_light.glb',
        'outdoor_stop_sign.glb'
      ]),
      attributionRequired: false
    }),
    Object.freeze({
      id: 'outdoor-kenney-furniture-kit',
      title: 'Furniture Kit',
      author: 'Kenney',
      source: 'Kenney',
      sourceUrl: 'https://kenney.nl/assets/furniture-kit',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze([
        'outdoor_bench.glb',
        'outdoor_planter.glb',
        'outdoor_trashcan.glb'
      ]),
      attributionRequired: false
    }),
    Object.freeze({
      id: 'outdoor-fountain',
      title: 'Fountain',
      author: 'Isa Lousberg',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/WHc7dwttlk',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze(['outdoor_fountain.glb']),
      attributionRequired: false,
      modification: 'Escala, origen y materiales normalizados para SIDE.'
    }),
    Object.freeze({
      id: 'outdoor-brown-bird',
      title: 'Brown Bird',
      author: 'AssetQuest',
      source: 'Poly Pizza',
      sourceUrl: 'https://poly.pizza/m/aDrUGRtDcm',
      license: 'CC0 1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      assets: Object.freeze(['outdoor_bird_brown.glb']),
      attributionRequired: false,
      modification: 'Escala, origen y materiales normalizados para SIDE.'
    })
  ]);
})(window);
