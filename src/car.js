import * as THREE from 'three';
import { FONT } from './textures.js';

// A modern open-wheel race car in a silver-and-teal livery. Faces +z.
export function buildCar() {
  const group = new THREE.Group();
  const silver = new THREE.MeshPhysicalMaterial({ color: '#b9c0c7', metalness: 0.85, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 });
  const teal = new THREE.MeshPhysicalMaterial({ color: '#00c2b0', metalness: 0.3, roughness: 0.35, clearcoat: 1 });
  const carbon = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.45, metalness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: '#0d0e10', roughness: 0.7 });
  const tyreM = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  const rimM = new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: 0.8, roughness: 0.3 });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // Side profile → extruded across the width, then scaled per part
  const extrudeSide = (pts, width, mat, bevel = 0.04) => {
    const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12 });
    g.rotateY(-Math.PI / 2);
    g.translate(width / 2, 0, 0);
    return new THREE.Mesh(g, mat);
  };

  // Floor and plank
  add(new THREE.BoxGeometry(1.5, 0.05, 3.2), carbon, 0, 0.12, -0.35);
  // Survival cell / cockpit tub
  const tub = extrudeSide([[-1.3, 0.16], [1.1, 0.16], [1.5, 0.3], [1.1, 0.52], [0.35, 0.58], [-0.25, 0.72], [-1.3, 0.66]], 0.72, silver);
  group.add(tub);
  // Nose cone: tapered, drooping
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.3, 1.5, 16, 1), silver);
  nose.rotation.x = Math.PI / 2 + 0.08; nose.scale.set(1, 1, 0.55);
  nose.position.set(0, 0.3, 2.1);
  group.add(nose);
  add(new THREE.SphereGeometry(0.075, 12, 8), teal, 0, 0.24, 2.85);
  // Sidepods with undercut and tapered rear
  for (const side of [-1, 1]) {
    const pod = extrudeSide([[-1.5, 0.18], [0.55, 0.18], [0.62, 0.36], [0.5, 0.56], [-0.2, 0.55], [-1.5, 0.3]], 0.42, silver, 0.06);
    pod.position.x = side * 0.56;
    group.add(pod);
    const inlet = add(new THREE.BoxGeometry(0.4, 0.2, 0.04), black, side * 0.56, 0.44, 0.6);
    inlet.rotation.x = -0.2;
    add(new THREE.BoxGeometry(0.04, 0.12, 1.6), teal, side * 0.79, 0.3, -0.5);
  }
  // Engine cover + shark fin + airbox
  const cover = extrudeSide([[-2.05, 0.3], [-0.25, 0.72], [0.05, 0.92], [-0.3, 0.98], [-2.05, 0.46]], 0.46, silver);
  group.add(cover);
  const fin = extrudeSide([[-2.1, 0.46], [-0.35, 0.98], [-0.6, 1.02], [-2.1, 0.86]], 0.02, teal, 0.005);
  group.add(fin);
  add(new THREE.BoxGeometry(0.22, 0.2, 0.08), black, 0, 0.98, 0.03);
  // Monogram on the engine cover
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g2 = c.getContext('2d'); g2.fillStyle = '#00c2b0'; g2.font = `800 88px ${FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('HAHMED.DEV', 256, 68);
  const decalT = new THREE.CanvasTexture(c); decalT.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: decalT, transparent: true, toneMapped: false }));
    decal.position.set(side * 0.243, 0.62, -1.0); decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }

  // Cockpit: driver helmet + halo
  const helmet = add(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#f2f4f5', clearcoat: 1, roughness: 0.2 }), 0, 0.78, 0.15);
  helmet.scale.set(1, 0.95, 1.1);
  const visor = add(new THREE.SphereGeometry(0.162, 20, 10, -0.9, 1.8, 1.2, 0.5), new THREE.MeshPhysicalMaterial({ color: '#10161c', metalness: 0.6, roughness: 0.05 }), 0, 0.78, 0.15);
  visor.scale.set(1, 0.95, 1.1);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 10, 32, Math.PI), carbon);
  halo.rotation.x = -Math.PI / 2; halo.position.set(0, 0.9, 0.12);
  group.add(halo);
  const strut = add(new THREE.CylinderGeometry(0.03, 0.035, 0.4, 8), carbon, 0, 0.8, 0.58);
  strut.rotation.x = -0.9;
  for (const side of [-1, 1]) {
    const mirror = add(new THREE.BoxGeometry(0.16, 0.07, 0.05), silver, side * 0.52, 0.72, 0.45);
    add(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 6), carbon, side * 0.46, 0.66, 0.45).rotation.z = Math.PI / 2;
    mirror.castShadow = true;
  }

  // Front wing: three elements with endplates
  const fw = new THREE.Group(); fw.position.set(0, 0.12, 2.75); group.add(fw);
  [0, 0.07, 0.13].forEach((y, i) => { const el = add(new THREE.BoxGeometry(1.95 - i * 0.2, 0.025, 0.28 - i * 0.05), i === 2 ? teal : carbon, 0, y, -i * 0.13, fw); el.rotation.x = -0.12 - i * 0.12; });
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.22, 0.5), carbon, side * 0.98, 0.08, -0.1, fw);
  // Rear wing: main plane, flap, endplates, pylon
  const rw = new THREE.Group(); rw.position.set(0, 0.92, -2.2); group.add(rw);
  add(new THREE.BoxGeometry(1.1, 0.03, 0.34), carbon, 0, 0, 0, rw).rotation.x = 0.15;
  add(new THREE.BoxGeometry(1.1, 0.025, 0.2), teal, 0, 0.13, -0.08, rw).rotation.x = 0.45;
  for (const side of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.5, 0.58), silver, side * 0.56, -0.08, -0.02, rw);
  add(new THREE.BoxGeometry(0.06, 0.45, 0.08), carbon, 0, -0.25, 0.05, rw);
  // Beam wing + diffuser
  add(new THREE.BoxGeometry(0.9, 0.025, 0.16), carbon, 0, 0.4, -2.15);
  const diff = add(new THREE.BoxGeometry(1.0, 0.18, 0.4), carbon, 0, 0.18, -2.05);
  diff.rotation.x = -0.35;
  // Rain light
  const rainM = new THREE.MeshStandardMaterial({ color: '#5a0a08', emissive: '#ff2418', emissiveIntensity: 0.6 });
  add(new THREE.BoxGeometry(0.1, 0.08, 0.03), rainM, 0, 0.3, -2.3);

  // Wheels with sidewall stripe, suspension arms
  const wheels = [], fronts = [];
  const stripeM = new THREE.MeshStandardMaterial({ color: '#e0322b', roughness: 0.6 });
  const makeWheel = (r, w) => {
    const wg = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 32).rotateZ(Math.PI / 2), tyreM);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.01, 20).rotateZ(Math.PI / 2), rimM);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, 0.012, 6, 32), stripeM);
    stripe.rotation.y = Math.PI / 2;
    const s1 = stripe.clone(); s1.position.x = w / 2 + 0.002;
    const s2 = stripe.clone(); s2.position.x = -w / 2 - 0.002;
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.03, r * 1.1), rimM); sp.rotation.x = (k / 6) * Math.PI; wg.add(sp); }
    wg.add(tyre, rim, s1, s2);
    return wg;
  };
  [[0.36, 0.36, 0.86, 1.9, true], [0.38, 0.45, 0.86, -1.55, false]].forEach(([r, w, x, z, front]) => {
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * x, r, z);
      const wh = makeWheel(r, w);
      pivot.add(wh);
      group.add(pivot);
      wheels.push(wh);
      if (front) fronts.push(pivot);
      for (const [dy, dz] of [[0.1, 0.15], [-0.08, -0.15]]) {
        const a = new THREE.Vector3(side * 0.35, 0.35 + dy, z + dz), b = new THREE.Vector3(side * (x - w / 2), r + dy * 0.6, z);
        const len = a.distanceTo(b);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), carbon);
        arm.position.copy(a).add(b).multiplyScalar(0.5);
        arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        group.add(arm);
      }
    }
  });

  group.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
  return {
    group,
    spin: (dist) => wheels.forEach((w, i) => { w.rotation.x += dist / (i < 2 ? 0.36 : 0.38); }),
    steer: (s) => fronts.forEach((p) => { p.rotation.y += (s * 0.45 - p.rotation.y) * 0.25; }),
    brake: (on) => { rainM.emissiveIntensity = on ? 3 : 0.6; },
  };
}
