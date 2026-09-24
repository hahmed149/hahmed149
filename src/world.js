import * as THREE from 'three';
import { asphalt, facade, label } from './textures.js';

export const ROAD_W = 10;
export const LANE_GAP = 16;       // distance between parallel roads
const MONTH = 30;                 // road units per month
const FLAT = 120;                 // flat corridor half-width around the centre line

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
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

// ---------- timeline layout ----------
const months = (d, from) => {
  const [y, m] = d.split('-').map(Number), [y0, m0] = from.split('-').map(Number);
  return (y - y0) * 12 + (m - m0);
};

export function layout({ sections, semesters, finish, NOW, TIMELINE_START }) {
  const sOf = (d) => 80 + months(d, TIMELINE_START) * MONTH;
  const nowS = sOf(NOW);
  const finishS = nowS + 180;
  const length = finishS + 320;

  const roles = sections.map((sec, i) => {
    const taper = sec.slot ? 50 + 22 * Math.abs(sec.slot) : 0;
    const s0 = sOf(sec.start);
    let s1 = sec.end === 'now' ? finishS - 30 : sOf(sec.end);
    const minLen = taper * 2 + sec.obstacles.length * 20 + 60;
    if (s1 - s0 < minLen) s1 = s0 + minLen;
    return { ...sec, index: i, taper, s0, s1 };
  });

  // Lateral offset of a role's road at distance s (0 before it branches off)
  const offset = (r, s) => (r.slot ? r.slot * LANE_GAP * smooth(s, r.s0, r.s0 + r.taper) * (1 - smooth(s, r.s1 - r.taper, r.s1)) : 0);
  const activeAt = (s) => roles.filter((r) => r.slot && s > r.s0 && s < r.s1);
  const lanesAt = (s) => [0, ...activeAt(s).map((r) => offset(r, s))];

  // Obstacles per role: dated ones on their date, the rest spread out, then spaced apart
  roles.forEach((r) => {
    const a = r.slot ? r.s0 + r.taper + 26 : r.s0 + 30;
    const b = r.slot ? r.s1 - r.taper - 12 : r.s1 - 16;
    const items = [];
    if (r.kind === 'campus') {
      semesters.forEach((sem, k) => items.push({ type: 'gate', s: THREE.MathUtils.clamp(sOf(sem.date), a, b), sem, index: k, gap: 26 }));
    }
    const undated = r.obstacles.filter((o) => !o[2]);
    let u = 0;
    r.obstacles.forEach(([lbl, text, date, kind], k) => {
      const s = date ? THREE.MathUtils.clamp(sOf(date), a, b) : a + ((u++ + 0.5) / undated.length) * (b - a);
      items.push({ type: kind === 'award' ? 'award' : 'barricade', s, label: lbl, text, index: k, gap: 18 });
    });
    items.sort((x, y) => x.s - y.s);
    for (let k = 1; k < items.length; k++) {
      const need = Math.max(items[k - 1].gap, 16);
      if (items[k].s < items[k - 1].s + need) items[k].s = items[k - 1].s + need;
    }
    r.items = items;
    // Landmark: beside the road, outside every road active around it
    r.landmarkS = r.slot ? r.s0 + r.taper + 10 : r.s0 + 12;
    const nearby = roles.filter((o) => o.slot && o !== r && o.s0 < r.landmarkS + 90 && o.s1 > r.landmarkS - 60);
    let side = r.slot ? Math.sign(r.slot) : (nearby.filter((o) => o.slot > 0).length <= nearby.filter((o) => o.slot < 0).length ? 1 : -1);
    const outer = Math.max(Math.abs(r.slot), ...nearby.filter((o) => Math.sign(o.slot) === side).map((o) => Math.abs(o.slot)));
    r.side = side;
    r.landmarkOffset = side * (outer * LANE_GAP + 52);
  });

  const fin = { ...finish, landmarkS: finishS + 110, side: 1, landmarkOffset: 58, s0: finishS, items: [] };
  const years = [];
  for (let y = +TIMELINE_START.slice(0, 4) + 1; y <= +NOW.slice(0, 4); y++) years.push({ year: y, s: sOf(`${y}-01`) });

  return { roles, finish: fin, offset, activeAt, lanesAt, sOf, nowS, finishS, length, years };
}

// ---------- road centre line ----------
export function buildRoad(length) {
  const step = 20, pts = [];
  let x = 0, z = 0;
  for (let d = 0; d <= length + step; d += step) {
    pts.push(new THREE.Vector3(x, 0, z));
    const h = Math.PI + 0.75 * Math.sin(d / 520) + 0.22 * Math.sin(d / 190 + 1.3);
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
  // exact point at distance s with a lateral offset
  const point = (s, off = 0) => {
    const u = THREE.MathUtils.clamp(s / total, 0, 1);
    const p = curve.getPointAt(u), t = curve.getTangentAt(u);
    return { p: p.add(new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(off)), t };
  };

  let last = 0;
  function nearest(pos, wide = false) {
    let best = last, bd = Infinity;
    const lo = wide ? 0 : Math.max(0, last - 160), hi = wide ? N : Math.min(N, last + 160);
    for (let i = lo; i <= hi; i++) {
      const q = samples[i].p, d = (q.x - pos.x) ** 2 + (q.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (!wide && bd > 8100) return nearest(pos, true);
    last = best;
    return { sample: samples[best], dist: Math.sqrt(bd) };
  }
  return { curve, samples, total, at, point, nearest, reset: (i) => { last = i; } };
}

function laneRibbon(samples, from, to, offFn, width, y, uvScale) {
  const pos = [], uv = [], idx = [];
  const pick = samples.filter((s) => s.s >= from && s.s <= to);
  pick.forEach((s, i) => {
    const off = offFn(s.s);
    const cx = s.p.x + s.n.x * off, cz = s.p.z + s.n.z * off;
    pos.push(cx + s.n.x * width / 2, y, cz + s.n.z * width / 2, cx - s.n.x * width / 2, y, cz - s.n.z * width / 2);
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
export function buildWorld(scene, road, T) {
  const { samples } = road;
  const coarse = samples.filter((_, i) => i % 8 === 0);
  const near = (x, z) => {
    let bd = Infinity, bs = coarse[0];
    for (const c of coarse) { const d = (c.p.x - x) ** 2 + (c.p.z - z) ** 2; if (d < bd) { bd = d; bs = c; } }
    return { d: Math.sqrt(bd), s: bs };
  };
  const roleAt = (s) => T.roles.filter((r) => !r.slot && s >= r.s0 - 1).at(-1)?.id ?? 'ksu';

  // Terrain
  const box = new THREE.Box3().setFromPoints(samples.map((s) => s.p));
  const W = box.max.x - box.min.x + 1000, D = box.max.z - box.min.z + 1000;
  const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
  const tg = new THREE.PlaneGeometry(W, D, Math.round(W / 12), Math.round(D / 12));
  tg.rotateX(-Math.PI / 2);
  tg.translate(cx, 0, cz);
  const tp = tg.attributes.position, colors = [];
  const pal = {
    wheat: new THREE.Color('#c9a95c'), grass: new THREE.Color('#6f8f45'), lawn: new THREE.Color('#5f8f3e'),
    dry: new THREE.Color('#a79a62'), city: new THREE.Color('#8e8f86'),
  };
  const heightAt = (x, z, d) => fbm(x * 0.005, z * 0.005) * 80 * smooth(d, FLAT, FLAT + 180);
  const tmp = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const { d, s } = near(x, z);
    tp.setY(i, heightAt(x, z, d) - 0.08);
    const id = roleAt(s.s);
    const n = fbm(x * 0.01 + 17, z * 0.01);
    if (id === 'ksu') tmp.copy(pal.lawn).lerp(pal.grass, n);
    else if ((id === 'cerner' || s.s > T.finishS - 100) && d < 170) tmp.copy(pal.city).lerp(pal.grass, smooth(d, 90, 170));
    else tmp.copy(n > 0.5 ? pal.grass : pal.wheat).lerp(pal.dry, fbm(x * 0.04, z * 0.04) * 0.5);
    tmp.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.04);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Roads: the main road plus one branch per overlapping role
  const roadM = new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.92 });
  const shoulderM = new THREE.MeshStandardMaterial({ color: '#8b8579', roughness: 1 });
  const addLane = (from, to, offFn, y = 0) => {
    const r = new THREE.Mesh(laneRibbon(samples, from, to, offFn, ROAD_W, 0.05 + y, ROAD_W * 1.6), roadM);
    const sh = new THREE.Mesh(laneRibbon(samples, from, to, offFn, ROAD_W + 3, 0.02 + y, 20), shoulderM);
    r.receiveShadow = sh.receiveShadow = true;
    scene.add(sh, r);
  };
  addLane(0, road.total, () => 0);
  T.roles.filter((r) => r.slot).forEach((r, k) => addLane(r.s0, r.s1, (s) => T.offset(r, s), 0.004 * (k + 1)));

  // Street lights along the main road
  const lights = samples.filter((s) => s.s % 70 < 1.5);
  const poleG = new THREE.CylinderGeometry(0.12, 0.18, 8, 6).translate(0, 4, 0);
  const armG = new THREE.BoxGeometry(0.12, 0.12, 2.6).translate(0, 8, 1.2);
  const lampG = new THREE.BoxGeometry(0.5, 0.18, 0.9).translate(0, 7.9, 2.4);
  const metal = new THREE.MeshStandardMaterial({ color: '#8d949b', metalness: 0.7, roughness: 0.4 });
  const lampM = new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#fff0c0', emissiveIntensity: 0.6 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
  const lit = [];
  lights.forEach((s, i) => {
    const side = i % 2 ? 1 : -1;
    // skip if a branch road occupies that side here
    if (T.activeAt(s.s).some((r) => Math.sign(r.slot) === side)) return;
    lit.push([s, side]);
  });
  const poles = new THREE.InstancedMesh(poleG, metal, lit.length);
  const arms = new THREE.InstancedMesh(armG, metal, lit.length);
  const lamps = new THREE.InstancedMesh(lampG, lampM, lit.length);
  lit.forEach(([s, side], i) => {
    const pos = s.p.clone().addScaledVector(s.n, side * (ROAD_W / 2 + 2.2));
    q.setFromAxisAngle(Y, Math.atan2(-s.n.x * side, -s.n.z * side));
    m.compose(pos, q, one);
    poles.setMatrixAt(i, m); arms.setMatrixAt(i, m); lamps.setMatrixAt(i, m);
  });
  poles.castShadow = true;
  scene.add(poles, arms, lamps);

  // Welcome gantry over each role's road, and year markers on every open road
  T.roles.forEach((r) => {
    const s = r.slot ? r.s0 + r.taper + 4 : r.s0 + 4;
    const f = road.at(s);
    const g = gantry([r.company, r.place], r.years);
    g.position.copy(f.p).addScaledVector(f.n, T.offset(r, s));
    g.rotation.y = f.heading + Math.PI;
    scene.add(g);
  });
  T.years.forEach(({ year, s }) => {
    const f = road.at(s);
    T.lanesAt(s).forEach((off) => {
      const post = yearPost(String(year));
      post.position.copy(f.p).addScaledVector(f.n, off - ROAD_W / 2 - 1.6);
      post.rotation.y = f.heading + Math.PI;
      scene.add(post);
    });
  });
  // Finish arch in Chicago
  {
    const f = road.at(T.finishS);
    const g = gantry(['Chicago, IL', 'Every road ends here'], 'Now', ROAD_W + 6);
    g.position.copy(f.p); g.rotation.y = f.heading + Math.PI;
    scene.add(g);
  }

  // Keep-out zones for scenery around landmarks
  const keepOut = [...T.roles, T.finish].map((r) => {
    const f = road.at(r.landmarkS);
    return { p: f.p.clone().addScaledVector(f.n, r.landmarkOffset), r: 66 };
  });
  const clearOfRoads = (s, off, gap = 12) => T.lanesAt(s).every((o) => Math.abs(o - off) > ROAD_W / 2 + gap);

  // City blocks: Kansas City (Cerner) and Chicago (finish)
  const facadeSpecs = [
    { wall: '#7d8a96', glass: '#23313f', cols: 4, rows: 6 },
    { wall: '#a39a8b', glass: '#34414c', cols: 5, rows: 6, frame: '#cfc6b6' },
    { wall: '#3d4a57', glass: '#5a7f9e', cols: 6, rows: 8, glassy: true },
    { wall: '#b6aea1', glass: '#2e3b46', cols: 3, rows: 5 },
  ];
  const roofM = new THREE.MeshStandardMaterial({ color: '#55595e', roughness: 0.9 });
  const cerner = T.roles.find((r) => r.id === 'cerner');
  const zones = [[cerner.s0 + 60, cerner.s1 - 20, 1.3, 50], [T.finishS - 80, T.finishS + 260, 2.4, 120]];
  zones.forEach(([from, to, dense, hMax], zi) => {
    for (let s = from; s < to; s += 30 / dense) {
      for (const side of [-1, 1]) {
        const k = Math.floor(s * 7 + side * 3 + zi * 101);
        if (rnd(k, 1) < 0.25) continue;
        const f = road.at(s);
        const off = side * (28 + rnd(k, 2) * 80);
        if (!clearOfRoads(s, off)) continue;
        const pos = f.p.clone().addScaledVector(f.n, off);
        if (keepOut.some((z) => z.p.distanceTo(pos) < z.r)) continue;
        if (near(pos.x, pos.z).d < 22) continue;
        const w = 10 + rnd(k, 3) * 12, dpt = 10 + rnd(k, 4) * 12;
        const h = (12 + rnd(k, 5) ** 2 * hMax) * (Math.abs(off) < 50 ? 0.7 : 1);
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

  // Trees outside the roads
  const broad = [], conifer = [];
  const count = Math.round((W * D) / 950);
  for (let i = 0; i < count; i++) {
    const x = box.min.x - 500 + rnd(i, 11) * W, z = box.min.z - 500 + rnd(i, 12) * D;
    const nd = near(x, z);
    if (nd.d > FLAT && fbm(x * 0.012, z * 0.012) < 0.45) continue;
    if (nd.d <= FLAT) {
      if (fbm(x * 0.012, z * 0.012) < 0.5) continue;
      const lat = (x - nd.s.p.x) * nd.s.n.x + (z - nd.s.p.z) * nd.s.n.z;
      if (!clearOfRoads(nd.s.s, lat, 22) || !clearOfRoads(nd.s.s + 40, lat, 22) || !clearOfRoads(nd.s.s - 40, lat, 22)) continue;
    }
    if (keepOut.some((k) => Math.hypot(k.p.x - x, k.p.z - z) < k.r)) continue;
    const id = roleAt(nd.s.s);
    if ((id === 'cerner' || nd.s.s > T.finishS - 100) && nd.d < 150 && rnd(i, 13) > 0.15) continue;
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
}

function gantry(lines, tabText, span = ROAD_W + 5) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.45 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 9, 8), metal);
    post.position.set(side * span / 2, 4.5, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span, 0.45, 0.45), metal);
  beam.position.y = 8.6;
  g.add(beam);
  const signW = Math.min(span - 1, 10.5), signH = 3.2;
  const back = new THREE.MeshStandardMaterial({ color: '#6b7178' });
  const face = new THREE.MeshBasicMaterial({ map: label(lines, { w: 1050, h: 320 }), toneMapped: false });
  const board = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.2), [back, back, back, back, face, back]);
  board.position.set(0, 7.2 + signH / 2 - 0.4, 0.4);
  const tabFace = new THREE.MeshBasicMaterial({ map: label([tabText], { w: 420, h: 100, bg: '#f7f9f4', fg: '#0b6b3a', border: false }), toneMapped: false });
  const tab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1, 0.2), [back, back, back, back, tabFace, back]);
  tab.position.set(signW / 2 - 2.3, 7.2 + signH + 0.1, 0.45);
  g.add(board, tab);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function yearPost(text) {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.45 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), metal);
  pole.position.y = 1.6;
  const back = new THREE.MeshStandardMaterial({ color: '#6b7178' });
  const face = new THREE.MeshBasicMaterial({ map: label([text], { w: 300, h: 180 }), toneMapped: false });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 0.08), [back, back, back, back, face, back]);
  plate.position.y = 3.4;
  g.add(pole, plate);
  return g;
}
