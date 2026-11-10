// Build a low-resolution, invisible walk surface from the city bounds and
// existing solid AABB colliders. Inputs are world coordinates except bounds,
// whose X coordinate receives offsetX (CITY_MAP uses local hub coordinates).
export function npcGridTriangles({bounds,obstacles=[],offsetX=0,cellSize=3,agentRadius=.4,maxCells=12_000}={}){
  if(!bounds||!Number.isFinite(bounds.minX)||!Number.isFinite(bounds.maxX)||
     !Number.isFinite(bounds.minZ)||!Number.isFinite(bounds.maxZ)||
     bounds.maxX<=bounds.minX||bounds.maxZ<=bounds.minZ)throw new TypeError('Límites de ciudad inválidos');
  if(!(Number.isFinite(cellSize)&&cellSize>=.5))throw new TypeError('Celda de navegación inválida');
  const nx=Math.ceil((bounds.maxX-bounds.minX)/cellSize),nz=Math.ceil((bounds.maxZ-bounds.minZ)/cellSize);
  if(nx*nz>maxCells)throw new RangeError('Navmesh de cuadrícula demasiado densa');
  const x0=bounds.minX+offsetX,z0=bounds.minZ,dx=(bounds.maxX-bounds.minX)/nx,dz=(bounds.maxZ-bounds.minZ)/nz;
  const positions=[];
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)positions.push(x0+x*dx,0,z0+z*dz);
  const indices=[];let blocked=0;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const minX=x0+x*dx,maxX=minX+dx,minZ=z0+z*dz,maxZ=minZ+dz;
    const solid=obstacles.some(box=>minX<box.maxX+agentRadius&&maxX>box.minX-agentRadius&&
      minZ<box.maxZ+agentRadius&&maxZ>box.minZ-agentRadius);
    if(solid){blocked++;continue}
    const a=z*(nx+1)+x,b=a+1,d=a+nx+1,c=d+1;
    indices.push(a,c,b,a,d,c);
  }
  return {positions,indices,stats:{cells:nx*nz,walkable:nx*nz-blocked,blocked,triangles:indices.length/3}};
}

export function buildNpcGridNavmesh({THREE,...options}={}){
  if(!THREE?.BufferGeometry||!THREE?.Float32BufferAttribute)throw new TypeError('Three.js requerido');
  const {positions,indices,stats}=npcGridTriangles(options);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  return {geometry,stats};
}
