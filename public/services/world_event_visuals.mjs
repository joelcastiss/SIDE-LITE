// Decorative projection of active course events. It never changes simulation state.
export function createWorldEventVisuals({THREE, scene, offsetX = 150}) {
  const root = new THREE.Group();
  root.name = 'Señales de eventos del ciclo';
  scene.add(root);
  const flagGeometry = new THREE.BoxGeometry(.72, .32, .035);
  const flagMaterials = [0xe78278, 0xf3cf78, 0x72c7ac].map(color => new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}));
  const flags = flagMaterials.map(material => {
    const mesh = new THREE.InstancedMesh(flagGeometry, material, 12);
    mesh.frustumCulled = true;
    root.add(mesh);
    return mesh;
  });
  const pose = new THREE.Object3D();
  flags.forEach((mesh, color) => {
    for (let i = 0; i < 12; i++) {
      const slot = i * 3 + color, row = Math.floor(slot / 4), column = slot % 4;
      pose.position.set(offsetX + 10 + column * 5.8, 6.1 + (column % 2) * .2, 11 + row * 7.5);
      pose.rotation.set(0, row % 2 ? .1 : -.1, column % 2 ? .12 : -.12);
      pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
    }
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
  });
  const deliveryMaterial = new THREE.MeshBasicMaterial({color:0xffb958});
  const delivery = new THREE.Mesh(new THREE.ConeGeometry(.48, 1.1, 6), deliveryMaterial);
  delivery.position.set(offsetX - 76, 3.2, -19);
  root.add(delivery);
  let signature = '';
  function update(events = [], tier = 'auto') {
    const kinds = new Set((Array.isArray(events) ? events : []).map(event => event.kind));
    const next = `${[...kinds].sort().join(',')}:${tier}`;
    if (next !== signature) {
      signature = next;
      const count = kinds.has('festival') ? (tier === 'low' ? 4 : tier === 'medium' || tier === 'auto' ? 8 : 12) : 0;
      flags.forEach(mesh => { mesh.count = Math.floor(count / 3); mesh.visible = mesh.count > 0; });
      delivery.visible = kinds.has('logistics');
    }
    if (scene.fog) {
      const rain = kinds.has('weather');
      scene.fog.near = rain ? 58 : 100;
      scene.fog.far = rain ? 155 : 270;
    }
  }
  update();
  return {update, dispose() {
    root.removeFromParent(); flagGeometry.dispose();
    flagMaterials.forEach(material => material.dispose());
    delivery.geometry.dispose(); deliveryMaterial.dispose();
  }};
}
