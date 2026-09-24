import * as THREE from 'three';
import { facade, stone, brick, label, billboard, screen } from './textures.js';

// Every landmark is built facing +z (towards the road) and centred on its footprint.
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  return m;
};
const cyl = (rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  return m;
};
const tex = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
const signFace = (lines, w, h, opts) => new THREE.MeshBasicMaterial({ map: label(lines, { w: Math.round(w * 90), h: Math.round(h * 90), ...opts }), toneMapped: false });
function signBoard(lines, w, h, opts = {}) {
  const back = std({ color: '#5b6168' });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), [back, back, back, back, signFace(lines, w, h, opts), back]);
}
function gable(w, h, d, mat) {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat);
}
function portico(n, w, h, mat, pedMat) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const c = cyl(0.55, 0.65, h, mat, -w / 2 + (w / (n - 1)) * i, 1.2, 0, 12);
    g.add(c);
  }
  g.add(box(w + 2.4, 1.2, 4, pedMat, 0, 0, -1));
  g.add(box(w + 2.4, 1.1, 4, pedMat, 0, h + 1.2, -1));
  const ped = gable(w + 2.6, 3.2, 4.2, pedMat);
  ped.position.set(0, h + 2.3, -1);
  g.add(ped);
  return g;
}

export function buildLandmark(kind, animate) {
  const g = new THREE.Group();
  switch (kind) {
    case 'campus': { // Anderson Hall (limestone, central tower) and the football stadium
      const lime = std({ map: tex(stone(), 4, 2), roughness: 0.95 });
      const limeWin = std({ map: tex(facade({ wall: '#d6c9ad', glass: '#39424c', cols: 3, rows: 2, frame: '#b8aa8c' }), 6, 2) });
      const slate = std({ color: '#4b4f57', roughness: 0.7 });
      const wing = (x) => { g.add(box(16, 11, 12, limeWin, x, 0, 0)); const r = gable(16.4, 5, 12.4, slate); r.position.set(x, 11, 0); g.add(r); };
      wing(-13); wing(13);
      g.add(box(10, 14, 13, lime, 0, 0, 0.5));
      g.add(box(7, 16, 7, lime, 0, 14, 1));
      for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 4.5], [3.5, 4.5]]) {
        g.add(cyl(0.9, 0.9, 20, lime, x, 12, z, 10));
        const t = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.5, 10), slate); t.position.set(x, 33.7, z); g.add(t);
      }
      const spire = new THREE.Mesh(new THREE.ConeGeometry(4.6, 10, 4), slate); spire.position.set(0, 35, 1); spire.rotation.y = Math.PI / 4; g.add(spire);
      const clock = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), std({ color: '#f3efe4' })); clock.position.set(0, 25, 4.55); g.add(clock);
      const door = gable(4, 2.4, 1, lime); door.position.set(0, 4.2, 7.2); g.add(door, box(3, 4.2, 0.4, std({ color: '#3b2a1c' }), 0, 0, 7.1));
      // lawn + walk
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(50, 26), std({ color: '#5d9142' })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.03, 19); g.add(lawn);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(4, 26), std({ color: '#cdc6b6' })); walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.05, 19); g.add(walk);
      // Stadium bowl behind, in K-State purple
      const prof = [];
      for (let i = 0; i <= 10; i++) prof.push(new THREE.Vector2(16 + i * 1.6, i * 1.3));
      prof.push(new THREE.Vector2(33, 13.3), new THREE.Vector2(33, 0));
      const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), std({ color: '#512888', side: THREE.DoubleSide, roughness: 0.7 }));
      bowl.scale.set(1.25, 1, 0.85); bowl.position.set(-36, 0, -46); g.add(bowl);
      const field = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), std({ color: '#3f8a3a' })); field.rotation.x = -Math.PI / 2; field.position.set(-36, 0.06, -46); g.add(field);
      for (let i = -3; i <= 3; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 22), std({ color: '#f5f5f0' })); l.rotation.x = -Math.PI / 2; l.position.set(-36 + i * 4.5, 0.07, -46); g.add(l); }
      const board = signBoard(['K-State'], 10, 3, { bg: '#512888' }); board.position.set(-36, 18, -70); g.add(board);
      break;
    }
    case 'press': { // Kedzie Hall, home of the Collegian
      const br = std({ map: tex(brick(), 4, 3) });
      g.add(box(26, 10, 14, br));
      g.add(box(26.6, 1, 14.6, std({ color: '#d8d0c0' }), 0, 10));
      const win = std({ map: tex(facade({ wall: '#8e4a36', glass: '#2d3640', cols: 6, rows: 2, frame: '#e9e0cf' }), 1, 1) });
      const front = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 9), win); front.position.set(0, 5, 7.02); g.add(front);
      const s = signBoard(['Collegian Media Group'], 10, 2.2); s.position.set(0, 12.8, 7.2); g.add(s);
      const bundles = std({ color: '#e8e4da' });
      for (let i = 0; i < 6; i++) g.add(box(1.4, 0.6, 1, bundles, 9 + (i % 3) * 1.5, Math.floor(i / 3) * 0.6, 9));
      break;
    }
    case 'office': {
      const glass = std({ map: tex(facade({ wall: '#2f3d49', glass: '#6c8fac', cols: 6, rows: 3, glassy: true }), 3, 1), metalness: 0.6, roughness: 0.2 });
      g.add(box(28, 13, 16, glass));
      g.add(box(29, 0.8, 17, std({ color: '#d7dbde' }), 0, 13));
      g.add(box(8, 4, 4, std({ color: '#cfd4d8' }), 0, 0, 9));
      const s = signBoard(['Softek'], 7, 1.8, { bg: '#1f3b57' }); s.position.set(0, 14.8, 8.2); g.add(s);
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), std({ color: '#4a4c50' })); lot.rotation.x = -Math.PI / 2; lot.position.set(0, 0.04, 17); g.add(lot);
      break;
    }
    case 'cerner': { // Innovations-style glass towers with a sky bridge
      const blue = std({ map: tex(facade({ wall: '#2a4a66', glass: '#7fa9c9', cols: 6, rows: 10, glassy: true }), 2, 3), metalness: 0.7, roughness: 0.15 });
      g.add(box(16, 58, 16, blue, -12, 0, -4));
      g.add(box(14, 44, 14, blue, 12, 0, -2));
      g.add(box(10, 3, 5, std({ color: '#c9d2d9', metalness: 0.5 }), 0, 22, -3));
      g.add(box(40, 6, 20, std({ map: tex(facade({ wall: '#cfd6db', glass: '#4f6f8a', cols: 8, rows: 1 }), 2, 1) }), 0, 0, 6));
      const s = signBoard(['Cerner'], 9, 2.2, { bg: '#0f5f95' }); s.position.set(0, 7.5, 16.2); g.add(s);
      // Liberty Memorial tower on the skyline
      const lm = std({ map: tex(stone('#d9d2c0'), 1, 6) });
      g.add(box(24, 3, 12, lm, 34, 0, -40), cyl(3.2, 3.8, 50, lm, 34, 3, -40, 12));
      const flame = cyl(1.8, 2.6, 5, std({ color: '#f2c14e', emissive: '#e07b2a', emissiveIntensity: 0.6 }), 34, 53, -40, 12); g.add(flame);
      break;
    }
    case 'rxss': { // Overland Park office tower with a prescription capsule sculpture
      const tower = std({ map: tex(facade({ wall: '#8a949c', glass: '#28394a', cols: 5, rows: 8, frame: '#b9c1c7' }), 2, 3), metalness: 0.2 });
      g.add(box(22, 34, 16, tower, -6, 0, -6));
      g.add(box(22.6, 1.2, 16.6, std({ color: '#c9cfd4' }), -6, 34, -6));
      const s1 = signBoard(['Rx Savings Solutions'], 12, 2, { bg: '#006f86' }); s1.position.set(-6, 30, 2.2); g.add(s1);
      const s2 = signBoard(['McKesson'], 8, 1.8, { bg: '#1b4f9c' }); s2.position.set(-6, 26.5, 2.2); g.add(s2);
      g.add(box(6, 2, 6, std({ color: '#d8d4cc' }), 14, 0, 8));
      const pill = new THREE.Group();
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(2.1, 3.4, 8, 20), std({ color: '#f7f9f4', roughness: 0.3 }));
      const halfG = new THREE.CapsuleGeometry(2.14, 3.4, 8, 20, 1);
      const pos = halfG.attributes.position;
      const idx = [];
      for (let i = 0; i < halfG.index.count; i += 3) {
        const ys = [0, 1, 2].map((k) => pos.getY(halfG.index.getX(i + k)));
        if (Math.min(...ys) >= -0.01) idx.push(halfG.index.getX(i), halfG.index.getX(i + 1), halfG.index.getX(i + 2));
      }
      halfG.setIndex(idx);
      const b = new THREE.Mesh(halfG, std({ color: '#12a08f', roughness: 0.3 }));
      pill.add(a, b);
      pill.position.set(14, 7.5, 8); pill.rotation.z = 0.9;
      g.add(pill);
      animate.push((t) => { pill.rotation.y = t * 0.5; });
      break;
    }
    case 'bess': { // Battery energy storage yard, substation, and wind turbines
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(56, 38), std({ color: '#a9a69c' })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.04, 0); g.add(pad);
      const cont = std({ map: tex(facade({ wall: '#eef0ee', glass: '#c8ccc9', cols: 8, rows: 1, frame: '#d7dad7' }), 1, 1) });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) g.add(box(8, 3, 2.6, cont, -20 + c * 10, 0, -12 + r * 7));
      const tr = std({ color: '#7d8a80', metalness: 0.4 });
      g.add(box(6, 4, 5, tr, 22, 0, 10));
      for (let i = 0; i < 3; i++) g.add(cyl(0.3, 0.3, 3, std({ color: '#b5693a' }), 20.5 + i * 1.5, 4, 10, 8));
      const fence = std({ color: '#9aa0a3', metalness: 0.6, transparent: true, opacity: 0.55 });
      g.add(box(58, 2.4, 0.1, fence, 0, 0, 19), box(58, 2.4, 0.1, fence, 0, 0, -19));
      const s = signBoard(['Fluxpilot', 'Battery energy storage'], 11, 2.8, { bg: '#0d4f6c' }); s.position.set(-16, 3, 21); g.add(s);
      const white = std({ color: '#f1f3f4', roughness: 0.5 });
      [[-18, -42], [4, -48], [26, -40]].forEach(([x, z], i) => {
        g.add(cyl(0.9, 1.6, 42, white, x, 0, z, 12));
        const hub = new THREE.Group(); hub.position.set(x, 42, z + 1.6);
        hub.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), white));
        for (let k = 0; k < 3; k++) {
          const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 20, 0.3).translate(0, 10, 0), white);
          blade.rotation.z = (k / 3) * Math.PI * 2; hub.add(blade);
        }
        g.add(box(2, 1.8, 4, white, x, 41.1, z - 0.4), hub);
        animate.push((t) => { hub.rotation.z = t * 0.8 + i; });
      });
      const panel = std({ color: '#1f3550', metalness: 0.6, roughness: 0.25 });
      for (let i = 0; i < 4; i++) { const p = box(40, 0.2, 3, panel, 0, 1.4, 26 + i * 4.2); p.rotation.x = -0.35; g.add(p); }
      break;
    }
    case 'factory': { // Brick sawtooth factory with stacks and a training screen
      const br = std({ map: tex(brick('#7f4431'), 6, 2) });
      g.add(box(36, 9, 20, br));
      const roof = std({ color: '#6c6f73', metalness: 0.4 });
      for (let i = 0; i < 6; i++) {
        const t = gable(6, 3.5, 20, roof); t.position.set(-15 + i * 6, 9, 0); t.scale.x = 1; g.add(t);
        g.add(box(0.2, 3.3, 19.6, std({ color: '#9fc2da', metalness: 0.3, roughness: 0.2 }), -12.1 + i * 6, 9, 0));
      }
      const stackM = std({ color: '#7a6c62' });
      g.add(cyl(1.2, 1.6, 22, stackM, 13, 0, -7, 12), cyl(1, 1.4, 18, stackM, 17, 0, -4, 12));
      const smoke = [];
      for (let i = 0; i < 6; i++) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), new THREE.MeshStandardMaterial({ color: '#e7e7e7', transparent: true, depthWrite: false }));
        g.add(p); smoke.push(p);
      }
      animate.push((t) => smoke.forEach((p, i) => {
        const k = (t * 0.25 + i / smoke.length) % 1;
        p.position.set(13 + k * 3, 22 + k * 12, -7);
        p.scale.setScalar(0.7 + k * 2.2);
        p.material.opacity = 0.85 * (1 - k);
      }));
      for (let i = 0; i < 3; i++) g.add(box(4, 5, 0.3, std({ color: '#5b6066', metalness: 0.5 }), -12 + i * 6, 0, 10.1));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({ map: screen(['Factory-floor training', 'QR-code access · offline viewing']), toneMapped: false }));
      scr.position.set(8, 6.5, 10.2); g.add(scr);
      const s = signBoard(['Annovox AI'], 9, 2, { bg: '#28324a' }); s.position.set(-8, 10.5, 10.3); g.add(s);
      const truck = new THREE.Group();
      truck.add(box(3, 3.4, 9, std({ color: '#e9ebec' }), 0, 0.8, 0), box(3, 2.8, 2.6, std({ color: '#c8322b' }), 0, 0.8, 6));
      truck.position.set(-6, 0, 16); g.add(truck);
      break;
    }
    case 'capitol': { // Arkansas State Capitol, plus the OpenAI Demo Day stage
      const lime = std({ map: tex(stone('#e8e3d6'), 6, 2), roughness: 0.9 });
      const plain = std({ color: '#ece7da', roughness: 0.85 });
      g.add(box(64, 3, 22, plain, 0, 0, 0));
      g.add(box(60, 12, 18, lime, 0, 3, 0));
      g.add(box(61, 1.4, 19, plain, 0, 15, 0));
      const cp = portico(8, 20, 9, plain, plain); cp.position.set(0, 3, 10.5); g.add(cp);
      for (const x of [-22, 22]) { const p = portico(6, 11, 9, plain, plain); p.position.set(x, 3, 10.5); g.add(p); }
      g.add(cyl(9, 9.5, 5, plain, 0, 16.4, 0, 32));
      for (let a = 0; a < 20; a++) {
        const ang = (a / 20) * Math.PI * 2;
        g.add(cyl(0.45, 0.5, 8, plain, Math.cos(ang) * 8.2, 21.4, Math.sin(ang) * 8.2, 10));
      }
      g.add(cyl(7.9, 7.9, 8, lime, 0, 21.4, 0, 32));
      g.add(cyl(8.8, 8.8, 1.2, plain, 0, 29.4, 0, 32));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), plain);
      dome.position.set(0, 30.6, 0); dome.scale.y = 1.15; g.add(dome);
      g.add(cyl(1.6, 1.8, 4, plain, 0, 39.6, 0, 12));
      const cupola = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#c9a445', metalness: 0.7, roughness: 0.3 }));
      cupola.position.set(0, 43.6, 0); g.add(cupola);
      for (let i = 0; i < 6; i++) g.add(box(24 - i * 2, 0.5, 1.4, plain, 0, i * 0.5, 13 + i * 1.3 - 6));
      // Demo Day stage
      const stage = new THREE.Group();
      stage.add(box(16, 1.2, 8, std({ color: '#1d1f24' })));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(14, 7.8), new THREE.MeshBasicMaterial({ map: screen(['Demo Day', 'OpenAI × GitLab Foundation, San Francisco'], '#0e0f12'), toneMapped: false }));
      scr.position.set(0, 6, -3.6); stage.add(scr);
      stage.add(box(15, 0.5, 0.5, std({ color: '#2a2c31' }), 0, 10, -3.6));
      stage.add(cyl(0.3, 0.4, 1.3, std({ color: '#3a3d44' }), 2, 1.2, 1, 8));
      stage.position.set(44, 0, 18); stage.rotation.y = -0.5;
      g.add(stage);
      break;
    }
    case 'billboards': {
      const ads = [
        ['Meta Ads', 'Published with Addi', '#1b64d8'], ['TikTok Ads', 'Published with Addi', '#15121a'],
        ['Google Ads', 'Published with Addi', '#1a8f47'], ['YouTube Ads', 'Published with Addi', '#c5221f'],
        ['Spotify Ads', 'Published with Addi', '#1a9e52'],
      ];
      const metal = std({ color: '#7b8187', metalness: 0.6 });
      ads.forEach(([t, s, c], i) => {
        const b = new THREE.Group();
        b.add(cyl(0.5, 0.6, 12, metal, 0, 0, 0, 10));
        b.add(box(15, 6.4, 0.6, std({ color: '#2d3136' }), 0, 12, 0));
        const face = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 5.8), new THREE.MeshBasicMaterial({ map: billboard(t, s, c), toneMapped: false }));
        face.position.set(0, 15.2, 0.31); b.add(face);
        b.add(box(15, 0.3, 1.2, metal, 0, 11.8, 0.6));
        b.position.set(-44 + i * 22, 0, (i % 2) * -16);
        b.rotation.y = (i - 2) * -0.12;
        g.add(b);
      });
      break;
    }
    case 'imaging': { // Imaging center with a scanner visible through the glass
      const white = std({ color: '#f1f3f2', roughness: 0.6 });
      const glass = std({ color: '#9cc4d6', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35 });
      g.add(box(30, 9, 18, std({ map: tex(facade({ wall: '#e9ecea', glass: '#7fa6b8', cols: 5, rows: 2 }), 2, 1) }), -8, 0, -2));
      g.add(box(16, 8, 12, glass, 15, 0, 1));
      g.add(box(16.6, 0.8, 12.6, white, 15, 8, 1));
      g.add(box(16, 0.3, 12, std({ color: '#d7dcdb' }), 15, 0.05, 1));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 1.1, 16, 40), white);
      ring.position.set(15, 3.6, 1); g.add(ring);
      const bore = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 8, 40), std({ color: '#2fa3d6', emissive: '#2fa3d6', emissiveIntensity: 0.6 }));
      bore.position.set(15, 3.6, 1.2); g.add(bore);
      const bed = box(1.4, 0.4, 5, std({ color: '#2fa3d6' }), 15, 2.6, 3);
      g.add(bed, box(1.2, 2.6, 1.6, std({ color: '#c9ced2' }), 15, 0, 4));
      animate.push((t) => { bed.position.z = 2.6 + Math.sin(t * 0.7) * 1.6; });
      const s = signBoard(['OneImaging'], 10, 2.2, { bg: '#1c6fb5' }); s.position.set(-8, 9.8, 7.2); g.add(s);
      break;
    }
    case 'chicago': { // Willis Tower, the Hancock, Marina City, the Bean, and the lake
      const dark = std({ map: tex(facade({ wall: '#1c1f24', glass: '#3b4652', cols: 4, rows: 16, glassy: true }), 1, 4), metalness: 0.6, roughness: 0.3 });
      const heights = [[108, 70, 70], [108, 108, 90], [90, 90, 50]];
      heights.forEach((row, r) => row.forEach((h, c) => g.add(box(7, h, 7, dark, -40 + c * 7, 0, -70 + r * 7))));
      g.add(cyl(0.3, 0.4, 20, std({ color: '#d0d4d8' }), -37, 108, -70, 6), cyl(0.3, 0.4, 16, std({ color: '#d0d4d8' }), -30, 108, -63, 6));
      const hancock = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 11, 96, 4, 1), dark);
      hancock.rotation.y = Math.PI / 4; hancock.position.set(12, 48, -90); g.add(hancock);
      g.add(cyl(0.3, 0.4, 18, std({ color: '#d0d4d8' }), 10, 96, -90, 6), cyl(0.3, 0.4, 18, std({ color: '#d0d4d8' }), 14, 96, -90, 6));
      const concrete = std({ color: '#d8d6d0' });
      for (const x of [34, 44]) {
        g.add(cyl(3.8, 3.8, 52, std({ color: '#8f8c86' }), x, 0, -46, 20));
        for (let y = 16; y < 52; y += 2.2) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.55, 6, 18), concrete);
          ring.rotation.x = Math.PI / 2; ring.position.set(x, y, -46); g.add(ring);
        }
      }
      const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), std({ color: '#c9c5bc' })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(-4, 0.04, 6); g.add(plaza);
      const bean = new THREE.Mesh(new THREE.SphereGeometry(4, 48, 24), std({ color: '#ffffff', metalness: 1, roughness: 0.04 }));
      bean.scale.set(2, 1, 1.3); bean.position.set(-4, 3.4, 6); g.add(bean);
      const lake = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), std({ color: '#2d6f8f', metalness: 0.3, roughness: 0.15 }));
      lake.rotation.x = -Math.PI / 2; lake.position.set(0, 0.2, -330); g.add(lake);
      // Trophy case for the awards
      const gold = std({ color: '#e0b43c', metalness: 0.9, roughness: 0.25 });
      [-14, 14].forEach((x, i) => {
        g.add(box(3, 2, 3, std({ color: '#2f3237' }), x, 0, 14));
        g.add(cyl(0.4, 0.8, 1.6, gold, x, 2, 14, 12));
        const cup = cyl(1.6, 0.6, 2.4, gold, x, 3.6, 14, 18); g.add(cup);
        animate.push((t) => { cup.rotation.y = t * (i ? -1 : 1); });
      });
      break;
    }
  }
  g.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
