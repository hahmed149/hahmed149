import * as THREE from 'three';
import { label, stripes } from './textures.js';
import { ROAD_W } from './world.js';

const GRAVITY = 26;
const orange = new THREE.MeshStandardMaterial({ color: '#f26a1b', roughness: 0.55 });
const white = new THREE.MeshStandardMaterial({ color: '#f5f5f0', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.08 });
const black = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
const coneG = new THREE.CylinderGeometry(0.07, 0.34, 1.05, 16, 1, true);
const bandG = new THREE.CylinderGeometry(0.16, 0.22, 0.14, 16, 1, true);
const baseG = new THREE.BoxGeometry(0.85, 0.07, 0.85);

function cone() {
  const g = new THREE.Group();
  const c = new THREE.Mesh(coneG, orange); c.position.y = 0.6;
  const b1 = new THREE.Mesh(bandG, white); b1.position.y = 0.72;
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.12, 16, 1, true), white); b2.position.y = 0.46;
  const base = new THREE.Mesh(baseG, black); base.position.y = 0.035;
  g.add(c, b1, b2, base);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

const railMat = new THREE.MeshStandardMaterial({ map: stripes(), roughness: 0.5 });
function barricade(text) {
  const g = new THREE.Group();
  const legM = new THREE.MeshStandardMaterial({ color: '#e8e8e2', roughness: 0.6 });
  for (const x of [-2.1, 2.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14), legM); leg.position.set(x, 0.95, 0); g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 1.3), black); foot.position.set(x, 0.06, 0); g.add(foot);
  }
  for (const y of [0.55, 1.1, 1.65]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 0.06), railMat); r.position.set(0, y, 0.08); g.add(r);
  }
  const back = new THREE.MeshStandardMaterial({ color: '#d45a14' });
  const face = new THREE.MeshBasicMaterial({ map: label([text], { w: 600, h: 150, bg: '#f26a1b', fg: '#141414', border: true }), toneMapped: false });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 0.06), [back, back, back, back, face, back]);
  plate.position.set(0, 2.45, 0.1);
  g.add(plate);
  // flashing beacons
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffb300', emissive: '#ff9c00', emissiveIntensity: 1 });
  for (const x of [-2.1, 2.1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 10), lampM); l.position.set(x, 2.0, 0); g.add(l); }
  g.userData.lamp = lampM;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function semesterGate(sem) {
  const g = new THREE.Group();
  const purple = new THREE.MeshStandardMaterial({ color: '#512888', roughness: 0.6 });
  const span = ROAD_W + 4;
  for (const x of [-span / 2, span / 2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), purple); p.position.set(x, 3.2, 0); g.add(p); }
  const lines = sem.honors ? [sem.term, 'Semester honors'] : [sem.term];
  const face = new THREE.MeshBasicMaterial({ map: label(lines, { w: 900, h: 150, bg: '#512888', fg: '#ffffff' }), toneMapped: false });
  const banner = new THREE.Mesh(new THREE.BoxGeometry(span, 1.5, 0.15), [purple, purple, purple, purple, face, purple]);
  banner.position.y = 6.2;
  g.add(banner);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function tag(text) {
  const mat = new THREE.SpriteMaterial({ map: label([text], { w: 256, h: 72, bg: 'rgba(20,20,24,0.82)', fg: '#ffffff', border: false }), depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(2.2, 0.62, 1);
  s.position.y = 1.8;
  return s;
}

function trophy(text) {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b43c', metalness: 0.9, roughness: 0.25 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), new THREE.MeshStandardMaterial({ color: '#2f3237' }));
  plinth.position.y = 0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 0.7, 12), gold); stem.position.y = 1.35;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.3, 1.1, 18), gold); cup.position.y = 2.25;
  for (const x of [-0.85, 0.85]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 16), gold); h.position.set(x, 2.3, 0); h.rotation.y = Math.PI / 2; g.add(h);
  }
  g.add(plinth, stem, cup);
  const t = tag(text); t.position.y = 3.6; t.scale.set(3.2, 0.9, 1); g.add(t);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Builds every obstacle on its role's road. Each has a distance `s` and a
// lateral offset; driving through it (or into it) knocks it over.
export function buildObstacles(scene, road, T) {
  const list = [];
  T.roles.forEach((r) => {
    r.items.forEach((item, n) => {
      const off = T.offset(r, item.s);
      if (item.type === 'gate') {
        const f = road.at(item.s);
        const gate = semesterGate(item.sem);
        gate.position.copy(f.p).addScaledVector(f.n, off); gate.rotation.y = f.heading + Math.PI;
        scene.add(gate);
        const k = item.sem.courses.length;
        const cs = item.s + 8, cf = road.at(cs);
        item.sem.courses.forEach(([code, name], j) => {
          const c = cone();
          const lateral = off + (j - (k - 1) / 2) * Math.min(1.6, (ROAD_W - 2) / Math.max(1, k - 1));
          c.position.copy(cf.p).addScaledVector(cf.n, lateral);
          c.add(tag(code));
          scene.add(c);
          list.push({ kind: 'course', mesh: c, s: cs, lateral, radius: 0.7, role: r.index, title: code, text: `${code}: ${name}`, term: item.sem.term });
        });
      } else {
        const f = road.at(item.s);
        const award = item.type === 'award';
        const lateral = off + (award ? 0 : n % 2 ? -2.2 : 2.2);
        const mesh = award ? trophy(item.label) : barricade(item.label);
        mesh.position.copy(f.p).addScaledVector(f.n, lateral);
        mesh.rotation.y = f.heading + Math.PI;
        scene.add(mesh);
        list.push({ kind: award ? 'award' : 'feat', mesh, s: item.s, lateral, radius: award ? 1.4 : 2.6, role: r.index, title: item.label, text: item.text });
      }
    });
  });

  const active = [];
  const tmp = new THREE.Vector3();

  function knock(o, car, direct) {
    o.hit = true;
    o.t = 0;
    const fwd = tmp.set(Math.sin(car.heading), 0, Math.cos(car.heading));
    const sp = Math.max(Math.abs(car.speed), 12);
    const side = (Math.random() - 0.5) * 2;
    o.vel = new THREE.Vector3(fwd.x * sp * (direct ? 0.9 : 0.35), (direct ? 7 : 4) + Math.random() * 3, fwd.z * sp * (direct ? 0.9 : 0.35));
    o.vel.x += -fwd.z * side * 4; o.vel.z += fwd.x * side * 4;
    o.ang = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10);
    o.mesh.children.filter((c) => c.isSprite).forEach((c) => c.removeFromParent());
    active.push(o);
  }

  // car: { x, z, heading, speed, s, prevS, lateral }
  function update(dt, car, t, onHit) {
    for (const o of list) {
      if (o.hit || Math.abs(o.s - car.s) > 8) continue;
      const dist = Math.hypot(o.mesh.position.x - car.x, o.mesh.position.z - car.z);
      const direct = dist < o.radius + 1.2;
      const passed = car.s > o.s + 0.5 && car.prevS <= o.s + 0.5 && Math.abs(car.lateral - o.lateral) < ROAD_W / 2 + 1.5;
      if (direct || passed) { knock(o, car, direct); onHit(o, direct); }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const o = active[i];
      o.t += dt;
      const m = o.mesh;
      o.vel.y -= GRAVITY * dt;
      m.position.addScaledVector(o.vel, dt);
      m.rotation.x += o.ang.x * dt; m.rotation.y += o.ang.y * dt; m.rotation.z += o.ang.z * dt;
      if (m.position.y < 0.1) {
        m.position.y = 0.1;
        o.vel.y *= -0.3; o.vel.x *= 0.7; o.vel.z *= 0.7; o.ang.multiplyScalar(0.6);
      }
      if (o.t > 3.5) {
        m.position.y -= dt * 1.5;
        if (o.t > 5) { m.removeFromParent(); active.splice(i, 1); }
      }
    }
    const on = Math.sin(t * 8) > 0;
    for (const o of list) if (!o.hit && o.kind === 'feat' && Math.abs(o.s - car.s) < 300) o.mesh.userData.lamp.emissiveIntensity = on ? 2.2 : 0.2;
  }

  return { list, update };
}
