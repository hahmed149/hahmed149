import * as THREE from 'three';
import { asphalt, facade, label } from './textures.js';

export const ROAD_W = 11;
const FLAT = 75; // flat corridor half-width either side of the road

// ---------- noise ----------
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) {
  return noise(x, z) * 0.55 + noise(x * 2.03, z * 2.03) * 0.28 + noise(x * 4.1, z * 4.1) * 0.12 + noise(x * 8.3, z * 8.3) * 0.05;
}
export const rnd = (i, k = 0) => hash(i * 1.37 + k * 9.1, k * 3.7 + i * 0.13);

// ---------- layout ----------
// Lays the career out along one highway. Each section gets road length for
// its obstacles, a landmark near its end, and an overhead sign at its start.
export function layout(sections, semesters) {
  const GAP = 26;
  let s = 60;
  const plan = sections.map((sec, si) => {
    const start = s;
    const items = [];
    s += 90; // room after the welcome gantry
    if (sec.kind === 'campus') {
      semesters.forEach((sem, i) => { items.push({ type: 'gate', s, sem, index: i }); s += GAP + 6; });
    }
    sec.obstacles.forEach(([lbl, text], i) => { items.push({ type: 'barricade', s, label: lbl, text, index: i }); s += GAP; });
    s += 60;
    const landmarkS = s;
    s += 120;
    return { ...sec, start, end: s, landmarkS, items, side: si % 2 ? -1 : 1 };
  });
  return { plan, length: s + 80 };
}

// ---------- road ----------
export function buildRoad(length) {
  // Serpentine route heading "north" (-z)
  const step = 20, pts = [];
  let x = 0, z = 0, h;
  for (let d = 0; d <= length + step; d += step) {
    pts.push(new THREE.Vector3(x, 0, z));
    h = Math.PI + 1.05 * Math.sin(d / 430) + 0.35 * Math.sin(d / 157 + 1.3);
    x += Math.sin(h) * step; z += Math.cos(h) * step;
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const total = curve.getLength();
  const N = Math.ceil(total / 1.5);
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    samples.push({ i, u, s: u * total, p, t, n: new THREE.Vector3(-t.z, 0, t.x), heading: Math.atan2(t.x, t.z) });
  }
  const at = (dist) => samples[THREE.MathUtils.clamp(Math.round((dist / total) * N), 0, N)];

  let last = 0;
  function nearest(pos, wide = false) {
    let best = last, bd = Infinity;
    const lo = wide ? 0 : Math.max(0, last - 120), hi = wide ? N : Math.min(N, last + 120);
    for (let i = lo; i <= hi; i++) {
      const q = samples[i].p, d = (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (!wide && bd > 900) return nearest(pos, true);
    last = best;
    return { sample: samples[best], dist: Math.sqrt(bd) };
  }
  return { curve, samples, total, at, nearest, reset: (i) => { last = i; } };
}

function ribbon(samples, width, y, uvScale) {
  const pos = [], uv = [], idx = [];
  samples.forEach((s, i) => {
    pos.push(s.p.x + s.n.x * width / 2, y, s.p.z + s.n.z * width / 2, s.p.x - s.n.x * width / 2, y, s.p.z - s.n.z * width / 2);
    uv.push(0, s.s / uvScale, 1, s.s / uvScale);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- world ----------
export function buildWorld(scene, road, plan) {
  const { samples } = road;
  const coarse = samples.filter((_, i) => i % 8 === 0);
  const sectionAt = (dist) => plan.find((p) => dist < p.end) ?? plan.at(-1);
  const near = (x, z) => {
    let bd = Infinity, bs = coarse[0];
    for (const c of coarse) { const d = (c.p.x - x) ** 2 + (c.p.z - z) ** 2; if (d < bd) { bd = d; bs = c; } }
    return { d: Math.sqrt(bd), s: bs };
  };

  // Terrain
  const box = new THREE.Box3().setFromPoints(samples.map((s) => s.p));
  const W = box.max.x - box.min.x + 900, D = box.max.z - box.min.z + 900;
  const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
  const tg = new THREE.PlaneGeometry(W, D, Math.round(W / 11), Math.round(D / 11));
  tg.rotateX(-Math.PI / 2);
  tg.translate(cx, 0, cz);
  const tp = tg.attributes.position, colors = [];
  const pal = {
    wheat: new THREE.Color('#c9a95c'), grass: new THREE.Color('#6f8f45'), lawn: new THREE.Color('#5f8f3e'),
    dry: new THREE.Color('#a79a62'), city: new THREE.Color('#8e8f86'),
  };
  const heightAt = (x, z, d) => fbm(x * 0.006, z * 0.006) * 70 * THREE.MathUtils.smoothstep(d, FLAT, FLAT + 160);
  const tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const { d, s } = near(x, z);
    tp.setY(i, heightAt(x, z, d) - 0.08);
    const sec = sectionAt(s.s);
    const n = fbm(x * 0.01 + 17, z * 0.01);
    if (sec.id === 'ksu' || sec.id === 'collegian') tmp.copy(pal.lawn).lerp(pal.grass, n);
    else if (['cerner', 'rxss', 'chicago'].includes(sec.id) && d < 130) tmp.copy(pal.city).lerp(pal.grass, THREE.MathUtils.smoothstep(d, 60, 130));
    else tmp.copy(n > 0.5 ? pal.grass : pal.wheat).lerp(pal.dry, fbm(x * 0.04, z * 0.04) * 0.5);
    tmp.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.04);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Road
  const roadMesh = new THREE.Mesh(ribbon(samples, ROAD_W, 0.05, ROAD_W * 1.6), new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.92 }));
  const shoulder = new THREE.Mesh(ribbon(samples, ROAD_W + 3, 0.02, 20), new THREE.MeshStandardMaterial({ color: '#8b8579', roughness: 1 }));
  roadMesh.receiveShadow = shoulder.receiveShadow = true;
  scene.add(shoulder, roadMesh);

  // Street lights every 70 units, alternating sides
  const lights = samples.filter((s) => s.s % 70 < 1.5);
  const poleG = new THREE.CylinderGeometry(0.12, 0.18, 8, 6).translate(0, 4, 0);
  const armG = new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 8, 1.2);
  const lampG = new THREE.BoxGeometry(0.5, 0.18, 0.9).translate(0, 7.9, 2.4);
  const metal = new THREE.MeshStandardMaterial({ color: '#8d949b', metalness: 0.7, roughness: 0.4 });
  const lampM = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff0c0', emissiveIntensity: 0.6 });
  const poles = new THREE.InstancedMesh(poleG, metal, lights.length);
  const arms = new THREE.InstancedMesh(armG, metal, lights.length);
  const lamps = new THREE.InstancedMesh(lampG, lampM, lights.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  lights.forEach((s, i) => {
    const side = i % 2 ? 1 : -1;
    const pos = s.p.clone().addScaledVector(s.n, side * (ROAD_W / 2 + 2.2));
    q.setFromAxisAngle(Y, Math.atan2(-s.n.x * side, -s.n.z * side));
    m.compose(pos, q, one);
    poles.setMatrixAt(i, m); arms.setMatrixAt(i, m); lamps.setMatrixAt(i, m);
  });
  poles.castShadow = true;
  scene.add(poles, arms, lamps);

  // Overhead welcome gantries at the start of each section
  plan.forEach((sec) => {
    const exit = sec.years === 'Now' ? 'Now' : `Exit ${sec.years.slice(0, 4)}`;
    scene.add(gantry(road.at(sec.start + 30), [sec.company, sec.place], exit));
  });

  // Keep-out zones for scenery around landmarks
  const keepOut = plan.map((sec) => {
    const s = road.at(sec.landmarkS);
    return { p: s.p.clone().addScaledVector(s.n, sec.side * 50), r: 62 };
  });

  // City blocks around the urban sections
  const facadeSpecs = [
    { wall: '#7d8a96', glass: '#23313f', cols: 4, rows: 6 },
    { wall: '#a39a8b', glass: '#34414c', cols: 5, rows: 6, frame: '#cfc6b6' },
    { wall: '#3d4a57', glass: '#5a7f9e', cols: 6, rows: 8, glassy: true },
    { wall: '#b6aea1', glass: '#2e3b46', cols: 3, rows: 5 },
  ];
  const roofM = new THREE.MeshStandardMaterial({ color: '#55595e', roughness: 0.9 });
  plan.filter((p) => ['softek', 'cerner', 'rxss', 'oneimaging', 'chicago'].includes(p.id)).forEach((sec, si) => {
    const dense = sec.id === 'chicago' ? 2.2 : sec.id === 'cerner' || sec.id === 'rxss' ? 1.3 : 0.7;
    for (let s = sec.start + 60; s < sec.end - 20; s += 34 / dense) {
      for (const side of [-1, 1]) {
        const k = Math.floor(s * 7 + side * 3 + si);
        if (rnd(k, 1) < 0.25) continue;
        const f = road.at(s);
        const off = 26 + rnd(k, 2) * 60;
        const pos = f.p.clone().addScaledVector(f.n, side * off);
        if (keepOut.some((z) => z.p.distanceTo(pos) < z.r)) continue;
        if (near(pos.x, pos.z).d < 22) continue;
        const w = 10 + rnd(k, 3) * 12, dpt = 10 + rnd(k, 4) * 12;
        const h = (sec.id === 'chicago' ? 20 + rnd(k, 5) ** 2 * 110 : 8 + rnd(k, 5) ** 2 * 45) * (off < 50 ? 0.7 : 1);
        const spec = facadeSpecs[k % facadeSpecs.length];
        const t = facade(spec).clone();
        t.needsUpdate = true;
        t.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
        const wall = new THREE.MeshStandardMaterial({ map: t, roughness: spec.glassy ? 0.25 : 0.8, metalness: spec.glassy ? 0.5 : 0.05 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), [wall, wall, roofM, roofM, wall, wall]);
        b.position.set(pos.x, h / 2, pos.z);
        b.rotation.y = f.heading;
        b.castShadow = b.receiveShadow = true;
        scene.add(b);
      }
    }
  });

  // Trees: broadleaf and conifers outside the corridor
  const broad = [], conifer = [];
  const count = Math.round((W * D) / 900);
  for (let i = 0; i < count; i++) {
    const x = box.min.x - 450 + rnd(i, 11) * W, z = box.min.z - 450 + rnd(i, 12) * D;
    const nd = near(x, z);
    if (nd.d < 16) continue;
    const sec = sectionAt(nd.s.s);
    const urban = ['cerner', 'rxss', 'chicago'].includes(sec.id) && nd.d < 120;
    if (urban && rnd(i, 13) > 0.15) continue;
    if (fbm(x * 0.012, z * 0.012) < (nd.d < FLAT ? 0.55 : 0.45)) continue;
    if (keepOut.some((k) => Math.hypot(k.p.x - x, k.p.z - z) < k.r)) continue;
    const y = heightAt(x, z, nd.d);
    (rnd(i, 14) < 0.35 ? conifer : broad).push([x, y, z, 0.8 + rnd(i, 15) * 0.9, rnd(i, 16)]);
  }
  const trunkG = new THREE.CylinderGeometry(0.22, 0.38, 3, 6).translate(0, 1.5, 0);
  const crownG = new THREE.IcosahedronGeometry(2.6, 1).translate(0, 4.6, 0);
  const crown2G = new THREE.IcosahedronGeometry(1.9, 1).translate(1.2, 5.6, 0.6);
  const coneG = new THREE.ConeGeometry(2, 7, 7).translate(0, 5, 0);
  const barkM = new THREE.MeshStandardMaterial({ color: '#5b4330', roughness: 1 });
  const leafM = new THREE.MeshStandardMaterial({ color: '#4f7a36', roughness: 0.9, flatShading: true });
  const leaf2M = new THREE.MeshStandardMaterial({ color: '#5f8a3a', roughness: 0.9, flatShading: true });
  const pineM = new THREE.MeshStandardMaterial({ color: '#2f5a33', roughness: 0.9, flatShading: true });
  const inst = (geo, mat, list, stretch = 1) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, sc, r], i) => {
      q.setFromAxisAngle(Y, r * 6.28);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc * stretch, sc));
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    scene.add(im);
  };
  inst(trunkG, barkM, broad); inst(crownG, leafM, broad); inst(crown2G, leaf2M, broad);
  inst(trunkG, barkM, conifer); inst(coneG, pineM, conifer, 1.2);

  return { sectionAt, heightAt, bounds: { box, W, D, cx, cz } };
}

function gantry(s, lines, exit) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.45 });
  const span = ROAD_W + 6;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 9, 8), metal);
    post.position.set(side * span / 2, 4.5, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.5, 0.5), metal);
  beam.position.y = 8.6;
  g.add(beam);
  const signW = 11, signH = 3.4;
  const back = new THREE.MeshStandardMaterial({ color: '#6b7178' });
  const face = new THREE.MeshBasicMaterial({ map: label(lines, { w: 1100, h: 340 }), toneMapped: false });
  const board = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.2), [back, back, back, back, face, back]);
  board.position.set(0, 7.2 + signH / 2 - 0.4, 0.4);
  const tabFace = new THREE.MeshBasicMaterial({ map: label([exit], { w: 360, h: 100, bg: '#f7f9f4', fg: '#0b6b3a', border: false }), toneMapped: false });
  const tab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1, 0.2), [back, back, back, back, tabFace, back]);
  tab.position.set(signW / 2 - 2, 7.2 + signH + 0.1, 0.45);
  g.add(board, tab);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.position.copy(s.p);
  g.rotation.y = s.heading + Math.PI; // face oncoming traffic
  return g;
}
