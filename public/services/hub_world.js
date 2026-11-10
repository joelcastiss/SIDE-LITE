import * as THREE from '../vendor/three/build/three.module.js';
import { crossedEntrance } from './world_portals.mjs';

// Every visible surface is world geometry. No screenshot, backdrop render, or
// generated image is used; the hub works from ground level and from orbit.
const DISTRICTS = [
  { id: 'miraflores', label: 'MIRAFLORES' },
  { id: 'olivos', label: 'LOS OLIVOS' },
  { id: 'sjl', label: 'SAN JUAN DE LURIGANCHO' }
];

// Local hub coordinates. The three existing business interiors keep their
// original positions; all callers add offsetX only to the X coordinate.
export const CITY_MAP = Object.freeze({
  bounds: Object.freeze({ minX: -88, maxX: 88, minZ: -88, maxZ: 88 }),
  visualExtent: 180,
  zones: Object.freeze([
    Object.freeze({ id: 'store', name: 'Tienda', x: -19, z: 19 }),
    Object.freeze({ id: 'warehouse', name: 'Almacén', x: -20.5, z: -19 }),
    Object.freeze({ id: 'production', name: 'Producción', x: 20, z: -19 }),
    Object.freeze({ id: 'office', name: 'Oficina', x: 19, z: 76 }),
    Object.freeze({ id: 'bank', name: 'Banco', x: 76, z: 19 }),
    Object.freeze({ id: 'suppliers', name: 'Proveedores', x: -76, z: -19 }),
    Object.freeze({ id: 'news', name: 'Buzón de noticias', x: 19, z: 29 })
  ])
});

function seededRandom(seed = 4107) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function texture(kind) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'); const random = seededRandom(kind.length * 1307);
  const palette = { asphalt: '#43484b', paving: '#b6b3a8', concrete: '#c7c3b6', plaster: '#e0ddd2', wood: '#a4794d', metal: '#b7bcc0', grass: '#637c4d' };
  ctx.fillStyle = palette[kind] || palette.concrete; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 16000; i++) {
    const n = Math.floor(random() * 255); ctx.fillStyle = `rgba(${n},${n},${n},${kind === 'asphalt' ? .19 : .07})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
  }
  if (kind === 'paving' || kind === 'concrete') {
    const step = kind === 'paving' ? 64 : 256;
    ctx.strokeStyle = kind === 'paving' ? '#8e8c84' : '#a6a399'; ctx.lineWidth = 2;
    for (let y = 0; y <= 512; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
      for (let x = (y / step % 2) * step / 2; x <= 512; x += step) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + step); ctx.stroke();
      }
    }
  }
  if (kind === 'wood' || kind === 'metal') {
    for (let y = 0; y <= 512; y += kind === 'wood' ? 18 : 48) {
      ctx.fillStyle = kind === 'wood' ? 'rgba(55,35,22,.16)' : 'rgba(40,50,60,.16)';
      ctx.fillRect(0, y, 512, 2);
    }
  }
  if (kind === 'asphalt') {
    ctx.strokeStyle = 'rgba(22,27,31,.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = random() * 512, y = random() * 512; ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += random() * 30 - 15; y += random() * 19; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4; return map;
}

/** World-space collider boxes and door targets are returned for the controller. */
export function createHubWorld({ scene, offsetX = 150 } = {}) {
  const group = new THREE.Group(); group.name = 'SIDE explorable urban hub'; group.position.set(offsetX, -.125, 0);
  scene?.add(group);
  const colliders = [], resources = new Set(), batches = new Map();
  // Only walkable geometry belongs here: props, roofs and vegetation must not
  // lift a pedestrian. Cache their local bounds once, without per-frame rays.
  const groundSurfaces = [];
  const outdoorPropRoot = new THREE.Group(); outdoorPropRoot.name = 'SIDE streamed outdoor props'; group.add(outdoorPropRoot);
  const fallbackObjects = new Map();
  const OUTDOOR_PROP_KEYS = Object.freeze(['treeDefault', 'treeOak', 'treeTall', 'bush', 'bench', 'fountain', 'trafficLight', 'streetLight', 'planter', 'trashcan', 'stopSign', 'birdBrown']);
  const qualityRank = mode => mode === 'low' ? 1 : mode === 'high' ? 3 : 2;
  let outdoorQuality = 'auto', installedOutdoorTemplates = {}, fallbackCategory = '';
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  const sphereGeometry = new THREE.SphereGeometry(1, 9, 7);
  const leafGeometry = new THREE.PlaneGeometry(1, 1, 1, 4);
  resources.add(boxGeometry); resources.add(cylinderGeometry); resources.add(sphereGeometry); resources.add(leafGeometry);
  const temp = new THREE.Object3D(); let frame = new THREE.Matrix4();
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: .78, ...extra }); resources.add(m); return m;
  };
  const textured = (kind, color = 0xffffff, extra = {}) => {
    const map = texture(kind); resources.add(map);
    return mat(color, { map, bumpMap: map, bumpScale: kind === 'asphalt' ? .025 : .015, ...extra });
  };
  const m = {
    asphalt: textured('asphalt'), paving: textured('paving'), concrete: textured('concrete'),
    plaster: textured('plaster'), wood: textured('wood'), roof: textured('metal', 0x66737b, { metalness: .46, roughness: .64 }),
    grass: textured('grass'), white: mat(0xe9e4d8), black: mat(0x19252c, { roughness: .47 }),
    steel: mat(0x73838c, { metalness: .75, roughness: .4 }), darkSteel: mat(0x263a45, { metalness: .62, roughness: .46 }),
    glass: mat(0x93bac3, { metalness: .25, roughness: .12, transparent: true, opacity: .33, depthWrite: false }),
    opaqueGlass: mat(0x41616c, { metalness: .62, roughness: .13 }), mint: mat(0x83c4b9), coral: mat(0xe4a08f),
    yellow: mat(0xdcb854), paint: mat(0xe6e1cd, { roughness: .96 }), bark: textured('wood', 0x89877a),
    foliage: mat(0x52764c, { side: THREE.DoubleSide }), foliageLight: mat(0x728f5c, { side: THREE.DoubleSide }),
    light: mat(0xfff3d7, { emissive: 0xffe5af, emissiveIntensity: 1.5 }),
    blueLight: mat(0xc8ecff, { emissive: 0x95ccff, emissiveIntensity: 1.2 }),
    redLight: mat(0xb72626, { emissive: 0x7c0909, emissiveIntensity: .6 }),
    rubber: mat(0x14191d, { roughness: .94 }), soil: mat(0x4d4634), water: mat(0x55908b, { roughness: .16, metalness: .35 })
  };
  function rememberFallback(object, category = fallbackCategory) {
    if (!category) return object;
    object.userData.fallbackCategory = category;
    if (!fallbackObjects.has(category)) fallbackObjects.set(category, []);
    fallbackObjects.get(category).push(object);
    return object;
  }
  function withFallback(category, build) {
    const previous = fallbackCategory; fallbackCategory = category;
    try { return build(); } finally { fallbackCategory = previous; }
  }
  function instance(geo, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    temp.position.set(x, y, z); temp.rotation.set(rx, ry, rz); temp.scale.set(sx, sy, sz); temp.updateMatrix();
    const matrix = new THREE.Matrix4().multiplyMatrices(frame, temp.matrix);
    const key = `${fallbackCategory || 'world'}:${geo.uuid}:${material.uuid}`;
    if (!batches.has(key)) batches.set(key, { geo, material, matrices: [], fallbackCategory });
    batches.get(key).matrices.push(matrix);
  }
  const box = (x, y, z, w, h, d, material, ry = 0, rx = 0, rz = 0) => instance(boxGeometry, material, x, y, z, w, h, d, rx, ry, rz);
  const cyl = (x, y, z, r, h, material, rx = 0, rz = 0) => instance(cylinderGeometry, material, x, y, z, r, h, r, rx, 0, rz);
  function framed(x, z, yaw, build) {
    const previous = frame;
    frame = new THREE.Matrix4().makeRotationY(yaw); frame.setPosition(x, 0, z);
    build(); frame = previous;
  }
  function add(object, x = 0, y = 0, z = 0, ry = 0, rx = 0) {
    object.position.set(x, y, z); object.rotation.set(rx, ry, 0); object.updateMatrix();
    object.applyMatrix4(frame); object.receiveShadow = true; group.add(object); return rememberFallback(object);
  }
  function collider(x, z, w, d, kind = 'obstacle') {
    colliders.push({ minX: offsetX + x - w / 2, maxX: offsetX + x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, kind });
  }
  function ground(x, z, w, d, material, y = .01, tile = 8) {
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    resources.add(geo);
    const mesh = add(new THREE.Mesh(geo, material), x, y, z, 0, -Math.PI / 2);
    geo.computeBoundingBox();
    groundSurfaces.push(geo.boundingBox.clone().applyMatrix4(mesh.matrix));
    mesh.userData.walkableGround = true;
    return mesh;
  }
  function groundHeightAt(x, z) {
    const localX = x - group.position.x, localZ = z - group.position.z;
    let height = -Infinity;
    for (const surface of groundSurfaces) {
      if (localX >= surface.min.x && localX <= surface.max.x && localZ >= surface.min.z && localZ <= surface.max.z) {
        height = Math.max(height, surface.max.y);
      }
    }
    return Number.isFinite(height) ? height + group.position.y : null;
  }
  function walkablePlatform(x, y, z, w, h, d, material) {
    box(x, y, z, w, h, d, material);
    groundSurfaces.push(new THREE.Box3(new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2)));
  }
  function canvasSign(w, h, draw) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
    const ctx = canvas.getContext('2d'); draw(ctx, canvas.width, canvas.height);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const material = new THREE.MeshStandardMaterial({ map, roughness: .58, metalness: .04, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .18 });
    const geo = new THREE.PlaneGeometry(w, h); [map, material, geo].forEach(r => resources.add(r));
    return { mesh: new THREE.Mesh(geo, material), ctx, map, canvas };
  }
  function label(text, subtitle, x, y, z, w, h, background = '#203a42', ry = 0) {
    const sign = canvasSign(w, h, (ctx, cw, ch) => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#f4f1e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(ch * (subtitle ? .40 : .51))}px Arial`; ctx.fillText(text, cw / 2, ch * (subtitle ? .39 : .52), cw * .92);
      if (subtitle) { ctx.fillStyle = '#b5c9bd'; ctx.font = `500 ${Math.round(ch * .16)}px Arial`; ctx.fillText(subtitle, cw / 2, ch * .76, cw * .88); }
    });
    add(sign.mesh, x, y, z, ry); return sign;
  }

  // The central crossing remains intact. A larger connected street grid makes
  // the business district one part of a city instead of an isolated diorama.
  ground(0, 0, CITY_MAP.visualExtent * 2, CITY_MAP.visualExtent * 2, m.grass, -.08, 16);
  // Paved urban ground connects the enlarged district; grass stays outside.
  ground(0, 0, 176, 176, m.paving, .085, 8);
  for (const side of [-1, 1]) for (const lane of [-1, 1]) {
    ground(side * 47, lane * 7, 24, 3, m.paving, .12, 6);
    ground(lane * 7, side * 47, 3, 24, m.paving, .12, 6);
  }
  // Two avenue spurs connect the old crossing to a calmer outer ring.
  for (const side of [-1, 1]) {
    ground(side * 71, 0, 38, 10, m.asphalt, .145);
    ground(0, side * 71, 10, 38, m.asphalt, .145);
    ground(side * 60, 0, 8, 172, m.asphalt, .146);
    ground(0, side * 60, 172, 8, m.asphalt, .146);
    // Footways follow both sides of each avenue. They meet at every junction.
    for (const verge of [-1, 1]) {
      ground(side * 71, verge * 7, 36, 3, m.paving, .12, 6);
      ground(verge * 7, side * 71, 3, 36, m.paving, .12, 6);
      ground(side * (60 + verge * 5.7), 0, 2.6, 172, m.paving, .12, 6);
      ground(0, side * (60 + verge * 5.7), 172, 2.6, m.paving, .12, 6);
    }
  }
  // Outer parcels preserve broad walking corridors around the ring.
  for (const x of [-76, 76]) for (const z of [-76, -19, 19, 76]) {
    ground(x, z, 23, z === -76 || z === 76 ? 22 : 26, m.paving, .10, 8);
  }
  for (const z of [-76, 76]) for (const x of [-19, 19]) ground(x, z, 26, 22, m.paving, .10, 8);
  for (const at of [-60, 60]) for (let lane = -74; lane <= 74; lane += 8) {
    box(lane, .176, at, 3.1, .012, .09, m.yellow);
    box(at, .176, lane, .09, .012, 3.1, m.yellow);
  }
  ground(0, 0, 102, 10, m.asphalt, .15); ground(0, 0, 10, 102, m.asphalt, .155);
  for (const axis of [-1, 1]) {
    ground(0, axis * 39, 84, 10, m.asphalt, .145); ground(axis * 39, 0, 10, 68, m.asphalt, .146);
  }
  for (const x of [-20, 20]) for (const z of [-20, 20]) {
    box(x, -.015, z, 29, .25, 29, m.concrete); ground(x, z, 28.8, 28.8, m.paving, .12, 12);
    for (const side of [-1, 1]) {
      box(x + side * 14.55, .09, z, .25, .3, 29.4, m.white);
      box(x, .09, z + side * 14.55, 29.4, .3, .25, m.white);
    }
  }
  // Service approaches extend the central footways to each remote doorway.
  // Crossings stay flush with the roads, so wheels and pedestrians share heights.
  const pedestrianCrossings=[];
  function crosswalk(x,z,axis,width){
    pedestrianCrossings.push({x:offsetX+x,z,axis,width});
    const count=Math.floor(width/1.1);
    for(let i=0;i<count;i++){
      const along=(i-(count-1)/2)*1.1;
      box(x+(axis==='x'?along:0),.181,z+(axis==='z'?along:0),axis==='x'?.55:2.6,.014,axis==='z'?.55:2.6,m.paint);
    }
  }
  for(const radius of [39,60])for(const side of [-1,1])for(const lane of [-7,7]){
    crosswalk(side*radius,lane,'x',radius===39?10:8);
    crosswalk(lane,side*radius,'z',radius===39?10:8);
  }
  const serviceApproaches=[
    {id:'office',x:19,z:53,w:3,d:33,axis:'z',crossings:[39,60]},
    {id:'bank',x:53,z:19,w:33,d:3,axis:'x',crossings:[39,60]},
    {id:'suppliers',x:-53,z:-19,w:33,d:3,axis:'x',crossings:[-39,-60]}
  ];
  for(const link of serviceApproaches){
    const mesh=ground(link.x,link.z,link.w,link.d,m.paving,.12,6);
    mesh.name=`SIDE pedestrian access ${link.id}`;
    // Narrow edge bands make the path legible without blocking crossings.
    for(const side of [-1,1]){
      const x=link.x+(link.axis==='z'?side*1.55:0),z=link.z+(link.axis==='x'?side*1.55:0);
      box(x,.135,z,link.axis==='z'?.12:link.w,.025,link.axis==='x'?.12:link.d,m.darkSteel);
    }
    for(const at of link.crossings)crosswalk(link.axis==='x'?at:link.x,link.axis==='z'?at:link.z,link.axis,Math.abs(at)===39?10:8);
  }
  // Four compact gardens give the open blocks a purpose. They sit between
  // the two road rings, leaving the sidewalks and service approaches clear.
  const pocketGardens=[];
  for(const sx of [-1,1])for(const sz of [-1,1]){
    const x=sx*50,z=sz*50;
    const garden=ground(x,z,7.2,7.2,m.grass,.16,5);
    garden.name='SIDE pocket garden';
    pocketGardens.push({x:offsetX+x,z,width:7.6,depth:7.6});
    for(const edge of [-1,1]){
      box(x+edge*3.7,.27,z,.2,.3,7.6,m.concrete);
      box(x,.27,z+edge*3.7,7.6,.3,.2,m.concrete);
    }
    // A planted parcel is a real obstacle; routing cannot cut through its curb.
    collider(x,z,7.6,7.6,'garden');
    for(const dx of [-1.7,1.7]){
      cyl(x+dx,.7,z,.09,1.1,m.bark);
      instance(sphereGeometry,m.foliage,x+dx,1.55,z,.8,.9,.8);
    }
    for(const dx of [-1.8,1.8]){
      box(x+dx,.55,z-sz*4.7,1.45,.14,.5,m.wood);
      box(x+dx,.83,z-sz*4.94,1.45,.46,.1,m.wood);
      collider(x+dx,z-sz*4.7,1.5,.8,'garden-bench');
      for(const leg of [-.5,.5])box(x+dx+leg,.3,z-sz*4.7,.09,.5,.42,m.darkSteel);
    }
  }

  // Stop bars, pedestrian crossings and lane markers are shallow geometry.
  for (let a = -49; a <= 49; a += 6) if (Math.abs(a) > 9) {
    box(a, .173, 0, 3, .013, .11, m.yellow); box(0, .173, a, .11, .013, 3, m.yellow);
  }
  for (const side of [-1, 1]) for (let s = -3.9; s <= 4; s += 1.15) {
    box(s, .177, side * 7.6, .55, .014, 2.6, m.paint);
    box(side * 7.6, .177, s, 2.6, .014, .55, m.paint);
  }
  for (const side of [-1, 1]) {
    box(side * 10.2, .173, side * 2.3, .3, .014, 4.3, m.paint);
    box(-side * 2.3, .173, side * 10.2, 4.3, .014, .3, m.paint);
  }
  for (let a = -29; a <= 29; a += 6) for (const side of [-1, 1]) {
    box(a, .173, side * 39, 3, .012, .1, m.paint);
    box(side * 39, .173, a, .1, .012, 3, m.paint);
  }
  for (const [x, z] of [[-5.9, -5.9], [5.9, -5.9], [-5.9, 5.9], [5.9, 5.9]]) {
    ground(x, z, 1.25, 1.25, m.yellow, .131, 5);
    cyl(x, .17, z, .44, .07, m.steel);
  }

  // Business shells and interiors are built together in business_interiors.mjs.

  // Plaza: the open pedestrian routes cross between planted corners and the kiosk.
  ground(19, 19, 27, 27, m.paving, .147, 11);
  for (const x of [8.8, 29.2]) for (const z of [8.8, 29.2]) {
    box(x, .46, z, 4.3, .65, 4.3, m.concrete); box(x, .81, z, 3.92, .07, 3.92, m.soil);
    collider(x, z, 4.3, 4.3, 'planter');
  }
  for (const x of [12, 26]) {
    box(x, .169, 19, .16, .035, 22, m.darkSteel);
    for (let z = 11; z < 28; z += 4) box(x, .18, z, .2, .015, 1.4, m.light);
  }
  walkablePlatform(19, .18, 19, 5.4, .09, 5.4, m.white);
  walkablePlatform(19, .237, 19, 4.95, .025, 4.95, m.darkSteel);

  function bench(x, z, yaw = 0) {
    framed(x, z, yaw, () => {
      for (const a of [-.85, .85]) {
        box(a, .48, 0, .09, .62, .54, m.darkSteel); box(a, .9, -.25, .075, .78, .075, m.darkSteel, 0, -.12);
        box(a, .83, .05, .075, .06, .68, m.darkSteel);
      }
      for (let a = -.2; a <= .22; a += .14) box(0, .74, a, 2.12, .08, .105, m.wood);
      for (let y = .97; y < 1.35; y += .16) box(0, y, -.27, 2.12, .12, .06, m.wood, 0, -.12);
    });
    const swap = Math.abs(Math.sin(yaw)) > .5; collider(x, z, swap ? .8 : 2.3, swap ? 2.3 : .8, 'bench');
  }
  withFallback('benches', () => {
    bench(19, 9.4); bench(19, 28.6, Math.PI); bench(9.4, 19, Math.PI / 2); bench(28.6, 19, -Math.PI / 2);
    bench(-25, 29); bench(-13, 29);
  });

  function palm(x, z, height = 7.5, rotation = 0) {
    const trunk = new THREE.CylinderGeometry(.16, .28, height, 9, 6); resources.add(trunk);
    const obj = add(new THREE.Mesh(trunk, m.bark), x, height / 2 + .72, z); obj.castShadow = true;
    for (let a = 0; a < 9; a++) {
      const angle = rotation + a * Math.PI * 2 / 9, length = 3.1 + Math.sin(a * 7) * .45;
      // Feather-shaped fronds curve down at their tips; alpha-free silhouettes.
      const vertices = [], indices = []; const segments = 7;
      for (let n = 0; n <= segments; n++) {
        const t = n / segments, radius = t * length;
        const width = Math.sin(Math.PI * t) * .49;
        const py = height + .75 + Math.sin(t * Math.PI) * .64 - t * t * 1.3;
        const px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius;
        vertices.push(px - Math.sin(angle) * width, py, pz + Math.cos(angle) * width, px, py + .065, pz, px + Math.sin(angle) * width, py, pz - Math.cos(angle) * width);
        if (n < segments) {
          const k = n * 3; indices.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5);
        }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals(); resources.add(geo);
      const leaf = new THREE.Mesh(geo, a % 3 === 0 ? m.foliageLight : m.foliage); leaf.castShadow = true; leaf.receiveShadow = true; group.add(leaf); rememberFallback(leaf);
    }
    collider(x, z, .66, .66, 'tree');
  }
  withFallback('trees', () => {
    [[8.8, 8.8, 6.7], [29.2, 8.8, 8], [8.8, 29.2, 7.3], [29.2, 29.2, 7.8], [-30.5, 8.7, 7.2], [-8.5, 30.5, 8.2], [-30.5, 30.5, 6.8], [31.4, -8, 8.5], [-30.5, -8, 7.1]].forEach(([x, z, h], i) => palm(x, z, h, i * .41));
  });
  withFallback('bushes', () => {
    for (const [x, z] of [[8.8, 8.8], [29.2, 8.8], [8.8, 29.2], [29.2, 29.2]]) for (let a = 0; a < 7; a++) {
      const angle = a * Math.PI * 2 / 7;
      instance(sphereGeometry, a % 2 ? m.foliage : m.foliageLight, x + Math.cos(angle) * 1.25, 1.03, z + Math.sin(angle) * 1.25, .54, .31, .56);
    }
  });

  function lamp(x, z, yaw = 0) {
    framed(x, z, yaw, () => {
      cyl(0, .29, 0, .2, .38, m.darkSteel); cyl(0, 3.2, 0, .067, 6, m.darkSteel);
      box(.57, 6.18, 0, 1.23, .085, .095, m.darkSteel, 0, 0, -.06);
      box(1.14, 6.13, 0, .82, .13, .3, m.darkSteel); box(1.14, 6.06, 0, .64, .025, .22, m.light);
    }); collider(x, z, .4, .4, 'lamp');
  }
  withFallback('streetLights', () => {
    [[-7, -29, Math.PI], [-7, 12, Math.PI], [-29, -7, -Math.PI / 2], [12, -7, -Math.PI / 2], [7, -29, 0], [7, 30, 0], [-29, 7, Math.PI / 2], [30, 7, Math.PI / 2], [33, 23, Math.PI], [-33, 23, 0]].forEach(([x, z, a]) => lamp(x, z, a));
  });
  withFallback('trashcans', () => {
    for (const [x, z] of [[13, 28.8], [25, 9.2], [-10, 26.5]]) {
      cyl(x, .68, z, .32, 1.05, m.darkSteel); cyl(x, 1.21, z, .34, .075, m.steel); collider(x, z, .7, .7, 'bin');
    }
  });

  // Cheap category-complete fallbacks remain allocated until their streamed
  // equivalent is ready. They add no navigation geometry and disappear as a
  // category, never one object at a time, so partial downloads cannot leave
  // doubled street furniture behind.
  withFallback('fountain', () => {
    cyl(29.2, .91, 29.2, 1.48, .22, m.concrete); cyl(29.2, 1.04, 29.2, 1.22, .08, m.water);
    cyl(29.2, 1.45, 29.2, .18, .88, m.steel); cyl(29.2, 1.9, 29.2, .46, .08, m.water);
  });
  withFallback('trafficSignals', () => {
    for (const [x, z, yaw] of [[-5.9,-5.9,0],[5.9,-5.9,Math.PI/2],[5.9,5.9,Math.PI],[-5.9,5.9,-Math.PI/2]]) framed(x, z, yaw, () => {
      cyl(0, 1.55, 0, .07, 3, m.darkSteel); box(0, 2.75, 0, .28, .72, .24, m.black);
      for (const [y, material] of [[2.98,m.redLight],[2.75,m.yellow],[2.52,m.foliage]]) cyl(0, y, -.13, .075, .025, material, Math.PI / 2);
    });
  });
  withFallback('planters', () => {
    for (const [x, z] of [[7.55,7.55],[30.45,7.55],[7.55,30.45],[30.45,30.45]]) {
      cyl(x, .48, z, .28, .62, m.concrete); instance(sphereGeometry, m.foliageLight, x, 1.02, z, .42, .46, .42);
    }
  });
  withFallback('signage', () => {
    for (const [x, z, yaw] of [[-15.25,24.9,0],[-15.05,-10.8,0],[23.15,-10.8,0]]) framed(x, z, yaw, () => {
      cyl(0, 1.05, 0, .045, 2, m.darkSteel); box(0, 1.87, 0, .42, .42, .07, m.redLight, Math.PI / 4);
    });
  });
  withFallback('birds', () => {
    for (const [x, y, z, yaw] of [[14,7.1,14,0],[25,7.8,15,1.5],[24,6.8,26,3],[13,8.2,24,4.5]]) framed(x, z, yaw, () => {
      instance(sphereGeometry, m.bark, 0, y, 0, .16, .09, .24);
      box(-.14, y+.02, 0, .2, .025, .12, m.bark, 0, 0, -.28); box(.14, y+.02, 0, .2, .025, .12, m.bark, 0, 0, .28);
    });
  });

  // Physical directory. The HTML selector can call updateDistrict to keep this
  // readable screen in sync with the active simulation store.
  const kioskX = 19, kioskZ = 19;
  box(kioskX, .46, kioskZ, 2.18, .39, 1.1, m.darkSteel);
  box(kioskX, 1.27, kioskZ, 1.83, 1.4, .48, m.darkSteel);
  box(kioskX, 2.02, kioskZ, 2.1, .18, .82, m.black);
  const screen = canvasSign(1.65, 1.17, () => {});
  screen.mesh.material.emissiveIntensity = .55;
  add(screen.mesh, kioskX, 1.32, kioskZ + .248);
  function updateDistrict(value = 'miraflores') {
    const normalized = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_]+/g, '-');
    const canonical = ({ 'los-olivos': 'olivos', 'san-juan-de-lurigancho': 'sjl' })[normalized] || normalized;
    const id = DISTRICTS.some(d => d.id === canonical) ? canonical : 'miraflores';
    const { ctx, canvas } = screen; const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#10242b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '700 41px Arial';
    ctx.fillText('SIDE / DIRECTORIO', 50, 62); ctx.fillStyle = '#9cb6bc'; ctx.font = '25px Arial'; ctx.fillText('SELECCIONA TU TIENDA', 50, 112);
    DISTRICTS.forEach((district, index) => {
      const y = 164 + index * 153, active = district.id === id;
      ctx.fillStyle = active ? '#c4e2c1' : '#263d45'; ctx.fillRect(42, y, w - 84, 118);
      ctx.strokeStyle = active ? '#e5ffda' : '#405761'; ctx.lineWidth = active ? 5 : 2; ctx.strokeRect(42, y, w - 84, 118);
      ctx.fillStyle = active ? '#143328' : '#d4dee0'; ctx.font = '700 34px Arial'; ctx.fillText(district.label, 73, y + 46, w - 155);
      ctx.font = '23px Arial'; ctx.fillStyle = active ? '#36563e' : '#829da4'; ctx.fillText(active ? '●  TIENDA ACTIVA' : '○  CAMBIAR SEDE', 73, y + 85);
    });
    ctx.fillStyle = '#9db9c0'; ctx.font = '22px Arial'; ctx.fillText('ACÉRCATE PARA INTERACTUAR', 50, h - 33); screen.map.needsUpdate = true;
    group.userData.district = id; return id;
  }
  updateDistrict(); collider(kioskX, kioskZ, 2.2, 1.15, 'kiosk');
  label('SIDE', 'TU CIUDAD · TU NEGOCIO', 19, 1.38, 18.749, 1.65, .94, '#263e45', Math.PI);

  function entranceMarker(x, z, title, number, rotation = 0) {
    framed(x, z, rotation, () => {
      box(0, .19, 0, .78, .12, .5, m.darkSteel); box(0, 1.3, 0, .65, 2.14, .14, m.darkSteel);
      label(number, title, 0, 1.45, .081, .56, 1.13);
    }); collider(x, z, .8, .55, 'sign');
  }
  entranceMarker(-16.3, 26, 'TIENDA', '01'); entranceMarker(-16.2, -9.1, 'ALMACÉN', '02'); entranceMarker(22, -9.1, 'PRODUCCIÓN', '03');
  // Business signage is attached to each actual facade by business_interiors.
  // Freestanding entrance markers remain beside, rather than across, the doors.

  // Three unbranded road vehicles use shared geometry and the same light/wheel language.
  function vehicle(x, z, yaw, color, crossover = false) {
    const body = mat(color, { metalness: .66, roughness: .28 });
    framed(x, z, yaw, () => {
      const rise = crossover ? .15 : 0;
      box(0, .6 + rise, 0, 1.82, .46, 4.2, body);
      box(0, .48 + rise, 0, 1.86, .2, 4.1, m.black);
      box(0, .89 + rise, -1.34, 1.75, .16, 1.43, body, 0, -.04);
      box(0, .86 + rise, 1.55, 1.76, .18, .99, body);
      // Trapezoidal cabin has sloped glass, roof and pillars, not a box silhouette.
      const verts = [-.82,.89+rise,-.85, .82,.89+rise,-.85, -.66,1.51+rise,-.38, .66,1.51+rise,-.38,
        -.82,.89+rise,1.12, .82,.89+rise,1.12, -.68,1.51+rise,.67, .68,1.51+rise,.67];
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex([0,1,2,1,3,2,4,6,5,5,6,7,0,2,4,4,2,6,1,5,3,5,7,3,2,3,6,3,7,6].reverse()); geo.computeVertexNormals(); resources.add(geo);
      const cabin = add(new THREE.Mesh(geo, m.opaqueGlass)); cabin.castShadow = true;
      box(0, 1.54 + rise, .15, 1.38, .065, 1.13, body);
      for (const side of [-1, 1]) {
        box(side * .85, 1.2 + rise, .32, .055, .64, .095, m.black);
        box(side * .74, 1.2 + rise, -.62, .06, .78, .075, body, 0, -.64);
        box(side * .76, 1.2 + rise, .92, .06, .76, .08, body, 0, .62);
        box(side * .92, 1.05 + rise, -.6, .25, .14, .3, body);
        box(side * .92, .88 + rise, .55, .02, .042, .23, m.steel);
        for (const wz of [-1.28, 1.32]) {
          cyl(side * .94, .43 + rise * .4, wz, .395, .19, m.rubber, 0, Math.PI / 2);
          cyl(side * 1.042, .43 + rise * .4, wz, .285, .024, m.darkSteel, 0, Math.PI / 2);
          for (let spoke = 0; spoke < 5; spoke++) {
            const angle = spoke * Math.PI * 2 / 5;
            box(side * 1.057, .43 + rise * .4 + Math.cos(angle) * .14, wz + Math.sin(angle) * .14, .03, .29, .09, m.steel, 0, angle);
          }
          cyl(side * 1.08, .43 + rise * .4, wz, .078, .04, m.steel, 0, Math.PI / 2);
        }
        box(side * .65, .8 + rise, -2.11, .48, .055, .045, m.blueLight, 0, 0, side * -.1);
        box(side * .68, .69 + rise, -2.115, .23, .09, .04, m.opaqueGlass);
        for (let a = 0; a < 3; a++) box(side * .67, .75 + rise - a * .074, 2.11, .43, .035, .035, m.redLight, 0, 0, side * .06);
      }
      for (let y = .45 + rise; y < .69 + rise; y += .06) box(0, y, -2.114, .94, .018, .03, m.black);
      box(0, .77 + rise, -2.124, .16, .08, .028, m.steel);
      box(0, .53 + rise, 2.123, .4, .18, .025, m.white);
      box(0, .42 + rise, -2.133, .4, .15, .025, m.white);
    });
    const swap = Math.abs(Math.sin(yaw)) > .5; collider(x, z, swap ? 4.6 : 2.16, swap ? 2.16 : 4.6, 'car');
  }
  vehicle(-21, 32.25, Math.PI / 2, 0xa8afb3); vehicle(31.7, 17, 0, 0xeaebe4); vehicle(13, -30.4, Math.PI / 2, 0x24394f, true);
  for (const z of [13.5, 20.5, 26.5]) box(31.8, .163, z, 4.1, .017, .1, m.white);

  // Public service landmarks sit on accessible outer parcels. Their footprints
  // join the same collision graph used by players and NPCs; background blocks
  // beyond the playable boundary do not burden path searches.
  const landmarkMaterial = mat(0xb2beb9), supplierMaterial = mat(0xb99f77);
  function landmark(id, x, z, w, d, h, material) {
    // Ground floor shares the original landmark footprint and facade palette.
    const axis = id === 'office' ? 'z' : 'x';
    const direction = id === 'suppliers' ? -1 : 1;
    const edge = axis === 'z' ? z-d/2 : x-direction*w/2;
    const wall = (cx,cz,ww,dd) => { box(cx,h/2+.15,cz,ww,h,dd,material); collider(cx,cz,ww,dd,id); };
    if(axis==='z') {
      wall(x-w/2,z,.24,d);wall(x+w/2,z,.24,d);wall(x,z+d/2,w,.24);
      for(const side of [-1,1])wall(x+side*(w/4+.75),edge,w/2-1.5,.24);
      box(x,(h+3.1)/2+.15,edge,3,h-3.1,.24,material);
    } else {
      wall(x,z-d/2,w,.24);wall(x,z+d/2,w,.24);wall(x+direction*w/2,z,.24,d);
      for(const side of [-1,1])wall(edge,z+side*(d/4+.75),.24,d/2-1.5);
      box(edge,(h+3.1)/2+.15,z,.24,h-3.1,3,material);
    }
    box(x, h + .33, z, w + .7, .36, d + .7, m.darkSteel);
    const front = z > 50 ? z - d / 2 - .25 : z < -50 ? z + d / 2 + .25 : z;
    const side = x > 50 ? x - w / 2 - .25 : x < -50 ? x + w / 2 + .25 : x;
    const title={office:'OFICINA SIDE',bank:'BANCO',suppliers:'PROVEEDORES'}[id];
    const subtitle={office:'ADMINISTRACIÓN',bank:'SERVICIOS FINANCIEROS',suppliers:'ABASTECIMIENTO'}[id];
    if(axis==='z')label(title,subtitle,x,4.3,front-.02,Math.min(w*.7,8),1.15,'#203a42',Math.PI);
    else label(title,subtitle,side-direction*.02,4.3,z,Math.min(d*.7,8),1.15,'#203a42',direction>0?-Math.PI/2:Math.PI/2);
    if (Math.abs(z) > 50) {
      for (const side of [-1,1]) box(x+side*(1.65+w*.12),2,front,w*.24,3.2,.11,m.opaqueGlass);
      box(x, h - .8, front, w * .7, .18, .15, m.mint);
    } else {
      for (const sign of [-1,1]) box(side,2,z+sign*(1.65+d*.12),.11,3.2,d*.24,m.opaqueGlass);
      box(side, h - .8, z, .15, .18, d * .7, m.mint);
    }

  }
  landmark('office', 19, 76, 16, 13, 11, landmarkMaterial);
  landmark('bank', 76, 19, 13, 16, 9, m.concrete);
  landmark('suppliers', -76, -19, 14, 17, 8, supplierMaterial);
  // The existing plaza kiosk is the news notice point; its central position is
  // kept for the business directory and objective markers.
  // A separate notice box keeps the cycle news action visible beside the plaza.
  box(19, .88, 31.15, 1.5, 1.55, .48, m.darkSteel);
  box(19, 1.42, 31.47, 1.19, .18, .05, m.yellow);
  box(19, .91, 31.45, 1.18, .72, .06, m.opaqueGlass);
  label('NOTICIAS', 'CICLO ACTUAL', 19, 2.04, 31.49, 2.5, .68, '#284657');
  collider(19, 31.15, 1.5, .48, 'news-box');

  // Beyond the walking boundary, instanced facades and a thin second skyline
  // mask the terrain edge. The near band survives on Low; detail is tiered.
  const skylineColors = [m.plaster, m.mint, m.coral, m.concrete];
  const skyline = [];
  for (const side of [-1, 1]) for (let p = -78; p <= 78; p += 26) {
    skyline.push([side * 104, p, 13, 11 + ((p + 78) / 26 * 7 + (side + 1) * 5) % 13, 18]);
    skyline.push([p, side * 104, 18, 12 + ((p + 78) / 26 * 5 + (side + 1) * 3) % 14, 13]);
  }
  skyline.forEach(([x,z,w,h,d], i) => withFallback(`skyline-${Math.abs(x)>90?(x<0?'west':'east'):(z<0?'north':'south')}`, () => {
    const material = skylineColors[i % skylineColors.length]; box(x, h / 2, z, w, h, d, material);
    box(x, h + .2, z, w + .6, .4, d + .6, m.white); box(x, .65, z, w + .15, 1.3, d + .15, m.darkSteel);
    const front = z < -90 ? z + d / 2 + .03 : z > 90 ? z - d / 2 - .03 : z;
    withFallback('skylineDetails', () => { if (Math.abs(z) > 90) {
      for (let wx = x - w / 2 + 1.4; wx < x + w / 2 - .7; wx += 2.7) for (let wy = 2.8; wy < h - .5; wy += 3.1) box(wx, wy, front, 1.32, 1.6, .06, m.opaqueGlass);
    } else {
      const side = x < 0 ? x + w / 2 + .03 : x - w / 2 - .03;
      for (let wz = z - d / 2 + 1.4; wz < z + d / 2 - .7; wz += 2.7) for (let wy = 2.8; wy < h - .5; wy += 3.1) box(side, wy, wz, .06, 1.6, 1.32, m.opaqueGlass);
    } });
  }));

  // SIDE mint and warm brass architectural trim, batched with
  // the city instead of adding expensive shadow-casting lights to each sign.
  const warmTrim=mat(0xdcb854,{emissive:0x8d6427,emissiveIntensity:.32});
  const mintTrim=mat(0x83c4b9,{emissive:0x376e65,emissiveIntensity:.32});
  withFallback('skylineDetails', () => { for(const [x,z,w,h,d] of skyline) {
    box(x,h-.6,z,w+.15,.12,d+.15,x<0?warmTrim:mintTrim);
    box(x,h+.9,z,w*.42,1.4,d*.45,m.darkSteel);
    for(const side of [-1,1])box(x+side*(w/2-.35),h/2,z+d/2+.06,.13,h-1,.12,x<0?warmTrim:mintTrim);
  } });
  label('COSTA SIDE','EL NEGOCIO EMPIEZA EN LA CALLE',0,20.5,42.9,12,2.7,'#392941',Math.PI);
  label('PASEO COSTA','BARRIO COMERCIAL',-7,20,-42.4,11,2.3,'#294951');
  withFallback('trees', () => { for(const x of [-29,-17,-5,7,23,29])palm(x,45.5,7.5+(x+29)%3,x*.2); });

  let instanceCount = 0;
  batches.forEach(({ geo, material, matrices, fallbackCategory: category }) => {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = material !== m.glass && material !== m.paint && material !== m.light;
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); mesh.name = 'Hub shared geometry';
    group.add(mesh); rememberFallback(mesh, category); instanceCount += matrices.length;
  });
  group.userData.geometryInstances = instanceCount;
  group.userData.drawCalls = group.children.filter(child => child.isMesh).length;

  const OUTDOOR_SEED = 4107;
  const treeFootprints = [[8.8,.82,8.8],[29.2,.82,8.8],[8.8,.82,29.2],[-30.5,.15,8.7],[-8.5,.15,30.5],[-30.5,.15,30.5],[31.4,.15,-8],[-30.5,.15,-8]];
  const treeRow = [-29,-17,-5,7,23,29].map(x => [x,.15,45.5]);
  const benchPlacements = [[19,.15,9.4,0],[19,.15,28.6,Math.PI],[9.4,.15,19,Math.PI/2],[28.6,.15,19,-Math.PI/2],[-25,.15,29,0],[-13,.15,29,0]];
  const lampPlacements = [[-7,.15,-29,Math.PI],[-7,.15,12,Math.PI],[-29,.15,-7,-Math.PI/2],[12,.15,-7,-Math.PI/2],[7,.15,-29,0],[7,.15,30,0],[-29,.15,7,Math.PI/2],[30,.15,7,Math.PI/2],[33,.15,23,Math.PI],[-33,.15,23,0]];
  const trafficPlacements = [[-5.9,.15,-5.9,0],[5.9,.15,-5.9,Math.PI/2],[5.9,.15,5.9,Math.PI],[-5.9,.15,5.9,-Math.PI/2]];
  const birdFlights = [
    { cx: 15, cz: 15, y: 7.1, radius: 3.2, speed: .42, phase: 0 },
    { cx: 24, cz: 15, y: 7.8, radius: 4.0, speed: .35, phase: 1.7 },
    { cx: 24, cz: 25, y: 6.8, radius: 3.5, speed: .47, phase: 3.2 },
    { cx: 14, cz: 24, y: 8.2, radius: 4.3, speed: .31, phase: 4.8 }
  ];
  const placementRandom = seededRandom(OUTDOOR_SEED);
  const decorate = ([x,y,z], bay) => ({ x, y, z, yaw: placementRandom() * Math.PI * 2, scale: (() => { const s=.92+placementRandom()*.17; return [s,s,s]; })(), bay });
  const treePlacements = [...treeFootprints, ...treeRow].map((point, index) => decorate(point, `tree-${index}`));
  const bushPlacements = [];
  for (const [x,z] of [[8.8,8.8],[29.2,8.8],[8.8,29.2]]) for (let a=0;a<7;a++) {
    const angle=a*Math.PI*2/7, s=.82+placementRandom()*.22;
    bushPlacements.push({x:x+Math.cos(angle)*1.25,y:.82,z:z+Math.sin(angle)*1.25,yaw:placementRandom()*Math.PI*2,scale:[s,s,s],bay:`bush-${x}-${z}-${a}`});
  }
  const placementPayload = JSON.stringify({ seed:OUTDOOR_SEED, trees:treePlacements, bushes:bushPlacements, benches:benchPlacements, lamps:lampPlacements, traffic:trafficPlacements });
  let placementHash=2166136261;
  for(let index=0;index<placementPayload.length;index++){placementHash^=placementPayload.charCodeAt(index);placementHash=Math.imul(placementHash,16777619);}
  const placementSignature = `${OUTDOOR_SEED}:${(placementHash>>>0).toString(16).padStart(8,'0')}`;
  group.userData.outdoorPlacementSeed = OUTDOOR_SEED;
  group.userData.outdoorPlacementSignature = placementSignature;

  function propMatrix({ x, y = .15, z, yaw = 0, scale = [1,1,1] }) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0)),new THREE.Vector3(...scale));
  }
  function clearOutdoorProps() {
    outdoorPropRoot.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    outdoorPropRoot.clear();
  }
  function addOutdoorPropBatch(template, placements, metadata) {
    if (!template?.traverse || !placements.length) return null;
    template.updateMatrixWorld?.(true);
    const sources=[];
    template.traverse(object => { if(object.isMesh&&!object.isSkinnedMesh&&object.geometry&&object.material)sources.push(object); });
    if (!sources.length) return null;
    const batch=new THREE.Group(); batch.name=`outdoor prop ${metadata.kind}`;
    Object.assign(batch.userData,metadata,{outdoorPropBatch:true,instanceCount:placements.length,bays:[...new Set(placements.map(p=>p.bay).filter(Boolean))]});
    const matrices=placements.map(propMatrix);
    for(const source of sources){
      const mesh=new THREE.InstancedMesh(source.geometry,source.material,placements.length);
      matrices.forEach((placement,index)=>mesh.setMatrixAt(index,placement.clone().multiply(source.matrixWorld)));
      mesh.instanceMatrix.needsUpdate=true;mesh.name=`${batch.name} shared mesh`;mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();
      mesh.userData.sourceMatrix=source.matrixWorld.clone();batch.add(mesh);
    }
    outdoorPropRoot.add(batch);return batch;
  }
  function templateValue(source,key){return source&&Object.prototype.hasOwnProperty.call(source,key)?source[key]:null;}
  function sameOutdoorTemplates(next){return OUTDOOR_PROP_KEYS.every(key=>(templateValue(installedOutdoorTemplates,key)||null)===(templateValue(next,key)||null));}
  function setFallbackVisibility(installed, rank){
    const detailCategories=new Set(['bushes','fountain','planters','signage','birds','skylineDetails']);
    fallbackObjects.forEach((objects,category)=>objects.forEach(object=>{
      object.visible=!installed.has(category)&&rank>=(detailCategories.has(category)?2:1);
      if(category==='birds'&&object.isInstancedMesh){
        object.userData.fallbackBaseCount??=object.count;
        const birds=rank<2?0:rank>2?4:2;
        object.count=Math.round(object.userData.fallbackBaseCount*birds/4);
      }
    }));
  }
  function setOutdoorQuality(mode='auto'){
    outdoorQuality=['low','medium','high','auto'].includes(mode)?mode:'auto';
    const rank=qualityRank(outdoorQuality), installed=new Set(outdoorPropRoot.children.map(batch=>batch.userData.category));
    outdoorPropRoot.children.forEach(batch=>{
      const visible=rank>=Number(batch.userData.minQuality||1);batch.userData.qualityVisible=visible;batch.visible=visible;
      const cast=rank>1&&Boolean(batch.userData.shadowMedium||rank>2&&batch.userData.shadowHigh);
      batch.traverse(object=>{if(object.isMesh){object.castShadow=cast;object.receiveShadow=rank>1;}});
    });
    const birdBatch=outdoorPropRoot.children.find(batch=>batch.userData.category==='birds');
    if(birdBatch){const count=rank<2?0:rank>2?4:2;birdBatch.userData.activeInstances=count;birdBatch.traverse(object=>{if(object.isInstancedMesh)object.count=count;});birdBatch.visible=count>0;birdBatch.userData.qualityVisible=count>0;}
    setFallbackVisibility(installed,rank);return outdoorQuality;
  }
  function installOutdoorProps(templates={},mode=outdoorQuality){
    if(sameOutdoorTemplates(templates)&&outdoorPropRoot.children.length){setOutdoorQuality(mode);return outdoorPropState();}
    clearOutdoorProps();installedOutdoorTemplates=Object.fromEntries(OUTDOOR_PROP_KEYS.map(key=>[key,templateValue(templates,key)||null]));
    const add=(key,placements,metadata)=>addOutdoorPropBatch(installedOutdoorTemplates[key],placements,metadata);
    const treeKeys=['treeDefault','treeOak','treeTall'].filter(key=>installedOutdoorTemplates[key]);
    if(treeKeys.length)for(const [index,key] of treeKeys.entries())add(key,treePlacements.filter((_,i)=>i%treeKeys.length===index),{kind:key,category:'trees',minQuality:1,shadowHigh:true});
    if(installedOutdoorTemplates.bush)add('bush',bushPlacements,{kind:'bushes',category:'bushes',minQuality:2,maxDistance:52,center:[19,19]});
    if(installedOutdoorTemplates.bench)add('bench',benchPlacements.map(([x,y,z,yaw],i)=>({x,y,z,yaw,bay:`bench-${i}`})),{kind:'benches',category:'benches',minQuality:1,shadowMedium:true});
    if(installedOutdoorTemplates.fountain)add('fountain',[{x:29.2,y:.82,z:29.2,bay:'plaza-fountain'}],{kind:'fountain',category:'fountain',minQuality:2,maxDistance:58,center:[29.2,29.2]});
    if(installedOutdoorTemplates.trafficLight)add('trafficLight',trafficPlacements.map(([x,y,z,yaw],i)=>({x,y,z,yaw,bay:`crossing-${i}`})),{kind:'traffic-signals',category:'trafficSignals',minQuality:1});
    if(installedOutdoorTemplates.streetLight)add('streetLight',lampPlacements.map(([x,y,z,yaw],i)=>({x,y,z,yaw,bay:`lamp-${i}`})),{kind:'street-lights',category:'streetLights',minQuality:1});
    if(installedOutdoorTemplates.planter)add('planter',[[7.55,7.55],[30.45,7.55],[7.55,30.45],[30.45,30.45]].map(([x,z],i)=>({x,y:.15,z,yaw:i*.73,bay:`planter-${i}`})),{kind:'planters',category:'planters',minQuality:2,maxDistance:58,center:[19,19]});
    if(installedOutdoorTemplates.trashcan)add('trashcan',[[13,28.8],[25,9.2],[-10,26.5]].map(([x,z],i)=>({x,y:.15,z,yaw:i*1.1,bay:`trash-${i}`})),{kind:'trashcans',category:'trashcans',minQuality:1});
    if(installedOutdoorTemplates.stopSign)add('stopSign',[[-15.25,24.9,0],[-15.05,-10.8,0],[23.15,-10.8,0]].map(([x,z,yaw],i)=>({x,y:.15,z,yaw,bay:`sign-${i}`})),{kind:'urban-signage',category:'signage',minQuality:2,maxDistance:55,center:[0,7]});
    if(installedOutdoorTemplates.birdBrown)add('birdBrown',birdFlights.map((flight,i)=>({x:flight.cx+flight.radius,y:flight.y,z:flight.cz,yaw:Math.PI/2,bay:`bird-${i}`})),{kind:'birds',category:'birds',minQuality:2,maxDistance:58,center:[19,19],animated:true});
    setOutdoorQuality(mode);return outdoorPropState();
  }
  function tickOutdoorProps(dt=0,observer=null,time=0){
    const localX=Number(observer?.x)-offsetX, localZ=Number(observer?.z), hasObserver=Number.isFinite(localX)&&Number.isFinite(localZ);
    outdoorPropRoot.children.forEach(batch=>{
      if(batch.userData.category==='birds')return;
      const center=batch.userData.center,maxDistance=Number(batch.userData.maxDistance||0);
      const near=!maxDistance||!hasObserver||Math.hypot(localX-center[0],localZ-center[1])<=maxDistance;
      batch.userData.distanceVisible=near;batch.visible=Boolean(batch.userData.qualityVisible&&near);
    });
    const birdBatch=outdoorPropRoot.children.find(batch=>batch.userData.category==='birds');
    if(!birdBatch)return;
    const active=Number(birdBatch.userData.activeInstances||0),near=!hasObserver||Math.hypot(localX-19,localZ-19)<=58;
    birdBatch.visible=Boolean(active&&near);birdBatch.userData.distanceVisible=near;
    if(!birdBatch.visible)return;
    birdBatch.children.forEach(mesh=>{
      if(!mesh.isInstancedMesh)return;
      for(let i=0;i<active;i++){
        const flight=birdFlights[i],angle=time*flight.speed+flight.phase;
        const placement=propMatrix({x:flight.cx+Math.cos(angle)*flight.radius,y:flight.y+Math.sin(angle*2.1)*.28,z:flight.cz+Math.sin(angle)*flight.radius,yaw:-angle,scale:[1,1,1]});
        mesh.setMatrixAt(i,placement.multiply(mesh.userData.sourceMatrix));
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    });
  }
  function outdoorPropState(){
    const batches=outdoorPropRoot.children.filter(child=>child.userData.outdoorPropBatch),visible=batches.filter(batch=>batch.visible);
    let drawables=0,triangles=0,shadows=0;
    visible.forEach(batch=>batch.traverse(object=>{if(!object.isMesh)return;drawables++;const count=object.isInstancedMesh?object.count:1;triangles+=(object.geometry?.index?.count||object.geometry?.attributes?.position?.count||0)/3*count;if(object.castShadow)shadows++;}));
    const categories={};for(const batch of visible)categories[batch.userData.category]=(categories[batch.userData.category]||0)+Number(batch.userData.activeInstances??batch.userData.instanceCount??0);
    return {quality:outdoorQuality,seed:OUTDOOR_SEED,placementSignature,installed:[...new Set(batches.map(batch=>batch.userData.category))].sort(),batches:batches.length,instances:batches.reduce((sum,b)=>sum+Number(b.userData.instanceCount||0),0),visibleBatches:visible.length,visibleInstances:visible.reduce((sum,b)=>sum+Number(b.userData.activeInstances??b.userData.instanceCount??0),0),drawables,triangles:Math.round(triangles),shadows,categories,birds:categories.birds||0,fallbackVisible:[...fallbackObjects].filter(([category,objects])=>!category.startsWith('skyline')&&objects.some(object=>object.visible)).map(([category])=>category).sort()};
  }
  const entrances = [
    { id: 'store', name: 'Tienda SIDE', x: offsetX - 19, z: 26, rotation: Math.PI, portal: { x: offsetX - 19, z: 24.75, halfWidth: 1.05 } },
    { id: 'warehouse', name: 'Almacén SIDE', x: offsetX - 20, z: -9, rotation: Math.PI, portal: { x: offsetX - 20, z: -11.1, halfWidth: 1.05 } },
    { id: 'production', name: 'Lugar de Producción', x: offsetX + 20, z: -9, rotation: Math.PI, portal: { x: offsetX + 20, z: -11.1, halfWidth: .65 } }
  ];
  setOutdoorQuality('auto');
  return {
    group, colliders, entrances, pedestrianCrossings, pocketGardens, kiosk: { x: offsetX + kioskX, z: kioskZ + 1.45 },
    crossedEntrance: (previous, next) => crossedEntrance(previous, next, entrances),
    spawn: { x: offsetX + 16, z: 27 }, groundY: .025, groundHeightAt,
    patrolRoutes: [
      [[13.5, 13.5], [24.5, 13.5], [24.5, 24.5], [13.5, 24.5]],
      [[-28, 26.8], [-21, 26.8], [-21, 30.5], [-28, 30.5]],
      [[66, 11], [66, 27], [68, 27], [68, 11]],
      [[11, 66], [27, 66], [27, 68], [11, 68]],
      [[-66, -28], [-66, -11], [-68, -11], [-68, -28]]
    ].map(route => route.map(([x, z]) => ({ x: x + offsetX, z }))),
    updateDistrict, installOutdoorProps, setQuality: setOutdoorQuality, tickOutdoorProps,
    outdoorProps: outdoorPropState,
    stats() { return { colliders: colliders.length, entrances: entrances.length, patrolRoutes: 5, pedestrianCrossings: pedestrianCrossings.length, pocketGardens: pocketGardens.length, outdoorProps: outdoorPropState() }; },
    dispose() {
      group.removeFromParent(); group.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      resources.forEach(resource => resource.dispose()); group.clear();
    }
  };
}
