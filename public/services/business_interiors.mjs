import * as THREE from '../vendor/three/build/three.module.js';
import * as npcNavigation from './npc_navigation.mjs';
import { buildOfficeInterior } from './office_interior.mjs';
import { buildBankInterior } from './bank_interior.mjs';
import { buildSuppliersInterior } from './suppliers_interior.mjs';
import { createInteriorNavigation } from './interior_navigation.mjs';

// Metres, on the same street grid as the city. No interior scene or spawn map.
export const BUSINESS_LAYOUTS = Object.freeze([
  { id: 'store', name: 'Tienda SIDE', x: -19, z: 19, width: 16, depth: 10, height: 4.6, doorX: -19, doorZ: 24, doorWidth: 2.8 },
  { id: 'warehouse', name: 'Almacén SIDE', x: -20.5, z: -19, width: 15, depth: 14, height: 6.6, doorX: -20, doorZ: -12, doorWidth: 3.6 },
  { id: 'production', name: 'Producción SIDE', x: 20, z: -19, width: 16, depth: 14, height: 6.4, doorX: 20, doorZ: -12, doorWidth: 2.8 }
].map(Object.freeze));

// Visual logistics route in shared world coordinates. Financial and inventory
// state remains owned by the existing simulation snapshot.
export const WORKER_CYCLE = Object.freeze([
  {state:'recoger',x:-24.1,z:-16.0,wait:.7,action:'pickup'},
  {state:'salir del almacén',x:-20,z:-10.4},
  {state:'transportar',x:20,z:-10.4,action:'carry'},
  {state:'entrar en producción',x:20,z:-13.2,action:'carry'},
  // Stand beside the operator, whose station is occupied from world entry.
  {state:'operar',x:16,z:-21.55,wait:1.8,action:'inspect'},
  {state:'inspeccionar',x:24,z:-21.4,wait:.8,action:'inspect'},
  {state:'entregar',x:24.7,z:-19.6,wait:.7,action:'carry'},
  {state:'salir de producción',x:20,z:-10.4},
  {state:'volver',x:-20,z:-10.4},
  {state:'entrar en almacén',x:-20,z:-13.2}
].map(Object.freeze));

export function getBusinessZones(offsetX = 150) {
  return BUSINESS_LAYOUTS.map(b => ({ id: b.id, name: b.name,
    minX: b.x + offsetX - b.width / 2, maxX: b.x + offsetX + b.width / 2,
    minZ: b.z - b.depth / 2, maxZ: b.z + b.depth / 2, ceilingY: b.height }));
}

export function stockVisualLevel(ratio) {
  const value = Number(ratio);
  return Number.isFinite(value) ? Math.min(4, Math.max(0, Math.ceil(value * 4))) : 0;
}

export const DECISION_INTERIOR_LAYOUTS = Object.freeze([
  {id:'office',name:'Oficina',x:19,z:76,width:16,depth:13,height:3.1,doorX:19,doorZ:69.5,doorWidth:3,axis:'z',direction:1},
  {id:'bank',name:'Banco',x:76,z:19,width:13,depth:16,height:3.1,doorX:69.5,doorZ:19,doorWidth:3,axis:'x',direction:1},
  {id:'suppliers',name:'Proveedores',x:-76,z:-19,width:14,depth:17,height:3.1,doorX:-69,doorZ:-19,doorWidth:3,axis:'x',direction:-1}
].map(Object.freeze));

/** Presentation only: snapshot comes from the existing SIDE business model. */
export function createBusinessInteriors({ scene, offsetX = 150, createNpc, animateNpc, onCollidersAdded, getNeighbors } = {}) {
  const group = new THREE.Group(); group.name = 'SIDE connected businesses'; group.position.x = offsetX;
  scene?.add(group);
  const resources = new Set(), colliders = [], hotspots = [], rooms = [], animated = [];
  const zones = getBusinessZones(offsetX);
  const geometry = new THREE.BoxGeometry(1, 1, 1); resources.add(geometry);
  geometry.computeBoundingBox();
  const floors = [], floorMatrix = new THREE.Matrix4(), floorInverse = new THREE.Matrix4();
  const floorBounds = new THREE.Box3(), floorRay = new THREE.Ray(), floorHit = new THREE.Vector3();
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12); resources.add(cylinder);
  const scratch = new THREE.Object3D();
  const STORE_PROP_KEYS = Object.freeze([
    'table', 'counter', 'counterEnd', 'shelfTall', 'shelfLow', 'mirror', 'register',
    'entryDoor', 'windowPanel', 'ceilingLight', 'atm'
  ]);
  const WAREHOUSE_PROP_KEYS = Object.freeze([
    'boxLarge', 'boxLong', 'boxSmall', 'boxWide', 'loadingDoor', 'highWindow', 'floorArrow', 'warningBeacon',
    'pallet', 'rackTall', 'bagStack', 'cuttingTable', 'pendantLight', 'palletTruck', 'fabricRolls', 'fireExtinguisher', 'sewingMachine'
  ]);
  const PRODUCTION_PROP_KEYS = Object.freeze([
    'cuttingTable', 'sewingMachine', 'overlockMachine', 'ironingStation', 'fabricRolls',
    'rackTall', 'pendantLight', 'mannequin', 'garmentRack'
  ]);
  const qualityRank = mode => mode === 'low' ? 1 : mode === 'high' ? 3 : 2;
  let storePropQuality = 'auto', installedStoreTemplates = {}, installedWarehouseTemplates = {}, installedProductionTemplates = {};
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }); resources.add(value); return value;
  };
  const m = {
    plaster: material(0xd4d2c7), concrete: material(0x939890, { roughness: .96 }), floor: material(0xaaa99e, { roughness: .89 }),
    grout: material(0x8e928b, { roughness: .98 }),
    steel: material(0x687b82, { metalness: .72, roughness: .39 }), dark: material(0x203139, { metalness: .35, roughness: .58 }),
    mint: material(0x739f96), orange: material(0xbf823e), white: material(0xeae6da), wood: material(0x9a7450, { roughness: .92 }),
    leather: material(0x755246, { roughness: .64 }), tan: material(0xaf8b60, { roughness: .71 }), black: material(0x22282a),
    carton: material(0xae8e65, { roughness: .98 }), tape: material(0xd4b181), yellow: material(0xd2b148),
    glass: material(0x94b2b4, { transparent: true, opacity: .19, roughness: .14, metalness: .1, depthWrite: false }),
    light: material(0xf1f2e4, { emissive: 0xf1efce, emissiveIntensity: 1.1 }),
    screen: material(0x254c55, { emissive: 0x447b84, emissiveIntensity: .55 }),
    green: material(0x6fb388, { emissive: 0x45955e, emissiveIntensity: .6 })
  };

  function collider(x, z, w, d, kind, zone) {
    const value = { minX: offsetX + x - w / 2, maxX: offsetX + x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, kind, zone };
    colliders.push(value); return value;
  }
  function batchBuilder(parent) {
    const batches = new Map();
    function shape(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      scratch.position.set(x, y, z); scratch.rotation.set(rx, ry, rz); scratch.scale.set(sx, sy, sz); scratch.updateMatrix();
      const key = `${geo.uuid}:${mat.uuid}`;
      if (!batches.has(key)) batches.set(key, { geo, mat, matrices: [] });
      const placement=scratch.matrix.clone();batches.get(key).matrices.push(placement);
      return placement;
    }
    return {
      box: (x, y, z, w, h, d, mat, yaw = 0) => shape(geometry, mat, x, y, z, w, h, d, 0, yaw),
      cyl: (x, y, z, r, h, mat, rx = 0, rz = 0) => shape(cylinder, mat, x, y, z, r, h, r, rx, 0, rz),
      finish() {
        let instances = 0;
        for (const { geo, mat, matrices } of batches.values()) {
          const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
          matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.instanceMatrix.needsUpdate = true;
          mesh.castShadow = mat !== m.glass && mat !== m.light; mesh.receiveShadow = true; mesh.computeBoundingSphere();
          mesh.name = 'Business shared geometry'; parent.add(mesh); instances += matrices.length;
        }
        parent.userData.geometryInstances = instances; parent.userData.drawCalls = batches.size;
      }
    };
  }
  function clearPropModels(root) {
    root?.traverse(object => object.userData?.ownedPropGeometries?.forEach(geometry => geometry.dispose()));
    root?.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    root?.clear();
  }
  function propMatrix({ x, y = 0, z, yaw = 0, scale = [1, 1, 1] }) {
    const [sx, sy, sz] = scale;
    return new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
      new THREE.Vector3(sx, sy, sz)
    );
  }
  // Static GLBs keep their cached geometry and materials. Repeated modules are
  // emitted as InstancedMesh batches, so installing props never clones PBR
  // resources or turns a row of shelves into one draw call per copy.
  function compactPropSources(rawSources) {
    const groups = new Map();
    for (const source of rawSources) {
      const material = Array.isArray(source.material) ? null : source.material;
      const key = material?.uuid || `unmerged:${source.uuid}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(source);
    }
    const sources = [], owned = [];
    for (const grouped of groups.values()) {
      if (grouped.length === 1 || !grouped[0].material || Array.isArray(grouped[0].material)) {
        for (const source of grouped) sources.push({
          geometry: source.geometry, material: source.material, matrixWorld: source.matrixWorld
        });
        continue;
      }
      const parts = grouped.map(source => {
        const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
        geometry.applyMatrix4(source.matrixWorld);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        return geometry;
      });
      const vertices = parts.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
      const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3);
      let cursor = 0;
      for (const geometry of parts) {
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let index = 0; index < p.count; index++, cursor++) {
          position[cursor * 3] = p.getX(index); position[cursor * 3 + 1] = p.getY(index); position[cursor * 3 + 2] = p.getZ(index);
          normal[cursor * 3] = n.getX(index); normal[cursor * 3 + 1] = n.getY(index); normal[cursor * 3 + 2] = n.getZ(index);
        }
        geometry.dispose();
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      merged.computeBoundingBox(); merged.computeBoundingSphere(); owned.push(merged);
      sources.push({ geometry: merged, material: grouped[0].material, matrixWorld: new THREE.Matrix4() });
    }
    return { sources, owned };
  }
  function addPropBatch(root, template, placements, metadata) {
    if (!template?.traverse || !placements.length) return null;
    template.updateMatrixWorld?.(true);
    const rawSources = [];
    template.traverse(object => { if (object.isMesh && !object.isSkinnedMesh && object.geometry && object.material) rawSources.push(object); });
    if (!rawSources.length) return null;
    const { sources, owned } = compactPropSources(rawSources);
    const batch = new THREE.Group();
    const zone = metadata.zone || 'store';
    batch.name = `${zone} prop ${metadata.kind}`;
    batch.userData.streamedPropBatch = true;
    batch.userData[zone === 'warehouse' ? 'warehousePropBatch' : zone === 'production' ? 'productionPropBatch' : 'storePropBatch'] = true;
    const trianglesPerInstance = sources.reduce((sum, source) => {
      const indexCount = source.geometry.index?.count;
      const vertexCount = source.geometry.attributes?.position?.count || 0;
      return sum + Math.floor((indexCount || vertexCount) / 3);
    }, 0);
    Object.assign(batch.userData, metadata, {
      zone, instanceCount: placements.length, drawables: sources.length,
      triangles: trianglesPerInstance * placements.length,
      bays: [...new Set(placements.map(p => p.bay).filter(Boolean))],
      ownedPropGeometries: owned
    });
    const placementMatrices = placements.map(propMatrix);
    for (const source of sources) {
      const instance = new THREE.InstancedMesh(source.geometry, source.material, placements.length);
      placementMatrices.forEach((placement, index) => instance.setMatrixAt(index, placement.clone().multiply(source.matrixWorld)));
      instance.instanceMatrix.needsUpdate = true;
      instance.name = `${batch.name} shared mesh`;
      instance.castShadow = false; instance.receiveShadow = true;
      instance.computeBoundingSphere();
      batch.add(instance);
    }
    root.add(batch); return batch;
  }
  function sign(parent, text, subtitle, x, y, z, w, h, yaw = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = Math.round(768 * h / w);
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#23393e'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f1edde';
    ctx.font = `600 ${canvas.height * (subtitle ? .36 : .48)}px Arial`;
    ctx.fillText(text, canvas.width / 2, canvas.height * (subtitle ? .37 : .51), canvas.width * .94);
    if (subtitle) { ctx.fillStyle = '#a3c5b6'; ctx.font = `500 ${canvas.height * .16}px Arial`; ctx.fillText(subtitle, canvas.width / 2, canvas.height * .77, canvas.width * .94); }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; resources.add(map);
    const mat = material(0xffffff, { map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .22 });
    const geo = new THREE.PlaneGeometry(w, h); resources.add(geo);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.rotation.y = yaw; parent.add(mesh); return mesh;
  }
  const entrances = BUSINESS_LAYOUTS.map(b => ({ id: b.id, name: b.name, x: offsetX + b.doorX, z: b.doorZ + 1.6, rotation: Math.PI,
    portal: { x: offsetX + b.doorX, z: b.doorZ, halfWidth: b.doorWidth / 2 - .15, direction: -1 } }));

  const shell = batchBuilder(group);
  function buildShell(b) {
    const { x, z, width: w, depth: d, height: h, doorX: dx, doorZ: dz, doorWidth: dw } = b;
    // Floor finishes are flush with sidewalk; no artificial raised loading step.
    floors.push({parent:group,matrix:shell.box(x, .0075, z, w, .035, d, b.id === 'store' ? m.floor : m.concrete)});
    for (const side of [-1, 1]) {
      shell.box(x + side * w / 2, h / 2, z, .24, h, d, m.plaster);
      collider(x + side * w / 2, z, .24, d, 'wall', b.id);
    }
    shell.box(x, h / 2, z - d / 2, w, h, .24, m.plaster); collider(x, z - d / 2, w, .24, 'wall', b.id);
    for (const [left, right] of [[x - w / 2, dx - dw / 2], [dx + dw / 2, x + w / 2]]) {
      shell.box((left + right) / 2, 1.55, dz, right - left, 3.1, .2, b.id === 'store' ? m.glass : m.plaster);
      collider((left + right) / 2, dz, right - left, .2, 'wall', b.id);
    }
    shell.box(x, (h + 3.1) / 2, dz, w + .1, h - 3.1, .24, m.mint);
    // Clear opening: door panels retract completely outside the walking path.
    for (const side of [-1, 1]) {
      shell.box(dx + side * (dw / 2 + .1), 1.55, dz + .06, .14, 3.1, .25, m.dark);
      shell.box(dx + side * (dw / 2 + .31), 1.48, dz - .08, .23, 2.92, .14, b.id === 'store' ? m.glass : m.steel);
    }
    shell.box(dx, 3.14, dz, dw + .45, .14, .35, m.dark);
    shell.box(dx, .032, dz, dw, .025, .4, m.steel);
    shell.box(x, h + .04, z, w + .45, .16, d + .4, m.dark);
    for (let rz = z - d / 2 + .5; rz < z + d / 2; rz += 1.4) shell.box(x, h + .15, rz, w + .25, .05, .055, m.steel);
    shell.box(x, 3.3, dz + .45, w + .45, .15, 1.1, m.dark);
    sign(group, b.name.toUpperCase(), b.id === 'store' ? 'BOLSOS · DISEÑO · ATENCIÓN' : b.id === 'warehouse' ? 'RECEPCIÓN · RESERVA · DESPACHO' : 'CUERO · CORTE · COSTURA · ACABADO', x, h - .67, dz + .15, w * .8, .84);
    sign(group, 'ABIERTO', 'ACCESO PEATONAL', dx, 2.83, dz + .15, Math.min(dw - .2, 2.2), .35);
    sign(group, 'SALIDA', '', dx, 2.84, dz - .18, 1.2, .3, Math.PI);
    // Air-handling plant is sized as rooftop equipment, not a second floor.
    shell.box(x + w * .25, h + .48, z - 1.3, 2.1, .7, 1.3, m.steel);
    for (let a = -.8; a <= .8; a += .25) shell.box(x + w * .25 + a, h + .48, z - .63, .08, .49, .04, m.dark);
  }
  BUSINESS_LAYOUTS.forEach(buildShell);

  // Loading/parking bays leave the pedestrian doors and central roads clear.
  for (const [x, z, w, d] of [[-25, -8.8, 4.6, 4.1], [25.5, -8.8, 4.4, 4.1], [-25, 31, 4.6, 4.4]]) {
    for (const side of [-1, 1]) shell.box(x + side * w / 2, .047, z, .08, .025, d, m.white);
    shell.box(x, .047, z - d / 2, w, .025, .08, m.yellow);
  }
  // The admin annex belongs to this warehouse; it is not another scene.
  shell.box(-9.5, 2.9, -19, 6.4, 5.8, 14, m.mint); collider(-9.5, -19, 6.4, 14, 'building', 'annex');
  shell.box(-9.5, 5.87, -19, 6.7, .2, 14.3, m.dark);
  for (const x of [-11.1, -7.9]) for (const y of [1.8, 4.35]) shell.box(x, y, -11.93, 2.2, 1.4, .06, m.screen);
  sign(group, 'SIDE · ADMINISTRACIÓN', 'GESTIÓN EN EL PUNTO DE ATENCIÓN', -9.5, 3.05, -11.86, 5.7, .58);
  shell.finish();

  // Business customers use the same physical checkout and clear aisles as
  // the player. These positions are world coordinates, like the colliders.
  const queueSlots = [-14, -15.2, -16.4].map(x => ({ x: offsetX + x, z: 22.7 }));
  const salesAssistantPoint = { x: offsetX - 17, z: 16.2 };
  // Keep financial customers on the front circulation aisle: the runtime
  // connects these points directly, so diagonal approaches must also avoid
  // cutting through the checkout counter. Interior ambience NPCs browse the
  // deeper shelf aisles using their separate validated loops below.
  const browsePoints = [-23, -21.7, -20.4].map(x => ({ x: offsetX + x, z: 22.7 }));

  function hotspot(room, id, type, label, x, z, cat, extra = {}) { hotspots.push({ id, type, label, x: x + offsetX, z, cat, zone: room.id, ...extra }); }
  function solid(room, b, x, y, z, w, h, d, mat, kind = 'furniture') {
    b.box(x, y, z, w, h, d, mat); collider(x, z, w, d, kind, room.id);
  }
  function pallet(b, x, z, w = 1.2, d = .95) {
    for (const a of [-.38, 0, .38]) b.box(x + a * w, .10, z, .13, .17, d, m.wood);
    for (let a = -.42; a <= .43; a += .21) b.box(x, .21, z + a * d, w, .055, .15, m.wood);
  }
  function carton(b, x, y, z, size = .55) {
    b.box(x, y, z, size, size * .7, size * .74, m.carton); b.box(x, y + size * .355, z, .09, .012, size * .76, m.tape);
  }
  function handbag(b, x, y, z, color, scale = 1) {
    b.box(x, y + .14 * scale, z, .35 * scale, .27 * scale, .16 * scale, color);
    for (const side of [-1, 1]) b.box(x + side * .093 * scale, y + .33 * scale, z, .025 * scale, .16 * scale, .025 * scale, m.leather);
    b.box(x, y + .40 * scale, z, .20 * scale, .025 * scale, .025 * scale, m.leather);
    b.box(x, y + .20 * scale, z + .087 * scale, .05 * scale, .035 * scale, .012 * scale, m.orange);
  }
  function stockBatch(room, tier) {
    let stock = room.stock.find(entry => entry.tier === tier);
    if (!stock) {
      const group = new THREE.Group(); group.name = `${room.id} stock tier ${tier}`;
      room.detail.add(group); stock = { group, tier, batch: batchBuilder(group) }; room.stock.push(stock);
    }
    return stock.batch;
  }
  function shelf(room, b, x, z, w = 2.6, industrial = false) {
    const depth = industrial ? 1.3 : .7, height = industrial ? 3.6 : 2.1;
    collider(x, z, w + .1, depth, 'shelf', room.id);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * w / 2, height / 2, z + sz * (depth / 2 - .05), .08, height, .08, industrial ? m.steel : m.dark);
    for (let level = 0; level < 4; level++) {
      const y = .23 + level * (industrial ? .87 : .49);
      b.box(x, y, z, w, .07, depth, industrial ? m.orange : m.wood);
      const sb = stockBatch(room, level + 1);
      for (let i = 0; i < (industrial ? 4 : 5); i++) {
        const px = x - w * .37 + i * w * .74 / (industrial ? 3 : 4);
        if (industrial) carton(sb, px, y + .28, z, .62); else handbag(sb, px, y + .04, z, [m.leather, m.tan, m.black][i % 3]);
      }
    }
  }
  function table(room, b, x, z, w, d, kind = 'worktable') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(x + sx * (w / 2 - .1), .47, z + sz * (d / 2 - .1), .09, .90, .09, m.steel);
    b.box(x, .96, z, w, .09, d, m.white); collider(x, z, w, d, kind, room.id);
  }
  function route(room, role, points, stationary = false) {
    room.routes.push({ zone: room.id, role, stationary, points: points.map(([x, z]) => ({ x: offsetX + x, z })) });
  }

  for (const layout of BUSINESS_LAYOUTS) {
    const detail = new THREE.Group(); detail.name = `${layout.id} nearby detail`; group.add(detail);
    const propRoot = new THREE.Group(); propRoot.name = `${layout.id} streamed props`; detail.add(propRoot);
    const room = { id: layout.id, layout, detail, stock: [], actors: [], routes: [], lights: [], stockLevel: 0, realLightLimit: 2,
      propRoot, propFallbacks: new Map(), auxFallbacks: new Map() }; rooms.push(room);
    const b = batchBuilder(detail);
    const fallback = category => {
      if (!room.propFallbacks.has(category)) {
        const fallbackGroup = new THREE.Group(); fallbackGroup.name = `${room.id} ${category} procedural fallback`; detail.add(fallbackGroup);
        room.propFallbacks.set(category, { group: fallbackGroup, batch: batchBuilder(fallbackGroup) });
      }
      return room.propFallbacks.get(category).batch;
    };
    const auxFallback = category => {
      if (!room.auxFallbacks.has(category)) {
        const fallbackGroup = new THREE.Group(); fallbackGroup.name = `${room.id} ${category} auxiliary fallback`; detail.add(fallbackGroup);
        room.auxFallbacks.set(category, { group: fallbackGroup, batch: batchBuilder(fallbackGroup) });
      }
      return room.auxFallbacks.get(category).batch;
    };
    // Floor joints, skirting and ceiling beams keep metre-scale surfaces legible.
    for(const side of [-1,1])b.box(layout.x+side*(layout.width/2-.16),.1,layout.z,.045,.17,layout.depth-.3,m.dark);
    b.box(layout.x,.1,layout.z-layout.depth/2+.16,layout.width-.3,.17,.045,m.dark);
    const joint=room.id==='store'?1:3;
    for(let x=layout.x-layout.width/2+joint;x<layout.x+layout.width/2;x+=joint)b.box(x,.026,layout.z,.009,.002,layout.depth-.25,m.grout);
    for(let z=layout.z-layout.depth/2+joint;z<layout.z+layout.depth/2;z+=joint)b.box(layout.x,.026,z,layout.width-.25,.002,.009,m.grout);
    if(room.id!=='store')for(let z=layout.z-5;z<layout.z+6;z+=3)b.box(layout.x,layout.height-.23,z,layout.width-.3,.24,.14,m.steel);
    // Fixtures can be swapped independently while their very cheap emissive
    // glow remains available in every tier. Only a bounded number of fill
    // lights is enabled for the room currently occupied by the player.
    const ceilingFixtures = room.id === 'store' ? auxFallback('lighting') : fallback('lighting');
    for (const x of [layout.x - 4, layout.x + 4]) for (const z of [layout.z - 3, layout.z + 2]) {
      ceilingFixtures.box(x, layout.height - .21, z, 2, .1, .35, m.white);
      b.box(x, layout.height - .27, z, 1.8, .025, .26, m.light);
    }
    for (const z of [layout.z - 2.7, layout.z + 2.7]) {
      const light = new THREE.PointLight(0xfff0d6, 28, 15, 1.1); light.position.set(layout.x, Math.min(4, layout.height - .7), z);
      light.castShadow = false; light.visible = false; detail.add(light); room.lights.push(light);
    }
    if (room.id === 'store') {
      const shelfFallback = fallback('shelves'), checkoutFallback = fallback('checkout');
      const tableFallback = fallback('table'), mirrorFallback = fallback('mirrors');
      const atmFallback = auxFallback('atm');
      for (const x of [-24, -14]) { shelf(room, shelfFallback, x, 15.0); shelf(room, shelfFallback, x, 18.1); }
      // Central aisle (x=-19) stays clear from door to rear. Cash register is to the east.
      solid(room, checkoutFallback, -13.9, .52, 21.4, 3.25, 1.03, .85, m.wood, 'counter');
      checkoutFallback.box(-13.9, 1.075, 21.4, 3.4, .09, 1, m.white);
      checkoutFallback.box(-14.4, 1.18, 21.36, .52, .16, .42, m.dark); checkoutFallback.box(-14.4, 1.39, 21.37, .055, .32, .055, m.steel);
      checkoutFallback.box(-14.4, 1.57, 21.4, .49, .32, .055, m.screen); checkoutFallback.box(-13.65, 1.2, 21.37, .23, .14, .33, m.dark);
      checkoutFallback.box(-14.4, 1.27, 21.58, .5, .018, .06, m.black);
      solid(room, tableFallback, -24.6, .37, 21.7, 2.1, .72, 1.05, m.wood, 'display');
      const db = stockBatch(room, 1);
      for (const x of [-25.15, -24.55, -23.95]) handbag(db, x, .75, 21.7, m.tan, 1.12);
      // Mirrors keep a cheap procedural representation until their GLB arrives.
      for (const [x, z] of [[-26.86, 19.7], [-11.14, 17]]) {
        mirrorFallback.box(x, 1.55, z, .08, 1.28, 1.0, m.wood);
        mirrorFallback.box(x + (x < -19 ? .045 : -.045), 1.55, z, .018, 1.13, .86, m.glass);
      }
      // The ATM is a visual amenity only: it deliberately adds no collider or
      // interaction point, keeping the entrance and customer routes invariant.
      atmFallback.box(-22.7, .8, 23.55, .68, 1.6, .55, m.dark);
      atmFallback.box(-22.7, 1.24, 23.25, .48, .38, .035, m.screen);
      atmFallback.box(-22.7, .94, 23.24, .34, .06, .05, m.steel);
      sign(detail, 'COLECCIÓN SIDE', 'ESENCIAL · URBANO · PREMIUM', -19, 2.7, 14.15, 5.6, .65);
      sign(detail, 'CAJA / ATENCIÓN', '', -13.95, 2.5, 23.79, 2.9, .38, Math.PI);
      // A small stock preparation alcove, with a walkable side opening.
      solid(room, b, -26.5, .7, 16.7, .7, 1.4, 1.15, m.dark, 'reserve');
      carton(b, -26.5, 1.59, 16.7, .45);
      hotspot(room, 'store-sales', 'finance', 'Atención y puntos', -14, 22.7, 'comercial');
      hotspot(room, 'store-inventory', 'inventory', 'Exhibición e inventario', -21.5, 18.8, 'inventario');
      for (const [productId,label,x,z] of [['esencial','Bolso Básico',-24,19.15],['urbano','Bolso Mejorado',-14,19.15],['premium','Bolso Premium',-24,16.1]]) {
        hotspot(room, `product-${productId}`, 'product', label, x, z, 'comercial', {productId});
      }
      hotspot(room, 'store-office', 'decisions', 'Gestión de la empresa', -19, 15.6, 'empresa');
      solid(room,b,-20, .49,15.6,.48,.93,.43,m.dark,'terminal');
      b.box(-20,1.18,15.6,.5,.37,.06,m.screen);
      sign(detail,'GESTIÓN','DECISIONES DEL CICLO',-20,1.62,15.63,1.1,.3);
      route(room, 'cashier', [[-14, 20.2]], true);
      route(room, 'salesperson', [[-17, 15.2]], true);
      route(room, 'customer', [[-21.5, 20], [-21.5, 16.6], [-19, 16.6], [-19, 20]]);
      route(room, 'customer', [[-16.5, 16.7], [-16.5, 19.9], [-18, 19.9], [-18, 16.7]]);
    } else if (room.id === 'warehouse') {
      const rackFallback = fallback('racks'), workbenchFallback = fallback('workbench');
      const palletFallback = fallback('pallet'), truckFallback = fallback('palletTruck');
      const doorFallback = fallback('loadingDoor'), windowFallback = fallback('windows'), safetyFallback = fallback('safety');
      for (const x of [-25.2, -15.8]) for (const z of [-23.7, -19.5]) shelf(room, rackFallback, x, z, 3.1, true);
      // Receiving and packing stations flank the 3.6m doorway and wide main aisle.
      table(room, workbenchFallback, -25.2, -15.1, 3.2, 1.2); carton(workbenchFallback, -25.8, 1.22, -15.1, .6);
      workbenchFallback.box(-24.5, 1.1, -15.1, .52, .16, .39, m.dark); workbenchFallback.box(-24.5, 1.44, -15.25, .5, .34, .06, m.screen);
      pallet(palletFallback, -15.7, -15.4); collider(-15.7, -15.4, 1.25, 1, 'pallet', room.id);
      // Pending goods have not arrived: show a receiving marker rather than
      // drawing physical cartons that imply immediately available inventory.
      const pending = new THREE.Group(); pending.name = 'Pending delivery marker'; detail.add(pending); room.pending = pending;
      sign(pending, 'PEDIDO EN CAMINO', 'RECEPCIÓN PENDIENTE', -15.7, 1.25, -15.4, 2.1, .55);
      pending.visible = false;
      // Pallet jack parked outside the walking route.
      truckFallback.box(-27, .18, -16.5, .45, .18, .65, m.yellow);
      for (const x of [-27.23, -26.77]) { truckFallback.box(x, .12, -17.05, .12, .12, 1.2, m.yellow); truckFallback.cyl(x, .11, -17.5, .1, .12, m.black, 0, Math.PI / 2); }
      truckFallback.box(-27, .68, -16.24, .05, .9, .06, m.steel); truckFallback.box(-27, 1.14, -16.24, .42, .045, .06, m.dark);
      collider(-27, -16.9, .75, 1.6, 'equipment', room.id);
      // Structural props are decorative overlays on the existing solid shell.
      doorFallback.box(-20.5, 1.4, -25.84, 3.2, 2.8, .05, m.steel);
      for (const x of [-25, -16]) windowFallback.box(x, 4.85, -25.83, 2, 2.25, .04, m.screen);
      safetyFallback.cyl(-27.72, 1.1, -14.2, .12, .62, m.orange);
      for (const x of [-22.2, -18.2]) b.box(x, .038, -19, .075, .018, 11.8, m.yellow);
      sign(detail, 'RESERVA DE PRODUCTO TERMINADO', 'BOLSOS · INVENTARIO DE LA EMPRESA', -20.5, 4.4, -25.84, 10, .75);
      sign(detail, 'RECEPCIÓN', 'PEDIDOS A PROVEEDORES', -25, 2.3, -14.45, 3.5, .6);
      hotspot(room, 'warehouse-order', 'supplier', 'Recepción y pedidos', -24.6, -13.9, 'inventario');
      hotspot(room, 'warehouse-stock', 'inventory', 'Reserva de inventario', -20, -21.8, 'inventario');
      route(room, 'warehouse-worker', [[-23, -17.2], [-20.6, -17.2], [-20.6, -23], [-23, -23]]);
      route(room, 'warehouse-worker', [[-25.2, -16.35]], true);
    } else {
      // SIDE produces bags: leather cutting -> sewing/accessories -> finish/pack.
      // Visual fallbacks are split by station. Their colliders are still
      // registered by table/shelf/pallet and therefore survive a GLB swap.
      const cuttingFallback = fallback('cutting'), sewingFallback = fallback('sewing');
      const ironingFallback = fallback('ironing'), packingFallback = fallback('packing');
      const storageFallback = fallback('storage'), decorFallback = fallback('decor');
      table(room, cuttingFallback, 14.8, -15.5, 3.2, 1.5, 'machine');
      cuttingFallback.box(14.5, 1.025, -15.5, 1.95, .035, 1.1, m.leather); cuttingFallback.box(15.35, 1.07, -15.65, .42, .05, .72, m.tan);
      cuttingFallback.box(13.65, 1.1, -15.5, .12, .09, .6, m.steel);
      for (let i = 0; i < 4; i++) storageFallback.cyl(13.5 + i * .47, .55, -18.2, .2, 1.4, i % 2 ? m.tan : m.leather, Math.PI / 2);
      pallet(storageFallback, 14.2, -18.2, 2.1, 1.6); collider(14.2, -18.2, 2.2, 1.65, 'raw-material', room.id);
      for (const z of [-20.4, -23.4]) {
        table(room, sewingFallback, 15.1, z, 3.1, 1.2, 'machine');
        for (const x of [14.25, 15.9]) {
          sewingFallback.box(x, 1.01, z, .64, .055, .49, m.dark); sewingFallback.box(x + .17, 1.26, z, .19, .46, .28, m.white);
          sewingFallback.box(x - .04, 1.48, z, .52, .15, .26, m.white); sewingFallback.box(x - .23, 1.27, z, .07, .29, .09, m.steel);
          sewingFallback.cyl(x + .31, 1.35, z, .15, .07, m.dark, 0, Math.PI / 2); sewingFallback.cyl(x + .10, 1.68, z, .046, .18, m.tan);
          sewingFallback.box(x - .23, 1.15, z, .016, .1, .016, m.steel);
        }
      }
      table(room, ironingFallback, 24.7, -23.3, 3.5, 1.45, 'machine');
      for (const x of [23.8, 24.6, 25.4]) handbag(stockBatch(room, 1), x, 1.02, -23.3, m.leather);
      ironingFallback.box(26, 1.42, -23.55, .055, .86, .055, m.steel); ironingFallback.box(25.8, 1.87, -23.55, .5, .07, .3, m.light);
      table(room, packingFallback, 24.7, -19.6, 3.5, 1.2, 'worktable'); carton(packingFallback, 25.4, 1.28, -19.6, .68);
      packingFallback.box(23.7, 1.14, -19.6, .66, .25, .45, m.steel); packingFallback.box(23.7, 1.3, -19.6, .57, .035, .38, m.dark);
      shelf(room, storageFallback, 25.1, -15.2, 2.7, false);
      // Low-cost silhouettes make partial-load failures obvious without adding
      // physics; streamed decor replaces them on medium/high.
      decorFallback.cyl(26.7, .88, -17.2, .2, 1.72, m.white);
      decorFallback.box(23, .95, -25.25, .08, 1.8, .08, m.steel);
      decorFallback.box(23, 1.78, -25.25, 1.15, .06, .08, m.steel);
      sign(detail, '01 · CORTE', 'CUERO Y PATRONES', 14.8, 2.7, -16.4, 3.5, .55);
      sign(detail, '02 · COSTURA Y ENSAMBLADO', 'CUERO + HILO + ACCESORIOS', 16, 3.05, -25.82, 6.5, .65);
      sign(detail, '03 · ACABADO Y CONTROL', 'INSPECCIÓN · EMPAQUE', 24, 3.05, -25.82, 6.2, .65);
      for (const x of [18.2, 21.8]) b.box(x, .038, -19, .075, .018, 11.8, m.yellow);
      b.box(20, .045, -18.5, 1.3, .018, .1, m.yellow);
      hotspot(room, 'production-plan', 'production', 'Plan de producción', 20, -18, 'produccion');
      solid(room,b,19,.51,-18.7,.55,1.02,.45,m.dark,'terminal');
      b.box(19,1.31,-18.7,.55,.4,.065,m.screen);
      sign(detail,'CONTROL DE PRODUCCIÓN','CAPACIDAD · PRODUCTIVIDAD',19,1.9,-18.65,2.25,.4);
      hotspot(room, 'production-quality', 'production', 'Acabado y capacidad', 24, -21.4, 'produccion');
      route(room, 'sewing-operator', [[15.2, -21.55]], true);
      route(room, 'production-supervisor', [[21.1, -15.5], [21.1, -21.5], [22.1, -21.5], [22.1, -15.5]]);
      route(room, 'cutting-operator', [[14.8, -14.2]], true);
    }
    b.finish();
    room.propFallbacks.forEach(entry => entry.batch.finish());
    room.auxFallbacks.forEach(entry => entry.batch.finish());
    room.stock.forEach(stock => stock.batch.finish());
  }

  const builders = {office:buildOfficeInterior,bank:buildBankInterior,suppliers:buildSuppliersInterior};
  for (const layout of DECISION_INTERIOR_LAYOUTS) {
    const detail = new THREE.Group(); detail.name = `${layout.id} deferred interior`; detail.visible=false; group.add(detail);
    const room = {id:layout.id,layout,detail,stock:[],actors:[],routes:[],lights:[],stockLevel:0,realLightLimit:0,deferred:true};
    rooms.push(room);
    zones.push({id:layout.id,name:layout.name,minX:offsetX+layout.x-layout.width/2,maxX:offsetX+layout.x+layout.width/2,minZ:layout.z-layout.depth/2,maxZ:layout.z+layout.depth/2,ceilingY:3.1});
    const axis=layout.axis, direction=layout.direction;
    entrances.push({id:layout.id,name:layout.name,x:offsetX+layout.doorX-(axis==='x'?direction*1.6:0),z:layout.doorZ-(axis==='z'?direction*1.6:0),
      portal:{x:offsetX+layout.doorX,z:layout.doorZ,axis,direction,halfWidth:1.35}});
  }
  function ensureRoom(room) {
    if(!room.deferred)return;
    room.deferred=false;
    const before=colliders.length;
    const b=batchBuilder(room.detail),l=room.layout;
    floors.push({parent:room.detail,matrix:b.box(l.x,.0075,l.z,l.width-.24,.035,l.depth-.24,m.floor)});
    builders[room.id]({room,batch:b,m,collider,sign,hotspot,offsetX});
    for(const point of hotspots.filter(point=>point.zone===room.id&&point.type==='decisionZone'))point.category ||= point.cat;
    if(room.officeStations){
      const stations=room.officeStations;
      room.routes.push({zone:room.id,role:'oficina',stationary:true,points:[stations.finance]},
        {zone:room.id,role:'oficina',points:stations.patrol});
    }
    if(room.id==='bank')room.stateSigns=[{mesh:sign(room.detail,'MODO DIVERSIÓN','Recursos locales',l.x+1,2.4,l.z-7.8,4,.65),fields:['cash','debt','loan']}];
    npcRoutes.push(...room.routes);
    setQuality(storePropQuality);
    onCollidersAdded?.(colliders.slice(before));
    sync(snapshot);
  }
  function updateStateSigns(room,value) {
    for(const entry of room.stateSigns||[]){
      const number=(key)=>value[key]==null?'Sin datos':Number(value[key]).toLocaleString('es-PE');
      const text=room.id==='office'?`Ciclo ${number('round')} · Recursos ★ ${number('cash')}\nModo diversión: no afecta tus ingresos\nProductos de juego ${number('producedUnits')} · Pendientes ${number('pendingUnits')}`:
        `Recursos de juego ★ ${number('cash')} · Sin movimientos económicos`;
      const mesh=entry.mesh;if(mesh.userData.stateText===text)continue;
      mesh.userData.stateText=text;
      const canvas=mesh.material.map.image,ctx=canvas.getContext('2d');
      ctx.fillStyle='#23393e';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f1edde';ctx.textAlign='center';ctx.textBaseline='middle';
      const lines=text.split('\n');ctx.font=`500 ${canvas.height*(lines.length>1?.21:.3)}px Arial`;lines.forEach((line,index)=>ctx.fillText(line,canvas.width/2,canvas.height*(lines.length>1?.22+index*.29:.5),canvas.width*.95));mesh.material.map.needsUpdate=true;
    }
  }
  const interiorNavigation=createInteriorNavigation({THREE,rooms,colliders,offsetX});
  const npcRoutes = rooms.flatMap(room => room.routes);
  const zoneAt = position => zones.find(zone => position && position.x > zone.minX + .12 && position.x < zone.maxX - .12 && position.z > zone.minZ + .12 && position.z < zone.maxZ)?.id || null;
  // Query only the rendered floor instances, never props, roofs or flat navmesh.
  // Their placement is shared with the batch, and matrixWorld includes every
  // enclosing group's transform. Thus .025 is a local top, not a world height.
  function groundHeightAt(x,z) {
    if(disposed||!Number.isFinite(x)||!Number.isFinite(z))return null;
    let height=null;
    for(const floor of floors){
      floor.parent.updateWorldMatrix(true,false);
      floorMatrix.multiplyMatrices(floor.parent.matrixWorld,floor.matrix);
      floorBounds.copy(geometry.boundingBox).applyMatrix4(floorMatrix);
      if(x<floorBounds.min.x||x>floorBounds.max.x||z<floorBounds.min.z||z>floorBounds.max.z)continue;
      floorRay.origin.set(x,floorBounds.max.y+1,z);floorRay.direction.set(0,-1,0);
      floorInverse.copy(floorMatrix).invert();floorRay.applyMatrix4(floorInverse);
      if(!floorRay.intersectBox(geometry.boundingBox,floorHit))continue;
      const y=floorHit.applyMatrix4(floorMatrix).y;
      if(Number.isFinite(y)&&(height===null||y>height))height=y;
    }
    return height;
  }
  const storeRoom = rooms.find(room => room.id === 'store');
  const warehouseRoom = rooms.find(room => room.id === 'warehouse');
  const productionRoom = rooms.find(room => room.id === 'production');
  function templateValue(templates, key) { return templates instanceof Map ? templates.get(key) : templates?.[key]; }
  function sameStoreTemplates(next) { return STORE_PROP_KEYS.every(key => (templateValue(installedStoreTemplates, key) || null) === (templateValue(next, key) || null)); }
  function sameWarehouseTemplates(next) { return WAREHOUSE_PROP_KEYS.every(key => (templateValue(installedWarehouseTemplates, key) || null) === (templateValue(next, key) || null)); }
  function sameProductionTemplates(next) { return PRODUCTION_PROP_KEYS.every(key => (templateValue(installedProductionTemplates, key) || null) === (templateValue(next, key) || null)); }
  function setWarehouseQuality(mode = 'auto') {
    const rank = qualityRank(mode);
    warehouseRoom?.propRoot?.children.forEach(batch => {
      batch.visible = rank >= Number(batch.userData.minQuality || 1);
      const category = batch.userData.category;
      const cast = rank > 1 && (category === 'workbench' || category === 'palletTruck' || (rank > 2 && ['racks', 'pallet'].includes(category)));
      batch.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = cast; object.receiveShadow = rank > 1;
      });
    });
  }
  function setQuality(mode = 'auto') {
    storePropQuality = ['low', 'medium', 'high', 'auto'].includes(mode) ? mode : 'auto';
    const rank = qualityRank(storePropQuality);
    storeRoom?.propRoot?.children.forEach(batch => {
      batch.visible = rank >= Number(batch.userData.minQuality || 1);
      const category = batch.userData.category;
      const cast = rank > 1 && (category === 'checkout' || category === 'table' || category === 'atm' || (rank > 2 && category === 'shelves'));
      batch.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = cast; object.receiveShadow = rank > 1;
      });
    });
    for(const room of rooms.filter(room=>builders[room.id]))room.detail.traverse(object=>{if(object.isMesh){object.castShadow=rank>1;object.receiveShadow=rank>1;}});
    setWarehouseQuality(storePropQuality);
    setProductionQuality(storePropQuality);
    for (const room of rooms) room.realLightLimit = Math.max(0, rank - 1);
    return storePropQuality;
  }
  function installStoreProps(templates = {}, mode = storePropQuality) {
    if (!storeRoom) return { installed: [], quality: setQuality(mode) };
    if (sameStoreTemplates(templates) && storeRoom.propRoot.children.length) {
      setQuality(mode); return storePropState();
    }
    clearPropModels(storeRoom.propRoot);
    installedStoreTemplates = Object.fromEntries(STORE_PROP_KEYS.map(key => [key, templateValue(templates, key) || null]));
    const installed = new Set(), root = storeRoom.propRoot;
    const add = (key, placements, metadata) => addPropBatch(root, installedStoreTemplates[key], placements, metadata);

    if (installedStoreTemplates.table) {
      add('table', [{ x: -24.6, z: 21.7, scale: [1.05, 1, 1.05], bay: 'display' }],
        { kind: 'display-table', category: 'table', minQuality: 1 });
      installed.add('table');
    }
    if (installedStoreTemplates.counter && installedStoreTemplates.register) {
      add('counter', [-14.88, -13.9, -12.92].map(x => ({ x, z: 21.4, bay: 'checkout' })),
        { kind: 'checkout-counter', category: 'checkout', minQuality: 1 });
      if (installedStoreTemplates.counterEnd) add('counterEnd', [
        { x: -15.47, z: 21.4, bay: 'checkout' }, { x: -12.33, z: 21.4, yaw: Math.PI, bay: 'checkout' }
      ], { kind: 'checkout-ends', category: 'checkout', minQuality: 1 });
      add('register', [{ x: -14.4, y: .96, z: 21.36, yaw: Math.PI, bay: 'checkout' }],
        { kind: 'cash-register', category: 'checkout', minQuality: 1 });
      installed.add('checkout');
    }
    if (installedStoreTemplates.shelfTall || installedStoreTemplates.shelfLow) {
      const tall = installedStoreTemplates.shelfTall ? 'shelfTall' : 'shelfLow';
      const low = installedStoreTemplates.shelfLow ? 'shelfLow' : tall;
      add(tall, [
        { x: -24, z: 15, scale: [2.9, 1, 1.15], bay: 'rear-left' },
        { x: -14, z: 15, scale: [2.9, 1, 1.15], bay: 'rear-right' }
      ], { kind: 'shelves-rear', category: 'shelves', minQuality: 1 });
      add(low, [
        { x: -24, z: 18.1, scale: [2.65, 1, 1.1], bay: 'front-left' },
        { x: -24, y: .925, z: 18.1, scale: [2.65, 1, 1.1], bay: 'front-left' },
        { x: -14, z: 18.1, scale: [2.65, 1, 1.1], bay: 'front-right' },
        { x: -14, y: .925, z: 18.1, scale: [2.65, 1, 1.1], bay: 'front-right' }
      ], { kind: 'shelves-front', category: 'shelves', minQuality: 1 });
      installed.add('shelves');
    }
    if (installedStoreTemplates.mirror) {
      add('mirror', [{ x: -26.86, y: .55, z: 19.7, yaw: Math.PI / 2, scale: [1.75, 2.25, .65], bay: 'west' }],
        { kind: 'mirror-west', category: 'mirrors', minQuality: 1 });
      add('mirror', [{ x: -11.14, y: .55, z: 17, yaw: -Math.PI / 2, scale: [1.75, 2.25, .65], bay: 'east' }],
        { kind: 'mirror-east', category: 'mirrors', minQuality: 2 });
      installed.add('mirrors');
    }
    if (installedStoreTemplates.entryDoor) {
      add('entryDoor', [
        { x: -20.6, z: 23.92, yaw: Math.PI / 2, bay: 'entry-west' },
        { x: -17.4, z: 23.92, yaw: -Math.PI / 2, bay: 'entry-east' }
      ], { kind: 'entry-door-open', category: 'doors', minQuality: 2 });
      installed.add('doors');
    }
    if (installedStoreTemplates.windowPanel) {
      add('windowPanel', [
        { x: -23.7, y: .5, z: 23.89, bay: 'front-west' },
        { x: -14.3, y: .5, z: 23.89, bay: 'front-east' }
      ], { kind: 'front-window-panels', category: 'windows', minQuality: 2 });
      installed.add('windows');
    }
    if (installedStoreTemplates.ceilingLight) {
      add('ceilingLight', [-23, -15].flatMap(x => [16, 21].map(z => ({ x, y: 4.25, z, bay: `light-${x}:${z}` }))),
        { kind: 'ceiling-light-fixtures', category: 'lighting', minQuality: 1 });
      installed.add('lighting');
    }
    if (installedStoreTemplates.atm) {
      add('atm', [{ x: -22.7, z: 23.55, yaw: Math.PI, bay: 'entry-atm' }],
        { kind: 'entry-atm', category: 'atm', minQuality: 1 });
      installed.add('atm');
    }
    storeRoom.propFallbacks.forEach((entry, category) => { entry.group.visible = !installed.has(category); });
    storeRoom.auxFallbacks.forEach((entry, category) => { entry.group.visible = !installed.has(category); });
    setQuality(mode);
    return storePropState();
  }
  function storePropState() {
    const batches = storeRoom?.propRoot?.children.filter(child => child.userData.storePropBatch) || [];
    const visible = batches.filter(batch => batch.visible);
    return {
      quality: storePropQuality,
      installed: [...new Set(batches.map(batch => batch.userData.category))].sort(),
      batches: batches.length,
      visibleBatches: visible.length,
      instances: batches.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      visibleInstances: visible.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      drawables: visible.reduce((sum, batch) => sum + Number(batch.userData.drawables || 0), 0),
      triangles: visible.reduce((sum, batch) => sum + Number(batch.userData.triangles || 0), 0),
      realLights: storeRoom?.realLightLimit || 0,
      visibleShelfBays: [...new Set(visible.filter(batch => batch.userData.category === 'shelves').flatMap(batch => batch.userData.bays || []))].length,
      visibleMirrors: visible.filter(batch => batch.userData.category === 'mirrors').reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0)
    };
  }
  function installWarehouseProps(templates = {}, mode = storePropQuality) {
    if (!warehouseRoom) return { installed: [], quality: setQuality(mode) };
    if (sameWarehouseTemplates(templates) && warehouseRoom.propRoot.children.length) {
      setQuality(mode); return warehousePropState();
    }
    clearPropModels(warehouseRoom.propRoot);
    installedWarehouseTemplates = Object.fromEntries(WAREHOUSE_PROP_KEYS.map(key => [key, templateValue(templates, key) || null]));
    const installed = new Set(), root = warehouseRoom.propRoot;
    const add = (key, placements, metadata) => addPropBatch(root, installedWarehouseTemplates[key], placements, {...metadata, zone: 'warehouse'});

    if (installedWarehouseTemplates.rackTall) {
      const placements = [];
      for (const x of [-25.2, -15.8]) for (const z of [-23.7, -19.5]) for (const offset of [-.78, .78]) {
        placements.push({ x: x + offset, z, scale: [.95, 1.4, 1.8], bay: `${x}:${z}` });
      }
      add('rackTall', placements, { kind: 'rack-bays', category: 'racks', minQuality: 1 });
      if (installedWarehouseTemplates.bagStack) add('bagStack', [
        { x: -25.2, y: 3.36, z: -23.7, scale: [.8, .8, .8], bay: '-25.2:-23.7' }
      ], { kind: 'rack-bag-stack', category: 'racks', minQuality: 1 });
      installed.add('racks');
    }
    if (installedWarehouseTemplates.cuttingTable && installedWarehouseTemplates.sewingMachine) {
      add('cuttingTable', [
        { x: -25.95, z: -15.1, scale: [1.25, 1, 1.05], bay: 'receiving-left' },
        { x: -24.55, z: -15.1, scale: [1.25, 1, 1.05], bay: 'receiving-right' }
      ], { kind: 'receiving-workbenches', category: 'workbench', minQuality: 1 });
      add('sewingMachine', [{ x: -24.55, y: .91, z: -15.1, bay: 'receiving-right' }],
        { kind: 'sewing-station', category: 'workbench', minQuality: 1 });
      if (installedWarehouseTemplates.fabricRolls) add('fabricRolls', [
        { x: -25.95, y: .91, z: -15.1, scale: [.5, .5, .5], bay: 'receiving-left' }
      ], { kind: 'fabric-station', category: 'workbench', minQuality: 1 });
      installed.add('workbench');
    }
    if (installedWarehouseTemplates.pallet) {
      add('pallet', [{ x: -15.7, z: -15.4, yaw: Math.PI / 2, scale: [.94, .94, .94], bay: 'receiving-pallet' }],
        { kind: 'receiving-pallet', category: 'pallet', minQuality: 1 });
      const cargo = [
        ['boxLarge', { x: -15.7, y: .15, z: -15.4, scale: [.62, .62, .62], bay: 'receiving-pallet' }],
        ['boxLong', { x: -15.7, y: .50, z: -15.4, scale: [.68, .68, .68], bay: 'receiving-pallet' }],
        ['boxSmall', { x: -15.95, y: .81, z: -15.4, scale: [.75, .75, .75], bay: 'receiving-pallet' }],
        ['boxWide', { x: -15.50, y: .81, z: -15.4, scale: [.65, .65, .65], bay: 'receiving-pallet' }]
      ];
      for (const [key, placement] of cargo) if (installedWarehouseTemplates[key]) {
        add(key, [placement], { kind: key, category: 'pallet', minQuality: 1 });
      }
      installed.add('pallet');
    }
    if (installedWarehouseTemplates.palletTruck) {
      add('palletTruck', [{ x: -27, z: -16.9, scale: [.9, .9, .9], bay: 'pallet-truck' }],
        { kind: 'pallet-truck', category: 'palletTruck', minQuality: 1 });
      installed.add('palletTruck');
    }
    if (installedWarehouseTemplates.loadingDoor) {
      add('loadingDoor', [{ x: -20.5, z: -25.83, bay: 'rear-loading' }],
        { kind: 'loading-door', category: 'loadingDoor', minQuality: 1 });
      installed.add('loadingDoor');
    }
    if (installedWarehouseTemplates.highWindow) {
      add('highWindow', [-25, -16].map(x => ({ x, y: 3.7, z: -25.82, scale: [1, .8, .04], bay: `window-${x}` })),
        { kind: 'high-windows', category: 'windows', minQuality: 2 });
      installed.add('windows');
    }
    if (installedWarehouseTemplates.pendantLight) {
      add('pendantLight', [{ x: -24.5, y: 5.75, z: -22, bay: 'light-1' }, { x: -16.5, y: 5.75, z: -16, bay: 'light-2' }],
        { kind: 'essential-lights', category: 'lighting', minQuality: 1 });
      add('pendantLight', [{ x: -16.5, y: 5.75, z: -22, bay: 'light-3' }, { x: -24.5, y: 5.75, z: -16, bay: 'light-4' }],
        { kind: 'detail-lights', category: 'lighting', minQuality: 2 });
      installed.add('lighting');
    }
    if (installedWarehouseTemplates.fireExtinguisher) {
      add('fireExtinguisher', [{ x: -27.72, y: .8, z: -14.2, yaw: Math.PI / 2, bay: 'west-safety' }],
        { kind: 'fire-extinguisher', category: 'safety', minQuality: 1 });
      if (installedWarehouseTemplates.floorArrow) {
        add('floorArrow', [{ x: -20, y: .04, z: -14, yaw: Math.PI, bay: 'arrow-entry' }],
          { kind: 'essential-floor-arrow', category: 'safety', minQuality: 1 });
        add('floorArrow', [{ x: -20, y: .04, z: -18, yaw: Math.PI, bay: 'arrow-mid' }, { x: -20, y: .04, z: -22, yaw: Math.PI, bay: 'arrow-rear' }],
          { kind: 'detail-floor-arrows', category: 'safety', minQuality: 2 });
      }
      if (installedWarehouseTemplates.warningBeacon) add('warningBeacon', [
        { x: -27.2, z: -13.2, bay: 'beacon-west' }, { x: -13.8, z: -13.2, bay: 'beacon-east' }
      ], { kind: 'warning-beacons', category: 'safety', minQuality: 2 });
      installed.add('safety');
    }
    warehouseRoom.propFallbacks.forEach((entry, category) => { entry.group.visible = !installed.has(category); });
    setQuality(mode);
    return warehousePropState();
  }
  function warehousePropState() {
    const batches = warehouseRoom?.propRoot?.children.filter(child => child.userData.warehousePropBatch) || [];
    const visible = batches.filter(batch => batch.visible);
    return {
      quality: storePropQuality,
      installed: [...new Set(batches.map(batch => batch.userData.category))].sort(),
      batches: batches.length,
      instances: batches.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      visibleBatches: visible.length,
      visibleInstances: visible.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      rackBays: [...new Set(visible.filter(batch => batch.userData.category === 'racks').flatMap(batch => batch.userData.bays || []))].length,
      lights: visible.filter(batch => batch.userData.category === 'lighting').reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0)
    };
  }
  function setProductionQuality(mode = 'auto') {
    const rank = qualityRank(mode);
    const batches = productionRoom?.propRoot?.children || [];
    const installed = new Set(batches.map(batch => batch.userData.category));
    // Low keeps the cheapest procedural silhouettes for the mesh-heavy
    // machinery and luminaires. Medium/high swap those categories to their
    // detailed GLBs; physics remains unchanged because both are visual-only.
    const lowFallback = category => rank === 1 && ['sewing', 'ironing', 'storage', 'lighting'].includes(category);
    productionRoom?.propFallbacks?.forEach((entry, category) => {
      entry.group.visible = (!installed.has(category) || lowFallback(category)) && (category !== 'decor' || rank >= 2);
    });
    batches.forEach(batch => {
      batch.visible = rank >= Number(batch.userData.minQuality || 1) && !lowFallback(batch.userData.category);
      const category = batch.userData.category;
      const cast = rank > 1 && (category === 'cutting' || category === 'ironing' || (rank > 2 && ['sewing', 'storage', 'decor'].includes(category)));
      batch.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = cast; object.receiveShadow = rank > 1;
      });
    });
  }
  function installProductionProps(templates = {}, mode = storePropQuality) {
    if (!productionRoom) return { installed: [], quality: setQuality(mode) };
    if (sameProductionTemplates(templates) && productionRoom.propRoot.children.length) {
      setQuality(mode); return productionPropState();
    }
    clearPropModels(productionRoom.propRoot);
    installedProductionTemplates = Object.fromEntries(PRODUCTION_PROP_KEYS.map(key => [key, templateValue(templates, key) || null]));
    const root = productionRoom.propRoot;
    const add = (key, placements, metadata) => addPropBatch(root, installedProductionTemplates[key], placements, {...metadata, zone: 'production'});

    if (installedProductionTemplates.cuttingTable) {
      add('cuttingTable', [13.75, 14.8, 15.85].map((x, index) => ({ x, z: -15.5, scale: [1.05, 1, 1.42], bay: `cutting-${index + 1}` })),
        { kind: 'cutting-tables', category: 'cutting', minQuality: 1 });
      add('cuttingTable', [23.65, 24.7, 25.75].map((x, index) => ({ x, z: -19.6, scale: [1.05, 1, 1.15], bay: `packing-${index + 1}` })),
        { kind: 'packing-tables', category: 'packing', minQuality: 1 });
    }
    if (installedProductionTemplates.cuttingTable && installedProductionTemplates.sewingMachine && installedProductionTemplates.overlockMachine) {
      const sewingPositions = [
        { x: 14.25, z: -20.4, bay: 'sewing-front' }, { x: 14.25, z: -23.4, bay: 'sewing-rear' }
      ];
      const overlockPositions = [
        { x: 15.9, z: -20.4, bay: 'overlock-front' }, { x: 15.9, z: -23.4, bay: 'overlock-rear' }
      ];
      add('cuttingTable', [...sewingPositions, ...overlockPositions].map(p => ({ ...p, scale: [1.32, 1, 1.05] })),
        { kind: 'sewing-worktables', category: 'sewing', minQuality: 1 });
      add('sewingMachine', sewingPositions.map(p => ({ ...p, y: .91, yaw: Math.PI })),
        { kind: 'industrial-sewing-machines', category: 'sewing', minQuality: 1 });
      add('overlockMachine', overlockPositions.map(p => ({ ...p, y: .91, yaw: Math.PI })),
        { kind: 'overlock-machines', category: 'sewing', minQuality: 1 });
    }
    if (installedProductionTemplates.ironingStation) {
      add('ironingStation', [{ x: 24.7, z: -23.3, yaw: Math.PI / 2, bay: 'finishing' }],
        { kind: 'industrial-ironing', category: 'ironing', minQuality: 1 });
    }
    if (installedProductionTemplates.fabricRolls && installedProductionTemplates.rackTall) {
      add('fabricRolls', [{ x: 14.2, z: -18.2, yaw: Math.PI / 2, scale: [1.15, 1.15, 1.15], bay: 'raw-material' }],
        { kind: 'fabric-roll-storage', category: 'storage', minQuality: 1 });
      add('rackTall', [{ x: 25.1, z: -15.2, scale: [1.65, .95, 1.05], bay: 'supply-rack' }],
        { kind: 'production-rack', category: 'storage', minQuality: 1 });
    }
    if (installedProductionTemplates.pendantLight) {
      // One instanced batch is cheaper than splitting the same fixture model
      // into two identical material groups. Low uses the procedural fixture;
      // medium/high display all four streamed pendants.
      add('pendantLight', [
        { x: 16, y: 5.75, z: -17, bay: 'light-1' }, { x: 24, y: 5.75, z: -22, bay: 'light-2' },
        { x: 16, y: 5.75, z: -22, bay: 'light-3' }, { x: 24, y: 5.75, z: -17, bay: 'light-4' }
      ], { kind: 'production-pendant-lights', category: 'lighting', minQuality: 1 });
    }
    if (installedProductionTemplates.mannequin && installedProductionTemplates.garmentRack) {
      add('mannequin', [{ x: 26.7, z: -17.2, yaw: -Math.PI / 4, bay: 'quality-display' }],
        { kind: 'quality-mannequin', category: 'decor', minQuality: 2 });
      add('garmentRack', [{ x: 23, z: -25.25, yaw: Math.PI / 2, bay: 'finished-goods' }],
        { kind: 'finished-garment-rack', category: 'decor', minQuality: 2 });
    }
    setQuality(mode);
    return productionPropState();
  }
  function productionPropState() {
    const batches = productionRoom?.propRoot?.children.filter(child => child.userData.productionPropBatch) || [];
    const visible = batches.filter(batch => batch.visible);
    return {
      quality: storePropQuality,
      installed: [...new Set(batches.map(batch => batch.userData.category))].sort(),
      batches: batches.length,
      instances: batches.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      visibleBatches: visible.length,
      visibleInstances: visible.reduce((sum, batch) => sum + Number(batch.userData.instanceCount || 0), 0),
      drawables: visible.reduce((sum, batch) => sum + Number(batch.userData.drawables || 0), 0),
      triangles: visible.reduce((sum, batch) => sum + Number(batch.userData.triangles || 0), 0),
      realLights: productionRoom?.realLightLimit || 0
    };
  }
  let snapshot = {}, disposed = false, courier = null;
  function sync(value = {}) {
    // `js/simulator3d.js` owns the financial model and sends a read-only
    // projection. Keep the older ratio aliases for callers from earlier
    // builds, but prefer the current snapshot contract (`storeFill`,
    // `warehouseFill`, `pendingUnits`, `producedUnits`, `plannedUnits`).
    const next = value && typeof value === 'object' ? value : {};
    snapshot = next;
    const productionRatio = next.productionFill ?? next.productionStockRatio ?? (
      Number.isFinite(Number(next.producedUnits)) && Number(next.plannedUnits) > 0
        ? Number(next.producedUnits) / Number(next.plannedUnits)
        : 0
    );
    const ratios = {
      store: next.storeFill ?? next.storeStockRatio ?? next.inventoryRatio ?? 0,
      warehouse: next.warehouseFill ?? next.warehouseStockRatio ?? next.inventoryRatio ?? 0,
      production: productionRatio
    };
    const pendingUnits = Math.max(0, Number(next.pendingUnits ?? next.warehousePendingUnits ?? 0) || 0);
    for (const room of rooms) {
      room.syncState?.(next); updateStateSigns(room,next);
      const level = stockVisualLevel(ratios[room.id]); room.stockLevel = level;
      for (const tier of room.stock) tier.group.visible = tier.tier <= level;
      // A pending order is shown in the receiving area only. It never adds
      // units to stock; delivery changes the authoritative reserve/fill data.
      if (room.pending) {
        room.pending.visible = pendingUnits > 0;
        room.pending.userData.pendingUnits = pendingUnits;
      }
    }
  }
  function ensureActors(room) {
    if (!createNpc) return;
    for (const route of room.routes) {
      if(room.actors.some(actor=>actor.route===route))continue;
      const object = createNpc(route.role, room); if (!object) continue;
      const start = route.points[0]; object.position.set(start.x - offsetX, .025, start.z);
      object.name = `SIDE ${route.zone} ${route.role}`; room.detail.add(object);
      room.actors.push({ object, route, target: route.stationary ? 0 : 1, wait: room.actors.length * .35 });
    }
  }
  function tickCourier(dt, position) {
    // A single courier is enough to show the complete physical workflow. It
    // operates only while the authoritative snapshot says production can run.
    const active=Boolean(snapshot.productionActive&&Number(snapshot.reserve||0)>0);
    if(!active||qualityRank(storePropQuality)<2){
      if(courier)courier.object.visible=false;
      return;
    }
    if(!courier){
      const object=createNpc?.('warehouse-worker');
      if(!object)return;
      object.name='SIDE logistics courier';object.position.set(-22,.025,-16.1);
      group.add(object);
      courier={object,index:0,path:[],motion:{speed:0,yaw:0},wait:0};
    }
    const {object}=courier;
    const world={x:object.position.x+offsetX,z:object.position.z};
    object.visible=true;
    const stage=WORKER_CYCLE[courier.index];
    if(courier.wait>0){
      courier.wait=Math.max(0,courier.wait-dt);
      courier.motion.speed=0;
      object.userData.cityRequestedAction=courier.pauseAction||null;
      animateNpc?.(object,dt,false);
      return;
    }
    object.userData.cityRequestedAction=stage.action==='carry'?'carry':null;
    if(!courier.path.length){
      const target={x:stage.x+offsetX,z:stage.z};
      courier.path=npcNavigation.planPath(world,target,colliders);
      if(!courier.path.length){animateNpc?.(object,dt,false);return}
    }
    const target=courier.path[0],motion=courier.motion;
    Object.assign(motion,{x:world.x,z:world.z});
    const neighbors=getNeighbors?.(object)||rooms.flatMap(room=>room.actors.map(actor=>({x:actor.object.position.x+offsetX,z:actor.object.position.z,radius:npcNavigation.NPC_RADIUS})));
    if(position&&!getNeighbors)neighbors.push({x:position.x,z:position.z,radius:position.radius||.36});
    const result=npcNavigation.advance(motion,{x:target[0],z:target[1]},dt,colliders,neighbors,.85,courier.path.length===1);
    object.position.x=motion.x-offsetX;object.position.z=motion.z;object.rotation.y=motion.yaw;
    animateNpc?.(object,dt,result.distance>.0001);
    if(result.arrived){
      courier.path.shift();
      if(!courier.path.length){courier.wait=stage.wait||0;courier.pauseAction=stage.action||null;courier.index=(courier.index+1)%WORKER_CYCLE.length}
    }
  }
  function tick(dt, position, time = 0) {
    if (disposed) return;
    dt = Math.max(0, Math.min(.05, Number(dt) || 0)); const active = zoneAt(position);
    for (const room of rooms) {
      // The city is one running simulation; a doorway only changes the HUD.
      // Three.js frustum culling handles off-screen geometry without stopping staff.
      room.detail.visible = true;
      const inside = active === room.id; room.lights.forEach((light, index) => { light.visible = inside && index < Number(room.realLightLimit || 0); });
      for (const actor of room.actors) actor.object.visible = true;
      for (const actor of room.actors) {
        const { object, route } = actor;
        const target = route.points[actor.target];
        let moving = false;
        if(actor.wait>0){actor.wait=Math.max(0,actor.wait-dt);animateNpc?.(object,dt,false);continue;}
        if (!route.stationary) {
          const blocks=colliders.filter(item=>item.zone===room.id);
          const world={x:object.position.x+offsetX,z:object.position.z};
          if(!actor.path?.length)actor.path=interiorNavigation.plan(room,world,target,storePropQuality);
          const waypoint=actor.path?.[0];
          if(waypoint){
            const motion=actor.motion||(actor.motion={speed:0,yaw:object.rotation.y});
            Object.assign(motion,{x:world.x,z:world.z});
            const neighbors=getNeighbors?.(object)||room.actors.filter(other=>other!==actor).map(other=>({x:other.object.position.x+offsetX,z:other.object.position.z,radius:npcNavigation.NPC_RADIUS}));
            if(position&&!getNeighbors)neighbors.push({x:position.x,z:position.z,radius:position.radius||.36});
            const step=interiorNavigation.advance(room,motion,{x:waypoint[0],z:waypoint[1]},dt,neighbors,.65,storePropQuality,actor.path.length===1);
            object.position.x=motion.x-offsetX;object.position.z=motion.z;object.rotation.y=motion.yaw;
            moving=step.distance>.0001;
            actor.blockedFor=moving?0:(actor.blockedFor||0)+dt;
            if(actor.blockedFor>1.8){
              // Replan around occupied bodies, preserving the assigned work loop.
              const people=neighbors.filter(p=>Math.hypot(p.x-world.x,p.z-world.z)<4).map(p=>({minX:p.x-.35,maxX:p.x+.35,minZ:p.z-.35,maxZ:p.z+.35}));
              const detour=npcNavigation.planPath(motion,target,[...blocks,...people]);
              if(detour.length)actor.path=detour;
              actor.blockedFor=0;
            }
            if(step.arrived){actor.path.shift();if(!actor.path.length){actor.target=(actor.target+1)%route.points.length;actor.wait=route.role==='cliente'?2: .7;}}
          }
        }
        animateNpc?.(object, dt, moving);
      }
    }
    tickCourier(dt,position);
    for (const animation of animated) animation.object.position.y = animation.y + (snapshot.productionActive ? Math.sin(time * 20 + animation.phase) * .045 : 0);
    group.userData.activeZone = active;
  }
  // Prepare every establishment before the caller copies collisions/hotspots.
  // Each room and staff actor is allocated once, independently of player position.
  for (const room of rooms) { ensureRoom(room); ensureActors(room); room.detail.visible = true; }
  sync();
  group.userData.connectedWorld = true;
  return {
    group, colliders, entrances, zones, hotspots, interactionPoints: hotspots, npcRoutes, rooms,
    queueSlots, checkoutQueueSlots: queueSlots, browsePoints, salesAssistantPoint,
    zoneAt, groundHeightAt, sync, update: sync, tick, ensureRoom, interiorNavigation, installStoreProps, installWarehouseProps, installProductionProps, setQuality,
    stats() {
      let instancedBatches = 0, geometryInstances = 0, visibleBatches = 0;
      group.traverse(object => {
        if (object.isInstancedMesh) { instancedBatches++; geometryInstances += object.count; }
      });
      group.traverseVisible(object => { if (object.isMesh) visibleBatches++; });
      return { rooms: rooms.length, deferredRooms: rooms.filter(room=>room.deferred).length, navigation:interiorNavigation.stats(), colliders: colliders.length,
        stockLevels: Object.fromEntries(rooms.map(room => [room.id, room.stockLevel])),
        activeNpcs: rooms.reduce((n, r) => n + r.actors.length, 0),
        activeLights: rooms.reduce((n, r) => n + r.lights.filter(l => l.visible && r.detail.visible).length, 0),
        instancedBatches, geometryInstances, visibleBatches,
        sharedGeometries: 2, stockBatches: rooms.reduce((n, room) => n + room.stock.reduce((s, stock) => s + stock.group.children.length, 0), 0),
        storeProps: storePropState(), warehouseProps: warehousePropState(), productionProps: productionPropState()
      };
    },
    dispose() {
      if (disposed) return; disposed = true; interiorNavigation.dispose(); group.removeFromParent();
      group.traverse(object => object.userData?.ownedPropGeometries?.forEach(geometry => geometry.dispose()));
      group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      resources.forEach(resource => resource.dispose()); rooms.forEach(room => { room.actors.length = 0; }); courier=null; group.clear();
    }
  };
}
