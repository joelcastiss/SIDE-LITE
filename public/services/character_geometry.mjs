// Character geometry is measured once, before name labels or carried props.
export const PLAYER_HEIGHT_METERS = 1.75;

export function characterTargetHeight(role = 'npc', variation = .975) {
  // Leave a small allowance for authored idle breathing and gait poses.
  return PLAYER_HEIGHT_METERS * (role === 'player' ? 1 : Math.max(.95, Math.min(.98, Number(variation) || .975)));
}

export function normalizeCharacterGeometry(THREE, group, targetHeight = PLAYER_HEIGHT_METERS) {
  if (group.userData.characterGeometry?.height === targetHeight) return group;
  const position = group.position.clone(), rotation = group.quaternion.clone();
  group.position.set(0, 0, 0); group.quaternion.identity();
  const bounds = new THREE.Box3();
  const measure = () => {
    group.updateMatrixWorld(true); bounds.makeEmpty();
    group.traverse(node => {
      if (node.isMesh && node.name !== 'ContactShadow' && !node.userData.characterAccessory) bounds.expandByObject(node, true);
    });
    return bounds.max.y - bounds.min.y;
  };
  const sourceHeight = measure();
  if (!(sourceHeight > 0) || !Number.isFinite(sourceHeight)) {
    group.position.copy(position); group.quaternion.copy(rotation);
    return group;
  }
  group.scale.multiplyScalar(targetHeight / sourceHeight);
  measure();
  const footOffset = bounds.min.y / group.scale.y;
  // A separate pivot survives clips that write avatar.position. Moving the
  // animated avatar itself would let the mixer undo the floor correction.
  const pivot = group.userData.characterPivot || new THREE.Group();
  if (!pivot.parent) {
    pivot.name = 'CharacterGeometryPivot';
    for (const child of [...group.children]) if (!child.isSprite && child.name !== 'ContactShadow') pivot.add(child);
    group.add(pivot); group.userData.characterPivot = pivot;
  }
  pivot.position.y -= footOffset;
  group.userData.characterGeometry = {height: targetHeight, sourceHeight, footOffset};
  group.position.copy(position); group.quaternion.copy(rotation); group.updateMatrixWorld(true);
  return group;
}

// Navigation owns X/Z; animation cannot change the navigation root's altitude.
export function anchorCharacterToGround(group, worldGroundY, parentWorldY = 0, jumpHeight = 0) {
  group.position.y = worldGroundY - parentWorldY + Math.max(0, Number(jumpHeight) || 0);
  group.userData.groundHeight = worldGroundY;
  return group.position.y;
}

// Work on cloned tracks so the cached GLB remains reusable. Scene-root tracks
// stay fixed; pelvis translations retain their authored bounce, without travel
// or cumulative vertical drift across a cycle.
export function clipsWithoutRootMotion(clips = [], sceneRootName = '') {
  return clips.filter(clip => clip?.clone).map(clip => {
    const clean = clip.clone();
    for (const track of clean.tracks || []) {
      if (!track.name.endsWith('.position') || track.values.length < 3) continue;
      const node = track.name.slice(0, -9);
      const sceneRoot = node === sceneRootName || node === '' || node === '.';
      if (!sceneRoot && !/(^|[|:/])(?:root|hips|pelvis|mixamorigHips)$/i.test(node)) continue;
      const values = track.values, firstY = values[1], lastY = values[values.length - 2];
      const times = track.times, duration = times[times.length - 1] - times[0];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = values[0]; values[i + 2] = values[2];
        values[i + 1] = sceneRoot ? firstY : values[i + 1] - (lastY - firstY) * (duration > 0 ? (times[i / 3] - times[0]) / duration : 0);
      }
    }
    return clean;
  });
}
