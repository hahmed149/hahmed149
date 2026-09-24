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

// Builds all obstacles along the road. Each has a trigger distance `s` along the
// road; passing it (or hitting it) knocks it over and reports it as overcome.
export function buildObstacles(scene, road, plan) {
  const list = [];
  plan.forEach((sec, si) => {
    sec.items.forEach((item) => {
      if (item.type === 'gate') {
        const f = road.at(item.s);
        const gate = semesterGate(item.sem);
        gate.position.copy(f.p); gate.rotation.y = f.heading + Math.PI;
        scene.add(gate);
        const n = item.sem.courses.length;
        const cf = road.at(item.s + 8);
        item.sem.courses.forEach(([code, name], k) => {
          const c = cone();
          const lateral = (k - (n - 1) / 2) * Math.min(1.7, (ROAD_W - 2) / Math.max(1, n - 1));
          c.position.copy(cf.p).addScaledVector(cf.n, lateral);
          c.add(tag(code));
          scene.add(c);
          list.push({ kind: 'course', mesh: c, s: item.s + 8, lateral, radius: 0.7, section: si, title: code, text: `${code}: ${name}`, term: item.sem.term });
        });
      } else {
        const f = road.at(item.s);
        const b = barricade(item.label);
        const lateral = item.index % 2 ? -2.3 : 2.3;
        b.position.copy(f.p).addScaledVector(f.n, lateral);
        b.rotation.y = f.heading + Math.PI;
        scene.add(b);
        list.push({ kind: 'feat', mesh: b, s: item.s, lateral, radius: 2.6, section: si, title: item.label, text: item.text });
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

  // car: { x, z, heading, speed, s, lateral }
  function update(dt, car, t, onHit) {
    for (const o of list) {
      if (o.hit) continue;
      if (Math.abs(o.s - car.s) > 6) continue;
      const dx = o.mesh.position.x - car.x, dz = o.mesh.position.z - car.z;
      const dist = Math.hypot(dx, dz);
      const direct = dist < o.radius + 1.2;
      const passed = car.s > o.s + 0.5 && car.prevS <= o.s + 0.5 && Math.abs(car.lateral) < ROAD_W / 2 + 3;
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
    // beacons blink
    const on = Math.sin(t * 8) > 0;
    for (const o of list) if (!o.hit && o.kind === 'feat') o.mesh.userData.lamp.emissiveIntensity = on ? 2.2 : 0.2;
  }

  return { list, update };
}
