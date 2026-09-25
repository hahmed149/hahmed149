import * as THREE from 'three';
import { ROAD_W, neonSign } from './world.js';
import { BRANCH, GOLD, hash7 } from './theme.js';

const MONO = '"JetBrains Mono", ui-monospace, monospace';

function tagSprite(hash, text, color, scale = 1) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `700 40px ${MONO}`;
  g.font = font;
  const w = Math.ceil(g.measureText(`${hash}  ${text}`).width) + 48;
  c.width = w; c.height = 72;
  g.fillStyle = 'rgba(6,10,20,0.8)';
  g.beginPath(); g.roundRect(0, 0, w, 72, 14); g.fill();
  g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); g.roundRect(2, 2, w - 4, 68, 12); g.stroke();
  g.font = font; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(hash, 24, 38);
  g.fillStyle = '#eef3ff'; g.fillText(text, 24 + g.measureText(`${hash}  `).width, 38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, toneMapped: false }));
  s.scale.set((w / 72) * 0.75 * scale, 0.75 * scale, 1);
  return s;
}

const ringG = new THREE.TorusGeometry(2.1, 0.12, 12, 56);
const coreG = new THREE.IcosahedronGeometry(0.2, 1);
const cubeG = new THREE.BoxGeometry(0.55, 0.55, 0.55);
const cubeEdgeG = new THREE.EdgesGeometry(cubeG);
const gemG = new THREE.OctahedronGeometry(1.1, 0);

function commitRing(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true });
  const ring = new THREE.Mesh(ringG, mat); ring.position.y = 2.6;
  const core = new THREE.Mesh(coreG, new THREE.MeshBasicMaterial({ color, transparent: true })); core.position.y = 2.6;
  g.add(ring, core);
  g.userData = { ring, core, mats: [mat, core.material] };
  return g;
}
function courseNode(color) {
  const g = new THREE.Group();
  const cube = new THREE.Mesh(cubeG, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.35), transparent: true, opacity: 0.8 }));
  const edge = new THREE.LineSegments(cubeEdgeG, new THREE.LineBasicMaterial({ color, toneMapped: false, transparent: true }));
  cube.add(edge);
  cube.position.y = 1.2;
  g.add(cube);
  g.userData = { spin: cube, mats: [cube.material, edge.material] };
  return g;
}
function release() {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(gemG, new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.9, metalness: 0.9, roughness: 0.2, transparent: true }));
  gem.position.y = 2.4;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 8, 48), new THREE.MeshBasicMaterial({ color: GOLD, toneMapped: false, transparent: true }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 2.4;
  g.add(gem, halo);
  g.userData = { spin: gem, halo, mats: [gem.material, halo.material] };
  return g;
}

let _dot;
function dot() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return (_dot = new THREE.CanvasTexture(c));
}

// Particle bursts, pooled
function burstPool(scene) {
  const N = 90, pool = [];
  for (let k = 0; k < 8; k++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    const mat = new THREE.PointsMaterial({ size: 0.16, map: dot(), alphaTest: 0.01, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false; pts.frustumCulled = false;
    scene.add(pts);
    pool.push({ pts, vel: new Float32Array(N * 3), t: 99 });
  }
  let next = 0;
  return {
    fire(pos, color) {
      const b = pool[next++ % pool.length];
      const p = b.pts.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 2 + Math.random() * 5;
        b.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp; b.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp; b.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      }
      b.pts.material.color.set(color); b.pts.material.opacity = 1; b.pts.visible = true; b.t = 0;
      b.pts.geometry.attributes.position.needsUpdate = true;
    },
    update(dt) {
      for (const b of pool) {
        if (b.t > 1.2) { b.pts.visible = false; continue; }
        b.t += dt;
        const p = b.pts.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i++) { p[i] += b.vel[i] * dt; if (i % 3 === 1) b.vel[i] -= 9 * dt; }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, 1 - b.t / 1.2);
      }
    },
  };
}

// Builds every collectible on its role's road. Passing through (or into) one captures it.
export function buildObstacles(scene, road, T) {
  const list = [];
  const bursts = burstPool(scene);
  T.roles.forEach((r) => {
    const color = BRANCH[r.id] ?? BRANCH.main;
    r.items.forEach((item, n) => {
      const off = T.offset(r, item.s);
      const f = road.at(item.s);
      if (item.type === 'gate') {
        const sem = item.sem;
        const tag = `v${sem.term.split(' ')[1]}-${sem.term.split(' ')[0].toLowerCase()}`;
        const sign = neonSign([`$ git tag ${tag}`, sem.honors ? `${sem.term} · semester honors` : sem.term], color, 7.4, 2);
        sign.position.copy(f.p).addScaledVector(f.n, off); sign.position.y = 6.4;
        sign.rotation.y = f.heading + Math.PI;
        scene.add(sign);
        const k = sem.courses.length, cs = item.s + 9, cf = road.at(cs);
        sem.courses.forEach(([code, name], j) => {
          const node = courseNode(color);
          const lateral = off + (j - (k - 1) / 2) * Math.min(1.15, (ROAD_W - 1.6) / Math.max(1, k - 1));
          node.position.copy(cf.p).addScaledVector(cf.n, lateral);
          const lbl = tagSprite('', code, color, 0.75); lbl.position.y = 2.3; node.add(lbl);
          scene.add(node);
          list.push({ kind: 'course', mesh: node, s: cs, lateral, laneOff: off, radius: 0.8, role: r.index, title: code, text: `${code}: ${name}`, term: sem.term, color, hash: hash7(code + sem.term) });
        });
      } else {
        const isRelease = item.type === 'release';
        const lateral = off;
        const mesh = isRelease ? release() : commitRing(color);
        mesh.position.copy(f.p).addScaledVector(f.n, lateral);
        mesh.rotation.y = f.heading;
        const h = hash7(item.text);
        const lbl = tagSprite(h, item.label, isRelease ? GOLD : color); lbl.position.y = isRelease ? 4.6 : 5.6; mesh.add(lbl);
        scene.add(mesh);
        list.push({ kind: isRelease ? (item.community ? 'community' : 'release') : 'commit', mesh, s: item.s, lateral, radius: isRelease ? 1.4 : 2.4, role: r.index, title: item.label, text: item.text, color: isRelease ? GOLD : color, hash: h });
      }
    });
  });

  const active = [];
  function capture(o, car) {
    o.hit = true; o.t = 0;
    o.mesh.children.filter((c) => c.isSprite).forEach((c) => c.removeFromParent());
    o.start = o.mesh.position.clone();
    bursts.fire(o.mesh.position.clone().add(new THREE.Vector3(0, o.kind === 'course' ? 1.2 : 2.5, 0)), o.color);
    active.push(o);
  }

  function update(dt, car, t, onHit) {
    for (const o of list) {
      if (o.hit || Math.abs(o.s - car.s) > 8) continue;
      const dist = Math.hypot(o.mesh.position.x - car.x, o.mesh.position.z - car.z);
      const direct = dist < o.radius + 1;
      const passed = car.s > o.s + 0.5 && car.prevS <= o.s + 0.5 && Math.abs(car.lateral - (o.laneOff ?? o.lateral)) < ROAD_W / 2;
      if (direct || passed) { capture(o, car); onHit(o, direct); }
    }
    // idle motion near the car
    for (const o of list) {
      if (o.hit || Math.abs(o.s - car.s) > 260) continue;
      const u = o.mesh.userData;
      if (u.spin) { u.spin.rotation.y = t * 1.4 + o.s; u.spin.rotation.x = t * 0.6; }
      if (u.core) u.core.scale.setScalar(1 + Math.sin(t * 4 + o.s) * 0.2);
      if (u.halo) u.halo.rotation.z = t;
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const o = active[i];
      o.t += dt;
      const k = Math.min(1, o.t / (o.kind === 'course' ? 0.5 : 0.32));
      const m = o.mesh;
      if (o.kind === 'course') { // fly into the car
        m.position.lerpVectors(o.start, new THREE.Vector3(car.x, 0, car.z), k);
        m.scale.setScalar(1 - k * 0.9);
      } else {
        m.scale.setScalar(1 + k * 0.35);
        m.position.y = o.start.y + k * 1.2;
      }
      m.userData.mats.forEach((mt) => { mt.opacity = 1 - k; });
      if (k >= 1) { m.removeFromParent(); active.splice(i, 1); }
    }
    bursts.update(dt);
  }

  return { list, update };
}
