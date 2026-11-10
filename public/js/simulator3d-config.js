/* SIDE 3D — configuración compartida del mundo reformado. */
((root) => {
  const NPC_STATES = Object.freeze({
    SPAWN: 'SPAWN',
    WALK_TO_STORE: 'WALK_TO_STORE',
    ENTER_STORE: 'ENTER_STORE',
    BROWSE: 'BROWSE',
    COMPARE: 'COMPARE',
    SEEK_SALES_ASSISTANT: 'SEEK_SALES_ASSISTANT',
    WAIT_FOR_ASSISTANCE: 'WAIT_FOR_ASSISTANCE',
    TAKE_PRODUCT: 'TAKE_PRODUCT',
    WALK_TO_CHECKOUT: 'WALK_TO_CHECKOUT',
    QUEUE: 'QUEUE',
    PAY: 'PAY',
    LEAVE_STORE: 'LEAVE_STORE',
    WAIT_CROSSWALK: 'WAIT_CROSSWALK',
    CROSS_STREET: 'CROSS_STREET',
    DESPAWN: 'DESPAWN'
  });

  const WORLD = Object.freeze({
    bounds: Object.freeze({ minX: -30, maxX: 30, minZ: -12.6, maxZ: 33 }),
    store: Object.freeze({ minX: -13, maxX: 13, minZ: -1, maxZ: 8.8 }),
    production: Object.freeze({ minX: -13, maxX: 3.8, minZ: -12, maxZ: -1.2 }),
    warehouse: Object.freeze({ minX: 4.2, maxX: 13, minZ: -12, maxZ: -1.2 }),
    road: Object.freeze({ minX: -31, maxX: 31, minZ: 14, maxZ: 24 }),
    crosswalk: Object.freeze({ minX: -2.1, maxX: 2.1, minZ: 13.4, maxZ: 24.6 }),
    entry: Object.freeze({ x: 0, z: 8.9 }),
    storeDoor: Object.freeze({ x: 0, z: 8.55 }),
    productionDoor: Object.freeze({ x: -3.2, z: -1.05 }),
    warehouseDoor: Object.freeze({ x: 8.4, z: -1.05 }),
    internalDoor: Object.freeze({ x: 4, z: -6.2 }),
    newsPanel: Object.freeze({ x: 8.2, z: 27.2 }),
    checkout: Object.freeze({ x: -9.1, z: 5.9 }),
    checkoutQueue: Object.freeze([
      Object.freeze({ x: -6.4, z: 6.2 }),
      Object.freeze({ x: -4.9, z: 6.2 }),
      Object.freeze({ x: -3.4, z: 6.2 }),
      Object.freeze({ x: -1.9, z: 6.2 })
    ]),
    browsePoints: Object.freeze([
      Object.freeze({ x: -7.8, z: 2.9 }),
      Object.freeze({ x: -3.4, z: 3.3 }),
      Object.freeze({ x: 1.1, z: 2.9 }),
      Object.freeze({ x: 5.2, z: 3.4 }),
      Object.freeze({ x: 9.2, z: 2.9 })
    ]),
    customerSpawn: Object.freeze({ x: 0, z: 29.4 }),
    storeApproach: Object.freeze({ x: 0, z: 11.6 }),
    crosswalkNorth: Object.freeze({ x: 0, z: 24.8 }),
    crosswalkSouth: Object.freeze({ x: 0, z: 13.0 })
  });

  const PERFORMANCE = Object.freeze({
    low: Object.freeze({ pixelRatio: 0.72, maxCustomers: 5, maxCars: 2, farAnimationFps: 8 }),
    medium: Object.freeze({ pixelRatio: 1, maxCustomers: 8, maxCars: 3, farAnimationFps: 12 }),
    high: Object.freeze({ pixelRatio: 1.25, maxCustomers: 10, maxCars: 4, farAnimationFps: 18 }),
    auto: Object.freeze({ pixelRatio: 1.05, maxCustomers: 8, maxCars: 3, farAnimationFps: 12 })
  });

  const NPCS = Object.freeze({
    chico1: Object.freeze({name:'Gonzalo',model:'assets/models3d/npcs/chico1.glb',height:1.78}),
    chico2: Object.freeze({name:'Miguel',model:'assets/models3d/npcs/chico2.glb',height:1.73}),
    chico3: Object.freeze({name:'Joel',model:'assets/models3d/npcs/chico3.glb',height:1.76}),
    mona: Object.freeze({
      name: 'Valeria',
      model: 'assets/models3d/npcs/mona.glb',
      height: 1.68,
      rotationY: 0,
      position: Object.freeze({ x: -3, z: 10.7 })
    })
  });
  const config = Object.freeze({ NPC_STATES, WORLD, PERFORMANCE, NPCS, version: '2026.09.22.2' });
  root.SIDE3D_CONFIG = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
