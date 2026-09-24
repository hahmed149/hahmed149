import * as THREE from 'three';

// A compact sedan: extruded side profile for the body, glass greenhouse, clearcoat paint.
export function buildCar() {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#a3121c', metalness: 0.15, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 0.5 });
  const trim = new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0f1a24', metalness: 0.2, roughness: 0.05, transmission: 0, clearcoat: 1 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d7dade', metalness: 1, roughness: 0.18 });

  const W = 1.9;
  const profile = (pts, width, mat, bevel = 0.08) => {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
    g.rotateY(-Math.PI / 2);
    g.translate((width - bevel * 2) / 2, 0, 0);
    return new THREE.Mesh(g, mat);
  };
  // lower body: rear → front along +z
  const body = profile([
    [-2.3, 0.38], [2.28, 0.38], [2.36, 0.62], [2.3, 0.86], [1.95, 0.98], [0.95, 1.06],
    [-1.75, 1.08], [-2.28, 1.02], [-2.36, 0.72],
  ], W, paint);
  const cabin = profile([[0.95, 1.04], [0.22, 1.56], [-0.95, 1.58], [-1.72, 1.06]], W - 0.18, glass, 0.06);
  const roof = profile([[0.2, 1.555], [-0.92, 1.575], [-0.95, 1.63], [0.14, 1.61]], W - 0.14, paint, 0.05);
  group.add(body, cabin, roof);

  // bumpers, grille, lights
  const bump = (z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.22, 0.2), trim); b.position.set(0, 0.45, z); return b; };
  group.add(bump(2.34), bump(-2.36));
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.05), trim); grille.position.set(0, 0.7, 2.37); group.add(grille);
  const headM = new THREE.MeshStandardMaterial({ color: '#fdfaf0', emissive: '#fff4cc', emissiveIntensity: 1.4 });
  const tailM = new THREE.MeshStandardMaterial({ color: '#6a0e0b', emissive: '#c0180f', emissiveIntensity: 0.7 });
  for (const x of [-0.66, 0.66]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.06), headM); h.position.set(x, 0.8, 2.33); group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.06), tailM); t.position.set(x, 0.86, -2.36); group.add(t);
  }
  for (const x of [-1, 1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.26), paint); mir.position.set(x * (W / 2 + 0.08), 1.12, 0.85); group.add(mir);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: '#f2f0e8' }));
  plate.position.set(0, 0.62, -2.47); group.add(plate);

  // wheels
  const tireG = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 24).rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(0.26, 0.26, 0.32, 10).rotateZ(Math.PI / 2);
  const tireM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.95 });
  const wheels = [], fronts = [];
  for (const [x, z] of [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.42], [0.86, -1.42]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, z);
    const w = new THREE.Mesh(tireG, tireM);
    const rim = new THREE.Mesh(rimG, chrome);
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.06), chrome);
      spoke.rotation.x = (k / 5) * Math.PI * 2; spoke.position.x = 0; w.add(spoke);
    }
    w.add(rim);
    pivot.add(w);
    group.add(pivot);
    wheels.push(w);
    if (z > 0) fronts.push(pivot);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return {
    group,
    spin: (dist) => wheels.forEach((w) => { w.rotation.x += dist / 0.4; }),
    steer: (s) => fronts.forEach((p) => { p.rotation.y += (s * 0.5 - p.rotation.y) * 0.25; }),
    brake: (on) => { tailM.emissiveIntensity = on ? 2.2 : 0.7; },
    body: group,
  };
}
