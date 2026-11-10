import * as THREE from '../vendor/three/build/three.module.js';

// Versioned CubeUV atlas, generated from the existing RoomEnvironment lighting.
export function decodeStudioEnvironment(buffer) {
  const view=new DataView(buffer);
  if(buffer.byteLength<16||view.getUint32(0,false)!==0x53494445||view.getUint32(4,true)!==1)throw Error('Entorno SIDE inválido.');
  const width=view.getUint32(8,true),height=view.getUint32(12,true);
  if(width!==384||height!==512||buffer.byteLength!==16+width*height*8)throw Error('Atlas de iluminación SIDE incompleto.');
  const texture=new THREE.DataTexture(new Uint16Array(buffer,16),width,height,THREE.RGBAFormat,THREE.HalfFloatType);
  texture.mapping=THREE.CubeUVReflectionMapping;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.flipY=false;texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.name='SIDE cached studio lighting';texture.needsUpdate=true;return texture;
}

export async function loadStudioEnvironment() {
  const response=await fetch(new URL('../assets/environments/studio-128.bin',import.meta.url));
  if(!response.ok)throw Error(`Iluminación SIDE: HTTP ${response.status}`);
  return decodeStudioEnvironment(await response.arrayBuffer());
}
