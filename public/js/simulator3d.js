/* SIDE 3D — simulador de tienda mejorado con ciudad, cola en caja y atención manual. */
(() => {
  const rootId = 'simulator3d';
  const CONFIG = window.SIDE3D_CONFIG || {};
  const WORLD = CONFIG.WORLD || {};
  const NPC_STATE = CONFIG.NPC_STATES || {};
  const PERF = CONFIG.PERFORMANCE || {};
  let THREE = null, GLTFLoader = null, SkeletonUtils = null;
  let assetCache = null, CharacterManager = null, ASSET_PRIORITY = null, CharacterAnimationController = null, createNpcMotionAdapter = null;
  let recastCore = null, recastGenerators = null, navMesh = null, navQuery = null, navReady = false;
  let renderer = null, scene = null, camera = null, clock = null, raf = 0;
  let initialized = false, running = false, locked = false;
  let initializationPromise = null, lastPrepareError = '';
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0, jumpQueued = false;
  let keys = {}, dynamicGroup = null, npcGroup = null, interactables = [], npcs = [], colliders = [], dynamicColliders = [];
  let animatedActors = [], checkoutQueue = [], queueDecor = [], trafficCars = [], crossingPedestrians = [], npcPool = [];
  let simSales = 0, simVisitors = 0, lastSpawn = -Infinity, lastAutoRestock = 0;
  let registerMesh = null, restockMesh = null, inventoryDisplayGroup = null;
  let productInteractables = [], productInspectOpen = false;
  let inventory = null, gameSession = null, sessionContext = '';
  let audioCtx = null, ambientTimer = null, storeMusicTimer = null, audioEnabled = true, nextAutoServeAt = 0, nextManagerBoostAt = 0;
  let vehicleAudio = null;
  let entryDoorLeft = null, entryDoorRight = null, entryDoorProgress = 0;
  let perfMode = 'auto', renderScale = 1.15, perfAccum = 0, perfFrames = 0, perfLastCheck = 0;
  let lastHudTick = 0, lastPromptTick = 0, lastLightTick = 0;
  let pausedFrameDrawn = false;
  let hemiLight = null, sunLight = null, checkoutOpen = false, checkoutScanned = false, checkoutPayment = 'cash';
  let adminMesh = null, newsPanelMesh = null, adminOpen = false, newsOpen = false, businessState = null, nextEventAt = 0, nextProductionAt = 0, supplierDeliveryAt = 0, tutorialIndex = 0, secondRegisterMesh = null;
  let trafficPhase = 0, trafficLight = 'vehicles', trafficSignalMeshes = [], visibilityPaused = false, debugPerformance = false, npcModelTemplate = null;
  const execModelTemplates = { male: null, female: null, casual: null };
  const characterTextures = new Map();
  let monaModule = null, monaTemplate = null, monaLoadError = '';
  let npcMotion = null, npcNavigation = null, npcNames = null, customerModelIndex = 0;
  let cityRosterModule = null, cityClipModule = null, cityRoster = null;
  let cityApproved = null, cityLoadPromise = null;
  let cityNavigator = null, cityNavPromise = null, cityNavStats = null;
  const cityTemplates = new Map();
  const suppliedTemplates = {}, suppliedErrors = {};
  let controlsOpenedFromHelp = false, missionCollapsed = false;
  let hubWorld = null, businessWorld = null, businessInteriors = null, hubActors = [], playerAvatar = null;
  let deriveWorldDecisionState = null, worldDecisionState = null, worldEventVisuals = null;
  let worldOrientation = null, worldMinimapControl = null, worldWayfinding = null;
  let closestCityZone = null, cityMap = null, selectedMapDestination = null;
  let lastWorldSnapshot = null;
  const GUIDE_NAME = 'Guía SIDE';
  let inHub = true, cameraMode = 'third', hubDirectoryOpen = false, selectedDistrict = 'miraflores';
  let currentInterior = null, hubReturnPoint = null, cameraSnap = true;
  let createNpcPatrol = null, footstepDistance = 0, footstepBuffer = null;
  let hubVehicles = null, driving = null;
  let playerMotion = null, playerMode = 'PLAYER_ON_FOOT', vehicleTransition = null;
  let cameraZoom = 5.2, lastCameraInputAt = 0;
  let basePreloadPromise = null, preloadPromise = null, loadingPhase = 'Esperando precarga', loadingLoaded = 0, loadingTotal = 6;
  let studioEnvironment = null, detailsPromise = null, detailsTimer = 0, detailsComplete = false;
  let storePropsPromise = null, warehousePropsPromise = null, productionPropsPromise = null, outdoorPropsPromise = null;
  const storePropTemplates = {}, storePropErrors = {}, warehousePropTemplates = {}, warehousePropErrors = {};
  const productionPropTemplates = {}, productionPropErrors = {}, outdoorPropTemplates = {}, outdoorPropErrors = {};
  const STORE_PROP_ASSETS = Object.freeze([
    ['table', 'shop_table_display'], ['counter', 'shop_checkout_counter'], ['counterEnd', 'shop_checkout_counter_end'],
    ['shelfTall', 'shop_shelf_tall'], ['shelfLow', 'shop_shelf_low'], ['mirror', 'shop_mirror_wall'], ['register', 'shop_cash_register'],
    ['entryDoor', 'shop_entry_door'], ['windowPanel', 'shop_window_panel'], ['ceilingLight', 'shop_ceiling_light'], ['atm', 'shop_atm']
  ]);
  const WAREHOUSE_PROP_ASSETS = Object.freeze([
    ['boxLarge','warehouse_box_large'],['boxLong','warehouse_box_long'],['boxSmall','warehouse_box_small'],['boxWide','warehouse_box_wide'],
    ['loadingDoor','warehouse_loading_door'],['highWindow','warehouse_high_window'],['floorArrow','warehouse_floor_arrow'],['warningBeacon','warehouse_warning_beacon'],
    ['pallet','warehouse_pallet'],['rackTall','warehouse_rack_tall'],['bagStack','warehouse_bag_stack'],['cuttingTable','warehouse_cutting_table'],
    ['pendantLight','warehouse_pendant_light'],['palletTruck','warehouse_pallet_truck'],['fabricRolls','warehouse_fabric_rolls'],
    ['fireExtinguisher','warehouse_fire_extinguisher'],['sewingMachine','warehouse_sewing_machine']
  ]);
  const PRODUCTION_PROP_ASSETS = Object.freeze([
    ['cuttingTable','warehouse_cutting_table'],['sewingMachine','warehouse_sewing_machine'],
    ['overlockMachine','production_overlock_machine'],['ironingStation','production_ironing_station'],
    ['fabricRolls','warehouse_fabric_rolls'],['rackTall','warehouse_rack_tall'],['pendantLight','warehouse_pendant_light'],
    ['mannequin','production_mannequin'],['garmentRack','production_garment_rack']
  ]);
  const OUTDOOR_PROP_ASSETS = Object.freeze([
    ['treeDefault','outdoor_tree_default'],['treeOak','outdoor_tree_oak'],['treeTall','outdoor_tree_tall'],['bush','outdoor_bush'],
    ['bench','outdoor_bench'],['fountain','outdoor_fountain'],['trafficLight','outdoor_traffic_light'],['streetLight','outdoor_street_light'],
    ['planter','outdoor_planter'],['trashcan','outdoor_trashcan'],['stopSign','outdoor_stop_sign'],['birdBrown','outdoor_bird_brown']
  ]);
  let characterManager = null, selectedCharacterId = 'chico2';
  let characterGeometry = null;
  const HUB_OFFSET = 150;
  const DISTRICTS = {miraflores:'Miraflores',olivos:'Los Olivos',sjl:'San Juan de Lurigancho'};
  const hubBounds = {minX:HUB_OFFSET-88,maxX:HUB_OFFSET+88,minZ:-88,maxZ:88};

  const PRODUCTS = [
    { id: 'esencial', name: 'Bolso Básico', price: 75, color: 0xc46b59, accent: '#ff9b89' },
    { id: 'urbano', name: 'Bolso Mejorado', price: 95, color: 0x6a8ec9, accent: '#84bdff' },
    { id: 'premium', name: 'Bolso Premium', price: 125, color: 0xd7b653, accent: '#ffe07c' }
  ];


  const CUSTOMER_ARCHETYPES = [
    { id: 'express', label: 'Express', patience: 10, speed: 1.15, pref: 'esencial', budget: 90, priceSensitivity: .92, qualityDemand: .35, helpProbability: .12 },
    { id: 'urbano', label: 'Urbano', patience: 15, speed: 1.0, pref: 'urbano', budget: 135, priceSensitivity: .58, qualityDemand: .62, helpProbability: .36 },
    { id: 'premium', label: 'Premium', patience: 20, speed: .92, pref: 'premium', budget: 240, priceSensitivity: .22, qualityDemand: .94, helpProbability: .64 },
    { id: 'turista', label: 'Turista', patience: 17, speed: .96, pref: 'premium', budget: 180, priceSensitivity: .42, qualityDemand: .78, helpProbability: .48 }
  ];

  // Los asesores conservan sus puestos; el aspecto se obtiene de modelos con
  // piel, ropa, cabello y esqueleto independientes del controlador de navegación.
  const STAFF_LOOKS = [
    { gender: 'male', execModel: 'male', shirt: 0x2c4a72, pants: 0x24344a, tie: 0x3f78c9, hair: 0x14100d, skin: 0xe0b48c, formal: true, glasses: true, forceProcedural: true, bodyScale: 1.0 },
    { gender: 'female', execModel: 'female', shirt: 0xf2ede2, pants: 0xc9a877, hair: 0x2a2019, skin: 0xcd8f66, formal: false, longHair: true, buttons: true, forceProcedural: true, bodyScale: 0.96 }
  ];

  const player = { x: HUB_OFFSET+16, y: 1.72, z: 27, radius: 0.36, baseY: 1.72, vx: 0, vz: 0, vy: 0, grounded: true, bob: 0, speed: 0 };
  const bounds = WORLD.bounds || { minX: -30, maxX: 30, minZ: -12.6, maxZ: 33 };
  const queueSlots = [];

  const $3 = (id) => document.getElementById(id);
  const fmt = (n) => '★ ' + Math.round(Number(n) || 0).toLocaleString('es-PE');
  const worldSnapshot = () => window.SIDE_WORLD_BRIDGE?.getWorldSnapshot() || {company:{name:'MI EMPRESA',character:'chico2'},cycle:1,products:[],approximateStock:24,storeLevel:{stores:1,visual:{}},events:[]};
  const CHARACTER_IDS = ['chico1','chico2','chico3','mona'];
  const validCharacterId = id => CHARACTER_IDS.includes(id);
  const activeCharacterId = () => {
    const requested=worldSnapshot().company.character;
    if(validCharacterId(requested))selectedCharacterId=requested;
    return selectedCharacterId;
  };
  const companyName = () => String(worldSnapshot().company.name || 'MI EMPRESA').trim() || 'MI EMPRESA';
  const saved = (id) => worldSnapshot().storeLevel.visual?.[id] || null;
  const sum = (o = {}) => Object.values(o).reduce((a, b) => a + (Number(b) || 0), 0);
  const allPurchases = (entry) => { let t = 0; Object.values(entry?.purchases || {}).forEach(row => t += sum(row || {})); return t; };
  const optSelected = (id, opt) => Boolean(saved(id)?.optionIds?.includes(opt));
  const qty = (id) => sum(saved(id)?.quantities || {});
  const owned = (id) => allPurchases(saved(id));
  const currentRoundSafe = () => worldSnapshot().cycle || 1;
  const initialFunPoints = () => 100000;
  // Entertainment receipts are stored only in the world's own local state.
  const salesLedger = () => Number(businessState?.revenue || 0);

  function companyStorageContext() {
    const code = String(worldSnapshot().company.gameCode || 'SIDE').replace(/\s+/g, '_');
    const company = companyName().replace(/[^a-z0-9_-]+/gi, '_').slice(0, 36) || 'EMPRESA';
    return `${code}_${company}`;
  }
  function storageContext() { return `${companyStorageContext()}_${currentRoundSafe()}`; }

  function salesCountKey() { return `side3d_fun_sales_count_${storageContext()}`; }
  function inventoryKey() { return `side3d_fun_inventory_${storageContext()}`; }
  function dayKey() { return `side3d_fun_day_${storageContext()}`; }
  function audioKey() { return `side3d_fun_audio_${storageContext()}`; }
  function businessKey() { return `side3d_fun_business_${storageContext()}`; }
  function controlsSeenKey() { return `side3d_fun_controls_seen_v2_${companyStorageContext()}`; }

  function createBusinessState() {
    return {
      reputation: 80,
      expenses: 0,
      returns: 0,
      supplierDelay: false,
      rushBoostUntil: 0,
      prices: { esencial: 75, urbano: 95, premium: 125 },
      upgrades: { display: 0, checkout: 0, warehouse: 0 },
      production: { producedToday: 0, stage: 0 },
      logs: ['Empresa preparada para operar.'],
      lostReasons: { queue: 0, stock: 0, price: 0, staff: 0 },
      tutorialDone: false,
      defects: 0,
      graphics: 'auto'
    };
  }

  function saveBusinessState() {
    if (!businessState) return;
    localStorage.setItem(businessKey(), JSON.stringify(businessState));
  }

  function loadBusinessState() {
    try { businessState = JSON.parse(localStorage.getItem(businessKey()) || 'null'); } catch { businessState = null; }
    if (!businessState) businessState = createBusinessState();
    businessState.prices ||= { esencial: 75, urbano: 95, premium: 125 };
    businessState.upgrades ||= { display: 0, checkout: 0, warehouse: 0 };
    businessState.production ||= { producedToday: 0, stage: 0 };
    businessState.logs ||= [];
    businessState.lostReasons ||= { queue: 0, stock: 0, price: 0, staff: 0 };
    PRODUCTS.forEach(p => { p.price = Math.max(1, Number(businessState.prices[p.id] || p.price)); });
    perfMode = businessState.graphics || 'auto';
    renderScale = (PERF[perfMode]?.pixelRatio || {low:.72,medium:1.0,high:1.25,auto:1.05}[perfMode] || 1.05);
    saveBusinessState();
    return businessState;
  }

  function addBusinessLog(text) {
    if (!businessState) loadBusinessState();
    businessState.logs.unshift(`${new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})} · ${text}`);
    businessState.logs = businessState.logs.slice(0, 12);
    saveBusinessState();
    refreshAdminUI();
  }

  function operationalCash() {
    return initialFunPoints() + salesLedger() - Number(businessState?.expenses || 0);
  }

  function applyExpense(amount, reason, kind='SIM_GASTOS',businessPatch={}) {
    if (!businessState) loadBusinessState();

    const a = Math.max(0, Number(amount) || 0);
    const next={...businessState,...businessPatch,expenses:Number(businessState.expenses||0)+a};
    businessState=next;
    saveBusinessState();
    showCashFx(`− ${fmt(a)}`);
    addBusinessLog(`${reason}: −${fmt(a)}`);
    updateHUD();
    return true;
  }

  function updateReputation(delta, reason='') {
    if (!businessState) loadBusinessState();
    businessState.reputation = Math.max(0, Math.min(100, Number(businessState.reputation || 80) + delta));
    if (reason) addBusinessLog(`${reason} · reputación ${delta >= 0 ? '+' : ''}${delta}`);
    saveBusinessState();
    refreshAdminUI();
  }

  function syncSalesFromLedger() {
    const stored = Number(localStorage.getItem(salesCountKey()) || 0);
    simSales = Math.max(0, stored);
    updateHUD();
  }

  function saveInventory() {
    if (!inventory) return;
    localStorage.setItem(inventoryKey(), JSON.stringify(inventory));
  }

  function targetProduction() { return Math.max(24, Number(worldSnapshot().approximateStock)||24); }
  function productionSnapshot() {
    const snapshot=worldSnapshot();
    return {producibleUnits:Math.max(24,Number(snapshot.approximateStock)||24),productLines:snapshot.products?.length?snapshot.products.map(p=>({plannedUnits:Math.max(0,Number(p.approximateStock)||0)})):null};
  }

  function createInitialInventory() {
    const plan=productionSnapshot();
    const planned=Array.isArray(plan?.productLines)?plan.productLines.map(line=>Math.max(0,Math.round(Number(line.plannedUnits||0)))):[];
    const totalFromPlan=planned.reduce((amount,value)=>amount+value,0);
    const explicitPlan=Array.isArray(plan?.productLines)&&totalFromPlan>0;
    const total=Math.max(24,explicitPlan?totalFromPlan:Number(plan?.producibleUnits)||24);
    const split=explicitPlan?PRODUCTS.map((_,i)=>planned[i]||0):[Math.ceil(total*.4),Math.ceil(total*.35),0];
    if(!explicitPlan)split[2]=Math.max(0,total-split[0]-split[1]);
    const display = {}, reserve = {};
    PRODUCTS.forEach((product, i) => {
      const show = Math.min(4, split[i]);
      display[product.id] = show;
      reserve[product.id] = Math.max(0, split[i] - show);
    });
    return { schemaVersion:2,totalTarget: total,producedUnits:total, display, reserve, sold: { esencial: 0, urbano: 0, premium: 0 } };
  }

  function loadInventory() {
    try { inventory = JSON.parse(localStorage.getItem(inventoryKey()) || 'null'); } catch { inventory = null; }
    if (!inventory || inventory.schemaVersion!==2 || !inventory.display || !inventory.reserve) inventory = createInitialInventory();
    const planned=productionSnapshot()?.producibleUnits;
    const desired = Math.max(0,Number.isFinite(Number(planned))?Number(planned):(targetProduction()||inventory.totalTarget||24));
    // Supplier stock and customer reservations do not change recorded production.
    // Legacy saves without an output record stay unknown; their saved target is
    // only an allocation baseline, never reported as realized productivity.
    const hasOutput=inventory.producedUnits!=null&&Number.isFinite(Number(inventory.producedUnits));
    const currentUnits=hasOutput?Number(inventory.producedUnits):Math.max(0,Number(inventory.totalTarget??desired));
    if (desired > currentUnits) {
      let extra = desired - currentUnits;
      let i = 0;
      while (extra-- > 0) { const product = PRODUCTS[i++ % PRODUCTS.length]; inventory.reserve[product.id] = Number(inventory.reserve[product.id] || 0) + 1; }
      if(hasOutput)inventory.producedUnits=desired;
    }
    inventory.totalTarget = Math.max(inventory.totalTarget || 0, desired);
    inventory.sold = inventory.sold || { esencial: 0, urbano: 0, premium: 0 };
    saveInventory();
    return inventory;
  }

  function productById(id) { return PRODUCTS.find(p => p.id === id) || PRODUCTS[0]; }
  function displayStock(id) { return Number(inventory?.display?.[id] || 0); }
  function reserveStock(id) { return Number(inventory?.reserve?.[id] || 0); }
  function totalDisplayStock() { return PRODUCTS.reduce((n,p)=>n+displayStock(p.id),0); }
  function totalReserveStock() { return PRODUCTS.reduce((n,p)=>n+reserveStock(p.id),0); }

  function loadDay() { return Math.max(1, Number(localStorage.getItem(dayKey()) || 1)); }
  function saveDay(day) { localStorage.setItem(dayKey(), String(Math.max(1, day))); }
  function loadAudioSetting() {
    const raw = localStorage.getItem(audioKey());
    audioEnabled = raw !== '0';
    const btn = $3('sim3dAudioBtn');
    if (btn) btn.textContent = audioEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
  }

  function ensureAudio() {
    if (!audioEnabled) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume?.();
    return audioCtx;
  }

  function playTone(freq = 440, duration = 0.12, type = 'sine', volume = 0.03, when = 0) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.03);
  }

  function playSfx(kind) {
    if (!audioEnabled) return;
    if (kind === 'sale') { playTone(660, 0.08, 'triangle', 0.035, 0); playTone(880, 0.12, 'triangle', 0.03, 0.06); }
    else if (kind === 'restock') { playTone(420, 0.08, 'square', 0.025, 0); playTone(520, 0.08, 'square', 0.02, 0.07); }
    else if (kind === 'lost') { playTone(260, 0.18, 'sawtooth', 0.024, 0); }
    else if (kind === 'start') { playTone(392, 0.08, 'triangle', 0.03, 0); playTone(523, 0.12, 'triangle', 0.03, 0.07); playTone(659, 0.16, 'triangle', 0.025, 0.14); }
    else if (kind === 'endWin') { playTone(523, 0.1, 'triangle', 0.03, 0); playTone(659, 0.12, 'triangle', 0.03, 0.08); playTone(784, 0.18, 'triangle', 0.03, 0.16); }
    else if (kind === 'endLose') { playTone(392, 0.14, 'sine', 0.024, 0); playTone(294, 0.18, 'sine', 0.024, 0.12); }
  }

  function startAmbient() {
    if (ambientTimer) clearInterval(ambientTimer);
    if (storeMusicTimer) clearInterval(storeMusicTimer);
    if (!audioEnabled) return;
    ensureAudio();
    ambientTimer = setInterval(() => {
      if (!running || !audioEnabled || document.hidden || $3(rootId)?.classList.contains('hidden') || !gameSession || gameSession.shiftEnded) return;
      playTone(196, 1.6, 'sine', 0.005, 0);
      playTone(246, 1.4, 'triangle', 0.0035, 0.18);
    }, 3200);
    playStoreMusicLoop();
    storeMusicTimer = setInterval(() => {
      if (!running || !audioEnabled || document.hidden || $3(rootId)?.classList.contains('hidden') || !gameSession || gameSession.shiftEnded) return;
      playStoreMusicLoop();
    }, 4200);
  }

  function stopAmbient() {
    stopVehicleAudio();
    if (ambientTimer) clearInterval(ambientTimer);
    ambientTimer = null;
    if (storeMusicTimer) clearInterval(storeMusicTimer);
    storeMusicTimer = null;
  }

  function stopVehicleAudio() {
    if (!vehicleAudio) return;
    vehicleAudio.osc.stop();
    vehicleAudio.osc.disconnect();
    vehicleAudio.filter.disconnect();
    vehicleAudio.gain.disconnect();
    vehicleAudio = null;
  }

  function updateVehicleAudio() {
    if (!driving || !running || !audioEnabled || visibilityPaused || document.hidden) {
      stopVehicleAudio();
      return;
    }
    const ctx = ensureAudio();
    if (!ctx || ctx.state !== 'running') return;
    if (!vehicleAudio) {
      const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      osc.type = 'sawtooth'; filter.type = 'lowpass'; filter.frequency.value = 260;
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(ctx.destination); osc.start();
      vehicleAudio = {osc, filter, gain};
    }
    const speed = Math.min(1, Math.abs(driving.speed) / 19);
    // Synthetic, quiet engine; one persistent voice, no allocation per frame.
    vehicleAudio.osc.frequency.setTargetAtTime(38 + speed * 105, ctx.currentTime, .12);
    vehicleAudio.filter.frequency.setTargetAtTime(180 + speed * 480, ctx.currentTime, .15);
    vehicleAudio.gain.gain.setTargetAtTime(.012 + speed * .014, ctx.currentTime, .08);
  }

  function playStoreMusicLoop() {
    if (!audioEnabled) return;
    const seq = [
      [392, 0], [494, 0.22], [587, 0.44], [494, 0.66],
      [440, 0.95], [523, 1.17], [659, 1.39], [523, 1.61]
    ];
    seq.forEach(([f, t], i) => {
      playTone(f, 0.18, 'triangle', 0.012, t);
      if (i % 2 === 0) playTone(f / 2, 0.24, 'sine', 0.006, t);
    });
  }

  function randomArchetype() {
    const roll = Math.random();
    if (roll < 0.28) return CUSTOMER_ARCHETYPES[0];
    if (roll < 0.58) return CUSTOMER_ARCHETYPES[1];
    if (roll < 0.82) return CUSTOMER_ARCHETYPES[2];
    return CUSTOMER_ARCHETYPES[3];
  }

  function customerStyle(archetype) {
    const casual = [0x20242a,0x394d69,0x6a4f78,0x5b765f,0xa26059,0xc38b5c,0xd7d7d2];
    const premium = [0x1d2736,0x283047,0x473c50,0x846d5c];
    const palette = archetype?.id === 'premium' ? premium : casual;
    return {
      cityRole:'cliente',cityScene:'store',
      gender: Math.random() < 0.5 ? 'female' : 'male',
      shirt: palette[Math.floor(Math.random()*palette.length)],
      pants: [0x202a36,0x2c3440,0x40506b,0x61574d][Math.floor(Math.random()*4)],
      skin: [0xe1b88d,0xcd946d,0xa96f4d,0x7e5139][Math.floor(Math.random()*4)],
      hair: [0x1c1a1a,0x51392c,0x8b633f,0xb08a62][Math.floor(Math.random()*4)],
      formal: archetype?.id === 'premium' && Math.random() < 0.45,
      tie: 0x315f9c,
      bodyScale: 0.92 + Math.random()*0.16
    };
  }

  function customerPatienceBoost() {
    let boost = 0;
    if (optSelected('JEFATURA', 'si_jefatura')) boost += 2;
    if (saved('INV_RRHH')?.label) boost += 1;
    return boost;
  }

  function hasManager() { return optSelected('JEFATURA', 'si_jefatura'); }
  function hasAnalyst() { return optSelected('ANALISTA_COMPRAS', 'si_analista'); }


  function createDailyMissions(day = 1) {
    const premiumGoal = Math.max(1, Math.min(4, Math.ceil(day / 2)));
    const serveGoal = Math.max(4, 4 + day * 2);
    const satisfactionGoal = Math.max(72, 88 - Math.min(12, (day - 1) * 2));
    return [
      { id: 'serve', label: `Atiende ${serveGoal} clientes`, target: serveGoal },
      { id: 'premium', label: `Vende ${premiumGoal} Premium`, target: premiumGoal },
      { id: 'satisfaction', label: `Mantén ${satisfactionGoal}% de satisfacción`, target: satisfactionGoal }
    ];
  }

  function missionValue(mission) {
    if (!gameSession) return 0;
    if (mission.id === 'serve') return gameSession.served;
    if (mission.id === 'premium') return Math.max(0, Number(inventory?.sold?.premium || 0) - Number(gameSession.startPremiumSold || 0));
    if (mission.id === 'satisfaction') return Math.round(gameSession.satisfaction);
    return 0;
  }

  function missionComplete(mission) {
    const value = missionValue(mission);
    return value >= mission.target;
  }

  function updateMissionUI() {
    const list = $3('simMissionList');
    if (!list || !gameSession) return;
    const done = gameSession.missions.filter(missionComplete).length;
    if ($3('simMissionHeadline')) $3('simMissionHeadline').textContent = `DÍA ${gameSession.day} · ${done}/${gameSession.missions.length}`;
    list.innerHTML = gameSession.missions.map(m => {
      const value = missionValue(m);
      const complete = missionComplete(m);
      const progress = m.id === 'satisfaction' ? `${value}% / ${m.target}%` : `${Math.min(value,m.target)} / ${m.target}`;
      return `<div class="${complete ? 'done' : ''}"><span>${complete ? '✓' : '•'}</span><p><b>${m.label}</b><small>${progress}</small></p></div>`;
    }).join('');
  }

  function makeLocalLabel(text, color = '#ffd329', scale = 1) {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 150;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(4,10,18,.88)';
    ctx.fillRect(6, 8, 628, 132);
    ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeRect(8, 10, 624, 128);
    ctx.fillStyle = '#fff'; ctx.font = '700 42px Montserrat,Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 34), 320, 74);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent:true, depthWrite:false}));
    sp.position.set(0, 2.15, 0); sp.scale.set(2.7*scale, .64*scale, 1);
    return sp;
  }

  function showReceipt(npc) {
    const box = $3('sim3dReceipt');
    if (!box || !npc) return;
    const product = productById(npc.productId);
    const ticketNo = String((gameSession?.served || 0) + 1).padStart(4,'0');
    $3('receiptTicket').textContent = npc.isReturn ? `DEVOLUCIÓN #${ticketNo}` : `TICKET #${ticketNo}`;
    $3('receiptCustomer').textContent = npc.archetype?.label || 'Cliente';
    $3('receiptProduct').textContent = product.name;
    $3('receiptPrice').textContent = `${npc.isReturn ? '− ' : ''}${fmt(npc.productPrice)}`;
    $3('receiptDay').textContent = `Día ${gameSession?.day || 1}`;
    box.classList.add('show');
    clearTimeout(showReceipt.t);
    showReceipt.t = setTimeout(()=>box.classList.remove('show'), 2600);
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    const m = Math.floor(safe / 60);
    const s = String(safe % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function resetGameSession(resetInventory = false, advanceDay = false) {
    clearCustomerFlow(!resetInventory&&sessionContext===storageContext());
    sessionContext = storageContext();
    loadBusinessState();
    let day = loadDay();
    if (advanceDay) day += 1;
    saveDay(day);
    if (resetInventory) {
      inventory = createInitialInventory();
      saveInventory();
      simSales = 0;
      localStorage.setItem(salesCountKey(), '0');
    }
    const channelCount = saved('CANALES')?.optionIds?.length || 1;
    const demandBase = Math.max(6, Math.round((targetProduction() || 24) / 4));
    const duration = Math.max(210, Math.round(300 - Math.min(80, (day - 1) * 8)));
    const difficulty = 1 + (day - 1) * 0.18;
    gameSession = {
      day,
      difficulty,
      duration,
      timeLeft: duration,
      targetRevenue: Math.max(500, Math.round(demandBase * (70 + channelCount * 10) * (1 + (day - 1) * 0.22))),
      revenue: 0,
      served: 0,
      lost: 0,
      lostReasons: { queue: 0, stock: 0, price: 0, staff: 0 },
      satisfaction: Math.max(76, 100 - (day - 1) * 2),
      shiftEnded: false,
      shiftStarted: true,
      combo: 0,
      bestCombo: 0,
      startPremiumSold: Number(inventory?.sold?.premium || 0),
      missions: createDailyMissions(day),
      shownTeacherEvents: []
    };
    simVisitors = 0;
    // Recreational resources persist with orders and upgrades across reloads.
    businessState.expenses = Math.max(0, Number(businessState.expenses) || 0);
    businessState.production.producedToday = 0;
    businessState.production.stage = 0;
    businessState.supplierDelay = false;
    businessState.lostReasons = { queue: 0, stock: 0, price: 0, staff: 0 };
    saveBusinessState();
    gameSession.satisfaction = Math.max(55, Math.min(100, gameSession.satisfaction + (businessState.reputation - 80) * 0.12));
    nextAutoServeAt = 0;
    nextManagerBoostAt = 12;
    nextEventAt = performance.now() + 25000 + Math.random() * 18000;
    nextProductionAt = performance.now() + 7000;
    supplierDeliveryAt = 0;
    hideSummaryOverlay();
    loadAudioSetting();
    updateHUD();
    updateMissionUI();
  }

  function adjustSatisfaction(delta) {
    if (!gameSession) return;
    gameSession.satisfaction = Math.max(0, Math.min(100, gameSession.satisfaction + delta));
    updateHUD();
  }

  function markLostCustomer(reason = '') {
    if (!gameSession) return;
    const key = ['queue','stock','price','staff'].includes(reason) ? reason : 'stock';
    gameSession.lost += 1;
    gameSession.lostReasons[key] = Number(gameSession.lostReasons[key] || 0) + 1;
    businessState.lostReasons[key] = Number(businessState.lostReasons[key] || 0) + 1;
    gameSession.combo = 0;
    adjustSatisfaction(reason === 'queue' ? -5 : -3);
    playSfx('lost');
    updateReputation(reason === 'queue' ? -1.2 : -0.8);
  }

  function showCashFx(text) {
    const fx = document.getElementById('simFunFx');
    if (!fx) return;
    const span = fx.querySelector('span');
    if (span) span.textContent = text;
    fx.classList.add('show');
    clearTimeout(showCashFx.t);
    showCashFx.t = setTimeout(() => fx.classList.remove('show'), 1100);
  }

  function hideSummaryOverlay() {
    $3('sim3dSummary')?.classList.add('hidden');
  }

  function clearSessionOverlays() {
    checkoutOpen = checkoutScanned = productInspectOpen = adminOpen = newsOpen = false;
    hubDirectoryOpen = false;
    controlsOpenedFromHelp = false;
    keys = {};
    jumpQueued = false;
    clearTimeout(showEvent.t);
    ['simCheckout', 'simProductInspect', 'simAdmin', 'simNewsPanel', 'sim3dSummary',
      'sim3dStart', 'simTutorial3d', 'simEventToast', 'simHubDirectory'].forEach(id => $3(id)?.classList.add('hidden'));
  }

  function syncSessionContext() {
    if (!sessionContext) return;
    const changed = sessionContext !== storageContext();
    if (!changed) return;
    if (lastWorldSnapshot) cacheWorldHistory(lastWorldSnapshot);
    // A new economic cycle refreshes the scenery and its separate local shift.
    // It never sends the player back to the economic decision workflow.
    clearCustomerFlow(false);
    loadBusinessState();loadInventory();resetGameSession(false);
    rebuildDynamicWorld();renderNewsPanel();updateHUD();
  }

  function showSummaryOverlay() {
    const wrap = $3('sim3dSummary');
    if (!wrap || !gameSession) return;
    const met = gameSession.revenue >= gameSession.targetRevenue;
    const stars = Math.max(1, Math.min(5, Math.round((gameSession.satisfaction / 20) + (met ? 0.6 : 0) + (gameSession.served > gameSession.lost ? 0.4 : 0))));
    const textStars = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    const missionDone = gameSession.missions?.filter(missionComplete).length || 0;
    $3('summaryTitle').textContent = met ? `¡Día ${gameSession.day} completado!` : `Fin del Día ${gameSession.day}`;
    $3('summarySubtitle').textContent = met ? `Meta alcanzada · Misiones ${missionDone}/${gameSession.missions.length}. Desbloqueaste el siguiente día.` : `Misiones ${missionDone}/${gameSession.missions.length}. Revisa resultados y vuelve a intentarlo.`;
    $3('summaryStars').textContent = textStars;
    $3('summaryRevenue').textContent = `${fmt(gameSession.revenue)} / ${fmt(gameSession.targetRevenue)}`;
    $3('summaryServed').textContent = String(gameSession.served);
    $3('summaryLost').textContent = String(gameSession.lost);
    $3('summarySatisfaction').textContent = `${Math.round(gameSession.satisfaction)}%`;
    if($3('summaryProfit')) $3('summaryProfit').textContent=fmt(gameSession.revenue-Number(businessState?.expenses||0));
    if($3('summaryReputation')) $3('summaryReputation').textContent=`${Math.round(businessState?.reputation||80)}%`;
    if($3('summaryReturns')) $3('summaryReturns').textContent=String(businessState?.returns||0);
    const consequences=$3('summaryConsequences');
    if(consequences){
      consequences.replaceChildren();
      for(const item of worldDecisionState?.consequences||[]){
        const row=document.createElement('li');row.textContent=item.text;consequences.append(row);
      }
      consequences.hidden=!consequences.childElementCount;
    }
    const replay = $3('sim3dReplayBtn'); if (replay) replay.textContent = met ? 'JUGAR SIGUIENTE DÍA' : 'REINTENTAR DÍA';
    wrap.classList.remove('hidden');
  }

  function endShift() {
    if (!gameSession || gameSession.shiftEnded) return;
    gameSession.shiftEnded = true;
    running = false;
    document.exitPointerLock?.();
    stopAmbient();
    const success=gameSession.revenue >= gameSession.targetRevenue;
    updateReputation(success ? 3 : -2, success ? 'Jornada exitosa' : 'Meta no alcanzada');
    addBusinessLog(`Cierre Día ${gameSession.day}: puntos ${fmt(gameSession.revenue)}, balance recreativo ${fmt(gameSession.revenue-businessState.expenses)}.`);
    syncWorldDecisions();
    if(lastWorldSnapshot)cacheWorldHistory(lastWorldSnapshot);
    showSummaryOverlay();
    playSfx(success ? 'endWin' : 'endLose');
    message(gameSession.revenue >= gameSession.targetRevenue ? 'Se cerró la tienda: alcanzaste la meta del día.' : 'Se cerró la tienda: no llegaste a la meta.');
  }

  function message(text, duration = 2800) {
    const el = $3('sim3dMessage');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(message.t);
    message.t = setTimeout(() => el.classList.remove('show'), duration);
  }

  function updateHUD() {
    if (!$3('simCash')) return;
    $3('simCash').textContent = fmt(operationalCash());
    $3('simRound').textContent = gameSession ? `C${currentRoundSafe()} · Día ${gameSession.day}` : ('Ciclo ' + currentRoundSafe());
    $3('simVisitors').textContent = String(simVisitors);
    $3('simSales').textContent = String(gameSession?.served || 0);
    PRODUCTS.forEach(p => {
      const stockEl = $3(`stock-${p.id}`);
      const reserveEl = $3(`reserve-${p.id}`);
      const priceEl = $3(`price-${p.id}`);
      if (stockEl) stockEl.textContent = String(displayStock(p.id));
      if (reserveEl) reserveEl.textContent = String(reserveStock(p.id));
      if (priceEl) priceEl.textContent = fmt(p.price);
    });
    const totalStockEl = $3('simTotalStock');
    if (totalStockEl) totalStockEl.textContent = String(totalDisplayStock() + totalReserveStock());
    if ($3('simTime')) $3('simTime').textContent = gameSession ? formatTime(gameSession.timeLeft) : '5:00';
    if ($3('simRating')) $3('simRating').textContent = gameSession ? `${Math.round(gameSession.satisfaction)}%` : `${Math.round(businessState?.reputation || 80)}%`;
    if ($3('simRevenue')) $3('simRevenue').textContent = gameSession ? fmt(gameSession.revenue) : fmt(0);
    const productivity={produced:inventory?.producedUnits,compliance:100*Math.min(1,Number(inventory?.producedUnits||0)/Math.max(1,targetProduction()))};
    if($3('simProducedUnits'))$3('simProducedUnits').textContent=productivity?.produced==null?'Sin registro':`${productivity.produced} u.`;
    if($3('simProductionCompliance'))$3('simProductionCompliance').textContent=productivity?.compliance==null?'—':`${Math.round(productivity.compliance)}%`;
    if ($3('simNetProfit')) $3('simNetProfit').textContent = fmt(Number(gameSession?.revenue || 0) - Number(businessState?.expenses || 0));
    if ($3('simOperatingLosses')) $3('simOperatingLosses').textContent = fmt(Number(businessState?.expenses || 0));
    if ($3('simLostCustomers')) $3('simLostCustomers').textContent = String(gameSession?.lost || 0);
    const lost = gameSession?.lostReasons || businessState?.lostReasons || {};
    ['queue','stock','price','staff'].forEach(reason => { const el=$3(`lost-${reason}`); if(el) el.textContent=String(Number(lost[reason]||0)); });
    const target = targetProduction();
    const channels = saved('CANALES')?.optionIds?.length || 0;
    const physicalStores = Math.max(1,Number(worldSnapshot().storeLevel.stores)||1);
    const queueText = checkoutQueue.length ? ` · Cola: ${checkoutQueue.length}` : '';
    const stockText = inventory ? ` · Stock: ${totalDisplayStock()} tienda / ${totalReserveStock()} almacén` : '';
    const shiftText = gameSession ? ` · Tiempo restante: ${formatTime(gameSession.timeLeft)} · Satisfacción: ${Math.round(gameSession.satisfaction)}% · Combo: x${Math.max(1, gameSession.combo || 0)}` : '';
    $3('simObjectiveText').textContent = gameSession
      ? `Día ${gameSession.day} · Dificultad ${(gameSession.difficulty || 1).toFixed(1)} · Meta de puntos: ${fmt(gameSession.targetRevenue)} · Puntos de tienda: ${fmt(gameSession.revenue)}${queueText}${stockText}${shiftText}.`
      : (target
        ? `Meta: ${target} unidades · ${channels} canal(es) · ${physicalStores} tienda(s)${queueText}${stockText}. Repón exhibidores y cobra en caja.`
        : `Gestiona inventario, exhibición y caja${queueText}${stockText}.`);
    updateMissionUI();
    refreshHudLayout();
  }

  async function loadThree() {
    if (THREE && GLTFLoader && SkeletonUtils && assetCache && CharacterManager && CharacterAnimationController && characterGeometry) return true;
    try {
      THREE = await import('three');
      const modules = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/utils/SkeletonUtils.js'),
        import('../services/asset_manager.mjs'),
        import('../services/character_manager.mjs'),
        import('../services/character_animation_controller.mjs'),
        import('../services/character_geometry.mjs')
      ]);
      GLTFLoader = modules[0].GLTFLoader;
      SkeletonUtils = modules[1];
      assetCache = modules[2].assetManager;
      CharacterManager = modules[3].CharacterManager;
      ASSET_PRIORITY = modules[3].ASSET_PRIORITY;
      CharacterAnimationController = modules[4].CharacterAnimationController;
      createNpcMotionAdapter = modules[4].createNpcMotionAdapter;
      characterGeometry = modules[5];
      return true;
    } catch (err) {
      console.error(err);
      lastPrepareError='No se pudo cargar el motor local. Comprueba los archivos de la entrega y usa INICIAR_JUEGO.bat.';
      return false;
    }
  }

  function publishLoading(phase, loaded = loadingLoaded) {
    loadingPhase = phase; loadingLoaded = Math.max(0, Math.min(loadingTotal, loaded));
    window.dispatchEvent(new CustomEvent('side3d:loading', { detail: { phase, loaded: loadingLoaded, total: loadingTotal } }));
  }

  async function ensureCharacterRuntime() {
    if(!await loadThree())return false;
    if(!npcMotion||!npcNavigation||!npcNames||!monaModule){
      [npcMotion,npcNavigation,npcNames,monaModule]=await Promise.all([
        import('../services/npc_motion.js?v=20260927-characters'),
        import('../services/npc_navigation.mjs'),
        import('../services/npc_names.js'),
        import('../services/mona_npc.js?v=20260927-characters')
      ]);
    }
    if(!characterManager){
      characterManager=new CharacterManager({storage:null,loadTemplate:descriptor=>descriptor.id==='mona'
        ? monaModule.loadMonaTemplate(THREE,GLTFLoader,CONFIG.NPCS.mona)
        : npcMotion.loadTemplate(GLTFLoader,descriptor.model)});
    }
    characterManager.select(activeCharacterId(),{persist:false});
    return true;
  }

  async function loadCharacter(id, priority) {
    if(!validCharacterId(id)||!await ensureCharacterRuntime())return false;
    try{
      const template=await characterManager.preload(id,{priority:priority||ASSET_PRIORITY.IMPORTANT});
      if(id==='mona'){monaTemplate=template;monaLoadError='';}
      else {suppliedTemplates[id]=template;delete suppliedErrors[id];}
      return true;
    }catch(error){
      if(id==='mona')monaLoadError=error.message;else suppliedErrors[id]=error.message;
      console.warn(`No se pudo cargar ${CONFIG.NPCS[id]?.name||id}; se usará el personaje de respaldo.`,error);
      return false;
    }
  }

  async function preloadBase() {
    if(!basePreloadPromise)basePreloadPromise=(async()=>{
      publishLoading('Cargando motor 3D');
      if(!await loadThree())return false;
      publishLoading('Preparando iluminación esencial',1);
      await loadStartupEnvironment();
      return true;
    })().catch(error=>{console.error('SIDE: precarga base 3D',error);return false;}).then(ok=>{if(!ok)basePreloadPromise=null;return ok;});
    return basePreloadPromise;
  }

  async function preload() {
    if (initialized) return true;
    if (!preloadPromise) {
      preloadPromise = (async () => {
        if (!await preloadBase()) return false;
        publishLoading(`Cargando ${CONFIG.NPCS?.[activeCharacterId()]?.name||'personaje'} como avatar`,2);
        await loadCharacter(activeCharacterId(),ASSET_PRIORITY.CRITICAL);
        publishLoading('Recursos básicos listos',3);
        window.dispatchEvent(new CustomEvent('side3d:ready'));
        return true;
      })().catch(error => {
        console.error('SIDE: precarga 3D', error);
        publishLoading('No se pudo precargar el mundo 3D');
        return false;
      }).then(ok=>{if(!ok)preloadPromise=null;return ok;});
    }
    return preloadPromise;
  }

  function loadingStatus() { return { phase: loadingPhase, loaded: loadingLoaded, total: loadingTotal }; }

  async function loadStartupEnvironment() {
    try {
      const {loadStudioEnvironment}=await import('../services/startup_environment.mjs?v=20260927-entry');
      studioEnvironment=await loadStudioEnvironment();
    } catch(error) {console.warn('Se conserva la iluminación directa del mundo.',error);}
  }

  // Detailed models may stream after entry; their actors and routes already
  // exist throughout the city using fallback models while assets arrive.
  async function loadStorePropTemplates() {
    if (storePropsPromise) return storePropsPromise;
    if (!GLTFLoader || !assetCache) return storePropTemplates;
    const missing = STORE_PROP_ASSETS.filter(([key]) => !storePropTemplates[key]);
    storePropsPromise = Promise.all(missing.map(async ([key, file]) => {
      try {
        const gltf = await assetCache.loadGLTF(new GLTFLoader(), `assets/models3d/props/${file}.glb`, {priority:ASSET_PRIORITY.LAZY});
        if (!gltf.scene) throw new Error('El GLB no contiene una escena.');
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = false; node.receiveShadow = true;
          node.userData.sharedPropResource = true;
        });
        gltf.scene.updateMatrixWorld(true);
        storePropTemplates[key] = gltf.scene; delete storePropErrors[key];
      } catch (error) {
        storePropErrors[key] = error.message;
        console.warn(`No se pudo cargar el prop de tienda ${file}; se conserva su versión procedural.`, error);
      }
    })).then(() => {
      businessInteriors?.installStoreProps(storePropTemplates, perfMode);
      return storePropTemplates;
    }).finally(() => { storePropsPromise = null; });
    return storePropsPromise;
  }

  async function loadWarehousePropTemplates() {
    if (warehousePropsPromise) return warehousePropsPromise;
    if (!GLTFLoader || !assetCache) return warehousePropTemplates;
    const missing = WAREHOUSE_PROP_ASSETS.filter(([key]) => !warehousePropTemplates[key]);
    warehousePropsPromise = Promise.all(missing.map(async ([key, file]) => {
      try {
        const gltf = await assetCache.loadGLTF(new GLTFLoader(), `assets/models3d/props/${file}.glb`, {priority:ASSET_PRIORITY.LAZY});
        if (!gltf.scene) throw new Error('El GLB no contiene una escena.');
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = false; node.receiveShadow = true;
          node.userData.sharedPropResource = true;
        });
        gltf.scene.updateMatrixWorld(true);
        warehousePropTemplates[key] = gltf.scene; delete warehousePropErrors[key];
      } catch (error) {
        warehousePropErrors[key] = error.message;
        console.warn(`No se pudo cargar el prop de almacén ${file}; se conserva su versión procedural.`, error);
      }
    })).then(() => {
      businessInteriors?.installWarehouseProps(warehousePropTemplates, perfMode);
      return warehousePropTemplates;
    }).finally(() => { warehousePropsPromise = null; });
    return warehousePropsPromise;
  }

  async function loadProductionPropTemplates() {
    if (productionPropsPromise) return productionPropsPromise;
    if (!GLTFLoader || !assetCache) return productionPropTemplates;
    const missing = PRODUCTION_PROP_ASSETS.filter(([key]) => !productionPropTemplates[key]);
    productionPropsPromise = Promise.all(missing.map(async ([key, file]) => {
      try {
        // Reused warehouse files intentionally pass through the same asset
        // cache; this creates no duplicate GLTF request or GPU resource set.
        const gltf = await assetCache.loadGLTF(new GLTFLoader(), `assets/models3d/props/${file}.glb`, {priority:ASSET_PRIORITY.LAZY});
        if (!gltf.scene) throw new Error('El GLB no contiene una escena.');
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = false; node.receiveShadow = true;
          node.userData.sharedPropResource = true;
        });
        gltf.scene.updateMatrixWorld(true);
        productionPropTemplates[key] = gltf.scene; delete productionPropErrors[key];
      } catch (error) {
        productionPropErrors[key] = error.message;
        console.warn(`No se pudo cargar el prop de producción ${file}; se conserva su versión procedural.`, error);
      }
    })).then(() => {
      businessInteriors?.installProductionProps(productionPropTemplates, perfMode);
      return productionPropTemplates;
    }).finally(() => { productionPropsPromise = null; });
    return productionPropsPromise;
  }

  async function loadOutdoorPropTemplates() {
    if (outdoorPropsPromise) return outdoorPropsPromise;
    if (!GLTFLoader || !assetCache) return outdoorPropTemplates;
    const missing = OUTDOOR_PROP_ASSETS.filter(([key]) => !outdoorPropTemplates[key]);
    outdoorPropsPromise = Promise.all(missing.map(async ([key, file]) => {
      try {
        const gltf = await assetCache.loadGLTF(new GLTFLoader(), `assets/models3d/props/${file}.glb`, {priority:ASSET_PRIORITY.LAZY});
        if (!gltf.scene) throw new Error('El GLB no contiene una escena.');
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = false; node.receiveShadow = true;
          node.userData.sharedPropResource = true;
        });
        gltf.scene.updateMatrixWorld(true);
        outdoorPropTemplates[key] = gltf.scene; delete outdoorPropErrors[key];
      } catch (error) {
        outdoorPropErrors[key] = error.message;
        console.warn(`No se pudo cargar el prop exterior ${file}; se conserva su versión procedural.`, error);
      }
    })).then(() => {
      hubWorld?.installOutdoorProps(outdoorPropTemplates, perfMode);
      return outdoorPropTemplates;
    }).finally(() => { outdoorPropsPromise = null; });
    return outdoorPropsPromise;
  }

  async function preloadDetails() {
    if(detailsPromise)return detailsPromise;
    detailsPromise=(async()=>{
      if(!await preload())return false;
      // Props can stream beside the supplied characters, but the legacy casual
      // fallback decision must wait until those character requests settle.
      // Otherwise a healthy local character set still triggers an unused GLB.
      const storeProps=loadStorePropTemplates(),warehouseProps=loadWarehousePropTemplates();
      const productionProps=loadProductionPropTemplates(),outdoorProps=loadOutdoorPropTemplates();
      await characterManager?.preloadRemaining({priority:ASSET_PRIORITY.IMPORTANT});
      for(const id of CHARACTER_IDS){const template=characterManager?.template(id);if(!template)continue;if(id==='mona')monaTemplate=template;else suppliedTemplates[id]=template;}
      await Promise.all([loadExecModelTemplates(),storeProps,warehouseProps,productionProps,outdoorProps]);
      await loadCityNpcModels();
      void prepareCityNavigator();
      if(['chico1','chico2','chico3'].some(id=>!suppliedTemplates[id])&&!execModelTemplates.casual)await loadNpcModelTemplate();
      refreshBusinessCharacters();ensureHubCharacters({allowFallback:true});detailsComplete=true;return true;
    })().catch(error=>{console.warn('SIDE: personajes interiores conservan su respaldo.',error);return false;})
      .then(ok=>{if(!ok)detailsPromise=null;return ok;});
    return detailsPromise;
  }

  function refreshBusinessCharacters() {
    for(const room of businessInteriors?.rooms||[])for(const actor of room.actors){
      const previous=actor.object,style=previous.userData.pendingCharacterStyle;
      if(!style||!execModelTemplates[style.execModel])continue;
      const replacement=person(style);
      replacement.position.copy(previous.position);replacement.quaternion.copy(previous.quaternion);
      replacement.visible=previous.visible;replacement.name=previous.name;replacement.userData.role=previous.userData.role;
      replacement.getObjectByName('NpcNameLabel')?.removeFromParent();
      room.detail.add(replacement);previous.removeFromParent();clearGroup(previous);actor.object=replacement;
    }
  }

  async function loadNpcModelTemplate() {
    if(npcModelTemplate||!GLTFLoader||!SkeletonUtils?.clone)return Boolean(npcModelTemplate);
    try{
      const gltf=await assetCache.loadGLTF(new GLTFLoader(),'assets/models/yuka.glb',{priority:ASSET_PRIORITY.LAZY});
      const idle=THREE.AnimationClip.findByName(gltf.animations,'Character_Idle')||gltf.animations[0];
      const walk=THREE.AnimationClip.findByName(gltf.animations,'Character_Walk')||gltf.animations[1]||idle;
      npcModelTemplate={scene:gltf.scene,animations:{idle,walk}};
      return true;
    }catch(error){console.warn('El avatar GLB no pudo cargarse; se mantiene el personaje procedural articulado.',error);npcModelTemplate=null;return false;}
  }

  async function loadExecModelTemplates() {
    if (!GLTFLoader || !SkeletonUtils?.clone) return false;
    const specs = [['male', 'npc_realistic_male'], ['female', 'npc_realistic_female']];
    if(['chico1','chico2','chico3'].some(id=>!suppliedTemplates[id]))specs.push(['casual', 'npc_realistic_male_casual']);
    await Promise.all(specs.map(async ([kind, file]) => {
      if (execModelTemplates[kind]) return;
      try {
        const gltf = await assetCache.loadGLTF(new GLTFLoader(),`assets/models3d/${file}.glb`,{priority:ASSET_PRIORITY.IMPORTANT});
        const idle = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
        const walk = THREE.AnimationClip.findByName(gltf.animations, 'Walk');
        if (!gltf.scene || !idle || !walk) throw new Error('El personaje necesita escena, reposo y marcha.');
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.userData.sharedCharacterResource = true;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach(material => {
            for (const key of ['map', 'normalMap', 'roughnessMap']) {
              const texture = material[key];
              if (!texture?.name) continue;
              const cacheKey = `${key}:${texture.name}`;
              if (characterTextures.has(cacheKey)) material[key] = characterTextures.get(cacheKey);
              else { texture.anisotropy = 4; characterTextures.set(cacheKey, texture); }
            }
          });
        });
        execModelTemplates[kind] = {scene:gltf.scene, animations:{idle, walk, gesture:THREE.AnimationClip.findByName(gltf.animations,'Gesture')}};
      } catch (error) {
        console.warn(`No se pudo cargar el personaje ${kind}; se usará el avatar de respaldo.`, error);
      }
    }));
    return Boolean(execModelTemplates.male || execModelTemplates.female);
  }

  async function loadMonaModel() {
    if (monaTemplate) return true;
    return loadCharacter('mona',ASSET_PRIORITY.IMPORTANT);
  }

  function createBusinessNpc(role, room, previous = null) {
    const cityRole=['oficina','banco','cajero','proveedor','almacen','cliente','guardia'].includes(role)?role:role==='warehouse-worker'?'almacen':role==='production-supervisor'||role==='sewing-operator'||role==='cutting-operator'?'produccion':role==='customer'?'cliente':'tienda';
    const look=role==='cashier'?STAFF_LOOKS[0]:role==='salesperson'?STAFF_LOOKS[1]:{gender:Math.random()<.5?'female':'male',formal:role==='supervisor',shirt:[0x9c553e,0x4f7669,0xc29c52,0x657e9a,0x805e86][Math.floor(Math.random()*5)]};
    const serviceRoom=room&&['office','bank','suppliers'].includes(room.id);
    const nearby=serviceRoom?room.actors.filter(actor=>actor.object!==previous).map(actor=>actor.object.userData.cityNpcId).filter(Boolean):null;
    // Mobile actors can approach this room later. Reserve their identities
    // regardless of their current distance, including the walking guide.
    if(serviceRoom)for(const actor of [...hubActors,...animatedActors.filter(actor=>['guide','visitor'].includes(actor.type))])if(actor.obj.userData.cityNpcId)nearby.push(actor.obj.userData.cityNpcId);
    const config={...look,cityRole,cityScene:room?.id||'interiors',excludedCityIds:nearby};
    const obj=person(config);
    if(!obj)return null;
    obj.getObjectByName('NpcNameLabel')?.removeFromParent();Object.assign(obj.userData,{role});return obj;
  }

  function rebuildCityCharacters() {
    // A smaller quality-tier roster may leave the guide holding the only
    // cashier outfit. Release all mobile identities before assigning staff.
    const mobile=animatedActors.filter(actor=>['guide','visitor'].includes(actor.type));
    animatedActors=animatedActors.filter(actor=>!mobile.includes(actor));
    interactables=interactables.filter(point=>!mobile.some(actor=>actor.obj===point.mesh));
    for(const actor of hubActors){actor.obj.removeFromParent();const disposal=new THREE.Group();disposal.add(actor.obj);clearGroup(disposal);}
    hubActors.length=0;
    for(const actor of mobile){actor.obj.removeFromParent();if(actor.type==='guide')clearGroup(actor.obj);}
    for(const room of businessInteriors?.rooms||[])for(const actor of room.actors){
      const previous=actor.object,replacement=createBusinessNpc(previous.userData.role,room,previous);
      if(!replacement)continue;
      replacement.position.copy(previous.position);replacement.quaternion.copy(previous.quaternion);
      replacement.visible=previous.visible;replacement.name=previous.name;
      room.detail.add(replacement);previous.removeFromParent();clearGroup(previous);actor.object=replacement;
    }
    for(const [index,actor] of mobile.filter(actor=>actor.type==='visitor').entries()){
      const previous=actor.obj,object=person({cityRole:'cliente',cityScene:'outdoor',gender:index%2?'female':'male'});
      if(!object)continue;
      object.position.copy(previous.position);object.quaternion.copy(previous.quaternion);
      object.visible=previous.visible;object.name=previous.name;object.userData.role='pedestrian';
      actor.obj=object;scene.add(object);groundPerson(object);animatedActors.push(actor);clearGroup(previous);
    }
    ensureHubCharacters({allowFallback:true});
  }

  async function loadCityNpcModels() {
    if(cityLoadPromise)return cityLoadPromise;
    cityLoadPromise=(async()=>{try {
      [cityRosterModule,cityClipModule]=await Promise.all([import('../services/npc_city_roster.mjs?v=20261023-world-fun'),import('../services/npc_clip_controller.mjs')]);
      if(!cityApproved){
        const publicResponse=await fetch('assets/models/npc/manifest.json');
        const publicRows=publicResponse.ok?await publicResponse.json():[];
        cityApproved=cityRosterModule.validCityManifest(Array.isArray(publicRows)?publicRows.filter(row=>!row.privado):[]);
      }
      const target=perfMode==='low'?6:perfMode==='high'?16:10;
      const selected=cityApproved.slice(0,target);
      const missing=selected.filter(entry=>!cityTemplates.has(entry.id));
      if(!missing.length&&cityRoster&&cityRoster.models.length===selected.length)return;
      await Promise.all(missing.map(async entry=>{
        try {const gltf=await assetCache.loadGLTF(new GLTFLoader(),entry.archivo,{priority:ASSET_PRIORITY.LAZY});
          if(gltf?.scene)cityTemplates.set(entry.id,{scene:gltf.scene,clips:gltf.animations||[],entry});
        } catch(error){console.warn(`NPC ${entry.id} no disponible; se usará el respaldo procedural.`,error)}
      }));
      const previousRosterIds=cityRoster?.models.map(model=>model.id).join('|')||'';
      cityRoster=cityRosterModule.createCityRoster(selected.filter(entry=>cityTemplates.has(entry.id)));
      if(previousRosterIds!==cityRoster.models.map(model=>model.id).join('|')&&cityRoster.models.length){
        rebuildCityCharacters();
      }
    } catch(error){console.warn('No se pudo cargar el catálogo NPC; se mantiene el respaldo procedural.',error)}})()
      .finally(()=>{cityLoadPromise=null});
    return cityLoadPromise;
  }

  async function prepareCityNavigator() {
    if(perfMode==='low'||cityNavigator||cityNavPromise||!hubWorld||!cityMap)return cityNavigator;
    cityNavPromise=(async()=>{
      try{
        const [{buildNpcGridNavmesh},{loadOptionalNpcNavigator}]=await Promise.all([
          import('../services/npc_navmesh_grid.mjs'),import('../services/npc_optional_navigation.mjs')
        ]);
        const built=buildNpcGridNavmesh({THREE,bounds:cityMap.bounds,offsetX:HUB_OFFSET,
          obstacles:hubWorld.colliders,cellSize:3,agentRadius:.4});
        cityNavStats=built.stats;
        const navigator=await loadOptionalNpcNavigator({THREE,geometry:built.geometry,obstacles:hubWorld.colliders});
        built.geometry.dispose();
        cityNavigator=navigator.ready?navigator:null;
      }catch(error){console.warn('Navegación avanzada no disponible; se conservan rutas seguras.',error)}
      return cityNavigator;
    })().finally(()=>{cityNavPromise=null});
    return cityNavPromise;
  }

  async function loadSuppliedNpcs() {
    await ensureCharacterRuntime();
    await Promise.all(['chico1','chico2','chico3'].map(id=>loadCharacter(id,ASSET_PRIORITY.IMPORTANT)));
  }

  async function initNavigation() {
    navReady = false;
    try {
      // Historical compatibility only: normal city startup never downloads Recast.
      if(!recastCore||!recastGenerators)[recastCore,recastGenerators]=await Promise.all([import('@recast-navigation/core'),import('@recast-navigation/generators')]);
      if (!recastCore || !recastGenerators) return false;
      await recastCore.init();
      const positions = [], indices = [];
      const addRect = (minX,maxX,minZ,maxZ) => {
        const offset = positions.length / 3;
        positions.push(minX,0,minZ, maxX,0,minZ, maxX,0,maxZ, minX,0,maxZ);
        indices.push(offset,offset+2,offset+1, offset,offset+3,offset+2);
      };
      addRect(-12.7,12.7,-.75,8.5);       // tienda
      addRect(-12.7,3.55,-11.7,-1.25);    // producción
      addRect(4.45,12.7,-11.7,-1.25);     // almacén
      addRect(-4.3,-2.1,-1.4,-.6);        // puerta de producción
      addRect(7.25,9.45,-1.4,-.6);        // puerta de almacén
      addRect(3.4,4.6,-7.25,-5.15);       // conexión producción-almacén
      addRect(-12.7,12.7,8.0,13.6);       // acceso y vereda sur
      addRect(-1.9,1.9,13.2,25.0);        // paso peatonal
      addRect(-12.7,12.7,24.4,29.5);      // vereda norte y panel
      const result = recastGenerators.generateSoloNavMesh(positions, indices, { cs:.3, ch:.2, walkableRadius:1, walkableHeight:8, walkableClimb:2 });
      if (!result.success) return false;
      navMesh = result.navMesh;
      navQuery = new recastCore.NavMeshQuery(navMesh);
      navReady = true;
      return true;
    } catch (error) {
      console.warn('Recast no disponible; continúa la ruta segura integrada.', error);
      navMesh = null; navQuery = null;
      return false;
    }
  }

  function computeSafePath(from, to, fallback = []) {
    if (navReady && navQuery) {
      try {
        const result = navQuery.computePath({x:from.x,y:0,z:from.z},{x:to.x,y:0,z:to.z});
        if (result?.success && result.path?.length) return result.path.map(p => [p.x,p.z]);
      } catch (error) { console.warn('Ruta Recast inválida; se conserva la ruta de respaldo.', error); }
    }
    return fallback.length ? fallback.map(p => [...p]) : [[to.x,to.z]];
  }

  function mat(color, rough = 0.72, metal = 0.05, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  }

  function mesh(geometry, material) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }

  function box(w, h, d, color, x, y, z, rough = 0.72, metal = 0.05) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
    m.position.set(x, y, z);
    return m;
  }

  function cylinder(rt, rb, h, color, x, y, z, segments = 12, rough = 0.72, metal = 0.05) {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat(color, rough, metal));
    m.position.set(x, y, z);
    return m;
  }

  function capsule(radius, length, color, x, y, z, rough = .68, metal = .02) {
    const geometry = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(radius, length, 5, 10)
      : new THREE.CylinderGeometry(radius, radius, length + radius * 2, 12);
    const m = mesh(geometry, mat(color, rough, metal));
    m.position.set(x, y, z);
    return m;
  }

  function plane(w, h, color, x, y, z, rx = -Math.PI / 2, ry = 0, rough = 0.9, metal = 0.01) {
    const p = mesh(new THREE.PlaneGeometry(w, h), mat(color, rough, metal, { side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.rotation.set(rx, ry, 0);
    return p;
  }

  const patternCache = {};
  function patternTexture(kind) {
    if (patternCache[kind]) return patternCache[kind];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    if (kind === 'road') {
      ctx.fillStyle = '#30363d'; ctx.fillRect(0,0,256,256);
      for (let i=0;i<420;i++) { const v=42+Math.floor(Math.random()*28); ctx.fillStyle=`rgba(${v},${v},${v},${.07+Math.random()*.08})`; ctx.fillRect(Math.random()*256,Math.random()*256,1+Math.random()*2,1+Math.random()*2); }
      ctx.strokeStyle='rgba(15,18,21,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,150);ctx.bezierCurveTo(70,140,150,166,256,150);ctx.stroke();
    } else if (kind === 'sidewalk') {
      ctx.fillStyle='#aeb5bc';ctx.fillRect(0,0,256,256);ctx.strokeStyle='rgba(70,78,86,.26)';ctx.lineWidth=2;
      for(let x=0;x<=256;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
      for(let y=0;y<=256;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
      for(let i=0;i<90;i++){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(Math.random()*256,Math.random()*256,2,2);}
    } else {
      ctx.fillStyle='#c9b79f';ctx.fillRect(0,0,256,256);
      for(let y=0;y<256;y+=32){ctx.fillStyle=y%64===0?'#d3c2aa':'#c7b39a';ctx.fillRect(0,y,256,30);ctx.strokeStyle='rgba(76,55,36,.18)';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}
      for(let i=0;i<80;i++){ctx.strokeStyle='rgba(80,55,30,.07)';ctx.beginPath();const y=Math.random()*256;ctx.moveTo(0,y);ctx.bezierCurveTo(80,y+Math.random()*7,180,y-Math.random()*7,256,y);ctx.stroke();}
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
    patternCache[kind]=tex; return tex;
  }

  function texturedPlane(w,h,kind,x,y,z,repeatX=8,repeatY=8) {
    const tex=patternTexture(kind).clone(); tex.needsUpdate=true; tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(repeatX,repeatY);
    const p=mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tex,roughness:.94,metalness:.01,side:THREE.DoubleSide}));
    p.position.set(x,y,z);p.rotation.x=-Math.PI/2;return p;
  }

  function texturedFloorBox(w,h,d,kind,x,y,z) {
    const tex=patternTexture(kind).clone();tex.needsUpdate=true;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(Math.max(1,w/2),Math.max(1,d/2));
    const material=new THREE.MeshStandardMaterial({map:tex,roughness:.82,metalness:.01});
    const m=mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);return m;
  }

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }
  function addDynamicCollider(minX,maxX,minZ,maxZ){dynamicColliders.push({minX,maxX,minZ,maxZ});}

  function addTextLabel(text, x, y, z, color = '#ffffff', scale = 1, bg = 'rgba(3,8,14,.80)') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = bg;
    ctx.fillRect(16, 18, 992, 220);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.strokeRect(18, 20, 988, 216);
    ctx.fillStyle = '#fff';
    ctx.font = '700 88px Montserrat,Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 30), 512, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(x, y, z);
    sp.scale.set(4.8 * scale, 1.2 * scale, 1);
    return sp;
  }

  function handbag(x, y, z, color = 0xb98a58, scale = 1, rotate = 0) {
    const g = new THREE.Group();
    const variant = Math.abs(Math.round(Number(color) || 0)) % 3;
    if (variant === 0) {
      const body = box(0.86 * scale, 0.54 * scale, 0.34 * scale, color, 0, 0.26 * scale, 0, 0.42, 0.05);
      const flap = box(0.88 * scale, 0.10 * scale, 0.30 * scale, color, 0, 0.48 * scale, 0.03 * scale, 0.35, 0.08);
      const strapL = box(0.10 * scale, 0.38 * scale, 0.06 * scale, 0xa16e3a, -0.26 * scale, 0.30 * scale, 0.16 * scale, 0.4, 0.1);
      const strapR = box(0.10 * scale, 0.38 * scale, 0.06 * scale, 0xa16e3a, 0.26 * scale, 0.30 * scale, 0.16 * scale, 0.4, 0.1);
      const buckleL = box(0.10 * scale, 0.08 * scale, 0.03 * scale, 0xd8bf67, -0.26 * scale, 0.26 * scale, 0.18 * scale, 0.25, 0.7);
      const buckleR = box(0.10 * scale, 0.08 * scale, 0.03 * scale, 0xd8bf67, 0.26 * scale, 0.26 * scale, 0.18 * scale, 0.25, 0.7);
      const handle = mesh(new THREE.TorusGeometry(0.28 * scale, 0.04 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      handle.rotation.z = Math.PI;
      handle.position.y = 0.60 * scale;
      g.add(body, flap, strapL, strapR, buckleL, buckleR, handle);
    } else if (variant === 1) {
      const body = box(0.92 * scale, 0.58 * scale, 0.42 * scale, color, 0, 0.28 * scale, 0, 0.4, 0.05);
      const baseL = box(0.22 * scale, 0.16 * scale, 0.40 * scale, 0xb28a58, -0.34 * scale, 0.10 * scale, 0, 0.4, 0.05);
      const baseR = box(0.22 * scale, 0.16 * scale, 0.40 * scale, 0xb28a58, 0.34 * scale, 0.10 * scale, 0, 0.4, 0.05);
      const zip = box(0.60 * scale, 0.04 * scale, 0.04 * scale, 0xdfe5ee, 0, 0.43 * scale, 0.22 * scale, 0.18, 0.8);
      const handleL = mesh(new THREE.TorusGeometry(0.17 * scale, 0.03 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      const handleR = mesh(new THREE.TorusGeometry(0.17 * scale, 0.03 * scale, 10, 20, Math.PI), mat(0x9c6733, 0.5, 0.12));
      handleL.rotation.z = Math.PI; handleR.rotation.z = Math.PI;
      handleL.position.set(-0.17 * scale, 0.63 * scale, 0); handleR.position.set(0.17 * scale, 0.63 * scale, 0);
      g.add(body, baseL, baseR, zip, handleL, handleR);
    } else {
      const body = box(0.84 * scale, 0.58 * scale, 0.28 * scale, color, 0, 0.26 * scale, 0, 0.46, 0.05);
      const flap = box(0.44 * scale, 0.46 * scale, 0.08 * scale, 0xefe7da, 0, 0.24 * scale, 0.16 * scale, 0.32, 0.08);
      const button = cylinder(0.05 * scale, 0.05 * scale, 0.04 * scale, 0xd9c65d, 0, 0.23 * scale, 0.19 * scale, 14, 0.2, 0.7);
      button.rotation.x = Math.PI / 2;
      const loopL = mesh(new THREE.TorusGeometry(0.08 * scale, 0.02 * scale, 8, 14), mat(0xd9c65d, 0.2, 0.7));
      const loopR = mesh(new THREE.TorusGeometry(0.08 * scale, 0.02 * scale, 8, 14), mat(0xd9c65d, 0.2, 0.7));
      loopL.position.set(-0.28 * scale, 0.50 * scale, 0); loopR.position.set(0.28 * scale, 0.50 * scale, 0);
      const handle = mesh(new THREE.TorusGeometry(0.36 * scale, 0.035 * scale, 10, 22, Math.PI), mat(0x1c2f44, 0.5, 0.12));
      handle.rotation.z = Math.PI; handle.position.y = 0.72 * scale;
      g.add(body, flap, button, loopL, loopR, handle);
    }
    g.position.set(x, y, z);
    g.rotation.y = rotate;
    return g;
  }

  function attachProceduralController(group) {
    if(!group?.userData?.motion||group.userData.animationController||!CharacterAnimationController||!createNpcMotionAdapter)return group;
    const fallback=createNpcMotionAdapter({group,animateNpc:npcMotion.animateNpc,resetMotion:npcMotion.resetMotion});
    group.userData.animationController=new CharacterAnimationController({fallback,metadata:{rig:'SIDE-17',retargeted:false}});
    group.userData.animationController.playIdle();
    return group;
  }

  function normalizePerson(group, role='npc', variation=.975) {
    return characterGeometry.normalizeCharacterGeometry(THREE,group,characterGeometry.characterTargetHeight(role,variation));
  }

  function groundPerson(group, worldPosition=null) {
    const position=worldPosition||group.getWorldPosition(group.userData.groundWorldPosition||(group.userData.groundWorldPosition=new THREE.Vector3()));
    const floor=businessInteriors?.groundHeightAt?.(position.x,position.z)??hubWorld?.groundHeightAt?.(position.x,position.z)??hubWorld?.groundY??.025;
    const parentY=group.parent?group.parent.getWorldPosition(group.userData.groundParentPosition||(group.userData.groundParentPosition=new THREE.Vector3())).y:0;
    characterGeometry.anchorCharacterToGround(group,floor,parentY,group===playerAvatar?player.y-player.baseY:0);
  }

  function cityNpcFromTemplate(cfg) {
    if(!cityRoster||!SkeletonUtils?.clone)return null;
    const nearby=[];
    for(const actor of [...animatedActors,...hubActors])if(actor.obj?.userData?.cityNpcId)nearby.push(actor.obj.userData.cityNpcId);
    for(const customer of npcs)if(customer.obj?.userData?.cityNpcId)nearby.push(customer.obj.userData.cityNpcId);
    for(const room of businessInteriors?.rooms||[])for(const actor of room.actors)if(actor.object.userData.cityNpcId)nearby.push(actor.object.userData.cityNpcId);
    if(cfg.excludedCityIds){nearby.splice(0,nearby.length,...cfg.excludedCityIds);if(!cityRoster.models.some(row=>cityRosterModule.npcHasRole(row,cfg.cityRole)&&!nearby.includes(row.id)))return null;}
    // Never recycle an occupied identity onto a mobile actor: moving it later
    // would create twins beside an interior worker. person() supplies fallback.
    const unique=Boolean(cfg.excludedCityIds)||['hub','outdoor'].includes(cfg.cityScene);
    const choice=cityRoster.draw(cfg.cityScene||'business',cfg.cityRole,nearby,{unique});
    const template=choice&&cityTemplates.get(choice.model.id);
    if(!template)return null;
    const group=new THREE.Group(),avatar=SkeletonUtils.clone(template.scene);
    avatar.traverse(node=>{if(node.isMesh)node.userData.sharedCharacterResource=true});
    if(choice.repeated)avatar.traverse(node=>{
      if(!node.isMesh||!node.material)return;
      node.userData.cityTintedMaterial=true;
      node.material=Array.isArray(node.material)?node.material.map(material=>material.clone()):node.material.clone();
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const material of materials)if(material.color)material.color.lerp(new THREE.Color(choice.tint),.12);
    });
    group.add(avatar);
    const mixer=new THREE.AnimationMixer(avatar);
    const clipSpeeds=Object.fromEntries(Object.entries(cityClipModule.indexNpcClips(template.clips)).map(([state,clip])=>[state,cityClipModule.rootMotionSpeed(clip)]));
    const controller=cityClipModule.createNpcClipController({mixer,clips:characterGeometry.clipsWithoutRootMotion(template.clips,avatar.name),clipSpeeds,idleVariant:Math.floor(choice.animationOffset)});
    group.userData={cityNpcId:choice.model.id,modelKind:`city:${choice.model.id}`,cityClipController:controller,
      cityAvatar:avatar,cityMixer:mixer,cityPosePosition:new THREE.Vector3(),cityPoseReady:false};
    normalizePerson(group,'npc',(cfg.bodyScale||.975)*choice.heightScale);
    npcNames?.setNpcName(group,choice.model.nombre,group.userData.characterGeometry.height/group.scale.y);
    return group;
  }

  function person(style = 0x5aa9ff, characterRole = 'npc') {
    const cfg = typeof style === 'object' ? style : { shirt: style };
    if(characterRole!=='player'&&cfg.cityRole){const city=cityNpcFromTemplate(cfg);if(city)return city;cfg.forceProcedural=true;}
    let modelKind = cfg.execModel || (cfg.gender === 'female' ? 'female' : cfg.formal ? 'male' : 'casual');
    if(characterRole!=='player'&&validCharacterId(modelKind)){modelKind='city-fallback';cfg.forceProcedural=true;}
    if (suppliedTemplates[modelKind]) {
      const group=npcMotion.createNpc(suppliedTemplates[modelKind],modelKind);
      normalizePerson(group,characterRole,cfg.bodyScale);
      npcNames.setNpcName(group,CONFIG.NPCS[modelKind].name,group.userData.characterGeometry.height/group.scale.y);return attachProceduralController(group);
    }
    const template = execModelTemplates[modelKind] || (modelKind.startsWith('chico') ? execModelTemplates.casual : null);
    if (template && SkeletonUtils?.clone) {
      const group = new THREE.Group(), avatar = SkeletonUtils.clone(template.scene);
      avatar.traverse(node => {
        if (!node.isMesh) return;
        node.castShadow = true; node.receiveShadow = true;
      });
      avatar.scale.setScalar(cfg.bodyScale ?? 1);
      group.add(avatar);
      const mixer = new THREE.AnimationMixer(avatar);
      const actions = Object.fromEntries(Object.entries(template.animations).filter(([,clip])=>clip).map(([name,clip])=>[name,mixer.clipAction(characterGeometry.clipsWithoutRootMotion([clip],avatar.name)[0])]));
      actions.idle.play();mixer.update(0);
      const animationController=new CharacterAnimationController({mixer,actions:{IDLE:actions.idle,WALK:actions.walk,TALK:actions.gesture},metadata:{rig:'embedded',retargeted:false}});
      animationController.playIdle();
      group.userData = {modelAvatar:avatar, modelKind, mixer, actions, animationController, currentAction:'idle', lastAnimAt:performance.now()/1000};
      normalizePerson(group,characterRole,cfg.bodyScale);
      if(CONFIG.NPCS[modelKind])npcNames.setNpcName(group,CONFIG.NPCS[modelKind].name,group.userData.characterGeometry.height/group.scale.y);
      return group;
    }
    if(!cfg.forceProcedural&&npcModelTemplate&&SkeletonUtils?.clone){
      try{
        const g=new THREE.Group(),avatar=SkeletonUtils.clone(npcModelTemplate.scene);
        avatar.traverse(node=>{
          if(!node.isMesh)return;node.castShadow=false;node.receiveShadow=false;
          if(node.material){node.material=node.material.clone();if(node.material.color&&cfg.shirt!==undefined)node.material.color.lerp(new THREE.Color(cfg.shirt),cfg.formal ? .16 : .09);}
        });
        const bodyScale=cfg.bodyScale??(.86+Math.random()*.12);avatar.scale.setScalar(.82*bodyScale);g.add(avatar);
        if(cfg.formal){const badge=box(.11,.16,.025,cfg.tie??0x315f9c,.16,1.18,.15,.3,.15);g.add(badge);}
        const cleanClips=characterGeometry.clipsWithoutRootMotion(Object.values(npcModelTemplate.animations),avatar.name);
        const mixer=new THREE.AnimationMixer(avatar),idle=cleanClips[0],walk=cleanClips[1];
        const idleAction=idle?mixer.clipAction(idle):null,walkAction=walk?mixer.clipAction(walk):null;
        const actions={idle:idleAction,walk:walkAction};
        const animationController=new CharacterAnimationController({mixer,actions:{IDLE:idleAction,WALK:walkAction},metadata:{rig:'embedded-fallback',retargeted:false}});animationController.playIdle();
        g.userData.modelAvatar=avatar;g.userData.mixer=mixer;g.userData.actions=actions;g.userData.animationController=animationController;g.userData.currentAction='idle';g.userData.lastAnimAt=performance.now()/1000;
        return normalizePerson(g,characterRole,bodyScale);
      }catch(error){console.warn('No se pudo clonar el avatar; se usa el fallback procedural.',error);}
    }
    const g = new THREE.Group();
    const skin = cfg.skin ?? [0xd8ab7e, 0xc8956c, 0x9f6a4a, 0xe2b98d][Math.floor(Math.random()*4)];
    const shirt = cfg.shirt ?? 0x5aa9ff;
    const pants = cfg.pants ?? [0x233041,0x283746,0x30333a,0x485366][Math.floor(Math.random()*4)];
    const shoes = cfg.shoes ?? 0x4e392c;
    const hairColor = cfg.hair ?? [0x37281f,0x6f5038,0x1f2023,0x9a7046][Math.floor(Math.random()*4)];
    const female = cfg.gender === 'female' || (!cfg.gender && Math.random() < 0.48);
    const formal = Boolean(cfg.formal);
    const bodyScale = cfg.bodyScale ?? (female ? 0.94 + Math.random()*0.08 : 0.98 + Math.random()*0.08);

    const torso = capsule(female ? .18 : .205, .34, shirt, 0, 1.12, 0, .5, .02);
    torso.scale.z = .72;
    const hips = capsule(female ? .17 : .16, .02, pants, 0, .76, 0, .58, .03);
    hips.scale.z = .76;
    const head = mesh(new THREE.SphereGeometry(0.18, 14, 10), mat(skin, 0.88, 0.0));
    head.position.y = 1.63;
    head.scale.y = female ? 1.04 : 1.0;
    const neck = cylinder(0.047, 0.05, 0.10, skin, 0, 1.46, 0, 12, 0.9, 0.0);

    const hair = mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), mat(hairColor, 0.78, 0.02));
    hair.position.set(0, 1.70, -0.01);
    if (female && (cfg.longHair || Math.random() < 0.55)) {
      const backHair = box(0.30, 0.30, 0.10, hairColor, 0, 1.56, -0.10, 0.72, 0.01);
      g.add(backHair);
      if (cfg.longHair) {
        const hairSideL = box(0.07, 0.34, 0.09, hairColor, -0.155, 1.53, -0.02, 0.75, 0.01);
        const hairSideR = box(0.07, 0.34, 0.09, hairColor, 0.155, 1.53, -0.02, 0.75, 0.01);
        hairSideL.rotation.z = -0.08; hairSideR.rotation.z = 0.08;
        g.add(hairSideL, hairSideR);
      }
    }

    const eyeMat = mat(0x1a1715, 0.6, 0.0);
    const eyeL = mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat); eyeL.position.set(-0.062,1.65,0.166);
    const eyeR = mesh(new THREE.SphereGeometry(0.016, 8, 6), eyeMat); eyeR.position.set(0.062,1.65,0.166);
    const nose = box(0.025,0.04,0.035,skin,0,1.60,0.178,0.8,0);

    if (cfg.glasses) {
      const frameMat = mat(0x1c1c1c, 0.4, 0.35);
      const lensMat = mat(0xbcd6e6, 0.15, 0.1, { transparent: true, opacity: 0.55 });
      const frameL = mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 14), frameMat); frameL.position.set(-0.062,1.652,0.172);
      const frameR = mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 14), frameMat); frameR.position.set(0.062,1.652,0.172);
      const lensL = mesh(new THREE.CircleGeometry(0.026, 14), lensMat); lensL.position.set(-0.062,1.652,0.174);
      const lensR = mesh(new THREE.CircleGeometry(0.026, 14), lensMat); lensR.position.set(0.062,1.652,0.174);
      const bridge = box(0.032, 0.006, 0.006, 0x1c1c1c, 0, 1.652, 0.170, 0.4, 0.35);
      g.add(frameL, frameR, lensL, lensR, bridge);
    }
    if (cfg.buttons) {
      for (const y of [1.24, 1.10, 0.96]) g.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0xcaa25a, 0.35, 0.5)).translateX(0).translateY(y).translateZ(0.135));
    }

    const armL = capsule(.058, .25, shirt, -.27, 1.12, 0, .55, .01);
    const armR = capsule(.058, .25, shirt, .27, 1.12, 0, .55, .01);
    const foreL = capsule(.047, .20, skin, -.27, .80, 0, .76, 0);
    const foreR = capsule(.047, .20, skin, .27, .80, 0, .76, 0);
    const handL = mesh(new THREE.SphereGeometry(.058,10,8),mat(skin,.78,0)); handL.position.set(-.27,.61,0);
    const handR = mesh(new THREE.SphereGeometry(.058,10,8),mat(skin,.78,0)); handR.position.set(.27,.61,0);
    const legL = capsule(.07, .40, pants, -.105, .39, 0, .62, .02);
    const legR = capsule(.07, .40, pants, .105, .39, 0, .62, .02);
    const shoeL = capsule(.072,.12,shoes,-.105,.075,.065,.48,.02); shoeL.rotation.x=Math.PI/2;
    const shoeR = capsule(.072,.12,shoes,.105,.075,.065,.48,.02); shoeR.rotation.x=Math.PI/2;

    g.add(torso, hips, head, neck, hair, eyeL, eyeR, nose, armL, armR, foreL, foreR, handL, handR, legL, legR, shoeL, shoeR);

    if (formal) {
      const collarL = box(0.10,0.04,0.02,0xf5f5f4,-0.055,1.38,0.13,0.4,0.01); collarL.rotation.z=-0.35;
      const collarR = box(0.10,0.04,0.02,0xf5f5f4,0.055,1.38,0.13,0.4,0.01); collarR.rotation.z=0.35;
      const tie = box(0.055, 0.30, 0.02, cfg.tie ?? 0x2f67c2, 0, 1.10, 0.13, 0.4, 0.08);
      g.add(collarL,collarR,tie);
      g.userData.tie = tie;
    }
    if (female && !formal && Math.random() < 0.4) {
      const jacket = box(0.44,0.36,0.025,cfg.jacket ?? 0x7652a8,0,1.12,0.132,0.5,0.01);
      g.add(jacket);
    }

    g.scale.setScalar(bodyScale);
    g.userData.parts = { torso, hips, head, armL, armR, foreL, foreR, handL, handR, legL, legR, shoeL, shoeR };
    g.userData.gender = female ? 'female' : 'male';
    if(['male','female'].includes(cfg.execModel))g.userData.pendingCharacterStyle={...cfg};
    return normalizePerson(g,characterRole,bodyScale);
  }

  function setPersonPose(g, cycle = 0, moving = false, frameDt = null, movementSpeed = null) {
    // Keep navigation/customer decisions at full rate; only distant rig posing
    // is reduced. Accumulated time preserves gait speed when it is updated.
    const worldPosition=camera?g.getWorldPosition(g.userData.poseWorldPosition||(g.userData.poseWorldPosition=new THREE.Vector3())):g.position;
    groundPerson(g,worldPosition);
    const playerDistance=camera?Math.hypot(worldPosition.x-player.x,worldPosition.z-player.z):0;
    const shadowed=g===playerAvatar||playerDistance<18;
    if(g.userData.characterShadowed!==shadowed){g.userData.characterShadowed=shadowed;g.traverse?.(node=>{if(node.isMesh)node.castShadow=shadowed;});}
    if (g !== playerAvatar && camera && playerDistance>16) {
      const now=performance.now()/1000;
      const elapsed=frameDt ?? Math.min(.08,Math.max(.001,now-Number(g.userData.lastLodAt||now-.016)));
      g.userData.lastLodAt=now;
      g.userData.poseElapsed=(g.userData.poseElapsed||0)+elapsed;
      const farFps=Number((PERF[perfMode]||PERF.auto||{}).farAnimationFps||12);
      const interval=playerDistance>48?0.2:playerDistance>28?1/Math.max(5,farFps):1/30;
      if(g.userData.poseElapsed<interval)return;
      frameDt=g.userData.poseElapsed;g.userData.poseElapsed=0;
    } else if(g.userData.poseElapsed) {
      frameDt=(frameDt||.016)+g.userData.poseElapsed;g.userData.poseElapsed=0;
    }
    if(g.userData.cityClipController){
      const now=g.getWorldPosition(g.userData.cityPosePosition||new THREE.Vector3());
      const previous=g.userData.cityPreviousPosition||(g.userData.cityPreviousPosition=now.clone());
      const distance=g.userData.cityPoseReady?previous.distanceTo(now):0;
      previous.copy(now);g.userData.cityPoseReady=true;
      let onScreen=!camera||playerDistance<55;
      if(onScreen&&camera){
        const dx=now.x-camera.position.x,dy=now.y-camera.position.y,dz=now.z-camera.position.z;
        const basis=camera.matrixWorld.elements;
        const facing=-(dx*basis[8]+dy*basis[9]+dz*basis[10]);
        onScreen=facing>-.2*Math.hypot(dx,dy,dz);
      }
      g.userData.cityClipController.update(frameDt||.016,{distance,requested:g.userData.cityRequestedAction||null,visible:onScreen});return;
    }
    if(g.userData.animationController){
      const now=performance.now()/1000;
      const dt=frameDt ?? Math.min(.08,Math.max(.001,now-Number(g.userData.lastAnimAt||now-.016)));
      g.userData.lastAnimAt=now;
      g.userData.animationController.update(dt,{speed:movementSpeed??(moving?Math.max(.82,g.userData.motion?.speed||0):0),grounded:g===playerAvatar?player.grounded:true,...(g===playerAvatar?{state:player.locomotion}:null)});return;
    }
    if(g.userData.motion){
      const now=performance.now()/1000;
      const dt=frameDt ?? Math.min(.08,Math.max(.001,now-Number(g.userData.lastAnimAt||now-.016)));
      g.userData.lastAnimAt=now;
      npcMotion.animateNpc(g,dt,moving);return;
    }
    if(g.userData?.mixer){
      const now=performance.now()/1000,delta=frameDt??Math.min(.08,Math.max(.001,now-Number(g.userData.lastAnimAt||now-.016)));g.userData.lastAnimAt=now;
      const next=moving?'walk':'idle';if(next!==g.userData.currentAction){const actions=g.userData.actions||{},previous=actions[g.userData.currentAction],current=actions[next];previous?.fadeOut(.22);current?.reset().fadeIn(.22).play();g.userData.currentAction=next;}
      g.userData.mixer.update(delta);return;
    }
    const parts = g.userData.parts;
    if (!parts) return;
    const swing = moving ? Math.sin(cycle) * 0.58 : Math.sin(cycle * 0.5) * 0.06;
    const elbow = moving ? Math.sin(cycle + 0.25) * 0.16 : 0.02;
    parts.armL.rotation.z = swing * 0.78;
    parts.armR.rotation.z = -swing * 0.78;
    parts.foreL.rotation.z = swing * 0.42 + elbow;
    parts.foreR.rotation.z = -swing * 0.42 - elbow;
    parts.handL.rotation.z = parts.foreL.rotation.z * 0.55;
    parts.handR.rotation.z = parts.foreR.rotation.z * 0.55;
    parts.legL.rotation.z = -swing * 0.42;
    parts.legR.rotation.z = swing * 0.42;
    const baseY = g.userData.baseY || { head: 1.63, torso: 1.10, hips: 0.74 };
    parts.head.position.y = baseY.head + (moving ? Math.abs(Math.sin(cycle * 0.7)) * 0.012 : 0.006 * Math.sin(cycle * 0.3));
    parts.torso.position.y = baseY.torso + (moving ? Math.abs(Math.sin(cycle)) * 0.012 : 0.006 * Math.sin(cycle * 0.35));
    parts.hips.position.y = baseY.hips + (moving ? Math.abs(Math.sin(cycle)) * 0.008 : 0);
  }

  function acquireNpcPerson(style) {
    if(style.cityRole){const created=person(style);created.userData.cityRole=style.cityRole;return created;}
    const index=npcPool.findIndex(p=>p.userData.modelKind===style.execModel);
    const pooled=index>=0?npcPool.splice(index,1)[0]:null;
    if(!pooled)return person(style);
    pooled.visible=true;pooled.position.set(0,0,0);pooled.rotation.set(0,0,0);pooled.userData.lastAnimAt=performance.now()/1000;
    npcMotion?.resetMotion(pooled);
    return pooled;
  }

  function recycleNpcPerson(npc) {
    if(!npc?.obj)return;
    releaseCrossing(npc);
    removeNpcBag(npc.obj);
    if(npc.obj.userData.orderLabel){npc.obj.remove(npc.obj.userData.orderLabel);npc.obj.userData.orderLabel=null;}
    npcGroup?.remove(npc.obj);npc.obj.visible=false;
    const limit=Number((PERF[perfMode]||PERF.auto||{maxCustomers:8}).maxCustomers||8);
    if(npc.obj.userData.cityNpcId||npc.obj.userData.cityRole){const disposal=new THREE.Group();disposal.add(npc.obj);clearGroup(disposal)}
    else if(npcPool.length<limit)npcPool.push(npc.obj);
    else {const disposal=new THREE.Group();disposal.add(npc.obj);clearGroup(disposal)}
  }

  function removeNpcBag(obj) {
    const bag=obj.userData.heldBag;if(!bag)return;
    bag.removeFromParent();clearGroup(bag);obj.userData.heldBag=null;
  }

  function attachBagToNpc(npc) {
    if (npc.obj.userData.heldBag) return;
    const product = productById(npc.productId);
    const bag = handbag(0.28, 0.78, 0, product.color, 0.36, Math.PI / 2.2);
    const motion=npc.obj.userData.motion;
    const hand=motion?(motion.profile.freeArms.includes(-1)?motion.bones.HandL:motion.bones.HandR):null;
    if(hand){bag.position.set(0,-.22,.045);hand.add(bag)}else npc.obj.add(bag);
    npc.obj.userData.heldBag = bag;
  }

  function chooseProductForCustomer(archetype = null) {
    if (!inventory) loadInventory();
    const available = PRODUCTS.filter(p => displayStock(p.id) > 0);
    if (!available.length) return null;
    const pref = archetype?.pref;
    const weights = available.map(p => {
      let w = p.id === 'urbano' ? 1.35 : 1;
      if (p.id === 'premium' && salesStaff() > 1) w += 0.25;
      if (pref && p.id === pref) w += 1.25;
      if (hasAnalyst() && p.id === 'urbano') w += 0.2;
      return w;
    });
    let r = Math.random() * weights.reduce((a,b)=>a+b,0);
    for (let i=0;i<available.length;i++) { r -= weights[i]; if (r <= 0) return available[i]; }
    return available[available.length-1];
  }

  function reserveProductForNpc(npc, product) {
    if (!product || displayStock(product.id) <= 0) return false;
    inventory.display[product.id] -= 1;
    npc.productId = product.id;
    npc.productPrice = product.price;
    saveInventory();
    renderInventoryDisplays();
    updateHUD();
    return true;
  }

  function restockDisplays(manual = true) {
    if (!inventory) loadInventory();
    let moved = 0;
    PRODUCTS.forEach(product => {
      const cap = displayCapacity();
      const need = Math.max(0, cap - displayStock(product.id));
      const move = Math.min(need, reserveStock(product.id));
      if (move > 0) {
        inventory.display[product.id] += move;
        inventory.reserve[product.id] -= move;
        moved += move;
      }
    });
    if (moved) {
      saveInventory();
      renderInventoryDisplays();
      updateHUD();
      if (manual) { message(`Reposición completada: ${moved} bolso(s) pasaron del almacén a exhibición.`); playSfx('restock'); }
    } else if (manual) {
      message(totalReserveStock() ? 'Los exhibidores ya están completos.' : 'No queda stock en almacén para reponer.');
    }
    return moved;
  }

  function displayCapacity() { return 4 + Math.min(3, Number(businessState?.upgrades?.display || 0)) * 2; }
  function warehouseCapacity() { return Math.round((targetProduction() || 24) * (1.15 + Number(businessState?.upgrades?.warehouse || 0) * 0.25)); }
  function productionIntervalMs() {
    const machines = Math.max(1, owned('ENSAMBLE') + owned('ACABADOS'));
    const workers = Math.max(1, qty('PERS_CORTE') + qty('PERS_ENSAMBLE') + qty('PERS_ACABADO'));
    const expansion = 1 + Number(businessState?.upgrades?.warehouse || 0) * 0.18;
    return Math.max(5000, 14500 / Math.min(2.8, (0.6 + machines * .12 + workers * .08) * expansion));
  }

  function refreshAdminUI() {
    if (!businessState) return;
    const rev=Number(gameSession?.revenue||0),exp=Number(businessState.expenses||0);
    if ($3('adminReputation')) $3('adminReputation').textContent = `Reputación ${Math.round(businessState.reputation)}%`;
    if ($3('adminRevenue')) $3('adminRevenue').textContent = fmt(rev);
    if ($3('adminExpenses')) $3('adminExpenses').textContent = fmt(exp);
    if ($3('adminProfit')) $3('adminProfit').textContent = fmt(rev-exp);
    if ($3('adminRepMetric')) $3('adminRepMetric').textContent = `${Math.round(businessState.reputation)}%`;
    PRODUCTS.forEach(p => { const el=$3(`price-${p.id}-input`); if(el && document.activeElement!==el) el.value=String(p.price); });
    const rows=$3('adminStockRows');
    if(rows && inventory) rows.innerHTML=PRODUCTS.map(p=>`<div><strong>${p.name}</strong><span>Exhibición ${displayStock(p.id)}</span><span>Almacén ${reserveStock(p.id)}</span></div>`).join('');
    if ($3('adminProductionText')) $3('adminProductionText').textContent = `Producidas hoy: ${businessState.production.producedToday} · Capacidad de almacén: ${warehouseCapacity()} · Próxima unidad automática durante el turno.`;
    const log=$3('adminLogList'); if(log) log.innerHTML=(businessState.logs||[]).map(x=>`<div>${x}</div>`).join('') || '<div>Sin actividad todavía.</div>';
    document.querySelectorAll('[data-quality]').forEach(b=>b.classList.toggle('active',b.dataset.quality===perfMode));
    const up=businessState.upgrades||{};
    if($3('upgradeDisplayBtn')) $3('upgradeDisplayBtn').disabled=Number(up.display||0)>=3;
    if($3('upgradeCheckoutBtn')) $3('upgradeCheckoutBtn').disabled=Number(up.checkout||0)>=1;
    if($3('upgradeWarehouseBtn')) $3('upgradeWarehouseBtn').disabled=Number(up.warehouse||0)>=2;
  }

  function openAdmin(page='dashboard') {
    adminOpen=true; running=false; document.exitPointerLock?.();
    refreshAdminUI();
    document.querySelectorAll('[data-admin-tab]').forEach(button=>button.classList.toggle('active',button.dataset.adminTab===page));
    document.querySelectorAll('[data-admin-page]').forEach(section=>section.classList.toggle('active',section.dataset.adminPage===page));
    $3('simAdmin')?.classList.remove('hidden');
  }
  function closeAdmin() {
    adminOpen=false; $3('simAdmin')?.classList.add('hidden'); running=true; clock?.getDelta();
  }

  function activeCycleEvents() {
    const events=worldSnapshot().events;
    return Array.isArray(events)?events:[];
  }

  function renderNewsPanel() {
    const list=$3('simNewsList');if(!list)return;
    list.replaceChildren();
    const events=activeCycleEvents();
    if(!events.length){const empty=document.createElement('div');empty.className='sim-news-item';const p=document.createElement('p');p.textContent='Sin eventos reportados en este ciclo';empty.appendChild(p);list.appendChild(empty);return;}
    events.forEach(event=>{
      const article=document.createElement('article');article.className='sim-news-item';
      const title=document.createElement('strong');title.textContent=String(event.title||'Evento del ciclo');
      const description=document.createElement('p');description.textContent=String(event.description||event.implication||'Sin descripción adicional.');
      const impact=document.createElement('em');impact.textContent=`Impacto: ${String(event.implication||'informativo')} · ${event.scope==='group'?'grupal':'individual'}`;
      article.append(title,description,impact);list.appendChild(article);
    });
  }

  function openNewsPanel() {
    newsOpen=true;running=false;document.exitPointerLock?.();renderNewsPanel();
    if($3('simNewsTitle'))$3('simNewsTitle').textContent=`Eventos del ciclo ${currentRoundSafe()}`;
    $3('simNewsPanel')?.classList.remove('hidden');
  }

  function closeNewsPanel() {
    newsOpen=false;$3('simNewsPanel')?.classList.add('hidden');
    if(!gameSession?.shiftEnded){running=true;clock?.getDelta();}
  }

  function showEvent(title,text) {
    if($3('eventTitle')) $3('eventTitle').textContent=title;
    if($3('eventText')) $3('eventText').textContent=text;
    const el=$3('simEventToast'); el?.classList.remove('hidden'); clearTimeout(showEvent.t); showEvent.t=setTimeout(()=>el?.classList.add('hidden'),5000);
  }

  function spawnReturnCustomer() {
    if(!THREE || !npcGroup || checkoutQueue.length>=queueCapacity()) return;
    const stops=businessInteriors?.browsePoints||[];
    const entering=npcs.filter(n=>!n.dead&&n.state===NPC_STATE.ENTER_STORE).length;
    const reserved=npcs.filter(n=>!n.dead&&n.browsePoint).length;
    if(entering+reserved>=stops.length)return;
    const spawn=findNpcSpawn();if(!spawn)return;
    const archetype=randomArchetype();
    const p=acquireNpcPerson(customerStyle(archetype));
    const spawnX=spawn.x;
    p.position.set(spawnX,.025,spawn.z);
    npcGroup.add(p);
    const prod=PRODUCTS[Math.floor(Math.random()*PRODUCTS.length)];
    const npc=createNpcRecord(p,spawnX,archetype,{isReturn:true,productId:prod.id,productPrice:prod.price});
    attachBagToNpc(npc);
    const entry=hubWorld?.entrances.find(e=>e.id==='store');if(!entry)return;
    setNpcRoute(npc,NPC_STATE.ENTER_STORE,[[entry.portal.x-.65,entry.portal.z+1],[entry.portal.x-.65,entry.portal.z-1.2]]);
    npcs.push(npc); simVisitors++; updateHUD();
  }

  function triggerRandomEvent(now) {
    if(!gameSession || gameSession.shiftEnded || now < nextEventAt) return;
    nextEventAt = now + 42000;
    const active = Array.isArray(worldSnapshot().events) ? worldSnapshot().events : [];
    const pending = active.filter(ev=>!gameSession.shownTeacherEvents.includes(ev.id));
    if(!pending.length) return;
    const ev=pending[0]; gameSession.shownTeacherEvents.push(ev.id);
    const rev=Number(ev.effect?.revenuePct||0), cost=Number(ev.effect?.costPct||0);
    if(rev>0){businessState.rushBoostUntil=now+22000;updateReputation(1)}
    if(rev<0){adjustSatisfaction(-3);nextAutoServeAt+=5}
    if(cost>0)nextProductionAt+=7000;
    if(cost<0)nextProductionAt=Math.max(now+1500,nextProductionAt-3500);
    if(/devoluci|defecto/i.test(`${ev.title} ${ev.description}`) && simSales>0)spawnReturnCustomer();
    showEvent(ev.title, `${ev.implication} · ${ev.scope==='group'?'Evento grupal':'Evento individual'}.`);
    addBusinessLog(`Evento del ciclo: ${ev.title}.`);
  }

  function tickProduction(now) {
    if(!gameSession || gameSession.shiftEnded || now < nextProductionAt) return;
    nextProductionAt = now + productionIntervalMs();
    const plan=productionSnapshot();
    const plannedTotal=Math.max(0,Number(plan?.producibleUnits??targetProduction()));
    const accounted=Math.max(0,Number(inventory?.producedUnits??inventory?.totalTarget??plannedTotal));
    if(accounted>=plannedTotal||totalReserveStock()+totalDisplayStock()>=warehouseCapacity())return;
    let cursor=accounted%Math.max(1,plannedTotal),productIndex=0;
    for(let index=0;index<(plan?.productLines||[]).length;index++){const amount=Math.max(0,Number(plan.productLines[index].plannedUnits||0));if(cursor<amount){productIndex=index;break}cursor-=amount;}
    const p=PRODUCTS[productIndex]||PRODUCTS[businessState.production.producedToday%PRODUCTS.length];
    inventory.reserve[p.id]=(inventory.reserve[p.id]||0)+1;
    if(inventory.producedUnits!=null)inventory.producedUnits=Number(inventory.producedUnits)+1;
    businessState.production.producedToday+=1; businessState.production.stage=(businessState.production.stage+1)%5;
    saveInventory(); saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD();
  }

  function orderSupplierStock() {

    if(businessState.pendingSupplierOrder) { message('Ya existe un pedido en camino.'); return; }
    if(operationalCash()<360) { message('No hay puntos de tienda suficientes para este pedido.'); return; }
    const orderedAt=Date.now(),sequence=Number(businessState.supplierOrderSequence||0)+1;
    const pendingSupplierOrder={id:`${storageContext()}:${sequence}`,orderedAt,
      dueAt:orderedAt+(businessState.supplierDelay?24000:12000),units:12};
    if(!applyExpense(360,'Pedido a proveedor','SIM_GASTOS',{pendingSupplierOrder,supplierOrderSequence:sequence}))return;
    addBusinessLog('Pedido de 12 unidades enviado al proveedor.');
    message(businessState.supplierDelay?'Pedido enviado: llegará con retraso.':'Pedido enviado: mercancía en camino.');
  }

  function tickSupplier(now) {
    const order=businessState?.pendingSupplierOrder;
    if(!order||(Date.now())<order.dueAt)return;
    // Persist the receipt with stock before clearing the order. If interrupted,
    // replay sees the receipt and cannot deliver the same goods twice.
    if(inventory.lastSupplierOrderId!==order.id){
      PRODUCTS.forEach(p=>inventory.reserve[p.id]=(inventory.reserve[p.id]||0)+4);
      inventory.lastSupplierOrderId=order.id;
      saveInventory();
    }
    businessState.pendingSupplierOrder=null;businessState.supplierDelay=false;
    saveInventory(); saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD(); playSfx('restock');
    showEvent('Proveedor entregó mercancía','Llegaron 12 bolsos nuevos al almacén.'); addBusinessLog('Proveedor entregó 12 unidades.');
  }

  function buyUpgrade(type,cost,max) {

    loadBusinessState(); const current=Number(businessState.upgrades[type]||0);
    if(current>=max) { message('Esta mejora ya está al máximo.'); return; }
    if(operationalCash()<cost) { message('No hay puntos de tienda suficientes para esta expansión.'); return; }
    if(!applyExpense(cost,`Expansión: ${type}`,'SIM_INVERSION',{upgrades:{...businessState.upgrades,[type]:current+1}}))return;
    rebuildDynamicWorld(); refreshAdminUI();
    message('Mejora aplicada. La capacidad y el servicio usan la nueva configuración.');
  }

  function setGraphicsQuality(mode) {
    perfMode=mode; businessState.graphics=mode; saveBusinessState();
    const map={low:.72,medium:1.0,high:Math.min(devicePixelRatio,1.35),auto:1.05}; renderScale=map[mode]||1.05;
    renderer?.setPixelRatio(Math.min(devicePixelRatio,renderScale));
    if(renderer&&sunLight){renderer.shadowMap.enabled=mode!=='low';sunLight.castShadow=mode!=='low';renderer.shadowMap.needsUpdate=true;}
    businessInteriors?.setQuality(mode);
    hubWorld?.setQuality(mode);
    if(detailsComplete)void loadCityNpcModels();
    if(detailsComplete&&mode!=='low')void prepareCityNavigator();
    ensureHubCharacters({allowFallback:Boolean(cityRoster)});
    resize(); refreshAdminUI(); message(`Calidad gráfica: ${mode.toUpperCase()}`);
  }

  const TUTORIAL_STEPS=[
    [`Bienvenida a ${companyName()}`,'Haz clic en el mundo para mirar con el mouse. WASD para caminar, Shift para correr y V para cambiar de cámara.'],
    ['Explora la ciudad','Sigue la flecha hasta una entrada y atraviesa la puerta caminando. Para salir, vuelve por la misma puerta. El directorio indica destinos.'],
    ['Atiende la caja','Acércate al POS y presiona E. Escanea el producto y después cobra.'],
    ['Controla el stock','Acércate al almacén y repón los exhibidores. El personal también ayuda automáticamente.'],
    ['Administra la empresa','Busca la computadora de administración. Allí cambias precios, pides stock y amplías la tienda.'],
    ['Cumple los objetivos','Completa misiones, protege la reputación y alcanza la meta de puntos antes de cerrar.']
  ];
  function showTutorialStep() {
    if(businessState?.tutorialDone) return;
    const el=$3('simTutorial3d'); if(!el) return; el.classList.remove('hidden');
    const step=TUTORIAL_STEPS[tutorialIndex]||TUTORIAL_STEPS[0];
    $3('tutorialStepLabel').textContent=`TUTORIAL ${tutorialIndex+1}/${TUTORIAL_STEPS.length}`; $3('tutorialStepTitle').textContent=step[0]; $3('tutorialStepText').textContent=step[1];
    $3('tutorialNextBtn').textContent=tutorialIndex===TUTORIAL_STEPS.length-1?'TERMINAR':'SIGUIENTE';
  }
  function nextTutorial() {
    tutorialIndex++;
    if(tutorialIndex>=TUTORIAL_STEPS.length){businessState.tutorialDone=true;saveBusinessState();$3('simTutorial3d')?.classList.add('hidden');return;}
    showTutorialStep();
  }

  function updateMinimap() {
    const dot=$3('miniPlayer'); if(!dot) return;
    const area=inHub?hubBounds:bounds;
    const nx=Math.max(0,Math.min(1,(player.x-area.minX)/(area.maxX-area.minX)));
    const nz=Math.max(0,Math.min(1,inHub?(player.z-area.minZ)/(area.maxZ-area.minZ):(area.maxZ-player.z)/(area.maxZ-area.minZ)));
    dot.style.left=`${7+nx*86}%`; dot.style.top=`${7+nz*86}%`;
    dot.style.rotate=`${-yaw*180/Math.PI}deg`;
    if(hubVehicles){
      let marker=$3('miniCruiser');
      if(!marker){marker=document.createElement('span');marker.id='miniCruiser';marker.className='mini-cruiser';marker.title='SIDE Cruiser · F para conducir';dot.parentElement.append(marker);}
      marker.hidden=!inHub||Boolean(driving);
      marker.style.left=`${7+(hubVehicles.cruiser.x-hubBounds.minX)/(hubBounds.maxX-hubBounds.minX)*86}%`;
      marker.style.top=`${7+(hubVehicles.cruiser.z-hubBounds.minZ)/(hubBounds.maxZ-hubBounds.minZ)*86}%`;
    }
  }

  function registerAnimatedActor(def) {
    animatedActors.push(def);
    return def;
  }

  function buildStreetLamp(x, z) {
    const g = new THREE.Group();
    g.add(cylinder(0.08, 0.11, 4.6, 0x2f3843, 0, 2.3, 0, 10, 0.55, 0.18));
    const arm = box(0.95, 0.06, 0.06, 0x2f3843, 0.42, 4.3, 0, 0.5, 0.18);
    const lampMat = new THREE.MeshStandardMaterial({color:0xffe6a8,roughness:.22,metalness:.02,emissive:0x6d5422,emissiveIntensity:.8});
    const lightBox = mesh(new THREE.BoxGeometry(0.28,0.14,0.28),lampMat);
    lightBox.position.set(0.83,4.18,0);
    g.add(arm, lightBox);
    g.position.set(x, 0, z);
    return g;
  }

  function buildTree(x, z) {
    const g = new THREE.Group();
    g.add(cylinder(0.13, 0.17, 1.0, 0x6d4a2f, 0, 0.5, 0, 10, 1, 0));
    const leaves1 = mesh(new THREE.SphereGeometry(0.58, 16, 14), mat(0x3b7d48, 0.9, 0.0));
    const leaves2 = mesh(new THREE.SphereGeometry(0.44, 16, 14), mat(0x4d9156, 0.86, 0.0));
    leaves1.position.set(0, 1.45, 0);
    leaves2.position.set(0.16, 1.82, -0.08);
    g.add(leaves1, leaves2);
    g.position.set(x, 0, z);
    return g;
  }

  function buildBench(x, z) {
    const g = new THREE.Group();
    g.add(box(1.6, 0.09, 0.35, 0x6f4e2f, 0, 0.54, 0, 0.55, 0.05));
    g.add(box(1.6, 0.09, 0.18, 0x6f4e2f, 0, 0.94, -0.12, 0.55, 0.05));
    [-0.65, 0.65].forEach((lx) => {
      g.add(box(0.07, 0.55, 0.07, 0x353f49, lx, 0.25, -0.1, 0.52, 0.2));
      g.add(box(0.07, 0.55, 0.07, 0x353f49, lx, 0.25, 0.1, 0.52, 0.2));
    });
    g.position.set(x, 0, z);
    return g;
  }

  function buildCar(x, z, color = 0xb14646, dir = 1) {
    const g = new THREE.Group();
    const body = box(2.45, 0.62, 1.16, color, 0, 0.52, 0, 0.35, 0.22);
    const roof = box(1.28, 0.42, 0.92, 0xd6e8f6, 0.1, 0.94, 0, 0.15, 0.3);
    const bumperF = box(0.18, 0.20, 1.08, 0x20262d, 1.22, 0.34, 0, 0.5, 0.25);
    const bumperB = box(0.18, 0.20, 1.08, 0x20262d, -1.22, 0.34, 0, 0.5, 0.25);
    g.add(body, roof, bumperF, bumperB);
    [[-0.82, -0.52], [0.82, -0.52], [-0.82, 0.52], [0.82, 0.52]].forEach(([wx, wz]) => {
      const wheel = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 18), mat(0x121416, 0.72, 0.2));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.24, wz);
      g.add(wheel);
    });
    g.position.set(x, 0, z);
    g.rotation.y = dir < 0 ? Math.PI : 0;
    return g;
  }

  function buildBuilding(x, z, w, d, h, color = 0x394b64) {
    const g = new THREE.Group();
    const body = box(w, h, d, color, 0, h / 2, 0, 0.94, 0.02);
    g.add(body);
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    const cols = 4, rows = 8;
    for (let r=0;r<rows;r++) for (let col=0;col<cols;col++) {
      const xx=22+col*58, yy=22+r*58;
      ctx.fillStyle = ((r+col)%5===0) ? 'rgba(255,220,150,.78)' : 'rgba(115,195,235,.62)';
      ctx.fillRect(xx,yy,30,38);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
    const facadeMat = new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1,w-.45),Math.max(1,h-.65)),facadeMat);
    facade.position.set(0,h/2,d/2+0.015);
    g.add(facade);
    g.position.set(x, 0, z);
    return g;
  }

  function addCeilingLight(x, z, warm = true, realLight = false) {
    const rail = box(1.15, 0.06, 0.10, 0x1c252e, x, 4.28, z, 0.32, 0.2);
    const fixtureMat = new THREE.MeshStandardMaterial({color:warm?0xffe8c7:0xe4f2ff,roughness:.25,metalness:.05,emissive:warm?0x6b4b22:0x29485d,emissiveIntensity:.7});
    const fixture = mesh(new THREE.CylinderGeometry(0.10,0.12,0.20,10),fixtureMat);
    fixture.position.set(x,4.14,z);
    scene.add(rail, fixture);
    if (realLight) {
      const light = new THREE.SpotLight(warm ? 0xffe1b3 : 0xd9f0ff, warm ? 1.7 : 1.3, 14, Math.PI / 4.8, 0.48, 1.2);
      light.position.set(x, 4.04, z);
      light.target.position.set(x, 0.4, z);
      light.castShadow = false;
      scene.add(light, light.target);
    }
  }

  function buildQueueDecor() {
    queueDecor = [];
    const guideMat = new THREE.MeshStandardMaterial({ color: 0xd7bd72, roughness: 0.7, metalness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const slots = queueSlots.map(slot => [slot.x,slot.z]);
    slots.forEach(([x,z],i) => {
      const ring = mesh(new THREE.RingGeometry(0.28, 0.34, 24), guideMat.clone());
      ring.rotation.x = -Math.PI/2;
      ring.position.set(x, 0.055, z);
      scene.add(ring);
      queueDecor.push({ ring });
    });
    const arrow = mesh(new THREE.PlaneGeometry(0.9,0.18), guideMat.clone());
    arrow.rotation.x = -Math.PI/2;
    arrow.position.set(-7.2,0.056,6.2);
    arrow.rotation.z = -Math.PI/2;
    scene.add(arrow);
    queueDecor.push({ arrow });
  }

  function buildBoutiqueDecor() {
    const decor = new THREE.Group();
    // Wall shelves and warm light strips.
    [-10.4,-7.2,-4.0,-0.8,2.4,5.6].forEach((x,i)=>{
      const shelf = box(2.3,0.10,0.52,0x5d4938,x,1.55,-8.45,0.42,0.08);
      const upper = box(2.3,0.09,0.52,0x5d4938,x,2.55,-8.45,0.42,0.08);
      decor.add(shelf,upper);
      decor.add(handbag(x-0.55,1.64,-8.05,PRODUCTS[i%3].color,0.55,0.08));
      decor.add(handbag(x+0.55,1.64,-8.05,PRODUCTS[(i+1)%3].color,0.55,-0.08));
    });
    // Lounge area.
    const bench = box(3.0,0.42,0.78,0x26384d,5.5,0.35,6.25,0.78,0.02);
    const benchBack = box(3.0,0.78,0.18,0x2e435b,5.5,0.82,6.60,0.78,0.02);
    const tableTop = cylinder(0.58,0.58,0.08,0xc5b9aa,7.4,0.48,6.0,28,0.38,0.05);
    const tableLeg = cylinder(0.10,0.16,0.46,0x2b3138,7.4,0.23,6.0,16,0.5,0.2);
    decor.add(bench,benchBack,tableTop,tableLeg);
    addCollider(3.8,7.0,5.65,6.9);
    addCollider(6.75,8.05,5.35,6.65);
    // Decorative mirror on left wall.
    const mirror = mesh(new THREE.PlaneGeometry(2.3,2.7),new THREE.MeshStandardMaterial({color:0xaed4e7,roughness:0.08,metalness:0.55,side:THREE.DoubleSide}));
    mirror.position.set(-12.82,2.05,1.8); mirror.rotation.y=Math.PI/2; decor.add(mirror);
    const frameTop=box(0.08,0.08,2.5,0xd1b06a,-12.79,3.43,1.8,0.28,0.55); frameTop.rotation.y=Math.PI/2; decor.add(frameTop);

    // Vitrinas frontales: visuales, delgadas y fuera del pasillo central.
    [-10.5,10.5].forEach((x,idx)=>{
      const plinth=box(1.55,0.62,0.72,0xe7e9ea,x,0.31,7.78,0.34,0.02);
      const glass=mesh(new THREE.BoxGeometry(1.65,1.35,0.82),new THREE.MeshPhysicalMaterial({color:0xd9f2ff,roughness:0.05,metalness:0,transparent:true,opacity:0.17,transmission:0.35,thickness:0.04}));
      glass.position.set(x,1.18,7.78);
      const bag=handbag(x,0.77,7.78,PRODUCTS[idx?2:1].color,0.88,idx?-.18:.18);
      decor.add(plinth,glass,bag);
    });
    scene.add(decor);
  }

  function buildStaticWorld() {
    interactables = [];
    colliders = [];
    npcs = [];
    animatedActors = [];
    trafficCars = [];
    crossingPedestrians = [];
    checkoutQueue = [];
    queueDecor = [];
    trafficSignalMeshes = [];
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bc4e5);
    scene.fog = new THREE.Fog(0x9bc4e5, 48, 105);

    camera = new THREE.PerspectiveCamera(58, 1, .08, 300);
    camera.rotation.order = 'YXZ';
    player.x = HUB_OFFSET+16; player.z = 27; player.y = player.baseY; player.vx = player.vz = player.vy = 0;
    yaw = 0; pitch = -.035; targetYaw = yaw; targetPitch = pitch;

    renderer = new THREE.WebGLRenderer({canvas:$3('side3dCanvas'),antialias:perfMode!=='low',powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(devicePixelRatio, renderScale));
    renderer.shadowMap.enabled = perfMode !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    hemiLight = new THREE.HemisphereLight(0xc6deff,0x807363,1.05);
    sunLight = new THREE.DirectionalLight(0xffedcf,2.7);
    sunLight.position.set(18,24,14);
    sunLight.castShadow = perfMode !== 'low';
    sunLight.shadow.mapSize.set(perfMode==='high'?2048:1024,perfMode==='high'?2048:1024);
    Object.assign(sunLight.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:1,far:130});
    sunLight.shadow.camera.updateProjectionMatrix();
    sunLight.shadow.normalBias=.025;sunLight.shadow.bias=-.00015;
    scene.add(hemiLight,sunLight,sunLight.target);

    dynamicGroup=new THREE.Group();npcGroup=new THREE.Group();
    dynamicGroup.name='Business state anchors';npcGroup.name='SIDE store customers';
    scene.add(dynamicGroup,npcGroup);
  }

  // Historical builder retained for compatibility; never called by gameplay.
  function buildRetiredStaticInterior() {
    const addWall = (w,d,x,z) => {
      const wall=box(w,4.7,d,0x263746,x,2.35,z,.8,.04); scene.add(wall);
      addCollider(x-w/2-.05,x+w/2+.05,z-d/2-.05,z+d/2+.05); return wall;
    };
    const addRack = (x,z,w=2.5,color=0x43515c) => {
      const g=new THREE.Group();
      const postMat=mat(0x29343d,.55,.28), shelfMat=mat(color,.65,.08);
      [-w/2,w/2].forEach(px=>{const p=mesh(new THREE.BoxGeometry(.10,2.15,.55),postMat);p.position.set(px,1.08,0);g.add(p)});
      [.25,1.0,1.78].forEach(y=>{const s=mesh(new THREE.BoxGeometry(w+.12,.08,.72),shelfMat);s.position.set(0,y,0);g.add(s)});
      g.position.set(x,0,z);scene.add(g);addCollider(x-w/2-.15,x+w/2+.15,z-.46,z+.46);return g;
    };
    // Panel interior enlazado a los eventos reales del ciclo.
    const newsFrame=box(5.3,2.7,.28,0x172535,8.2,1.9,-11.8,.42,.25);
    const newsGlow=box(4.8,2.22,.04,0x123a58,8.2,1.9,(-11.8)-.17,.22,.08);
    const newsPostL=box(.16,1.6,.16,0x26333e,(8.2)-2.0,.8,-11.8,.55,.25);
    const newsPostR=box(.16,1.6,.16,0x26333e,(8.2)+2.0,.8,-11.8,.55,.25);
    newsPanelMesh=newsGlow;scene.add(newsFrame,newsGlow,newsPostL,newsPostR,addTextLabel('NOTICIAS DEL CICLO',8.2,2.45,(-11.8)-.34,'#ffd329',.58,'rgba(4,14,24,.92)'));
    interactables.push({mesh:newsPanelMesh,type:'news',label:'Leer noticias del ciclo'});

    // Local con tres ambientes físicamente separados.
    scene.add(texturedFloorBox(26,.16,10,'wood',0,-.08,3.9));
    scene.add(texturedFloorBox(16.8,.16,11,'sidewalk',-4.6,-.08,-6.55));
    scene.add(texturedFloorBox(8.8,.16,11,'wood',8.6,-.08,-6.55));
    addWall(26,.28,0,-12.1);addWall(.28,21,-13,-1.6);addWall(.28,21,13,-1.6);
    addWall(11,.25,-7.5,8.9);addWall(11,.25,7.5,8.9);
    addWall(8.7,.24,-8.65,-1.05);addWall(8.9,.24,2.75,-1.05);addWall(3.4,.24,11.3,-1.05);
    addWall(.24,4.7,4,-9.65);addWall(.24,4.0,4,-3.0);
    const ceiling=box(26,.16,21,0xe9edf0,0,4.65,-1.6,.94,0);scene.add(ceiling);

    // Fachada, puerta automática y rótulo comercial.
    const glassMat=mat(0xb9e5ff,.08,0,{transparent:true,opacity:.25});
    const glassL=mesh(new THREE.BoxGeometry(10.7,4.1,.05),glassMat);glassL.position.set(-7.65,2.1,8.78);
    const glassR=mesh(new THREE.BoxGeometry(10.7,4.1,.05),glassMat.clone());glassR.position.set(7.65,2.1,8.78);scene.add(glassL,glassR);
    const doorMat=mat(0xd6efff,.06,0,{transparent:true,opacity:.31});
    entryDoorLeft=mesh(new THREE.BoxGeometry(1.65,3.8,.05),doorMat);entryDoorRight=mesh(new THREE.BoxGeometry(1.65,3.8,.05),doorMat.clone());
    entryDoorLeft.position.set(-.86,1.9,8.82);entryDoorRight.position.set(.86,1.9,8.82);scene.add(entryDoorLeft,entryDoorRight);
    scene.add(box(12,.18,1.6,0x111b25,0,4.2,9.55,.48,.18));
    scene.add(addTextLabel(companyName(),0,4.88,9.2,'#ffd329',1.12,'rgba(3,8,14,.9)'));

    // Tienda: exhibición variable, caja y cola despejada.
    scene.add(addTextLabel('TIENDA',0,3.75,7.75,'#8fd9ff',.64,'rgba(6,20,33,.72)'));
    [[-7.7,1.6],[-3.3,1.9],[1.1,1.55],[5.3,1.9],[9.2,1.55]].forEach(([x,z],i)=>{
      const top=box(2.4,.10,1.0,i%2?0x72543d:0x5f4938,x,.73,z,.48,.08);const base=cylinder(.24,.31,.68,0x25313b,x,.35,z,14,.55,.18);scene.add(top,base);addCollider(x-1.35,x+1.35,z-.65,z+.65);
    });
    const counterBase=box(4.2,1.0,1.18,0x1c2935,-9.2,.5,5.9,.45,.1),counterTop=box(4.35,.08,1.28,0xe7edf2,-9.2,1.04,5.9,.18,.14);
    const scanner=box(.44,.16,.40,0x1d2730,-8.9,1.17,5.65,.18,.32),screen=box(.5,.34,.06,0x071018,-9.55,1.38,5.56,.15,.28);screen.rotation.x=-.35;
    scene.add(counterBase,counterTop,scanner,screen);addCollider(-11.45,-6.95,5.25,6.55);registerMesh=scanner;interactables.push({mesh:scanner,type:'register',label:'Cobrar cliente en caja'});
    buildQueueDecor();
    const terminal=box(.5,.34,.08,0x0b1722,-11.2,1.25,5.6,.16,.22);terminal.rotation.x=-.16;scene.add(terminal);interactables.push({mesh:terminal,type:'decisions',label:'Abrir tablet de decisiones'});
    const adminDesk=box(2.0,.78,.72,0x34414d,10.4,.39,6.4,.52,.08),adminScreen=box(.72,.48,.06,0x0d151e,10.4,1.08,6.14,.14,.25);scene.add(adminDesk,adminScreen);addCollider(9.3,11.5,5.95,6.85);adminMesh=adminScreen;interactables.push({mesh:adminMesh,type:'admin',label:'Abrir administración'});

    // Producción: materias primas, corte, ensamblado, acabado y control.
    scene.add(addTextLabel('PRODUCCIÓN',-4.6,4.0,-1.7,'#ffd36a',.72,'rgba(45,27,5,.78)'));
    addRack(-11.2,-9.6,2.4,0x6d4e35);addRack(-8.2,-9.6,2.4,0x6d4e35);
    scene.add(addTextLabel('MATERIA PRIMA',-9.7,2.75,-9.8,'#ffd36a',.46,'rgba(35,22,8,.78)'));
    scene.add(addTextLabel('CORTE',-8.0,2.55,-4.4,'#fff2c5',.4,'rgba(37,26,12,.70)'));
    scene.add(addTextLabel('ENSAMBLADO',-3.6,2.55,-7.3,'#fff2c5',.4,'rgba(37,26,12,.70)'));
    scene.add(addTextLabel('ACABADO',.9,2.55,-7.3,'#fff2c5',.4,'rgba(37,26,12,.70)'));
    const qcDesk=box(2.6,.78,1.0,0x59636b,.8,.39,-3.3,.48,.08);scene.add(qcDesk);addCollider(-.6,2.2,-3.9,-2.7);scene.add(addTextLabel('CONTROL DE CALIDAD',.8,2.35,-3.3,'#7dffb2',.39,'rgba(6,30,20,.72)'));

    // Almacén: únicamente productos terminados y paso de reposición.
    scene.add(addTextLabel('ALMACÉN',8.6,4.0,-1.7,'#7dffb2',.7,'rgba(5,30,21,.78)'));
    addRack(6.0,-9.7,2.5,0x3f6551);addRack(9.0,-9.7,2.5,0x3f6551);addRack(11.8,-9.7,1.7,0x3f6551);
    addRack(6.1,-4.2,2.5,0x3f6551);addRack(10.0,-4.2,3.1,0x3f6551);
    scene.add(addTextLabel('STOCK TERMINADO',8.6,2.85,-10.1,'#afffc9',.45,'rgba(5,32,20,.72)'));
    restockMesh=box(1.1,1.15,1.0,0x4a6a58,8.4,.58,-1.7,.6,.05);scene.add(restockMesh);interactables.push({mesh:restockMesh,type:'restock',label:'Reponer exhibidores desde almacén'});

    [-10,-5,0,5,10].forEach(x=>addCeilingLight(x,4,true,x===0));
    [-10,-6,-2,2].forEach(x=>addCeilingLight(x,-6.5,false,x===-2));
    [6.2,10.3].forEach(x=>addCeilingLight(x,-6.5,false,false));
    dynamicGroup=new THREE.Group();npcGroup=new THREE.Group();scene.add(dynamicGroup,npcGroup);

  }

  function buildLegacyWorld() {
    interactables = [];
    colliders = [];
    npcs = [];
    animatedActors = animatedActors.filter(a => a.type === 'traffic' || a.type === 'pedestrian');
    checkoutQueue = [];
    queueDecor = [];
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa6c8ea);
    scene.fog = new THREE.Fog(0xa6c8ea, 42, 90);

    camera = new THREE.PerspectiveCamera(74, 1, 0.08, 160);
    camera.rotation.order = 'YXZ';
    yaw = 0;
    pitch = -0.04;

    renderer = new THREE.WebGLRenderer({ canvas: $3('side3dCanvas'), antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, renderScale));
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    hemiLight = new THREE.HemisphereLight(0xd9efff, 0x64707f, 1.95);
    scene.add(hemiLight);
    sunLight = new THREE.DirectionalLight(0xfff1d7, 2.1);
    sunLight.position.set(16, 22, 10);
    sunLight.castShadow = false;
    scene.add(sunLight);

    scene.add(plane(180, 180, 0x95ad7f, 0, -0.02, 18, -Math.PI / 2, 0, 1, 0));
    scene.add(texturedPlane(42, 38, 'road', 0, 0.01, 16, 12, 10));
    scene.add(texturedPlane(42, 4.3, 'sidewalk', 0, 0.02, 10.8, 14, 2));
    scene.add(texturedPlane(42, 4.3, 'sidewalk', 0, 0.02, 21.2, 14, 2));
    scene.add(plane(34, 0.22, 0xf2df7a, 0, 0.03, 16, -Math.PI / 2, 0, 0.4, 0.0));
    for (let i = -14; i <= 14; i += 4) scene.add(plane(2.1, 0.16, 0xfff4cf, i, 0.04, 16, -Math.PI / 2));
    for (let i = -14; i <= 14; i += 4.6) {
      scene.add(plane(1.55, 0.1, 0xffffff, i, 0.04, 12.9, -Math.PI / 2));
      scene.add(plane(1.55, 0.1, 0xffffff, i, 0.04, 19.1, -Math.PI / 2));
    }

    [-16, -8, 0, 8, 16].forEach((x) => { scene.add(buildStreetLamp(x, 10.0)); scene.add(buildStreetLamp(x, 22.1)); });
    [-17.2, -7.6, 7.6, 17.2].forEach((x) => { scene.add(buildTree(x, 23.45)); });
    scene.add(buildBench(-10, 9.1));
    scene.add(buildBench(10.8, 22.9));
    scene.add(buildCar(-8.3, 15.6, 0xb84e4e, 1));
    scene.add(buildCar(7.4, 16.8, 0x446ea2, -1));
    const traffic1 = buildCar(-25, 14.6, 0x8c3cb5, 1);
    const traffic2 = buildCar(25, 17.5, 0x4d9c74, -1);
    scene.add(traffic1, traffic2);
    registerAnimatedActor({ type: 'traffic', obj: traffic1, speed: 3.8, dir: 1, minX: -26, maxX: 26, laneZ: 14.6 });
    registerAnimatedActor({ type: 'traffic', obj: traffic2, speed: 4.1, dir: -1, minX: -26, maxX: 26, laneZ: 17.5 });
    const ped1 = person(0xcc7c5c); ped1.position.set(-16, 0, 9.6); ped1.scale.set(0.9,0.9,0.9); scene.add(ped1);
    const ped2 = person(0x68a1df); ped2.position.set(16, 0, 22.7); ped2.scale.set(0.9,0.9,0.9); scene.add(ped2);
    registerAnimatedActor({ type: 'pedestrian', obj: ped1, speed: 1.0, dir: 1, minX: -16, maxX: 16, baseZ: 9.6, phase: Math.random() * 6.28 });
    registerAnimatedActor({ type: 'pedestrian', obj: ped2, speed: 1.15, dir: -1, minX: -16, maxX: 16, baseZ: 22.7, phase: Math.random() * 6.28 });

    // Ciudad: dejamos una zona de exclusión amplia alrededor de la empresa para que ningún edificio atraviese la tienda.
    const buildingSpecs = [
      [-25, -4, 8, 11, 15, 0x4f5f76], [-25, 8, 8, 9, 12, 0x55616e], [-25, 29, 9, 9, 14, 0x5a6778],
      [25, -4, 8, 11, 14, 0x3f516c], [25, 8, 8, 9, 11, 0x596779], [25, 29, 9, 9, 15, 0x47556a],
      [-13, -25, 10, 10, 14, 0x4b5663], [0, -27, 10, 11, 17, 0x516274], [13, -25, 10, 10, 13, 0x596273],
      [-15, 32, 9, 9, 12, 0x536475], [-5, 33, 8, 9, 10, 0x48586b], [5, 33, 8, 9, 11, 0x556779], [15, 32, 9, 9, 13, 0x4a5c70]
    ];
    buildingSpecs.forEach(([x, z, w, d, h, c]) => scene.add(buildBuilding(x, z, w, d, h, c)));

    const storeFloor = texturedFloorBox(26, 0.16, 18.4, 'wood', 0, -0.08, -0.05);
    scene.add(storeFloor);
    const curb = box(26, 0.24, 0.6, 0xb8bcc3, 0, 0.12, 8.98, 0.8, 0.02);
    scene.add(curb);
    const sidewalkStore = texturedFloorBox(26, 0.1, 4.0, 'sidewalk', 0, 0.05, 10.9);
    scene.add(sidewalkStore);

    const backWall = box(26, 4.8, 0.28, 0x313d4c, 0, 2.4, -9.2, 0.84, 0.04);
    const leftWall = box(0.28, 4.8, 18.4, 0x313d4c, -13.0, 2.4, -0.05, 0.84, 0.04);
    const rightWall = box(0.28, 4.8, 18.4, 0x313d4c, 13.0, 2.4, -0.05, 0.84, 0.04);
    const ceiling = box(26, 0.18, 18.4, 0xf0f1f2, 0, 4.6, -0.05, 0.95, 0.0);
    scene.add(backWall, leftWall, rightWall, ceiling);
    addCollider(-13.35, 13.35, -9.45, -8.95);
    addCollider(-13.35, -12.65, -9.2, 9.05);
    addCollider(12.65, 13.35, -9.2, 9.05);

    const frontLeft = box(8.6, 4.8, 0.24, 0x2d3945, -8.7, 2.4, 9.0, 0.74, 0.08);
    const frontRight = box(8.6, 4.8, 0.24, 0x2d3945, 8.7, 2.4, 9.0, 0.74, 0.08);
    const frontBeam = box(26, 0.28, 0.4, 0x1e2730, 0, 4.62, 9.0, 0.55, 0.1);
    scene.add(frontLeft, frontRight, frontBeam);
    addCollider(-13.2, -4.25, 8.7, 9.25);
    addCollider(4.25, 13.2, 8.7, 9.25);
    const glassMat = mat(0xb8e3ff, 0.08, 0.0, { transparent: true, opacity: 0.28 });
    const glassL = mesh(new THREE.BoxGeometry(8.2, 4.2, 0.05), glassMat); glassL.position.set(-8.7, 2.1, 8.9);
    const glassR = mesh(new THREE.BoxGeometry(8.2, 4.2, 0.05), glassMat); glassR.position.set(8.7, 2.1, 8.9);
    scene.add(glassL, glassR);
    const doorMat = mat(0xc8e8ff, 0.06, 0.0, { transparent: true, opacity: 0.32 });
    entryDoorLeft = mesh(new THREE.BoxGeometry(1.75, 4.0, 0.05), doorMat);
    entryDoorRight = mesh(new THREE.BoxGeometry(1.75, 4.0, 0.05), doorMat);
    entryDoorLeft.position.set(-0.92, 2.0, 8.90);
    entryDoorRight.position.set(0.92, 2.0, 8.90);
    scene.add(entryDoorLeft, entryDoorRight);
    const awning = box(12.2, 0.18, 1.8, 0x111820, 0, 4.18, 9.82, 0.48, 0.12);
    scene.add(awning);
    scene.add(addTextLabel(companyName(), 0, 4.85, 10.05, '#ffd329', 1.28, 'rgba(3,8,14,.88)'));
    scene.add(addTextLabel('BOUTIQUE · TALLER · EXPERIENCIA 3D', 0, 4.12, 8.72, '#7dffb2', 0.72, 'rgba(3,8,14,.78)'));
    scene.add(addTextLabel('PUERTA AUTOMÁTICA', 0, 3.25, 9.28, '#9ed6ff', 0.42, 'rgba(8,21,34,.55)'));

    scene.add(addTextLabel('ÁREA DE VENTAS', 0, 3.15, 8.15, '#f7f8fb', 0.72, 'rgba(31,44,61,.58)'));
    const warehouseHeader = box(12.4, 0.16, 0.36, 0x17222d, 0, 4.08, -4.35, 0.45, 0.08);
    scene.add(warehouseHeader);
    scene.add(addTextLabel('ALMACÉN Y PRODUCCIÓN', 0, 4.48, -4.35, '#7dffb2', 0.68, 'rgba(7,20,16,.72)'));

    const rug = box(10.6, 0.02, 5.6, 0x2f4156, 0, 0.03, 4.2, 0.82, 0.0);
    scene.add(rug);
    [[-4.6, 2.6], [0, 2.1], [4.6, 2.6]].forEach(([x, z], i) => {
      const tableTop = box(3.2, 0.12, 1.28, i === 1 ? 0x77593f : 0x5e4432, x, 0.80, z, 0.46, 0.08);
      const base = cylinder(0.28, 0.36, 0.72, 0x202830, x, 0.38, z, 16, 0.62, 0.15);
      scene.add(tableTop, base);
      scene.add(handbag(x - 0.92, 0.88, z - 0.15, [0xc46b59, 0x6a8ec9, 0xd7b653][i % 3], 0.78, 0.25));
      scene.add(handbag(x, 0.88, z + 0.12, [0x8d5bb8, 0x5d9078, 0xbd8854][i % 3], 0.76, -0.18));
      scene.add(handbag(x + 0.92, 0.88, z - 0.10, [0x57679f, 0xb96c51, 0x6c8db8][i % 3], 0.76, 0.12));
      addCollider(x - 1.75, x + 1.75, z - 0.9, z + 0.9);
    });

    [-10.2, -6.1, -2.0, 2.1, 6.2, 10.3].forEach((x, i) => {
      const side = box(2.5, 1.82, 0.52, 0x5a4636, x, 0.91, -8.4, 0.58, 0.05);
      scene.add(side);
      for (let r = 0; r < 2; r++) scene.add(handbag(x + (r ? 0.34 : -0.34), 0.92 + r * 0.58, -7.98, [0xb95050, 0x456eaa, 0xc59a45][(i + r) % 3], 0.68, r ? -0.16 : 0.18));
      addCollider(x - 1.3, x + 1.3, -8.75, -7.85);
    });

    const stand1 = box(0.42, 1.00, 0.42, 0x28303a, 10.7, 0.50, 3.9, 0.46, 0.05);
    const stand2 = box(0.42, 1.00, 0.42, 0x28303a, 10.1, 0.50, 5.2, 0.46, 0.05);
    scene.add(stand1, stand2);
    scene.add(handbag(10.7, 1.12, 3.9, 0xcaa27f, 0.82, -0.12));
    scene.add(handbag(10.1, 1.12, 5.2, 0xe5dfd3, 0.82, 0.18));

    const counterBase = box(4.8, 0.98, 1.24, 0x20262f, -8.2, 0.49, 6.65, 0.42, 0.08);
    const counterTop = box(4.95, 0.08, 1.30, 0xe8edf2, -8.2, 1.02, 6.65, 0.18, 0.15);
    const sideLedge = box(1.15, 0.04, 0.26, 0xd8dde3, -9.98, 0.88, 6.65, 0.18, 0.1);
    const sideLedge2 = box(1.15, 0.04, 0.26, 0xd8dde3, -6.42, 0.88, 6.65, 0.18, 0.1);
    const scanner = box(0.46, 0.16, 0.42, 0x252d35, -8.12, 1.14, 6.38, 0.18, 0.32);
    const screenStand = box(0.08, 0.22, 0.08, 0x121821, -8.06, 1.30, 6.34, 0.22, 0.25);
    const screen = box(0.42, 0.24, 0.06, 0x0d1117, -8.06, 1.46, 6.28, 0.12, 0.35);
    screen.rotation.x = -0.42;
    const keypad = box(0.30, 0.04, 0.20, 0xeff3f7, -8.52, 1.08, 6.55, 0.14, 0.02);
    const receiptRoll = cylinder(0.07, 0.07, 0.16, 0xf1f3f5, -7.70, 1.08, 6.52, 14, 0.22, 0.0);
    receiptRoll.rotation.z = Math.PI / 2;
    scene.add(counterBase, counterTop, sideLedge, sideLedge2, scanner, screenStand, screen, keypad, receiptRoll);
    addCollider(-10.35, -6.05, 6.34, 7.18);
    registerMesh = scanner;
    interactables.push({ mesh: registerMesh, type: 'register', label: 'Cobrar cliente en caja' });

    const terminal = box(0.48, 0.34, 0.08, 0x111924, -10.65, 1.22, 6.55, 0.16, 0.22);
    terminal.rotation.x = -0.16;
    scene.add(terminal);
    interactables.push({ mesh: terminal, type: 'decisions', label: 'Abrir terminal de decisiones' });

    restockMesh = box(1.42, 1.20, 1.12, 0x4d5d55, 10.4, 0.60, -7.25, 0.62, 0.05);
    scene.add(restockMesh);
    interactables.push({ mesh: restockMesh, type: 'restock', label: 'Reponer exhibidores desde almacén' });

    const adminDesk = box(2.1, 0.78, 0.72, 0x34414d, 9.5, 0.39, -2.6, 0.52, 0.08);
    const adminScreen = box(0.72, 0.48, 0.06, 0x0d151e, 9.5, 1.10, -2.87, 0.14, 0.25);
    const adminStand = box(0.08, 0.35, 0.08, 0x1a222b, 9.5, 0.83, -2.78, 0.28, 0.2);
    scene.add(adminDesk, adminScreen, adminStand);
    adminMesh = adminScreen;
    interactables.push({ mesh: adminMesh, type: 'admin', label: 'Abrir administración' });

    const welcome = box(0.08, 0.08, 0.08, 0x00ff88, 0, 0.04, 10.2, 0.3, 0);
    welcome.visible = false;
    scene.add(welcome);

    scene.add(plane(9.8, 4.2, 0xd8efff, -8.7, 2.15, 8.82, 0, 0, 0.05, 0.02));
    scene.add(plane(9.8, 4.2, 0xd8efff, 8.7, 2.15, 8.82, 0, 0, 0.05, 0.02));

    const prodFloor = texturedFloorBox(25.4, 0.06, 8.2, 'sidewalk', 0, 0.03, -5.9);
    scene.add(prodFloor);
    const warehouseStrip = box(25.6, 0.18, 0.28, 0x1d2a35, 0, 0.09, -4.25, 0.6, 0.04);
    scene.add(warehouseStrip);

    buildBoutiqueDecor();
    buildQueueDecor();
    [-9.2,-5.6,-2.0,2.0,5.6,9.2].forEach((x) => addCeilingLight(x, 5.2, true, false));
    [-9.2,-5.6,-2.0,2.0,5.6,9.2].forEach((x) => addCeilingLight(x, -5.8, false, false));
    [-7.5,0,7.5].forEach((x) => addCeilingLight(x, 1.0, true, false));
    addCeilingLight(-6.0, 3.8, true, true);
    addCeilingLight(0.0, 3.3, true, true);
    addCeilingLight(6.0, 3.8, true, true);
    addCeilingLight(0.0, -6.0, false, true);

    dynamicGroup = new THREE.Group();
    npcGroup = new THREE.Group();
    scene.add(dynamicGroup, npcGroup);
  }

  function clearGroup(group) {
    while (group.children.length) {
      const child = group.children[0];
      group.remove(child);
      child.traverse?.((c) => {
        if(c.userData?.cityClipController){c.userData.cityClipController.dispose();c.userData.cityMixer?.uncacheRoot?.(c.userData.cityAvatar)}
        if(c.userData?.animationController)c.userData.animationController.dispose();
        else if (c.userData?.mixer) { c.userData.mixer.stopAllAction(); c.userData.mixer.uncacheRoot(c.userData.modelAvatar); }
        if (c.isSkinnedMesh) c.skeleton?.dispose?.();
        if (c.userData?.sharedCharacterResource){if(c.userData.cityTintedMaterial){const materials=Array.isArray(c.material)?c.material:[c.material];materials.forEach(material=>material?.dispose?.())}return;}
        c.userData?.ownedTexture?.dispose?.();
        c.geometry?.dispose?.();
        if (c.material) Array.isArray(c.material) ? c.material.forEach(m => m.dispose?.()) : c.material.dispose?.();
      });
    }
  }

  function makeMachine(x, z, type = 'assembly', tier = 1) {
    const g = new THREE.Group();
    const palette = tier === 3 ? [0x315f72, 0xe4b638] : tier === 2 ? [0x4d5963, 0x79b2c6] : [0x666d72, 0xc9d0d6];
    const base = box(type === 'assembly' ? 1.16 : 1.0, 0.82, 0.84, palette[0], 0, 0.41, 0, 0.42, 0.24);
    const top = box(0.75, 0.15, 0.55, 0x1a2025, 0, 0.94, 0, 0.18, 0.25);
    g.add(base, top);
    if (type === 'assembly') {
      const arm = box(0.12, 0.82, 0.12, palette[1], 0.32, 1.22, 0, 0.34, 0.4);
      const arm2 = box(0.44, 0.08, 0.08, palette[1], 0.48, 1.58, 0, 0.34, 0.4);
      g.add(arm, arm2);
      g.userData.anim = { type: 'machineArm', arm, phase: Math.random() * 6.28 };
    } else {
      const wheel = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 20), mat(0x202327, 0.7, 0.2));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0.22, 1.10, 0);
      g.add(wheel);
      g.userData.anim = { type: 'machineWheel', wheel, phase: Math.random() * 6.28 };
    }
    g.position.set(x, 0, z);
    return g;
  }

  function addWorkers(count, color, startX, startZ, role = 'worker') {
    for (let i = 0; i < Math.min(count, 8); i++) {
      const p = person({cityRole:startX<0?'almacen':'produccion',cityScene:'business',shirt:color,pants:0x2b3440,formal:false,gender:i%3===0?'female':'male'});
      p.position.set(startX + (i % 4) * 1.28, 0, startZ + Math.floor(i / 4) * 1.56);
      p.rotation.y = Math.PI;
      dynamicGroup.add(p);
      registerAnimatedActor({ type: role, obj: p, baseY: 0, phase: Math.random() * 6.28, speed: 1.8 + Math.random() * 0.7 });
    }
  }

  // A read-only projection of the existing business model. Geometry owns no money,
  // inventory, delivery clock or production calculation.
  function businessVisualSnapshot() {
    const plan=productionSnapshot(),display=totalDisplayStock(),reserve=totalReserveStock();
    const shelfCapacity=PRODUCTS.length*displayCapacity(),capacity=warehouseCapacity();
    const plannedTotal=Math.max(0,Number(plan?.producibleUnits??targetProduction()));
    const accounted=Math.max(0,Number(inventory?.producedUnits??inventory?.totalTarget??plannedTotal));
    return {displayStock:display,reserveStock:reserve,displayCapacity:shelfCapacity,warehouseCapacity:capacity,
      storeFill:Math.min(1,display/Math.max(1,shelfCapacity)),warehouseFill:Math.min(1,reserve/Math.max(1,capacity)),
      pendingUnits:businessState?.pendingSupplierOrder?.units||0,
      productionActive:running&&!gameSession?.shiftEnded&&accounted<plannedTotal&&display+reserve<capacity,
      producedUnits:inventory?.producedUnits??null,plannedUnits:plan?.producibleUnits??0,productionPlan:plan,
      profit:null,cash:operationalCash(),round:currentRoundSafe(),debt:null,loan:null,
      machines:{cutting:owned('MESA_CORTE'),assembly:owned('ENSAMBLE'),finishing:owned('ACABADOS')},
      workers:{cutting:qty('PERS_CORTE'),assembly:qty('PERS_ENSAMBLE'),finishing:qty('PERS_ACABADO')},
      products:PRODUCTS.map(p=>({id:p.id,color:p.color,display:displayStock(p.id),reserve:reserveStock(p.id)}))};
  }

  function syncWorldDecisions(snapshot = businessVisualSnapshot()) {
    if (!deriveWorldDecisionState) return null;
    const round=currentRoundSafe();
    let previous=null;
    try{previous=JSON.parse(localStorage.getItem(worldHistoryKey(round-1))||'null');}catch{}
    worldDecisionState = deriveWorldDecisionState({
      round, decisions: worldSnapshot().storeLevel.visual || {}, visual: snapshot, previous,
      events: activeCycleEvents(), cycleClosed: Boolean(gameSession?.shiftEnded),
      decisionProgress: 0
    });
    worldEventVisuals?.update(worldDecisionState.events, perfMode);
    lastWorldSnapshot={round,cash:worldDecisionState.cues.cash,displayStock:worldDecisionState.cues.displayStock,
      reserveStock:worldDecisionState.cues.reserveStock,producedUnits:worldDecisionState.cues.producedUnits};
    return worldDecisionState;
  }

  function worldHistoryKey(round){return `side3d_fun_world_history_${companyStorageContext()}_${round}`;}
  function cacheWorldHistory(snapshot){
    if(!snapshot||snapshot.round<1)return;
    try{localStorage.setItem(worldHistoryKey(snapshot.round),JSON.stringify(snapshot));}catch{}
  }

  function renderInventoryDisplays() {
    const snapshot = businessVisualSnapshot();
    businessInteriors?.sync(snapshot);
    syncWorldDecisions(snapshot);
  }

  function rebuildDynamicWorld() {
    if(!businessInteriors)return;
    loadInventory();renderInventoryDisplays();updateHUD();
  }

  function renderRetiredInventoryDisplays() {
    if (!dynamicGroup || !THREE) return;
    interactables = interactables.filter(it => it.type !== 'product');
    productInteractables = [];
    if (inventoryDisplayGroup) {
      dynamicGroup.remove(inventoryDisplayGroup);
      inventoryDisplayGroup.traverse?.(o => { o.geometry?.dispose?.(); if (o.material) Array.isArray(o.material) ? o.material.forEach(m=>m.dispose?.()) : o.material.dispose?.(); });
    }
    inventoryDisplayGroup = new THREE.Group();
    const locations = [
      { x: -7.7, z: 1.6 }, { x: -3.3, z: 1.9 }, { x: 1.1, z: 1.55 }
    ];
    PRODUCTS.forEach((product, i) => {
      const loc = locations[i];
      const shelf = box(2.25, 0.10, 0.74, 0x4b4239, loc.x, 0.80, loc.z, 0.46, 0.08);
      const leg1 = box(0.10, 0.72, 0.10, 0x232a32, loc.x - 0.86, 0.39, loc.z, 0.52, 0.12);
      const leg2 = box(0.10, 0.72, 0.10, 0x232a32, loc.x + 0.86, 0.39, loc.z, 0.52, 0.12);
      inventoryDisplayGroup.add(shelf, leg1, leg2);
      const pi = { mesh: shelf, type: 'product', productId: product.id, label: product.name };
      productInteractables.push(pi); interactables.push(pi);
      const count = Math.min(displayCapacity(), displayStock(product.id));
      for (let n = 0; n < count; n++) inventoryDisplayGroup.add(handbag(loc.x - 0.72 + n * 0.48, 0.88, loc.z, product.color, 0.54, 0.05));
    });
    const reserveTotal = totalReserveStock();
    for (let i = 0; i < Math.min(24, reserveTotal); i++) {
      const px = 5.2 + (i % 6) * 1.18;
      const pz = -8.0 + Math.floor(i / 6) * 0.62;
      inventoryDisplayGroup.add(box(0.50, 0.34, 0.46, 0x8a6748, px, 0.17, pz, 0.78, 0.02));
    }
    dynamicGroup.add(inventoryDisplayGroup);
  }

  function buildSalesStaff() {
    const staff = Math.min(perfMode==='low'?3:6, salesStaff());
    for (let i=0;i<staff;i++) {
      const look = STAFF_LOOKS[i % STAFF_LOOKS.length];
      const p = person({...look,cityRole:'tienda',cityScene:'business'});
      p.position.set(3.8 + (i%3) * 2.2, 0, 4.75 - Math.floor(i/3)*1.1);
      dynamicGroup.add(p);
      registerAnimatedActor({ type: 'salesperson', obj: p, baseY: 0, baseX: p.position.x, baseZ: p.position.z, phase: Math.random()*6.28, speed: 1.7 + i*0.15, state:'disponible' });
    }
  }

  function buildMonaNpc() {
    const config = CONFIG.NPCS?.mona;
    if (!config) return;
    const mona = person({gender:'female',cityRole:'tienda',cityScene:'business',forceProcedural:true,bodyScale:.96});
    mona.position.set(config.position.x, 0, config.position.z);
    mona.name = config.name;
    mona.userData.npcId = 'mona';
    mona.userData.role = 'guide';
    dynamicGroup.add(mona);
    npcNames.setNpcName(mona,config.name,config.height);
    const collider={npcId:'mona',minX:config.position.x-.28,maxX:config.position.x+.28,minZ:config.position.z-.24,maxZ:config.position.z+.24};
    dynamicColliders.push(collider);
    registerAnimatedActor({type:'guide',obj:mona,collider,patrol:[[-3,10.7],[-5.2,10.7],[-5.2,12.5],[-3,12.5]],patrolIndex:1,pause:3,speed:.72});
    interactables.push({mesh:mona, type:'mona', label:`Hablar con ${config.name}`});
  }

  function talkToMona() {
    const guide=animatedActors.find(a=>a.type==='guide');if(guide)guide.pause=7;
    const advice = checkoutQueue.length
      ? `Hay ${checkoutQueue.length} cliente(s) esperando. Acércate a la caja para cobrar.`
      : totalDisplayStock() === 0 && totalReserveStock() > 0
        ? 'Los exhibidores están vacíos. Repón los bolsos desde el almacén.'
        : totalDisplayStock() + totalReserveStock() === 0
          ? 'No quedan bolsos. Revisa tu producción y el abastecimiento en Administración.'
          : 'Bienvenido. Revisa los bolsos en los exhibidores y atiende a los clientes en caja.';
    message(`${GUIDE_NAME}: ${advice}`, 6500);
  }

  function rebuildRetiredDynamicWorld() {
    if (!dynamicGroup) return;
    clearGroup(dynamicGroup);
    interactables = interactables.filter(it => it.type !== 'mona');
    animatedActors = animatedActors.filter(a => a.type === 'traffic' || a.type === 'pedestrian' || a.type === 'visitor');
    checkoutQueue = [];
    npcs.forEach(recycleNpcPerson);
    npcs = [];
    dynamicColliders=[];
    buildMonaNpc();
    clearGroup(npcGroup);
    loadInventory();

    const tables = owned('MESA_CORTE');
    for (let i = 0; i < Math.min(Math.max(2, tables), 5); i++) {const x=-10.2+(i%2)*3.0,z=-5.1+Math.floor(i/2)*1.55;dynamicGroup.add(box(2.15,.76,1.02,0x64513f,x,.38,z,.46,.07));addDynamicCollider(x-1.16,x+1.16,z-.58,z+.58);}

    const assEntry = saved('ENSAMBLE');
    let ass = [];
    Object.values(assEntry?.purchases || {}).forEach(row => Object.entries(row || {}).forEach(([k, v]) => { for (let i = 0; i < Number(v || 0); i++) ass.push(k); }));
    ass.slice(0, 6).forEach((k, i) => {
      const m = makeMachine(-4.2 + (i % 2) * 2.1, -8.0 + Math.floor(i / 2) * 1.75, 'assembly', k.includes('ind') ? 3 : k.includes('semi') ? 2 : 1);
      dynamicGroup.add(m);
      addDynamicCollider(m.position.x-.68,m.position.x+.68,m.position.z-.55,m.position.z+.55);
      if (m.userData.anim) registerAnimatedActor({ ...m.userData.anim });
    });

    const finEntry = saved('ACABADOS');
    let fins = [];
    Object.values(finEntry?.purchases || {}).forEach(row => Object.entries(row || {}).forEach(([k, v]) => { for (let i = 0; i < Number(v || 0); i++) fins.push(k); }));
    fins.slice(0, 6).forEach((k, i) => {
      const m = makeMachine(1.0 + (i % 2) * 1.55, -8.0 + Math.floor(i / 2) * 1.75, 'finish', k.includes('ind') ? 3 : k.includes('semi') ? 2 : 1);
      dynamicGroup.add(m);
      addDynamicCollider(m.position.x-.62,m.position.x+.62,m.position.z-.52,m.position.z+.52);
      if (m.userData.anim) registerAnimatedActor({ ...m.userData.anim });
    });

    if (saved('MOLDE')?.label) {
      const moldTier = optSelected('MOLDE', 'molde_3') ? 3 : optSelected('MOLDE', 'molde_2') ? 2 : 1;
      dynamicGroup.add(box(1.10, 0.18, 0.74, moldTier === 3 ? 0xd0a83e : moldTier === 2 ? 0x7f92a6 : 0x8b6a4b, -9.7, 1.06, -3.7, 0.38, 0.4));
    }

    const plan=productionSnapshot();
    const materialTotal = qty('CUERO') + qty('ACCESORIOS') + qty('HILO');
    for (let i = 0; i < Math.min(24, Math.max(6, Math.ceil(materialTotal / 8))); i++) dynamicGroup.add(box(0.52, 0.42, 0.52, i%3===0?0x6e4c32:i%3===1?0xb58b4f:0x3e6074, -11.7 + (i % 4) * .72, .21, -10.1 + Math.floor(i / 4) * .54, .8, .04));
    if(Array.isArray(plan?.materials)){
      const labels=plan.materials.map(material=>`${material.label}: ${Number(material.available||0).toLocaleString('es-PE')} ${material.unit}`);
      labels.forEach((label,index)=>dynamicGroup.add(addTextLabel(label,-9.7,2.25-index*.42,-8.75,'#fff0ba',.29,'rgba(28,20,9,.82)')));
    }

    addWorkers(qty('PERS_CORTE'), 0xf3f4f5, -10.6, -4.3, 'worker');
    addWorkers(qty('PERS_ENSAMBLE'), 0x8dc7ef, -4.5, -6.2, 'worker');
    addWorkers(qty('PERS_ACABADO'), 0xf0bf68, .7, -6.1, 'worker');

    const processUnits=Math.max(0,Number(plan?.producibleUnits||0));
    for(let i=0;i<Math.min(6,Math.ceil(processUnits/12));i++)dynamicGroup.add(box(.72,.055,.46,0x8b5c3c,-1.8+(i%3)*.82,.10,-4.75+Math.floor(i/3)*.55,.62,.02));
    (plan?.productLines||[]).forEach((line,index)=>{if(Number(line.plannedUnits||0)>0)dynamicGroup.add(handbag(2.65,.12,-5.65+index*.72,PRODUCTS[index]?.color||0xb98a58,.48,Math.PI/2));});

    if (optSelected('JEFATURA', 'si_jefatura')) {
      const boss = person({shirt:0xf2f2ef,pants:0x1f2e42,formal:true,tie:0x315fa4,gender:'male',hair:0x70513a}); boss.scale.set(1.04, 1.04, 1.04); boss.position.set(2.4, 0, -2.2); dynamicGroup.add(boss);
      registerAnimatedActor({ type: 'manager', obj: boss, baseY: 0, phase: Math.random() * 6.28, speed: 1.45 });
    }

    const target = Math.min(24, Math.ceil(Number(plan?.producibleUnits ?? targetProduction()) / 5));
    for (let i = 0; i < target; i++) dynamicGroup.add(box(0.62, 0.38, 0.50, 0x9b6f43, 4.9 + (i % 6) * 1.18, 0.19, -6.1 + Math.floor(i / 6) * 0.56, 0.78, 0.02));

    const ups=businessState?.upgrades||{};
    for(let i=0;i<Number(ups.display||0);i++){
      const x=5.2+i*3.9;
      dynamicGroup.add(box(2.8,0.10,0.68,0x4b4239,x,0.78,1.95,0.45,0.08));
      dynamicGroup.add(handbag(x-0.55,0.86,1.95,PRODUCTS[i%3].color,0.54,0.04));
      dynamicGroup.add(handbag(x+0.15,0.86,1.95,PRODUCTS[(i+1)%3].color,0.54,-0.04));
      dynamicGroup.add(handbag(x+0.60,0.86,1.95,PRODUCTS[(i+2)%3].color,0.54,0.02));
    }
    if(Number(ups.checkout||0)>0){
      const reg2=box(1.4,0.78,0.72,0x252e38,-11.0,0.39,4.6,0.42,0.08);
      const scr2=box(0.38,0.25,0.05,0x0b1118,-11.0,0.96,4.32,0.15,0.25); scr2.rotation.x=-0.35;
      dynamicGroup.add(reg2,scr2); secondRegisterMesh=reg2;
      addDynamicCollider(-11.78,-10.22,4.18,5.02);
    } else secondRegisterMesh=null;
    if(Number(ups.warehouse||0)>0){
      for(let i=0;i<8*Number(ups.warehouse);i++) dynamicGroup.add(box(0.48,0.34,0.44,0x7a5d45,5.2+(i%6)*1.15,0.17,-2.8-Math.floor(i/6)*0.48,0.8,0.02));
    }

    buildSalesStaff();
    renderInventoryDisplays();
    updateHUD();
  }

  function npcDemandScore() {
    const channels = saved('CANALES')?.optionIds || [];
    let s = channels.includes('web') ? 0.6 : 0;
    s += channels.includes('los_olivos') ? 1.0 : 0;
    s += channels.includes('miraflores') ? 1.25 : 0;
    s += channels.includes('sjl') ? 1.1 : 0;
    s += optSelected('INV_MARKETING', 'mkt_baja') ? 0.2 : optSelected('INV_MARKETING', 'mkt_media') ? 0.55 : optSelected('INV_MARKETING', 'mkt_alta') ? 0.95 : 0;
    return Math.max(0.35, s);
  }

  function salesStaff() {
    return Math.max(1,Number(worldSnapshot().storeLevel.stores)||1); // One salesperson per physical store, including legacy decisions.
  }

  function queueCapacity() { return queueSlots.length; }

  // Decisions within the same turn preserve customer flow; a new turn/cycle
  // clears it so an old reservation cannot be charged to a different ledger.
  function clearCustomerFlow(restoreReservations=false) {
    let restored=false;
    for(const customer of npcs){
      if(restoreReservations&&inventory&&!customer.isReturn&&customer.productId&&[NPC_STATE.TAKE_PRODUCT,NPC_STATE.WALK_TO_CHECKOUT,NPC_STATE.QUEUE].includes(customer.state)){
        const productId=customer.productId;
        if(displayStock(productId)<displayCapacity())inventory.display[productId]=displayStock(productId)+1;
        else inventory.reserve[productId]=reserveStock(productId)+1;
        restored=true;
      }
      recycleNpcPerson(customer);
    }
    if(restored)saveInventory();
    npcs=[];checkoutQueue=[];crossingPedestrians=[];
    lastSpawn=-Infinity;
  }

  function createNpcRecord(obj, spawnX, archetype, extra = {}) {
    const npc = {
      obj,
      spawnX,
      route: [],
      routeIndex: 0,
      state: NPC_STATE.SPAWN,
      phase: NPC_STATE.SPAWN,
      wait: 0,
      buy: false,
      speed: (0.95 + Math.random() * 0.35) * archetype.speed,
      walkCycle: Math.random() * 6.28,
      queueIndex: -1,
      queueWait: 0,
      dead: false,
      archetype,
      patienceLimit: archetype.patience + customerPatienceBoost() + (hasManager() ? 1 : 0),
      crossing: false,
      leavingWorld: false,
      animationAccumulator: 0,
      ...extra
    };
    return npc;
  }

  function setNpcState(npc, state) {
    npc.state = state;
    npc.phase = state;
  }

  function setNpcRoute(npc, state, points = []) {
    setNpcState(npc, state);
    const requested=points.map(point=>[Number(point[0]),Number(point[1])]);
    npc.requestedPoints=requested;
    if(navReady&&requested.length){
      const route=[];let from={x:npc.obj.position.x,z:npc.obj.position.z};
      requested.forEach(point=>{
        const segment=computeSafePath(from,{x:point[0],z:point[1]},[point]);
        segment.forEach((node,index)=>{if(index===0&&Math.hypot(node[0]-from.x,node[1]-from.z)<.2)return;route.push(node);});
        from={x:point[0],z:point[1]};
      });
      npc.route=route.length?route:requested;
    } else npc.route=requested;
    if(npcNavigation&&npc.route.length) {
      const safe=[];let from={x:npc.obj.position.x,z:npc.obj.position.z};
      for(const point of npc.route) {
        const room=businessInteriors?.rooms.find(room=>room.id===businessInteriors.zoneAt(from)&&room.id===businessInteriors.zoneAt({x:point[0],z:point[1]}));
        const segment=room?businessInteriors.interiorNavigation.plan(room,from,{x:point[0],z:point[1]},perfMode):npcNavigation.planPath(from,{x:point[0],z:point[1]},npcObstacles());
        if(!segment.length){safe.length=0;break}
        safe.push(...segment);const last=segment[segment.length-1];from={x:last[0],z:last[1]};
      }
      npc.route=safe;
    }
    npc.routeBlocked=Boolean(requested.length&&!npc.route.length);
    npc.routeIndex = 0;
    npc.wait = 0;
  }

  function leaveStore(npc) {
    npc.browsePoint = null;
    npc.leavingWorld = true;
    const entry=hubWorld.entrances.find(e=>e.id==='store');
    setNpcRoute(npc,NPC_STATE.LEAVE_STORE,[[entry.portal.x+.65,entry.portal.z-1.3],[entry.portal.x+.65,entry.portal.z+1.4],[entry.portal.x+.65,entry.portal.z+3.2]]);
  }

  function releaseCrossing(npc) {
    npc.crossing = false;
    const index = crossingPedestrians.indexOf(npc);
    if (index >= 0) crossingPedestrians.splice(index,1);
  }

  function evaluateCustomerDecision(npc, assisted = false) {
    const product = chooseProductForCustomer(npc.archetype);
    if (!product) {
      markLostCustomer('stock');
      message('Un cliente se retiró porque no encontró stock en exhibición.');
      leaveStore(npc);
      return;
    }
    const archetype = npc.archetype || CUSTOMER_ARCHETYPES[1];
    const overBudget = Math.max(0,(product.price - archetype.budget) / Math.max(1,archetype.budget));
    if (overBudget > 0 && Math.random() < Math.min(.95,.28 + overBudget * archetype.priceSensitivity * 2.4)) {
      markLostCustomer('price');
      message('Un cliente se retiró porque el precio excedía su presupuesto.');
      leaveStore(npc);
      return;
    }
    if (!assisted && Math.random() < archetype.helpProbability) {
      if (salesStaff() <= 0) {
        markLostCustomer('staff');
        message('Un cliente se retiró porque no encontró personal de ventas.');
        leaveStore(npc);
        return;
      }
      const interiorSellers=businessInteriors?.rooms.find(room=>room.id==='store')?.actors.filter(actor=>actor.object.userData.role==='salesperson')||[];
      const sellers=[...animatedActors.filter(actor=>actor.type==='salesperson'),...interiorSellers];
      const seller=sellers[Math.floor(Math.random()*Math.max(1,sellers.length))];
      const assistant=businessInteriors?.salesAssistantPoint||businessInteriors?.browsePoints?.[0];
      const sellerObject=seller?.obj||seller?.object;
      const sellerPosition=sellerObject?.getWorldPosition(new THREE.Vector3());
      const sx=assistant?.x ?? sellerPosition?.x ?? HUB_OFFSET-19, sz=assistant?.z ?? sellerPosition?.z ?? 19;
      npc.assignedSeller=seller||null;
      if (seller) seller.state='desplazándose';
      setNpcRoute(npc,NPC_STATE.SEEK_SALES_ASSISTANT,[[sx,sz]]);
      return;
    }
    const marketingBoost=optSelected('INV_MARKETING','mkt_alta') ? .18 : optSelected('INV_MARKETING','mkt_media') ? .10 : 0;
    const reputationBoost=((businessState?.reputation||80)-70)/120;
    const serviceBoost=assisted ? .16 : Math.min(.12,salesStaff()*.035);
    const pricePenalty=Math.max(0,(product.price-archetype.budget)/Math.max(1,archetype.budget))*archetype.priceSensitivity;
    const qualityFit=product.id===archetype.pref ? .13 : (product.id==='premium'&&archetype.qualityDemand>.8 ? .08 : 0);
    const probability=Math.max(.18,Math.min(.96,.43+marketingBoost+reputationBoost+serviceBoost+qualityFit-pricePenalty));
    if (Math.random() > probability) {
      markLostCustomer('price');
      leaveStore(npc);
      return;
    }
    if (!reserveProductForNpc(npc,product)) {
      markLostCustomer('stock');
      leaveStore(npc);
      return;
    }
    attachBagToNpc(npc);
    setNpcRoute(npc,NPC_STATE.TAKE_PRODUCT,[[npc.obj.position.x,npc.obj.position.z]]);
    npc.wait=.55;
  }

  function reflowQueue() {
    checkoutQueue = checkoutQueue.filter(n => !n.dead);
    checkoutQueue.forEach((n, i) => {
      n.queueIndex = i;
      setNpcRoute(n,NPC_STATE.WALK_TO_CHECKOUT,[[queueSlots[i].x,queueSlots[i].z]]);
    });
    updateHUD();
  }

  function removeFromQueue(n) {
    const idx = checkoutQueue.indexOf(n);
    if (idx >= 0) {
      checkoutQueue.splice(idx, 1);
      reflowQueue();
    }
  }

  function tryJoinQueue(n) {
    if (checkoutQueue.length >= queueCapacity()) return false;
    n.queueIndex = checkoutQueue.length;
    n.browsePoint=null;
    setNpcRoute(n,NPC_STATE.WALK_TO_CHECKOUT,[[queueSlots[n.queueIndex].x,queueSlots[n.queueIndex].z]]);
    checkoutQueue.push(n);
    updateHUD();
    return true;
  }

  function findNpcSpawn() {
    const entry=hubWorld?.entrances.find(e=>e.id==='store');if(!entry)return null;
    // Fill the separated sidewalk lanes first; a random center slot could block both.
    const options=[entry.portal.x-.55,entry.portal.x+.55,entry.portal.x];
    for(const z of [entry.portal.z+3.2,entry.portal.z+4.2])for(const x of options) {
      if(Math.hypot(player.x-x,player.z-z)<.85)continue;
      if(npcs.every(n=>n.dead||Math.hypot(n.obj.position.x-x,n.obj.position.z-z)>.85))return {x,z};
    }
    return null;
  }

  function spawnNpc(now) {
    const score = npcDemandScore();
    const dayBoost = gameSession?.difficulty || 1;
    const rush = businessState?.rushBoostUntil > now ? 1.65 : 1;
    const interval = Math.max(1500, 8200 / (score * dayBoost * rush));
    const preset=PERF[perfMode]||PERF.auto||{maxCustomers:8};
    if (now - lastSpawn < interval || npcs.length >= Number(preset.maxCustomers||8)) return;
    const stops=businessInteriors?.browsePoints||[];
    const entering=npcs.filter(n=>!n.dead&&n.state===NPC_STATE.ENTER_STORE).length;
    const reserved=npcs.filter(n=>!n.dead&&n.browsePoint).length;
    if(entering+reserved>=stops.length)return;
    const spawn=findNpcSpawn();if(!spawn)return;
    lastSpawn = now;
    const archetype = randomArchetype();
    const p = acquireNpcPerson(customerStyle(archetype));
    const spawnX = spawn.x;
    p.position.set(spawnX,.025,spawn.z);
    npcGroup.add(p);
    const npc=createNpcRecord(p,spawnX,archetype);
    const entry=hubWorld.entrances.find(e=>e.id==='store');
    setNpcRoute(npc,NPC_STATE.ENTER_STORE,[[entry.portal.x-.65,entry.portal.z+1],[entry.portal.x-.65,entry.portal.z-1.2]]);
    npcs.push(npc);
    simVisitors++;
    updateHUD();
  }

  function recordSale(productId, price) {

    const product = productById(productId);
    const salePrice = Math.max(0, Number(price || product.price));
    const nextInventory=inventory?{...inventory,sold:{...inventory.sold,[product.id]:Number(inventory.sold?.[product.id]||0)+1}}:null;
    const writes={[salesCountKey()]:String(simSales+1),...(nextInventory?{[inventoryKey()]:JSON.stringify(nextInventory)}:{})};
    for(const [key,value] of Object.entries(writes))localStorage.setItem(key,value);
    businessState.revenue=Number(businessState.revenue||0)+salePrice;saveBusinessState();
    window.SIDE_WORLD_BRIDGE?.emitFunSale({context:storageContext(),productId:product.id,points:salePrice});
    simSales++;if(nextInventory)inventory=nextInventory;
    try{
    if (gameSession) {
      gameSession.revenue += salePrice;
      gameSession.served += 1;
      gameSession.combo = Number(gameSession.combo || 0) + 1;
      gameSession.bestCombo = Math.max(gameSession.bestCombo || 0, gameSession.combo);
      adjustSatisfaction(1.2 + Math.min(1, gameSession.combo * 0.08));
    }
    updateHUD();
    showCashFx(`+ ${fmt(salePrice)}`);
    playSfx('sale');
    updateReputation(0.35);
    if (simSales % 3 === 0) addBusinessLog(`Venta: ${product.name} por ${fmt(salePrice)}.`);
    if (simSales % 5 === 0) message(`¡${simSales} clientes atendidos! La tienda está agarrando ritmo.`);
    }catch(error){console.error('SIDE: venta confirmada; feedback pendiente',error);}
    return true;
  }

  function openCheckout() {
    const npc = checkoutQueue[0];
    if (!npc) { message('No hay clientes en la cola de caja.'); return; }
    if(npc.state!==NPC_STATE.QUEUE){message('El cliente se está acercando a la caja.');return;}
    checkoutOpen = true;
    checkoutScanned = false;
    checkoutPayment = 'cash';
    document.exitPointerLock?.();
    const product = productById(npc.productId);
    $3('checkoutCustomer').textContent = npc.archetype?.label || 'Cliente';
    $3('checkoutProduct').textContent = product.name;
    $3('checkoutPrice').textContent = fmt(npc.productPrice);
    $3('checkoutStatus').textContent = npc.isReturn ? 'DEVOLUCIÓN · Escanea el producto para reembolsar' : 'Producto pendiente de escaneo';
    $3('checkoutScanBtn').disabled = false;
    $3('checkoutChargeBtn').disabled = true;
    $3('checkoutChargeBtn').textContent = npc.isReturn ? `REEMBOLSAR ${fmt(npc.productPrice)}` : `COBRAR ${fmt(npc.productPrice)}`;
    $3('payCashBtn')?.classList.add('active'); $3('payCardBtn')?.classList.remove('active');
    $3('simCheckout')?.classList.remove('hidden');
  }

  function closeCheckout(resume = true) {
    checkoutOpen = false;
    checkoutScanned = false;
    $3('simCheckout')?.classList.add('hidden');
    if (resume && running) setTimeout(requestPointerLockSafely,60);
  }

  // Pointer lock is rejected when a modal closes outside a user gesture. The
  // rejection is harmless, but an unhandled Promise becomes a browser error
  // and makes the world regression look like a gameplay failure.
  function requestPointerLockSafely() {
    try {
      const request=$3('side3dCanvas')?.requestPointerLock?.();
      request?.catch?.(()=>{});
    } catch { /* browsers may reject pointer lock synchronously */ }
  }

  function scanCheckoutProduct() {
    if (!checkoutOpen || !checkoutQueue.length) return;
    checkoutScanned = true;
    $3('checkoutStatus').textContent = 'Producto escaneado correctamente';
    $3('checkoutScanBtn').disabled = true;
    $3('checkoutChargeBtn').disabled = false;
    playTone(980,.06,'square',.022,0); playTone(1200,.04,'square',.016,.05);
  }

  function confirmCheckout() {
    if (!checkoutOpen || !checkoutScanned) return;
    if(!serveNextQueuedCustomer(false))return;
    closeCheckout(false);
    setTimeout(requestPointerLockSafely,80);
  }

  function serveNextQueuedCustomer(autoServed = false) {

    if (!checkoutQueue.length) {
      message('No hay clientes en la cola de caja.');
      return;
    }
    if(checkoutQueue[0].state!==NPC_STATE.QUEUE){if(!autoServed)message('El cliente se está acercando a la caja.');return;}
    const npc = checkoutQueue[0];
    const product = productById(npc.productId);
    if(npc.isReturn){
      const refund=Number(npc.productPrice||product.price);
      const nextInventory={...inventory,reserve:{...inventory.reserve,[product.id]:Number(inventory.reserve[product.id]||0)+1}};
      const nextBusiness={...businessState,returns:Number(businessState.returns||0)+1,expenses:Number(businessState.expenses||0)+refund};
      inventory=nextInventory;businessState=nextBusiness;
      saveInventory();saveBusinessState();renderInventoryDisplays();
      updateReputation(-2,'Devolución procesada'); showCashFx(`− ${fmt(refund)}`); playSfx('lost');
      message(`Reembolso procesado: ${product.name} · ${fmt(refund)}.`);
      addBusinessLog(`Devolución de ${product.name}: −${fmt(refund)}.`);
    } else {
      if(!recordSale(npc.productId, npc.productPrice))return false;
      const who = autoServed ? 'Tu equipo atendió' : 'Cobraste';
      message(`${who}: ${product.name} por ${fmt(npc.productPrice)} · ${checkoutPayment==='card'?'tarjeta':'efectivo'}.`);
    }
    checkoutQueue.shift();
    attachBagToNpc(npc);showReceipt(npc);
    if(npc.obj.userData.orderLabel){npc.obj.remove(npc.obj.userData.orderLabel);npc.obj.userData.orderLabel=null;}
    setNpcState(npc,NPC_STATE.PAY);npc.route=[];npc.wait=.55;
    reflowQueue();return true;
  }

  function prepareNpcNextStep(n) {
    if (n.routeIndex < n.route.length-1) { n.routeIndex++; return; }
    if(n.state===NPC_STATE.WALK_TO_STORE){setNpcState(n,NPC_STATE.WAIT_CROSSWALK);n.route=[];return;}
    if(n.state===NPC_STATE.CROSS_STREET){
      releaseCrossing(n);
      const entry=hubWorld?.entrances.find(e=>e.id==='store');
      if(!entry){recycleNpcPerson(n);n.dead=true;return;}
      if(n.leavingWorld)leaveStore(n);
      else setNpcRoute(n,NPC_STATE.ENTER_STORE,[[entry.portal.x-.65,entry.portal.z+1],[entry.portal.x-.65,entry.portal.z-1.2]]);
      return;
    }
    if(n.state===NPC_STATE.ENTER_STORE){
      if(n.isReturn){ if(!tryJoinQueue(n)){leaveStore(n);markLostCustomer('queue');} return; }
      // Reserve a display stop until the decision phase ends.
      const available=(businessInteriors?.browsePoints||[]).filter(p=>!npcs.some(other=>other!==n&&!other.dead&&other.browsePoint===p));
      const point=available.find(p=>worldPeople(n.obj).every(person=>Math.hypot(person.x-p.x,person.z-p.z)>1))||available[0];
      if(!point){leaveStore(n);return;}
      n.browsePoint=point;
      const points=[[point.x,point.z]];
      setNpcRoute(n,NPC_STATE.BROWSE,points);return;
    }
    if(n.state===NPC_STATE.BROWSE){setNpcState(n,NPC_STATE.COMPARE);n.route=[];n.wait=1.2+Math.random()*1.2;return;}
    if(n.state===NPC_STATE.SEEK_SALES_ASSISTANT){setNpcState(n,NPC_STATE.WAIT_FOR_ASSISTANCE);n.route=[];n.wait=Math.max(.8,2.8-salesStaff()*.25);if(n.assignedSeller)n.assignedSeller.state='asesorando';return;}
    if(n.state===NPC_STATE.TAKE_PRODUCT){
      if(!tryJoinQueue(n)){
        if(n.productId&&inventory){inventory.display[n.productId]=Math.min(displayCapacity(),displayStock(n.productId)+1);saveInventory();renderInventoryDisplays();}
        markLostCustomer('queue');leaveStore(n);message('Un cliente devolvió el bolso porque la cola estaba completa.');
      }
      return;
    }
    if(n.state===NPC_STATE.WALK_TO_CHECKOUT){setNpcState(n,NPC_STATE.QUEUE);n.route=[];n.queueWait=0;return;}
    if(n.state===NPC_STATE.LEAVE_STORE){recycleNpcPerson(n);n.dead=true;return;}
    if(n.state===NPC_STATE.DESPAWN){recycleNpcPerson(n);n.dead=true;}
  }

  function moveNpc(n, dt) {
    if (n.dead) return;
    if(!n.route.length||n.wait>0||n.state===NPC_STATE.WAIT_CROSSWALK||n.state===NPC_STATE.QUEUE)if(n.locomotion)n.locomotion.speed=0;
    if(n.state===NPC_STATE.WAIT_CROSSWALK){
      setPersonPose(n.obj,n.walkCycle+=dt*2,false,dt);
      if(trafficLight==='pedestrians'){
        n.crossing=true;if(!crossingPedestrians.includes(n))crossingPedestrians.push(n);
        const entry=hubWorld?.entrances.find(e=>e.id==='store');
        if(!entry)return;
        setNpcRoute(n,NPC_STATE.CROSS_STREET,[[entry.portal.x,entry.portal.z+(n.leavingWorld?3.2:1)]]);
      }
      return;
    }
    if (n.state === NPC_STATE.QUEUE) {
      n.queueWait = (n.queueWait || 0) + dt;
      if (n.queueWait > (n.patienceLimit || 16)) {
        removeFromQueue(n);
        if (n.productId && inventory && !n.isReturn) {
          inventory.display[n.productId] = Math.min(displayCapacity(), Number(inventory.display[n.productId] || 0) + 1);
          saveInventory();
          renderInventoryDisplays();
        }
        removeNpcBag(n.obj);
        if (n.obj.userData.orderLabel) { n.obj.remove(n.obj.userData.orderLabel); n.obj.userData.orderLabel = null; }
        leaveStore(n);
        markLostCustomer('queue');
        updateHUD();
        message('Un cliente abandonó la cola por demora y devolvió el producto.');
      }
      setPersonPose(n.obj, n.walkCycle += dt * 2.2, false,dt);
      return;
    }
    if (n.wait > 0) {
      n.wait -= dt;
      if (n.state === NPC_STATE.COMPARE) n.obj.rotation.y += Math.sin(n.walkCycle) * 0.004;
      setPersonPose(n.obj, n.walkCycle += dt * 2.4, false,dt);
      if(n.wait<=0&&n.state===NPC_STATE.COMPARE)evaluateCustomerDecision(n,false);
      else if(n.wait<=0&&n.state===NPC_STATE.WAIT_FOR_ASSISTANCE){if(n.assignedSeller)n.assignedSeller.state='disponible';evaluateCustomerDecision(n,true);}
      else if(n.wait<=0&&n.state===NPC_STATE.TAKE_PRODUCT)prepareNpcNextStep(n);
      else if(n.wait<=0&&n.state===NPC_STATE.PAY)leaveStore(n);
      return;
    }
    const target = n.route[n.routeIndex];
    if (!target) {
      setPersonPose(n.obj,n.walkCycle,false,dt);
      if(n.routeBlocked){n.pathRetry=(n.pathRetry||0)+dt;if(n.pathRetry>.8){n.pathRetry=0;setNpcRoute(n,n.state,n.requestedPoints)}}
      return;
    }
    const state=n.locomotion || (n.locomotion={speed:0});
    Object.assign(state,{x:n.obj.position.x,z:n.obj.position.z,yaw:n.obj.rotation.y});
    const neighbors=npcNeighbors(n.obj);
    const interiorRoom=businessInteriors?.rooms.find(room=>room.id===businessInteriors.zoneAt(state));
    const result=interiorRoom?businessInteriors.interiorNavigation.advance(interiorRoom,state,{x:target[0],z:target[1]},dt,neighbors,n.speed,perfMode,n.routeIndex===n.route.length-1):npcNavigation.advance(state,{x:target[0],z:target[1]},dt,npcObstacles(),neighbors,n.speed,n.routeIndex===n.route.length-1);
    n.obj.position.set(state.x,.025,state.z);n.obj.rotation.y=state.yaw;
    n.walkCycle+=result.distance*6.5;
    setPersonPose(n.obj,n.walkCycle,result.distance>.00001,dt);
    if(result.arrived)prepareNpcNextStep(n);
    // Recover around a stationary crowd, without teleporting or walking through it.
    n.blockedFor=result.distance<.0001?(n.blockedFor||0)+dt:0;
    if(n.blockedFor>1.6){
      const people=neighbors.map(p=>({minX:p.x-.27,maxX:p.x+.27,minZ:p.z-.27,maxZ:p.z+.27}));
      const detour=npcNavigation.planPath(state,{x:target[0],z:target[1]},[...npcObstacles(),...people],.29);
      if(detour.length){n.route.splice(n.routeIndex,1,...detour)}
      n.blockedFor=0;
    }
  }

  function updateTrafficSignals() {
    const vehiclesGo=trafficLight==='vehicles',pedestriansGo=trafficLight==='pedestrians';
    trafficSignalMeshes.forEach(signal=>{
      if(!signal?.red?.material)return;
      signal.red.material.color.setHex(vehiclesGo?0x4c1111:0xff3d31);signal.red.material.emissive.setHex(vehiclesGo?0x220000:0xff180d);signal.red.material.emissiveIntensity=vehiclesGo ? .18 : 1.8;
      signal.green.material.color.setHex(vehiclesGo?0x2de177:0x123b25);signal.green.material.emissive.setHex(vehiclesGo?0x0fdc63:0x002a10);signal.green.material.emissiveIntensity=vehiclesGo?1.8:.18;
      signal.pedRed.material.color.setHex(pedestriansGo?0x4c1111:0xff3d31);signal.pedRed.material.emissive.setHex(pedestriansGo?0x220000:0xff180d);signal.pedRed.material.emissiveIntensity=pedestriansGo ? .18 : 1.8;
      signal.pedGreen.material.color.setHex(pedestriansGo?0x2de177:0x123b25);signal.pedGreen.material.emissive.setHex(pedestriansGo?0x0fdc63:0x002a10);signal.pedGreen.material.emissiveIntensity=pedestriansGo?1.8:.18;
    });
  }

  function updateTraffic(dt) {
    trafficPhase=(trafficPhase+dt)%24;
    const nextLight=trafficPhase<10?'vehicles':trafficPhase<12?'clearance':trafficPhase<20?'pedestrians':'clearance';
    if(nextLight!==trafficLight){trafficLight=nextLight;updateTrafficSignals();}
    const crossingBusy=crossingPedestrians.some(n=>!n.dead&&n.crossing);
    trafficCars.forEach(car=>{
      const x=car.obj.position.x,stopX=car.dir>0?-3.4:3.4;
      const distanceToStop=car.dir>0?stopX-x:x-stopX;
      const approaching=distanceToStop>=-.2&&distanceToStop<8;
      let mustStop=(trafficLight!=='vehicles'||crossingBusy)&&approaching;
      for(const other of trafficCars){
        if(other===car||other.laneZ!==car.laneZ||other.dir!==car.dir)continue;
        const gap=(other.obj.position.x-x)*car.dir;
        if(gap>0&&gap<3.4)mustStop=true;
      }
      const targetSpeed=mustStop?0:car.speed;
      car.currentSpeed=Number(car.currentSpeed??car.speed);
      car.currentSpeed+=(targetSpeed-car.currentSpeed)*Math.min(1,dt*(mustStop?5.5:2.4));
      if(mustStop&&car.currentSpeed<.08){car.currentSpeed=0;car.state=crossingBusy?'cediendo el paso':'detenido';}
      else if(mustStop)car.state='desacelerando';
      else if(car.currentSpeed<car.speed*.82)car.state='reanudando marcha';
      else car.state='circulando';
      car.obj.position.x+=car.currentSpeed*car.dir*dt;
      if(car.dir>0&&car.obj.position.x>car.maxX)car.obj.position.x=car.minX;
      if(car.dir<0&&car.obj.position.x<car.minX)car.obj.position.x=car.maxX;
    });
  }

  function buildAmbientNpcs() {
    const routes=[
      [[-8,11.4],[-6.6,11.4],[-6.6,12.8],[-9.5,12.8],[-9.5,11.4]],
      [[4.2,11.0],[7,11.0],[7,12.6],[4.2,12.6]],
      [[10.5,12.5],[12.2,12.5],[12.2,10.9],[9,10.9],[9,12.5]]
    ];
    routes.forEach((route,i)=>{
      const obj=person({cityRole:'cliente',cityScene:'outdoor',gender:i%2?'female':'male'});obj.userData.role='pedestrian';
      obj.position.set(route[0][0],.025,route[0][1]);scene.add(obj);
      registerAnimatedActor({type:'visitor',obj,patrol:route,patrolIndex:1,pause:i*.6,speed:.82+i*.06});
    });
  }

  function npcNeighbors(obj) {
    const neighbors=worldPeople(obj);
    if(!driving)neighbors.push({x:player.x,z:player.z,radius:player.radius});
    neighbors.push(...(hubVehicles?.navigationNeighbors?.()||[]));
    return neighbors;
  }

  function npcObstacles() {return hubWorld?.colliders||businessInteriors?.colliders||[];}

  function animatePatrol(actor,dt) {
    const obj=actor.obj;
    if(obj.userData.role==='guide'&&inHub)return;
    const nearPlayer=Math.hypot(player.x-obj.position.x,player.z-obj.position.z)<(actor.type==='guide'?2.05:.85);
    if(!running||nearPlayer||actor.pause>0) {
      if(actor.pause>0)actor.pause=Math.max(0,actor.pause-dt);
      if(actor.locomotion)actor.locomotion.speed=0;
      setPersonPose(obj,0,false,dt);return;
    }
    const blocks=[...colliders,...dynamicColliders.filter(c=>c!==actor.collider)];
    if(!actor.route?.length){
      const goal=actor.patrol[actor.patrolIndex];
      actor.route=npcNavigation.planPath(obj.position,{x:goal[0],z:goal[1]},blocks);
    }
    const target=actor.route?.[0];
    if(!target){setPersonPose(obj,0,false,dt);return}
    const state=actor.locomotion||(actor.locomotion={speed:0});
    Object.assign(state,{x:obj.position.x,z:obj.position.z,yaw:obj.rotation.y});
    const result=npcNavigation.advance(state,{x:target[0],z:target[1]},dt,blocks,npcNeighbors(obj),actor.speed);
    obj.position.set(state.x,.025,state.z);obj.rotation.y=state.yaw;
    if(actor.collider)Object.assign(actor.collider,{minX:state.x-.28,maxX:state.x+.28,minZ:state.z-.24,maxZ:state.z+.24});
    setPersonPose(obj,0,result.distance>.00001,dt);
    if(result.arrived){actor.route.shift();if(!actor.route.length){actor.patrolIndex=(actor.patrolIndex+1)%actor.patrol.length;actor.pause=actor.type==='guide'?2:1.2}}
  }

  function animateActors(time,dt=.016) {
    animatedActors.forEach((a) => {
      if(a.type==='guide'||a.type==='visitor') {
        animatePatrol(a,dt);
      } else if (a.type === 'worker' || a.type === 'cashier' || a.type === 'manager' || a.type === 'analyst' || a.type === 'salesperson') {
        groundPerson(a.obj);
        if (a.type === 'salesperson') {
          a.obj.rotation.y = Math.PI + Math.sin(time * .4 + a.phase) * .08;
          setPersonPose(a.obj, time + a.phase, false,dt);
        } else {
          setPersonPose(a.obj, time * (a.type === 'cashier' ? 3.0 : 2.2) + a.phase, false);
        }
        if (a.type === 'cashier') a.obj.rotation.y = Math.PI + Math.sin(time * 0.8 + a.phase) * 0.1;
      } else if (a.type === 'machineArm') {
        a.arm.rotation.z = Math.sin(time * 2.8 + a.phase) * 0.45;
      } else if (a.type === 'machineWheel') {
        a.wheel.rotation.x += dt*3.6;
      } else if (a.type === 'pedestrian') {
        a.obj.position.x += a.speed * a.dir * dt;
        if (a.dir > 0 && a.obj.position.x > a.maxX) a.obj.position.x = a.minX;
        if (a.dir < 0 && a.obj.position.x < a.minX) a.obj.position.x = a.maxX;
        a.obj.position.z = a.baseZ + Math.sin(time * 0.6 + a.phase) * 0.02;
        a.obj.rotation.y = a.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        setPersonPose(a.obj, time * 4.0 + a.phase, true);
      }
    });
    updateTraffic(dt);
    // Visual idle frames (help/results/decisions) must never create transactions.
    if (!running || !gameSession || gameSession.shiftEnded) return;
    if (salesStaff() > 0 && time - lastAutoRestock > Math.max(10, 22 - salesStaff() * 3)) {
      lastAutoRestock = time;
      restockDisplays(false);
    }
    if ((salesStaff() > 1 || Number(businessState?.upgrades?.checkout||0)>0) && checkoutQueue[0]?.state===NPC_STATE.QUEUE && time > nextAutoServeAt) {
      const checkoutBoost=Number(businessState?.upgrades?.checkout||0)>0?4:0;
      nextAutoServeAt = time + Math.max(4.5, 15 - salesStaff() * 1.5 - checkoutBoost);
      serveNextQueuedCustomer(true);
    }
    if (hasManager() && gameSession && !gameSession.shiftEnded && time > nextManagerBoostAt) {
      nextManagerBoostAt = time + 18;
      adjustSatisfaction(1.5);
    }
  }

  function updateEntryDoors(dt) {
    if (!entryDoorLeft || !entryDoorRight) return;
    let open = !gameSession?.shiftEnded && Math.abs(player.x) < 2.6 && player.z > 6.4 && player.z < 12.4;
    if (!open) open = npcs.some(n => !n.dead && n.obj && Math.abs(n.obj.position.x) < 2.6 && n.obj.position.z > 6.4 && n.obj.position.z < 12.4);
    const target = open ? 1 : 0;
    entryDoorProgress += (target - entryDoorProgress) * (1 - Math.exp(-6 * dt));
    entryDoorLeft.position.x = -0.92 - entryDoorProgress * 0.82;
    entryDoorRight.position.x = 0.92 + entryDoorProgress * 0.82;
  }

  // One scene, one coordinate system. Crossing a door changes only the HUD zone.
  const HUB_CHARACTER_ROUTES=[
    [[8,9],[30,9],[30,29],[8,29]],[[8,29],[8,9],[30,9],[30,29]],
    [[7,-9],[29,-9],[29,-7],[7,-7]],
    [[34,13],[57,13],[57,26],[34,26]],
    [[-42,-26],[-65,-26],[-65,-11],[-42,-11]]
  ];
  const hubNpcLimit=()=>perfMode==='low'?2:perfMode==='high'?5:4;

  function ensureHubCharacters({allowFallback=false}={}) {
    if(!scene||!hubWorld||!npcNames)return;
    let guide=animatedActors.find(actor=>actor.type==='guide');
    if(!guide&&allowFallback){
      const object=person({gender:'female',cityRole:'tienda',cityScene:'hub',forceProcedural:true,bodyScale:.96});
      object.name=GUIDE_NAME;Object.assign(object.userData,{role:'guide'});npcNames.setNpcName(object,GUIDE_NAME,object.userData.characterGeometry.height/object.scale.y);
      const patrol=[[14,26],[24.5,26],[24.5,13.5],[14,13.5]].map(([x,z])=>[HUB_OFFSET+x,z]);
      const actor={type:'guide',obj:object,phase:0,patrol,pause:0,speed:.85,state:{speed:0}};
      actor.patrolController=createNpcPatrol({points:patrol,navigator:cityNavigator,obstacles:hubWorld.colliders,bounds:hubBounds,maxSpeed:actor.speed});
      const spawn=actor.patrolController.spawn(patrol[0]);
      if(spawn){
        object.position.set(spawn.x,.025,spawn.z);scene.add(object);groundPerson(object);
        animatedActors.push(actor);
        interactables.push({mesh:object,type:'guide',label:`Hablar con ${GUIDE_NAME}`,x:spawn.x,z:spawn.z});
      }else clearGroup(object);
    }
    hubActors.forEach(actor=>{actor.obj.visible=Number(actor.obj.userData.cityHubIndex)<hubNpcLimit();});
    Array.from({length:hubNpcLimit()},(_,index)=>index).forEach(index=>{
      if(hubActors.some(actor=>actor.obj.userData.cityHubIndex===index)||!allowFallback)return;
      const object=person({cityRole:'cliente',cityScene:'hub',gender:index%2?'female':'male',shirt:[0x3979b8,0x9b4968,0x4f8d62,0xc38d45,0x795f9c][index]});
      object.getObjectByName('NpcNameLabel')?.removeFromParent();
      Object.assign(object.userData,{role:'hub-pedestrian',cityHubIndex:index});
      const source=hubWorld.patrolRoutes?.[index]||HUB_CHARACTER_ROUTES[index].map(([x,z])=>[x+HUB_OFFSET,z]);
      const patrol=source.map(point=>Array.isArray(point)?point:[point.x,point.z]);
      const actor={obj:object,patrol,speed:.9+index*.07,state:{speed:0}};
      actor.patrolController=createNpcPatrol({points:patrol,navigator:cityNavigator,obstacles:hubWorld.colliders,bounds:hubBounds,maxSpeed:actor.speed});
      const spawn=actor.patrolController.spawn(patrol[0]);
      if(!spawn){clearGroup(object);return;}
      object.position.set(spawn.x,.025,spawn.z);scene.add(object);groundPerson(object);
      hubActors.push(actor);
    });
  }

  function createPlayableCharacter(id) {
    characterManager?.select(id,{persist:false});
    let object=characterManager?.create(id,{role:'player',factory:(template,kind)=>kind==='mona'
      ? monaModule.createMonaNpc(THREE,template,CONFIG.NPCS.mona)
      : npcMotion.createNpc(template,kind)});
    if(!object)object=person({execModel:id,bodyScale:1},'player');
    normalizePerson(object,'player');
    attachProceduralController(object);
    object.name='PlayerAvatar';Object.assign(object.userData,{modelKind:'player',characterId:id,characterRole:'player',displayName:CONFIG.NPCS[id]?.name||id});
    object.getObjectByName('NpcNameLabel')?.removeFromParent();return object;
  }

  async function buildPlayableHub() {
    ({createNpcPatrol}=await import('../services/npc_patrol.mjs'));
    ({deriveWorldDecisionState}=await import('../services/world_decision_state.mjs?v=20261023-world-fun'));
    const {createWorldEventVisuals}=await import('../services/world_event_visuals.mjs');
    worldEventVisuals=createWorldEventVisuals({THREE,scene,offsetX:HUB_OFFSET});
    const {createHubWorld,CITY_MAP}=await import('../services/hub_world.js?v=20261023-pedestrian-district');
    cityMap=CITY_MAP;
    hubWorld=createHubWorld({scene,offsetX:HUB_OFFSET});
    const [orientationModule,{createWorldMinimapControl},{createWorldWayfinding}]=await Promise.all([
      import('../services/world_orientation.mjs'),import('../services/world_minimap_control.mjs'),import('../services/world_wayfinding.mjs')
    ]);
    closestCityZone=orientationModule.closestCityZone;
    worldOrientation=orientationModule.createWorldOrientation({THREE,root:$3(rootId),zones:CITY_MAP.zones,bounds:CITY_MAP.bounds,offsetX:HUB_OFFSET,
      onNavigate:(id,zone)=>enterHubInterior(id,zone)});
    worldMinimapControl=createWorldMinimapControl({root:$3(rootId)});
    worldWayfinding=createWorldWayfinding({THREE,root:$3(rootId),zones:CITY_MAP.zones,offsetX:HUB_OFFSET});
    hubWorld.installOutdoorProps(outdoorPropTemplates,perfMode);
    const {createBusinessInteriors}=await import('../services/business_interiors.mjs?v=20261023-world-fun');
    businessInteriors=createBusinessInteriors({scene,offsetX:HUB_OFFSET,
      createNpc:createBusinessNpc,getNeighbors:npcNeighbors,onCollidersAdded:items=>{if(businessInteriors)hubWorld.colliders.push(...items);},
      animateNpc:(obj,dt,moving)=>setPersonPose(obj,0,moving,dt)});
    businessInteriors.installStoreProps(storePropTemplates,perfMode);
    businessInteriors.installWarehouseProps(warehousePropTemplates,perfMode);
    businessInteriors.installProductionProps(productionPropTemplates,perfMode);
    businessWorld=businessInteriors.group;
    hubWorld.colliders.push(...businessInteriors.colliders);
    hubWorld.entrances.splice(0,hubWorld.entrances.length,...businessInteriors.entrances);
    queueSlots.splice(0,queueSlots.length,...(businessInteriors.queueSlots||businessInteriors.checkoutQueueSlots||[]));
    // Translate environmental stations to the existing business actions.
    // No station keeps a second ledger or an independent inventory.
    interactables=(businessInteriors.interactionPoints||businessInteriors.hotspots||[]).map(point=>({
      ...point,type:({finance:'register',inventory:'restock',supplier:'admin',production:'admin'})[point.type]||point.type,
      adminPage:point.type==='supplier'||point.type==='inventory'?'stock':point.type==='production'?'dashboard':undefined
    }));
    interactables.push(
      {x:HUB_OFFSET+19,z:30.1,type:'news',label:'Leer noticias del ciclo'}
    );
    productInteractables=interactables.filter(point=>point.type==='product');
    const {deriveObjective}=await import('../services/gameplay_objectives.mjs');
    hubWorld.deriveObjective=deriveObjective;
    playerMotion=await import('../services/player_motion.mjs');
    const {createHubVehicles}=await import('../services/hub_vehicles.js?v=20260927-continuous-world');
    hubVehicles=createHubVehicles(hubWorld,HUB_OFFSET);
    scene.environment=studioEnvironment;scene.environmentIntensity=.3;
    // A continuous sky gradient, rendered as geometry; no background photograph.
    const sky=new THREE.Mesh(new THREE.SphereGeometry(260,24,12),new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,
      uniforms:{top:{value:new THREE.Color(0x596fbd)},horizon:{value:new THREE.Color(0xffbd94)}},
      vertexShader:'varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 top;uniform vec3 horizon;varying vec3 vDirection;void main(){float h=pow(max(normalize(vDirection).y,0.0),0.55);gl_FragColor=vec4(mix(horizon,top,h),1.0);}'
    }));
    sky.name='ProceduralSky';sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);
    hubWorld.sky=sky;
    ensureHubCharacters({allowFallback:true});
    playerAvatar=createPlayableCharacter(activeCharacterId());scene.add(playerAvatar);
    enterHub(false);
  }

  function refreshHubUI() {
    const root=$3(rootId);root?.classList.toggle('in-hub',inHub);root?.classList.toggle('third-person',cameraMode==='third');
    $3('simMinimap')?.classList.toggle('hub-map',inHub);
    const label={store:'TIENDA',warehouse:'ALMACÉN',production:'PRODUCCIÓN',office:'OFICINA',bank:'BANCO',suppliers:'PROVEEDORES'}[currentInterior]||'PLAZA SIDE';
    root?.setAttribute('data-world-zone',currentInterior||'city');
    if($3('simWorldLocation'))$3('simWorldLocation').textContent=`${label} · ${DISTRICTS[selectedDistrict]}`;
    if($3('sim3dCameraBtn')){$3('sim3dCameraBtn').textContent=cameraMode==='third'?'CÁMARA · 3.ª':'CÁMARA · 1.ª';$3('sim3dCameraBtn').setAttribute('aria-pressed',String(cameraMode==='third'));}
    document.querySelectorAll('[data-hub-district]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.hubDistrict===selectedDistrict)));
    if($3('simHubSelected'))$3('simHubSelected').textContent=`Destino: ${DISTRICTS[selectedDistrict]}`;
    updateHubObjective();
    updateMinimap();
  }

  function updateHubObjective() {
    if(!hubWorld?.deriveObjective)return;
    const retailObjective=hubWorld.deriveObjective({
      visited:businessState?.exploredHub||[],shiftEnded:gameSession?.shiftEnded,
      queue:checkoutQueue.length,stockKnown:Boolean(inventory),display:totalDisplayStock(),
      reserve:totalReserveStock(),deliveryPending:Boolean(businessState?.pendingSupplierOrder)
    });
    const cycleObjective=worldDecisionState?.objective;
    const objective=cycleObjective?{...retailObjective,region:cycleObjective.zoneId,title:cycleObjective.title}:retailObjective;
    const entrance=hubWorld.entrances.find(e=>e.id===objective.region);
    const station=interactables.find(p=>p.zone===objective.region&&p.type===objective.interaction);
    const targetZone=worldDecisionState?.zones?.find(zone=>zone.id===objective.region);
    const destination=station||entrance||(targetZone?{x:HUB_OFFSET+targetZone.x,z:targetZone.z,name:targetZone.label}:null);
    const distance=destination?Math.round(Math.hypot(destination.x-player.x,destination.z-player.z)):0;
    const title=$3('simHubObjective');
    if(title&&title.textContent!==objective.title)title.textContent=objective.title;
    const preparing=false;
    const detail=preparing&&cycleObjective?`${destination?.name||targetZone?.label||'Destino'} · ${distance} m · Revisa las decisiones`:currentInterior===objective.region&&station?`${station.label} · ${distance} m · E para interactuar`:entrance?`${entrance.name} · ${distance} m · Camina por la entrada`:destination?`${destination.name||targetZone?.label||'Destino'} · ${distance} m`:objective.instruction;
    if($3('simHubDestination'))$3('simHubDestination').textContent=detail;
    const cycle=$3('simHubCycle');if(cycle)cycle.textContent=`CICLO ${currentRoundSafe()}`;
    const contextual=$3('simBusinessContext');
    if(contextual){contextual.hidden=!currentInterior;contextual.textContent=currentInterior==='office'?`Ciclo ${currentRoundSafe()} · Puntos ${fmt(initialFunPoints())} · Resumen en la pizarra`:currentInterior==='bank'?'Banco recreativo · Explora la ciudad':currentInterior==='suppliers'?`Pedidos ${businessVisualSnapshot().pendingUnits} uds · Compras en el mostrador`:currentInterior==='warehouse'?`Inventario ${totalReserveStock()}/${warehouseCapacity()} · ${businessState?.pendingSupplierOrder?'Pedido pendiente':'Recepción disponible'}`:currentInterior==='production'?`Producción ${inventory?.producedUnits||0}/${productionSnapshot()?.producibleUnits||0} · Capacidad y productividad en terminal`:`Exhibición ${totalDisplayStock()} · Clientes ${checkoutQueue.length} · Puntos ${fmt(salesLedger())}`;}
    const order=businessState?.pendingSupplierOrder,orderStatus=$3('simHubOrder');
    if(orderStatus){
      orderStatus.hidden=!order;
      if(order){const seconds=Math.max(0,Math.ceil((Number(order.dueAt)-(Date.now()))/1000));orderStatus.textContent=`PEDIDO · ${order.units} uds · ${seconds>0?`${seconds} s`:'Por recibir'}`;}
    }
    const direction=$3('simHubDirection');
    if(direction){direction.hidden=!destination;if(destination)direction.style.rotate=`${(Math.atan2(destination.x-player.x,player.z-destination.z)+yaw)*180/Math.PI}deg`;}
  }

  function positionPlayer(x,z,facing=0) {
    vehicleTransition=null;playerMode='PLAYER_ON_FOOT';player.locomotion='IDLE';
    if(driving){driving.speed=0;driving=null;$3(rootId)?.classList.remove('is-driving');if($3('simDriveHud'))$3('simDriveHud').hidden=true;}
    Object.assign(player,{x,z,y:player.baseY,vx:0,vz:0,vy:0,speed:0,grounded:true,headBobX:0,headBobY:0});
    yaw=targetYaw=facing;pitch=targetPitch=-.16;keys={};jumpQueued=false;cameraSnap=true;
    if(playerAvatar){playerAvatar.position.set(x,.025,z);playerAvatar.rotation.y=facing+Math.PI;playerAvatar.userData.motion&&npcMotion.resetMotion(playerAvatar);}
  }

  function setWorldRegion() {
    inHub=true;
    if(businessWorld)businessWorld.visible=true;
    if(hubWorld)hubWorld.group.visible=true;
    scene.fog=new THREE.Fog(0xc6d9e2,72,180);
    refreshHubUI();
  }

  function enterHub(announce=true) {
    if(!hubWorld)return;
    closeHubDirectory(false);currentInterior=null;setWorldRegion();
    positionPlayer(hubWorld.spawn.x,hubWorld.spawn.z,0);
    updateGameplayCamera(1);refreshHubUI();
    if(announce)message('Plaza SIDE · Camina por la entrada de un negocio. V cambia la cámara.');
  }

  function updateBusinessZone() {
    const zone=driving?null:businessInteriors?.zoneAt(player)||null;
    if(zone===currentInterior)return;
    currentInterior=zone;
    if(zone&&businessState){
      businessState.exploredHub||=[];
      if(!businessState.exploredHub.includes(zone)){businessState.exploredHub.push(zone);saveBusinessState();}
    }
    refreshHubUI();
  }

  // Compatibility API now selects a walking destination; it never moves a player.
  function enterHubInterior(id, suppliedZone) {
    const entrance=hubWorld?.entrances.find(e=>e.id===id);
    const zone=suppliedZone||cityMap?.zones.find(item=>item.id===id);
    if(!entrance&&!zone)return;
    const station=interactables.find(point=>point.type==='decisionZone'&&point.category===({office:'B',bank:'E',suppliers:'F'}[id]))
      ||(id==='news'?interactables.find(point=>point.type==='news'&&!point.zone):null);
    const destination=entrance||station||{x:HUB_OFFSET+zone.x,z:zone.z};
    selectedMapDestination=id;
    closeHubDirectory();message(`${zone?.name||entrance.name} · Sigue la ruta marcada en el mapa.`);
    targetYaw=Math.atan2(destination.x-player.x,player.z-destination.z);
  }

  function setCameraMode(mode) {
    cameraMode=mode==='first'?'first':'third';cameraSnap=true;
    refreshHubUI();updateGameplayCamera(1);
  }

  function openHubDirectory() {
    if(!inHub||!running)return;
    hubDirectoryOpen=true;keys={};player.vx=player.vz=0;document.exitPointerLock?.();
    $3('simHubDirectory')?.classList.remove('hidden');refreshHubUI();
    document.querySelector(`[data-hub-district="${selectedDistrict}"]`)?.focus();
  }

  function closeHubDirectory(focus=true) {
    hubDirectoryOpen=false;keys={};jumpQueued=false;$3('simHubDirectory')?.classList.add('hidden');
    if(focus)$3('side3dCanvas')?.focus();
  }

  function selectHubDistrict(id) {
    if(!Object.hasOwn(DISTRICTS,id))return;
    selectedDistrict=id;hubWorld?.updateDistrict(id);refreshHubUI();
  }

  function toggleDriving() {
    if(!inHub||!running||vehicleTransition||hubDirectoryOpen||checkoutOpen||adminOpen||newsOpen||productInspectOpen)return;
    const car=driving||hubVehicles?.nearest(player.x,player.z);if(!car)return;
    if(driving&&Math.abs(car.speed)>.5){message('Frena con ESPACIO antes de bajar.');return;}
    if(!driving&&!player.grounded){message('Apoya los pies en el suelo antes de entrar.');return;}
    const doors=[1,-1].map(side=>({x:car.x+Math.cos(car.yaw)*2.15*side,z:car.z-Math.sin(car.yaw)*2.15*side,side}));
    doors.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
    const door=doors.find(point=>{
      if(collision(point.x,point.z))return false;
      // A nearby car is not reachable through a wall or across its chassis.
      const start=driving?{x:car.x+Math.cos(car.yaw)*1.5*point.side,z:car.z-Math.sin(car.yaw)*1.5*point.side}:player;
      for(let i=0;i<=12;i++){const t=i/12;if(collision(start.x+(point.x-start.x)*t,start.z+(point.z-start.z)*t))return false;}
      return true;
    });
    if(!door){message('No hay una puerta accesible. Acércate por un costado del auto.');return;}
    const exiting=Boolean(driving);
    car.speed=0;keys={};jumpQueued=false;player.vx=player.vz=player.speed=0;
    playerMode=exiting?'EXITING_VEHICLE':'ENTERING_VEHICLE';
    // No seated/door clip is provided by these rigs. Reveal the avatar outside
    // the door, then animate the safe step away without crossing the chassis.
    if(exiting){player.x=car.x+Math.cos(car.yaw)*1.5*door.side;player.z=car.z-Math.sin(car.yaw)*1.5*door.side;}
    vehicleTransition={car,elapsed:0,duration:.55,from:{x:player.x,z:player.z},to:door,exiting};
    if(exiting){driving=null;$3(rootId)?.classList.remove('is-driving');}
    message(exiting?'Bajando del vehículo…':'Acercándose a la puerta…');
  }

  function updateDriving(dt) {
    if(!inHub||!hubVehicles)return;
    const paused=hubDirectoryOpen||checkoutOpen||adminOpen||newsOpen||productInspectOpen;
    if(vehicleTransition&&!paused){
      const transition=vehicleTransition,result=playerMotion.advanceVehicleTransition(transition,dt);
      if(collision(result.x,result.z)){
        vehicleTransition=null;playerMode='PLAYER_ON_FOOT';player.vx=player.vz=player.speed=0;keys={};jumpQueued=false;
        message('Paso bloqueado. Espera a que la puerta esté despejada.');return;
      }
      const dx=result.x-player.x,dz=result.z-player.z;
      player.x=result.x;player.z=result.z;player.vx=dx/Math.max(dt,.001);player.vz=dz/Math.max(dt,.001);player.speed=Math.hypot(dx,dz)/Math.max(dt,.001);
      if(result.done){
        vehicleTransition=null;player.vx=player.vz=player.speed=0;keys={};jumpQueued=false;
        if(transition.exiting){playerMode='PLAYER_ON_FOOT';message('A pie · SHIFT para correr · E para interactuar');}
        else{driving=transition.car;playerMode='DRIVING';player.x=driving.x;player.z=driving.z;targetYaw=driving.yaw;targetPitch=-.12;$3(rootId)?.classList.add('is-driving');message('W acelerar · S frenar / retroceder · A/D girar · ESPACIO freno · F bajar');}
      }
    }
    const blocked=paused||Boolean(vehicleTransition);
    const input={throttle:blocked?0:(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0),steer:blocked?0:(keys.KeyA||keys.ArrowLeft?1:0)-(keys.KeyD||keys.ArrowRight?1:0),brake:blocked||Boolean(keys.Space)};
    hubVehicles.update(dt,{active:driving,input,player,people:worldPeople(),bounds:hubBounds});
    if(driving){
      player.x=driving.x;player.z=driving.z;player.speed=0;
      if(Math.abs(driving.speed)>1&&performance.now()-lastCameraInputAt>1500){
        const heading=driving.yaw+driving.steer*Math.min(1.2,Math.abs(driving.speed)*.07);
        targetYaw+=Math.atan2(Math.sin(heading-targetYaw),Math.cos(heading-targetYaw))*(1-Math.exp(-dt*2));
      }
    }
    const hud=$3('simDriveHud');if(hud){hud.hidden=!driving;if(driving){$3('simDriveSpeed').textContent=String(Math.round(Math.abs(driving.speed)*3.6)).padStart(2,'0');$3('simDriveGear').textContent=driving.speed<-.2?'R':Math.abs(driving.speed)<.2?'N':'D';}}
  }

  function worldPeople(except=null) {
    const people=[],seen=new Set();
    const add=obj=>{
      if(!obj||obj===except||seen.has(obj))return;
      for(let node=obj;node;node=node.parent)if(!node.visible)return;
      seen.add(obj);
      const p=obj.getWorldPosition(obj.userData.collisionPosition||(obj.userData.collisionPosition=new THREE.Vector3()));
      people.push({x:p.x,z:p.z,radius:npcNavigation?.NPC_RADIUS??.29});
    };
    hubActors.forEach(actor=>add(actor.obj));
    animatedActors.forEach(actor=>add(actor.obj));
    npcs.filter(npc=>!npc.dead).forEach(npc=>add(npc.obj));
    for(const room of businessInteriors?.rooms||[])for(const actor of room.actors||[])add(actor.object);
    return people;
  }

  function updateHubPatrol(actor,dt) {
    const obj=actor.obj;
    if(!obj.visible)return;
    const state=actor.state||(actor.state={speed:0});
    if(!running||hubDirectoryOpen){state.speed=0;setPersonPose(obj,0,false,dt,0);return;}
    const navigator=perfMode!=='low'&&cityNavigator?.ready?cityNavigator:null;
    if(!actor.patrolController||actor.patrolNavigator!==navigator){
      actor.patrolController=createNpcPatrol({points:actor.patrol,navigator,obstacles:hubWorld.colliders,bounds:hubBounds,maxSpeed:actor.speed});
      actor.patrolNavigator=navigator;
    }
    Object.assign(state,{x:obj.position.x,z:obj.position.z,yaw:obj.rotation.y});
    const neighbors=worldPeople(obj);
    if(!driving)neighbors.push({x:player.x,z:player.z,radius:player.radius});
    neighbors.push(...(hubVehicles?.navigationNeighbors?.()||[]));
    const moved=actor.patrolController.update(state,dt,{neighbors});
    obj.position.x=state.x;obj.position.z=state.z;obj.rotation.y=state.yaw;
    setPersonPose(obj,0,moved.distance>.00001,dt,dt?moved.distance/dt:0);
    if(obj.userData.role==='guide'){
      const station=interactables.find(point=>point.mesh===obj);
      if(station){station.x=state.x;station.z=state.z;}
    }
  }

  function updateHubActors(dt) {
    if(!inHub)return;
    hubActors.forEach(actor=>updateHubPatrol(actor,dt));
    animatedActors.filter(actor=>actor.obj?.userData.role==='guide').forEach(actor=>updateHubPatrol(actor,dt));
  }

  function updateGameplayCamera(dt) {
    if(!camera)return;
    if(driving){
      playerAvatar.visible=false;
      const focus=new THREE.Vector3(driving.x,1.15,driving.z);
      const distance=cameraZoom+1.6+Math.abs(driving.speed)*.1;
      const desired=new THREE.Vector3(driving.x+Math.sin(yaw)*distance,3.6-Math.sin(pitch)*2,driving.z+Math.cos(yaw)*distance);
      const clear=playerMotion.constrainCamera(focus,desired,hubWorld.colliders);
      desired.set(clear.x,clear.y,clear.z);
      if(cameraSnap)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-6*dt));
      const safe=playerMotion.constrainCamera(focus,camera.position,hubWorld.colliders);camera.position.set(safe.x,safe.y,safe.z);
      camera.lookAt(focus);camera.fov+=(62+Math.abs(driving.speed)*.55-camera.fov)*(1-Math.exp(-dt*4));camera.updateProjectionMatrix();cameraSnap=false;
      hubWorld.sky?.position.copy(camera.position);
      if(sunLight){sunLight.target.position.set(player.x,0,player.z);sunLight.position.set(player.x-28,42,player.z+24);sunLight.target.updateMatrixWorld();}
      return;
    }
    if(playerAvatar){
      playerAvatar.visible=cameraMode==='third';playerAvatar.position.set(player.x,Math.max(.025,player.y-player.baseY+.025),player.z);
      if(player.speed>.12){const desired=Math.atan2(player.vx,player.vz),turn=Math.atan2(Math.sin(desired-playerAvatar.rotation.y),Math.cos(desired-playerAvatar.rotation.y));playerAvatar.rotation.y+=turn*(1-Math.exp(-12*dt));}
      const action=playerAvatar.userData.actions?.walk;if(action)action.setEffectiveTimeScale(Math.max(.4,Math.min(1.8,player.speed/1.5)));
      setPersonPose(playerAvatar,player.bob,player.grounded&&player.speed>.15,dt,player.speed);
    }
    const footFov=cameraMode==='third'?(player.locomotion==='RUN'?65:58):(player.locomotion==='RUN'?76:70);
    camera.fov+=(footFov-camera.fov)*(1-Math.exp(-7*dt));camera.updateProjectionMatrix();
    if(cameraMode==='third'&&!vehicleTransition&&player.speed>.5&&(keys.KeyW||keys.ArrowUp)&&!keys.KeyA&&!keys.KeyD&&!keys.ArrowLeft&&!keys.ArrowRight&&performance.now()-lastCameraInputAt>2500){
      const behind=playerAvatar.rotation.y-Math.PI;
      targetYaw+=Math.atan2(Math.sin(behind-targetYaw),Math.cos(behind-targetYaw))*(1-Math.exp(-dt*.65));
      targetPitch+=(-.16-targetPitch)*(1-Math.exp(-dt*.6));
    }
    if(cameraMode==='first'){
      const sideBobX=player.headBobX||0;
      camera.position.set(player.x+Math.cos(yaw)*sideBobX,player.y+(player.headBobY||0),player.z-Math.sin(yaw)*sideBobX);
      camera.rotation.set(pitch,yaw,0,'YXZ');
    } else {
      const orbitPitch=Math.max(-.85,Math.min(.32,pitch));
      const focus=new THREE.Vector3(player.x,player.y-.22,player.z);
      const distance=cameraZoom+Math.max(0,player.speed-2.65)*.18;
      const desired=new THREE.Vector3(player.x+Math.sin(yaw)*distance,Math.max(.55,focus.y+1.15-Math.sin(orbitPitch)*distance),player.z+Math.cos(yaw)*distance);
      const room=businessInteriors?.zones.find(zone=>zone.id===currentInterior);
      const nearDoor=hubWorld?.entrances.some(entrance=>entrance.portal.axis==='x'?Math.abs(player.z-entrance.portal.z)<entrance.portal.halfWidth+1&&Math.abs(player.x-entrance.portal.x)<3:Math.abs(player.x-entrance.portal.x)<entrance.portal.halfWidth+1&&Math.abs(player.z-entrance.portal.z)<3);
      // Keep the third-person orbit below the 3.1m lintel while crossing a
      // doorway. Tall industrial roofs do not imply an overhead camera.
      const ceilingLimit=room||nearDoor?Math.min(2.8,room?.ceilingY-.25||2.8):Infinity;
      desired.y=Math.min(desired.y,ceilingLimit);
      const blocks=hubWorld?.colliders||[];
      const clear=playerMotion.constrainCamera(focus,desired,blocks);desired.set(clear.x,clear.y,clear.z);
      if(cameraSnap)camera.position.copy(desired);else camera.position.lerp(desired,1-Math.exp(-12*dt));
      const safe=playerMotion.constrainCamera(focus,camera.position,blocks);camera.position.set(safe.x,safe.y,safe.z);
      camera.position.y=Math.min(camera.position.y,ceilingLimit);
      camera.lookAt(focus);playerAvatar.visible=camera.position.distanceTo(focus)>1.05;
    }
    cameraSnap=false;
    if(hubWorld?.sky)hubWorld.sky.position.copy(camera.position);
    if(sunLight){sunLight.target.position.set(player.x,0,player.z);sunLight.position.set(player.x-28,42,player.z+24);sunLight.target.updateMatrixWorld();}
  }

  const SKY_DAY_HEX = 0xeeb39b, SKY_DUSK_HEX = 0x806893;
  let skyDayColor = null, skyDuskColor = null;

  function updateDayLighting(dt) {
    if (!gameSession || !scene) return;
    if (!skyDayColor) { skyDayColor = new THREE.Color(SKY_DAY_HEX); skyDuskColor = new THREE.Color(SKY_DUSK_HEX); }
    const progress = 1 - Math.max(0, Math.min(1, gameSession.timeLeft / Math.max(1, gameSession.duration || 300)));
    const dusk = Math.max(0, (progress - 0.62) / 0.38);
    scene.background.lerpColors(skyDayColor, skyDuskColor, dusk * 0.82);
    if (scene.fog) scene.fog.color.copy(scene.background);
    if(hubWorld?.sky){hubWorld.sky.material.uniforms.horizon.value.copy(scene.background);hubWorld.sky.material.uniforms.top.value.setRGB(.28-dusk*.12,.36-dusk*.18,.65-dusk*.22);}
    if (sunLight) {
      sunLight.intensity = 2.7 - dusk * 1.1;
      sunLight.color.setRGB(1.0, 0.94 - dusk * 0.10, 0.84 - dusk * 0.18);
    }
    if (hemiLight) hemiLight.intensity = 1.05 - dusk * 0.3;
  }

  function collision(x, z, includePeople=true) {
    if(hubWorld){
      if(x<hubBounds.minX||x>hubBounds.maxX||z<hubBounds.minZ||z>hubBounds.maxZ)return true;
      if(hubWorld.colliders.some(c=>x>c.minX-player.radius&&x<c.maxX+player.radius&&z>c.minZ-player.radius&&z<c.maxZ+player.radius))return true;
      if(hubVehicles?.occupied(x,z,player.radius))return true;
      return includePeople&&worldPeople().some(person=>Math.hypot(x-person.x,z-person.z)<player.radius+person.radius);
    }
    // Until the city is ready, movement stays blocked. Historical colliders
    // can never become a fallback gameplay world.
    return true;
  }

  function updatePlayer(dt) {
    if (checkoutOpen || productInspectOpen || hubDirectoryOpen || adminOpen || newsOpen) { player.vx=player.vz=player.speed=0;player.locomotion='IDLE';jumpQueued=false;return; }
    if(driving||vehicleTransition){jumpQueued=false;return;}
    const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const people=worldPeople();
    const {travelled,sprinting}=playerMotion.stepPlayerMotion(player,{forward,side,sprint:keys.ShiftLeft||keys.ShiftRight,yaw},dt,(x,z)=>collision(x,z,false),{neighbors:people,radius:player.radius});
    if(running&&hubWorld)updateBusinessZone();
    if(player.grounded){footstepDistance+=travelled;if(footstepDistance>(sprinting ? .95 : .7)){footstepDistance=0;playFootstep();}}

    if (jumpQueued && player.grounded) {
      player.vy = 5.1;
      player.grounded = false;
      player.locomotion='AIRBORNE';playTone(330, .07, 'triangle', .012, 0);
    }
    jumpQueued = false;
    if (!player.grounded) {
      player.vy -= 14.5 * dt;
      player.y += player.vy * dt;
      if (player.y <= player.baseY) {
        player.y = player.baseY;
        player.vy = 0;
        player.grounded = true;
      }
    }

    if (player.grounded && player.speed > .15) player.bob += dt * (5.8 + player.speed * .75);
    const bobAmount = player.grounded ? Math.min(.045, player.speed * .009) : 0;
    player.headBobY = Math.sin(player.bob * 2) * bobAmount;
    player.headBobX = Math.cos(player.bob) * bobAmount * .45;


  }

  function playFootstep() {
    if(!audioEnabled||!audioCtx||audioCtx.state!=='running')return;
    if(!footstepBuffer){
      footstepBuffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.12),audioCtx.sampleRate);
      const samples=footstepBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*Math.exp(-i/samples.length*7);
    }
    const sound=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();
    sound.buffer=footstepBuffer;sound.playbackRate.value=.85+Math.random()*.2;filter.type='lowpass';filter.frequency.value=inHub?1100:650;
    gain.gain.value=.055;sound.connect(filter);filter.connect(gain);gain.connect(audioCtx.destination);sound.onended=()=>{sound.disconnect();filter.disconnect();gain.disconnect();};sound.start();
  }

  function openProductInspect(productId) {
    const product = productById(productId);
    const wrap = $3('simProductInspect');
    if (!wrap || !product) return;
    productInspectOpen = true;
    document.exitPointerLock?.();
    $3('inspectProductName').textContent = product.name;
    $3('inspectProductPrice').textContent = fmt(product.price);
    $3('inspectProductStock').textContent = `${displayStock(product.id)} en exhibición · ${reserveStock(product.id)} en almacén`;
    const descriptions={esencial:'Molde básico: producto de entrada, accesible y de rotación rápida.',urbano:'Molde mejorado: mayor elaboración y valor para el uso diario.',premium:'Molde premium: mayor detalle, margen y exigencia de calidad.'};
    $3('inspectProductDesc').textContent = descriptions[product.id]||`Producto ${companyName()}.`;
    const swatch=$3('inspectProductSwatch'); if(swatch) swatch.style.background=product.accent;
    wrap.classList.remove('hidden');
  }

  function closeProductInspect() {
    productInspectOpen = false;
    $3('simProductInspect')?.classList.add('hidden');
    if (running) setTimeout(requestPointerLockSafely,60);
  }

  function nearestInteractable() {
    let best=null,dist=2.2;
    const choices=[...interactables,...(hubWorld?[{...hubWorld.kiosk,type:'hubDirectory',label:'Consultar directorio del barrio'}]:[])];
    for(const choice of choices){
      if(choice.zone&&choice.zone!==currentInterior)continue;
      const point=choice.mesh?choice.mesh.getWorldPosition(new THREE.Vector3()):choice;
      const distance=Math.hypot(player.x-point.x,player.z-point.z);
      if(distance>=dist)continue;
      // A contextual terminal cannot be used through an adjacent wall or shelf.
      const lineEnd={x:point.x,z:point.z};
      if(npcNavigation&&!npcNavigation.segmentClear(player,lineEnd,hubWorld?.colliders||[]))continue;
      best=choice;dist=distance;
    }
    return best;
  }

  function updatePrompt() {
    const p = $3('sim3dPrompt');
    const it = nearestInteractable();
    if (!p) return;
    const vehicle=inHub&&hubVehicles?.nearest(player.x,player.z);
    if(driving||vehicle){p.replaceChildren();const key=document.createElement('kbd');key.textContent='F';p.append(key,driving?' Bajar del auto · detente primero':' Conducir SIDE Cruiser');p.classList.add('show');return;}
    if(hubDirectoryOpen){p.classList.remove('show');return;}
    if(it?.type.startsWith('hub')){p.replaceChildren();const key=document.createElement('kbd');key.textContent='E';p.append(key,` ${it.label}`);p.classList.add('show');return;}
    if (it?.type === 'guide') {
      p.replaceChildren();const key=document.createElement('kbd');key.textContent='E';p.append(key,` Hablar con ${GUIDE_NAME}`);
      p.classList.add('show');
      return;
    }
    if (it?.type === 'decisions') {
      p.innerHTML = '<kbd>E</kbd> Abrir terminal de decisiones';
      p.classList.add('show');
      return;
    }
    if (it?.type === 'decisionZone') {
      p.replaceChildren();const key=document.createElement('kbd');key.textContent='E';p.append(key,` ${it.label}`);
      p.classList.add('show');return;
    }
    if (it?.type === 'register') {
      const next = checkoutQueue[0];
      const detail = next ? `${next.archetype?.label || 'Cliente'} · ${productById(next.productId).name} · ${fmt(next.productPrice)}` : 'Sin clientes';
      p.innerHTML = `<kbd>E</kbd> Abrir caja · ${detail}${checkoutQueue.length ? ` · ${checkoutQueue.length} en cola` : ''}`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'restock') {
      p.innerHTML = `<kbd>E</kbd> Reponer exhibidores · ${totalReserveStock()} unidades en almacén`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'product') {
      const product = productById(it.productId);
      p.innerHTML = `<kbd>E</kbd> Ver ${product.name} · ${fmt(product.price)}`;
      p.classList.add('show');
      return;
    }
    if (it?.type === 'admin') {
      p.replaceChildren();const key=document.createElement('kbd');key.textContent='E';p.append(key,` ${it.label||'Abrir computadora de administración'}`);
      p.classList.add('show');
      return;
    }
    if (it?.type === 'news') {
      p.innerHTML = '<kbd>E</kbd> Leer noticias y eventos reales del ciclo';
      p.classList.add('show');
      return;
    }
    p.classList.remove('show');
  }

  function interact() {
    if(driving)return;
    if(!running||hubDirectoryOpen)return;
    const it = nearestInteractable();
    if (!it) return;
    if(it.type==='hubDirectory')openHubDirectory();
    else if (it.type === 'decisions') openDecisionsFrom3D();
    else if (it.type === 'decisionZone') openDecisionsFrom3D(it.category);
    else if (it.type === 'register') openCheckout();
    else if (it.type === 'restock') restockDisplays(true);
    else if (it.type === 'product') openProductInspect(it.productId);
    else if (it.type === 'admin') openAdmin(it.adminPage);
    else if (it.type === 'news') openNewsPanel();
    else if (it.type === 'guide') talkToMona();
  }

  function openDecisionsFrom3D(category) {
    running = false;
    document.activeElement?.blur?.();
    clearSessionOverlays();
    player.vx=player.vz=player.speed=0;
    locked=false;
    document.exitPointerLock?.();
    stopAmbient();
    window.__SIDE_RETURN_TO_3D = true;
    try {
      if (!window.SIDE_WORLD_NAVIGATION?.openDecisions || window.SIDE_WORLD_NAVIGATION.openDecisions(category)===false) running=true;
    } catch { running=true; message('La Tablet no está disponible. Puedes continuar explorando.'); }
  }

  function refreshHudLayout() {
    const host=$3(rootId),stats=host?.querySelector?.('.sim3d-stats');
    if(host?.getBoundingClientRect&&stats?.getBoundingClientRect&&host.style?.setProperty){
      const bottom=stats.getBoundingClientRect().bottom-host.getBoundingClientRect().top;
      host.style.setProperty('--sim-hud-bottom',`${Math.ceil(bottom+10)}px`);
    }
  }

  function resize() {
    pausedFrameDrawn=false;
    refreshHudLayout();
    if (!renderer || !camera) return;
    const c = $3('side3dCanvas');
    const w = c.clientWidth || innerWidth;
    const h = c.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }


  function updateAdaptiveQuality(dt, now) {
    if (!renderer) return;
    perfAccum += dt;
    perfFrames += 1;
    if (now - perfLastCheck < 2500) return;
    const fps = perfFrames / Math.max(0.001, perfAccum);
    perfAccum = 0; perfFrames = 0; perfLastCheck = now;
    if(debugPerformance){const monitor=$3('simPerfMonitor');if(monitor)monitor.textContent=`${Math.round(fps)} FPS · ${npcs.length} NPC · ${trafficCars.length} autos · ${navReady?'RECAST':'RUTA SEGURA'}`;}
    if(perfMode!=='auto')return;
    let next = renderScale;
    if (fps < 38) next = Math.max(0.78, renderScale - 0.18);
    else if (fps < 48) next = Math.max(0.90, renderScale - 0.10);
    else if (fps > 57) next = Math.min(1.25, renderScale + 0.06);
    if (Math.abs(next - renderScale) >= 0.04) {
      renderScale = next;
      renderer.setPixelRatio(Math.min(devicePixelRatio, renderScale));
      resize();
    }
  }

  function frame(now = performance.now()) {
    if (!initialized) return;
    syncSessionContext();
    const elapsed = clock.getDelta();
    const dt = Math.min(0.04, elapsed);
    const time = performance.now() * 0.001;
    if(visibilityPaused || $3(rootId)?.classList.contains('hidden')){
      // Retain one lightweight wake-up callback; no GPU work or business ticks
      // while another application screen is active.
      perfAccum=0;perfFrames=0;perfLastCheck=now;
      stopVehicleAudio();pausedFrameDrawn=false;
      raf=requestAnimationFrame(frame);return;
    }
    if(!running){
      stopVehicleAudio();
      if(!pausedFrameDrawn){updateHUD();renderer.render(scene,camera);pausedFrameDrawn=true;}
      perfAccum=0;perfFrames=0;perfLastCheck=now;
      raf=requestAnimationFrame(frame);return;
    }
    pausedFrameDrawn=false;
    if (running) {
      const operating=true;
      if (operating && gameSession && !gameSession.shiftEnded) {
        gameSession.timeLeft -= dt;
        if (gameSession.timeLeft <= 0) {
          gameSession.timeLeft = 0;
          updateHUD();
          endShift();
        }
      }
      yaw += (targetYaw - yaw) * (1 - Math.exp(-24 * dt));
      pitch += (targetPitch - pitch) * (1 - Math.exp(-24 * dt));
      updatePlayer(dt);
      updateDriving(dt);
      updateVehicleAudio();
      updateGameplayCamera(dt);
      updateHubActors(dt);
      hubWorld?.tickOutdoorProps(dt,player,time);
      businessInteriors?.tick(dt,player,time);
      for(const point of businessInteriors?.hotspots||[])if(point.type==='decisionZone'&&!interactables.some(existing=>existing.id===point.id))interactables.push(point);
      if (operating && !gameSession?.shiftEnded) {
        spawnNpc(now);
        triggerRandomEvent(now);
        tickProduction(now);
        tickSupplier(now);
        npcs.forEach((n) => moveNpc(n, dt));
        npcs = npcs.filter((n) => !n.dead);
      }
      animateActors(time,dt);
      // Presence and simulation belong to the city; Three.js handles frustum
      // culling without making customers appear when the player enters a zone.
      for(const npc of npcs)npc.obj.visible=true;
      if (now - lastLightTick > 250) { updateDayLighting(dt); lastLightTick = now; }
      if (now - lastPromptTick > 100) { updatePrompt(); lastPromptTick = now; }
      if (now - lastHudTick > 220) {
        renderInventoryDisplays();updateHUD();updateMinimap();updateHubObjective();
        const selected=cityMap?.zones.find(zone=>zone.id===selectedMapDestination);
        if(selected&&Math.hypot(HUB_OFFSET+selected.x-player.x,selected.z-player.z)<11)selectedMapDestination=null;
        const activeZone=currentInterior||closestCityZone?.(player.x-HUB_OFFSET,player.z,cityMap.zones,11);
        const targetZone=selectedMapDestination||worldDecisionState?.objective?.zoneId||null;
        worldOrientation?.update({player,camera,yaw,now,activeZone,targetZone});
        worldWayfinding?.update({player,camera,targetZone,now});
        if(adminOpen) refreshAdminUI(); lastHudTick = now;
      }
    }
    updateAdaptiveQuality(elapsed, now);
    renderer.render(scene, camera);
    if(!detailsPromise&&!detailsTimer)detailsTimer=setTimeout(()=>{detailsTimer=0;preloadDetails();},1500);
    raf = requestAnimationFrame(frame);
  }

  function bind() {
    const canvas = $3('side3dCanvas');
    canvas.addEventListener('wheel',event=>{
      if(!running||hubDirectoryOpen||adminOpen||checkoutOpen||newsOpen||productInspectOpen||(!driving&&cameraMode==='first'))return;
      cameraZoom=Math.max(3.2,Math.min(7.4,cameraZoom+event.deltaY*.004));lastCameraInputAt=performance.now();event.preventDefault();
    },{passive:false});
    canvas.addEventListener('click', () => { if (running&&!hubDirectoryOpen) canvas.requestPointerLock?.(); });
    let touchLookId=null,touchLookX=0,touchLookY=0;
    canvas.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||!running)return;touchLookId=event.pointerId;touchLookX=event.clientX;touchLookY=event.clientY;canvas.setPointerCapture?.(event.pointerId);});
    canvas.addEventListener('pointermove',event=>{if(event.pointerId!==touchLookId||!running)return;const dx=event.clientX-touchLookX,dy=event.clientY-touchLookY;touchLookX=event.clientX;touchLookY=event.clientY;lastCameraInputAt=performance.now();targetYaw-=dx*.006;targetPitch=Math.max(-1.3,Math.min(1.3,targetPitch-dy*.005));});
    const clearTouchLook=event=>{if(event.pointerId===touchLookId)touchLookId=null;};canvas.addEventListener('pointerup',clearTouchLook);canvas.addEventListener('pointercancel',clearTouchLook);
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
    document.addEventListener('mousemove', (e) => {
      if (!running || !locked) return;
      lastCameraInputAt=performance.now();targetYaw -= e.movementX * 0.00215;
      targetPitch -= e.movementY * 0.00185;
      targetPitch = Math.max(-1.3, Math.min(1.3, targetPitch));
    });
    document.addEventListener('keydown', (e) => {
      if ($3(rootId)?.classList.contains('hidden')) return;
      if(hubDirectoryOpen){
        if(e.code==='Escape'){closeHubDirectory();e.preventDefault();}
        if(e.code==='Tab'){const buttons=[...$3('simHubDirectory').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();e.preventDefault();}
        return;
      }
      if(newsOpen){if(e.code==='Escape')closeNewsPanel();return;}
      if (adminOpen) { if(e.code==='Escape') closeAdmin(); return; }
      if (productInspectOpen && e.code !== 'Escape') return;
      if (productInspectOpen && e.code === 'Escape') { closeProductInspect(); return; }
      keys[e.code] = true;
      if (checkoutOpen) {
        if (e.code === 'KeyE' || e.code === 'Enter') { checkoutScanned ? confirmCheckout() : scanCheckoutProduct(); e.preventDefault(); }
        if (e.code === 'Escape') { closeCheckout(true); e.preventDefault(); }
        return;
      }
      if (productInspectOpen && e.code === 'Escape') { closeProductInspect(); e.preventDefault(); return; }
      if (e.code === 'Space') { jumpQueued = true; e.preventDefault(); }
      if (e.code === 'KeyE'&&!e.repeat&&!vehicleTransition) interact();
      if(e.code==='KeyF'&&!e.repeat&&running){toggleDriving();e.preventDefault();}
      if(e.code==='KeyV'&&!e.repeat&&running)setCameraMode(cameraMode==='third'?'first':'third');
      if (e.code === 'Escape') document.exitPointerLock?.();
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur',()=>{keys={};jumpQueued=false;});
    $3('sim3dCameraBtn')?.addEventListener('click',()=>setCameraMode(cameraMode==='third'?'first':'third'));
    $3('sim3dHubBtn')?.addEventListener('click',()=>{if(running&&!checkoutOpen&&!adminOpen&&!newsOpen&&!productInspectOpen)openHubDirectory();});
    $3('simHubDirectoryClose')?.addEventListener('click',()=>closeHubDirectory());
    document.querySelectorAll('[data-hub-district]').forEach(button=>button.addEventListener('click',()=>selectHubDistrict(button.dataset.hubDistrict)));
    $3('simHubVisitStore')?.addEventListener('click',()=>{
      enterHubInterior('store');
    });
    document.querySelectorAll('[data-touch-key]').forEach(button=>{
      const code=button.dataset.touchKey;const down=event=>{event.preventDefault();keys[code]=true;button.setPointerCapture?.(event.pointerId);};const up=event=>{event.preventDefault();keys[code]=false;};
      button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
    });
    $3('simTouchInteract')?.addEventListener('pointerdown',event=>{event.preventDefault();if(running&&!vehicleTransition)interact();});
    $3('simTouchJump')?.addEventListener('pointerdown',event=>{event.preventDefault();if(running)jumpQueued=true;});
    $3('simTouchDrive')?.addEventListener('click',toggleDriving);
    $3('simTouchJump')?.addEventListener('pointerdown',()=>{if(driving)keys.Space=true;});
    for(const event of ['pointerup','pointercancel','pointerleave'])$3('simTouchJump')?.addEventListener(event,()=>{keys.Space=false;});
    $3('inspectCloseBtn')?.addEventListener('click', closeProductInspect);
    $3('payCashBtn')?.addEventListener('click',()=>{checkoutPayment='cash';$3('payCashBtn').classList.add('active');$3('payCardBtn').classList.remove('active');});
    $3('payCardBtn')?.addEventListener('click',()=>{checkoutPayment='card';$3('payCardBtn').classList.add('active');$3('payCashBtn').classList.remove('active');});
    $3('checkoutCloseBtn')?.addEventListener('click', () => closeCheckout(true));
    $3('checkoutScanBtn')?.addEventListener('click', scanCheckoutProduct);
    $3('checkoutChargeBtn')?.addEventListener('click', confirmCheckout);
    $3('sim3dStartBtn')?.addEventListener('click', () => {
      if(!controlsOpenedFromHelp&&$3('sim3dNeverShowControls')?.checked)localStorage.setItem(controlsSeenKey(),'1');
      if(!gameSession)resetGameSession(false);
      running = true;
      $3('sim3dStart').classList.add('hidden');
      hideSummaryOverlay();
      startAmbient();
      playSfx('start');
      canvas.requestPointerLock?.();
      message(controlsOpenedFromHelp?'Controles cerrados. Continúa gestionando tu empresa.':'La tienda ya está abierta. Gestiona el turno, atiende caja, repón stock y alcanza la meta del día.');
      if(!controlsOpenedFromHelp){tutorialIndex=0;showTutorialStep();}
      controlsOpenedFromHelp=false;
    });
    $3('sim3dReplayBtn')?.addEventListener('click', () => {
      if (sessionContext !== storageContext()) {
        enter({autoStart:true});
        return;
      }
      const advance = Boolean(gameSession && gameSession.revenue >= gameSession.targetRevenue);
      clearSessionOverlays();
      resetGameSession(true, advance);
      rebuildDynamicWorld();
      running = true;
      hideSummaryOverlay();
      startAmbient();
      playSfx('start');
      canvas.requestPointerLock?.();
      message(`${advance ? 'Nuevo día desbloqueado' : 'Día reiniciado'}. Bienvenida al Día ${gameSession?.day || 1}.`);
    });
    $3('sim3dSummaryLobbyBtn')?.addEventListener('click', () => {
      hideSummaryOverlay();
      stopAmbient();
      if (typeof window.showScreen === 'function') window.showScreen('studentLobby');
      window.updateIntegrationUI?.();
    });
    $3('sim3dAudioBtn')?.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      localStorage.setItem(audioKey(), audioEnabled ? '1' : '0');
      loadAudioSetting();
      if (audioEnabled) { ensureAudio(); startAmbient(); playTone(520, 0.08, 'triangle', 0.03, 0); }
      else stopAmbient();
    });
    const toggleMetrics=(force)=>{
      const drawer=$3('sim3dMetricsDrawer'),button=$3('sim3dMetricsBtn');if(!drawer)return;
      const open=typeof force==='boolean'?force:drawer.classList.contains('hidden');drawer.classList.toggle('hidden',!open);button?.setAttribute('aria-expanded',String(open));
    };
    $3('sim3dMetricsBtn')?.addEventListener('click',()=>toggleMetrics());
    $3('sim3dMetricsClose')?.addEventListener('click',()=>toggleMetrics(false));
    $3('sim3dHelpBtn')?.addEventListener('click',()=>{
      controlsOpenedFromHelp=true;running=false;document.exitPointerLock?.();
      if($3('sim3dStartBtn'))$3('sim3dStartBtn').textContent='VOLVER AL SIMULADOR';
      $3('sim3dStart')?.classList.remove('hidden');
    });
    $3('simNewsClose')?.addEventListener('click',closeNewsPanel);
    $3('simMissionToggle')?.addEventListener('click',()=>{
      missionCollapsed=!missionCollapsed;const panel=document.querySelector('.sim3d-missions'),button=$3('simMissionToggle');panel?.classList.toggle('collapsed',missionCollapsed);button?.setAttribute('aria-expanded',String(!missionCollapsed));if(button)button.textContent=missionCollapsed?'+':'−';
    });
    $3('adminCloseBtn')?.addEventListener('click', closeAdmin);
    document.querySelectorAll('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b===btn));
      document.querySelectorAll('[data-admin-page]').forEach(pg=>pg.classList.toggle('active',pg.dataset.adminPage===btn.dataset.adminTab));
      refreshAdminUI();
    }));
    $3('savePricesBtn')?.addEventListener('click',()=>{
      PRODUCTS.forEach(p=>{
        const el=$3(`price-${p.id}-input`); const min=p.id==='esencial'?40:p.id==='urbano'?50:70; const max=p.id==='premium'?450:300;
        const v=Math.max(min,Math.min(max,Number(el?.value)||p.price)); p.price=Math.round(v); businessState.prices[p.id]=p.price;
      });
      saveBusinessState(); renderInventoryDisplays(); refreshAdminUI(); updateHUD(); addBusinessLog('Precios de venta actualizados.'); message('Precios actualizados. La demanda responderá a los nuevos valores.');
    });
    $3('orderStockBtn')?.addEventListener('click',orderSupplierStock);
    $3('upgradeDisplayBtn')?.addEventListener('click',()=>buyUpgrade('display',650,3));
    $3('upgradeCheckoutBtn')?.addEventListener('click',()=>buyUpgrade('checkout',1200,1));
    $3('upgradeWarehouseBtn')?.addEventListener('click',()=>buyUpgrade('warehouse',1500,2));
    document.querySelectorAll('[data-quality]').forEach(btn=>btn.addEventListener('click',()=>setGraphicsQuality(btn.dataset.quality)));
    $3('tutorialNextBtn')?.addEventListener('click',nextTutorial);
    $3('sim3dDecisionsBtn')?.addEventListener('click', () => openDecisionsFrom3D());
    $3('sim3dLobbyBtn')?.addEventListener('click', () => {
      running = false;
      document.exitPointerLock?.();
      stopAmbient();
      if (typeof window.showScreen === 'function') window.showScreen('studentLobby');
    });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange',()=>{visibilityPaused=document.hidden;if(visibilityPaused){keys={};jumpQueued=false;stopVehicleAudio();}else clock?.getDelta();});
  }

  async function init() {
    if (initialized) return true;
    if (!await preload()) return false;
    debugPerformance=new URLSearchParams(location.search).get('side3dDebug')==='1';
    if(debugPerformance&&!$3('simPerfMonitor')){const monitor=document.createElement('div');monitor.id='simPerfMonitor';monitor.className='sim-perf-monitor';monitor.textContent='Midiendo rendimiento…';$3(rootId)?.appendChild(monitor);}
    loadBusinessState();
    publishLoading('Construyendo la ciudad y sus accesos',3);
    buildStaticWorld();
    // New city navigation uses the same obstacle graph as physical collisions.
    navReady=false;navMesh=null;navQuery=null;
    await buildPlayableHub();
    publishLoading('Preparando materiales gráficos',4);
    loadAudioSetting();
    clock = new THREE.Clock();
    bind();
    resize();
    rebuildDynamicWorld();
    syncSalesFromLedger();
    updateGameplayCamera(1);
    businessInteriors?.tick(0,player,0);
    // Compile while the loading UI remains responsive, before enabling controls.
    publishLoading('Preparando shaders para el primer frame',5);
    if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
    publishLoading('Mundo 3D listo para iniciar',6);
    initialized = true;
    frame();
    return true;
  }

  async function prepare() {
    if(initialized)return true;
    if(!initializationPromise){
      lastPrepareError='';
      initializationPromise=init().catch(error=>{
        console.error('SIDE: preparación 3D',error);
        lastPrepareError=/WebGL|context/i.test(error.message)?'El navegador no pudo crear WebGL. Activa la aceleración gráfica y vuelve a intentarlo.':'No se pudo construir el mundo 3D. Tus decisiones siguen guardadas; vuelve a intentarlo.';
        return false;
      }).finally(()=>{initializationPromise=null});
    }
    return initializationPromise;
  }

  function selectCharacter(id) {
    if(!validCharacterId(id)){console.warn(`SIDE: personaje desconocido ${id}.`);return false;}
    if(initialized&&playerAvatar&&playerAvatar.userData.characterId!==id){
      console.warn('SIDE: la identidad del jugador se conserva durante la simulación activa. Vuelve al selector antes de crear el mundo para cambiarla.');
      return false;
    }
    selectedCharacterId=id;
    characterManager?.select(id,{persist:false});
    return true;
  }

  async function preloadCharacter(id=activeCharacterId()) {
    if(!selectCharacter(id))return false;
    if(!await preloadBase())return false;
    publishLoading(`Cargando ${CONFIG.NPCS?.[id]?.name||'personaje'} como avatar`,2);
    return loadCharacter(id,ASSET_PRIORITY.CRITICAL);
  }

  async function enter(options = {}) {
    const requestedContext = storageContext();
    if (!await prepare()) return false;
    if (requestedContext !== storageContext()) {
      window.SIDE_WORLD_NAVIGATION?.openDecisions();
      window.toast?.('El ciclo cambió durante la carga. Revisa sus decisiones y vuelve a iniciar el mundo 3D.');
      return false;
    }
    if(gameSession&&!gameSession.shiftEnded&&sessionContext===requestedContext){
      returnFromDecisions();
      return true;
    }
    running = false;
    clearSessionOverlays();
    window.__SIDE_RETURN_TO_3D = false;
    const autoStart = options === true || Boolean(options?.autoStart);
    const controlsSeen=localStorage.getItem(controlsSeenKey())==='1';
    if (typeof window.showScreen === 'function') window.showScreen(rootId);
    else { document.querySelectorAll('.screen').forEach(screen=>screen.classList.toggle('hidden',screen.id!==rootId)); }
    document.querySelector('.sim3d-brand strong') && (document.querySelector('.sim3d-brand strong').textContent = companyName());
    document.querySelector('.receipt-brand') && (document.querySelector('.receipt-brand').textContent = companyName());
    document.querySelector('.sim-checkout-kicker') && (document.querySelector('.sim-checkout-kicker').textContent = `CAJA ${companyName().toUpperCase()}`);
    document.querySelector('.mini-title') && (document.querySelector('.mini-title').textContent = companyName());
    document.querySelector('.admin-head h2') && (document.querySelector('.admin-head h2').textContent = `${companyName()} · Panel operativo`);
    controlsOpenedFromHelp=false;
    if ($3('sim3dStartBtn')) $3('sim3dStartBtn').textContent = 'ENTRAR AL SIMULADOR';
    $3('sim3dStart')?.classList.toggle('hidden',autoStart||controlsSeen);
    loadInventory();
    resetGameSession(false);
    running = autoStart||controlsSeen;
    keys = {};
    player.bob=0;
    rebuildDynamicWorld();
    hubReturnPoint=null;enterHub(false);
    syncSalesFromLedger();
    updateHUD();
    clock.getDelta();
    renderNewsPanel();
    if (running) { startAmbient(); playSfx('start'); message(`${companyName()} está abierta. Haz clic dentro del juego para controlar la cámara y completar el turno.`); }
    setTimeout(() => { resize(); $3('side3dCanvas')?.focus?.(); }, 40);
    return true;
  }

  function returnFromDecisions() {
    window.__SIDE_RETURN_TO_3D=false;
    document.activeElement?.blur?.();
    if (!initialized || !gameSession || gameSession.shiftEnded || sessionContext !== storageContext()) {
      return enter({autoStart:true});
    }
    clearSessionOverlays();
    if (typeof window.showScreen === 'function') window.showScreen(rootId);
    else { document.querySelectorAll('.screen').forEach(screen=>screen.classList.toggle('hidden',screen.id!==rootId)); }
    rebuildDynamicWorld();
    renderNewsPanel();
    syncSalesFromLedger();
    if (!gameSession) resetGameSession(false);
    running = true;
    visibilityPaused=document.hidden;
    pausedFrameDrawn=false;
    player.vx=player.vz=player.speed=0;
    startAmbient();
    clock?.getDelta();
    message('Cambios aplicados: la boutique, el taller y la atención en caja fueron actualizados con tus decisiones.');
    const canvas=$3('side3dCanvas');
    resize();canvas?.focus?.();
    if(!matchMedia('(pointer: coarse)').matches){
      try{canvas?.requestPointerLock?.()?.catch?.(()=>{});}catch{/* a subsequent canvas click retries when a gesture is required */}
    }
    return true;
  }

  function diagnostics() {
    const characters = [];
    const controllers=new Set(),mixers=new Set();
    scene?.traverse(node => {
      if(node.userData?.animationController)controllers.add(node.userData.animationController);
      if(node.userData?.mixer)mixers.add(node.userData.mixer);
      if (node.userData?.modelKind) {
        const position=node.getWorldPosition(new THREE.Vector3());
        characters.push({kind:node.userData.modelKind, characterId:node.userData.characterId||null, role:node.userData.characterRole||node.userData.role||'', name:node.userData.displayName||'', x:position.x, y:position.y, z:position.z, height:node.userData.characterGeometry?.height||null, groundY:node.userData.groundHeight??null});
      }
    });
    const selected=activeCharacterId(),selectedInstances=characters.filter(character=>character.characterId===selected).length;
    return {initialized, running, session:gameSession?{context:sessionContext,day:gameSession.day,timeLeft:gameSession.timeLeft,shiftEnded:gameSession.shiftEnded}:null,
      navigationReady:Boolean(npcNavigation&&hubWorld&&businessInteriors),navigationSystem:cityNavigator?.ready&&perfMode!=='low'?'yuka-three-pathfinding+aabb':'city-aabb',navigationGrid:cityNavStats,
      models:Object.keys(execModelTemplates).filter(key=>execModelTemplates[key]), characters,
      assets:{detailsLoading:Boolean(detailsPromise&&!detailsComplete),detailsReady:detailsComplete,lighting:studioEnvironment?'baked-studio':'direct',storeProps:{loaded:Object.keys(storePropTemplates),errors:{...storePropErrors}},warehouseProps:{loaded:Object.keys(warehousePropTemplates),errors:{...warehousePropErrors}},productionProps:{loaded:Object.keys(productionPropTemplates),errors:{...productionPropErrors}},outdoorProps:{loaded:Object.keys(outdoorPropTemplates),errors:{...outdoorPropErrors}},cache:assetCache?.diagnostics?.()||null},
      character:{selected,name:CONFIG.NPCS[selected]?.name||'',selectedInstances,playerInstances:characters.filter(character=>character.role==='player').length,manager:characterManager?.diagnostics?.()||null,animation:playerAvatar?.userData.animationController?.getSnapshot?.()||null,controllers:controllers.size,mixers:mixers.size},
      suppliedNpcs:{loaded:Object.keys(suppliedTemplates),errors:{...suppliedErrors},customers:npcs.map(n=>({kind:n.obj.userData.modelKind,state:n.state,x:n.obj.position.x,z:n.obj.position.z,speed:n.obj.userData.motion?.speed||0,distance:n.obj.userData.motion?.distance||0,routeRemaining:n.route.length-n.routeIndex})),actors:animatedActors.filter(a=>['guide','visitor'].includes(a.type)).map(a=>({kind:a.obj.userData.modelKind,x:a.obj.position.x,z:a.obj.position.z,phase:a.obj.userData.motion?.phase||0,distance:a.obj.userData.motion?.distance||0,rigged:Boolean(a.obj.userData.motion)}))},
      cityNpcModels:{approved:cityApproved?.length||0,loaded:cityTemplates.size,active:cityRoster?.models.length||0,visibleHub:hubActors.filter(actor=>actor.obj.visible).length},
      mona:{loaded:Boolean(monaTemplate), error:monaLoadError, instances:characters.filter(c=>c.characterId==='mona'||c.kind==='mona'||c.kind==='mona-fallback').length},
      hub:{active:inHub,district:selectedDistrict,mode:cameraMode,interior:currentInterior,actors:hubActors.length,visited:[...(businessState?.exploredHub||[])],drawCalls:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,meshes:hubWorld?.group.children.length||0,outdoorProps:hubWorld?.outdoorProps?.()||null},
      world:{id:'side-city',continuous:true,legacyActive:Boolean(businessWorld&&businessWorld!==businessInteriors?.group&&businessWorld.visible),interiors:businessInteriors?.stats()||null,queueCapacity:queueSlots.length},
      driving:driving?{speed:driving.speed,yaw:driving.yaw}:null,vehicles:hubVehicles?.cars.map(c=>({x:c.x,z:c.z,speed:c.speed,traffic:c.traffic}))||[],
      playerControl:{mode:playerMode,locomotion:player.locomotion||'IDLE',zoom:cameraZoom,transition:vehicleTransition?vehicleTransition.elapsed/vehicleTransition.duration:null},
      player:{x:player.x,z:player.z}, renderedFrames:renderer?.info.render.frame||0, lastError:lastPrepareError};
  }
  function suspend(){running=false;keys={};jumpQueued=false;player.vx=player.vz=player.speed=0;document.exitPointerLock?.();stopAmbient();}
  window.SIDE3D = { prepare, refreshHudLayout, preloadBase, preload, preloadCharacter, selectCharacter, preloadDetails, loadingStatus, enter, suspend, returnFromDecisions, rebuild: rebuildDynamicWorld, getLastError:()=>lastPrepareError, diagnostics };
})();
