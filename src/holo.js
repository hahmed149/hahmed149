import * as THREE from 'three';

// Turns a solid model into a hologram: dark translucent faces plus glowing edges.
export function hologram(group, color, { faceOpacity = 0.18, edgeOpacity = 0.95, threshold = 25 } = {}) {
  const c = new THREE.Color(color);
  const face = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.18), transparent: true, opacity: faceOpacity, depthWrite: false, side: THREE.DoubleSide });
  const edge = new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: edgeOpacity, toneMapped: false });
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  meshes.forEach((m) => {
    // keep signs and screens readable
    const keep = m.material?.map && m.material.isMeshBasicMaterial;
    if (keep) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, threshold), edge);
    lines.position.copy(m.position); lines.quaternion.copy(m.quaternion); lines.scale.copy(m.scale);
    m.parent.add(lines);
    m.material = face;
    m.castShadow = m.receiveShadow = false;
  });
  return group;
}
