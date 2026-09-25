import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { label, shield } from './textures.js';
import { BRANCH } from './theme.js';

export const ROAD_W = 8;          // one lane
export const LANE_GAP = 8;        // lanes sit side by side, no gap
const MONTH = 36;                 // road units per month
const FLAT = 150;                 // flat corridor half-width around the centre line

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

export function layout({ sections, semesters, finish, community, NOW, TIMELINE_START }) {
  const sOf = (d) => 80 + months(d, TIMELINE_START) * MONTH;
  const nowS = sOf(NOW);
  const finishS = nowS + 180;
  const length = finishS + 320;

  const roles = sections.map((sec, i) => {
    const taper = sec.slot ? 34 + 14 * Math.abs(sec.slot) : 0;
    const s0 = sOf(sec.start);
    let s1 = sec.end === 'now' ? finishS - 30 : sOf(sec.end);
    const minLen = taper * 2 + sec.obstacles.length * 15 + 24;
    if (s1 - s0 < minLen) s1 = s0 + minLen;
    return { ...sec, index: i, taper, s0, s1 };
  });

  // Lateral offset of a role's road at distance s (0 before it branches off)
  const offset = (r, s) => (r.slot ? r.slot * LANE_GAP * smooth(s, r.s0, r.s0 + r.taper) * (1 - smooth(s, r.s1 - r.taper, r.s1)) : 0);
  const activeAt = (s) => roles.filter((r) => r.slot && s > r.s0 && s < r.s1);
  const lanesAt = (s) => [0, ...activeAt(s).map((r) => offset(r, s))];

  // Obstacles per role: dated ones on their date, the rest spread out, then spaced apart
  roles.forEach((r) => {
    const a = r.slot ? r.s0 + r.taper + 12 : r.s0 + 30;
    const b = r.slot ? r.s1 - r.taper - 6 : r.s1 - 16;
    const items = [];
    if (r.kind === 'campus') {
      semesters.forEach((sem, k) => items.push({ type: 'gate', s: THREE.MathUtils.clamp(sOf(sem.date), a, b), sem, index: k, gap: 26 }));
    }
    const undated = r.obstacles.filter((o) => !o[2]);
    let u = 0;
    r.obstacles.forEach(([lbl, text, date, kind], k) => {
      const s = date ? THREE.MathUtils.clamp(sOf(date), a, b) : a + ((u++ + 0.5) / undated.length) * (b - a);
      items.push({ type: kind === 'award' ? 'release' : 'commit', s, label: lbl, text, index: k, gap: 15 });
    });
    items.sort((x, y) => x.s - y.s);
    for (let k = 1; k < items.length; k++) {
      const need = Math.max(items[k - 1].gap, 15);
      if (items[k].s < items[k - 1].s + need) items[k].s = items[k - 1].s + need;
    }
    r.items = items;
    // Landmark: beside the road, outside every road active around it
    r.landmarkS = r.slot ? r.s0 + r.taper + 10 : r.s0 + 12;
    const nearby = roles.filter((o) => o.slot && o !== r && o.s0 < r.landmarkS + 90 && o.s1 > r.landmarkS - 60);
    let side = r.slot ? Math.sign(r.slot) : (nearby.filter((o) => o.slot > 0).length <= nearby.filter((o) => o.slot < 0).length ? 1 : -1);
    const outer = Math.max(Math.abs(r.slot), ...nearby.filter((o) => Math.sign(o.slot) === side).map((o) => Math.abs(o.slot)));
    r.side = side;
    r.landmarkOffset = side * (outer * LANE_GAP + ROAD_W / 2 + 44);
  });

  // Hackathons and community: releases on main, by date
  (community ?? []).forEach(([lbl, text, date], k) => {
    const s = sOf(date);
    const host = roles.filter((r) => !r.slot && s >= r.s0).at(-1);
    host.items.push({ type: 'release', community: true, s, label: lbl, text, index: 100 + k, gap: 18 });
    host.items.sort((x, y) => x.s - y.s);
    for (let i = 1; i < host.items.length; i++) if (host.items[i].s < host.items[i - 1].s + 16) host.items[i].s = host.items[i - 1].s + 16;
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
    const h = Math.PI + 0.6 * Math.sin(d / 380) + 0.38 * Math.sin(d / 140 + 1.3) + 0.12 * Math.sin(d / 55 + 0.4);
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

function laneRibbon(samples, from, to, offFn, width, y, colorFn) {
  const pos = [], col = [], uv = [], idx = [];
  const pick = samples.filter((s) => s.s >= from && s.s <= to);
  const c = new THREE.Color();
  pick.forEach((s, i) => {
    const off = offFn(s.s);
    const cx = s.p.x + s.n.x * off, cz = s.p.z + s.n.z * off;
    pos.push(cx + s.n.x * width / 2, y, cz + s.n.z * width / 2, cx - s.n.x * width / 2, y, cz - s.n.z * width / 2);
    uv.push(0, s.s / 20, 1, s.s / 20);
    if (colorFn) { c.set(colorFn(s.s)); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(80,120,200,0.55)'; g.lineWidth = 2;
  g.strokeRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(80,120,200,0.18)'; g.lineWidth = 1;
  for (let i = 64; i < 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Neon sign: dark glass panel with glowing text and border, facing +z
export function neonSign(lines, color, w = 10, h = 3, mono = false) {
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * 110); cv.height = Math.round(h * 110);
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(6,10,20,0.78)';
  g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, 26); g.fill();
  g.strokeStyle = color; g.lineWidth = 7; g.shadowColor = color; g.shadowBlur = 18;
  g.beginPath(); g.roundRect(8, 8, cv.width - 16, cv.height - 16, 20); g.stroke();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    const first = i === 0;
    let size = cv.height * (n === 1 ? 0.42 : first ? 0.3 : 0.2);
    const font = mono || (first && line.startsWith('$')) ? '"JetBrains Mono", ui-monospace, monospace' : '"Overpass", system-ui, sans-serif';
    g.font = `${first ? 800 : 600} ${size}px ${font}`;
    while (g.measureText(line).width > cv.width * 0.88 && size > 8) { size -= 2; g.font = `${first ? 800 : 600} ${size}px ${font}`; }
    g.fillStyle = first ? color : '#e8eefc';
    g.shadowBlur = first ? 14 : 0;
    const y = n === 1 ? cv.height / 2 : cv.height * (0.36 + (i - (n - 1) / 2) * 0.34) + (first ? 0 : cv.height * 0.06);
    g.fillText(line, cv.width / 2, y);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
  return m;
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
  const mainRole = (s) => T.roles.filter((r) => !r.slot && s >= r.s0 - 1).at(-1) ?? T.roles[0];
  const roleColor = (r) => BRANCH[r.id] ?? BRANCH.main;

  // Ground: dark terrain with a faint blueprint grid, hills far from the roads
  const box = new THREE.Box3().setFromPoints(samples.map((s) => s.p));
  const W = box.max.x - box.min.x + 1600, D = box.max.z - box.min.z + 1600;
  const cx = (box.max.x + box.min.x) / 2, cz = (box.max.z + box.min.z) / 2;
  const tg = new THREE.PlaneGeometry(W, D, Math.round(W / 14), Math.round(D / 14));
  tg.rotateX(-Math.PI / 2);
  tg.translate(cx, 0, cz);
  const tp = tg.attributes.position;
  const heightAt = (x, z, d) => fbm(x * 0.004, z * 0.004) * 140 * smooth(d, FLAT, FLAT + 260) ** 1.5;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    tp.setY(i, heightAt(x, z, near(x, z).d) - 0.1);
  }
  tg.computeVertexNormals();
  const grid = gridTexture();
  grid.repeat.set(W / 40, D / 40);
  const ground = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ color: '#070a12', roughness: 0.85, metalness: 0.2, emissive: '#3a5a9a', emissiveMap: grid, emissiveIntensity: 0.55 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // One road that widens into a lane per concurrent role; guardrails only on its outer edges
  const edgesAt = (s) => { const l = T.lanesAt(s); return [Math.min(...l) - ROAD_W / 2, Math.max(...l) + ROAD_W / 2]; };
  const strip = (from, to, leftFn, rightFn, y, colorFn) => {
    const pos = [], col = [], idx = [], c = new THREE.Color();
    samples.filter((q) => q.s >= from && q.s <= to).forEach((q, i) => {
      const l = leftFn(q.s), r = rightFn(q.s);
      pos.push(q.p.x + q.n.x * r, y, q.p.z + q.n.z * r, q.p.x + q.n.x * l, y, q.p.z + q.n.z * l);
      if (colorFn) { c.set(colorFn(q.s)); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const mainColor = (s) => (s > T.finishS - 20 ? BRANCH.chicago : roleColor(mainRole(s)));
  const surface = new THREE.Mesh(strip(0, road.total, (s) => edgesAt(s)[0], (s) => edgesAt(s)[1], 0.05), new THREE.MeshStandardMaterial({ color: '#0b0e15', roughness: 0.55, metalness: 0.5 }));
  surface.receiveShadow = true;
  scene.add(surface);
  // lane tints: each lane washed faintly in its role colour
  const tint = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.07, depthWrite: false, toneMapped: false });
  scene.add(new THREE.Mesh(strip(0, road.total, () => -ROAD_W / 2 + 0.3, () => ROAD_W / 2 - 0.3, 0.06, mainColor), tint));
  T.roles.filter((r) => r.slot).forEach((r) => {
    const off = (s) => T.offset(r, s);
    scene.add(new THREE.Mesh(strip(r.s0, r.s1, (s) => off(s) - ROAD_W / 2 + 0.3, (s) => off(s) + ROAD_W / 2 - 0.3, 0.065, () => roleColor(r)), tint));
  });
  // glowing outer edge lines
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  for (const k of [0, 1]) scene.add(new THREE.Mesh(strip(0, road.total, (s) => edgesAt(s)[k] + (k ? -0.35 : 0.13), (s) => edgesAt(s)[k] + (k ? -0.13 : 0.35), 0.08, mainColor), glow));
  // dashed lane dividers in each branch's colour
  {
    const dashG = new THREE.BoxGeometry(0.16, 0.02, 2.4);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
    T.roles.filter((r) => r.slot).forEach((r) => {
      const list = samples.filter((q2) => q2.s > r.s0 + 6 && q2.s < r.s1 - 6 && q2.s % 8 < 1.5);
      const im = new THREE.InstancedMesh(dashG, new THREE.MeshBasicMaterial({ color: roleColor(r), toneMapped: false, transparent: true, opacity: 0.8 }), list.length);
      list.forEach((q2, i) => {
        const o = T.offset(r, q2.s) - Math.sign(r.slot) * ROAD_W / 2; // boundary toward main
        q.setFromAxisAngle(Y, q2.heading);
        m.compose(new THREE.Vector3(q2.p.x + q2.n.x * o, 0.09, q2.p.z + q2.n.z * o), q, one);
        im.setMatrixAt(i, m);
      });
      scene.add(im);
    });
  }
  // Guardrails along the outer edges
  {
    const railPos = [], railCol = [], railIdx = [], postPts = [], topPos = [], topCol = [];
    const c = new THREE.Color();
    for (const k of [0, 1]) {
      let prev = null;
      for (const q2 of samples) {
        if (q2.i % 2) continue;
        const e = edgesAt(q2.s)[k] + (k ? 0.7 : -0.7);
        const p = q2.p.clone().addScaledVector(q2.n, e);
        if (prev) {
          const base = railPos.length / 3;
          for (const [pt, y] of [[prev, 0.45], [p, 0.45], [prev, 0.95], [p, 0.95]]) railPos.push(pt.x, y, pt.z);
          c.set(mainColor(q2.s)); for (let j = 0; j < 4; j++) railCol.push(c.r, c.g, c.b);
          railIdx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
          topPos.push(prev.x, 0.97, prev.z, p.x, 0.97, p.z); topCol.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        if (q2.i % 8 === 0) postPts.push(p);
        prev = p;
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    rg.setAttribute('color', new THREE.Float32BufferAttribute(railCol, 3));
    rg.setIndex(railIdx); rg.computeVertexNormals();
    scene.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.08 })));
    const tg2 = new THREE.BufferGeometry();
    tg2.setAttribute('position', new THREE.Float32BufferAttribute(topPos, 3));
    tg2.setAttribute('color', new THREE.Float32BufferAttribute(topCol, 3));
    scene.add(new THREE.LineSegments(tg2, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false })));
    const post = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 1, 0.14).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#39414d', metalness: 0.7, roughness: 0.4 }), postPts.length);
    const m = new THREE.Matrix4();
    postPts.forEach((p, i) => { m.makeTranslation(p.x, 0, p.z); post.setMatrixAt(i, m); });
    scene.add(post);
  }

  // Branch signs: `git checkout -b` where a branch starts, `git merge` where it ends
  T.roles.forEach((r) => {
    const color = roleColor(r);
    const sAt = r.slot ? r.s0 + r.taper + 4 : r.s0 + 4;
    const f = road.at(sAt);
    const cmd = r.slot ? `$ git checkout -b ${r.id}` : `$ git switch main  # ${r.id}`;
    const sign = neonSign([cmd, `${r.company}, ${r.years}`], color, 7.6, 2.3);
    sign.position.copy(f.p).addScaledVector(f.n, T.offset(r, sAt)); sign.position.y = 7.2;
    sign.rotation.y = f.heading + Math.PI;
    scene.add(sign);
    if (r.slot && r.end !== 'now') {
      const e = road.at(r.s1 - r.taper * 0.5);
      const ms = neonSign([`$ git merge ${r.id}`, `${r.company} ended ${r.end.slice(0, 4)}`], color, 7.2, 2);
      ms.position.copy(e.p).addScaledVector(e.n, T.offset(r, r.s1 - r.taper * 0.5)); ms.position.y = 6.5;
      ms.rotation.y = e.heading + Math.PI;
      scene.add(ms);
    }
  });

  // Years float over the main road every January
  T.years.forEach(({ year, s }) => {
    const f = road.at(s);
    const y = neonSign([String(year)], '#dbe7ff', 7, 2.6);
    y.material.opacity = 0.7;
    y.position.copy(f.p); y.position.y = 13;
    y.rotation.y = f.heading + Math.PI;
    scene.add(y);
  });
  // Finish arch
  {
    const f = road.at(T.finishS);
    const sign = neonSign(['$ git log --graph', 'All branches merge in Chicago'], BRANCH.chicago, 12, 3);
    sign.position.copy(f.p); sign.position.y = 8;
    sign.rotation.y = f.heading + Math.PI;
    scene.add(sign, frameFor(sign, BRANCH.chicago));
  }

  // I-70 shields along main
  const shieldT = shield('70');
  for (let s = 160; s < T.finishS; s += 420) {
    const side = T.activeAt(s).some((r) => r.slot < 0) ? 1 : -1;
    const f = road.at(s);
    const edge = edgesAt(s)[side > 0 ? 1 : 0];
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: shieldT, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    sh.position.copy(f.p).addScaledVector(f.n, edge + side * 3); sh.position.y = 3.2;
    sh.rotation.y = f.heading + Math.PI;
    const east = neonSign(['I-70 EAST'], '#dbe7ff', 2.6, 0.7);
    east.position.copy(sh.position); east.position.y = 4.8; east.rotation.copy(sh.rotation);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#39414d', metalness: 0.7, roughness: 0.4 }));
    pole.position.copy(sh.position); pole.position.y = 1.6;
    scene.add(sh, east, pole);
  }

  // Holographic skylines: Kansas City around Cerner, Chicago at the finish
  const keepOut = [...T.roles, T.finish].map((r) => {
    const f = road.at(r.landmarkS);
    return { p: f.p.clone().addScaledVector(f.n, r.landmarkOffset), r: 70 };
  });
  const clearOfRoads = (s, off, gap) => T.lanesAt(s).every((o) => Math.abs(o - off) > ROAD_W / 2 + gap);
  const cerner = T.roles.find((r) => r.id === 'cerner');
  const zones = [[cerner.s0 + 40, cerner.s1, 70, BRANCH.cerner], [T.finishS - 120, T.finishS + 300, 150, BRANCH.chicago]];
  zones.forEach(([from, to, hMax, color], zi) => {
    const edges = [], faces = [];
    for (let s = from; s < to; s += 14) {
      for (const side of [-1, 1]) {
        const k = Math.floor(s * 3 + side * 7 + zi * 131);
        if (rnd(k, 1) < 0.3) continue;
        const f = road.at(s);
        const off = side * (40 + rnd(k, 2) * 140);
        if (!clearOfRoads(s, off, 30)) continue;
        const pos = f.p.clone().addScaledVector(f.n, off);
        if (keepOut.some((z) => z.p.distanceTo(pos) < z.r)) continue;
        const w = 8 + rnd(k, 3) * 12, d = 8 + rnd(k, 4) * 12, h = 14 + rnd(k, 5) ** 2 * hMax * (Math.abs(off) < 70 ? 0.6 : 1);
        const bg = new THREE.BoxGeometry(w, h, d);
        bg.rotateY(f.heading); bg.translate(pos.x, h / 2, pos.z);
        faces.push(bg);
        const eg = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
        eg.rotateY(f.heading); eg.translate(pos.x, h / 2, pos.z);
        edges.push(eg);
        // window rows as horizontal lines
        for (let y = 6; y < h - 2; y += 5) {
          const lg = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.05, 0.01, d + 0.05));
          lg.rotateY(f.heading); lg.translate(pos.x, y, pos.z);
          edges.push(lg);
        }
      }
    }
    if (!faces.length) return;
    const fm = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(faces), new THREE.MeshStandardMaterial({ color: '#0a0f1c', roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.88 }));
    const em = new THREE.LineSegments(BufferGeometryUtils.mergeGeometries(edges), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, toneMapped: false }));
    scene.add(fm, em);
  });

  return { heightAt };
}

function frameFor(sign, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#2a313c', metalness: 0.7, roughness: 0.4 });
  const w = sign.geometry.parameters.width;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, sign.position.y + 1, 8), m);
    post.position.set(side * (w / 2 + 0.3), (sign.position.y + 1) / 2, 0);
    g.add(post);
  }
  g.position.copy(sign.position); g.position.y = 0;
  g.rotation.copy(sign.rotation);
  return g;
}
