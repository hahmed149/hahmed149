import * as THREE from 'three';

export const C = {
  sign: 0x0b6b3a,
  signWhite: 0xf7f9f4,
  asphalt: 0x2b2d31,
  wheat: 0xd9b45a,
  grass: 0x7d9a4a,
  sky: 0xa9cfe4,
  line: 0xf2c230,
  purple: 0x512888,
};

const ROAD_WIDTH = 8;
const SIGN_FONT = '"Overpass", system-ui, sans-serif';

// Control points for the highway; stops sit on the odd-numbered points.
const ROUTE = [
  [-40, 250], [0, 215], [45, 190], [60, 140], [20, 105], [-40, 90], [-85, 50],
  [-70, 0], [-20, -20], [35, -10], [85, -40], [95, -95], [50, -130], [-10, -120],
  [-65, -150], [-80, -205], [-40, -245], [20, -250],
];
const STOP_POINTS = [1, 3, 5, 7, 9, 11, 13, 15];

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts });
}

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
function fbm(x, z) {
  return noise(x, z) * 0.6 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.1;
}

export function buildRoad() {
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
  const N = 900;
  const samples = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    samples.push({ u, p: curve.getPointAt(u), t: curve.getTangentAt(u) });
  }
  // u of each stop = u of the nearest sample to its control point
  const stopU = STOP_POINTS.map((idx) => {
    const [x, z] = ROUTE[idx];
    let best = 0, bd = Infinity;
    for (const s of samples) {
      const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2;
      if (d < bd) { bd = d; best = s.u; }
    }
    return best;
  });

  function nearest(pos) {
    let best = samples[0], bd = Infinity;
    for (const s of samples) {
      const d = (s.p.x - pos.x) ** 2 + (s.p.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return { sample: best, dist: Math.sqrt(bd) };
  }

  return { curve, samples, stopU, nearest };
}

function ribbon(samples, width, y) {
  const pos = [], idx = [];
  samples.forEach((s, i) => {
    const nx = -s.t.z, nz = s.t.x;
    pos.push(s.p.x + nx * width / 2, y, s.p.z + nz * width / 2, s.p.x - nx * width / 2, y, s.p.z - nz * width / 2);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildWorld(scene, road) {
  const { samples } = road;
  const coarse = samples.filter((_, i) => i % 6 === 0);
  const distToRoad = (x, z) => {
    let bd = Infinity;
    for (const s of coarse) { const d = (s.p.x - x) ** 2 + (s.p.z - z) ** 2; if (d < bd) bd = d; }
    return Math.sqrt(bd);
  };

  // Terrain: flat prairie near the road, rolling hills farther out, wheat and grass patches.
  const size = 700, seg = 140;
  const tg = new THREE.PlaneGeometry(size, size, seg, seg);
  tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, colors = [];
  const wheat = new THREE.Color(C.wheat), grass = new THREE.Color(C.grass), dirt = new THREE.Color(0xb8925a);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i);
    const d = distToRoad(x, z);
    const ramp = THREE.MathUtils.smoothstep(d, 26, 70);
    tp.setY(i, fbm(x * 0.02, z * 0.02) * 28 * ramp - 0.05);
    const n = fbm(x * 0.012 + 40, z * 0.012);
    const c = n > 0.52 ? grass.clone() : wheat.clone();
    if (d < 7) c.lerp(dirt, 0.5);
    c.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.05);
    colors.push(c.r, c.g, c.b);
  }
  tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Road surface, shoulders, and dashed center line
  const shoulder = new THREE.Mesh(ribbon(samples, ROAD_WIDTH + 1.6, 0.02), mat(0x8c8a84));
  const asphalt = new THREE.Mesh(ribbon(samples, ROAD_WIDTH, 0.04), mat(C.asphalt, { roughness: 0.95 }));
  shoulder.receiveShadow = asphalt.receiveShadow = true;
  scene.add(shoulder, asphalt);

  const dashes = samples.filter((_, i) => i % 5 === 0);
  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.02, 2), mat(C.line, { roughness: 0.6 }), dashes.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  dashes.forEach((s, i) => {
    q.setFromAxisAngle(up, Math.atan2(s.t.x, s.t.z));
    m.compose(new THREE.Vector3(s.p.x, 0.06, s.p.z), q, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(i, m);
  });
  scene.add(dashMesh);

  // Trees: scattered away from the road and the stops
  const trunks = [], crowns = [];
  for (let i = 0; i < 700; i++) {
    const x = (hash(i, 1) - 0.5) * size * 0.9, z = (hash(i, 2) - 0.5) * size * 0.9;
    const d = distToRoad(x, z);
    if (d < 14 || fbm(x * 0.03, z * 0.03) < 0.45) continue;
    const ramp = THREE.MathUtils.smoothstep(d, 26, 70);
    const y = fbm(x * 0.02, z * 0.02) * 28 * ramp;
    const s = 0.7 + hash(i, 3) * 0.9;
    trunks.push([x, y, z, s]);
    crowns.push([x, y, z, s]);
  }
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 5), mat(0x6b4a2b), trunks.length);
  const crownMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 4.5, 6), mat(0x3f6b35), crowns.length);
  trunks.forEach(([x, y, z, s], i) => {
    m.compose(new THREE.Vector3(x, y + s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunkMesh.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, y + s * 4, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    crownMesh.setMatrixAt(i, m);
  });
  trunkMesh.castShadow = crownMesh.castShadow = true;
  scene.add(trunkMesh, crownMesh);

  return { distToRoad };
}

// Green highway guide sign with white lettering, drawn on a canvas.
function signTexture(lines, w, h, { exit, small } = {}) {
  const scale = 128;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const g = cv.getContext('2d');
  const r = 0.35 * scale;
  g.fillStyle = '#0b6b3a';
  g.beginPath(); g.roundRect(0, 0, cv.width, cv.height, r); g.fill();
  g.strokeStyle = '#f7f9f4'; g.lineWidth = 0.09 * scale;
  g.beginPath(); g.roundRect(0.14 * scale, 0.14 * scale, cv.width - 0.28 * scale, cv.height - 0.28 * scale, r * 0.7); g.stroke();
  g.fillStyle = '#f7f9f4'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = exit ? 0.95 * scale : cv.height / 2 - (lines.length - 1) * 0.42 * scale;
  if (exit) {
    g.font = `800 ${0.5 * scale}px ${SIGN_FONT}`;
    g.fillText(`EXIT ${exit}`, cv.width / 2, 0.6 * scale);
    y = 1.45 * scale;
  }
  lines.forEach((line, i) => {
    const big = i === 0;
    let size = (big ? (small ? 0.75 : 0.72) : 0.46) * scale;
    g.font = `${big ? 800 : 600} ${size}px ${SIGN_FONT}`;
    while (g.measureText(line).width > cv.width - 0.7 * scale && size > 10) {
      size -= 4; g.font = `${big ? 800 : 600} ${size}px ${SIGN_FONT}`;
    }
    g.fillText(line, cv.width / 2, y);
    y += (big ? 0.85 : 0.62) * scale;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signBoard(lines, w, h, opts = {}) {
  const grp = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), [
    mat(0x5b6168), mat(0x5b6168), mat(0x5b6168), mat(0x5b6168),
    new THREE.MeshBasicMaterial({ map: signTexture(lines, w, h, opts), toneMapped: false }),
    mat(0x5b6168),
  ]);
  const poleH = opts.small ? 4.5 : 5.5;
  board.position.y = poleH + h / 2;
  board.castShadow = true;
  grp.add(board);
  for (const x of [-w * 0.35, w * 0.35]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, poleH + h * 0.6, 6), mat(0x8d949b, { metalness: 0.5 }));
    pole.position.set(x, (poleH + h * 0.6) / 2, -0.2);
    pole.castShadow = true;
    grp.add(pole);
  }
  return grp;
}

export function buildStops(scene, road, stops) {
  const animated = [];
  const placed = stops.map((stop, i) => {
    const s = road.samples.reduce((a, b) => (Math.abs(b.u - road.stopU[i]) < Math.abs(a.u - road.stopU[i]) ? b : a));
    const nx = -s.t.z, nz = s.t.x; // left-hand normal
    const side = i % 2 === 0 ? 1 : -1;
    const heading = Math.atan2(s.t.x, s.t.z);

    const sign = signBoard([stop.company, stop.place], 9, 3.4, { exit: stop.exit });
    sign.position.set(s.p.x + nx * side * 7.5, 0, s.p.z + nz * side * 7.5);
    sign.rotation.y = heading + Math.PI; // face oncoming traffic
    scene.add(sign);

    const lm = landmark(stop.landmark, animated);
    lm.position.set(s.p.x + nx * side * 22, 0, s.p.z + nz * side * 22);
    lm.rotation.y = heading + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    lm.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(lm);

    // Exit pad on the road: a pale ring the car drives through
    const pad = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.8, 40), new THREE.MeshBasicMaterial({ color: C.signWhite, transparent: true, opacity: 0.55 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.p.x, 0.07, s.p.z);
    scene.add(pad);

    return { ...stop, pos: s.p.clone(), u: s.u, pad };
  });
  return { placed, animated };
}

function landmark(kind, animated) {
  const g = new THREE.Group();
  const add = (geo, color, x = 0, y = 0, z = 0, opts) => {
    const mesh = new THREE.Mesh(geo, mat(color, opts));
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  switch (kind) {
    case 'tower': { // K-State purple bell tower
      add(new THREE.BoxGeometry(10, 5, 10), 0xc9b79c, 0, 2.5);
      add(new THREE.BoxGeometry(4.5, 16, 4.5), C.purple, 0, 13);
      add(new THREE.BoxGeometry(5.2, 1, 5.2), 0xe8e2d6, 0, 21.5);
      add(new THREE.ConeGeometry(3.6, 5, 4), 0x3a1c63, 0, 24.5).rotation.y = Math.PI / 4;
      break;
    }
    case 'office': {
      add(new THREE.BoxGeometry(12, 9, 8), 0x6d8fa8, 0, 4.5, 0, { metalness: 0.3, roughness: 0.4 });
      for (let y = 1.8; y < 9; y += 2.2) add(new THREE.BoxGeometry(12.1, 0.3, 8.1), 0xdfe6ea, 0, y);
      add(new THREE.BoxGeometry(3, 2.5, 0.3), 0x2f3b45, 0, 1.25, 4.1);
      break;
    }
    case 'hospital': {
      add(new THREE.BoxGeometry(16, 10, 9), 0xf1f1ee, 0, 5);
      add(new THREE.BoxGeometry(6, 14, 7), 0xe4e6e3, -3, 7);
      for (let x = -6; x <= 6; x += 3) for (let y = 3; y < 10; y += 3) add(new THREE.BoxGeometry(1.4, 1.2, 0.2), 0x7fa9c4, x, y, 4.6);
      add(new THREE.BoxGeometry(1.2, 4, 1.2), 0xd0342c, -3, 16);
      add(new THREE.BoxGeometry(4, 1.2, 1.2), 0xd0342c, -3, 16);
      break;
    }
    case 'capsule': { // pill sculpture on a plinth
      add(new THREE.BoxGeometry(6, 2, 6), 0xd8d4cc, 0, 1);
      const pill = new THREE.Group();
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(2, 3.2, 6, 14), mat(0xf7f9f4));
      const b = new THREE.Mesh(new THREE.CylinderGeometry(2.03, 2.03, 3.2, 14, 1, true, 0, Math.PI * 2), mat(0x1f9c8e));
      b.position.y = 1.6; b.scale.set(1, 0.5, 1);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1f9c8e));
      cap.position.y = 1.6;
      pill.add(a, b, cap);
      pill.position.y = 6; pill.rotation.z = 0.9;
      g.add(pill);
      animated.push((t) => { pill.rotation.y = t * 0.4; });
      break;
    }
    case 'factory': {
      add(new THREE.BoxGeometry(16, 6, 10), 0x9a6b4f, 0, 3);
      for (let x = -6; x <= 6; x += 4) {
        const tooth = add(new THREE.CylinderGeometry(0, 2.9, 2.5, 3, 1), 0x7c5640, x, 7.2);
        tooth.rotation.set(Math.PI / 2, 0, Math.PI / 2); tooth.scale.set(1, 3.4, 1);
      }
      add(new THREE.CylinderGeometry(0.9, 1.2, 16, 8), 0x8b8580, 6, 8, -3);
      const puffs = [0, 1, 2].map((i) => add(new THREE.IcosahedronGeometry(1.2, 0), 0xe6e6e6, 6, 17 + i * 2, -3));
      animated.push((t) => puffs.forEach((p, i) => {
        const k = (t * 0.35 + i / 3) % 1;
        p.position.y = 16.5 + k * 7; p.scale.setScalar(0.6 + k * 1.4); p.material.opacity = 1 - k;
        p.material.transparent = true;
      }));
      break;
    }
    case 'capitol': {
      add(new THREE.BoxGeometry(18, 4, 10), 0xe9e4d8, 0, 2);
      add(new THREE.BoxGeometry(8, 3, 8), 0xe2dccd, 0, 5.5);
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), 0xf5f1e8, Math.cos(ang) * 3.6, 9, Math.sin(ang) * 3.6);
      }
      add(new THREE.CylinderGeometry(4, 4, 0.6, 16), 0xe2dccd, 0, 11.2);
      add(new THREE.SphereGeometry(3.8, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd9c07a, 0, 11.4, 0, { metalness: 0.4, roughness: 0.4 });
      add(new THREE.CylinderGeometry(0.5, 0.5, 2.5, 8), 0xe9e4d8, 0, 16);
      break;
    }
    case 'mri': { // MRI scanner ring with a sliding patient bed
      add(new THREE.BoxGeometry(14, 0.6, 9), 0xdfe3e6, 0, 0.3);
      const ring = add(new THREE.TorusGeometry(4, 1.6, 12, 32), 0xf4f6f7, 0, 6.2);
      ring.rotation.y = Math.PI / 2;
      add(new THREE.TorusGeometry(2.45, 0.12, 8, 32), 0x2fa3d6, 0, 6.2).rotation.y = Math.PI / 2;
      add(new THREE.BoxGeometry(1.2, 4, 1.8), 0xc9ced2, 0, 2.3);
      const bed = add(new THREE.BoxGeometry(1.8, 0.5, 7), 0x2fa3d6, 0, 4.8, 3);
      animated.push((t) => { bed.position.z = 1.2 + Math.sin(t * 0.6) * 2.2; });
      break;
    }
    case 'skyline': { // Chicago skyline with a trophy out front
      const towers = [[-8, 18, 3], [-4, 26, 4], [0, 40, 5], [4.5, 30, 4], [8.5, 22, 3.5], [-12, 14, 3.5], [12, 16, 3]];
      towers.forEach(([x, h, w], i) => add(new THREE.BoxGeometry(w, h, w), i === 2 ? 0x2a2f36 : 0x5d6b78, x, h / 2, -4, { metalness: 0.3, roughness: 0.5 }));
      add(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), 0x2a2f36, -1, 43.5, -4);
      add(new THREE.CylinderGeometry(0.15, 0.15, 7, 5), 0x2a2f36, 1, 43.5, -4);
      const gold = { metalness: 0.8, roughness: 0.25 };
      add(new THREE.BoxGeometry(3, 1.5, 3), 0x3b3f45, 0, 0.75, 7);
      add(new THREE.CylinderGeometry(0.4, 0.8, 2, 10), 0xe0b43c, 0, 2.5, 7, gold);
      const cup = add(new THREE.CylinderGeometry(1.6, 0.6, 2.4, 14), 0xe0b43c, 0, 4.7, 7, gold);
      animated.push((t) => { cup.rotation.y = t; });
      break;
    }
  }
  return g;
}
